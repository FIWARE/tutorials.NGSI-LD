import { describe, it, expect } from 'vitest';
import { parseEntityDefaults } from '../lib/constants';

describe('parseEntityDefaults', () => {
    it('returns an empty map for unset / blank', () => {
        expect(parseEntityDefaults(undefined).size).toBe(0);
        expect(parseEntityDefaults('   ').size).toBe(0);
    });

    it('parses a { Type: { attr: value } } object', () => {
        const m = parseEntityDefaults('{"Animal":{"species":"dairy cattle"},"AgriParcel":{"category":"arable"}}');
        expect(m.get('Animal')).toEqual({ species: 'dairy cattle' });
        expect(m.get('AgriParcel')).toEqual({ category: 'arable' });
    });

    it('throws on malformed JSON', () => {
        expect(() => parseEntityDefaults('{not json')).toThrow(/not valid JSON/);
    });

    it('throws when the top level is not an object', () => {
        expect(() => parseEntityDefaults('[1,2,3]')).toThrow(/must be a JSON object/);
        expect(() => parseEntityDefaults('"x"')).toThrow(/must be a JSON object/);
    });

    it('throws when a type entry is not an object of values', () => {
        expect(() => parseEntityDefaults('{"Animal":"dairy cattle"}')).toThrow(/must be an object of attribute values/);
        expect(() => parseEntityDefaults('{"Animal":["a"]}')).toThrow(/must be an object of attribute values/);
    });
});
