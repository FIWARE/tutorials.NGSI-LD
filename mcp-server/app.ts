import debug from 'debug';
import { FastMCP } from 'fastmcp';
import { loadSchemas } from './lib/schema';
import { loadCoreSchemas } from './lib/core-schema';
import { loadPrompts } from './lib/prompt';
import { registerContextDiscoveryTools } from './controllers/tools/context-discovery';
import { registerQueryEntities } from './controllers/tools/query-entities';
import { registerGetEntity } from './controllers/tools/get-entity';
import { registerGetEntityHistory } from './controllers/tools/get-entity-history';
import { registerGeoQuery } from './controllers/tools/geo-query';
import { registerDynamic } from './controllers/tools/dynamic';
import { registerPrompts } from './controllers/prompts/dynamic';
import { registerOntology } from './controllers/resources/ontology';
import { registerContextDiscoveryResources } from './controllers/resources/context-discovery';
import { TEMPORAL_BROKER } from './lib/constants';

const log = debug('mcp:server');

export async function buildServer(): Promise<FastMCP> {
    const server = new FastMCP({ name: 'ngsi-ld-mcp-server', version: '1.0.0' });

    // Every tool name actually registered below — prompts/*.json's {{tools}}
    // placeholder is resolved against this, so a prompt only ever names a tool
    // this server instance exposes.
    const exposed = new Set<string>();

    // Core NGSI-LD tools — always present.
    const core = await loadCoreSchemas();
    registerContextDiscoveryTools(server, core);
    registerQueryEntities(server);
    exposed.add('query_entities');
    registerGetEntity(server);
    exposed.add('get_entity');
    registerGeoQuery(server);
    exposed.add('query_entities_geo');
    // Temporal interface is optional — no TEMPORAL_BROKER ⇒ no history tools.
    if (TEMPORAL_BROKER) {
        registerGetEntityHistory(server);
        exposed.add('get_entity_history');
    }

    // Ontology resources document every loaded type regardless; typed per-type
    // tools are generated only for the types named in QUERIABLE_TYPES / READABLE_TYPES.
    const schemas = await loadSchemas();
    let typedTools = 0;
    for (const schema of schemas) {
        typedTools += registerDynamic(server, schema, exposed);
    }
    registerOntology(server, schemas);
    registerContextDiscoveryResources(server);

    // Prompts are opt-in via PROMPTS_DIR, same mounted-volume pattern as schemas.
    const prompts = loadPrompts();
    const promptCount = registerPrompts(server, prompts, exposed);

    log(
        '%d generic tools + %d typed tools (temporal %s) + %d ontology resources + %d prompts',
        TEMPORAL_BROKER ? 7 : 6,
        typedTools,
        TEMPORAL_BROKER ? 'on' : 'off',
        schemas.length,
        promptCount
    );
    return server;
}
