// Per-schema tool factory: query_<type> (QUERIABLE_TYPES), get_<type> and
// get_<type>_history (READABLE_TYPES). One call per schemas/*.json. See ARCHITECTURE.md §5.

import type { FastMCP } from 'fastmcp';
import { z } from 'zod';
import { listEntities, readEntity, readTemporalEntity } from '../../lib/ngsi-ld';
import {
    ENTITY_LIMIT,
    TEMPORAL_BROKER,
    isQueriableType,
    isReadableType,
    UNKNOWN_ATTRIBUTES,
    ADDITIONAL_PROPERTY
} from '../../lib/constants';
import type { LoadedSchema } from '../../lib/schema';
import {
    ok,
    fail,
    stripContext,
    clampLimit,
    validateList,
    validateOne,
    okPage,
    spreadAdditionalProperty,
    rewriteAdditionalPropertyQuery,
    pickWithAdditionalProperty
} from './util';

const ADDITIONAL_PROPERTY_MODE = UNKNOWN_ATTRIBUTES === 'additionalProperty';

// In additionalProperty mode, lift the collected JsonProperty members back to the
// top level of every returned entity so they read as ordinary fields.
const unbundle = <T>(e: T): T =>
    ADDITIONAL_PROPERTY_MODE ? spreadAdditionalProperty(e, ADDITIONAL_PROPERTY) : e;

// Sub-attributes filter with bracket syntax, e.g. q=address[addressLocality]=="x".
// In additionalProperty mode an unmodelled attr filters by its plain name (server-mapped).
const Q_HELP = ' Filter a sub-attribute with bracket syntax, e.g. `address[addressLocality]=="Tiergarten"`.';

