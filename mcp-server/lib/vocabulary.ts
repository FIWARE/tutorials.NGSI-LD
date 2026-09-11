// ontology://attributes: canonical attribute names plus the NGSI-LD core terms.
// From the loaded schemas and, best effort, the @context at NGSI_LD_CONTEXT.

import debug from 'debug';
import { CONTEXT } from './constants';
import type { LoadedSchema } from './schema';

const log = debug('mcp:vocab');

export interface Vocabulary {
    note: string;
    contextRead: boolean;
    core: Record<string, string>; // maps each term to a one-line meaning
    attributes: string[];
}

// NGSI-LD core-context terms, defined by the core context rather than any data
// model. `id`/`type` are reserved members; `datasetId` is reserved, out of scope here.
const CORE: Record<string, string> = {
    id: 'Unique entity identifier, a URI — conventionally urn:ngsi-ld:<Type>:<name>. Mandatory, immutable, reserved (JSON-LD keyword @id).',
    type: 'Entity type name. Mandatory, immutable, reserved (JSON-LD keyword @type).',
    description: 'Free-text description of the entity — the longer prose companion to title (dcterms:description).',
    title: 'Short human-readable label for the entity (dcterms:title).',
    location: "The entity's primary GeoProperty — value is a GeoJSON geometry.",
    observedAt: 'Sub-attribute of a Property/GeoProperty: ISO8601 UTC timestamp at which the value was observed.',
    unitCode: 'Sub-attribute of a Property: UN/CEFACT Common Code for the unit of a numeric value (e.g. CEL, KGM).'
};

export async function buildVocabulary(schemas: LoadedSchema[]): Promise<Vocabulary> {
    const attributes = new Set<string>();

    for (const s of schemas) {
        for (const name of Object.keys(s.writeAttrs)) {
            if (!(name in CORE)) attributes.add(name);
        }
    }

    const typeNames = new Set(schemas.map((s) => s.typeName.toLowerCase()));
    let contextRead = false;
    try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 3000);
        const body = (await fetch(CONTEXT, { signal: ctrl.signal }).then((r) => r.json())) as {
            '@context'?: Record<string, unknown>;
        };
        clearTimeout(timer);
        for (const [name, val] of Object.entries(body['@context'] ?? {})) {
            if (typeof val !== 'string' || name in CORE || attributes.has(name)) continue;
            // Keep only attribute-looking terms: not a prefix declaration, type
            // alias, enum/vocab value, or OSM building tag.
            if (
                typeNames.has(name.toLowerCase()) ||
                /^[A-Z]/.test(name) ||
                /[/#:]$/.test(val) ||
                /openstreetmap\.org|wikipedia\.org|w3id\.org\/saref#/.test(val)
            ) {
                continue;
            }
            attributes.add(name);
        }
        contextRead = true;
        log('merged %s', CONTEXT);
    } catch (err) {
        log('could not read %s: %s', CONTEXT, (err as Error).message);
    }

    return {
        note:
            'Canonical attribute names for creating and updating entities — use these spellings, do not invent variants. ' +
            "Read ontology://<model>/<type> for an attribute's NGSI-LD type, unit, enum and required/allowed values. " +
            '`core` lists the NGSI-LD core terms, which are in no data model, so each carries a one-line meaning.',
        contextRead,
        core: CORE,
        attributes: [...attributes].sort()
    };
}
