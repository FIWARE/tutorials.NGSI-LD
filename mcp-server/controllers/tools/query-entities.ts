import type { FastMCP } from 'fastmcp';
import { z } from 'zod';
import { listEntities } from '../../lib/ngsi-ld';
import { ENTITY_LIMIT, UNKNOWN_ATTRIBUTES, ADDITIONAL_PROPERTY } from '../../lib/constants';
import type { LoadedSchema } from '../../lib/schema';
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
    CORE_ENTITY_ATTRS
} from './util';

const ADDITIONAL_PROPERTY_MODE = UNKNOWN_ATTRIBUTES === 'additionalProperty';

const shape = (e: unknown): unknown => {
    const s = stripContext(e);
    return ADDITIONAL_PROPERTY_MODE ? spreadAdditionalProperty(s, ADDITIONAL_PROPERTY) : s;
};

export interface EntityQueryArgs {
    entityType: string;
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

export const reprOption = (compact?: boolean): 'keyValues' | 'concise' => (compact ? 'keyValues' : 'concise');

export const REPR_PARAM_DESC =
    'Per-attribute response shape.\n' +
    'Default: a bare value, or `{value, unitCode?, observedAt?, ...}` when the attribute carries metadata (`unitCode` ' +
    'is a UN/CEFACT common code, `observedAt` an ISO-8601 timestamp); a link to another entity is `{object: "<URN>"}` ' +
    '(that URN is itself fetchable — follow it to traverse the graph), an enumerated value `{vocab: "<term>"}`, a ' +
    'location is GeoJSON. Nothing is dropped.\n' +
    'compact=true: always a bare value, links as bare "<URN>" strings, locations as GeoJSON. Smaller and uniform, ' +
    'but unit codes, timestamps and sub-attributes are lost. Use it only when you just need raw values.';

// Shared execute body for query_entities and its geo superset: additionalProperty q/pick
// bracketing, VocabProperty expandValues auto-fill, an optional geo predicate, then okPage.
export function makeEntityQuery(schemas: LoadedSchema[]) {
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
        const { entityType, filter, pick, limit, offset, metadataOnly, compact } = args;
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
                options: reprOption(compact)
            });
            return okPage(page.entities.map(shape), page, toolName, entityType, metadataOnly === true);
        } catch (err) {
            return fail(err);
        }
    };
}

export function registerQueryEntities(server: FastMCP, schemas: LoadedSchema[] = []): void {
    const query = makeEntityQuery(schemas);

    server.addTool({
        name: 'query_entities',
        annotations: { readOnlyHint: true, openWorldHint: false },
        description:
            'Current-state search for entities of one type. If unsure which attributes the type has, call ' +
            '`discover_context_meta_data` first — do not guess names in `filter` or `pick`. Provide a filter string ' +
            '(`;` = AND, `|` = OR; operators `==` `!=` `>` `<` `>=` `<=` `~=`, string values in double quotes). To ' +
            'filter an enumerated attribute (e.g. `sex=="Male"`), just write it in `filter` — vocabulary matching ' +
            'is automatic. Leave `pick` unset by default (see its own description). ' +
            'The response is paginated: check the `pagination` block and, when `hasMore` is true, either call again with the ' +
            'given `offset` or narrow the query — never assume the first page is the whole result set.',
        parameters: z.object({
            entityType: z.string().describe('Entity type, e.g. "Animal", "Building", "SoilSensor".'),
            filter: z
                .string()
                .optional()
                .describe(
                    'Filter string, e.g. `species=="dairy cattle"` or `weight>400`. Only narrow by an attribute ' +
                        'you actually need to filter on — to just see a value, `pick` it instead.'
                ),
            pick: z
                .string()
                .optional()
                .describe(
                    'Comma-separated attributes to return, e.g. "id,healthCondition,weight". Leave unset by default; ' +
                        'set it only once you already know exactly which attributes you want.'
                ),
            limit: z.number().optional().describe(`Max entities to return (default/max ${ENTITY_LIMIT}).`),
            offset: z
                .number()
                .optional()
                .describe(
                    'Row offset for pagination; pass the `nextOffset` from a previous response to fetch the next page.'
                ),
            metadataOnly: z
                .boolean()
                .optional()
                .describe(
                    'Return only the `pagination` block (total match count etc.) with an empty `entities` array — use to count matches without transferring any bodies.'
                ),
            compact: z.boolean().optional().describe(REPR_PARAM_DESC)
        }),
        execute: (args) => query(args, 'query_entities')
    });
}
