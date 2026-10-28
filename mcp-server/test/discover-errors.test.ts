import { describe, it, expect } from 'vitest';
import type { ContentResult } from 'fastmcp';
import { settleDiscovery } from '../controllers/tools/context-discovery';

const asError = (r: string | ContentResult) => {
    expect(typeof r).not.toBe('string');
    const e = r as ContentResult;
    return { isError: e.isError, body: JSON.parse((e.content[0] as { text: string }).text) };
};

describe('settleDiscovery', () => {
    it('returns a plain success when no kind failed', () => {
        const out = settleDiscovery({ enums: { status: ['on', 'off'] }, relationships: {} });

        expect(typeof out).toBe('string');
        expect(JSON.parse(out as string)).toEqual({ enums: { status: ['on', 'off'] }, relationships: {} });
    });

    it('treats an empty enum list or empty record as data, not an error', () => {
        expect(typeof settleDiscovery({ enums: [] })).toBe('string');
        expect(typeof settleDiscovery({})).toBe('string');
    });

    it('fails an unsupported pick as a bad_request', () => {
        const { isError, body } = asError(
            settleDiscovery({ foo: { error: 'Unsupported pick value "foo". Supported: live_data, enums.' } })
        );

        expect(isError).toBe(true);
        expect(body).toMatchObject({ error: expect.stringContaining('foo: Unsupported pick value'), status: 400 });
        expect(body.category).toBe('bad_request');
        expect(body.retryable).toBe(false);
    });

    it('fails a missing live item as not_found and keeps what succeeded under results', () => {
        const { isError, body } = asError(
            settleDiscovery({
                types: { error: 'No entity type "Thing" on the broker', status: 404 },
                enums: { status: ['on'] },
                ontology: 'ontology://m/Thing'
            })
        );

        expect(isError).toBe(true);
        expect(body.category).toBe('not_found');
        expect(body.retryable).toBe(false);
        expect(body.results).toEqual({ enums: { status: ['on'] }, ontology: 'ontology://m/Thing' });
    });

    it('carries a broker failure through with its own category and retryability', () => {
        const { isError, body } = asError(
            settleDiscovery({ types: { error: 'fetch failed', category: 'network', retryable: true } })
        );

        expect(isError).toBe(true);
        expect(body).toMatchObject({ category: 'network', retryable: true });
        expect(body.status).toBeUndefined();
    });

    it('names every failed kind in the message and omits results when nothing else succeeded', () => {
        const { body } = asError(
            settleDiscovery({
                types: { error: 'No entity type "X" on the broker', status: 404 },
                attributes: { error: 'No attribute "X" on the broker', status: 404 }
            })
        );

        expect(body.error).toBe('types: No entity type "X" on the broker; attributes: No attribute "X" on the broker');
        expect(body.results).toBeUndefined();
    });

    it('does not mistake a string field named description for a failure', () => {
        const out = settleDiscovery({ relationship: false, property: true, description: 'A number.' });

        expect(typeof out).toBe('string');
    });
});
