// Shared helpers for tool `execute` handlers: token-lean output, friendly error
// shaping, @context stripping, and the SCHEMA_VALIDATION policy (ARCHITECTURE.md §7, §11).

import { z } from 'zod';
import { VALIDATION, ENTITY_LIMIT } from '../../lib/constants';
import type { EntityPage } from '../../lib/ngsi-ld';

export function ok(data: unknown): string {
    return JSON.stringify(data, null, 2);
}

export function fail(err: unknown): string {
    const e = err as Error & { cause?: { detail?: string; status?: number } };
    return JSON.stringify({ error: e.message, detail: e.cause?.detail });
}

// Entity members, not writable/removable data attributes.
export const RESERVED_ATTRS = new Set(['id', 'type', '@context']);

// NGSI-LD answers a missing entity or attribute with 404: the ProblemDetails body
// carries `status`, proxied/older paths only leave it in the message.
export function is404(err: unknown): boolean {
    const e = err as { cause?: { status?: number }; message?: string };
    return e?.cause?.status === 404 || /\b404\b|not found/i.test(e?.message || '');
}

export function notFound(type: string, id: string, attr?: string): string {
    return JSON.stringify({
        error: attr ? `No ${type} "${id}", or it has no attribute "${attr}"` : `No ${type} found with id ${id}`
    });
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

// Wrap a page of list results so the agent cannot silently mistake the first
// page for the whole result set. When the broker holds more matches than this
// page returned, a `_notice` string is emitted as the first key — so it is the
// first line of the pretty-printed JSON the model reads — and `pagination`
// carries the machine-readable `hasMore` / `nextOffset`.
//
// `page.returned` is the broker's pre-validation row count; `entities` is the
// payload actually emitted (which SCHEMA_VALIDATION=filter may have shrunk).
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
    // A metadata-only call asked for no bodies on purpose — the "you didn't get
    // everything, paginate" notice would be noise.
    if (hasMore && !metadataOnly) {
        out._notice =
            (total === null
                ? `MORE DATA LIKELY: ${returned} ${typeLabel} entities returned and the page was full`
                : `MORE DATA AVAILABLE: returned ${returned} of ${total} matching ${typeLabel} entities`) +
            `. Do not treat this as the complete set — call ${toolName} again with offset=${nextOffset} for the ` +
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
    // filter: drop the records that fail, keep the rest
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
