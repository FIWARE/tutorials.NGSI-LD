import { describe, it, expect } from 'vitest';
import { loadOne, conciseValidator } from '../lib/schema';
import { z } from 'zod';

describe('conciseValidator', () => {
    const v = conciseValidator(z.number());

    it('accepts a flat primitive', () => {
        expect(v.safeParse(450).success).toBe(true);
    });

    it('accepts a {value, unitCode, observedAt} object', () => {
        expect(v.safeParse({ value: 450, unitCode: 'KGM', observedAt: '2026-09-02T12:00:00Z' }).success).toBe(true);
    });

    it('keeps properties-of-properties via passthrough', () => {
        const parsed = v.safeParse({ value: 450, accuracy: { value: 0.95 } });
        expect(parsed.success).toBe(true);
    });

    it('rejects a wrong base type', () => {
        expect(v.safeParse({ value: 'heavy' }).success).toBe(false);
    });
});

describe('loadOne — Animal (canonical SDM)', () => {
    it('derives input filters from flattened properties', async () => {
        const s = await loadOne('Animal.json');
        expect(s.typeName).toBe('Animal');
        expect(s.model).toBe('agrifood');
        expect(s.ontologyUri).toBe('ontology://agrifood/Animal');
        expect(Object.keys(s.inputShape)).toEqual(expect.arrayContaining(['species', 'legalId', 'sex', 'breed', 'name']));
        expect(Object.keys(s.inputShape)).not.toContain('id');
        expect(Object.keys(s.inputShape)).not.toContain('type');
        // storage-platform timestamps are not query filters
        expect(Object.keys(s.inputShape)).not.toContain('dateCreated');
        expect(Object.keys(s.inputShape)).not.toContain('dateModified');
        expect(s.lowTrust).toBe(false);
        expect(s.required).toEqual(expect.arrayContaining(['id', 'type', 'species', 'legalId', 'sex']));
    });

    it('output validator enforces required baseline but passes unknown attributes', async () => {
        const s = await loadOne('Animal.json');
        const good = {
            id: 'urn:ngsi-ld:Animal:cow001',
            type: 'Animal',
            species: 'dairy cattle',
            legalId: 'ES-123',
            sex: 'female',
            weight: { value: 450, unitCode: 'KGM' },
            customVetNotes: 'checkup Tuesday'
        };
        const parsed = s.entityValidator.safeParse(good);
        expect(parsed.success).toBe(true);
        expect((parsed as { data: Record<string, unknown> }).data.customVetNotes).toBe('checkup Tuesday');

        const missingRequired = { id: 'urn:ngsi-ld:Animal:x', type: 'Animal', species: 'cow' };
        expect(s.entityValidator.safeParse(missingRequired).success).toBe(false);
    });

    it('a VocabProperty filter lists its enum values and flags case sensitivity', async () => {
        const s = await loadOne('Animal.json');
        const desc = s.inputShape.sex.description ?? '';
        expect(desc).toMatch(/case-sensitive, exact match/);
        for (const v of s.writeAttrs.sex.enumValues ?? []) {
            expect(desc).toContain(v);
        }
    });

    it('temporal validator accepts [value, timestamp] tuples', async () => {
        const s = await loadOne('Animal.json');
        const parsed = s.temporalValidator.safeParse({
            id: 'urn:ngsi-ld:Animal:cow001',
            type: 'Animal',
            weight: { values: [[440, '2026-08-01T12:00:00Z'], [450, '2026-09-02T12:00:00Z']] }
        });
        expect(parsed.success).toBe(true);
    });
});

describe('loadOne — offline $ref resolution', () => {
    it('flattens GSMA + Location + AgriFood commons into Building', async () => {
        const s = await loadOne('Building.json');
        // name/description come from GSMA-Commons, mapUrl/collapseRisk from the model block
        expect(Object.keys(s.inputShape)).toEqual(expect.arrayContaining(['name', 'description', 'mapUrl', 'collapseRisk']));
        // array-typed `category` is not a scalar filter
        expect(Object.keys(s.inputShape)).not.toContain('category');
    });

    it('flattens ./Device.json into a SAREF profile', async () => {
        const s = await loadOne('TemperatureSensor.json');
        expect(Object.keys(s.inputShape)).toEqual(expect.arrayContaining(['serialNumber', 'temperature']));
    });
});

describe('loadOne — trust downgrade', () => {
    it('drops required to id/type for a stub', async () => {
        const s = await loadOne('PartField.json');
        expect(s.lowTrust).toBe(true);
        expect(s.required).toEqual(['id', 'type']);
        expect(s.toolDescription).toMatch(/inferred/i);
    });

    it('drops required to id/type for a profile with zero instances', async () => {
        const s = await loadOne('HVAC.json');
        expect(s.lowTrust).toBe(true);
        expect(s.required).toEqual(['id', 'type']);
    });

    it('relaxes required to id/type for an introspection-derived model', async () => {
        const s = await loadOne('SoilSensor.json'); // modelTags "generated", 9 sampled "required" fields
        expect(s.lowTrust).toBe(false);
        expect(s.required).toEqual(['id', 'type']);
        expect(s.toolDescription).toMatch(/derived from live broker data/i);
    });

    it('excludes Command attributes from input and output shapes', async () => {
        const s = await loadOne('Tractor.json');
        expect(Object.keys(s.inputShape)).not.toContain('start');
        expect(Object.keys(s.inputShape)).not.toContain('stop');
        const parsed = s.entityValidator.safeParse({ id: 'urn:ngsi-ld:Tractor:001', type: 'Tractor', start: 'x' });
        // passthrough keeps it, but it is not a validated field
        expect(parsed.success).toBe(true);
    });
});
