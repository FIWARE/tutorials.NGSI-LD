import { describe, it, expect } from 'vitest';
import { normalizeAttribute } from '../lib/normalize';
import { loadOne } from '../lib/schema';
import type { WriteAttr } from '../lib/schema';

const prop = (o: Partial<WriteAttr> = {}): WriteAttr => ({ ngsiType: 'Property', observedAt: false, ...o });

describe('normalizeAttribute', () => {
    it('wraps a scalar as a Property', () => {
        expect(normalizeAttribute('legalId', 'ES-1', prop())).toEqual({ type: 'Property', value: 'ES-1' });
    });

    it('applies the schema unitCode to a Property', () => {
        expect(normalizeAttribute('weight', 640, prop({ unitCode: 'KGM' }))).toEqual({
            type: 'Property',
            value: 640,
            unitCode: 'KGM'
        });
    });

    it('lets the caller override the unitCode', () => {
        const n = normalizeAttribute('weight', 1410, prop({ unitCode: 'KGM' }), { unitCode: 'LBR' });
        expect(n.unitCode).toBe('LBR');
    });

    it('encodes a Relationship value as an object URN', () => {
        expect(normalizeAttribute('ownedBy', 'urn:ngsi-ld:Person:1', prop({ ngsiType: 'Relationship' }))).toEqual({
            type: 'Relationship',
            object: 'urn:ngsi-ld:Person:1'
        });
    });

    it('encodes a VocabProperty value as a vocab term', () => {
        expect(normalizeAttribute('sex', 'male', prop({ ngsiType: 'VocabProperty' }))).toEqual({
            type: 'VocabProperty',
            vocab: 'male'
        });
    });

    it('maps every NGSI-LD attribute type to its value-bearing member', () => {
        expect(normalizeAttribute('a', { en: 'hi' }, prop({ ngsiType: 'LanguageProperty' }))).toEqual({
            type: 'LanguageProperty',
            languageMap: { en: 'hi' }
        });
        expect(normalizeAttribute('a', [1, 2, 3], prop({ ngsiType: 'ListProperty' }))).toEqual({
            type: 'ListProperty',
            valueList: [1, 2, 3]
        });
        expect(normalizeAttribute('a', ['urn:a', 'urn:b'], prop({ ngsiType: 'ListRelationship' }))).toEqual({
            type: 'ListRelationship',
            objectList: ['urn:a', 'urn:b']
        });
        expect(normalizeAttribute('a', { k: 1 }, prop({ ngsiType: 'JsonProperty' }))).toEqual({
            type: 'JsonProperty',
            json: { k: 1 }
        });
    });

    it('keeps an object value under `value` for a Property (concise form)', () => {
        expect(normalizeAttribute('address', { city: 'Berlin', street: 'Ulrich Strasse' }, prop())).toEqual({
            type: 'Property',
            value: { city: 'Berlin', street: 'Ulrich Strasse' }
        });
    });

    it('accepts a full GeoJSON object for a GeoProperty', () => {
        const geo = { type: 'Point', coordinates: [54.112, 0.334] };
        expect(normalizeAttribute('location', geo, prop({ ngsiType: 'GeoProperty' }))).toEqual({
            type: 'GeoProperty',
            value: geo
        });
    });

    it('expands a bare [lng, lat] array into a GeoJSON Point', () => {
        expect(normalizeAttribute('location', [54.112, 0.334], prop({ ngsiType: 'GeoProperty' }))).toEqual({
            type: 'GeoProperty',
            value: { type: 'Point', coordinates: [54.112, 0.334] }
        });
    });

    it('applies unitCode to a ListProperty as well as a Property', () => {
        expect(normalizeAttribute('a', [1, 2], prop({ ngsiType: 'ListProperty', unitCode: 'CEL' })).unitCode).toBe('CEL');
        expect(normalizeAttribute('a', 'x', prop({ ngsiType: 'Relationship', unitCode: 'CEL' })).unitCode).toBeUndefined();
    });

    it('stamps observedAt when the schema marks the attribute x-observedAt', () => {
        const n = normalizeAttribute('heartRate', 52, prop({ observedAt: true, unitCode: '5K' }));
        expect(n.type).toBe('Property');
        expect(typeof n.observedAt).toBe('string');
    });

    it('does not stamp observedAt on a static attribute', () => {
        expect(normalizeAttribute('species', 'cow', prop()).observedAt).toBeUndefined();
    });

    it('stamps observedAt on location only when the entity is x-mobile', () => {
        const spec = prop({ ngsiType: 'GeoProperty' });
        expect(normalizeAttribute('location', {}, spec, { mobile: false }).observedAt).toBeUndefined();
        expect(normalizeAttribute('location', {}, spec, { mobile: true }).observedAt).toBeDefined();
    });

    it('honours a caller-supplied observedAt over the default now', () => {
        const n = normalizeAttribute('weight', 640, prop({ observedAt: true }), { observedAt: '2026-01-01T00:00:00Z' });
        expect(n.observedAt).toBe('2026-01-01T00:00:00Z');
    });

    it('attaches providedBy only to asserted measurements', () => {
        const opts = { providedBy: 'urn:ngsi-ld:ContextSource:mcp-01' };
        expect(normalizeAttribute('heartRate', 52, prop({ observedAt: true }), opts).providedBy).toEqual({
            type: 'Relationship',
            object: 'urn:ngsi-ld:ContextSource:mcp-01'
        });
        expect(normalizeAttribute('legalId', 'ES-1', prop(), opts).providedBy).toBeUndefined();
    });

    it('falls back to Property when the attribute is unknown to the schema', () => {
        expect(normalizeAttribute('vetNotes', 'checkup', undefined)).toEqual({ type: 'Property', value: 'checkup' });
    });

    it('with no schema, infers a Relationship from a urn:ngsi-ld: value', () => {
        expect(normalizeAttribute('ownedBy', 'urn:ngsi-ld:Person:1', undefined)).toEqual({
            type: 'Relationship',
            object: 'urn:ngsi-ld:Person:1'
        });
    });

    it('with no schema, infers a GeoProperty from a GeoJSON geometry', () => {
        const geo = { type: 'Point', coordinates: [13.3, 52.5] };
        expect(normalizeAttribute('location', geo, undefined)).toEqual({ type: 'GeoProperty', value: geo });
    });

    it('with no schema, passes an already-typed node straight through', () => {
        const node = { type: 'Relationship', object: 'urn:ngsi-ld:Person:1', datasetId: 'urn:x' };
        expect(normalizeAttribute('ownedBy', node, undefined)).toBe(node);
    });

    it('with a schema, wraps the value even if it looks like a node (schema wins)', () => {
        // pass-through is only for the schema-less generic path
        expect(normalizeAttribute('meta', { type: 'Property', value: 1 }, prop({ ngsiType: 'JsonProperty' }))).toEqual({
            type: 'JsonProperty',
            json: { type: 'Property', value: 1 }
        });
    });

    it('unpacks a concise-read Property object rather than double-wrapping it', () => {
        expect(
            normalizeAttribute(
                'weight',
                { value: 118, unitCode: 'KGM', observedAt: '2026-01-01T00:00:00Z' },
                prop({ ngsiType: 'Property', unitCode: 'KGM', observedAt: true })
            )
        ).toEqual({ type: 'Property', value: 118, unitCode: 'KGM', observedAt: '2026-01-01T00:00:00Z' });
    });

    it('lifts observedAt from a concise value but a caller override still wins', () => {
        const n = normalizeAttribute('heartRate', { value: 52, observedAt: '2026-01-01T00:00:00Z' }, prop({ observedAt: true }), {
            observedAt: '2025-12-31T00:00:00Z'
        });
        expect(n).toMatchObject({ type: 'Property', value: 52, observedAt: '2025-12-31T00:00:00Z' });
    });

    it('unpacks the NGSI-specific concise members without needing a metadata sibling', () => {
        expect(normalizeAttribute('ownedBy', { object: 'urn:ngsi-ld:Person:1' }, prop({ ngsiType: 'Relationship' }))).toEqual(
            { type: 'Relationship', object: 'urn:ngsi-ld:Person:1' }
        );
        expect(normalizeAttribute('sex', { vocab: 'male' }, prop({ ngsiType: 'VocabProperty' }))).toEqual({
            type: 'VocabProperty',
            vocab: 'male'
        });
        expect(normalizeAttribute('extra', { json: { a: 1 } }, prop({ ngsiType: 'JsonProperty' }))).toEqual({
            type: 'JsonProperty',
            json: { a: 1 }
        });
    });

    it('does not treat a bare { value } with no metadata as concise (could be literal data)', () => {
        expect(normalizeAttribute('config', { value: 42 }, prop())).toEqual({
            type: 'Property',
            value: { value: 42 }
        });
    });

    it('does not touch a plain multi-key object value', () => {
        expect(
            normalizeAttribute('address', { city: 'Berlin', value: 'x' }, prop())
        ).toEqual({ type: 'Property', value: { city: 'Berlin', value: 'x' } });
    });
});

describe('loadOne — write encoding hints', () => {
    it('derives writeAttrs and x-mobile for Animal', async () => {
        const s = await loadOne('Animal.json');
        expect(s.mobile).toBe(true);
        expect(s.writeAttrs.weight).toMatchObject({ ngsiType: 'Property', unitCode: 'KGM', observedAt: true });
        expect(s.writeAttrs.ownedBy).toMatchObject({ ngsiType: 'Relationship' });
        expect(s.writeAttrs.sex).toMatchObject({ ngsiType: 'VocabProperty' });
        expect(s.writeAttrs.species).toMatchObject({ ngsiType: 'Property' });
        expect(s.writeAttrs.species.enumValues).toContain('dairy cattle');
    });

    it('leaves x-mobile false for a fixed type', async () => {
        const s = await loadOne('Building.json');
        expect(s.mobile).toBe(false);
    });
});
