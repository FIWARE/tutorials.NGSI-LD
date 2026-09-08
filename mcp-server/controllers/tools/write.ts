// Write tools. Gated by the WRITABLE master interlock. With WRITABLE=true and no
// WRITABLE_TYPES list, registerGenericWrite adds one create_entity /
// update_entity_attribute pair covering any type; with a WRITABLE_TYPES list,
// registerWrite adds a typed create_<type> / update_<type>_attribute per listed
// type and no generic tool. Destructive removal lives in ./delete.ts.

import type { FastMCP } from 'fastmcp';
import { z } from 'zod';
import { createEntity, mergeEntity, appendAttribute, patchAttribute } from '../../lib/ngsi-ld';
import {
    WRITABLE,
    isWritableType,
    PROVIDED_BY,
    entityDefaultsFor,
    UNKNOWN_ATTRIBUTES,
    ADDITIONAL_PROPERTY
} from '../../lib/constants';
import { normalizeAttribute } from '../../lib/normalize';
import type { LoadedSchema } from '../../lib/schema';
import { ok, fail, is404, notFound, RESERVED_ATTRS } from './util';

// A value of any JSON type. Spelled as an explicit anyOf, and the object branch as
// z.object({}).passthrough() (→ additionalProperties: true) rather than
// z.record(z.any()) (→ a bare {}), so every branch of the emitted JSON Schema
// carries a real validation keyword — some MCP clients reject a bare `{}`.
const jsonValue = z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(z.any()),
    z.object({}).passthrough()
]);

// Core-context terms valid on any entity even when a schema omits them.
const CORE_ENTITY_ATTRS = new Set(['description', 'title', 'location']);

const isKnown = (name: string, schema: LoadedSchema): boolean =>
    name in schema.writeAttrs || CORE_ENTITY_ATTRS.has(name);

type Composed = { entity: Record<string, unknown> } | { error: string };

// Build the normalised entity, applying UNKNOWN_ATTRIBUTES to any name not in the
// type's schema: accept (encode best-effort), reject (fail), or additionalProperty
// (collect into one JsonProperty named ADDITIONAL_PROPERTY, per schema.org).
function composeEntity(id: string, type: string, attrs: Record<string, unknown>, schema: LoadedSchema): Composed {
    const entity: Record<string, unknown> = { id, type };
    const extra: Record<string, unknown> = {};
    const rejected: string[] = [];

    for (const [name, value] of Object.entries(attrs)) {
        if (RESERVED_ATTRS.has(name) || value === undefined || value === null) continue;
        if (name === ADDITIONAL_PROPERTY && value && typeof value === 'object' && !Array.isArray(value)) {
            Object.assign(extra, value as Record<string, unknown>);
            continue;
        }
        if (isKnown(name, schema) || UNKNOWN_ATTRIBUTES === 'accept') {
            entity[name] = normalizeAttribute(name, value, schema.writeAttrs[name], {
                mobile: schema.mobile,
                providedBy: PROVIDED_BY
            });
        } else if (UNKNOWN_ATTRIBUTES === 'additionalProperty') {
            extra[name] = value;
        } else {
            rejected.push(name);
        }
    }

    if (rejected.length) {
        return {
            error: `Unknown attribute(s) for ${type}: ${rejected.join(', ')}. Only ${type} schema attributes ` +
                `(${schema.ontologyUri}) are accepted.`
        };
    }
    if (Object.keys(extra).length) {
        entity[ADDITIONAL_PROPERTY] = { type: 'JsonProperty', json: extra };
    }
    return { entity };
}

// PATCH the attribute (partial merge); on 404 the attribute does not exist yet, so
// POST it to create. A missing entity 404s both calls — mapped to notFound.
async function patchOrAppend(id: string, attr: string, node: unknown): Promise<'merged' | 'created'> {
    try {
        await patchAttribute(id, attr, node);
        return 'merged';
    } catch (err) {
        if (is404(err)) {
            await appendAttribute(id, attr, node);
            return 'created';
        }
        throw err;
    }
}

