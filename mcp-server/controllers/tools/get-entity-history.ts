import type { FastMCP } from 'fastmcp';
import { withSession, type Session } from '../../lib/session';
import { z } from 'zod';
import { readTemporalEntity } from '../../lib/ngsi-ld';
import { TEMPORAL_BROKER_SEPARATE } from '../../lib/constants';
import { ok, fail, toolError, stripContext, similarIds } from './util';

export function registerGetEntityHistory(server: FastMCP<Session>): void {
    server.addTool({
        name: 'get_entity_history',
        annotations: { title: 'Entity history', readOnlyHint: true, openWorldHint: false },
        description:
            'Time series for one entity by URN ("has it changed", "over the last month"); not for current state, ' +
            'use `get_entity`. Returns `[value, timestamp]` pairs per attribute. `pick` the attributes you need and ' +
            'set `lastN` to keep it small; narrow the window with `when`/`timeAt`/`endTimeAt`. A 404 means no ' +
            'history is retained for that URN.' +
            (TEMPORAL_BROKER_SEPARATE ? ' Served from a separate temporal endpoint.' : ''),
        parameters: z.object({
            id: z.string().describe('Entity URN, e.g. "urn:ngsi-ld:<Type>:<id>".'),
            pick: z
                .string()
                .optional()
                .describe(
                    'Comma-separated attribute names to track, e.g. "temperature,status". Set it to focus the ' +
                        'series; omit it to track every attribute.'
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
            lastN: z
                .number()
                .optional()
                .describe('Return only the most recent N points per attribute. Use it to keep the response small.')
        }),
        execute: withSession(async ({ id, pick, when, timeAt, endTimeAt, lastN }) => {
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
                    const didYouMean = await similarIds(id);
                    return toolError({
                        error: `No entity found with id ${id}`,
                        status: 404,
                        ...(didYouMean.length ? { didYouMean } : {})
                    });
                }
                return fail(err);
            }
        })
    });
}
