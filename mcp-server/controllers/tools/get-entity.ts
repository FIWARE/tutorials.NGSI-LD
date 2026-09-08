import type { FastMCP } from 'fastmcp';
import { z } from 'zod';
import { readEntity } from '../../lib/ngsi-ld';
import { UNKNOWN_ATTRIBUTES, ADDITIONAL_PROPERTY } from '../../lib/constants';
import { ok, fail, stripContext, spreadAdditionalProperty, pickWithAdditionalProperty } from './util';

const ADDITIONAL_PROPERTY_MODE = UNKNOWN_ATTRIBUTES === 'additionalProperty';

export function registerGetEntity(server: FastMCP): void {
    server.addTool({
        name: 'get_entity',
        description:
            '[Fallback] Retrieve a single NGSI-LD entity by its URN when the type has no typed ' +
            '`get_<type>` tool, or when walking a relationship chain (pick a relationship attribute, then call again with ' +
            'the returned URN). Prefer the typed `get_<type>` tool when one exists. Use `pick` to fetch only what you need.',
        parameters: z.object({
            id: z.string().describe('Entity URN, e.g. "urn:ngsi-ld:Animal:cow001".'),
            pick: z
                .string()
                .optional()
                .describe('Comma-separated attributes to return, e.g. "location,containedInPlace". Always set this.'),
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
                // No schema to tell modelled from collected names, so pull the whole
                // container back whenever `pick` is set and let the spread do the rest.
                const projected = ADDITIONAL_PROPERTY_MODE
                    ? pickWithAdditionalProperty(pick, null, ADDITIONAL_PROPERTY)
                    : pick;
                const body = stripContext(await readEntity(id, { pick: projected, options: 'concise' }));
                return ok(ADDITIONAL_PROPERTY_MODE ? spreadAdditionalProperty(body, ADDITIONAL_PROPERTY) : body);
            } catch (err) {
                const e = err as Error;
                if (/\b404\b|not found/i.test(e.message)) {
                    return metadataOnly
                        ? ok({ exists: false, id })
                        : JSON.stringify({ error: `No entity found with id ${id}` });
                }
                return fail(err);
            }
        }
    });
}
