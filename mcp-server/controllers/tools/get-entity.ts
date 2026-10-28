import type { FastMCP } from 'fastmcp';
import { withSession, type Session } from '../../lib/session';
import { z } from 'zod';
import { readEntity } from '../../lib/ngsi-ld';
import { UNKNOWN_ATTRIBUTES, ADDITIONAL_PROPERTY } from '../../lib/constants';
import {
    ok,
    fail,
    toolError,
    stripContext,
    spreadAdditionalProperty,
    pickWithAdditionalProperty,
    similarIds
} from './util';
import { reprFormat, needsSysAttrs, REPR_PARAM_DESC } from './query-entities';
import { getNeighbourhood } from './neighbourhood';

const ADDITIONAL_PROPERTY_MODE = UNKNOWN_ATTRIBUTES === 'additionalProperty';

export function registerGetEntity(server: FastMCP<Session>): void {
    server.addTool({
        name: 'get_entity',
        annotations: { title: 'Get entity', readOnlyHint: true, openWorldHint: false },
        description:
            'Retrieve one entity by URN. Also walks relationships: `pick` a relationship attribute, then call again ' +
            'with its target URN. For "why / how / explain" questions set `neighbourhood` first: it returns the ' +
            'entity, its relationship targets and the same-type entities sharing each relationship value, so the ' +
            'explaining link is visible. Otherwise `pick` only what you need; `metadataOnly` checks existence ' +
            'cheaply. A missing entity is a not_found error, or `{ exists: false }` with `metadataOnly`.',
        parameters: z.object({
            id: z.string().describe('Entity URN, e.g. "urn:ngsi-ld:<Type>:<id>".'),
            pick: z
                .string()
                .optional()
                .describe(
                    'Comma-separated attribute names to return, e.g. "location,status". Set it once you know which ' +
                        'attributes you need; unset returns every attribute. Ignored when `neighbourhood` is set.'
                ),
            metadataOnly: z
                .boolean()
                .optional()
                .describe(
                    'Existence check only: return `{ exists, id, type }` with no attributes. A missing entity yields `{ exists: false }`, not an error.'
                ),
            compact: z
                .boolean()
                .optional()
                .describe(REPR_PARAM_DESC + '\nIgnored when `neighbourhood` is set.'),
            neighbourhood: z
                .boolean()
                .optional()
                .describe(
                    'Return `{ entity, adjacency }`: for each relationship attribute, the target entities plus every ' +
                        'other same-type entity sharing that relationship value (siblings, e.g. same location or ' +
                        'owner). One hop, forward only: entities that point *at* this one are not included. ' +
                        'Entities come back in full, so `pick` and `compact` are ignored; the response can be ' +
                        'large, so lower `limit` to shrink it.'
                ),
            limit: z
                .number()
                .optional()
                .describe('With `neighbourhood`, max sibling entities per relationship (default 20, max 100).')
        }),
        execute: withSession(async ({ id, pick, metadataOnly, compact, neighbourhood, limit }) => {
            try {
                if (metadataOnly) {
                    const head = stripContext(await readEntity(id, { pick: 'id', format: 'concise' })) as Record<
                        string,
                        unknown
                    >;
                    return ok({ exists: true, id: head.id ?? id, type: head.type });
                }
                if (neighbourhood) {
                    return ok(await getNeighbourhood(id, limit));
                }
                // No schema to tell modelled from collected names, so pull the whole
                // container back whenever `pick` is set and let the spread do the rest.
                const projected = ADDITIONAL_PROPERTY_MODE
                    ? pickWithAdditionalProperty(pick, null, ADDITIONAL_PROPERTY)
                    : pick;
                const body = stripContext(
                    await readEntity(id, {
                        pick: projected,
                        format: reprFormat(compact),
                        sysAttrs: needsSysAttrs(projected) || undefined
                    })
                );
                return ok(ADDITIONAL_PROPERTY_MODE ? spreadAdditionalProperty(body, ADDITIONAL_PROPERTY) : body);
            } catch (err) {
                const e = err as Error;
                if (/\b404\b|not found/i.test(e.message)) {
                    const didYouMean = await similarIds(id);
                    const suggest = didYouMean.length ? { didYouMean } : {};
                    return metadataOnly
                        ? ok({ exists: false, id, ...suggest })
                        : toolError({ error: `No entity found with id ${id}`, status: 404, ...suggest });
                }
                return fail(err);
            }
        })
    });
}
