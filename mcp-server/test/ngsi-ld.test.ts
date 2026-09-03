import { describe, it, expect } from 'vitest';
import { buildQuery } from '../lib/ngsi-ld';

describe('buildQuery', () => {
    it('joins exact-match clauses with ;', () => {
        expect(buildQuery({ name: 'Beany', species: 'dairy cattle' })).toBe('name=="Beany";species=="dairy cattle"');
    });

    it('emits numeric values unquoted', () => {
        expect(buildQuery({ weight: 450 })).toBe('weight==450');
    });

    it('keeps an operator the agent supplies', () => {
        expect(buildQuery({ heartRate: '>60' })).toBe('heartRate>60');
        expect(buildQuery({ weight: '>=400' })).toBe('weight>=400');
        expect(buildQuery({ name: '~=Bea' })).toBe('name~="Bea"');
    });

    it('skips empty / undefined values', () => {
        expect(buildQuery({ a: '', b: undefined, c: null, d: 'x' })).toBe('d=="x"');
    });

    it('returns an empty string for no filters', () => {
        expect(buildQuery({})).toBe('');
    });
});
