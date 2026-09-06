// Write tools. Gated by the WRITABLE master interlock. With WRITABLE=true and no
// WRITABLE_TYPES list, registerGenericWrite adds one create_entity /
// update_entity_attribute pair covering any type; with a WRITABLE_TYPES list,
// registerWrite adds a typed create_<type> / update_<type>_attribute per listed
// type and no generic tool. Destructive removal lives in ./delete.ts.

import type { FastMCP } from 'fastmcp';
import { z } from 'zod';
import { createEntity, appendAttribute, replaceAttribute } from '../../lib/ngsi-ld';
import { WRITABLE, isWritableType, PROVIDED_BY, entityDefaultsFor } from '../../lib/constants';
import { normalizeAttribute } from '../../lib/normalize';
import type { LoadedSchema } from '../../lib/schema';
import { ok, fail, is404, notFound, RESERVED_ATTRS } from './util';

// Encode a caller's { name: value } map into normalised NGSI-LD, using the schema
// when one is supplied and best-effort inference otherwise.
function encodeAttrs(attrs: Record<string, unknown>, schema?: LoadedSchema): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [name, value] of Object.entries(attrs)) {
        if (RESERVED_ATTRS.has(name) || value === undefined || value === null) {
            continue;
        }
        out[name] = normalizeAttribute(name, value, schema?.writeAttrs[name], {
            mobile: schema?.mobile ?? false,
            providedBy: PROVIDED_BY
        });
    }
    return out;
}

// PUT the attribute (full replace); on 404 the attribute does not exist yet, so
// POST it. A missing entity 404s both calls — the caller maps that to notFound.
async function putOrAppend(id: string, attr: string, node: unknown): Promise<'replaced' | 'created'> {
    try {
        await replaceAttribute(id, attr, node);
        return 'replaced';
    } catch (err) {
        if (is404(err)) {
            await appendAttribute(id, attr, node);
            return 'created';
        }
        throw err;
    }
}

const attrOverrides = {
    unitCode: z.string().optional().describe('Override the schema UN/CEFACT unit code.'),
    observedAt: z.string().optional().describe('Override observedAt with an explicit ISO8601 timestamp.')
};

// ---- typed: one pair per type named in WRITABLE_TYPES ----------------------

export function registerWrite(server: FastMCP, schema: LoadedSchema, exposed: Set<string>): number {
    if (!WRITABLE || !isWritableType(schema.typeName)) {
        return 0;
    }

    const stem = schema.typeName.toLowerCase();
    const t = schema.typeName;
    const mustHave = schema.required.filter((r) => !RESERVED_ATTRS.has(r));
    const defaults = entityDefaultsFor(t);
    const defaultKeys = Object.keys(defaults).filter((k) => !RESERVED_ATTRS.has(k));

    exposed.add(`create_${stem}`);
    server.addTool({
        name: `create_${stem}`,
        description:
            `[WRITE] Create a new ${t} entity. Pass attributes in simplified form (\`name: value\`); the server encodes ` +
            `the NGSI-LD attribute type, unitCode and observedAt from the schema. A relationship attribute takes the ` +
            `target entity URN as its value; a GeoProperty takes GeoJSON (or a bare [lng, lat]). ` +
            (mustHave.length ? `Required attributes: ${mustHave.join(', ')}. ` : '') +
            (defaultKeys.length
                ? `Omitted attributes default to: ${defaultKeys
                      .map((k) => `${k}=${JSON.stringify(defaults[k])}`)
                      .join(', ')}. `
                : '') +
            `Full schema: \`${schema.ontologyUri}\`.`,
        parameters: z.object({
            id: z.string().describe(`URN for the new entity, e.g. "urn:ngsi-ld:${t}:001".`),
            attributes: z
                .record(z.any())
                .describe('Attribute name → value in simplified form, e.g. { "species": "cow", "ownedBy": "urn:ngsi-ld:Person:001" }.')
        }),
        execute: async ({ id, attributes }) => {
            try {
                const attrs = { ...defaults, ...((attributes ?? {}) as Record<string, unknown>) };
                const missing = mustHave.filter((r) => attrs[r] === undefined || attrs[r] === null);
                if (missing.length) {
                    return JSON.stringify({ error: `Missing required attribute(s): ${missing.join(', ')}` });
                }
                const entity = { id, type: t, ...encodeAttrs(attrs, schema) };
                await createEntity(entity);
                return ok({ created: id, type: t, attributes: Object.keys(entity).filter((k) => !RESERVED_ATTRS.has(k)) });
            } catch (err) {
                return fail(err);
            }
        }
    });

    exposed.add(`update_${stem}_attribute`);
    server.addTool({
        name: `update_${stem}_attribute`,
        description:
            `[WRITE] Set one attribute on an existing ${t} to exactly the supplied value, replacing it wholesale — any ` +
            `sub-attributes not in this call are dropped (it is not a partial merge). Creates the attribute if it is ` +
            `absent. \`value\` is simplified form (a target URN for a relationship). unitCode and observedAt come from ` +
            `the schema — pass them only to override. Full schema: \`${schema.ontologyUri}\`.`,
        parameters: z.object({
            id: z.string().describe(`URN of the ${t}.`),
            attr: z.string().describe('Attribute name, e.g. "weight" or "locatedAt".'),
            value: z.any().describe('New value in simplified form.'),
            ...attrOverrides
        }),
        execute: async ({ id, attr, value, unitCode, observedAt }) => {
            try {
                if (RESERVED_ATTRS.has(attr)) {
                    return JSON.stringify({ error: `"${attr}" is not a writable attribute` });
                }
                const node = normalizeAttribute(attr, value, schema.writeAttrs[attr], {
                    mobile: schema.mobile,
                    unitCode,
                    observedAt,
                    providedBy: PROVIDED_BY
                });
                const mode = await putOrAppend(id, attr, node);
                return ok({ updated: id, attr, mode });
            } catch (err) {
                if (is404(err)) {
                    return notFound(t, id, attr);
                }
                return fail(err);
            }
        }
    });

    return 2;
}

