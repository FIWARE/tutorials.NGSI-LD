// Generic destructive tools (delete_entity, delete_attribute), driven by WRITABLE.
// Write tools are in ./write.ts.

import type { ContentResult, FastMCP } from 'fastmcp';
import { withSession, type Session } from '../../lib/session';
import { z } from 'zod';
import { deleteEntity, deleteAttribute } from '../../lib/ngsi-ld';
import { WRITABLE } from '../../lib/constants';
import { ok, fail, toolError, is404, notFound, RESERVED_ATTRS, canWrite, typeDenied } from './util';

const guardAttr = (attr: string): ContentResult | null =>
    RESERVED_ATTRS.has(attr) ? toolError({ error: `"${attr}" cannot be removed` }) : null;

export function registerGenericDelete(server: FastMCP<Session>, exposed: Set<string>): number {
    if (!WRITABLE) {
        return 0;
    }

    exposed.add('delete_attribute');
    server.addTool({
        name: 'delete_attribute',
        canAccess: canWrite,
        annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
        description: 'Remove one attribute from any existing entity. Does not delete the entity itself.',
        parameters: z.object({
            id: z.string().describe('URN of the entity.'),
            attr: z.string().describe('Attribute name to remove.')
        }),
        execute: withSession(async ({ id, attr }) => {
            try {
                const bad = guardAttr(attr);
                if (bad) return bad;
                const denied = await typeDenied(id);
                if (denied) return denied;
                await deleteAttribute(id, attr);
                return ok({ deleted: attr, from: id });
            } catch (err) {
                return is404(err) ? notFound('entity', id, attr) : fail(err);
            }
        })
    });

    exposed.add('delete_entity');
    server.addTool({
        name: 'delete_entity',
        canAccess: canWrite,
        annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
        description:
            'Delete an entire entity of any type and every attribute on it. Irreversible — no undo, no ' +
            'soft-delete. To remove a single attribute use `delete_attribute`.',
        parameters: z.object({
            id: z.string().describe('URN of the entity to delete.')
        }),
        execute: withSession(async ({ id }) => {
            try {
                const denied = await typeDenied(id);
                if (denied) return denied;
                await deleteEntity(id);
                return ok({ deleted: id });
            } catch (err) {
                return is404(err) ? notFound('entity', id) : fail(err);
            }
        })
    });

    return 2;
}
