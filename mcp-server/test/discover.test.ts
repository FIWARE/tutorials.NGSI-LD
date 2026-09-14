import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const BROKER = 'http://localhost:1026/ngsi-ld/v1';

const typeList = [
    { id: 'https://smartdatamodels.org/dataModel.Agrifood/Animal', type: 'EntityType', typeName: 'Animal' },
    { id: 'https://example.com/ns#Hive', type: 'EntityType', typeName: 'Hive' }
];

const typeInfo: Record<string, unknown> = {
    Animal: {
        id: 'https://smartdatamodels.org/dataModel.Agrifood/Animal',
        type: 'EntityTypeInfo',
        typeName: 'Animal',
        entityCount: 8,
        attributeDetails: [{ id: 'https://schema.org/name', type: 'Attribute', attributeName: 'name' }]
    },
    Hive: {
        id: 'https://example.com/ns#Hive',
        type: 'EntityTypeInfo',
        typeName: 'Hive',
        entityCount: 3,
        attributeDetails: [
            { id: 'https://schema.org/name', type: 'Attribute', attributeName: 'name', attributeTypes: ['Property'] },
            {
                id: 'https://example.com/ns#keptBy',
                type: 'Attribute',
                attributeName: 'keptBy',
                attributeTypes: ['Relationship']
            }
        ]
    }
};

// A trimmed stand-in for the published Smart Data Model.
const curatedAnimal = {
    $id: 'https://smart-data-models.github.io/dataModel.Agrifood/Animal/schema.json',
    title: 'Animal',
    type: 'object',
    description: 'Curated agrifood data model.',
    properties: {
        id: { type: 'string' },
        type: { type: 'string' },
        name: { type: 'string', description: 'Name of the animal.' },
        sex: { type: 'string', enum: ['male', 'female'] }
    },
    required: ['id', 'type', 'name']
};

function jsonResponse(body: unknown): Response {
    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
}

async function loadDiscover() {
    vi.resetModules();
    return import('../lib/discover');
}

beforeEach(() => {
    vi.stubGlobal(
        'fetch',
        vi.fn(async (input: string | URL) => {
            const url = String(input);
            if (url.startsWith(`${BROKER}/types?`) || url === `${BROKER}/types`) {
                return jsonResponse(typeList);
            }
            const drill = /\/types\/([^?]+)/.exec(url);
            if (drill) {
                return jsonResponse(typeInfo[decodeURIComponent(drill[1])]);
            }
            if (url.includes('dataModel.Agrifood/master/Animal/schema.json')) {
                return jsonResponse(curatedAnimal);
            }
            return new Response('not found', { status: 404 });
        })
    );
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
});

describe('discoverTypes', () => {
    it('prefers the curated data model when the type URI resolves to one', async () => {
        const { discoverTypes } = await loadDiscover();

        const found = await discoverTypes(new Set());
        const animal = found.find((s) => s.typeName === 'Animal');

        expect(animal?.model).toBe('agrifood');
        expect(animal?.ontologyUri).toBe('ontology://agrifood/Animal');
        expect(animal?.lowTrust).toBe(false);
        // The curated model knows about attributes no entity carries yet.
        expect(Object.keys(animal?.raw.properties ?? {})).toContain('sex');
    });

    it('synthesises a partial profile when no data model is available', async () => {
        const { discoverTypes } = await loadDiscover();

        const hive = (await discoverTypes(new Set())).find((s) => s.typeName === 'Hive');

        expect(hive?.model).toBe('generated');
        // The broker only reports populated attributes, so the profile is never
        // treated as the full shape of the type.
        expect(hive?.lowTrust).toBe(true);
        expect(hive?.required).toEqual(['id', 'type']);
        expect(hive?.writeAttrs.keptBy.ngsiType).toBe('Relationship');
        expect(hive?.writeAttrs.name.ngsiType).toBe('Property');
        expect(hive?.toolDescription).toMatch(/indicative/i);
    });

    it('leaves a type alone when a curated schema is already loaded for it', async () => {
        const { discoverTypes } = await loadDiscover();

        const found = await discoverTypes(new Set(['animal']));

        expect(found.map((s) => s.typeName)).toEqual(['Hive']);
        expect(vi.mocked(fetch).mock.calls.some(([u]) => String(u).includes('Animal/schema.json'))).toBe(false);
    });

    it('returns nothing when the broker cannot be reached', async () => {
        const { discoverTypes } = await loadDiscover();
        vi.mocked(fetch).mockRejectedValue(new Error('ECONNREFUSED'));

        expect(await discoverTypes(new Set())).toEqual([]);
    });

    it('skips a type whose detail cannot be read, keeping the rest', async () => {
        const { discoverTypes } = await loadDiscover();
        vi.mocked(fetch).mockImplementation(async (input: string | URL) => {
            const url = String(input);
            if (url.startsWith(`${BROKER}/types?`)) return jsonResponse(typeList);
            if (url.includes('/types/Animal')) return new Response('boom', { status: 500 });
            const drill = /\/types\/([^?]+)/.exec(url);
            if (drill) return jsonResponse(typeInfo[decodeURIComponent(drill[1])]);
            return new Response('not found', { status: 404 });
        });

        expect((await discoverTypes(new Set())).map((s) => s.typeName)).toEqual(['Hive']);
    });
});