// Apply UNKNOWN_ATTRIBUTES to a single-attribute update. When the attr is not in
// the schema and the mode is additionalProperty, it is deep-merged into the
// JsonProperty via merge-patch rather than written as its own attribute.
async function updateOne(
    id: string,
    attr: string,
    value: unknown,
    schema: LoadedSchema | undefined,
    over: { unitCode?: string; observedAt?: string }
): Promise<Record<string, unknown>> {
    if (schema && !isKnown(attr, schema)) {
        if (UNKNOWN_ATTRIBUTES === 'reject') {
            return {
                error: `Unknown attribute "${attr}" for ${schema.typeName}. Only ${schema.typeName} schema attributes ` +
                    `(${schema.ontologyUri}) are accepted.`
            };
        }
        if (UNKNOWN_ATTRIBUTES === 'additionalProperty') {
            await mergeEntity(id, { [ADDITIONAL_PROPERTY]: { type: 'JsonProperty', json: { [attr]: value } } });
            return { updated: id, attr, into: ADDITIONAL_PROPERTY, mode: 'merged' };
        }
    }
    const node = normalizeAttribute(attr, value, schema?.writeAttrs[attr], {
        mobile: schema?.mobile ?? false,
        unitCode: over.unitCode,
        observedAt: over.observedAt,
        providedBy: PROVIDED_BY
    });
    const mode = await patchOrAppend(id, attr, node);
    return { updated: id, attr, mode };
}

const attrOverrides = {
    unitCode: z.string().optional().describe('Override the schema UN/CEFACT unit code.'),
    observedAt: z.string().optional().describe('Override observedAt with an explicit ISO8601 timestamp.')
};

