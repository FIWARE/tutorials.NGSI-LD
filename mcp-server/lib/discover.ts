// Entity types read from the broker, turned into the same LoadedSchema the disk loader
// produces — a last-resort partial profile, since the broker only knows what's currently populated.

import debug from 'debug';
import { CONTEXT, SDM_BASE_URL } from './constants';
import { listTypes, readType } from './ngsi-ld';
import { loadFromSource, type LoadedSchema } from './schema';
import type { JsonSchemaNode } from '../types/globals';

const log = debug('mcp:discover');

const FETCH_TIMEOUT_MS = 5000;

interface EntityType {
    id?: string;
    typeName?: string;
    attributeNames?: string[];
}

interface AttributeDetail {
    id?: string;
    attributeName?: string;
    attributeTypes?: string[];
}

interface EntityTypeInfo {
    id?: string;
    typeName?: string;
    entityCount?: number;
    attributeDetails?: AttributeDetail[];
}

async function getJson(url: string): Promise<unknown> {
    const control = new AbortController();
    const timer = setTimeout(() => control.abort(), FETCH_TIMEOUT_MS);
    try {
        const response = await fetch(url, { signal: control.signal, headers: { Accept: 'application/json' } });
        return response.ok ? await response.json() : undefined;
    } catch {
        return undefined;
    } finally {
        clearTimeout(timer);
    }
}

// --- curated model lookup --------------------------------------------------

// The @context maps a short type name onto its URI. A Smart Data Model URI carries
// the subject area and the model name, which is all the raw schema URL needs.
let termCache: Record<string, string> | undefined;

async function contextTerms(): Promise<Record<string, string>> {
    if (termCache) {
        return termCache;
    }
    termCache = {};
    const doc = (await getJson(CONTEXT)) as { '@context'?: unknown } | undefined;
    const ctx = doc?.['@context'];
    const parts = Array.isArray(ctx) ? ctx : [ctx];
    for (const part of parts) {
        if (!part || typeof part !== 'object') continue;
        for (const [term, value] of Object.entries(part as Record<string, unknown>)) {
            if (typeof value === 'string') {
                termCache[term] = value;
            } else if (
                value &&
                typeof value === 'object' &&
                typeof (value as { '@id'?: unknown })['@id'] === 'string'
            ) {
                termCache[term] = (value as { '@id': string })['@id'];
            }
        }
    }
    return termCache;
}

const SDM_URI = /smartdatamodels\.org\/dataModel\.([A-Za-z0-9]+)\/([A-Za-z0-9_-]+)/i;

// dataModel.Agrifood/Animal -> the raw schema.json in the Smart Data Models repo.
async function curatedSchema(typeName: string, typeUri: string | undefined): Promise<JsonSchemaNode | undefined> {
    const uri = typeUri || (await contextTerms())[typeName];
    const match = uri ? SDM_URI.exec(uri) : null;
    if (!match) {
        return undefined;
    }
    const url = `${SDM_BASE_URL}/dataModel.${match[1]}/master/${match[2]}/schema.json`;
    const schema = (await getJson(url)) as JsonSchemaNode | undefined;
    if (schema) {
        log('%s resolved to the curated model at %s', typeName, url);
    }
    return schema;
}

// --- broker introspection --------------------------------------------------

// NGSI-LD reports which attribute types were seen, not what values look like, so the synthesised
// property carries the kind and no base type. `modelTags: profile` marks it low trust in schema.ts.
function synthesise(info: EntityTypeInfo, typeName: string): JsonSchemaNode {
    const properties: Record<string, JsonSchemaNode> = {
        id: { type: 'string', description: 'Unique identifier of the entity.' },
        type: { type: 'string', description: 'NGSI-LD entity type.' }
    };

    for (const attr of info.attributeDetails || []) {
        const name = attr.attributeName;
        if (!name || name === 'id' || name === 'type') continue;
        const kind = attr.attributeTypes?.[0] || 'Property';
        properties[name] = {
            'x-ngsi-type': kind,
            description: `${kind} seen on ${typeName} entities in the broker${attr.id ? ` (${attr.id})` : ''}.`
        };
    }

    return {
        $id: info.id || typeName,
        title: typeName,
        type: 'object',
        modelTags: 'profile',
        description:
            `${typeName} entities as currently held by the Context Broker. No data model is available for this ` +
            `type, so the attribute list below is only what entities carry right now — an attribute no entity ` +
            `has yet will be missing from it.`,
        properties,
        required: ['id', 'type'],
        'x-derivedFrom': { method: 'broker-introspection', instances: info.entityCount ?? 0 }
    };
}

// --- entry point -----------------------------------------------------------

// `curated` is the set of type names SCHEMA_DIR already covers; those are left
// alone, since a curated schema is strictly better than anything found here.
export async function discoverTypes(curated: ReadonlySet<string>): Promise<LoadedSchema[]> {
    let types: EntityType[];
    try {
        const body = await listTypes(true);
        types = Array.isArray(body) ? (body as EntityType[]) : ((body as { typeList?: EntityType[] })?.typeList ?? []);
    } catch (err) {
        log('cannot list broker types: %s', (err as Error).message);
        return [];
    }

    const discovered: LoadedSchema[] = [];
    for (const entry of types) {
        const typeName = entry.typeName || entry.id;
        if (!typeName || curated.has(typeName.toLowerCase())) {
            continue;
        }
        try {
            const info = (await readType(typeName)) as EntityTypeInfo;
            const source = (await curatedSchema(typeName, entry.id || info.id)) ?? synthesise(info, typeName);
            discovered.push(await loadFromSource(typeName, source));
            log('discovered %s (%d entities)', typeName, info.entityCount ?? 0);
        } catch (err) {
            log('skipping %s: %s', typeName, (err as Error).message);
        }
    }
    return discovered;
}

export function resetDiscoveryCache(): void {
    termCache = undefined;
}
