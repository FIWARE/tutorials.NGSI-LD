// Destructive tools, kept apart from ./write.ts so the irreversible operations are
// easy to find and review. Gated by the WRITABLE master interlock. With
// WRITABLE=true and no DELETABLE_TYPES list, registerGenericDelete adds
// delete_entity / delete_entity_attribute covering any type; with a list,
// registerDelete adds typed delete_<type> / delete_<type>_attribute per listed
// type and no generic tool.

import type { FastMCP } from 'fastmcp';
import { z } from 'zod';
import { deleteEntity, deleteAttribute } from '../../lib/ngsi-ld';
import { WRITABLE, isDeletableType } from '../../lib/constants';
import type { LoadedSchema } from '../../lib/schema';
import { ok, fail, is404, notFound, RESERVED_ATTRS } from './util';

const guardAttr = (attr: string): string | null =>
    RESERVED_ATTRS.has(attr) ? JSON.stringify({ error: `"${attr}" cannot be removed` }) : null;

// ---- typed: one pair per type named in DELETABLE_TYPES --------------------

export function registerDelete(server: FastMCP, schema: LoadedSchema, exposed: Set<string>): number {
    if (!WRITABLE || !isDeletableType(schema.typeName)) {
        return 0;
    }

    const stem = schema.typeName.toLowerCase();
    const t = schema.typeName;

    exposed.add(`delete_${stem}_attribute`);
    server.addTool({
        name: `delete_${stem}_attribute`,
        description: `[DELETE] Remove one attribute from an existing ${t}. Does not delete the entity itself.`,
        parameters: z.object({
            id: z.string().describe(`URN of the ${t}.`),
            attr: z.string().describe('Attribute name to remove.')
        }),
        execute: async ({ id, attr }) => {
            try {
                const bad = guardAttr(attr);
                if (bad) return bad;
                await deleteAttribute(id, attr);
                return ok({ deleted: attr, from: id });
            } catch (err) {
                return is404(err) ? notFound(t, id, attr) : fail(err);
            }
        }
    });

    exposed.add(`delete_${stem}`);
    server.addTool({
        name: `delete_${stem}`,
        description:
            `[DELETE] Delete an entire ${t} entity and every attribute on it. Irreversible — there is no undo and no ` +
            `soft-delete. To remove a single attribute use \`delete_${stem}_attribute\` instead.`,
        parameters: z.object({
            id: z.string().describe(`URN of the ${t} to delete, e.g. "urn:ngsi-ld:${t}:001".`)
        }),
        execute: async ({ id }) => {
            try {
                await deleteEntity(id);
                return ok({ deleted: id, type: t });
            } catch (err) {
                return is404(err) ? notFound(t, id) : fail(err);
            }
        }
    });

    return 2;
}

// ---- generic: covers any type (WRITABLE=true, no DELETABLE_TYPES) ----------

export function registerGenericDelete(server: FastMCP, exposed: Set<string>): number {
    if (!WRITABLE) {
        return 0;
    }

    exposed.add('delete_entity_attribute');
    server.addTool({
        name: 'delete_entity_attribute',
        description:
            '[DELETE] Remove one attribute from any existing entity. Does not delete the entity itself. Prefer a typed ' +
            '`delete_<type>_attribute` tool when one exists.',
        parameters: z.object({
            id: z.string().describe('URN of the entity.'),
            attr: z.string().describe('Attribute name to remove.')
        }),
        execute: async ({ id, attr }) => {
            try {
                const bad = guardAttr(attr);
                if (bad) return bad;
                await deleteAttribute(id, attr);
                return ok({ deleted: attr, from: id });
            } catch (err) {
                return is404(err) ? notFound('entity', id, attr) : fail(err);
            }
        }
    });

    exposed.add('delete_entity');
    server.addTool({
        name: 'delete_entity',
        description:
            '[DELETE] Delete an entire entity of any type and every attribute on it. Irreversible — no undo, no ' +
            'soft-delete. To remove a single attribute use `delete_entity_attribute`. Prefer a typed `delete_<type>` ' +
            'tool when one exists.',
        parameters: z.object({
            id: z.string().describe('URN of the entity to delete.')
        }),
        execute: async ({ id }) => {
            try {
                await deleteEntity(id);
                return ok({ deleted: id });
            } catch (err) {
                return is404(err) ? notFound('entity', id) : fail(err);
            }
        }
    });

    return 2;
}
