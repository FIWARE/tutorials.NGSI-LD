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

// Which loaded schemas get typed tools: QUERIABLE_TYPES for query_<type>,
// READABLE_TYPES for get_<type>(_history). Comma-separated names, "*" all, unset none.
function typeMatcher(raw: string | undefined): (typeName: string) => boolean {
    const entries = (raw || '')
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
    if (entries.includes('*')) {
        return () => true;
    }
    const set = new Set(entries);
    return (typeName) => set.has(typeName.toLowerCase());
}

const isQueriableType = typeMatcher(process.env.QUERIABLE_TYPES);
const isReadableType = typeMatcher(process.env.READABLE_TYPES);

// Master interlock: unless it is exactly "true" the server is read-only and no
// create/update/delete tool is registered, whatever the *_TYPES lists say.
const WRITABLE = process.env.WRITABLE === 'true';

// With WRITABLE=true, these gate the typed write and delete tools independently.
// Same comma-separated / "*" / unset semantics as the read lists; no generic tool.
const isWritableType = typeMatcher(process.env.WRITABLE_TYPES);
const isDeletableType = typeMatcher(process.env.DELETABLE_TYPES);

// Was a list supplied? No list means the generic tool (create_entity ...); a list
// means typed tools for those types only. Write and delete decide independently.
const WRITABLE_TYPES_LISTED = !!process.env.WRITABLE_TYPES?.trim();
const DELETABLE_TYPES_LISTED = !!process.env.DELETABLE_TYPES?.trim();

// `providedBy` URN the write tools attach to every measurement they assert (the
// attributes that carry `observedAt`). Unset means no provenance link.
const PROVIDED_BY = process.env.PROVIDED_BY || undefined;

// JSON { TypeName: { attr: value } }. On create_<type> any listed attribute the
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
    isQueriableType,
    isReadableType,
    WRITABLE,
    isWritableType,
    isDeletableType,
    WRITABLE_TYPES_LISTED,
    DELETABLE_TYPES_LISTED,
    PROVIDED_BY,
    ENTITY_DEFAULTS,
    entityDefaultsFor,
    SEND_PICK_AS_ATTRS,
    TRANSPORT,
    PORT,
    HOST
};
