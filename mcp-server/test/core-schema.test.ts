import { describe, it, expect, beforeAll } from 'vitest';
import { loadCoreSchemas, type CoreSchemas } from '../lib/core-schema';

let core: CoreSchemas;
beforeAll(async () => {
    core = await loadCoreSchemas();
});

describe('EntityTypeList (5.2.24)', () => {
    it('accepts a spec-shaped payload', () => {
        const r = core.EntityTypeList.validator.safeParse({
            id: 'urn:ngsi-ld:EntityTypeList:1',
            type: 'EntityTypeList',
            typeList: ['Animal', 'Building']
        });
        expect(r.success).toBe(true);
    });

    it('rejects a missing typeList and a wrong type literal', () => {
        expect(core.EntityTypeList.validator.safeParse({ id: 'x', type: 'EntityTypeList' }).success).toBe(false);
        expect(
            core.EntityTypeList.validator.safeParse({ id: 'x', type: 'Nope', typeList: [] }).success
        ).toBe(false);
    });
});

describe('EntityType (5.2.25)', () => {
    it('accepts id/type/attributeNames/typeName', () => {
        const r = core.EntityType.validator.safeParse({
            id: 'https://smartdatamodels.org/dataModel.Agrifood/Animal',
            type: 'EntityType',
            attributeNames: ['species', 'weight'],
            typeName: 'Animal'
        });
        expect(r.success).toBe(true);
    });
});

describe('EntityTypeInfo (5.2.26)', () => {
    it('accepts entityCount + attributeDetails of Attribute objects (resolved $ref)', () => {
        const r = core.EntityTypeInfo.validator.safeParse({
            id: 'https://smartdatamodels.org/dataModel.Agrifood/Animal',
            type: 'EntityTypeInfo',
            typeName: 'Animal',
            entityCount: 23,
            attributeDetails: [
                { id: 'https://w3id.org/saref#weight', type: 'Attribute', attributeName: 'weight', attributeTypes: ['Property'] }
            ]
        });
        expect(r.success).toBe(true);
    });

    it('rejects a non-integer entityCount', () => {
        expect(
            core.EntityTypeInfo.validator.safeParse({
                id: 'x',
                type: 'EntityTypeInfo',
                typeName: 'Animal',
                entityCount: 'many',
                attributeDetails: []
            }).success
        ).toBe(false);
    });
});

describe('AttributeList (5.2.27)', () => {
    it('accepts a spec-shaped payload', () => {
        expect(
            core.AttributeList.validator.safeParse({
                id: 'urn:ngsi-ld:AttributeList:1',
                type: 'AttributeList',
                attributeList: ['temperature', 'humidity']
            }).success
        ).toBe(true);
    });
});

describe('Attribute (5.2.28)', () => {
    it('accepts the minimal required members', () => {
        expect(
            core.Attribute.validator.safeParse({
                id: 'https://w3id.org/saref#temperature',
                type: 'Attribute',
                attributeName: 'temperature'
            }).success
        ).toBe(true);
    });

    it('accepts the optional 0..1 members', () => {
        expect(
            core.Attribute.validator.safeParse({
                id: 'https://w3id.org/saref#temperature',
                type: 'Attribute',
                attributeName: 'temperature',
                attributeCount: 7,
                attributeTypes: ['Property'],
                typeNames: ['WeatherObserved', 'WeatherForecast']
            }).success
        ).toBe(true);
    });
});
