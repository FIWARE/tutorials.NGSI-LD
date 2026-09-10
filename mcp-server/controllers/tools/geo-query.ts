import type { FastMCP } from 'fastmcp';
import { z } from 'zod';
import { ENTITY_LIMIT } from '../../lib/constants';
import type { LoadedSchema } from '../../lib/schema';
import { makeEntityQuery, REPR_PARAM_DESC } from './query-entities';

export function registerGeoQuery(server: FastMCP, schemas: LoadedSchema[] = []): void {
    const query = makeEntityQuery(schemas);

    server.addTool({
        name: 'query_entities_geo',
        description:
            '[Spatial] `query_entities` plus a geometry filter — the only tool for point-in-polygon, distance and ' +
            'intersection queries (the typed `query_<type>` tools cannot do geometry). Takes the same `q`, `pick`, ' +
            '`expandValues` and pagination as `query_entities`; `georel`/`geometry`/`coordinates` add the spatial ' +
            "predicate, ANDed with `q`. Typical use: read an entity's `location`, then pass those coordinates here to " +
            'find what contains it or is nearby.',
        parameters: z.object({
            type: z
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
            q: z
                .string()
                .optional()
                .describe('`q` filter string, ANDed with the spatial filter, e.g. `category=="irrigation";area>1000`.'),
            pick: z.string().optional().describe('Comma-separated attributes to return. Always set this.'),
            expandValues: z
                .string()
                .optional()
                .describe(
                    'Comma-separated names of enumerated attributes used in `q`; the broker expands their values ' +
                        'against the vocabulary before matching. Auto-filled when a schema for `type` is loaded.'
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
        execute: (args) => query({ ...args, geoproperty: args.geoproperty || 'location' }, 'query_entities_geo')
    });
}
