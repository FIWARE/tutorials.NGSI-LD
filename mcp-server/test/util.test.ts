import { describe, it, expect } from 'vitest';
import { okPage } from '../controllers/tools/util';
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
