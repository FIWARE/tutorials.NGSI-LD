import type { FastMCP } from 'fastmcp';
import { z } from 'zod';
import { listEntities } from '../../lib/ngsi-ld';
import { ENTITY_LIMIT, UNKNOWN_ATTRIBUTES, ADDITIONAL_PROPERTY, isQueriableType } from '../../lib/constants';
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
    fallbackLead,
    CORE_ENTITY_ATTRS
} from './util';

const ADDITIONAL_PROPERTY_MODE = UNKNOWN_ATTRIBUTES === 'additionalProperty';

const shape = (e: unknown): unknown => {
    const s = stripContext(e);
    return ADDITIONAL_PROPERTY_MODE ? spreadAdditionalProperty(s, ADDITIONAL_PROPERTY) : s;
};

export interface EntityQueryArgs {
    entityType: string;
    q?: string;
    pick?: string;
    expandValues?: string;
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

// Shared execute body for query_entities and its geo superset query_entities_geo:
// additionalProperty `q`/`pick` bracketing, VocabProperty `expandValues` (auto-filled
// from a loaded schema), an optional spatial predicate, then okPage pagination.
export function makeEntityQuery(schemas: LoadedSchema[]) {
    // type (lower-case) -> its VocabProperty attribute names, for every loaded schema.
    const vocabByType = new Map<string, string[]>();
    for (const s of schemas) {
        vocabByType.set(
            s.typeName.toLowerCase(),
            Object.entries(s.writeAttrs)
                .filter(([, w]) => w.ngsiType === 'VocabProperty')
                .map(([name]) => name)
        );
    }

    return async (args: EntityQueryArgs, toolName: string) => {
        const { entityType, q, pick, expandValues, limit, offset, metadataOnly, compact } = args;
        try {
            // No schema is assumed, so every unmodelled attr sits in the JsonProperty
            // container: bracket bare `q` heads (except id/type/core terms) and always
            // fetch the container for `pick`, so the caller never writes `additionalProperty[<name>]`.
            const effectiveQ = ADDITIONAL_PROPERTY_MODE
                ? rewriteAdditionalPropertyQuery(q, CORE_ENTITY_ATTRS, ADDITIONAL_PROPERTY)
                : q;
            const effectivePick = ADDITIONAL_PROPERTY_MODE
                ? pickWithAdditionalProperty(pick, null, ADDITIONAL_PROPERTY)
                : pick;

            const ev = new Set<string>();
            for (const name of String(expandValues ?? '').split(',')) {
                const t = name.trim();
                if (t) {
                    ev.add(t);
                }
            }
            // `type` may be a comma list; pool the VocabProperties of every named type.
            const types = entityType.split(',').map((t) => t.trim().toLowerCase());
            const vocab = types.flatMap((t) => vocabByType.get(t) ?? []);
            const heads = queryClauseHeads(q);
            for (const attr of vocab) {
                if (heads.includes(attr)) {
                    ev.add(attr);
                }
            }
            // `expandValues` on a plain Property makes the broker vocab-match and return
            // nothing; drop non-VocabProperty entries, but only when a schema covers the type.
            if (types.some((t) => vocabByType.has(t))) {
                const allow = new Set(vocab);
                for (const attr of [...ev]) {
                    if (!allow.has(attr)) {
                        ev.delete(attr);
                    }
                }
            }

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
    const typed = schemas.filter((s) => isQueriableType(s.typeName)).map((s) => s.typeName);

    server.addTool({
        name: 'query_entities',
        description:
            fallbackLead('query_<type>', typed) +
            'Current-state search for entities of one type. If unsure which attributes the type has, call ' +
            '`get_entity_type` first — do not guess names in `q` or `pick`. Provide a `q` filter string (`;` = AND, ' +
            '`|` = OR; operators `==` `!=` `>` `<` `>=` `<=` `~=`, string values in double quotes). To filter an ' +
            'enumerated attribute (e.g. `sex=="Male"`) also set `expandValues` to those attribute names. Use `pick` ' +
            'to keep responses small when you know which attributes you need; omit it for the full entity when exploring. ' +
            'The response is paginated: check the `pagination` block and, when `hasMore` is true, either call again with the ' +
            'given `offset` or narrow the query — never assume the first page is the whole result set.',
        parameters: z.object({
            entityType: z.string().describe('Entity type, e.g. "Animal", "Building", "SoilSensor".'),
            q: z.string().optional().describe('`q` filter string, e.g. `species=="dairy cattle";weight>400`.'),
            pick: z
                .string()
                .optional()
                .describe(
                    'Comma-separated attributes to return, e.g. "id,healthCondition,weight". Set it to keep responses small; omit it for the whole entity when exploring or unsure which attributes exist.'
                ),
            expandValues: z
                .string()
                .optional()
                .describe(
                    'Comma-separated names of enumerated attributes used in `q` - the broker expands their `==`/`!=` ' +
                        'values against the vocabulary before matching, which an enumerated-attribute filter needs. ' +
                        'Auto-filled when a schema for `entityType` is loaded.'
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
