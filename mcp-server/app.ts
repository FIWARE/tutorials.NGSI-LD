import debug from 'debug';
import { FastMCP } from 'fastmcp';
import { loadSchemas } from './lib/schema';
import { loadCoreSchemas } from './lib/core-schema';
import { registerContextDiscoveryTools } from './controllers/tools/context-discovery';
import { registerQueryEntities } from './controllers/tools/query-entities';
import { registerGetEntity } from './controllers/tools/get-entity';
import { registerGetEntityHistory } from './controllers/tools/get-entity-history';
import { registerGeoQuery } from './controllers/tools/geo-query';
import { registerDynamic } from './controllers/tools/dynamic';
import { registerOntology } from './controllers/resources/ontology';
import { registerContextDiscoveryResources } from './controllers/resources/context-discovery';
import { TEMPORAL_BROKER } from './lib/constants';

const log = debug('mcp:server');

export async function buildServer(): Promise<FastMCP> {
    const server = new FastMCP({ name: 'ngsi-ld-mcp-server', version: '1.0.0' });

    // Core NGSI-LD tools — always present.
    const core = await loadCoreSchemas();
    registerContextDiscoveryTools(server, core);
    registerQueryEntities(server);
    registerGetEntity(server);
    registerGeoQuery(server);
    // Temporal interface is optional — no TEMPORAL_BROKER ⇒ no history tools.
    if (TEMPORAL_BROKER) {
        registerGetEntityHistory(server);
    }

    // Ontology resources document every loaded type regardless; typed per-type
    // tools are generated only for the types named in QUERIABLE_TYPES / READABLE_TYPES.
    const schemas = await loadSchemas();
    let typedTools = 0;
    for (const schema of schemas) {
        typedTools += registerDynamic(server, schema);
    }
    registerOntology(server, schemas);
    registerContextDiscoveryResources(server);

    log(
        '%d generic tools + %d typed tools (temporal %s) + %d ontology resources',
        TEMPORAL_BROKER ? 7 : 6,
        typedTools,
        TEMPORAL_BROKER ? 'on' : 'off',
        schemas.length
    );
    return server;
}
