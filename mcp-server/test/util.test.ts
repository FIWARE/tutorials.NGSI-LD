import { describe, it, expect } from 'vitest';
import {
    okPage,
    fail,
    toolError,
    okOrError,
    notFound,
    spreadAdditionalProperty,
    rewriteAdditionalPropertyQuery,
    pickWithAdditionalProperty,
    queryClauseHeads,
    snapEnumCase
} from '../controllers/tools/util';
import type { EntityPage } from '../lib/ngsi-ld';

const page = (over: Partial<EntityPage>): EntityPage => ({
    entities: [],
    total: null,
    limit: 100,
    offset: 0,
    returned: 0,
    ...over
});

describe('okPage', () => {
    it('flags more data when the broker total exceeds this page', () => {
        const out = JSON.parse(
            okPage([{ id: 'a' }], page({ total: 1342, returned: 1, limit: 1 }), 'query_animal', 'Animal')
        );
        expect(out._notice).toMatch(/MORE DATA AVAILABLE: returned 1 of 1342 matching Animal/);
        expect(out.pagination).toMatchObject({ total: 1342, hasMore: true, nextOffset: 1 });
    });

    it('omits the notice when the whole result set fits on one page', () => {
        const out = JSON.parse(okPage([{ id: 'a' }], page({ total: 1, returned: 1 }), 'query_animal', 'Animal'));
        expect(out._notice).toBeUndefined();
        expect(out.pagination).toMatchObject({ total: 1, hasMore: false, nextOffset: null });
    });

    it('warns heuristically when the broker withheld the count and the page was full', () => {
        const out = JSON.parse(
            okPage([], page({ total: null, returned: 20, limit: 20 }), 'query_entities', 'Building')
        );
        expect(out._notice).toMatch(/MORE DATA LIKELY: 20 Building entities returned and the page was full/);
        expect(out.pagination).toMatchObject({ total: null, hasMore: true, nextOffset: 20 });
    });

    it('carries offset through to nextOffset', () => {
        const out = JSON.parse(okPage([], page({ total: 500, offset: 100, returned: 100 }), 'query_animal', 'Animal'));
        expect(out.pagination).toMatchObject({ offset: 100, hasMore: true, nextOffset: 200 });
    });

    it('metadataOnly returns pagination with an empty list and no notice', () => {
        const out = JSON.parse(
            okPage([], page({ total: 1342, returned: 0, limit: 100, offset: 0 }), 'query_animal', 'Animal', true)
        );
        expect(out.entities).toEqual([]);
        expect(out._notice).toBeUndefined();
        expect(out.pagination).toMatchObject({ total: 1342, limit: 100, hasMore: true, nextOffset: 100 });
    });
});

describe('fail / toolError', () => {
    const body = (r: { content: { text: string }[] }) => JSON.parse(r.content[0].text);

    it('marks the result isError so the client can tell it apart from a success body', () => {
        const r = toolError({ error: 'nope' });
        expect(r.isError).toBe(true);
        expect(body(r)).toEqual({ error: 'nope' });
    });

    it('surfaces the NGSI-LD ProblemDetails title/detail/type/status from cause', () => {
        const err = Object.assign(new Error('Invalid Q-Filter'), {
            cause: {
                type: 'https://uri.etsi.org/ngsi-ld/errors/BadRequestData',
                title: 'Invalid Q-Filter',
                detail: 'unbalanced parenthesis',
                status: 400
            }
        });
        expect(body(fail(err))).toEqual({
            error: 'Invalid Q-Filter',
            detail: 'unbalanced parenthesis',
            status: 400,
            type: 'https://uri.etsi.org/ngsi-ld/errors/BadRequestData'
        });
    });

    it('falls back to the Error message and omits absent fields', () => {
        expect(body(fail(new Error('network down')))).toEqual({ error: 'network down' });
    });

    it('notFound is an isError result with a 404 status', () => {
        const r = notFound('Animal', 'urn:ngsi-ld:Animal:1');
        expect(r.isError).toBe(true);
        expect(body(r)).toEqual({ error: 'No Animal found with id urn:ngsi-ld:Animal:1', status: 404 });
    });

    it('okOrError routes an { error } outcome to a tool error and data through untouched', () => {
        expect(typeof okOrError({ data: [1, 2] })).toBe('string');
        const r = okOrError({ error: 'bad profile', details: [] });
        expect(typeof r === 'object' && r.isError).toBe(true);
    });
});

