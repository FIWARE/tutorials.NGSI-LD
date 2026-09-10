// Shared helpers for tool `execute` handlers: output, error shaping, @context
// stripping, the SCHEMA_VALIDATION policy (ARCHITECTURE.md §7, §11).

import { z } from 'zod';
import type { ContentResult } from 'fastmcp';
import { VALIDATION, ENTITY_LIMIT } from '../../lib/constants';
import type { EntityPage } from '../../lib/ngsi-ld';
import type { LoadedSchema } from '../../lib/schema';

export function ok(data: unknown): string {
    return JSON.stringify(data, null, 2);
}

// A failed tool call. The `isError` flag is what tells the client this failed; a
// bare string result never sets it. Body stays JSON so the agent can still read it.
export function toolError(payload: Record<string, unknown>): ContentResult {
    return { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }], isError: true };
}

// Serialise a validate*/compose outcome: an `{ error }` payload becomes a tool
// error, anything else a success body (shape unchanged).
export function okOrError(res: Record<string, unknown>): string | ContentResult {
    return 'error' in res ? toolError(res) : ok(res);
}

// Shape a thrown broker error. `cause` is the NGSI-LD ProblemDetails body: pull out
// title/detail/type/status, dropping whichever the broker left off.
export function fail(err: unknown): ContentResult {
    const e = err as Error & { cause?: unknown };
    const c = e.cause && typeof e.cause === 'object' ? (e.cause as Record<string, unknown>) : {};
    const detail = typeof c.detail === 'string' && c.detail ? c.detail : undefined;
    const type = typeof c.type === 'string' && c.type ? c.type : undefined;
    const status = typeof c.status === 'number' ? c.status : undefined;
    return toolError({
        error: (typeof c.title === 'string' && c.title) || e.message || 'NGSI-LD request failed',
        ...(detail ? { detail } : {}),
        ...(status ? { status } : {}),
        ...(type ? { type } : {})
    });
}

// Entity members, not writable/removable data attributes.
export const RESERVED_ATTRS = new Set(['id', 'type', '@context']);

// 404 for a missing entity or attribute. Newer brokers set `status` on the body,
// proxied/older ones only put it in the message.
export function is404(err: unknown): boolean {
    const e = err as { cause?: { status?: number }; message?: string };
    return e?.cause?.status === 404 || /\b404\b|not found/i.test(e?.message || '');
}

export function notFound(type: string, id: string, attr?: string): ContentResult {
    return toolError({
        error: attr ? `No ${type} "${id}", or it has no attribute "${attr}"` : `No ${type} found with id ${id}`,
        status: 404
    });
}

// additionalProperty mode: unmodelled attributes are stored inside one JsonProperty.
// Lift its members to the top level on read (a real attribute of the same name wins).
export function spreadAdditionalProperty<T>(entity: T, name: string): T {
    if (!entity || typeof entity !== 'object' || Array.isArray(entity)) return entity;
    const e = entity as Record<string, unknown>;
    const holder = e[name];
    if (holder === undefined || holder === null || typeof holder !== 'object' || Array.isArray(holder)) {
        return entity;
    }
    const h = holder as Record<string, unknown>;
    const bag = (h.json ?? h.value ?? h) as unknown;
    if (!bag || typeof bag !== 'object' || Array.isArray(bag)) return entity;
    const { [name]: _drop, ...rest } = e;
    return { ...(bag as Record<string, unknown>), ...rest } as T;
}

// Read counterpart of spreadAdditionalProperty: rewrite a raw `q` clause on an
// unmodelled attr onto the container (`colour==` -> `additionalProperty[colour]==`).
export function rewriteAdditionalPropertyQuery(
    q: string | undefined,
    modelled: ReadonlySet<string>,
    name: string
): string | undefined {
    if (!q) {
        return q;
    }
    // Split on double quotes: even indices are outside a string value, odd inside.
    const parts = q.split('"');
    for (let i = 0; i < parts.length; i += 2) {
        parts[i] = parts[i].replace(
            /(^|[;|(]\s*)([A-Za-z_][A-Za-z0-9_]*)(?:\.[A-Za-z0-9_]+)*(?:\[[^\]]*\])?/g,
            (m, lead: string, head: string) =>
                head === 'id' || head === 'type' || modelled.has(head) ? m : `${lead}${name}[${head}]`
        );
    }
    return parts.join('"');
}

// Enum matching is case-sensitive. Snap a filter value to the schema term when it
// differs only by case; mutates and returns `filters`.
export function snapEnumCase(
    filters: Record<string, unknown>,
    enumsFor: (attr: string) => string[] | undefined
): Record<string, unknown> {
    for (const [k, v] of Object.entries(filters)) {
        const terms = enumsFor(k);
        if (terms && typeof v === 'string') {
            const hit = terms.find((t) => t.toLowerCase() === v.toLowerCase());
            if (hit) {
                filters[k] = hit;
            }
        }
    }
    return filters;
}

