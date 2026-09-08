import type { FastMCP } from 'fastmcp';
import { z } from 'zod';
import { listEntities } from '../../lib/ngsi-ld';
import { ENTITY_LIMIT, UNKNOWN_ATTRIBUTES, ADDITIONAL_PROPERTY } from '../../lib/constants';
import { fail, stripContext, clampLimit, okPage, spreadAdditionalProperty } from './util';

const shape = (e: unknown): unknown => {
    const s = stripContext(e);
    return UNKNOWN_ATTRIBUTES === 'additionalProperty' ? spreadAdditionalProperty(s, ADDITIONAL_PROPERTY) : s;
};

export function registerQueryEntities(server: FastMCP): void {
    server.addTool({
        name: 'query_entities',
        description:
            '[Fallback] Generic current-state search for NGSI-LD entities of one type. Use a typed `query_<type>` tool ' +
            'instead whenever one exists for the entity type (it is schema-validated and better documented); reach for this ' +
            'only for types with no typed tool. Provide an NGSI-LD `q` string for filters (`;` = AND, `|` = OR; operators ' +
            '`==` `!=` `>` `<` `>=` `<=` `~=`, string values in double quotes). Always set `pick` to the attributes you need. ' +
            'The response is paginated: check the `pagination` block and, when `hasMore` is true, either call again with the ' +
            'given `offset` or narrow the query — never assume the first page is the whole result set.',
        parameters: z.object({
            type: z.string().describe('Entity type, e.g. "Animal", "Building", "SoilSensor".'),
            q: z.string().optional().describe('NGSI-LD query string, e.g. `species=="dairy cattle";weight>400`.'),
            pick: z
                .string()
                .optional()
                .describe('Comma-separated attributes to return, e.g. "id,healthCondition,weight". Always set this.'),
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
        execute: async ({ type, q, pick, limit, offset, metadataOnly }) => {
            try {
                // No schema, so `q` is not rewritten the way typed query_<type> tools do:
                // a filter on an unmodelled attr must use `additionalProperty[<name>]` here.
                const page = await listEntities({
                    type,
                    q,
                    pick,
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
