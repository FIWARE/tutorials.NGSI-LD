import type { FastMCP } from 'fastmcp';
import { z } from 'zod';
import { listEntities } from '../../lib/ngsi-ld';
import { ENTITY_LIMIT } from '../../lib/constants';
import { fail, stripContext, clampLimit, okPage } from './util';

export function registerGeoQuery(server: FastMCP): void {
    server.addTool({
        name: 'query_entities_geo',
        description:
            '[Spatial only] The one tool for point-in-polygon / distance queries — the typed `query_<type>` tools cannot do ' +
            "geometry. Typical use: fetch an entity's `location` with get_entity or a typed get_<type>, then pass those " +
            'coordinates here to find which area contains it or what is nearby.',
        parameters: z.object({
            type: z.string().describe('Entity type to search, e.g. "AgriParcel".'),
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
            geoproperty: z.string().optional().describe('Which GeoProperty to test against (default "location").'),
            pick: z.string().optional().describe('Comma-separated attributes to return. Always set this.'),
            limit: z.number().optional().describe(`Max entities to return (default/max ${ENTITY_LIMIT}).`),
            offset: z
                .number()
                .optional()
                .describe(
                    'Row offset for pagination; pass the `nextOffset` from a previous response to fetch the next page.'
                )
        }),
        execute: async ({ type, georel, geometry, coordinates, geoproperty, pick, limit, offset }) => {
            try {
                const page = await listEntities({
                    type,
                    georel,
                    geometry,
                    coordinates,
                    geoproperty: geoproperty || 'location',
                    pick,
                    limit: clampLimit(limit),
                    offset,
                    options: 'concise'
                });
                return okPage(page.entities.map(stripContext), page, 'query_entities_geo', type);
            } catch (err) {
                return fail(err);
            }
        }
    });
}
