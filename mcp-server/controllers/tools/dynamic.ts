// Per-schema tool factory: query_<type>, get_<type>, get_<type>_history.
// One call per schemas/*.json. See ARCHITECTURE.md §5.

import type { FastMCP } from 'fastmcp';
import { z } from 'zod';
import { listEntities, readEntity, readTemporalEntity } from '../../lib/ngsi-ld';
import { ENTITY_LIMIT } from '../../lib/constants';
import type { LoadedSchema } from '../../lib/schema';
import { ok, fail, stripContext, clampLimit, validateList, validateOne } from './util';

export function registerDynamic(server: FastMCP, schema: LoadedSchema): void {
    const stem = schema.typeName.toLowerCase();

    // query_<type> — current state
    server.addTool({
        name: `query_${stem}`,
        description:
            `[Preferred tool for ${schema.typeName}] Typed, schema-validated current-state query — use this rather than ` +
            `\`query_entities\` whenever the target is a ${schema.typeName}.\n\n${schema.toolDescription}`,
        parameters: z.object({
            ...schema.inputShape,
            q: z.string().optional().describe('Extra raw NGSI-LD q filter, ANDed with the fields above.'),
            pick: z.string().optional().describe('Comma-separated attributes to return. Always set this.'),
            limit: z.number().optional().describe(`Max entities to return (default/max ${ENTITY_LIMIT}).`)
        }),
        execute: async (args: Record<string, unknown>) => {
            try {
                const { q, pick, limit, ...filters } = args;
                const body = await listEntities({
                    type: schema.typeName,
                    filters,
                    q,
                    pick,
                    limit: clampLimit(limit as number | undefined),
                    options: 'concise'
                });
                const entities = (Array.isArray(body) ? body : [body]).map((e) => stripContext(e));
                const validator = pick ? schema.entityValidatorLoose : schema.entityValidator;
                return ok(validateList(entities, validator));
            } catch (err) {
                return fail(err);
            }
        }
    });

    // get_<type> — single entity
    server.addTool({
        name: `get_${stem}`,
        description:
            `[Preferred over get_entity for ${schema.typeName}] Retrieve a single ${schema.typeName} entity by URN. ` +
            (schema.lowTrust ? 'Inferred profile — only id/type are guaranteed. ' : '') +
            `Narrow with \`pick\`. Full schema: \`${schema.ontologyUri}\`.`,
        parameters: z.object({
            id: z.string().describe(`URN of the ${schema.typeName}, e.g. "urn:ngsi-ld:${schema.typeName}:001".`),
            pick: z.string().optional().describe('Comma-separated attributes to return. Always set this.')
        }),
        execute: async ({ id, pick }) => {
            try {
                const body = await readEntity(id, { pick, options: 'concise' });
                const validator = pick ? schema.entityValidatorLoose : schema.entityValidator;
                return ok(validateOne(stripContext(body), validator));
            } catch (err) {
                const e = err as Error;
                if (/\b404\b|not found/i.test(e.message)) {
                    return JSON.stringify({ error: `No ${schema.typeName} found with id ${id}` });
                }
                return fail(err);
            }
        }
    });

    // get_<type>_history — temporal trend
    server.addTool({
        name: `get_${stem}_history`,
        description:
            `[Time-series only] Use for ${schema.typeName} trend/history questions ("has it changed", "over the last month") — ` +
            `not for current state. Returns [value, timestamp] tuples. Full schema: \`${schema.ontologyUri}\`.`,
        parameters: z.object({
            id: z.string().describe(`URN of the ${schema.typeName}.`),
            pick: z.string().optional().describe('Comma-separated attributes to track, e.g. "weight". Always set this.'),
            timerel: z
                .enum(['before', 'after', 'between'])
                .optional()
                .describe('Temporal relationship (default "after").'),
            timeAt: z.string().describe('ISO8601 anchor timestamp, e.g. "2026-08-01T00:00:00Z".'),
            endTimeAt: z.string().optional().describe('ISO8601 end timestamp; required when timerel is "between".')
        }),
        execute: async ({ id, pick, timerel, timeAt, endTimeAt }) => {
            try {
                const rel = timerel || 'after';
                if (rel === 'between' && !endTimeAt) {
                    return JSON.stringify({ error: 'endTimeAt is required when timerel is "between".' });
                }
                const body = await readTemporalEntity(id, {
                    pick,
                    timerel: rel,
                    timeAt,
                    endTimeAt,
                    options: 'temporalValues'
                });
                return ok(validateOne(stripContext(body), schema.temporalValidator));
            } catch (err) {
                return fail(err);
            }
        }
    });
}
