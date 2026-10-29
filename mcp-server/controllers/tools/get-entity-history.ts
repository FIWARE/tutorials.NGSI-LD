import type { FastMCP } from 'fastmcp';
import { withSession, type Session } from '../../lib/session';
import { z } from 'zod';
import type { LoadedSchema } from '../../lib/schema';
import { readTemporalEntity, listTemporalEntities } from '../../lib/ngsi-ld';
import { TEMPORAL_BROKER_SEPARATE, ENTITY_LIMIT } from '../../lib/constants';
import { ok, fail, toolError, stripContext, similarIds, clampLimit, exampleUrn } from './util';

const AGGR_METHODS = ['totalCount', 'distinctCount', 'sum', 'avg', 'min', 'max', 'stddev', 'sumsq'] as const;

export function registerGetEntityHistory(server: FastMCP<Session>, schemas: LoadedSchema[] = []): void {
    server.addTool({
        name: 'get_entity_history',
        annotations: { title: 'Entity history', readOnlyHint: true, openWorldHint: false },
        description:
            'Time series, not current state (use `get_entity`). Give `ids` (URNs, found with `query_entities`) or ' +
            '`entityType`. Always returns a list, one entry per entity, each with `[value, timestamp]` pairs per ' +
            'attribute. `pick` the attributes you need and set `lastN` to keep it small; narrow the window with ' +
            '`when`/`timeAt`/`endTimeAt`. `aggregate` with `period` (e.g. "P1M") returns min/max/avg per period ' +
            'instead of raw points. A 404 means no history is retained for that URN.' +
            (TEMPORAL_BROKER_SEPARATE ? ' Served from a separate temporal endpoint.' : ''),
        parameters: z.object({
            ids: z
                .string()
                .optional()
                .describe(
                    `Entity URN(s), comma-separated, e.g. "${exampleUrn(schemas)}". This tool cannot filter on ` +
                        'attributes: select entities with `query_entities` first.'
                ),
            entityType: z
                .string()
                .optional()
                .describe('Every entity of this type (with `ids`: only those of this type).'),
            limit: z.number().optional().describe(`Max entities (default and maximum ${ENTITY_LIMIT}).`),
            offset: z.number().optional().describe('Entity offset for paging.'),
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
                .describe('Where the window sits relative to `timeAt`; requires it. Omit both for the full history.'),
            timeAt: z
                .string()
                .optional()
                .describe('ISO8601 anchor timestamp, e.g. "2026-08-01T00:00:00Z". Required when `when` is set.'),
            endTimeAt: z.string().optional().describe('ISO8601 end timestamp; required when `when` is "between".'),
            lastN: z
                .number()
                .optional()
                .describe('Return only the most recent N points per attribute. Use it to keep the response small.'),
            aggregate: z
                .array(z.enum(AGGR_METHODS))
                .optional()
                .describe(
                    `Aggregates instead of raw points, any of ${AGGR_METHODS.join(', ')} (numeric attributes). ` +
                        'Each is a list of `[value, periodStart, periodEnd]`.'
                ),
            period: z
                .string()
                .optional()
                .describe(
                    'ISO8601 length of each bucket, e.g. "P1M", "P1D", "PT1H". Omit for one bucket over the window.'
                )
        }),
        execute: withSession(
            async ({ ids, entityType, limit, offset, pick, when, timeAt, endTimeAt, lastN, aggregate, period }) => {
                const idList = (ids ?? '')
                    .split(',')
                    .map((i) => i.trim())
                    .filter(Boolean);
                if (!idList.length && !entityType) {
                    return toolError({ error: 'Set `ids` (entity URNs) or `entityType`.' });
                }
                if (when && !timeAt) {
                    return toolError({ error: 'timeAt is required when `when` is set.' });
                }
                if (timeAt && !when) {
                    return toolError({ error: '`when` is required when timeAt is set.' });
                }
                if (when === 'between' && !endTimeAt) {
                    return toolError({ error: 'endTimeAt is required when `when` is "between".' });
                }
                if (period && !aggregate?.length) {
                    return toolError({ error: '`period` needs `aggregate`.' });
                }
                const aggregated = !!aggregate?.length;
                const common = {
                    pick,
                    timerel: when,
                    timeAt,
                    endTimeAt,
                    lastN,
                    options: aggregated ? 'aggregatedValues' : 'temporalValues',
                    aggrMethods: aggregated ? aggregate!.join(',') : undefined,
                    aggrPeriodDuration: period
                };
                try {
                    // One URN has its own endpoint; anything else is a list query. The caller never chooses.
                    if (idList.length === 1 && !entityType) {
                        return ok(stripContext([await readTemporalEntity(idList[0], common)]));
                    }
                    // The broker requires timerel+timeAt on /temporal/entities; default to everything.
                    const span = when ? {} : { timerel: 'after', timeAt: '1970-01-01T00:00:00Z' };
                    const body = await listTemporalEntities({
                        ...common,
                        ...span,
                        type: entityType,
                        id: idList.length ? idList.join(',') : undefined,
                        limit: clampLimit(limit),
                        offset: offset || undefined
                    });
                    return ok(stripContext(body));
                } catch (err) {
                    const e = err as Error;
                    if (idList.length === 1 && !entityType && /\b404\b|not found/i.test(e.message)) {
                        const didYouMean = await similarIds(idList[0]);
                        return toolError({
                            error: `No entity found with id ${idList[0]}`,
                            status: 404,
                            ...(didYouMean.length ? { didYouMean } : {})
                        });
                    }
                    return fail(err);
                }
            }
        )
    });
}
