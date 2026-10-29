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
    editDistance,
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

// Nothing of use came back, so near-miss hints are worth computing. A normal query is empty when
// its first page has no rows. A count-only query returns no rows by design, so only the total can say.
export function isEmptyResult(
    page: { total: number | null; returned: number; offset: number },
    countOnly: boolean
): boolean {
    return countOnly ? page.total === 0 : page.returned === 0 && page.offset === 0;
}

// "Años" and "anos" both fold to "anos": comparison ignoring case and accents.
const fold = (s: string): string => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

// Accented forms of the letters that have them, so one regex class covers "anos" and "años".
const ACCENTED: Record<string, string> = {
    a: 'áàâäãåā',
    c: 'çćč',
    e: 'éèêëēė',
    i: 'íìîïī',
    n: 'ñń',
    o: 'óòôöõøō',
    s: 'šś',
    u: 'úùûüū',
    y: 'ýÿ',
    z: 'žźż'
};

// Broker regex for the first two characters of `value` in any case or accent, e.g. "pe" -> "[Pp][EeÉé...].*".
// Deliberately unanchored: it only narrows what the broker returns; ranking does the rest.
export function leadingPattern(value: string): string {
    const classes = [...value].slice(0, 2).map((ch) => {
        const base = fold(ch);
        if (/^[a-z]$/.test(base)) {
            const set = base + (ACCENTED[base] ?? '');
            return `[${set}${set.toUpperCase()}]`;
        }
        return /^[0-9]$/.test(base) ? base : '.';
    });
    return `${classes.join('')}.*`;
}

// Stored values nearest to `wanted`, best first: same text ignoring case/accents, then one containing the
// other, then by edit distance, so "Petal" beats "Grape" for "petal". `exact` counts the first kind.
export function closestValues(wanted: string, stored: unknown[], max = 3): { values: string[]; exact: number } {
    const strings = [...new Set(stored.filter((v): v is string => typeof v === 'string'))];
    if (strings.includes(wanted)) return { values: [], exact: 0 };
    const w = fold(wanted);
    const ranked = strings
        .map((v) => {
            const f = fold(v);
            const tier = f === w ? 0 : f.includes(w) || w.includes(f) ? 1 : 2;
            return { v, tier, dist: editDistance(w, f) };
        })
        .sort((x, y) => x.tier - y.tier || x.dist - y.dist || x.v.localeCompare(y.v));
    return { values: ranked.slice(0, max).map((r) => r.v), exact: ranked.filter((r) => r.tier === 0).length };
}

// For a query that matched nothing: quoted `attr=="value"` clauses where the broker holds a stored value
// differing only by case or accents ("twilight" for "Twilight", "anos" for "años"), else the closest values
// it does hold. Enumerated attributes are skipped (their case is already corrected). `valuesOf` asks the
// broker for stored values of `attr` that start like `wanted`.
export async function valueMismatchHints(
    filter: string | undefined,
    skip: ReadonlySet<string>,
    valuesOf: (attr: string, wanted: string) => Promise<unknown[]>
): Promise<string[]> {
    const hints: string[] = [];
    const seen = new Set<string>();
    for (const m of (filter ?? '').matchAll(/([A-Za-z_][A-Za-z0-9_]*)==\"([^\"]*)\"/g)) {
        const [, attr, wanted] = m;
        if (skip.has(attr) || !wanted || seen.has(m[0])) continue;
        seen.add(m[0]);
        try {
            const { values, exact } = closestValues(wanted, await valuesOf(attr, wanted));
            const quoted = (vs: string[]) => vs.map((v) => `"${v}"`).join(', ');
            if (exact) {
                hints.push(
                    `No ${attr} equals "${wanted}", but ${quoted(values.slice(0, exact))} differs only by case or ` +
                        `accents. Try ${attr}=="${values[0]}".`
                );
            } else if (values.length) {
                hints.push(`No ${attr} equals "${wanted}". Closest stored values: ${quoted(values)}.`);
            }
        } catch {
            /* advisory only */
        }
    }
    return hints;
}

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
            const empty = isEmptyResult(page, metadataOnly === true);
            const hints = empty ? emptyResultHints(entityType, filter, registry?.get().schemas ?? schemas) : [];
            if (empty) {
                const valuesOf = async (attr: string, wanted: string): Promise<unknown[]> => {
                    const probeQ = `${attr}~="${leadingPattern(wanted)}"`;
                    const probe = await listEntities({
                        type: entityType,
                        q: ADDITIONAL_PROPERTY_MODE
                            ? rewriteAdditionalPropertyQuery(probeQ, CORE_ENTITY_ATTRS, ADDITIONAL_PROPERTY)
                            : probeQ,
                        pick: ADDITIONAL_PROPERTY_MODE
                            ? pickWithAdditionalProperty(attr, null, ADDITIONAL_PROPERTY)
                            : attr,
                        format: 'simplified',
                        limit: ENTITY_LIMIT
                    });
                    return probe.entities.map((e) => (shape(e) as Record<string, unknown>)[attr]);
                };
                const enumAttrs = new Set(vocabMaps.flatMap((m) => Object.keys(m)));
                hints.push(...(await valueMismatchHints(filter, enumAttrs, valuesOf)));
            }
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
                    'E.g. `status=="active"` or `count>400`. Matching is case- and accent-sensitive; when nothing matches, ' +
                        'a hint suggests stored values that differ only by case or accents. To just see a value, ' +
                        '`pick` it instead of filtering.'
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