// Returns the count of typed tools registered for this schema. `exposed` collects
// their names for controllers/prompts/dynamic.ts to resolve a prompt's {{tools}}.
export function registerDynamic(server: FastMCP, schema: LoadedSchema, exposed: Set<string>): number {
    const stem = schema.typeName.toLowerCase();
    let count = 0;

    // Attribute names this schema models. In additionalProperty mode a raw `q`
    // clause or a `pick` entry on anything else is remapped onto the container.
    const modelledAttrs: ReadonlySet<string> = new Set(Object.keys(schema.writeAttrs));
    const projectPick = (pick: unknown): string | undefined =>
        ADDITIONAL_PROPERTY_MODE
            ? pickWithAdditionalProperty(pick as string | undefined, modelledAttrs, ADDITIONAL_PROPERTY)
            : (pick as string | undefined);

    // query_<type>: current state. Driven by QUERIABLE_TYPES.
    if (isQueriableType(schema.typeName)) {
        count++;
        exposed.add(`query_${stem}`);
        server.addTool({
            name: `query_${stem}`,
            description:
                `[Preferred tool for ${schema.typeName}] Typed, schema-validated current-state query — use this rather than ` +
                `\`query_entities\` whenever the target is a ${schema.typeName}.\n\n${schema.toolDescription}\n\n` +
                'The response is paginated: check the `pagination` block and, when `hasMore` is true, either call again with ' +
                'the given `offset` or narrow the query — never assume the first page is the whole result set.',
            parameters: z.object({
                ...schema.inputShape,
                q: z.string().optional().describe(`Extra raw NGSI-LD q filter, ANDed with the fields above.${Q_HELP}`),
                pick: z.string().optional().describe('Comma-separated attributes to return. Always set this.'),
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
            execute: async (args: Record<string, unknown>) => {
                try {
                    const { q, pick, limit, offset, metadataOnly, ...filters } = args;
                    const rawQ = ADDITIONAL_PROPERTY_MODE
                        ? rewriteAdditionalPropertyQuery(q as string | undefined, modelledAttrs, ADDITIONAL_PROPERTY)
                        : (q as string | undefined);
                    const page = await listEntities({
                        type: schema.typeName,
                        filters,
                        q: rawQ,
                        pick: projectPick(pick),
                        limit: clampLimit(limit as number | undefined),
                        offset: offset as number | undefined,
                        metadataOnly,
                        options: 'concise'
                    });
                    const entities = page.entities.map((e) => stripContext(e));
                    const validator = pick ? schema.entityValidatorLoose : schema.entityValidator;
                    const outcome = validateList(entities, validator);
                    if ('error' in outcome) {
                        return ok(outcome);
                    }
                    return okPage(
                        outcome.data.map(unbundle),
                        page,
                        `query_${stem}`,
                        schema.typeName,
                        metadataOnly === true
                    );
                } catch (err) {
                    return fail(err);
                }
            }
        });
    }

    // get_<type>: single entity. Driven by READABLE_TYPES.
    if (isReadableType(schema.typeName)) {
        count++;
        exposed.add(`get_${stem}`);
        server.addTool({
            name: `get_${stem}`,
            description:
                `[Preferred over get_entity for ${schema.typeName}] Retrieve a single ${schema.typeName} entity by URN. ` +
                (schema.lowTrust ? 'Inferred profile — only id/type are guaranteed. ' : '') +
                `Narrow with \`pick\`. Full schema: \`${schema.ontologyUri}\`.`,
            parameters: z.object({
                id: z.string().describe(`URN of the ${schema.typeName}, e.g. "urn:ngsi-ld:${schema.typeName}:001".`),
                pick: z.string().optional().describe('Comma-separated attributes to return. Always set this.'),
                metadataOnly: z
                    .boolean()
                    .optional()
                    .describe(
                        'Existence check only — return `{ exists, id, type }` with no attributes. A missing entity yields `{ exists: false }`, not an error.'
                    )
            }),
            execute: async ({ id, pick, metadataOnly }) => {
                try {
                    if (metadataOnly) {
                        const head = stripContext(await readEntity(id, { pick: 'id', options: 'concise' })) as Record<
                            string,
                            unknown
                        >;
                        return ok({ exists: true, id: head.id ?? id, type: head.type });
                    }
                    const body = await readEntity(id, { pick: projectPick(pick), options: 'concise' });
                    const validator = pick ? schema.entityValidatorLoose : schema.entityValidator;
                    const res = validateOne(stripContext(body), validator);
                    return ok('data' in res ? { ...res, data: unbundle(res.data) } : res);
                } catch (err) {
                    const e = err as Error;
                    if (/\b404\b|not found/i.test(e.message)) {
                        return metadataOnly
                            ? ok({ exists: false, id })
                            : JSON.stringify({ error: `No ${schema.typeName} found with id ${id}` });
                    }
                    return fail(err);
                }
            }
        });
    }

    // get_<type>_history: temporal trend. Driven by READABLE_TYPES and TEMPORAL_BROKER.
    if (isReadableType(schema.typeName) && TEMPORAL_BROKER) {
        count++;
        exposed.add(`get_${stem}_history`);
        server.addTool({
            name: `get_${stem}_history`,
            description:
                `[Time-series only] Use for ${schema.typeName} trend/history questions ("has it changed", "over the last month") — ` +
                `not for current state. Returns [value, timestamp] tuples. Full schema: \`${schema.ontologyUri}\`.`,
            parameters: z.object({
                id: z.string().describe(`URN of the ${schema.typeName}.`),
                pick: z
                    .string()
                    .optional()
                    .describe('Comma-separated attributes to track, e.g. "weight". Always set this.'),
                timerel: z
                    .enum(['before', 'after', 'between'])
                    .optional()
                    .describe('Temporal relationship; requires timeAt. Omit both for the full available history.'),
                timeAt: z
                    .string()
                    .optional()
                    .describe('ISO8601 anchor timestamp, e.g. "2026-08-01T00:00:00Z". Required when timerel is set.'),
                endTimeAt: z.string().optional().describe('ISO8601 end timestamp; required when timerel is "between".'),
                lastN: z.number().optional().describe('Return only the most recent N instances per attribute.')
            }),
            execute: async ({ id, pick, timerel, timeAt, endTimeAt, lastN }) => {
                try {
                    if (timerel && !timeAt) {
                        return JSON.stringify({ error: 'timeAt is required when timerel is set.' });
                    }
                    if (timeAt && !timerel) {
                        return JSON.stringify({ error: 'timerel is required when timeAt is set.' });
                    }
                    if (timerel === 'between' && !endTimeAt) {
                        return JSON.stringify({ error: 'endTimeAt is required when timerel is "between".' });
                    }
                    const body = await readTemporalEntity(id, {
                        pick,
                        timerel,
                        timeAt,
                        endTimeAt,
                        lastN,
                        options: 'temporalValues'
                    });
                    return ok(validateOne(stripContext(body), schema.temporalValidator));
                } catch (err) {
                    return fail(err);
                }
            }
        });
    }

    return count;
}
