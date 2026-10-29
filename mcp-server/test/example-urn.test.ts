import { describe, it, expect } from 'vitest';
import { exampleUrn } from '../controllers/tools/util';

const schemas = [{ typeName: 'Activity' }, { typeName: 'Animal' }, { typeName: 'Pen' }];

describe('exampleUrn', () => {
    it('uses the preferred type when it is loaded, ignoring case', () => {
        expect(exampleUrn(schemas, '<id>', 'animal')).toBe('urn:ngsi-ld:Animal:<id>');
        expect(exampleUrn(schemas, 'cow001', 'Animal')).toBe('urn:ngsi-ld:Animal:cow001');
    });

    it('falls back to the first loaded type when the preference is unset or unknown', () => {
        expect(exampleUrn(schemas, '<id>', undefined)).toBe('urn:ngsi-ld:Activity:<id>');
        expect(exampleUrn(schemas, '<id>', 'Nope')).toBe('urn:ngsi-ld:Activity:<id>');
    });

    it('falls back to a placeholder with no schemas', () => {
        expect(exampleUrn([], '<id>', undefined)).toBe('urn:ngsi-ld:<Type>:<id>');
    });
});
