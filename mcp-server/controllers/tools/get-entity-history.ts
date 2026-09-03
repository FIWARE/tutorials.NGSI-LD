import type { FastMCP } from 'fastmcp';
import { z } from 'zod';
import { readTemporalEntity } from '../../lib/ngsi-ld';
import { ok, fail, stripContext } from './util';

export function registerGetEntityHistory(server: FastMCP): void {
    server.addTool({
        name: 'get_entity_history',
        description:
            '[Time-series only] Trend/history for a single NGSI-LD entity by URN ("has it changed", "over the last month") — ' +
            'not for current state, use get_entity for that. Prefer the typed `get_<type>_history` tool when one exists. ' +
            'Returns [value, timestamp] tuples. Always set `pick` to the attributes you want tracked.',
        parameters: z.object({
            id: z.string().describe('Entity URN, e.g. "urn:ngsi-ld:Animal:cow001".'),
            pick: z.string().optional().describe('Comma-separated attributes to track, e.g. "weight,heartRate". Always set this.'),
            timerel: z.enum(['before', 'after', 'between']).optional().describe('Temporal relationship (default "after").'),
            timeAt: z.string().describe('ISO8601 anchor timestamp, e.g. "2026-08-01T00:00:00Z".'),
            endTimeAt: z.string().optional().describe('ISO8601 end timestamp; required when timerel is "between".')
        }),
        execute: async ({ id, pick, timerel, timeAt, endTimeAt }) => {
            const rel = timerel || 'after';
            if (rel === 'between' && !endTimeAt) {
                return JSON.stringify({ error: 'endTimeAt is required when timerel is "between".' });
            }
            try {
                const body = await readTemporalEntity(id, { pick, timerel: rel, timeAt, endTimeAt, options: 'temporalValues' });
                return ok(stripContext(body));
            } catch (err) {
                const e = err as Error;
                if (/\b404\b|not found/i.test(e.message)) {
                    return JSON.stringify({ error: `No entity found with id ${id}` });
                }
                return fail(err);
            }
        }
    });
}
