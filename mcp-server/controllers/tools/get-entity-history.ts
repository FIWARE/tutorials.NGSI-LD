import type { FastMCP } from 'fastmcp';
import { z } from 'zod';
import { readTemporalEntity } from '../../lib/ngsi-ld';
import { TEMPORAL_BROKER_SEPARATE } from '../../lib/constants';
import { ok, fail, toolError, stripContext } from './util';

export function registerGetEntityHistory(server: FastMCP): void {
    server.addTool({
        name: 'get_entity_history',
        annotations: { readOnlyHint: true, openWorldHint: false },
        description:
            'Trend/history for a single entity by URN ("has it changed", "over the last month") — not for ' +
            'current state, use get_entity for that. Returns [value, timestamp] tuples; `pick` narrows which ' +
            'attributes (see its own description). 404 if no history is retained for the entity.' +
            (TEMPORAL_BROKER_SEPARATE ? ' Served from a separate temporal endpoint.' : ''),
        parameters: z.object({
            id: z.string().describe('Entity URN, e.g. "urn:ngsi-ld:Animal:cow001".'),
            pick: z
                .string()
                .optional()
                .describe(
                    'Comma-separated attributes to track, e.g. "weight,heartRate". Set it to focus the series; omit it to track every attribute.'
                ),
            when: z
                .enum(['before', 'after', 'between'])
                .optional()
                .describe(
                    'Where the returned window sits relative to timeAt; requires timeAt. Omit both for the full available history.'
                ),
            timeAt: z
                .string()
                .optional()
                .describe('ISO8601 anchor timestamp, e.g. "2026-08-01T00:00:00Z". Required when `when` is set.'),
            endTimeAt: z.string().optional().describe('ISO8601 end timestamp; required when `when` is "between".'),
            lastN: z.number().optional().describe('Return only the most recent N instances per attribute.')
        }),
        execute: async ({ id, pick, when, timeAt, endTimeAt, lastN }) => {
            if (when && !timeAt) {
                return toolError({ error: 'timeAt is required when `when` is set.' });
            }
            if (timeAt && !when) {
                return toolError({ error: '`when` is required when timeAt is set.' });
            }
            if (when === 'between' && !endTimeAt) {
                return toolError({ error: 'endTimeAt is required when `when` is "between".' });
            }
            try {
                const body = await readTemporalEntity(id, {
                    pick,
                    timerel: when,
                    timeAt,
                    endTimeAt,
                    lastN,
                    options: 'temporalValues'
                });
                return ok(stripContext(body));
            } catch (err) {
                const e = err as Error;
                if (/\b404\b|not found/i.test(e.message)) {
                    return toolError({ error: `No entity found with id ${id}`, status: 404 });
                }
                return fail(err);
            }
        }
    });
}
