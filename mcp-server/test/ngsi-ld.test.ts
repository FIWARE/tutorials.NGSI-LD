import { describe, it, expect } from 'vitest';
import { buildQuery, stripNullClauses } from '../lib/ngsi-ld';

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

describe('stripNullClauses', () => {
    it('drops a bare-null clause and any adjacent separator', () => {
        expect(stripNullClauses('calvedBy==null')).toBe('');
        expect(stripNullClauses('species=="cow";calvedBy==null')).toBe('species=="cow"');
        expect(stripNullClauses('calvedBy==null;species=="cow"')).toBe('species=="cow"');
        expect(stripNullClauses('a=="x";calvedBy==null;b>4')).toBe('a=="x";b>4');
        expect(stripNullClauses('colour[shade]==null;weight>4')).toBe('weight>4');
        expect(stripNullClauses('a==null;b!=null')).toBe('');
    });

    it('leaves a quoted "null" and separators inside quoted values alone', () => {
        expect(stripNullClauses('name=="null"')).toBe('name=="null"');
        expect(stripNullClauses('a=="x;y";b==null')).toBe('a=="x;y"');
    });

    it('passes a null-free query through untouched', () => {
        expect(stripNullClauses('species=="cow";weight>400')).toBe('species=="cow";weight>400');
    });
});
