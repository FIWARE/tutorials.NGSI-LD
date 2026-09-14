// Environment configuration for the NGSI-LD MCP server.

// Location of the Orion-LD Context Broker.
const CONTEXT_BROKER = process.env.CONTEXT_BROKER || 'http://localhost:1026/ngsi-ld/v1';

// NGSI-LD temporal interface (Mintaka, or Orion-LD's own /temporal). No default;
// unset means the history tools are not registered.
const TEMPORAL_BROKER = process.env.TEMPORAL_BROKER || undefined;

// History lives on a different origin than current state, so the history tools say so.
const TEMPORAL_BROKER_SEPARATE = !!TEMPORAL_BROKER && TEMPORAL_BROKER !== CONTEXT_BROKER;

// JSON-LD @context served to the broker via the Link header on every call.
// The agent never sees or handles this.
const CONTEXT = process.env.NGSI_LD_CONTEXT || 'http://context/ngsi-context.jsonld';
const LinkHeader = `<${CONTEXT}>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"`;

// NGSILD-Tenant header (with NGSILD-Path: /). READ_TENANT scopes reads, WRITE_TENANT
// writes; independent, no fallback, so reads and writes can hit different tenants.
const READ_TENANT = process.env.READ_TENANT || undefined;
const WRITE_TENANT = process.env.WRITE_TENANT || undefined;

// NGSILD-Tenant for temporal requests. Independent of READ_TENANT, no fallback.
const TEMPORAL_TENANT = process.env.TEMPORAL_TENANT || undefined;

// `local=true` on every write so it is not cascaded to matching Context Source
// Registrations. Set WRITE_LOCAL_ONLY=false to allow distributed writes.
const WRITE_LOCAL_ONLY = process.env.WRITE_LOCAL_ONLY !== 'false';

// Attribute name not in the type's schema: `accept` (encode best-effort), `reject`
// (refuse the call), or `additionalProperty` (collect into one JsonProperty).
const UNKNOWN_ATTRIBUTES = (() => {
    const v = process.env.UNKNOWN_ATTRIBUTES || 'accept';
    return v === 'reject' || v === 'additionalProperty' ? v : 'accept';
})() as 'accept' | 'reject' | 'additionalProperty';
const ADDITIONAL_PROPERTY = process.env.ADDITIONAL_PROPERTY || 'additionalProperty';

const SCHEMA_DIR = process.env.SCHEMA_DIR || `${__dirname}/../schemas`;
const COMMON_DIR = `${SCHEMA_DIR}/common`;
const CORE_SCHEMA_DIR = `${__dirname}/../ngsi-schemas`;
const VALIDATION = process.env.SCHEMA_VALIDATION || 'filter';

// Flat folder of prompt.json specs. Empty or absent is valid; the server offers no prompts.
const PROMPTS_DIR = process.env.PROMPTS_DIR || `${__dirname}/../prompts`;

const ENTITY_LIMIT = Number(process.env.ENTITY_LIMIT || 100);

// Master interlock: unless it is exactly "true" the server is read-only and no
// create/update/delete tool is registered.
const WRITABLE = process.env.WRITABLE === 'true';

// `providedBy` URN the write tools attach to every measurement they assert (the
// attributes that carry `observedAt`). Unset means no provenance link.
const PROVIDED_BY = process.env.PROVIDED_BY || undefined;

// JSON { TypeName: { attr: value } }. On create_entity, any listed attribute the
// caller omits is filled in (caller wins). Strict parse; a bad value stops startup.
export function parseEntityDefaults(raw: string | undefined): Map<string, Record<string, unknown>> {
    const map = new Map<string, Record<string, unknown>>();
    if (!raw || !raw.trim()) {
        return map;
    }
    let obj: unknown;
    try {
        obj = JSON.parse(raw);
    } catch (e) {
        throw new Error(`ENTITY_DEFAULTS is not valid JSON: ${(e as Error).message}`);
    }
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
        throw new Error('ENTITY_DEFAULTS must be a JSON object of { TypeName: { attr: value } }');
    }
    for (const [type, values] of Object.entries(obj as Record<string, unknown>)) {
        if (typeof values !== 'object' || values === null || Array.isArray(values)) {
            throw new Error(`ENTITY_DEFAULTS["${type}"] must be an object of attribute values`);
        }
        map.set(type, values as Record<string, unknown>);
    }
    return map;
}

const ENTITY_DEFAULTS = parseEntityDefaults(process.env.ENTITY_DEFAULTS);

// Case-insensitive lookup of the default attribute values for a type.
function entityDefaultsFor(typeName: string): Record<string, unknown> {
    const want = typeName.toLowerCase();
    for (const [key, values] of ENTITY_DEFAULTS) {
        if (key.toLowerCase() === want) {
            return values;
        }
    }
    return {};
}

