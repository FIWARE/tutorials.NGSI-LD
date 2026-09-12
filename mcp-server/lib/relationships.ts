// Backs the `relationships`/`properties` kinds of discover_context_meta_data: every
// attribute, split by NGSI-LD kind and flagged accordingly, built once at start-up.

import type { LoadedSchema } from './schema';

export interface AttrInfo {
    relationship: boolean;
    property: boolean;
    description: string;
}

export type AttrDescMap = Record<string, Record<string, AttrInfo>>;

// Relationship and ListRelationship are graph edges; every other attribute type
// carries a value, so "properties" just means anything that isn't one of these.
const RELATIONSHIP_TYPES = new Set(['Relationship', 'ListRelationship']);

function buildByKind(schemas: LoadedSchema[], isMatch: (ngsiType: string) => boolean): AttrDescMap {
    const out: AttrDescMap = {};
    for (const s of schemas) {
        const attrs: Record<string, AttrInfo> = {};
        for (const [name, wa] of Object.entries(s.writeAttrs)) {
            if (isMatch(wa.ngsiType)) {
                const relationship = RELATIONSHIP_TYPES.has(wa.ngsiType);
                attrs[name] = { relationship, property: !relationship, description: wa.description };
            }
        }
        out[s.typeName] = attrs;
    }
    return out;
}

export function buildRelationships(schemas: LoadedSchema[]): AttrDescMap {
    return buildByKind(schemas, (t) => RELATIONSHIP_TYPES.has(t));
}

export function buildProperties(schemas: LoadedSchema[]): AttrDescMap {
    return buildByKind(schemas, (t) => !RELATIONSHIP_TYPES.has(t));
}