// ---- generic: one pair covering any type (WRITABLE=true, no WRITABLE_TYPES) ----

export function registerGenericWrite(server: FastMCP, schemas: LoadedSchema[], exposed: Set<string>): number {
    if (!WRITABLE) {
        return 0;
    }
    const byType = new Map(schemas.map((s) => [s.typeName.toLowerCase(), s]));

    exposed.add('create_entity');
    server.addTool({
        name: 'create_entity',
        description:
            '[WRITE] Create a new NGSI-LD entity of any type. Pass attributes in simplified form (`name: value`). When a ' +
            'schema is loaded for `type` the server encodes attribute types, units and observedAt from it and enforces ' +
            'its required attributes; otherwise it infers (a `urn:ngsi-ld:` value is a Relationship, GeoJSON is a ' +
            'GeoProperty, everything else a Property) — pass an already-typed node like `{ "object": "urn:…" }` to be ' +
            'explicit. Prefer a typed `create_<type>` tool when one exists.',
        parameters: z.object({
            id: z.string().describe('URN for the new entity, e.g. "urn:ngsi-ld:Animal:001".'),
            type: z.string().describe('Entity type, e.g. "Animal".'),
            attributes: z.record(z.any()).describe('Attribute name → value in simplified (or already-typed) form.')
        }),
        execute: async ({ id, type, attributes }) => {
            try {
                const schema = byType.get(type.toLowerCase());
                const attrs = { ...entityDefaultsFor(type), ...((attributes ?? {}) as Record<string, unknown>) };
                if (schema) {
                    const missing = schema.required
                        .filter((r) => !RESERVED_ATTRS.has(r))
                        .filter((r) => attrs[r] === undefined || attrs[r] === null);
                    if (missing.length) {
                        return JSON.stringify({ error: `Missing required attribute(s): ${missing.join(', ')}` });
                    }
                }
                const entity = { id, type, ...encodeAttrs(attrs, schema) };
                await createEntity(entity);
                return ok({ created: id, type, attributes: Object.keys(entity).filter((k) => !RESERVED_ATTRS.has(k)) });
            } catch (err) {
                return fail(err);
            }
        }
    });

    exposed.add('update_entity_attribute');
    server.addTool({
        name: 'update_entity_attribute',
        description:
            '[WRITE] Set one attribute on any existing entity to exactly the supplied value, replacing it wholesale ' +
            '(not a partial merge); creates the attribute if absent. Give `type` so the server can apply the schema ' +
            "encoding; without it the value is inferred. Prefer a typed `update_<type>_attribute` tool when one exists.",
        parameters: z.object({
            id: z.string().describe('URN of the entity.'),
            attr: z.string().describe('Attribute name.'),
            value: z.any().describe('New value in simplified (or already-typed) form.'),
            type: z.string().optional().describe('Entity type, to apply the loaded schema encoding.'),
            ...attrOverrides
        }),
        execute: async ({ id, attr, value, type, unitCode, observedAt }) => {
            try {
                if (RESERVED_ATTRS.has(attr)) {
                    return JSON.stringify({ error: `"${attr}" is not a writable attribute` });
                }
                const schema = type ? byType.get(type.toLowerCase()) : undefined;
                const node = normalizeAttribute(attr, value, schema?.writeAttrs[attr], {
                    mobile: schema?.mobile ?? false,
                    unitCode,
                    observedAt,
                    providedBy: PROVIDED_BY
                });
                const mode = await putOrAppend(id, attr, node);
                return ok({ updated: id, attr, mode });
            } catch (err) {
                if (is404(err)) {
                    return notFound(type ?? 'entity', id, attr);
                }
                return fail(err);
            }
        }
    });

    return 2;
}
