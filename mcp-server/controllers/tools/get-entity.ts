import type { FastMCP } from 'fastmcp';
import { z } from 'zod';
import { readEntity } from '../../lib/ngsi-ld';
import { UNKNOWN_ATTRIBUTES, ADDITIONAL_PROPERTY, isReadableType } from '../../lib/constants';
import type { LoadedSchema } from '../../lib/schema';
import {
    ok,
    fail,
    toolError,
    stripContext,
    spreadAdditionalProperty,
    pickWithAdditionalProperty,
    fallbackLead
} from './util';
import { reprOption, REPR_PARAM_DESC } from './query-entities';

const ADDITIONAL_PROPERTY_MODE = UNKNOWN_ATTRIBUTES === 'additionalProperty';

export function registerGetEntity(server: FastMCP, schemas: LoadedSchema[] = []): void {
    const typed = schemas.filter((s) => isReadableType(s.typeName)).map((s) => s.typeName);
    server.addTool({
        name: 'get_entity',
        description:
            fallbackLead('get_<type>', typed) +
            'Retrieve a single entity by its URN. Also used to walk a relationship chain: `pick` a relationship ' +
            'attribute, then call again with its target URN. Use `pick` to fetch only what you need.',
        parameters: z.object({
            id: z.string().describe('Entity URN, e.g. "urn:ngsi-ld:Animal:cow001".'),
            pick: z
                .string()
                .optional()
                .describe(
                    'Comma-separated attributes to return, e.g. "location,containedInPlace". Set it to keep responses small; omit it for the whole entity when exploring or unsure which attributes exist.'
                ),
            metadataOnly: z
                .boolean()
                .optional()
                .describe(
                    'Existence check only — return `{ exists, id, type }` with no attributes. A missing entity yields `{ exists: false }`, not an error.'
                ),
            compact: z.boolean().optional().describe(REPR_PARAM_DESC)
        }),
        execute: async ({ id, pick, metadataOnly, compact }) => {
            try {
                if (metadataOnly) {
                    const head = stripContext(await readEntity(id, { pick: 'id', options: 'concise' })) as Record<
                        string,
                        unknown
                    >;
                    return ok({ exists: true, id: head.id ?? id, type: head.type });
                }
                // No schema to tell modelled from collected names, so pull the whole
                // container back whenever `pick` is set and let the spread do the rest.
                const projected = ADDITIONAL_PROPERTY_MODE
                    ? pickWithAdditionalProperty(pick, null, ADDITIONAL_PROPERTY)
                    : pick;
                const body = stripContext(await readEntity(id, { pick: projected, options: reprOption(compact) }));
                return ok(ADDITIONAL_PROPERTY_MODE ? spreadAdditionalProperty(body, ADDITIONAL_PROPERTY) : body);
            } catch (err) {
                const e = err as Error;
                if (/\b404\b|not found/i.test(e.message)) {
                    return metadataOnly
                        ? ok({ exists: false, id })
                        : toolError({ error: `No entity found with id ${id}`, status: 404 });
                }
                return fail(err);
            }
        }
    });
}
