import type { FastMCP } from 'fastmcp';
import { withSession, type Session } from '../../lib/session';
import { z } from 'zod';
import { listEntities } from '../../lib/ngsi-ld';
import { ENTITY_LIMIT, UNKNOWN_ATTRIBUTES, ADDITIONAL_PROPERTY } from '../../lib/constants';
import type { LoadedSchema } from '../../lib/schema';
import type { SchemaRegistry } from '../../lib/registry';
import {
    fail,
    stripContext,
    clampLimit,
    okPage,
    spreadAdditionalProperty,
    queryClauseHeads,
    rewriteAdditionalPropertyQuery,
    pickWithAdditionalProperty,
    snapEnumCase,
    nearMatches,
    CORE_ENTITY_ATTRS,
    exampleUrn
} from './util';

const ADDITIONAL_PROPERTY_MODE = UNKNOWN_ATTRIBUTES === 'additionalProperty';

const shape = (e: unknown): unknown => {
    const s = stripContext(e);
    return ADDITIONAL_PROPERTY_MODE ? spreadAdditionalProperty(s, ADDITIONAL_PROPERTY) : s;
};

export interface EntityQueryArgs {
    entityType: string;
    ids?: string;
    idPattern?: string;
    filter?: string;
    pick?: string;
    limit?: number;
    offset?: number;
    metadataOnly?: boolean;
    compact?: boolean;
    georel?: string;
    geometry?: string;
    coordinates?: string;
    geoproperty?: string;
}

export const reprFormat = (compact?: boolean): 'simplified' | 'concise' => (compact ? 'simplified' : 'concise');

export function needsSysAttrs(pick?: string): boolean {
    const names = pick ? pick.split(',').map((s) => s.trim()) : [];
    return names.includes('createdAt') || names.includes('modifiedAt');
}

export const REPR_PARAM_DESC =
    'Default keeps metadata: `{value, unitCode?, observedAt?}`, links as `{object: "<URN>"}`, enumerations as ' +
    '`{vocab}`. true returns bare values and URN strings.';

// For a query that matched nothing: which requested types or filter attributes the loaded
// schemas do not know, with the closest known names. Advisory only — a type or attribute the
// schemas lack can still exist on the broker, so a partial (low-trust) profile is not checked.
export function emptyResultHints(entityType: string, filter: string | undefined, schemas: LoadedSchema[]): string[] {
    if (!schemas.length) {
        return [];
    }
    const hints: string[] = [];
    const byType = new Map(schemas.map((s) => [s.typeName.toLowerCase(), s]));
    const known: LoadedSchema[] = [];
    for (const raw of entityType.split(',')) {
        const t = raw.trim();
        const schema = t ? byType.get(t.toLowerCase()) : undefined;
        if (schema) {
            known.push(schema);
        } else if (t) {
            const near = nearMatches(
                t,
                schemas.map((s) => s.typeName)
            );
            hints.push(
                near.length
                    ? `"${t}" is not a known type. Did you mean: ${near.join(', ')}?`
                    : `"${t}" is not a known type. Call discover_context_meta_data to list the types.`
            );
        }
    }
    const checkable = known.filter((s) => !s.lowTrust);
    if (checkable.length && checkable.length === known.length) {
        const attrs = new Set([
            'id',
            'type',
            ...CORE_ENTITY_ATTRS,
            ...checkable.flatMap((s) => Object.keys(s.writeAttrs))
        ]);
        const label = checkable.map((s) => s.typeName).join(', ');
        for (const head of new Set(queryClauseHeads(filter))) {
            if (attrs.has(head)) continue;
            const near = nearMatches(head, attrs);
            hints.push(
                near.length
                    ? `"${head}" is not a known attribute of ${label}. Did you mean: ${near.join(', ')}?`
                    : `"${head}" is not a known attribute of ${label}. Call discover_context_meta_data with name set to the type to list its attributes.`
            );
        }
    }
    return hints;
}

