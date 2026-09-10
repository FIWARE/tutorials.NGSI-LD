// Destructive tools, kept apart from ./write.ts. Driven by WRITABLE. No DELETABLE_TYPES
// list gives a generic delete pair; a list gives typed delete_<type> per listed type.

import type { ContentResult, FastMCP } from 'fastmcp';
import { z } from 'zod';
import { deleteEntity, deleteAttribute, mergeEntity } from '../../lib/ngsi-ld';
import { WRITABLE, isDeletableType, UNKNOWN_ATTRIBUTES, ADDITIONAL_PROPERTY } from '../../lib/constants';
import type { LoadedSchema } from '../../lib/schema';
import { ok, fail, toolError, is404, notFound, RESERVED_ATTRS, isKnownAttr } from './util';

// NGSI-LD merge-patch removes a member with the `urn:ngsi-ld:null` sentinel;
// a literal JSON null does not delete.
const NGSI_NULL = 'urn:ngsi-ld:null';

const guardAttr = (attr: string): ContentResult | null =>
    RESERVED_ATTRS.has(attr) ? toolError({ error: `"${attr}" cannot be removed` }) : null;

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
                // Mirror update_<type>_attribute: an unmodelled attr lives in the
                // JsonProperty, so remove it with the merge-patch null sentinel.
                if (UNKNOWN_ATTRIBUTES === 'additionalProperty' && !isKnownAttr(attr, schema)) {
                    await mergeEntity(id, {
                        [ADDITIONAL_PROPERTY]: { type: 'JsonProperty', json: { [attr]: NGSI_NULL } }
                    });
                    return ok({ deleted: attr, from: id, into: ADDITIONAL_PROPERTY });
                }
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

export function registerGenericDelete(server: FastMCP, exposed: Set<string>, schemas: LoadedSchema[] = []): number {
    if (!WRITABLE) {
        return 0;
    }
    const typedDelete = schemas.filter((s) => isDeletableType(s.typeName)).map((s) => s.typeName);
    const preferTyped = (tool: string) =>
        typedDelete.length ? ` Prefer a typed \`${tool}\` tool for ${typedDelete.join(', ')}.` : '';

    exposed.add('delete_entity_attribute');
    server.addTool({
        name: 'delete_entity_attribute',
        description:
            '[DELETE] Remove one attribute from any existing entity. Does not delete the entity itself.' +
            preferTyped('delete_<type>_attribute'),
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
            'soft-delete. To remove a single attribute use `delete_entity_attribute`.' +
            preferTyped('delete_<type>'),
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
