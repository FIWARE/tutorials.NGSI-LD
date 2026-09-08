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
    UNKNOWN_ATTRIBUTES,
    ENTITY_DEFAULTS
} from './lib/constants';

const log = debug('mcp:server');

export async function buildServer(): Promise<FastMCP> {
    const server = new FastMCP({ name: 'ngsi-ld-mcp-server', version: '1.0.0' });

    // Every tool name registered below. prompts/*.json's {{tools}} resolves against
    // this, so a prompt only ever names a tool this instance exposes.
    const exposed = new Set<string>();

    // Core NGSI-LD tools, always present.
    const core = await loadCoreSchemas();
    registerContextDiscoveryTools(server, core);
    registerQueryEntities(server);
    exposed.add('query_entities');
    registerGetEntity(server);
    exposed.add('get_entity');
    registerGeoQuery(server);
    exposed.add('query_entities_geo');
    // No TEMPORAL_BROKER, no history tools.
    if (TEMPORAL_BROKER) {
        registerGetEntityHistory(server);
        exposed.add('get_entity_history');
    }

    // Ontology resources cover every loaded type; typed per-type tools are generated
    // only for QUERIABLE_TYPES / READABLE_TYPES.
    const schemas = await loadSchemas();

    // A default for a type with no loaded schema is a config error, not ignorable.
    const loadedTypes = new Set(schemas.map((s) => s.typeName.toLowerCase()));
    for (const type of ENTITY_DEFAULTS.keys()) {
        if (!loadedTypes.has(type.toLowerCase())) {
            throw new Error(`ENTITY_DEFAULTS names unknown type "${type}"; no schema is loaded for it`);
        }
    }

    let typedTools = 0;
    let writeTools = 0;
    for (const schema of schemas) {
        typedTools += registerDynamic(server, schema, exposed);
        // No-ops unless WRITABLE=true and the type is in WRITABLE_TYPES / DELETABLE_TYPES.
        writeTools += registerWrite(server, schema, exposed);
        writeTools += registerDelete(server, schema, exposed);
    }
    // WRITABLE=true with no list: the generic tool stands in (write and delete
    // decided independently).
    if (WRITABLE && !WRITABLE_TYPES_LISTED) {
        writeTools += registerGenericWrite(server, schemas, exposed);
    }
    if (WRITABLE && !DELETABLE_TYPES_LISTED) {
        writeTools += registerGenericDelete(server, exposed);
    }
    registerOntology(server, schemas);
    // The attribute vocabulary guides adding new names; pointless (and its @context
    // fetch wasted) when unmodelled names are rejected.
    if (UNKNOWN_ATTRIBUTES !== 'reject') {
        registerAttributeVocabulary(server, await buildVocabulary(schemas));
    }
    registerContextDiscoveryResources(server);

    // Prompts are opt-in via PROMPTS_DIR.
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