// Shared execute body for query_entities and its geo superset: additionalProperty q/pick
// bracketing, VocabProperty expandValues auto-fill, an optional geo predicate, then okPage.
// `registry`, when given, supplies the current schemas so a later discovery pass reaches the hints.
export function makeEntityQuery(schemas: LoadedSchema[], registry?: SchemaRegistry) {
    // Maps each type (lower-cased) to its VocabProperty attributes and their enum values.
    const vocabByType = new Map<string, Record<string, string[]>>();
    for (const s of schemas) {
        const vocab: Record<string, string[]> = {};
        for (const [name, w] of Object.entries(s.writeAttrs)) {
            if (w.ngsiType === 'VocabProperty' && w.enumValues?.length) {
                vocab[name] = w.enumValues;
            }
        }
        vocabByType.set(s.typeName.toLowerCase(), vocab);
    }

    return async (args: EntityQueryArgs, toolName: string) => {
        const { entityType, ids, idPattern, filter, pick, limit, offset, metadataOnly, compact } = args;
        try {
            // `type` may be a comma list; pool the VocabProperties of every named type.
            const types = entityType.split(',').map((t) => t.trim().toLowerCase());
            const vocabMaps = types.map((t) => vocabByType.get(t)).filter((m): m is Record<string, string[]> => !!m);
            const enumsFor = (attr: string): string[] | undefined => vocabMaps.map((m) => m[attr]).find((v) => v);
            const snappedFilter = snapEnumCase(filter, enumsFor);

            // No schema here, so unmodelled attrs live in the JsonProperty container: bracket
            // bare `q` heads and pull the whole container for `pick`, so the caller need not.
            const effectiveQ = ADDITIONAL_PROPERTY_MODE
                ? rewriteAdditionalPropertyQuery(snappedFilter, CORE_ENTITY_ATTRS, ADDITIONAL_PROPERTY)
                : snappedFilter;
            let effectivePick = ADDITIONAL_PROPERTY_MODE
                ? pickWithAdditionalProperty(pick, null, ADDITIONAL_PROPERTY)
                : pick;
            // A geo query (args.geoproperty set) is always about that attribute's coordinates —
            // keep it in the result even when the caller's `pick` didn't ask for it.
            if (args.geoproperty && effectivePick) {
                const names = effectivePick
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean);
                if (!names.includes(args.geoproperty)) {
                    effectivePick = [...names, args.geoproperty].join(',');
                }
            }

            // Expand only the enumerated attributes actually filtered on — the broker
            // 400s if `expandValues` names a non-enumerated attribute.
            const heads = queryClauseHeads(filter);
            const ev = new Set(vocabMaps.flatMap((m) => Object.keys(m)).filter((attr) => heads.includes(attr)));

            const page = await listEntities({
                type: entityType,
                id: ids,
                idPattern,
                q: effectiveQ,
                pick: effectivePick,
                expandValues: ev.size ? [...ev].join(',') : undefined,
                georel: args.georel,
                geometry: args.geometry,
                coordinates: args.coordinates,
                geoproperty: args.geoproperty,
                limit: clampLimit(limit),
                offset,
                metadataOnly,
                format: reprFormat(compact),
                sysAttrs: needsSysAttrs(effectivePick) || undefined
            });
            const empty = page.total === 0 || (page.total === null && page.returned === 0);
            const hints = empty ? emptyResultHints(entityType, filter, registry?.get().schemas ?? schemas) : [];
            return okPage(page.entities.map(shape), page, toolName, entityType, metadataOnly === true, hints);
        } catch (err) {
            return fail(err);
        }
    };
}

export function registerQueryEntities(
    server: FastMCP<Session>,
    schemas: LoadedSchema[] = [],
    registry?: SchemaRegistry
): void {
    const query = makeEntityQuery(schemas, registry);

    server.addTool({
        name: 'query_entities',
        annotations: { title: 'Query entities', readOnlyHint: true, openWorldHint: false },
        description:
            'Current-state search over one entity type, or a comma-separated list. Confirm attribute names and ' +
            'enumerated values with `discover_context_meta_data`; do not guess. `filter`: `;` = AND, `|` = OR, ' +
            'operators `==` `!=` `>` `<` `>=` `<=` `~=`, string values in double quotes. `pick` only the attributes ' +
            'you need (unpicked records are much larger) and use `metadataOnly` to count first. Results are ' +
            'paginated: when `pagination.hasMore` is true, call again with `offset` or narrow the query.',
        parameters: z.object({
            entityType: z
                .string()
                .describe(
                    'Entity type, or a comma-separated list to match any. Use a type name returned by ' +
                        '`discover_context_meta_data`.'
                ),
            ids: z
                .string()
                .optional()
                .describe(
                    `Comma-separated entity URNs to fetch, e.g. "${exampleUrn(schemas, 'a')},${exampleUrn(schemas, 'b')}".`
                ),
            idPattern: z
                .string()
                .optional()
                .describe(`Regular expression the entity URN must match, e.g. "^${exampleUrn(schemas, '')}".`),
            filter: z
                .string()
                .optional()
                .describe(
                    'E.g. `status=="active"` or `count>400`. Enumerated values are case-sensitive, but a case-only ' +
                        'difference is corrected. To just see a value, `pick` it instead of filtering.'
                ),
            pick: z
                .string()
                .optional()
                .describe(
                    'Comma-separated attribute names to return, e.g. "id,status,count". Unset returns every attribute.'
                ),
            limit: z.number().optional().describe(`Max entities per page (default and maximum ${ENTITY_LIMIT}).`),
            offset: z
                .number()
                .optional()
                .describe('Row offset; pass `nextOffset` from the previous response for the next page.'),
            metadataOnly: z
                .boolean()
                .optional()
                .describe(
                    'Return only `pagination` (empty `entities`), to count matches first. `total` is null if the ' +
                        'broker reports no count.'
                ),
            compact: z.boolean().optional().describe(REPR_PARAM_DESC)
        }),
        execute: withSession(async (args) => query(args, 'query_entities'))
    });
}
