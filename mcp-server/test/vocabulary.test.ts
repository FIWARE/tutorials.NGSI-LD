import { describe, it, expect } from 'vitest';
import { buildVocabulary } from '../lib/vocabulary';
import { loadSchemas } from '../lib/schema';

describe('buildVocabulary', () => {
    it('lists the NGSI-LD core terms with a one-line meaning', async () => {
        const v = await buildVocabulary([]);
        expect(v.core.description).toMatch(/dcterms:description/);
        expect(v.core.title).toMatch(/dcterms:title/);
        expect(v.core.unitCode).toMatch(/UN\/CEFACT/);
        expect(Object.keys(v.core)).toEqual(
            expect.arrayContaining(['id', 'type', 'description', 'title', 'location', 'observedAt', 'unitCode'])
        );
    });

    it('exposes one sorted list of attribute names — no per-attribute metadata, commons included', async () => {
        const v = await buildVocabulary(await loadSchemas());
        expect(Array.isArray(v.attributes)).toBe(true);
        expect(v.attributes.every((a) => typeof a === 'string')).toBe(true);
        expect(v.attributes).toEqual(expect.arrayContaining(['species', 'ownedBy', 'weight', 'name', 'dateCreated']));
        expect(v.attributes).toEqual([...v.attributes].sort());
    });

    it('keeps the core terms out of the attributes list', async () => {
        const v = await buildVocabulary(await loadSchemas());
        expect(v.attributes).not.toContain('id');
        expect(v.attributes).not.toContain('type');
        expect(v.attributes).not.toContain('description');
    });

    it('still returns a usable vocab when the @context URL is unreachable', async () => {
        const v = await buildVocabulary(await loadSchemas());
        expect(v.contextRead).toBe(false);
        expect(v.attributes.length).toBeGreaterThan(5);
    });
});
