import type { FastMCP } from 'fastmcp';
import { z } from 'zod';
import { listEntities } from '../../lib/ngsi-ld';
import { ENTITY_LIMIT, UNKNOWN_ATTRIBUTES, ADDITIONAL_PROPERTY } from '../../lib/constants';
import type { LoadedSchema } from '../../lib/schema';
import { fail, stripContext, clampLimit, okPage, spreadAdditionalProperty, queryClauseHeads } from './util';

const shape = (e: unknown): unknown => {
    const s = stripContext(e);
    return UNKNOWN_ATTRIBUTES === 'additionalProperty' ? spreadAdditionalProperty(s, ADDITIONAL_PROPERTY) : s;
};

export function registerQueryEntities(server: FastMCP, schemas: LoadedSchema[] = []): void {
    // type (lower-case) -> its VocabProperty attribute names. Present (possibly
    // empty) for every loaded schema; absent means no schema for that type.
    const vocabByType = new Map<string, string[]>();
    for (const s of schemas) {
        vocabByType.set(
            s.typeName.toLowerCase(),
            Object.entries(s.writeAttrs)
                .filter(([, w]) => w.ngsiType === 'VocabProperty')
                .map(([name]) => name)
        );
    }

    server.addTool({
        name: 'query_entities',
        description:
            '[Fallback] Generic current-state search for NGSI-LD entities of one type. Use a typed `query_<type>` tool ' +
            'instead whenever one exists for the entity type (it is schema-validated and better documented); reach for this ' +
            'only for types with no typed tool. Provide an NGSI-LD `q` string for filters (`;` = AND, `|` = OR; operators ' +
            '`==` `!=` `>` `<` `>=` `<=` `~=`, string values in double quotes). To filter a VocabProperty (e.g. `sex=="Male"`) ' +
            'also set `expandValues` to those attribute names. Always set `pick` to the attributes you need. ' +
            'The response is paginated: check the `pagination` block and, when `hasMore` is true, either call again with the ' +
            'given `offset` or narrow the query — never assume the first page is the whole result set.',
        parameters: z.object({
            type: z.string().describe('Entity type, e.g. "Animal", "Building", "SoilSensor".'),
            q: z.string().optional().describe('NGSI-LD query string, e.g. `species=="dairy cattle";weight>400`.'),
            pick: z
                .string()
                .optional()
                .describe('Comma-separated attributes to return, e.g. "id,healthCondition,weight". Always set this.'),
            expandValues: z
                .string()
                .optional()
                .describe(
                    'Comma-separated attribute names that are VocabProperties in `q` - the broker expands their `==`/`!=` ' +
                        'values against the @context before matching, which a VocabProperty filter needs. Auto-filled when a ' +
                        'schema for `type` is loaded.'
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
                )
        }),
        execute: async ({ type, q, pick, expandValues, limit, offset, metadataOnly }) => {
            try {
                // No schema here, so `q` is not rewritten the way typed query_<type> tools do:
                // a filter on an unmodelled attr must use `additionalProperty[<name>]` here.
                const ev = new Set<string>();
                for (const name of String(expandValues ?? '').split(',')) {
                    const t = name.trim();
                    if (t) {
                        ev.add(t);
                    }
                }
                const heads = queryClauseHeads(q);
                const vocab = vocabByType.get(type.toLowerCase());
                for (const attr of vocab ?? []) {
                    if (heads.includes(attr)) {
                        ev.add(attr);
                    }
                }
                // `expandValues` on a plain Property makes the broker do a vocab-style
                // match and silently return nothing, so keep only the known VocabProperties.
                if (vocab) {
                    const allow = new Set(vocab);
                    for (const attr of [...ev]) {
                        if (!allow.has(attr)) {
                            ev.delete(attr);
                        }
                    }
                }
                const page = await listEntities({
                    type,
                    q,
                    pick,
                    expandValues: ev.size ? [...ev].join(',') : undefined,
                    limit: clampLimit(limit),
                    offset,
                    metadataOnly,
                    options: 'concise'
                });
                return okPage(page.entities.map(shape), page, 'query_entities', type, metadataOnly === true);
            } catch (err) {
                return fail(err);
            }
        }
    });
}