// The attribute name at the head of each `q` clause, ignoring quoted values. Used
// to see which schema attributes a raw query actually touches.
export function queryClauseHeads(q: string | undefined): string[] {
    if (!q) {
        return [];
    }
    const heads: string[] = [];
    const parts = q.split('"');
    for (let i = 0; i < parts.length; i += 2) {
        for (const m of parts[i].matchAll(/(?:^|[;|(]\s*)([A-Za-z_][A-Za-z0-9_]*)/g)) {
            heads.push(m[1]);
        }
    }
    return heads;
}

// Core-context terms valid on any entity even when a schema omits them.
export const CORE_ENTITY_ATTRS = new Set(['description', 'title', 'location']);

// The attribute is in the type's schema or is a core term; the UNKNOWN_ATTRIBUTES
// policy does not apply to it.
export const isKnownAttr = (name: string, schema: LoadedSchema): boolean =>
    name in schema.writeAttrs || CORE_ENTITY_ATTRS.has(name);

// Projection counterpart of rewriteAdditionalPropertyQuery: `pick` returns only the
// named members, so add the container when a picked name is unmodelled (or `modelled` null).
export function pickWithAdditionalProperty(
    pick: string | undefined,
    modelled: ReadonlySet<string> | null,
    name: string
): string | undefined {
    if (!pick) {
        return pick;
    }
    const names = pick
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    if (names.includes(name)) {
        return pick;
    }
    const needsContainer = modelled === null || names.some((n) => n !== 'id' && n !== 'type' && !modelled.has(n));
    return needsContainer ? [...names, name].join(',') : pick;
}

export function stripContext<T>(payload: T): T {
    if (Array.isArray(payload)) {
        return payload.map((p) => stripContext(p)) as unknown as T;
    }
    if (payload && typeof payload === 'object') {
        const rest = { ...(payload as Record<string, unknown>) };
        delete rest['@context'];
        return rest as T;
    }
    return payload;
}

export function clampLimit(limit?: number): number {
    if (!limit || limit < 1) {
        return ENTITY_LIMIT;
    }
    return Math.min(limit, ENTITY_LIMIT);
}

// Wrap a page of list results so the agent cannot mistake the first page for the whole
// set: `_notice` leads the JSON when matches remain, `pagination` has `hasMore`/`nextOffset`.
export function okPage(
    entities: unknown[],
    page: EntityPage,
    toolName: string,
    typeLabel: string,
    metadataOnly = false
): string {
    const { total, limit, offset, returned } = page;
    const nextOffset = offset + limit;
    const hasMore = total === null ? returned >= limit : total > offset + returned;

    const out: Record<string, unknown> = {};
    // A metadata-only call asked for no bodies, so the "paginate for more" notice
    // would just be noise.
    if (hasMore && !metadataOnly) {
        out._notice =
            (total === null
                ? `MORE DATA LIKELY: ${returned} ${typeLabel} entities returned and the page was full`
                : `MORE DATA AVAILABLE: returned ${returned} of ${total} matching ${typeLabel} entities`) +
            `. Do not treat this as the complete set. Call ${toolName} again with offset=${nextOffset} for the ` +
            `next page, or add filters / narrow \`pick\` to reduce the result count.`;
    }
    out.pagination = { total, limit, offset, returned, hasMore, nextOffset: hasMore ? nextOffset : null };
    out.entities = entities;
    return JSON.stringify(out, null, 2);
}

type ListOutcome = { data: unknown[] } | { error: string; details: unknown };
type OneOutcome = { data: unknown } | { error: string; details: unknown };

export function validateList(entities: unknown[], validator: z.ZodTypeAny): ListOutcome {
    if (VALIDATION === 'off') {
        return { data: entities };
    }
    if (VALIDATION === 'strict') {
        const parsed = z.array(validator).safeParse(entities);
        return parsed.success
            ? { data: parsed.data }
            : {
                  error: 'Broker returned entities that do not match the required profile.',
                  details: parsed.error.issues
              };
    }
    // filter mode: keep the records that pass
    return { data: entities.filter((e) => validator.safeParse(e).success) };
}

export function validateOne(entity: unknown, validator: z.ZodTypeAny): OneOutcome {
    if (VALIDATION === 'off') {
        return { data: entity };
    }
    const parsed = validator.safeParse(entity);
    if (parsed.success) {
        return { data: parsed.data };
    }
    if (VALIDATION === 'strict') {
        return {
            error: 'Broker returned an entity that does not match the required profile.',
            details: parsed.error.issues
        };
    }
    return { data: entity }; // filter mode: nothing to filter for a single entity
}
