// Environment configuration for the NGSI-LD MCP server. See ARCHITECTURE.md §9.

// Location of the Orion-LD Context Broker.
const BASE_PATH = process.env.CONTEXT_BROKER || 'http://localhost:1026/ngsi-ld/v1';

// JSON-LD @context served to the broker via the Link header on every call.
// The agent never sees or handles this.
const CONTEXT = process.env.NGSI_LD_CONTEXT || 'http://context/ngsi-context.jsonld';
const LinkHeader = `<${CONTEXT}>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"`;

// NGSILD-Tenant header (paired with NGSILD-Path: /) applied to every broker request.
// Unset ⇒ the broker's default tenant. Tenant choice is deployment config, not an agent concern.
const TENANT = process.env.NGSI_LD_TENANT || undefined;

const SCHEMA_DIR = process.env.SCHEMA_DIR || `${__dirname}/../schemas`;
const COMMON_DIR = `${SCHEMA_DIR}/common`;
const CORE_SCHEMA_DIR = `${__dirname}/../ngsi-schemas`;
const VALIDATION = process.env.SCHEMA_VALIDATION || 'filter';

const ENTITY_LIMIT = Number(process.env.ENTITY_LIMIT || 100);

const SEND_PICK_AS_ATTRS = process.env.SEND_PICK_AS_ATTRS === 'true';

const TRANSPORT = process.env.MCP_TRANSPORT || 'stdio';
const PORT = Number(process.env.MCP_PORT || 3000);

export {
    BASE_PATH,
    CONTEXT,
    LinkHeader,
    TENANT,
    SCHEMA_DIR,
    COMMON_DIR,
    CORE_SCHEMA_DIR,
    VALIDATION,
    ENTITY_LIMIT,
    SEND_PICK_AS_ATTRS,
    TRANSPORT,
    PORT
};
