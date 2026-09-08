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

// NGSILD-Tenant header (paired with NGSILD-Path: /) applied to broker requests.
// READ_TENANT scopes queries/retrievals against CONTEXT_BROKER; WRITE_TENANT
// scopes create/update/delete. They are independent — WRITE_TENANT does not fall
// back to READ_TENANT — so a deployment can read federated data from one tenant
// and write to another. Unset ⇒ the broker's default tenant. Tenant choice is
// deployment config, not an agent concern.
const READ_TENANT = process.env.READ_TENANT || undefined;
const WRITE_TENANT = process.env.WRITE_TENANT || undefined;

// NGSILD-Tenant for temporal requests, independent of READ_TENANT — the temporal
// interface may be a separate service scoped to its own tenant. Unset ⇒ the
// broker's default tenant (does not fall back to READ_TENANT).
const TEMPORAL_TENANT = process.env.TEMPORAL_TENANT || undefined;

// NGSI-LD §6.3.18: append `local=true` to every write so it is not cascaded to
// matching Context Source Registrations (avoids distributed writes / loops).
// Default true; set WRITE_LOCAL_ONLY=false to allow distributed writes.
const WRITE_LOCAL_ONLY = process.env.WRITE_LOCAL_ONLY !== 'false';

// How a create/update handles an attribute name that is not in the target type's
// schema: `accept` (default — encode it best-effort), `reject` (refuse the call),
// or `additionalProperty` (collect all such attributes into one JsonProperty, per
// schema.org/additionalProperty). ADDITIONAL_PROPERTY names that catch-all
// attribute (default `additionalProperty`).
const UNKNOWN_ATTRIBUTES = (() => {
    const v = process.env.UNKNOWN_ATTRIBUTES || 'accept';
    return v === 'reject' || v === 'additionalProperty' ? v : 'accept';
})() as 'accept' | 'reject' | 'additionalProperty';
const ADDITIONAL_PROPERTY = process.env.ADDITIONAL_PROPERTY || 'additionalProperty';

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

// WRITABLE is the master interlock: unless it is exactly "true" the server is
// read-only and NO create/update/delete tool is registered, whatever the *_TYPES
// lists say. Auditing "can this server mutate the broker?" is this one variable.
const WRITABLE = process.env.WRITABLE === 'true';

// With WRITABLE=true, WRITABLE_TYPES gates the mutating tools (create_<type>,
// update_<type>_attribute) and DELETABLE_TYPES gates the destructive tools
// (delete_<type>_attribute, delete_<type>) independently. Same comma-separated /
// "*" / unset semantics as the read lists. There is no generic write or delete
// tool — only the listed types get one.
const isWritableType = typeMatcher(process.env.WRITABLE_TYPES);
const isDeletableType = typeMatcher(process.env.DELETABLE_TYPES);

// Whether a curated list was supplied. With WRITABLE=true: no list ⇒ the generic
// tool (create_entity / delete_entity …); a list ⇒ the typed stubs for those
// types and no generic tool. Write and delete decide this independently.
const WRITABLE_TYPES_LISTED = !!process.env.WRITABLE_TYPES?.trim();
const DELETABLE_TYPES_LISTED = !!process.env.DELETABLE_TYPES?.trim();

// Value for the `providedBy` sub-attribute the write tools attach to every
// measurement they assert (the same attributes that carry `observedAt`). Unset ⇒
// no provenance link is added. Deployment config, not an agent concern.
const PROVIDED_BY = process.env.PROVIDED_BY || undefined;

// ENTITY_DEFAULTS is a JSON object { TypeName: { attr: value, … } }. On create_<type>
// any listed attribute the caller omits is filled in (caller values always win).
// Parsing is strict — a malformed value stops the server starting — and app.ts
// refuses to start if a key names a type with no loaded schema.
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

export {
    CONTEXT_BROKER,
    TEMPORAL_BROKER,
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
    PORT
};