// The attribute vocabulary is only useful when new names can be added — in reject
// mode it is not loaded, so do not point at it.
const CANON = UNKNOWN_ATTRIBUTES === 'reject' ? '' : ' Canonical attribute names: `ontology://attributes`.';

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
            `Full schema: \`${schema.ontologyUri}\`.` + CANON,
        parameters: z.object({
            id: z.string().describe(`URN for the new entity, e.g. "urn:ngsi-ld:${t}:001".`),
            attributes: z
                .record(jsonValue)
                .describe('Attribute name → value in simplified form, e.g. { "species": "cow", "ownedBy": "urn:ngsi-ld:Person:001" }.')
        }),
        execute: async ({ id, attributes }) => {
            try {
                const attrs = { ...defaults, ...((attributes ?? {}) as Record<string, unknown>) };
                const missing = mustHave.filter((r) => attrs[r] === undefined || attrs[r] === null);
                if (missing.length) {
                    return JSON.stringify({ error: `Missing required attribute(s): ${missing.join(', ')}` });
                }
                const composed = composeEntity(id, t, attrs, schema);
                if ('error' in composed) return JSON.stringify(composed);
                await createEntity(composed.entity);
                return ok({
                    created: id,
                    type: t,
                    attributes: Object.keys(composed.entity).filter((k) => !RESERVED_ATTRS.has(k))
                });
            } catch (err) {
                return fail(err);
            }
        }
    });

    exposed.add(`update_${stem}_attribute`);
    server.addTool({
        name: `update_${stem}_attribute`,
        description:
            `[WRITE] Update one attribute on an existing ${t}, or add a new one — the value (and any sub-attributes you ` +
            `pass) are merged in; sub-attributes you do not mention are kept; the attribute is created if absent. ` +
            `\`value\` is simplified form (a target URN for a relationship). unitCode and observedAt come from the schema ` +
            `— pass them only to override. Schema: \`${schema.ontologyUri}\`.` + CANON,
        parameters: z.object({
            id: z.string().describe(`URN of the ${t}.`),
            attr: z.string().describe('Attribute name, e.g. "weight" or "locatedAt".'),
            value: jsonValue.describe('New value in simplified form.'),
            ...attrOverrides
        }),
        execute: async ({ id, attr, value, unitCode, observedAt }) => {
            try {
                if (RESERVED_ATTRS.has(attr)) {
                    return JSON.stringify({ error: `"${attr}" is not a writable attribute` });
                }
                return ok(await updateOne(id, attr, value, schema, { unitCode, observedAt }));
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
    const typeNames = schemas.map((s) => s.typeName).sort();
    // Creation is restricted to types with a loaded schema — no schema, no create.
    const typeParam =
        typeNames.length > 0
            ? z.enum(typeNames as [string, ...string[]])
            : z.string();

    exposed.add('create_entity');
    server.addTool({
        name: 'create_entity',
        description:
            '[WRITE] Create a new NGSI-LD entity. `type` must be one of the loaded data models — creation of an ' +
            'unmodelled type is refused. Pass attributes in simplified form (`name: value`); the server encodes the ' +
            'NGSI-LD attribute type, unitCode and observedAt from the schema and enforces its required attributes. A ' +
            'relationship attribute takes the target entity URN; a GeoProperty takes GeoJSON (or a bare [lng, lat]).' +
            CANON +
            ' Prefer a typed `create_<type>` tool when one exists.',
        parameters: z.object({
            id: z.string().describe('URN for the new entity, e.g. "urn:ngsi-ld:Animal:001".'),
            type: typeParam.describe('Entity type — must be a loaded data model.'),
            attributes: z.record(jsonValue).describe('Attribute name → value in simplified (or already-typed) form.')
        }),
        execute: async ({ id, type, attributes }) => {
            try {
                const schema = byType.get(String(type).toLowerCase());
                if (!schema) {
                    return JSON.stringify({
                        error: `No data model loaded for type "${type}" — creation refused. Supported types: ${
                            typeNames.join(', ') || '(none)'
                        }.`
                    });
                }
                const attrs = { ...entityDefaultsFor(schema.typeName), ...((attributes ?? {}) as Record<string, unknown>) };
                const missing = schema.required
                    .filter((r) => !RESERVED_ATTRS.has(r))
                    .filter((r) => attrs[r] === undefined || attrs[r] === null);
                if (missing.length) {
                    return JSON.stringify({ error: `Missing required attribute(s): ${missing.join(', ')}` });
                }
                const composed = composeEntity(id, schema.typeName, attrs, schema);
                if ('error' in composed) return JSON.stringify(composed);
                await createEntity(composed.entity);
                return ok({
                    created: id,
                    type: schema.typeName,
                    attributes: Object.keys(composed.entity).filter((k) => !RESERVED_ATTRS.has(k))
                });
            } catch (err) {
                return fail(err);
            }
        }
    });

    exposed.add('update_entity_attribute');
    server.addTool({
        name: 'update_entity_attribute',
        description:
            '[WRITE] Update one attribute on any existing entity, or add a new one — the supplied value (and any ' +
            'sub-attributes) are merged in; sub-attributes you do not mention are kept; the attribute is created if ' +
            'absent. Give `type` so the server can apply the schema encoding and the unknown-attribute policy; without ' +
            `it the value is inferred and \`attr\` is written as given.` +
            CANON +
            ' Prefer a typed `update_<type>_attribute` tool when one exists.',
        parameters: z.object({
            id: z.string().describe('URN of the entity.'),
            attr: z.string().describe('Attribute name.'),
            value: jsonValue.describe('New value in simplified (or already-typed) form.'),
            type: z.string().optional().describe('Entity type, to apply the loaded schema encoding.'),
            ...attrOverrides
        }),
        execute: async ({ id, attr, value, type, unitCode, observedAt }) => {
            try {
                if (RESERVED_ATTRS.has(attr)) {
                    return JSON.stringify({ error: `"${attr}" is not a writable attribute` });
                }
                const schema = type ? byType.get(type.toLowerCase()) : undefined;
                return ok(await updateOne(id, attr, value, schema, { unitCode, observedAt }));
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
