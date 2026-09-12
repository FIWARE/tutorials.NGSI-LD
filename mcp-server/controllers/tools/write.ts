// Generic write tools (create_entity, upsert_attribute), driven by WRITABLE.
// Delete is ./delete.ts.

import type { FastMCP } from 'fastmcp';
import { z } from 'zod';
import { createEntity, mergeEntity, appendAttribute, patchAttribute, readEntity } from '../../lib/ngsi-ld';
import { WRITABLE, PROVIDED_BY, entityDefaultsFor, UNKNOWN_ATTRIBUTES, ADDITIONAL_PROPERTY } from '../../lib/constants';
import { normalizeAttribute } from '../../lib/normalize';
import type { LoadedSchema } from '../../lib/schema';
import { ok, fail, toolError, okOrError, is404, notFound, RESERVED_ATTRS, isKnownAttr } from './util';

// Attribute values arrive as strings so the schema has no anyOf (Gemini can't express one).
// Turn "12" / "true" / "null" into primitives, `[`/`{` strings into JSON, keep the rest.
function coerceScalar(v: unknown): unknown {
    if (typeof v !== 'string') return v;
    const t = v.trim();
    if (t === 'true') return true;
    if (t === 'false') return false;
    if (t === 'null') return null;
    if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
    if (/^[[{]/.test(t)) {
        try {
            return JSON.parse(t);
        } catch {
            /* leave as string */
        }
    }
    return v;
}

type Composed = { entity: Record<string, unknown> } | { error: string };

// Build the normalised entity, applying UNKNOWN_ATTRIBUTES (accept / reject /
// additionalProperty) to any name not in the type's schema.
function composeEntity(id: string, type: string, attrs: Record<string, unknown>, schema: LoadedSchema): Composed {
    const entity: Record<string, unknown> = { id, type };
    const extra: Record<string, unknown> = {};
    const rejected: string[] = [];

    for (const [name, rawVal] of Object.entries(attrs)) {
        const value = coerceScalar(rawVal);
        if (RESERVED_ATTRS.has(name) || value === undefined || value === null) continue;
        if (name === ADDITIONAL_PROPERTY && value && typeof value === 'object' && !Array.isArray(value)) {
            Object.assign(extra, value as Record<string, unknown>);
            continue;
        }
        if (isKnownAttr(name, schema) || UNKNOWN_ATTRIBUTES === 'accept') {
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
            error:
                `Unknown attribute(s) for ${type}: ${rejected.join(', ')}. Only ${type} schema attributes ` +
                `(${schema.ontologyUri}) are accepted.`
        };
    }
    if (Object.keys(extra).length) {
        entity[ADDITIONAL_PROPERTY] = { type: 'JsonProperty', json: extra };
    }
    return { entity };
}

// Checks existence first rather than trusting PATCH's status code — some brokers (an
// Orion-LD pre-release, at least) 2xx a PATCH on a missing attribute and do nothing. PATCH merges; POST replaces.
async function patchOrAppend(id: string, attr: string, node: unknown): Promise<'merged' | 'created'> {
    const current = (await readEntity(id, { pick: attr, options: 'concise' })) as Record<string, unknown>;
    if (attr in current) {
        await patchAttribute(id, attr, node);
        return 'merged';
    }
    await appendAttribute(id, attr, node);
    return 'created';
}

// Single-attribute update under UNKNOWN_ATTRIBUTES. In additionalProperty mode an
// unmodelled attr is merge-patched into the JsonProperty, not written on its own.
async function updateOne(
    id: string,
    attr: string,
    raw: unknown,
    schema: LoadedSchema | undefined,
    over: { unitCode?: string; observedAt?: string }
): Promise<Record<string, unknown>> {
    const value = coerceScalar(raw);
    if (schema && !isKnownAttr(attr, schema)) {
        if (UNKNOWN_ATTRIBUTES === 'reject') {
            return {
                error:
                    `Unknown attribute "${attr}" for ${schema.typeName}. Only ${schema.typeName} schema attributes ` +
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

// The attribute vocabulary only helps when new names can be added; reject mode
// does not load it, so do not point there.
const CANON = UNKNOWN_ATTRIBUTES === 'reject' ? '' : ' Canonical attribute names: `ontology://attributes`.';

export function registerGenericWrite(server: FastMCP, schemas: LoadedSchema[], exposed: Set<string>): number {
    if (!WRITABLE) {
        return 0;
    }
    const byType = new Map(schemas.map((s) => [s.typeName.toLowerCase(), s]));
    const typeNames = schemas.map((s) => s.typeName).sort();
    let count = 0;

    // create_entity needs a schema, so it is not registered when none are loaded.
    if (typeNames.length > 0) {
        count++;
        exposed.add('create_entity');
        server.addTool({
            name: 'create_entity',
            annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
            description:
                'Create a new entity. `type` must be one of the loaded data models — creation of an unmodelled ' +
                'type is refused. Pass attributes in simplified form (`name: value`); the server fills in the attribute ' +
                'type, unit code and timestamp from the schema and enforces its required attributes. A relationship ' +
                'attribute takes the target entity URN; a location attribute takes GeoJSON (or a bare [lng, lat]).' +
                CANON,
            parameters: z.object({
                id: z.string().describe('URN for the new entity, e.g. "urn:ngsi-ld:Animal:001".'),
                entityType: z
                    .enum(typeNames as [string, ...string[]])
                    .describe('Entity type — must be a loaded data model.'),
                attributes: z
                    .record(z.string())
                    .describe(
                        'Attribute name → value, e.g. { "species": "cow", "weight": "400" }. Values are strings: a ' +
                            'number or boolean is read as such, a relationship is the target URN, a list or GeoJSON ' +
                            'is a JSON string.'
                    )
            }),
            execute: async ({ id, entityType, attributes }) => {
                try {
                    const schema = byType.get(String(entityType).toLowerCase());
                    if (!schema) {
                        return toolError({
                            error: `No data model loaded for type "${entityType}" — creation refused. Supported types: ${typeNames.join(
                                ', '
                            )}.`
                        });
                    }
                    const attrs = {
                        ...entityDefaultsFor(schema.typeName),
                        ...((attributes ?? {}) as Record<string, unknown>)
                    };
                    const missing = schema.required
                        .filter((r) => !RESERVED_ATTRS.has(r))
                        .filter((r) => attrs[r] === undefined || attrs[r] === null);
                    if (missing.length) {
                        return toolError({ error: `Missing required attribute(s): ${missing.join(', ')}` });
                    }
                    const composed = composeEntity(id, schema.typeName, attrs, schema);
                    if ('error' in composed) return toolError(composed);
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
    }

    count++;
    exposed.add('upsert_attribute');
    server.addTool({
        name: 'upsert_attribute',
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
        description:
            'Update one attribute on any existing entity, or add a new one — the supplied value (and any ' +
            'sub-attributes) are merged in; sub-attributes you do not mention are kept; the attribute is created if ' +
            'absent. Give `entityType` so the server can apply the schema encoding and the unknown-attribute policy; without ' +
            `it the value is inferred and \`attr\` is written as given.` +
            CANON,
        parameters: z.object({
            id: z.string().describe('URN of the entity.'),
            attr: z.string().describe('Attribute name.'),
            value: z
                .string()
                .describe(
                    'New value. A relationship: the target URN. A number or boolean: as text ("400", "true"). ' +
                        'A list or GeoJSON: a JSON string.'
                ),
            entityType: z.string().optional().describe('Entity type, to apply the loaded schema encoding.'),
            ...attrOverrides
        }),
        execute: async ({ id, attr, value, entityType, unitCode, observedAt }) => {
            try {
                if (RESERVED_ATTRS.has(attr)) {
                    return toolError({ error: `"${attr}" is not a writable attribute` });
                }
                const schema = entityType ? byType.get(entityType.toLowerCase()) : undefined;
                return okOrError(await updateOne(id, attr, value, schema, { unitCode, observedAt }));
            } catch (err) {
                if (is404(err)) {
                    return notFound(entityType ?? 'entity', id, attr);
                }
                return fail(err);
            }
        }
    });

    return count;
}
