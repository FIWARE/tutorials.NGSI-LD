import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/ngsi-ld', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../lib/ngsi-ld')>()),
    listEntities: vi.fn()
}));

import { listEntities, type EntityPage } from '../lib/ngsi-ld';
import { nearMatches, similarIds, okPage } from '../controllers/tools/util';
import { emptyResultHints } from '../controllers/tools/query-entities';
import type { LoadedSchema } from '../lib/schema';

const page = (over: Partial<EntityPage>): EntityPage => ({
    entities: [],
    total: null,
    limit: 100,
    offset: 0,
    returned: 0,
    ...over
});
const body = (r: ReturnType<typeof okPage>) => JSON.parse(r.content[0].text as string);

const schema = (typeName: string, attrs: string[], lowTrust = false) =>
    ({ typeName, lowTrust, writeAttrs: Object.fromEntries(attrs.map((a) => [a, {}])) }) as unknown as LoadedSchema;

const schemas = [schema('Sensor', ['status', 'reading', 'owner']), schema('Hive', ['name'], true)];

describe('nearMatches', () => {
    it('finds a transposition and a dropped letter', () => {
        expect(nearMatches('speceis', ['species', 'sex', 'name'])).toEqual(['species']);
        expect(nearMatches('Snsor', ['Sensor', 'Hive'])).toEqual(['Sensor']);
    });

    it('offers a name that differs only by case', () => {
        expect(nearMatches('Status', ['status'])).toEqual(['status']);
    });

    it('offers nothing for an unrelated name, and never the exact name', () => {
        expect(nearMatches('zzzz', ['status', 'reading'])).toEqual([]);
        expect(nearMatches('status', ['status'])).toEqual([]);
    });

    it('ranks closest first and caps the list', () => {
        expect(nearMatches('read', ['reading', 'ready', 'reads', 'readme', 'reader'], 2)).toHaveLength(2);
        expect(nearMatches('reads', ['reading', 'read'])[0]).toBe('read');
    });
});

describe('emptyResultHints', () => {
    it('suggests a known type for a misspelt one', () => {
        expect(emptyResultHints('Snsor', undefined, schemas)).toEqual(['"Snsor" is not a known type. Did you mean: Sensor?']);
    });

    it('points at discovery when no type is close', () => {
        expect(emptyResultHints('Zebra', undefined, schemas)[0]).toMatch(/not a known type\. Call discover_context_meta_data/);
    });

    it('suggests a known attribute for a misspelt filter attribute, ignoring quoted values', () => {
        const hints = emptyResultHints('Sensor', 'stauts=="active";reading>3', schemas);
        expect(hints).toEqual(['"stauts" is not a known attribute of Sensor. Did you mean: status?']);
    });

    it('stays quiet for known names and for core attributes', () => {
        expect(emptyResultHints('sensor', 'status=="x";location=="y"', schemas)).toEqual([]);
    });

    it('does not check attributes of a partial (low-trust) profile', () => {
        expect(emptyResultHints('Hive', 'colour=="red"', schemas)).toEqual([]);
    });

    it('gives nothing when no schemas are loaded', () => {
        expect(emptyResultHints('Anything', 'x==1', [])).toEqual([]);
    });
});

describe('okPage for empty results', () => {
    it('explains a metadataOnly zero count', () => {
        const out = body(okPage([], page({ total: 0 }), 'query_entities', 'Sensor', true));
        expect(out._notice).toMatch(/matched no Sensor entities\. This is a valid empty result/);
    });

    it('says a missing count usually means nothing matched', () => {
        const out = body(okPage([], page({ total: null }), 'query_entities', 'Sensor', true));
        expect(out._notice).toMatch(/no match count.*usually means nothing matched/);
    });

    it('stays silent for a metadataOnly count that found matches', () => {
        const out = body(okPage([], page({ total: 12 }), 'query_entities', 'Sensor', true));
        expect(out._notice).toBeUndefined();
    });

    it('carries hints only when given', () => {
        expect(body(okPage([], page({ total: 0 }), 'q', 'Sensor'))._hints).toBeUndefined();
        expect(body(okPage([], page({ total: 0 }), 'q', 'Sensor', false, ['try X']))._hints).toEqual(['try X']);
    });
});

describe('similarIds', () => {
    beforeEach(() => {
        vi.mocked(listEntities).mockReset();
    });

    it('suggests ids that share the prefix and differ slightly', async () => {
        vi.mocked(listEntities).mockResolvedValue(
            page({
                entities: [
                    { id: 'urn:ngsi-ld:Sensor:s006' },
                    { id: 'urn:ngsi-ld:Sensor:s100' },
                    { id: 'urn:ngsi-ld:Sensor:zzzzzzzz' }
                ]
            })
        );

        expect(await similarIds('urn:ngsi-ld:Sensor:s06')).toEqual(['urn:ngsi-ld:Sensor:s006']);
        expect(vi.mocked(listEntities).mock.calls[0][0]).toMatchObject({ type: 'Sensor', pick: 'id' });
    });

    it('returns nothing when the broker call fails', async () => {
        vi.mocked(listEntities).mockRejectedValue(new Error('boom'));

        expect(await similarIds('urn:ngsi-ld:Sensor:s06')).toEqual([]);
    });

    it('returns nothing for an id that is not a URN with a type', async () => {
        expect(await similarIds('nonsense')).toEqual([]);
        expect(listEntities).not.toHaveBeenCalled();
    });
});