const SEND_PICK_AS_ATTRS = process.env.SEND_PICK_AS_ATTRS === 'true';

// Master interlock for OAuth. Off, the server accepts anonymous sessions and sends
// no Authorization header — the shape every unsecured tutorial relies on.
const AUTH_ENABLED = process.env.AUTH_ENABLED === 'true';

// Keycloak realm URL, e.g. http://keycloak:8080/realms/farm-management.
const OIDC_ISSUER = process.env.OIDC_ISSUER || undefined;
const OIDC_JWKS_URI = process.env.OIDC_JWKS_URI || `${OIDC_ISSUER}/protocol/openid-connect/certs`;
const OIDC_TOKEN_URL = process.env.OIDC_TOKEN_URL || `${OIDC_ISSUER}/protocol/openid-connect/token`;
const OIDC_AUTHORIZE_URL = process.env.OIDC_AUTHORIZE_URL || `${OIDC_ISSUER}/protocol/openid-connect/auth`;
// Unset means the audience claim is not checked — Keycloak only populates `aud`
// once an audience mapper is configured, so this is opt-in.
const OIDC_AUDIENCE = process.env.OIDC_AUDIENCE || undefined;

// Client credentials for the server's own calls: start-up discovery, and any
// request with no caller token (stdio transport).
const OIDC_CLIENT_ID = process.env.OIDC_CLIENT_ID || undefined;
const OIDC_CLIENT_SECRET = process.env.OIDC_CLIENT_SECRET || undefined;

// Canonical resource identifier published in the RFC 9728 metadata. This is the
// gateway URL a client actually calls, not the in-network one.
const MCP_RESOURCE_URL = process.env.MCP_RESOURCE_URL || undefined;

// Realm roles allowed to use write/delete; a caller without one never sees them in tools/list.
// `role` may write every type, `role:TypeA|TypeB` only those.
const WRITE_ROLES: Map<string, string[] | null> = new Map(
    (process.env.WRITE_ROLES || 'farm-manager,livestock-supervisor:Animal|Water|FillingLevelSensor')
        .split(',')
        .map((r) => r.trim())
        .filter(Boolean)
        .map((r) => {
            const [role, types] = r.split(':');
            return [
                role.trim(),
                types === undefined
                    ? null
                    : types
                          .split('|')
                          .map((t) => t.trim())
                          .filter(Boolean)
            ];
        })
);

// `merge` adds broker-discovered types to the curated ones in SCHEMA_DIR; it never replaces
// a curated schema, since GET /types and attributeDetails only see currently-populated attributes.
const DISCOVERY = (() => {
    const v = process.env.DISCOVERY || 'off';
    return v === 'merge' ? v : 'off';
})() as 'off' | 'merge';

// Seconds before a discovered set is considered stale. 0 means start-up only.
const DISCOVERY_TTL = Number(process.env.DISCOVERY_TTL || 0);

// Where an entity type URI is resolved to a curated JSON Schema.
const SDM_BASE_URL = process.env.SDM_BASE_URL || 'https://raw.githubusercontent.com/smart-data-models';

const TRANSPORT = process.env.MCP_TRANSPORT || 'stdio';
const PORT = Number(process.env.MCP_PORT || 3000);
// fastmcp 4's HTTP transport binds this host; unset it defaults to IPv6 localhost
// only, which is unreachable on 127.0.0.1. Bind all interfaces so both resolve.
const HOST = process.env.MCP_HOST || '0.0.0.0';

export {
    CONTEXT_BROKER,
    TEMPORAL_BROKER,
    TEMPORAL_BROKER_SEPARATE,
    CONTEXT,
    LinkHeader,
    READ_TENANT,
    WRITE_TENANT,
    WRITE_LOCAL_ONLY,
    UNKNOWN_ATTRIBUTES,
    ADDITIONAL_PROPERTY,
    TEMPORAL_TENANT,
    SCHEMA_DIR,
    COMMON_DIR,
    CORE_SCHEMA_DIR,
    PROMPTS_DIR,
    VALIDATION,
    ENTITY_LIMIT,
    WRITABLE,
    PROVIDED_BY,
    ENTITY_DEFAULTS,
    entityDefaultsFor,
    SEND_PICK_AS_ATTRS,
    AUTH_ENABLED,
    OIDC_ISSUER,
    OIDC_JWKS_URI,
    OIDC_TOKEN_URL,
    OIDC_AUTHORIZE_URL,
    OIDC_AUDIENCE,
    OIDC_CLIENT_ID,
    OIDC_CLIENT_SECRET,
    MCP_RESOURCE_URL,
    WRITE_ROLES,
    DISCOVERY,
    DISCOVERY_TTL,
    SDM_BASE_URL,
    TRANSPORT,
    PORT,
    HOST
};
