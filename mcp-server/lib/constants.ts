// Environment configuration for the NGSI-LD MCP server. See ARCHITECTURE.md §9.

// Location of the Orion-LD Context Broker.
const CONTEXT_BROKER = process.env.CONTEXT_BROKER || 'http://localhost:1026/ngsi-ld/v1';

// Base path of the NGSI-LD temporal interface (e.g. Mintaka, or Orion-LD's own
// /temporal endpoint). Optional and has no default: when unset the history tools
// (get_entity_history and every get_<type>_history) are not registered.
const TEMPORAL_BROKER = process.env.TEMPORAL_BROKER || undefined;

// JSON-LD @context served to the broker via the Link header on every call.
// The agent never sees or handles this.
const CONTEXT = process.env.NGSI_LD_CONTEXT || 'http://context/ngsi-context.jsonld';
const LinkHeader = `<${CONTEXT}>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"`;

// NGSILD-Tenant header (paired with NGSILD-Path: /) applied to every broker request.
// Unset ⇒ the broker's default tenant. Tenant choice is deployment config, not an agent concern.
const TENANT = process.env.NGSI_LD_TENANT || undefined;

// NGSILD-Tenant for temporal requests, independent of TENANT above — the temporal
// interface may be a separate service scoped to its own tenant. Unset ⇒ the
// broker's default tenant (does not fall back to TENANT).
const TEMPORAL_TENANT = process.env.TEMPORAL_TENANT || undefined;

const SCHEMA_DIR = process.env.SCHEMA_DIR || `${__dirname}/../schemas`;
const COMMON_DIR = `${SCHEMA_DIR}/common`;
const CORE_SCHEMA_DIR = `${__dirname}/../ngsi-schemas`;
const VALIDATION = process.env.SCHEMA_VALIDATION || 'filter';

// Directory of prompt.json specs, one flat folder — same mounted-volume pattern as
// SCHEMA_DIR. Empty or absent is valid: the server then offers no prompts.
const PROMPTS_DIR = process.env.PROMPTS_DIR || `${__dirname}/../prompts`;

const ENTITY_LIMIT = Number(process.env.ENTITY_LIMIT || 100);

// Which loaded schemas get typed tools generated. QUERIABLE_TYPES drives
// query_<type>, READABLE_TYPES drives get_<type> and get_<type>_history. Each is
// a comma-separated list of type names (case-insensitive), "*" for all, or unset
// for none — the ontology resources still document every type and the generic
// tools still cover retrieval.
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

const SEND_PICK_AS_ATTRS = process.env.SEND_PICK_AS_ATTRS === 'true';

const TRANSPORT = process.env.MCP_TRANSPORT || 'stdio';
const PORT = Number(process.env.MCP_PORT || 3000);

export {
    CONTEXT_BROKER,
    TEMPORAL_BROKER,
    CONTEXT,
    LinkHeader,
    TENANT,
    TEMPORAL_TENANT,
    SCHEMA_DIR,
    COMMON_DIR,
    CORE_SCHEMA_DIR,
    PROMPTS_DIR,
    VALIDATION,
    ENTITY_LIMIT,
    isQueriableType,
    isReadableType,
    SEND_PICK_AS_ATTRS,
    TRANSPORT,
    PORT
};
