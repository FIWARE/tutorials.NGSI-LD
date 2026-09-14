import debug from 'debug';
import { FastMCP } from 'fastmcp';
import { loadCoreSchemas } from './lib/core-schema';
import { loadPrompts } from './lib/prompt';
import { registerContextDiscoveryTools } from './controllers/tools/context-discovery';
import { registerQueryEntities } from './controllers/tools/query-entities';
import { registerGetEntity } from './controllers/tools/get-entity';
import { registerGetEntityHistory } from './controllers/tools/get-entity-history';
import { registerGeoQuery } from './controllers/tools/geo-query';
import { registerGenericWrite } from './controllers/tools/write';
import { registerGenericDelete } from './controllers/tools/delete';
import { registerPrompts } from './controllers/prompts/dynamic';
import { registerOntology, registerAttributeVocabulary } from './controllers/resources/ontology';
import { registerContextDiscoveryResources } from './controllers/resources/context-discovery';
import { buildVocabulary } from './lib/vocabulary';
import { SchemaRegistry } from './lib/registry';
import { verifyBearer } from './lib/auth';
import type { Session } from './lib/session';
import {
    TEMPORAL_BROKER,
    WRITABLE,
    UNKNOWN_ATTRIBUTES,
    ENTITY_DEFAULTS,
    DISCOVERY,
    AUTH_ENABLED,
    OIDC_ISSUER,
    OIDC_JWKS_URI,
    OIDC_TOKEN_URL,
    OIDC_AUTHORIZE_URL,
    MCP_RESOURCE_URL
} from './lib/constants';

const log = debug('mcp:server');

// Server-wide guidance surfaced to the agent in the initialize response.
const INSTRUCTIONS = [
    'Relationships are graph edges. An attribute value of `{object: "<URN>"}` (a bare "<URN>"',
    'string in compact mode) points to another entity. For a "why / how / explain" question',
    'about an entity, call `get_entity` with `neighbourhood=true` FIRST, before chasing',
    'hypotheses across other entity types: it returns the entity plus, per relationship, the',
    'target entities and every same-type entity that shares that relationship value (e.g. the',
    "others in the same barn). Read the neighbours' own relationships too — the explanation",
    "is often a neighbour pointing back at the entity (a newborn's `calvedBy`, say), not an",
    'attribute on the entity itself. Do not `pick` a `neighbourhood` call; trimming hides the',
    'edges that carry the answer. For a single manual hop, fetch the URN; to go the other',
    'way, filter — `ownedBy=="<URN>"` finds every entity that points at one.',
    '',
    'Do not guess attribute names. An `ontology://<model>/<type>` resource is the full JSON',
    'Schema for a type (common attributes included); `discover_context_meta_data` shows only what',
    'is populated on entities now, so it can be incomplete. Check one before using a name in `filter`,',
    '`pick` or a write.',
    '',
    'A failed tool call is data, not a conversational event. Do not apologise and do not',
    'narrate an interim step ("that failed, let me try again") — act on the result directly.',
    'A failed result carries `structuredContent` with `category` and `retryable`:',
    '- retryable true (category "network" or "server"): retry the same call.',
    '- category "bad_request": the arguments are wrong — fix `filter`, `pick`, coordinates or',
    '  attribute values and call again.',
    '- category "not_found": the target does not exist — do not retry; use a different id',
    '  or report it.',
    '- category "auth": cannot be resolved here — report it.',
    'An empty query result (`entities: []`, `pagination.total` 0) is a valid answer, not a',
    'failure — report it plainly.'
].join('\n');

// RFC 9728 protected-resource metadata plus the RFC 8414 authorization-server
// metadata, so a client holding no token can find the OIDC provider from a 401 alone.
function oauthConfig() {
    if (!AUTH_ENABLED || !OIDC_ISSUER || !MCP_RESOURCE_URL) {
        return undefined;
    }
    return {
        enabled: true as const,
        protectedResource: {
            resource: MCP_RESOURCE_URL,
            authorizationServers: [OIDC_ISSUER],
            bearerMethodsSupported: ['header'],
            scopesSupported: ['openid', 'profile', 'email']
        },
        authorizationServer: {
            issuer: OIDC_ISSUER,
            authorizationEndpoint: OIDC_AUTHORIZE_URL,
            tokenEndpoint: OIDC_TOKEN_URL,
            jwksUri: OIDC_JWKS_URI,
            registrationEndpoint: `${OIDC_ISSUER}/clients-registrations/openid-connect`,
            responseTypesSupported: ['code'],
            grantTypesSupported: ['authorization_code', 'refresh_token', 'client_credentials'],
            codeChallengeMethodsSupported: ['S256'],
            scopesSupported: ['openid', 'profile', 'email']
        }
    };
}

export async function buildServer(): Promise<FastMCP<Session>> {
    const server = new FastMCP<Session>({
        name: 'ngsi-ld-mcp-server',
        version: '1.0.0',
        instructions: INSTRUCTIONS,
        // The gateway checks the token too, but it cannot see which tool is being
        // called, so per-tool authorization needs the claims here.
        ...(AUTH_ENABLED ? { authenticate: verifyBearer } : {}),
        ...(oauthConfig() ? { oauth: oauthConfig() } : {}),
        // An unauthenticated probe of this server, as opposed to the broker.
        health: { enabled: true, path: '/health' }
    });

    // Every tool name registered below. prompts/*.json's {{tools}} resolves against
    // this, so a prompt only ever names a tool this instance exposes.
    const exposed = new Set<string>();

    const core = await loadCoreSchemas();

    // Disk schemas, then whatever the broker itself reports. Tools read the registry
    // rather than a captured array, so a later refresh reaches them.
    const registry = new SchemaRegistry();
    await registry.load();
    const schemas = registry.get().schemas;
    registerContextDiscoveryTools(server, { core, registry });

    // The query tools take the loaded schemas so `expandValues` auto-fills for
    // enumerated `q` filters.
    registerGetEntity(server);
    exposed.add('get_entity');
    // No TEMPORAL_BROKER, no history tools.
    if (TEMPORAL_BROKER) {
        registerGetEntityHistory(server);
        exposed.add('get_entity_history');
    }
    registerQueryEntities(server, schemas);
    exposed.add('query_entities');
    registerGeoQuery(server, schemas);
    exposed.add('geoquery_entities');

    // A default for a type with no loaded schema is a config error — unless discovery
    // is on, where the type may simply have no entities on the broker yet.
    const loadedTypes = new Set(schemas.map((s) => s.typeName.toLowerCase()));
    for (const type of ENTITY_DEFAULTS.keys()) {
        if (loadedTypes.has(type.toLowerCase())) {
            continue;
        }
        if (DISCOVERY === 'off') {
            throw new Error(`ENTITY_DEFAULTS names unknown type "${type}"; no schema is loaded for it`);
        }
        log('ENTITY_DEFAULTS names "%s", which no schema covers yet', type);
    }

    let writeTools = 0;
    if (WRITABLE) {
        writeTools += registerGenericWrite(server, registry, exposed);
        writeTools += registerGenericDelete(server, exposed);
    }
    registerOntology(server, registry);
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
        '%d generic tools + %d write/delete tools (temporal %s, writable %s) + %d ontology resources + %d prompts',
        TEMPORAL_BROKER ? 5 : 4,
        writeTools,
        TEMPORAL_BROKER ? 'on' : 'off',
        WRITABLE ? 'on' : 'off',
        schemas.length,
        promptCount
    );
    return server;
}
