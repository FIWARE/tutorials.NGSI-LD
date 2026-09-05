import { describe, it, expect } from 'vitest';
import type { FastMCP, InputPrompt } from 'fastmcp';
import { loadOne, loadPrompts } from '../lib/prompt';
import { registerPrompt, resolveTools, stringifyField, render } from '../controllers/prompts/dynamic';

describe('loadPrompts', () => {
    it('loads every fixture file', () => {
        const prompts = loadPrompts();
        expect(prompts.map((p) => p.name).sort()).toEqual(['diagnose-animal', 'farm-status', 'herd-weight-audit']);
    });

    it('parses a single-type prompt, separating reserved keys from free-form fields', () => {
        const p = loadOne('diagnose-animal.json');
        expect(p.name).toBe('diagnose-animal');
        expect(p.types).toEqual(['Animal']);
        expect(p.tools).toEqual(['get_{{type}}', 'get_{{type}}_history']);
        expect(p.arguments).toEqual({ id: 'Entity URN, e.g. urn:ngsi-ld:Animal:cow001' });
        expect(p.fields.pick).toEqual(
            expect.arrayContaining(['name', 'comment', 'locatedAt', 'healthCondition', 'reproductiveCondition'])
        );
        expect(p.fields.relationships).toEqual(['calvedBy', 'siredBy']);
        // reserved keys never leak into `fields`
        expect(p.fields).not.toHaveProperty('tools');
        expect(p.fields).not.toHaveProperty('types');
        expect(p.fields).not.toHaveProperty('template');
    });

    it('keeps a per-type `pick` object intact for the template renderer to flatten', () => {
        const p = loadOne('farm-status.json');
        expect(p.types).toEqual(['AgriFarm', 'AgriParcel', 'Animal', 'Building', 'WeatherObserved']);
        expect(p.fields.pick).toMatchObject({ Animal: expect.arrayContaining(['name', 'species']) });
    });
});

describe('resolveTools', () => {
    it('expands {{type}} per type, keeping only exposed typed tools', () => {
        const exposed = new Set(['get_animal', 'get_animal_history']);
        expect(resolveTools(['get_{{type}}', 'get_{{type}}_history'], ['Animal'], exposed)).toEqual([
            'get_animal',
            'get_animal_history'
        ]);
    });

    it('falls back to the generic tool for a type with no typed tool', () => {
        const exposed = new Set(['query_entities']); // no query_agriparcel registered
        expect(resolveTools(['query_{{type}}'], ['AgriParcel'], exposed)).toEqual(['query_entities']);
    });

    it('resolves per type across a mixed list — typed where exposed, generic fallback elsewhere', () => {
        const exposed = new Set(['query_animal', 'query_entities']); // Animal typed, Building not
        expect(resolveTools(['query_{{type}}'], ['Animal', 'Building'], exposed)).toEqual([
            'query_animal',
            'query_entities'
        ]);
    });

    it('drops a typed tool entirely when neither the typed nor the fallback tool is exposed', () => {
        const exposed = new Set<string>(); // temporal broker not configured, e.g.
        expect(resolveTools(['get_{{type}}_history'], ['Animal'], exposed)).toEqual([]);
    });

    it('keeps a placeholder-free pattern verbatim only when it is exposed', () => {
        expect(resolveTools(['query_entities_geo'], [], new Set(['query_entities_geo']))).toEqual([
            'query_entities_geo'
        ]);
        expect(resolveTools(['query_entities_geo'], [], new Set())).toEqual([]);
    });

    it('deduplicates when several types fall back to the same generic tool', () => {
        const exposed = new Set(['query_entities']);
        expect(resolveTools(['query_{{type}}'], ['AgriParcel', 'AgriSoil'], exposed)).toEqual(['query_entities']);
    });
});

describe('stringifyField', () => {
    it('joins an array with a comma', () => {
        expect(stringifyField(['calvedBy', 'siredBy'])).toBe('calvedBy, siredBy');
    });

    it('renders an object of arrays as key: value pairs', () => {
        expect(stringifyField({ healthCondition: ['sick', 'inTreatment'], welfareCondition: ['issue'] })).toBe(
            'healthCondition: sick, inTreatment; welfareCondition: issue'
        );
    });

    it('renders a per-type pick object', () => {
        expect(stringifyField({ Animal: ['name', 'species'], Building: ['name'] })).toBe(
            'Animal: name, species; Building: name'
        );
    });

    it('passes a plain string through', () => {
        expect(stringifyField('hello')).toBe('hello');
    });
});

describe('render', () => {
    it('substitutes every known token', () => {
        expect(render('Call {{tools}} for {{id}}', { tools: '`get_animal`', id: 'cow001' })).toBe(
            'Call `get_animal` for cow001'
        );
    });

    it('replaces an unresolved token with an empty string rather than leaking it', () => {
        expect(render('value: {{missing}}', {})).toBe('value: ');
    });
});

describe('registerPrompt', () => {
    // Minimal FastMCP stand-in: capture the InputPrompt passed to addPrompt so the
    // test can invoke its `load` the way the MCP client would.
    function fakeServer() {
        let captured: InputPrompt | undefined;
        return {
            server: { addPrompt: (p: InputPrompt) => (captured = p) } as unknown as FastMCP,
            get: () => captured!
        };
    }

    it('marks an argument required unless its description starts with "Optional"', () => {
        const { server, get } = fakeServer();
        registerPrompt(
            server,
            {
                name: 'x',
                description: 'x',
                arguments: { id: 'Required thing', species: 'Optional filter' },
                types: [],
                tools: [],
                template: '',
                fields: {}
            },
            new Set()
        );
        const args = get().arguments!;
        expect(args.find((a) => a.name === 'id')!.required).toBe(true);
        expect(args.find((a) => a.name === 'species')!.required).toBe(false);
    });

    it('end-to-end: fills runtime args, {{type}}, {{tools}} (with fallback) and a free-form field', async () => {
        const { server, get } = fakeServer();
        registerPrompt(
            server,
            {
                name: 'diagnose-animal',
                description: 'x',
                arguments: { id: 'Entity URN' },
                types: ['Animal'],
                tools: ['get_{{type}}', 'get_{{type}}_history'],
                template: 'Investigate {{id}} (type {{type}}). Call {{tools}}. Relationships: {{relationships}}.',
                fields: { relationships: ['calvedBy', 'siredBy'] }
            },
            new Set(['get_animal']) // get_animal_history not exposed — no TEMPORAL_BROKER
        );
        const out = await get().load({ id: 'urn:ngsi-ld:Animal:cow001' });
        expect(out).toBe(
            'Investigate urn:ngsi-ld:Animal:cow001 (type Animal). Call `get_animal`. Relationships: calvedBy, siredBy.'
        );
    });

    it('resolves {{types}} (plural) to the full list, distinct from singular {{type}}', async () => {
        const { server, get } = fakeServer();
        registerPrompt(
            server,
            {
                name: 'farm-status',
                description: 'x',
                arguments: {},
                types: ['Animal', 'Building'],
                tools: [],
                template: '{{type}} | {{types}}',
                fields: {}
            },
            new Set()
        );
        expect(await get().load({})).toBe('Animal, Building | Animal, Building');
    });
});
