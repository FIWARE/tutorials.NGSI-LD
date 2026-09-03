import type { FastMCP } from 'fastmcp';
import { z } from 'zod';
import { readEntity } from '../../lib/ngsi-ld';
import { ok, fail, stripContext } from './util';

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
                .describe('Comma-separated attributes to return, e.g. "location,containedInPlace". Always set this.')
        }),
        execute: async ({ id, pick }) => {
            try {
                const body = await readEntity(id, { pick, options: 'concise' });
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
