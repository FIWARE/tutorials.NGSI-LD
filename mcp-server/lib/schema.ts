// Load schemas/*.json, dereference $ref / flatten allOf, and derive the Zod
// shapes each dynamic tool needs (input filters, concise output, temporal output).
// See ARCHITECTURE.md §4 (lib/schema.ts) and §7.

import fs from 'fs';
import path from 'path';
import debug from 'debug';
import { z } from 'zod';
import { dereference } from '@apidevtools/json-schema-ref-parser';
import { SCHEMA_DIR, COMMON_DIR } from './constants';
import type { JsonSchemaNode } from '../types/globals';

const log = debug('mcp:schema');

export interface LoadedSchema {
    typeName: string; // NGSI-LD `type=` value and tool-name stem
    model: string; // ontology:// slug, e.g. "agrifood"
    ontologyUri: string; // ontology://<model>/<typeName>
    title: string;
    toolDescription: string;
    inputShape: z.ZodRawShape;
    entityValidator: z.ZodTypeAny; // single concise entity, full required baseline, .passthrough()
    entityValidatorLoose: z.ZodTypeAny; // same, all fields optional — used when `pick` narrows the response
    temporalValidator: z.ZodTypeAny; // single temporalValues entity, .passthrough()
    required: string[];
    lowTrust: boolean;
    writeAttrs: Record<string, WriteAttr>; // per-attribute NGSI-LD encoding hints for the write tools
    mobile: boolean; // x-mobile: the entity's `location` is a moving measurement
    raw: JsonSchemaNode; // dereferenced + flattened
    source: JsonSchemaNode; // as read from disk (served by the ontology resource)
}

// The eight NGSI-LD attribute types (ETSI GS CIM 009 §4.5.2), each with its own
// value-bearing member — see VALUE_KEY in lib/normalize.ts.
export type NgsiAttrType =
    | 'Property'
    | 'GeoProperty'
    | 'Relationship'
    | 'VocabProperty'
    | 'LanguageProperty'
    | 'ListProperty'
    | 'ListRelationship'
    | 'JsonProperty';

export const NGSI_ATTR_TYPES: ReadonlySet<NgsiAttrType> = new Set([
    'Property',
    'GeoProperty',
    'Relationship',
    'VocabProperty',
    'LanguageProperty',
    'ListProperty',
    'ListRelationship',
    'JsonProperty'
]);

// How a write tool must encode one attribute into normalised NGSI-LD, derived
// from x-ngsi-type / x-unitCode / x-observedAt / enum on the flattened schema.
export interface WriteAttr {
    ngsiType: NgsiAttrType;
    unitCode?: string;
    observedAt: boolean;
    enumValues?: string[];
}

// --- $ref resolution -------------------------------------------------------

// Map any https://smart-data-models.github.io/... reference onto the matching
// file in schemas/common/ so resolution stays fully offline.
const sdmResolver = {
    order: 1,
    canRead: /^https?:\/\/smart-data-models\.github\.io\//i,
    read(file: { url: string }): string {
        const base = file.url.split('#')[0].split('/').pop() || '';
        return fs.readFileSync(path.join(COMMON_DIR, base), 'utf-8');
    }
};

// --- allOf flattening ----------------------------------------------------------

interface Flat {
    properties: Record<string, JsonSchemaNode>;
    required: string[];
}

function flatten(node: JsonSchemaNode): Flat {
    const properties: Record<string, JsonSchemaNode> = {};
    const required: string[] = [];

    const visit = (n: JsonSchemaNode | undefined): void => {
        if (!n || typeof n !== 'object') {
            return;
        }
        // Recurse into allOf first so the more specific block (applied afterwards) wins.
        if (Array.isArray(n.allOf)) {
            n.allOf.forEach(visit);
        }
        if (n.properties && typeof n.properties === 'object') {
            for (const [k, v] of Object.entries(n.properties)) {
                if (v && typeof v === 'object') {
                    properties[k] = v;
                }
            }
        }
        if (Array.isArray(n.required)) {
            required.push(...n.required);
        }
    };

    visit(node);
    return { properties, required: [...new Set(required)] };
}

// --- JSON Schema -> Zod ------------------------------------------------------

function scalarType(p: JsonSchemaNode): 'string' | 'number' | 'boolean' | null {
    let t = p.type;
    if (Array.isArray(t)) {
        t = t.find((x) => x !== 'null');
    }
    if (t === 'string') {
        return 'string';
    }
    if (t === 'number' || t === 'integer') {
        return 'number';
    }
    if (t === 'boolean') {
        return 'boolean';
    }
    // Relationship props are modelled as anyOf of string URN forms.
    if (!t && Array.isArray(p.anyOf) && p.anyOf.length > 0 && p.anyOf.every((b) => b.type === 'string')) {
        return 'string';
    }
    return null;
}

