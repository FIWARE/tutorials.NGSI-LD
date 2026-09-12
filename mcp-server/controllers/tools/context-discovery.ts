// Context discovery, all through one tool: the broker's /types and /attributes, plus
// the schema-derived enum/relationship/property maps. Broker responses validate against ngsi-schemas/*.json.

import type { FastMCP } from 'fastmcp';
import { z } from 'zod';
import { listTypes, readType, listAttributes, readAttribute } from '../../lib/ngsi-ld';
import type { CoreSchemas } from '../../lib/core-schema';
import type { EnumMap } from '../../lib/enums';
import type { AttrDescMap, AttrInfo } from '../../lib/relationships';
import { ok, fail, stripContext, validateOne } from './util';

const NOT_FOUND = /\b404\b|not found/i;

// Every `pick` value this tool understands. An unrecognised one comes back as a
// per-key error, not a thrown one.
const KINDS = ['live_data', 'enums', 'relationships', 'properties'] as const;

export interface DiscoveryMaps {
    core: CoreSchemas;
    enums: EnumMap;
    relationships: AttrDescMap;
    properties: AttrDescMap;
    typeNames: string[];
    ontologyLinks: Record<string, string>; // typeName -> its ontology://<model>/<type> URI
}

async function fetchTypes(core: CoreSchemas, name: string | undefined, compact: boolean): Promise<unknown> {
    try {
        if (name) {
            const body = stripContext(await readType(name));
            const outcome = validateOne(body, core.EntityTypeInfo.validator);
            return 'error' in outcome ? outcome : outcome.data;
        }
        const wantDetails = !compact;
        const body = stripContext(await listTypes(wantDetails));
        const validator = wantDetails ? z.array(core.EntityType.validator) : core.EntityTypeList.validator;
        const outcome = validateOne(body, validator);
        return 'error' in outcome ? outcome : outcome.data;
    } catch (err) {
        if (name && NOT_FOUND.test((err as Error).message)) {
            return { error: `No entity type "${name}" on the broker`, status: 404 };
        }
        return fail(err).structuredContent;
    }
}

async function fetchAttributes(core: CoreSchemas, name: string | undefined, compact: boolean): Promise<unknown> {
    try {
        if (name) {
            const body = stripContext(await readAttribute(name));
            const outcome = validateOne(body, core.Attribute.validator);
            return 'error' in outcome ? outcome : outcome.data;
        }
        const wantDetails = !compact;
        const body = stripContext(await listAttributes(wantDetails));
        const validator = wantDetails ? z.array(core.Attribute.validator) : core.AttributeList.validator;
        const outcome = validateOne(body, validator);
        return 'error' in outcome ? outcome : outcome.data;
    } catch (err) {
        if (name && NOT_FOUND.test((err as Error).message)) {
            return { error: `No attribute "${name}" on the broker`, status: 404 };
        }
        return fail(err).structuredContent;
    }
}

// Shared by enums/relationships/properties: a synchronous lookup into a map built
// at start-up. No name returns the whole map; a matching name unwraps just that type's.
function fetchTypeKeyed<T>(map: Record<string, T>, name: string | undefined): unknown {
    if (!name) {
        return map;
    }
    const match = Object.keys(map).find((t) => t.toLowerCase() === name.toLowerCase());
    if (!match) {
        return { error: `No schema loaded for type "${name}"`, status: 404 };
    }
    return map[match];
}

// A `name` that isn't a type is tried as an attribute instead: the union of its
// enumerated values across every type that has it. Not enumerated anywhere is `[]`, never an error.
function fetchEnumValues(enums: EnumMap, attr: string): string[] {
    const lower = attr.toLowerCase();
    const values: string[] = [];
    const seen = new Set<string>();
    for (const attrs of Object.values(enums)) {
        for (const [name, vals] of Object.entries(attrs)) {
            if (name.toLowerCase() !== lower) continue;
            for (const v of vals) {
                if (!seen.has(v)) {
                    seen.add(v);
                    values.push(v);
                }
            }
        }
    }
    return values;
}

function findAttrIn(map: AttrDescMap, attr: string): AttrInfo | undefined {
    const lower = attr.toLowerCase();
    for (const attrs of Object.values(map)) {
        for (const [name, info] of Object.entries(attrs)) {
            if (name.toLowerCase() === lower) {
                return info;
            }
        }
    }
    return undefined;
}

