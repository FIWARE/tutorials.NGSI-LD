import type { FastMCP } from 'fastmcp';
import { z } from 'zod';
import { ENTITY_LIMIT } from '../../lib/constants';
import type { LoadedSchema } from '../../lib/schema';
import { makeEntityQuery, REPR_PARAM_DESC } from './query-entities';

export function registerGeoQuery(server: FastMCP, schemas: LoadedSchema[] = []): void {
    const query = makeEntityQuery(schemas);

    server.addTool({
        name: 'geoquery_entities',
        annotations: { readOnlyHint: true, openWorldHint: false },
        description:
            'Spatial search for entities of one type — point-in-polygon, distance and intersection queries via ' +
            '`georel`/`geometry`/`coordinates`, ANDed with an optional `filter`; the only tool that can do this. ' +
            '`pick` and pagination work the same as `query_entities` (call ' +
            '`discover_context_meta_data` first rather than guessing attribute names). Typical use: read an ' +
            "entity's `location`, then pass those coordinates here to find what contains it or is nearby.",
        parameters: z.object({
            entityType: z
                .string()
                .describe(
                    'Entity type, or a comma-separated list to match any, e.g. "AgriParcel" or "Device,Building".'
                ),
            georel: z
                .string()
                .describe(
                    'Spatial relationship: "near;maxDistance==2000", "near;minDistance==100", "within", "contains", "intersects", "equals", "disjoint", "overlaps".'
                ),
            geometry: z
                .string()
                .describe('GeoJSON geometry type: "Point", "LineString", "Polygon", "MultiPoint", "MultiPolygon".'),
            coordinates: z
                .string()
                .describe(
                    'GeoJSON coordinates as a JSON string, e.g. "[-3.12,40.41]" or "[[[-3.1,40.4],[-3.2,40.4],[-3.2,40.5],[-3.1,40.4]]]".'
                ),
            geoproperty: z
                .string()
                .optional()
                .describe('Which location/geometry attribute to test against (default "location").'),
            filter: z
                .string()
                .optional()
                .describe(
                    'Filter string, ANDed with the spatial filter, e.g. `category=="irrigation"` or `area>1000`. ' +
                        'Only narrow by an attribute you actually need to filter on — to just see a value, `pick` it instead.'
                ),
            pick: z
                .string()
                .optional()
                .describe(
                    'Comma-separated attributes to return. Leave unset by default; set it only once you already ' +
                        'know exactly which attributes you want. `geoproperty` (default "location") is always ' +
                        'included even if omitted here — a geo query is about its coordinates.'
                ),
            limit: z.number().optional().describe(`Max entities to return (default/max ${ENTITY_LIMIT}).`),
            offset: z
                .number()
                .optional()
                .describe(
                    'Row offset for pagination; pass the `nextOffset` from a previous response to fetch the next page.'
                ),
            metadataOnly: z
                .boolean()
                .optional()
                .describe(
                    'Return only the `pagination` block (total match count etc.) with an empty `entities` array — use to count matches without transferring any bodies.'
                ),
            compact: z.boolean().optional().describe(REPR_PARAM_DESC)
        }),
        execute: (args) => query({ ...args, geoproperty: args.geoproperty || 'location' }, 'geoquery_entities')
    });
}