function baseZod(p: JsonSchemaNode): z.ZodTypeAny {
    if (Array.isArray(p.enum) && p.enum.length > 0 && p.enum.every((e) => typeof e === 'string')) {
        return z.enum(p.enum as [string, ...string[]]);
    }
    switch (scalarType(p)) {
        case 'string':
            return z.string();
        case 'number':
            return z.number();
        case 'boolean':
            return z.boolean();
        default:
            return z.any();
    }
}

// options=concise: a flat primitive when there is no metadata, otherwise an object
// holding the value/target plus metadata with the redundant "type" tag dropped.
// The object branch also covers Relationship ({object}), GeoProperty ({value: GeoJSON})
// and VocabProperty ({vocab}) forms, so `value` is checked against `base` only when present.
export function conciseValidator(base: z.ZodTypeAny): z.ZodTypeAny {
    return z.union([
        base,
        z
            .object({
                value: base.optional(),
                object: z.any().optional(),
                vocab: z.any().optional(),
                unitCode: z.string().optional(),
                observedAt: z.string().optional(),
                datasetId: z.string().optional()
            })
            .passthrough()
    ]);
}

// options=temporalValues: { values: [ [value, ISO-timestamp], ... ] }
function temporalValidator(base: z.ZodTypeAny): z.ZodTypeAny {
    return z.object({ values: z.array(z.tuple([base, z.string()])) });
}

// --- shape builder --------------------------------------------------------

// Storage-platform timestamps — present on entities but never sensible query filters.
const SYSTEM_FIELDS = new Set(['dateCreated', 'dateModified', 'createdAt', 'modifiedAt']);

export interface Shapes {
    inputShape: z.ZodRawShape;
    entityValidator: z.ZodTypeAny;
    entityValidatorLoose: z.ZodTypeAny;
    temporalValidator: z.ZodTypeAny;
    required: string[];
    lowTrust: boolean;
    writeAttrs: Record<string, WriteAttr>;
    mobile: boolean;
}

// x-ngsi-type wins; fall back to the SDM "<Kind>. ..." description prefix; else Property.
function ngsiKind(prop: JsonSchemaNode): NgsiAttrType {
    const xt = prop['x-ngsi-type'];
    if (typeof xt === 'string' && NGSI_ATTR_TYPES.has(xt as NgsiAttrType)) {
        return xt as NgsiAttrType;
    }
    // Longest alternatives first so "ListRelationship" is not shadowed by "Relationship".
    const m = (prop.description || '').match(
        /^\s*(GeoProperty|LanguageProperty|ListRelationship|ListProperty|VocabProperty|JsonProperty|Relationship)\b/i
    );
    if (m) {
        const found = m[1].toLowerCase();
        for (const t of NGSI_ATTR_TYPES) {
            if (t.toLowerCase() === found) return t;
        }
    }
    return 'Property';
}

