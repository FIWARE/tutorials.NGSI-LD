// Context-discovery tools: GET /types, /types/{type}, /attributes, /attributes/{attrId}.
// Responses validated against ngsi-schemas/*.json.

import type { FastMCP } from 'fastmcp';
import { z } from 'zod';
import { listTypes, readType, listAttributes, readAttribute } from '../../lib/ngsi-ld';
import type { CoreSchemas } from '../../lib/core-schema';
import { fail, toolError, okOrError, stripContext, validateOne } from './util';

// Discovery data, not entities: a payload missing a spec field (Orion-LD emits
// `typeName: []`) is still useful, so `validateOne` never drops rows in filter mode.

export function registerContextDiscoveryTools(server: FastMCP, core: CoreSchemas): void {
    // GET /types
    server.addTool({
        name: 'list_entity_types',
        description:
            '[Discovery] The entity types on the broker right now, each with the attribute names populated on its ' +
            'entities (which can lag the model — an `ontology://` resource has the full set). Call this before a ' +
            'query_* tool when you are not sure which types exist. Set `compact` for just the list of type names. ' +
            'Same data as the `ngsi://types` resource.',
        parameters: z.object({
            compact: z
                .boolean()
                .optional()
                .describe('Return just the list of names, without the per-item detail (default false).')
        }),
        execute: async ({ compact }) => {
            try {
                const wantDetails = compact !== true;
                const body = stripContext(await listTypes(wantDetails));
                const validator = wantDetails ? z.array(core.EntityType.validator) : core.EntityTypeList.validator;
                return okOrError(validateOne(body, validator));
            } catch (err) {
                return fail(err);
            }
        }
    });

    // GET /types/{type}
    server.addTool({
        name: 'get_entity_type',
        description:
            '[Discovery] One entity type in detail: how many entities of it exist and a per-attribute breakdown of the ' +
            'value types seen on the broker. This reflects only attributes populated on existing entities, so it can ' +
            'be incomplete — an `ontology://` resource has the full modelled attribute set. Drill-down after ' +
            'list_entity_types to decide what to `pick` or filter. Pass the type name as list_entity_types shows it, ' +
            'e.g. "Animal".',
        parameters: z.object({
            entityType: z.string().describe('Entity type name or fully-qualified URI, e.g. "Animal".')
        }),
        execute: async ({ entityType }) => {
            try {
                const body = stripContext(await readType(entityType));
                return okOrError(validateOne(body, core.EntityTypeInfo.validator));
            } catch (err) {
                const e = err as Error;
                if (/\b404\b|not found/i.test(e.message)) {
                    return toolError({ error: `No entity type "${entityType}" on the broker`, status: 404 });
                }
                return fail(err);
            }
        }
    });

    // GET /attributes
    server.addTool({
        name: 'list_attributes',
        description:
            '[Discovery] The attribute names populated on entities across the broker, each with the value types it ' +
            'holds and the entity types that carry it. This is live data, not the model: a modelled attribute with ' +
            'no values yet will be absent — an `ontology://` resource has the full set per type. Set `compact` for ' +
            'just the list of names. Same data as the `ngsi://attributes` resource.',
        parameters: z.object({
            compact: z
                .boolean()
                .optional()
                .describe('Return just the list of names, without the per-item detail (default false).')
        }),
        execute: async ({ compact }) => {
            try {
                const wantDetails = compact !== true;
                const body = stripContext(await listAttributes(wantDetails));
                const validator = wantDetails ? z.array(core.Attribute.validator) : core.AttributeList.validator;
                return okOrError(validateOne(body, validator));
            } catch (err) {
                return fail(err);
            }
        }
    });

    // GET /attributes/{attrId}
    server.addTool({
        name: 'get_attribute',
        description:
            '[Discovery] One attribute in detail: how many entities carry it, the value types it holds, and which ' +
            'entity types have it — use it to find which type to query for a given measurement. Pass the attribute ' +
            'name as list_attributes shows it, e.g. "temperature".',
        parameters: z.object({
            attrId: z.string().describe('Attribute name or fully-qualified URI, e.g. "temperature".')
        }),
        execute: async ({ attrId }) => {
            try {
                const body = stripContext(await readAttribute(attrId));
                return okOrError(validateOne(body, core.Attribute.validator));
            } catch (err) {
                const e = err as Error;
                if (/\b404\b|not found/i.test(e.message)) {
                    return toolError({ error: `No attribute "${attrId}" on the broker`, status: 404 });
                }
                return fail(err);
            }
        }
    });
}
