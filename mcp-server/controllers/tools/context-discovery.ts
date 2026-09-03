// NGSI-LD context-discovery tools — GET /types, /types/{type}, /attributes,
// /attributes/{attrId} (ETSI GS CIM 009 clauses 4.5.10–4.5.15). Responses are
// validated against the ngsi-schemas/*.json types. options=concise / keyValues
// does not apply to these endpoints.

import type { FastMCP } from 'fastmcp';
import { z } from 'zod';
import { listTypes, readType, listAttributes, readAttribute } from '../../lib/ngsi-ld';
import type { CoreSchemas } from '../../lib/core-schema';
import { ok, fail, stripContext, validateOne } from './util';

// These endpoints return discovery data, not entities — a payload that misses a
// spec field (Orion-LD emits `typeName: []`, for one) is still useful, so never drop
// rows in `filter` mode. `validateOne` honours `strict` and passes through otherwise.

export function registerContextDiscoveryTools(server: FastMCP, core: CoreSchemas): void {
    // GET /types
    server.addTool({
        name: 'list_entity_types',
        description:
            '[Discovery] The entity types that exist on the Context Broker right now. Call this before any query_* tool ' +
            "when you are unsure which types exist. details=true (default) returns EntityType objects with each type's " +
            'attributeNames; details=false returns a bare EntityTypeList.',
        parameters: z.object({
            details: z.boolean().optional().describe('Include per-type attribute names (default true).')
        }),
        execute: async ({ details }) => {
            try {
                const wantDetails = details !== false;
                const body = stripContext(await listTypes(wantDetails));
                const validator = wantDetails
                    ? z.array(core.EntityType.validator)
                    : core.EntityTypeList.validator;
                return ok(validateOne(body, validator));
            } catch (err) {
                return fail(err);
            }
        }
    });

    // GET /types/{type}
    server.addTool({
        name: 'get_entity_type',
        description:
            '[Discovery] Detailed information for one entity type: its entityCount and attributeDetails (EntityTypeInfo). ' +
            'Optional drill-down after list_entity_types to decide what to `pick`/filter. Pass the type name as it appears ' +
            'in list_entity_types (e.g. "Animal").',
        parameters: z.object({
            type: z.string().describe('Entity type name or fully-qualified URI, e.g. "Animal".')
        }),
        execute: async ({ type }) => {
            try {
                const body = stripContext(await readType(type));
                return ok(validateOne(body, core.EntityTypeInfo.validator));
            } catch (err) {
                const e = err as Error;
                if (/\b404\b|not found/i.test(e.message)) {
                    return JSON.stringify({ error: `No entity type "${type}" on the broker` });
                }
                return fail(err);
            }
        }
    });

    // GET /attributes
    server.addTool({
        name: 'list_attributes',
        description:
            '[Discovery] The attribute names in use across the broker, and (with details) which entity types carry each. ' +
            'details=true (default) returns Attribute objects (attributeName, attributeTypes, typeNames); details=false ' +
            'returns a bare AttributeList.',
        parameters: z.object({
            details: z.boolean().optional().describe('Return Attribute objects rather than a name list (default true).')
        }),
        execute: async ({ details }) => {
            try {
                const wantDetails = details !== false;
                const body = stripContext(await listAttributes(wantDetails));
                const validator = wantDetails ? z.array(core.Attribute.validator) : core.AttributeList.validator;
                return ok(validateOne(body, validator));
            } catch (err) {
                return fail(err);
            }
        }
    });

    // GET /attributes/{attrId}
    server.addTool({
        name: 'get_attribute',
        description:
            '[Discovery] Detailed information for one attribute: attributeCount, attributeTypes and the entity typeNames ' +
            'that carry it (Attribute). Useful to find which entity type to query for a given measurement. Pass the ' +
            'attribute name as it appears in list_attributes (e.g. "temperature").',
        parameters: z.object({
            attrId: z.string().describe('Attribute name or fully-qualified URI, e.g. "temperature".')
        }),
        execute: async ({ attrId }) => {
            try {
                const body = stripContext(await readAttribute(attrId));
                return ok(validateOne(body, core.Attribute.validator));
            } catch (err) {
                const e = err as Error;
                if (/\b404\b|not found/i.test(e.message)) {
                    return JSON.stringify({ error: `No attribute "${attrId}" on the broker` });
                }
                return fail(err);
            }
        }
    });
}
