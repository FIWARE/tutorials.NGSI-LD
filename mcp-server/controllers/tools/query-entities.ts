import type { FastMCP } from 'fastmcp';
import { z } from 'zod';
import { listEntities } from '../../lib/ngsi-ld';
import { ENTITY_LIMIT } from '../../lib/constants';
import { ok, fail, stripContext, clampLimit } from './util';

export function registerQueryEntities(server: FastMCP): void {
    server.addTool({
        name: 'query_entities',
        description:
            '[Fallback] Generic current-state search for NGSI-LD entities of one type. Use a typed `query_<type>` tool ' +
            'instead whenever one exists for the entity type (it is schema-validated and better documented); reach for this ' +
            'only for types with no typed tool. Provide an NGSI-LD `q` string for filters (`;` = AND, `|` = OR; operators ' +
            '`==` `!=` `>` `<` `>=` `<=` `~=`, string values in double quotes). Always set `pick` to the attributes you need.',
        parameters: z.object({
            type: z.string().describe('Entity type, e.g. "Animal", "Building", "SoilSensor".'),
            q: z
                .string()
                .optional()
                .describe('NGSI-LD query string, e.g. `species=="dairy cattle";weight>400`.'),
            pick: z
                .string()
                .optional()
                .describe('Comma-separated attributes to return, e.g. "id,healthCondition,weight". Always set this.'),
            limit: z.number().optional().describe(`Max entities to return (default/max ${ENTITY_LIMIT}).`)
        }),
        execute: async ({ type, q, pick, limit }) => {
            try {
                const body = await listEntities({ type, q, pick, limit: clampLimit(limit), options: 'concise' });
                return ok(stripContext(body));
            } catch (err) {
                return fail(err);
            }
        }
    });
}
