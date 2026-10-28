// Context discovery, all through one tool: the broker's /types and /attributes, plus
// the schema-derived enum/relationship/property maps. Broker responses validate against ngsi-schemas/*.json.

import type { ContentResult, FastMCP } from 'fastmcp';
import { z } from 'zod';
import { listTypes, readType, listAttributes, readAttribute } from '../../lib/ngsi-ld';
import type { CoreSchemas } from '../../lib/core-schema';
import type { EnumMap } from '../../lib/enums';
import type { AttrDescMap, AttrInfo } from '../../lib/relationships';
import type { SchemaRegistry } from '../../lib/registry';
import { withSession, type Session } from '../../lib/session';
import { ok, fail, toolError, stripContext, validateOne, nearMatches } from './util';

const NOT_FOUND = /\b404\b|not found/i;

// Every `pick` value this tool understands. An unrecognised one comes back as a
// per-key error, not a thrown one.
const KINDS = ['live_data', 'enums', 'relationships', 'properties'] as const;

export interface DiscoveryMaps {
    core: CoreSchemas;
    registry: SchemaRegistry;
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

// A kind that failed (bad `pick`, broker error, missing item) is an error, not data: the call
// fails with the first failure's status/category, and whatever else succeeded rides along under `results`.
export function settleDiscovery(result: Record<string, unknown>): string | ContentResult {
    const failed: [string, Record<string, unknown>][] = [];
    const rest: Record<string, unknown> = {};
    for (const [kind, value] of Object.entries(result)) {
        if (value && typeof value === 'object' && typeof (value as { error?: unknown }).error === 'string') {
            failed.push([kind, value as Record<string, unknown>]);
        } else {
            rest[kind] = value;
        }
    }
    if (!failed.length) {
        return ok(result);
    }
    const { error: _first, ...meta } = failed[0][1];
    return toolError({
        error: failed.map(([kind, e]) => `${kind}: ${e.error}`).join('; '),
        // No status or category on the failure (an unsupported `pick`) means the arguments were wrong.
        ...('status' in meta || 'category' in meta ? meta : { status: 400 }),
        ...(Object.keys(rest).length ? { results: rest } : {})
    });
}

export function registerContextDiscoveryTools(server: FastMCP<Session>, maps: DiscoveryMaps): void {
    const { core, registry } = maps;

    server.addTool({
        name: 'discover_context_meta_data',
        annotations: { title: 'Discover data model', readOnlyHint: true, openWorldHint: false },
        description:
            'Look up the data model and what is currently stored. Use it to confirm type names, attribute names and ' +
            'enumerated values before writing a `filter`, `pick` or a write; do not guess them. Set `name`: with ' +
            'none it lists every type and can cost thousands of tokens (add `compact` for names only). "enums", ' +
            '"relationships" and "properties" come from the loaded schema and are always complete; "live_data" ' +
            'shows what the broker holds now and can lag. An "ontology" link points to the full schema.',
        parameters: z.object({
            pick: z
                .string()
                .optional()
                .describe(
                    'Comma-separated, no other separator; spaces after the comma are fine. Values: "live_data" ' +
                        '(types and attributes currently on the broker), "enums" (allowed values for enumerated ' +
                        'attributes, per type), "relationships" (attributes that link to another entity, ' +
                        '`{relationship, property, description}` per type), "properties" (every other ' +
                        'data-bearing attribute, same shape). The three schema-derived kinds are always complete, ' +
                        'even before anything is stored. Omit for all four, which is the largest response.'
                ),
            name: z
                .string()
                .optional()
                .describe(
                    'Narrow to one item. A type name (case-insensitive) returns that type\'s entry; any other value ' +
                        'is tried as an attribute name. For "enums", "relationships" and "properties" no match ' +
                        'returns `[]` or `{}`, so an empty answer may mean a wrong name. For "live_data" a missing ' +
                        'type or attribute is a not_found error.'
                ),
            compact: z
                .boolean()
                .optional()
                .describe(
                    'Only affects an unscoped "live_data" listing: return names only, without per-item detail. ' +
                        'Ignored when `name` is set and for "enums", "relationships" and "properties".'
                ),
            refresh: z
                .boolean()
                .optional()
                .describe(
                    'Re-read the entity types from the broker before answering. Without it the server refreshes ' +
                        'only when its cached copy is stale. Use after new entity types have been created, or when ' +
                        'a type you expect is missing from "enums"/"relationships"/"properties".'
                )
        }),
        execute: withSession(async ({ pick, name, compact, refresh }) => {
            if (refresh) {
                await registry.refresh();
            } else {
                await registry.refreshIfStale();
            }
            const { enums, relationships, properties, typeNames, ontologyLinks } = registry.get();
            const knownTypes = new Set(typeNames.map((t) => t.toLowerCase()));
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
            if (name && !knownTypes.has(name.toLowerCase())) {
                const live = result.attributes as Record<string, unknown> | undefined;
                const inSchema =
                    findAttrIn(relationships, name) || findAttrIn(properties, name) || fetchEnumValues(enums, name).length;
                // Neither a type nor an attribute anywhere: an empty answer here is more likely a wrong name than a real absence.
                if (!inSchema && !(live && !('error' in live))) {
                    const attrNames = [relationships, properties].flatMap((m) => Object.values(m).flatMap(Object.keys));
                    const near = nearMatches(name, [...typeNames, ...attrNames]);
                    result._hint = near.length
                        ? `No type or attribute named "${name}". Did you mean: ${near.join(', ')}?`
                        : `No type or attribute named "${name}". Call without \`name\` and with pick="live_data", compact=true to list the types.`;
                }
            }
            return settleDiscovery(result);
        })
    });
}
