// Shared helpers for tool `execute` handlers: token-lean output, friendly error
// shaping, @context stripping, and the SCHEMA_VALIDATION policy (ARCHITECTURE.md §7, §11).

import { z } from 'zod';
import { VALIDATION, ENTITY_LIMIT } from '../../lib/constants';

export function ok(data: unknown): string {
    return JSON.stringify(data, null, 2);
}

export function fail(err: unknown): string {
    const e = err as Error & { cause?: { detail?: string; status?: number } };
    return JSON.stringify({ error: e.message, detail: e.cause?.detail });
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
            : { error: 'Broker returned entities that do not match the required profile.', details: parsed.error.issues };
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
        return { error: 'Broker returned an entity that does not match the required profile.', details: parsed.error.issues };
    }
    return { data: entity }; // filter mode: nothing to filter for a single entity
}
