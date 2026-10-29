import type { FastMCP } from 'fastmcp';
import { withSession, type Session } from '../../lib/session';
import { z } from 'zod';
import { ENTITY_LIMIT } from '../../lib/constants';
import type { LoadedSchema } from '../../lib/schema';
import type { SchemaRegistry } from '../../lib/registry';
import { makeEntityQuery, REPR_PARAM_DESC } from './query-entities';

const GEOREL_VALUES = ['near', 'within', 'contains', 'intersects', 'equals', 'disjoint', 'overlaps'] as const;

// Only "near" takes a distance modifier; the broker wants it appended as "near;maxDistance==<n>".
function buildGeorel(georel: string, minDistance?: number, maxDistance?: number): string {
    if (georel !== 'near') {
        return georel;
    }
    const parts: string[] = [];
    if (minDistance !== undefined) parts.push(`minDistance==${minDistance}`);
    if (maxDistance !== undefined) parts.push(`maxDistance==${maxDistance}`);
    if (!parts.length) parts.push('maxDistance==100');
    return ['near', ...parts].join(';');
}

export function registerGeoQuery(
    server: FastMCP<Session>,
    schemas: LoadedSchema[] = [],
    registry?: SchemaRegistry
): void {
    const query = makeEntityQuery(schemas, registry);

    server.addTool({
        name: 'geoquery_entities',
        annotations: { title: 'Spatial query', readOnlyHint: true, openWorldHint: false },
        description:
            "Spatial search over entities of one type, or a comma-separated list: tests an entity's geo attribute " +
            '(default `location`) against the GeoJSON in `coordinates`, optionally ANDed with `filter`. It is the ' +
            'only tool that does spatial matching, and only entities holding that attribute can match. Other ' +
            "parameters work as in `query_entities`. Typical use: read an entity's location with `get_entity`, " +
            'then pass those coordinates here to find what contains it or is near it.',
        parameters: z.object({
            entityType: z
                .string()
                .describe(
                    'Entity type, or a comma-separated list to match any. Use a type name returned by ' +
                        '`discover_context_meta_data`.'
                ),
            relation: z
                .enum(GEOREL_VALUES)
                .default('near')
                .describe(
                    'Default "near": within `maxDistance` metres of `coordinates`. "within": the entity lies ' +
                        'inside `coordinates`; "contains": the entity\'s geometry contains `coordinates`.'
                ),
            maxDistance: z.number().optional().describe('With "near": max distance in metres (default 100).'),
            minDistance: z.number().optional().describe('With "near": min distance in metres.'),
            geometry: z
                .enum(['Point', 'LineString', 'Polygon', 'MultiPoint', 'MultiPolygon'])
                .default('Point')
                .describe('GeoJSON geometry type of `coordinates` (default "Point").'),
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
                .describe('ANDed with the spatial filter, e.g. `status=="active"`. As in `query_entities`.'),
            pick: z
                .string()
                .optional()
                .describe('Comma-separated attribute names to return; `geoproperty` is always included.'),
            limit: z.number().optional().describe(`Max entities per page (default and maximum ${ENTITY_LIMIT}).`),
            offset: z
                .number()
                .optional()
                .describe('Row offset; pass `nextOffset` from the previous response for the next page.'),
            metadataOnly: z
                .boolean()
                .optional()
                .describe('Return only `pagination` (empty `entities`), to count matches first.'),
            compact: z.boolean().optional().describe(REPR_PARAM_DESC)
        }),
        execute: withSession(async ({ relation, minDistance, maxDistance, ...args }) =>
            query(
                {
                    ...args,
                    georel: buildGeorel(relation, minDistance, maxDistance),
                    geoproperty: args.geoproperty || 'location'
                },
                'geoquery_entities'
            )
        )
    });
}
