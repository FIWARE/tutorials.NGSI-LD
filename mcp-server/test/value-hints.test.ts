import { describe, it, expect, vi } from 'vitest';
import { valueMismatchHints, isEmptyResult, closestValues, leadingPattern } from '../controllers/tools/query-entities';

const stored = (...v: unknown[]) => vi.fn().mockResolvedValue(v);

describe('leadingPattern', () => {
    it('covers case for the first two letters and ignores the rest', () => {
        expect(leadingPattern('Twilight')).toBe('[tT][wW].*');
        expect(new RegExp(leadingPattern('petal')).test('Grape')).toBe(true);
    });

    it('lets an unaccented letter match its accented forms', () => {
        const re = new RegExp(leadingPattern('anos'));
        expect(re.test('años')).toBe(true);
        expect(re.test('ANÓS')).toBe(true);
    });

    it('uses a wildcard for punctuation and a single character for a one-letter value', () => {
        expect(new RegExp(leadingPattern('a-')).test('ab')).toBe(true);
        expect(leadingPattern('x')).toBe('[xX].*');
    });
});

describe('closestValues', () => {
    it('puts a case/accent-only match first and counts it as exact', () => {
        expect(closestValues('petal', ['Grape', 'Petal', 'Pearl'])).toEqual({
            values: ['Petal', 'Pearl', 'Grape'],
            exact: 1
        });
        expect(closestValues('anos', ['meses', 'años']).values[0]).toBe('años');
    });

    it('prefers a value that contains the request, then the nearest spelling', () => {
        expect(closestValues('cattle', ['calf', 'dairy cattle']).values[0]).toBe('dairy cattle');
        expect(closestValues('petl', ['Grape', 'Petal']).values[0]).toBe('Petal');
        expect(closestValues('petl', ['Grape', 'Petal']).exact).toBe(0);
    });

    it('returns nothing when the value is stored exactly, and ignores non-strings', () => {
        expect(closestValues('Beany', ['Beany', 'beany'])).toEqual({ values: [], exact: 0 });
        expect(closestValues('x', [1, null, { a: 1 }]).values).toEqual([]);
    });

    it('caps the list', () => {
        expect(closestValues('a', ['ab', 'ac', 'ad', 'ae']).values).toHaveLength(3);
    });
});

describe('valueMismatchHints', () => {
    it('suggests the stored value that differs only by case', async () => {
        const hints = await valueMismatchHints('name=="twilight"', new Set(), stored('Beany', 'Twilight'));
        expect(hints).toEqual([expect.stringContaining('Try name=="Twilight"')]);
    });

    it('finds an accented value from the unaccented spelling', async () => {
        const hints = await valueMismatchHints('unit=="anos"', new Set(), stored('años', 'meses'));
        expect(hints).toEqual([expect.stringContaining('Try unit=="años"')]);
    });

    it('offers the closest values when nothing differs only by case or accents', async () => {
        const hints = await valueMismatchHints('name=="petl"', new Set(), stored('Grape', 'Petal'));
        expect(hints).toEqual(['No name equals "petl". Closest stored values: "Petal", "Grape".']);
    });

    it('asks the broker about the requested value', async () => {
        const valuesOf = stored('Petal');
        await valueMismatchHints('name=="petal"', new Set(), valuesOf);
        expect(valuesOf).toHaveBeenCalledWith('name', 'petal');
    });

    it('says nothing when the broker returns nothing, or the value is stored exactly', async () => {
        expect(await valueMismatchHints('name=="Zed"', new Set(), stored())).toEqual([]);
        expect(await valueMismatchHints('name=="Beany"', new Set(), stored('Beany'))).toEqual([]);
    });

    it('skips enumerated attributes, and survives a failed probe', async () => {
        const valuesOf = stored('Active');
        expect(await valueMismatchHints('status=="active"', new Set(['status']), valuesOf)).toEqual([]);
        expect(valuesOf).not.toHaveBeenCalled();
        const failing = vi.fn().mockRejectedValue(new Error('down'));
        expect(await valueMismatchHints('name=="x"', new Set(), failing)).toEqual([]);
    });

    it('probes an attribute once for a repeated clause', async () => {
        const valuesOf = stored('Twilight');
        const hints = await valueMismatchHints('name=="twilight";name=="twilight"', new Set(), valuesOf);
        expect(hints).toHaveLength(1);
        expect(valuesOf).toHaveBeenCalledTimes(1);
    });
});

describe('isEmptyResult', () => {
    it('treats a normal query as empty when its first page has no rows, whatever the total says', () => {
        expect(isEmptyResult({ total: 72, returned: 0, offset: 0 }, false)).toBe(true);
        expect(isEmptyResult({ total: null, returned: 0, offset: 0 }, false)).toBe(true);
        expect(isEmptyResult({ total: 3, returned: 3, offset: 0 }, false)).toBe(false);
    });

    it('does not call a page past the end empty', () => {
        expect(isEmptyResult({ total: 5, returned: 0, offset: 100 }, false)).toBe(false);
    });

    it('relies on the total for a count-only query', () => {
        expect(isEmptyResult({ total: 0, returned: 0, offset: 0 }, true)).toBe(true);
        expect(isEmptyResult({ total: 4, returned: 0, offset: 0 }, true)).toBe(false);
        expect(isEmptyResult({ total: null, returned: 0, offset: 0 }, true)).toBe(false);
    });
});
