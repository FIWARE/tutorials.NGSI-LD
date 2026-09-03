import debug from 'debug';
import { FastMCP } from 'fastmcp';
import { loadSchemas } from './lib/schema';
import { loadCoreSchemas } from './lib/core-schema';
import { registerContextDiscoveryTools } from './controllers/tools/context-discovery';
import { registerQueryEntities } from './controllers/tools/query-entities';
import { registerGetEntity } from './controllers/tools/get-entity';
import { registerGeoQuery } from './controllers/tools/geo-query';
import { registerDynamic } from './controllers/tools/dynamic';
import { registerOntology } from './controllers/resources/ontology';
import { registerContextDiscoveryResources } from './controllers/resources/context-discovery';

const log = debug('mcp:server');

export async function buildServer(): Promise<FastMCP> {
    const server = new FastMCP({ name: 'ngsi-ld-mcp-server', version: '1.0.0' });

    // Core NGSI-LD tools — always present.
    const core = await loadCoreSchemas();
    registerContextDiscoveryTools(server, core);
    registerQueryEntities(server);
    registerGetEntity(server);
    registerGeoQuery(server);

    // Schema-driven tools + ontology resources.
    const schemas = await loadSchemas();
    for (const schema of schemas) {
        registerDynamic(server, schema);
    }
    registerOntology(server, schemas);
    registerContextDiscoveryResources(server);

    log('%d generic tools + %d schema-driven tool sets registered', 6, schemas.length);
    return server;
}