describe('spreadAdditionalProperty', () => {
    it('lifts JsonProperty members (normalised form) to the top level', () => {
        const e = {
            id: 'urn:ngsi-ld:Animal:1',
            type: 'Animal',
            species: 'cow',
            additionalProperty: { type: 'JsonProperty', json: { colour: 'brown', mudScore: 7 } }
        };
        expect(spreadAdditionalProperty(e, 'additionalProperty')).toEqual({
            id: 'urn:ngsi-ld:Animal:1',
            type: 'Animal',
            species: 'cow',
            colour: 'brown',
            mudScore: 7
        });
    });

    it('accepts the concise { json } and keyValues bare-object forms', () => {
        expect(spreadAdditionalProperty({ id: 'x', extras: { json: { a: 1 } } }, 'extras')).toEqual({ id: 'x', a: 1 });
        expect(spreadAdditionalProperty({ id: 'x', extras: { a: 1 } }, 'extras')).toEqual({ id: 'x', a: 1 });
    });

    it('does not overwrite a real attribute of the same name', () => {
        const e = { id: 'x', colour: 'blue', additionalProperty: { json: { colour: 'red', size: 'L' } } };
        expect(spreadAdditionalProperty(e, 'additionalProperty')).toEqual({ id: 'x', colour: 'blue', size: 'L' });
    });

    it('returns the entity untouched when the holder is absent or not an object', () => {
        expect(spreadAdditionalProperty({ id: 'x' }, 'additionalProperty')).toEqual({ id: 'x' });
        expect(spreadAdditionalProperty({ id: 'x', additionalProperty: 'oops' }, 'additionalProperty')).toEqual({
            id: 'x',
            additionalProperty: 'oops'
        });
    });
});

describe('rewriteAdditionalPropertyQuery', () => {
    const modelled = new Set(['species', 'weight', 'dateModified']);
    const rw = (q?: string) => rewriteAdditionalPropertyQuery(q, modelled, 'additionalProperty');

    it('remaps an unmodelled leaf attribute onto the container', () => {
        expect(rw('colour=="red"')).toBe('additionalProperty[colour]=="red"');
        expect(rw('mudScore>4')).toBe('additionalProperty[mudScore]>4');
    });

    it('leaves modelled attributes, id and type untouched', () => {
        expect(rw('species=="cow";weight>=400')).toBe('species=="cow";weight>=400');
        expect(rw('id=="urn:ngsi-ld:Animal:1"')).toBe('id=="urn:ngsi-ld:Animal:1"');
        expect(rw('dateModified>"2026-01-01T00:00:00Z"')).toBe('dateModified>"2026-01-01T00:00:00Z"');
    });

    it('rewrites only the unmodelled clauses in a compound query', () => {
        expect(rw('species=="cow";colour=="red";weight>4')).toBe(
            'species=="cow";additionalProperty[colour]=="red";weight>4'
        );
        expect(rw('colour=="red"|species=="pig"')).toBe('additionalProperty[colour]=="red"|species=="pig"');
        expect(rw('(colour=="red";weight>4)')).toBe('(additionalProperty[colour]=="red";weight>4)');
    });

    it('handles a bare existence check', () => {
        expect(rw('colour')).toBe('additionalProperty[colour]');
        expect(rw('species;colour')).toBe('species;additionalProperty[colour]');
    });

    it('never treats structure inside a quoted value as a clause', () => {
        expect(rw('colour=="a;b|c"')).toBe('additionalProperty[colour]=="a;b|c"');
        expect(rw('note~="weight>400"')).toBe('additionalProperty[note]~="weight>400"');
    });

    it('does not touch an unquoted URN on the right-hand side', () => {
        expect(rw('fedWith==urn:ngsi-ld:Feed:1')).toBe('additionalProperty[fedWith]==urn:ngsi-ld:Feed:1');
    });

    it('collapses a deeper accessor on an unmodelled attribute to the container member', () => {
        expect(rw('colour[shade]=="dark"')).toBe('additionalProperty[colour]=="dark"');
        expect(rw('colour.shade=="dark"')).toBe('additionalProperty[colour]=="dark"');
    });

    it('passes through empty input', () => {
        expect(rw(undefined)).toBeUndefined();
        expect(rw('')).toBe('');
    });
});

