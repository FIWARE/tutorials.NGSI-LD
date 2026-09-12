import { describe, it, expect } from 'vitest';
import { stripNullClauses } from '../lib/ngsi-ld';

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
