// Shared helpers for tool `execute` handlers: output, error shaping, @context
// stripping, the SCHEMA_VALIDATION policy.

import { z } from 'zod';
import type { ContentResult } from 'fastmcp';
import { VALIDATION, ENTITY_LIMIT } from '../../lib/constants';
import type { EntityPage } from '../../lib/ngsi-ld';
import type { LoadedSchema } from '../../lib/schema';

export function ok(data: unknown): string {
    return JSON.stringify(data, null, 2);
}

// Machine-readable retry signal keyed by HTTP status class. `category` groups the
// failure, `retryable` says whether the same call may later succeed. (When fastmcp
// gains structuredContent this object moves there verbatim.)
export function statusMeta(status: number): { category: string; retryable: boolean } {
    if (status === 404) return { category: 'not_found', retryable: false };
    if (status === 409) return { category: 'conflict', retryable: false };
    if (status === 401 || status === 403) return { category: 'auth', retryable: false };
    if (status === 429) return { category: 'rate_limited', retryable: true };
    if (status >= 400 && status < 500) return { category: 'bad_request', retryable: false };
    if (status >= 500) return { category: 'server', retryable: true };
    return { category: 'unknown', retryable: false };
}

// A failed tool call. The `isError` flag is what tells the client this failed; a
// bare string result never sets it. The same JSON goes in `content` (for clients
// that only read text) and `structuredContent`; a numeric `status` gains
// `category`/`retryable` unless the caller already set them.
export function toolError(payload: Record<string, unknown>): ContentResult {
    const body =
        typeof payload.status === 'number' && !('category' in payload)
            ? { ...payload, ...statusMeta(payload.status) }
            : payload;
    return {
        content: [{ type: 'text', text: JSON.stringify(body, null, 2) }],
        isError: true,
        structuredContent: body
    };
}

// Serialise a validate*/compose outcome: an `{ error }` payload becomes a tool
// error, anything else a success body (shape unchanged).
export function okOrError(res: Record<string, unknown>): string | ContentResult {
    return 'error' in res ? toolError(res) : ok(res);
}

// Lead-in for a generic tool that per-type tools can shadow. Empty when none of
// those typed tools are registered - then the generic tool is not a fallback, it
// is the only option, and "[Fallback] / prefer a typed tool" would mislead.
export function fallbackLead(typedTool: string, types: string[]): string {
    return types.length
        ? `[Fallback] A typed \`${typedTool}\` tool exists for ${types.join(', ')} — prefer it for those ` +
              `types (schema-validated, better documented); use this only for other types. `
        : '';
}

// NGSI-LD standard error types -> HTTP status, so a proxy that keeps the
// ProblemDetails `type` but drops the response status still classifies correctly.
const NGSI_ERROR_STATUS: Record<string, number> = {
    InvalidRequest: 400,
    BadRequestData: 400,
    AlreadyExists: 409,
    OperationNotSupported: 422,
    ResourceNotFound: 404,
    TooComplexQuery: 403,
    TooManyResults: 403,
    LdContextNotAvailable: 503,
    NonexistentTenant: 404,
    InternalError: 500
};

// Shape a thrown broker error. `cause` is the NGSI-LD ProblemDetails body plus the
// HTTP status (lib/ngsi-ld.ts): pull out title/detail/type/status, and when the
// status is missing infer it from the `type`. `toolError` derives category/retryable;
// a thrown error with neither status nor a known type is a network fault.
export function fail(err: unknown): ContentResult {
    const e = err as Error & { cause?: unknown };
    const c = e.cause && typeof e.cause === 'object' ? (e.cause as Record<string, unknown>) : {};
    const detail = typeof c.detail === 'string' && c.detail ? c.detail : undefined;
    const type = typeof c.type === 'string' && c.type ? c.type : undefined;
    const status =
        (typeof c.status === 'number' ? c.status : undefined) ?? NGSI_ERROR_STATUS[type?.split('/').pop() ?? ''];
    return toolError({
        error: (typeof c.title === 'string' && c.title) || e.message || 'Broker request failed',
        ...(detail ? { detail } : {}),
        ...(status ? { status } : {}),
        ...(type ? { type } : {}),
        ...(status === undefined ? { category: 'network', retryable: true } : {})
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

// Wrap a page of list results. `content` carries `_notice` (a "more data" warning
// when matches remain, or a "ran, matched nothing" confirmation on an empty page),
// `pagination` and `entities`; `structuredContent` carries `pagination` alone.
export function okPage(
    entities: unknown[],
    page: EntityPage,
    toolName: string,
    typeLabel: string,
    metadataOnly = false
): ContentResult {
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
    } else if (returned === 0 && !metadataOnly) {
        out._notice =
            `The query executed successfully and matched no ${typeLabel} entities` +
            (offset > 0 ? ` beyond offset ${offset}` : '') +
            `. This is a valid empty result, not an error. If an attribute name in \`q\` or \`pick\` was a guess, ` +
            `confirm it with \`get_entity_type\`.`;
    }
    const pagination = { total, limit, offset, returned, hasMore, nextOffset: hasMore ? nextOffset : null };
    out.pagination = pagination;
    out.entities = entities;
    return {
        content: [{ type: 'text', text: JSON.stringify(out, null, 2) }],
        structuredContent: { pagination }
    };
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