describe('pickWithAdditionalProperty', () => {
    const modelled = new Set(['species', 'weight']);
    const p = (pick?: string) => pickWithAdditionalProperty(pick, modelled, 'additionalProperty');

    it('adds the container when a picked name is unmodelled', () => {
        expect(p('id,colour')).toBe('id,colour,additionalProperty');
        expect(p('mudScore')).toBe('mudScore,additionalProperty');
    });

    it('leaves an all-modelled pick untouched', () => {
        expect(p('id,species,weight')).toBe('id,species,weight');
        expect(p('type')).toBe('type');
    });

    it('does not double-add when the container is already picked', () => {
        expect(p('colour,additionalProperty')).toBe('colour,additionalProperty');
    });

    it('with no schema, adds the container whenever pick is set', () => {
        expect(pickWithAdditionalProperty('species', null, 'additionalProperty')).toBe('species,additionalProperty');
        expect(pickWithAdditionalProperty(undefined, null, 'additionalProperty')).toBeUndefined();
    });

    it('tolerates whitespace and passes through empty input', () => {
        expect(p(' id , colour ')).toBe('id,colour,additionalProperty');
        expect(p(undefined)).toBeUndefined();
    });
});

describe('queryClauseHeads', () => {
    it('pulls the attribute at the head of each clause', () => {
        expect(queryClauseHeads('species=="pig";sex=="Male"')).toEqual(['species', 'sex']);
        expect(queryClauseHeads('weight>400|heartRate<50')).toEqual(['weight', 'heartRate']);
        expect(queryClauseHeads('(colour=="red";weight>4)')).toEqual(['colour', 'weight']);
    });

    it('ignores identifiers inside quoted values', () => {
        expect(queryClauseHeads('note~="sex==Male;weight>4"')).toEqual(['note']);
        expect(queryClauseHeads('fedWith==urn:ngsi-ld:Feed:1')).toEqual(['fedWith']);
    });

    it('handles a bare existence check and empty input', () => {
        expect(queryClauseHeads('colour')).toEqual(['colour']);
        expect(queryClauseHeads(undefined)).toEqual([]);
        expect(queryClauseHeads('')).toEqual([]);
    });
});

describe('snapEnumCase', () => {
    const enumsFor = (a: string) => (a === 'sex' ? ['Male', 'Female'] : undefined);

    it('snaps a value that differs only by case to the schema term', () => {
        expect(snapEnumCase({ sex: 'male' }, enumsFor)).toEqual({ sex: 'Male' });
        expect(snapEnumCase({ sex: 'FEMALE' }, enumsFor)).toEqual({ sex: 'Female' });
    });

    it('leaves an exact match, a non-enum field and an unknown value alone', () => {
        expect(snapEnumCase({ sex: 'Male', species: 'pig', breed: 'x' }, enumsFor)).toEqual({
            sex: 'Male',
            species: 'pig',
            breed: 'x'
        });
        expect(snapEnumCase({ sex: 'unknown' }, enumsFor)).toEqual({ sex: 'unknown' });
    });
});