// A `name` that isn't a type is tried as an attribute instead: relationships and
// properties are a strict split, so its record lives in exactly one map. Neither has it? `{}`, not an error.
function fetchAttrInfo(
    relationships: AttrDescMap,
    properties: AttrDescMap,
    attr: string
): AttrInfo | Record<string, never> {
    return findAttrIn(relationships, attr) ?? findAttrIn(properties, attr) ?? {};
}

export function registerContextDiscoveryTools(server: FastMCP, maps: DiscoveryMaps): void {
    const { core, enums, relationships, properties, typeNames, ontologyLinks } = maps;
    const knownTypes = new Set(typeNames.map((t) => t.toLowerCase()));

    server.addTool({
        name: 'discover_context_meta_data',
        annotations: { readOnlyHint: true, openWorldHint: false },
        description:
            'Look up what exists right now — call this before guessing a name in `q`/`pick`, before writing, or ' +
            'before filtering an enumerated attribute. `pick` selects what to return (see its own description); ' +
            '`name` drills into one item instead of listing every one; `compact` trims a non-drilled-into ' +
            '"live_data" listing to just names. Response is one JSON object keyed by kind — "live_data" gives ' +
            '"types"/"attributes", plus an "ontology"/"ontologies" link to the full modelled schema (required ' +
            "attributes, units, nested structure) for when this tool's own data is not enough.",
        parameters: z.object({
            pick: z
                .string()
                .optional()
                .describe(
                    'Comma-separated: "live_data" (types + attributes as currently seen on the broker), "enums" ' +
                        '(enumerated attribute values per type), "relationships" (attributes pointing to another ' +
                        'entity, `{relationship, property, description}` per type), "properties" (every other ' +
                        'data-bearing attribute, same shape). The three schema-derived kinds are always complete, ' +
                        'even before anything is populated. Omit for all four.'
                ),
            name: z
                .string()
                .optional()
                .describe(
                    'Drill into just this one item instead of listing every one, e.g. "Animal" or "temperature". ' +
                        'Tried as a type name first — for "live_data" that\'s the entity type\'s full broker ' +
                        "detail, for the schema-derived kinds that type's map with no type-name wrapper. Anything " +
                        'else is tried as an attribute name instead: "live_data" its broker detail, "enums" the ' +
                        'union of its values as a bare array, "relationships"/"properties" its ' +
                        '`{relationship, property, description}` record merged into the top level. None of these ' +
                        'error when nothing matches (`{}`/`[]` instead) — an attribute simply not being that kind ' +
                        'is a real answer.'
                ),
            compact: z
                .boolean()
                .optional()
                .describe('For a non-drilled-into "live_data" listing, return just the names, without per-item detail.')
        }),
        execute: async ({ pick, name, compact }) => {
            const requested = (pick ?? '')
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean);
            const kinds = [...new Set(requested.length ? requested : KINDS)];
            const result: Record<string, unknown> = {};
            for (const kind of kinds) {
                if (kind === 'live_data') {
                    if (!name) {
                        result.types = await fetchTypes(core, undefined, compact === true);
                        result.attributes = await fetchAttributes(core, undefined, compact === true);
                        if (Object.keys(ontologyLinks).length) {
                            result.ontologies = ontologyLinks;
                        }
                    } else if (knownTypes.has(name.toLowerCase())) {
                        result.types = await fetchTypes(core, name, compact === true);
                        const match = typeNames.find((t) => t.toLowerCase() === name.toLowerCase());
                        if (match) {
                            result.ontology = ontologyLinks[match];
                        }
                    } else {
                        result.attributes = await fetchAttributes(core, name, compact === true);
                    }
                } else if (kind === 'enums') {
                    result.enums =
                        !name || knownTypes.has(name.toLowerCase())
                            ? fetchTypeKeyed(enums, name)
                            : fetchEnumValues(enums, name);
                } else if (kind === 'relationships' || kind === 'properties') {
                    if (!name || knownTypes.has(name.toLowerCase())) {
                        result[kind] = fetchTypeKeyed(kind === 'relationships' ? relationships : properties, name);
                    } else if (!('description' in result)) {
                        // Flat, not nested — the caller asked for one attribute's info, not a
                        // "relationships"/"properties" envelope around it.
                        Object.assign(result, fetchAttrInfo(relationships, properties, name));
                    }
                } else {
                    result[kind] = { error: `Unsupported pick value "${kind}". Supported: ${KINDS.join(', ')}.` };
                }
            }
            return ok(result);
        }
    });
}