export function buildShapes(source: JsonSchemaNode, deref: JsonSchemaNode): Shapes {
    const { properties, required: schemaRequired } = flatten(deref);

    const tags = (source.modelTags || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    const derived = source['x-derivedFrom'];
    const lowTrust = tags.includes('stub') || tags.includes('profile') || derived?.instances === 0;
    // Any non-canonical schema (derived from broker introspection, SAREF, a context
    // term or a parent model) has an unreliable `required` list — enforce only id/type.
    const relaxRequired = lowTrust || !!derived;
    const required = relaxRequired ? ['id', 'type'] : schemaRequired;

    const inputShape: z.ZodRawShape = {};
    const entityShape: z.ZodRawShape = {};
    const temporalShape: z.ZodRawShape = {};
    const writeAttrs: Record<string, WriteAttr> = {};

    for (const [key, prop] of Object.entries(properties)) {
        if (prop['x-ngsi-type'] === 'Command') {
            continue; // write-only actuations — out of scope for the read-only tools
        }

        if (key === 'id' || key === 'type') {
            entityShape[key] = baseZod(prop);
            temporalShape[key] = baseZod(prop);
            continue;
        }

        writeAttrs[key] = {
            ngsiType: ngsiKind(prop),
            unitCode: typeof prop['x-unitCode'] === 'string' ? (prop['x-unitCode'] as string) : undefined,
            observedAt: prop['x-observedAt'] === true,
            enumValues:
                Array.isArray(prop.enum) && prop.enum.every((e) => typeof e === 'string')
                    ? (prop.enum as string[])
                    : undefined
        };

        const base = baseZod(prop);
        let out = conciseValidator(base);
        if (!required.includes(key)) {
            out = out.optional();
        }
        entityShape[key] = out;

        if (scalarType(prop)) {
            if (!SYSTEM_FIELDS.has(key)) {
                inputShape[key] = z
                    .string()
                    .optional()
                    .describe(prop.description || key);
            }
            temporalShape[key] = temporalValidator(base).optional();
        }
    }

    entityShape.id = entityShape.id || z.string();
    entityShape.type = entityShape.type || z.string();
    temporalShape.id = temporalShape.id || z.string();
    temporalShape.type = temporalShape.type || z.string();

    const entityObject = z.object(entityShape);

    return {
        inputShape,
        entityValidator: entityObject.passthrough(),
        // When the agent narrows with `pick`, the required baseline is intentionally
        // absent — validate the types of whatever came back, require nothing.
        entityValidatorLoose: entityObject.partial().passthrough(),
        temporalValidator: z.object(temporalShape).passthrough(),
        required,
        lowTrust,
        writeAttrs,
        mobile: source['x-mobile'] === true
    };
}

// --- metadata --------------------------------------------------------------

function modelSlug(source: JsonSchemaNode): string {
    const id = source.$id || '';
    const m = id.match(/dataModel\.([A-Za-z0-9]+)/);
    if (m) {
        return m[1].toLowerCase();
    }
    return source['x-derivedFrom'] ? 'generated' : 'core';
}

function describe(source: JsonSchemaNode, typeName: string, ontologyUri: string, lowTrust: boolean): string {
    let text = [source.description, source['x-ai-instruction']].filter(Boolean).join('\n\n');
    if (!text) {
        text = `Query and retrieve ${typeName} entities from the Context Broker.`;
    }
    if (lowTrust) {
        text +=
            '\n\nNote: this profile is inferred (context term / SAREF / parent model), not a canonical Smart Data Model. ' +
            'Treat the property list as indicative — only id and type are guaranteed.';
    } else if (source['x-derivedFrom']) {
        text +=
            '\n\nNote: this model was derived from live broker data, not a canonical Smart Data Model — ' +
            'the property list is representative but not exhaustive.';
    }
    text += `\n\nAlways narrow results with \`pick\`. If unsure which properties to filter or \`pick\`, read \`${ontologyUri}\` first.`;
    return text;
}

// --- loader --------------------------------------------------------------

export async function loadOne(file: string): Promise<LoadedSchema> {
    const full = path.join(SCHEMA_DIR, file);
    const source = JSON.parse(fs.readFileSync(full, 'utf-8')) as JsonSchemaNode;

    const deref = (await dereference(full, {
        resolve: { sdm: sdmResolver },
        dereference: { circular: 'ignore' }
    })) as JsonSchemaNode;

    const typeName = path.basename(file, '.json');
    const model = modelSlug(source);
    const ontologyUri = `ontology://${model}/${typeName}`;
    const shapes = buildShapes(source, deref);

    return {
        typeName,
        model,
        ontologyUri,
        title: typeof source.title === 'string' && source.title.trim() ? source.title.trim() : typeName,
        toolDescription: describe(source, typeName, ontologyUri, shapes.lowTrust),
        inputShape: shapes.inputShape,
        entityValidator: shapes.entityValidator,
        entityValidatorLoose: shapes.entityValidatorLoose,
        temporalValidator: shapes.temporalValidator,
        required: shapes.required,
        lowTrust: shapes.lowTrust,
        writeAttrs: shapes.writeAttrs,
        mobile: shapes.mobile,
        raw: deref,
        source
    };
}

export async function loadSchemas(): Promise<LoadedSchema[]> {
    let files: string[] = [];
    try {
        files = fs
            .readdirSync(SCHEMA_DIR)
            .filter(
                (f) =>
                    !f.startsWith('.') && // .gitkeep, .DS_Store, …
                    f.endsWith('.json') &&
                    fs.statSync(path.join(SCHEMA_DIR, f)).isFile()
            );
    } catch (err) {
        log('cannot read SCHEMA_DIR %s: %s', SCHEMA_DIR, (err as Error).message);
        return [];
    }

    const loaded: LoadedSchema[] = [];
    for (const file of files.sort()) {
        try {
            loaded.push(await loadOne(file));
            log('loaded %s', file);
        } catch (err) {
            log('skipping %s: %s', file, (err as Error).message);
        }
    }
    if (loaded.length === 0) {
        log('no schemas loaded — generic tools only');
    }
    return loaded;
}
