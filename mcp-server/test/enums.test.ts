import { describe, it, expect } from 'vitest';
import { buildEnums } from '../lib/enums';
import { loadSchemas } from '../lib/schema';

describe('buildEnums', () => {
    it('keys the map by every loaded type, even one with no enumerated attributes', async () => {
        const enums = buildEnums(await loadSchemas());
        expect(Object.keys(enums)).toEqual(expect.arrayContaining(['Animal', 'Building']));
        expect(enums.Building).toEqual({});
    });

    it('lists each enumerated attribute with its allowed values', async () => {
        const enums = buildEnums(await loadSchemas());
        expect(enums.Animal.species).toEqual(['dairy cattle', 'beef cattle', 'pig', 'sheep']);
        expect(enums.Animal.sex).toEqual(['female', 'male']);
    });

    it('never includes id/type — those are not write attributes', async () => {
        const enums = buildEnums(await loadSchemas());
        expect(enums.Animal).not.toHaveProperty('id');
        expect(enums.Animal).not.toHaveProperty('type');
    });

    it('returns an empty map for no schemas', () => {
        expect(buildEnums([])).toEqual({});
    });
});
