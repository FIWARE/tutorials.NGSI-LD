// Load the NGSI-LD context-discovery response schemas (ngsi-schemas/*.json) and
// build a Zod validator per type. These describe the responses of GET /types,
// /types/{type}, /attributes and /attributes/{attrId} — see ETSI GS CIM 009
// clauses 5.2.24–5.2.28. options=concise / keyValues never apply to these payloads.

import fs from 'fs';
import path from 'path';
import debug from 'debug';
import { z } from 'zod';
import { dereference } from '@apidevtools/json-schema-ref-parser';
import { CORE_SCHEMA_DIR } from './constants';
import type { JsonSchemaNode } from '../types/globals';

const log = debug('mcp:schema');

export interface CoreSchema {
    typeName: string;
    source: JsonSchemaNode; // as read from disk (served by the ontology resource)
    validator: z.ZodTypeAny; // dereferenced -> Zod
}

export type CoreName = 'EntityTypeList' | 'EntityType' | 'EntityTypeInfo' | 'AttributeList' | 'Attribute';

export type CoreSchemas = Record<CoreName, CoreSchema>;

function toZod(node: JsonSchemaNode): z.ZodTypeAny {
    if (!node || typeof node !== 'object') {
        return z.any();
    }
    if (Array.isArray(node.enum) && node.enum.length > 0 && node.enum.every((e) => typeof e === 'string')) {
        return z.enum(node.enum as [string, ...string[]]);
    }

    let t = node.type;
    if (Array.isArray(t)) {
        t = t.find((x) => x !== 'null');
    }

    switch (t) {
        case 'string':
            return z.string();
        case 'integer':
        case 'number':
            return z.number();
        case 'boolean':
            return z.boolean();
        case 'array':
            return z.array(node.items ? toZod(node.items) : z.any());
        case 'object': {
            const shape: z.ZodRawShape = {};
            const required = Array.isArray(node.required) ? node.required : [];
            for (const [key, prop] of Object.entries(node.properties || {})) {
                let v = toZod(prop);
                if (!required.includes(key)) {
                    v = v.optional();
                }
                shape[key] = v;
            }
            return z.object(shape).passthrough();
        }
        default:
            return z.any();
    }
}

async function loadOne(file: string): Promise<CoreSchema> {
    const full = path.join(CORE_SCHEMA_DIR, file);
    const source = JSON.parse(fs.readFileSync(full, 'utf-8')) as JsonSchemaNode;
    // EntityTypeInfo $refs ./Attribute.json — resolved against the same folder, offline.
    const deref = (await dereference(full, { dereference: { circular: 'ignore' } })) as JsonSchemaNode;
    return { typeName: path.basename(file, '.json'), source, validator: toZod(deref) };
}

export async function loadCoreSchemas(): Promise<CoreSchemas> {
    const names: CoreName[] = ['EntityTypeList', 'EntityType', 'EntityTypeInfo', 'AttributeList', 'Attribute'];
    const out = {} as CoreSchemas;
    for (const name of names) {
        out[name] = await loadOne(`${name}.json`);
        log('loaded core %s', name);
    }
    return out;
}
