import { describe, it, expect } from 'vitest';
import { buildRelationships, buildProperties } from '../lib/relationships';
import { loadSchemas } from '../lib/schema';

describe('buildRelationships', () => {
    it('lists each Relationship attribute flagged relationship: true, property: false, with its description', async () => {
        const rel = buildRelationships(await loadSchemas());
        expect(rel.Animal.ownedBy).toEqual({
            relationship: true,
            property: false,
            description: 'The owner of the animal.'
        });
    });

    it('keys the map by every loaded type, even one with no relationships', async () => {
        const rel = buildRelationships(await loadSchemas());
        expect(Object.keys(rel)).toEqual(expect.arrayContaining(['Animal', 'Building']));
        expect(rel.Building).toEqual({});
    });

    it('returns an empty map for no schemas', () => {
        expect(buildRelationships([])).toEqual({});
    });
});

describe('buildProperties', () => {
    it('lists each non-Relationship attribute flagged relationship: false, property: true, with its description', async () => {
        const props = buildProperties(await loadSchemas());
        expect(props.Building.category).toEqual({
            relationship: false,
            property: true,
            description: 'Building category (array — not a scalar filter).'
        });
        expect(props.Building.mapUrl.description).toBe('URL of a map of the building.');
    });

    it('excludes relationships', async () => {
        const props = buildProperties(await loadSchemas());
        expect(props.Animal).not.toHaveProperty('ownedBy');
    });

    it('returns an empty map for no schemas', () => {
        expect(buildProperties([])).toEqual({});
    });
});
