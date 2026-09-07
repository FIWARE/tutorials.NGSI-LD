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
import { registerWrite, registerGenericWrite } from './controllers/tools/write';
import { registerDelete, registerGenericDelete } from './controllers/tools/delete';
import { registerPrompts } from './controllers/prompts/dynamic';
import { registerOntology, registerAttributeVocabulary } from './controllers/resources/ontology';
import { registerContextDiscoveryResources } from './controllers/resources/context-discovery';
import { buildVocabulary } from './lib/vocabulary';
import {
    TEMPORAL_BROKER,
    WRITABLE,
    WRITABLE_TYPES_LISTED,
    DELETABLE_TYPES_LISTED,
    ENTITY_DEFAULTS
} from './lib/constants';

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

    // Fail fast: a default configured for a type we have no schema for is a config
    // error, not something to silently ignore.
    const loadedTypes = new Set(schemas.map((s) => s.typeName.toLowerCase()));
    for (const type of ENTITY_DEFAULTS.keys()) {
        if (!loadedTypes.has(type.toLowerCase())) {
            throw new Error(`ENTITY_DEFAULTS names unknown type "${type}" — no schema is loaded for it`);
        }
    }

    let typedTools = 0;
    let writeTools = 0;
    for (const schema of schemas) {
        typedTools += registerDynamic(server, schema, exposed);
        // No-ops unless WRITABLE=true AND the type is named in WRITABLE_TYPES / DELETABLE_TYPES.
        writeTools += registerWrite(server, schema, exposed);
        writeTools += registerDelete(server, schema, exposed);
    }
    // With WRITABLE=true and no list, the generic tool stands in for the typed stubs
    // (write and delete decided independently).
    if (WRITABLE && !WRITABLE_TYPES_LISTED) {
        writeTools += registerGenericWrite(server, schemas, exposed);
    }
    if (WRITABLE && !DELETABLE_TYPES_LISTED) {
        writeTools += registerGenericDelete(server, exposed);
    }
    registerOntology(server, schemas);
    registerAttributeVocabulary(server, await buildVocabulary(schemas));
    registerContextDiscoveryResources(server);

    // Prompts are opt-in via PROMPTS_DIR, same mounted-volume pattern as schemas.
    const prompts = loadPrompts();
    const promptCount = registerPrompts(server, prompts, exposed);

    log(
        '%d generic tools + %d typed tools + %d write/delete tools (temporal %s, writable %s) + %d ontology resources + %d prompts',
        TEMPORAL_BROKER ? 7 : 6,
        typedTools,
        writeTools,
        TEMPORAL_BROKER ? 'on' : 'off',
        WRITABLE ? 'on' : 'off',
        schemas.length,
        promptCount
    );
    return server;
}
