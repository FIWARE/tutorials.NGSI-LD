# FIWARE NGSI-LD Step-by-Step Tutorials MCP Server

[![Documentation](https://fiware.github.io/catalogue/badges/chapters/documentation.svg)](https://fiware-tutorials.rtfd.io)
[![Docker](https://img.shields.io/docker/pulls/fiware/tutorials.mcp-server.svg)](https://hub.docker.com/r/fiware/tutorials.mcp-server/)
[![Support badge](https://img.shields.io/badge/tag-fiware-orange.svg?logo=stackoverflow)](https://stackoverflow.com/questions/tagged/fiware)
[![NGSI LD](https://img.shields.io/badge/NGSI-LD-d6604d.svg)](https://cim.etsi.org/NGSI-LD/official/front-page.html)
[![JSON LD](https://img.shields.io/badge/JSON--LD-1.1-f06f38.svg)](https://w3c.github.io/json-ld-syntax/)

A TypeScript [`fastmcp`](https://github.com/punkpeye/fastmcp) application for the FIWARE Step-by-Step tutorials: a
**Model Context Protocol (MCP) server** that exposes an NGSI-LD Context Broker to Large Language Model agents as tools
and resources.

It does the NGSI-LD protocol work an LLM should not. It turns a request like `{ "type": "Animal" }` into
`GET /entities?type=Animal`, injects the JSON-LD `@context` through the `Link` header on every broker call, validates the
response against a schema, and returns a token-efficient shape.

## Features

-   **Generic tools**: `query_entities`, `get_entity` and `query_entities_geo` work on any type, with an NGSI-LD `q`
    filter, attribute projection (`pick`) and the broker geo engine (`georel` / `geometry` / `coordinates`).
    `get_entity_history` adds the temporal interface (`timerel` / `timeAt`) when `TEMPORAL_BROKER` is set. `metadataOnly`
    turns any read into a probe: on `query_*` it returns just the `pagination` block with an empty `entities` array; on
    `get_entity` / `get_<type>` it is an existence check returning `{ exists, id, type }` (a missing entity gives
    `{ exists: false }`, not an error).
-   **Schema-driven tools** (opt-in per type): for each Smart Data Models `schema.json` loaded at start-up, a typed
    `query_<type>` when the type is in `QUERIABLE_TYPES`, and `get_<type>` (plus `get_<type>_history` when
    `TEMPORAL_BROKER` is set) when it is in `READABLE_TYPES`. Both lists default to empty. The ontology resources document
    every type regardless and the generic tools cover retrieval, so typed tools only earn their context cost for a small,
    stable set.
-   **Write tools** (off unless `WRITABLE=true`): with `WRITABLE` set, an unset `WRITABLE_TYPES` gives a generic
    `create_entity` / `update_entity_attribute` pair; a set list swaps that for typed `create_<type>` /
    `update_<type>_attribute`. `DELETABLE_TYPES` does the same, independently, for delete. `ENTITY_DEFAULTS` supplies
    per-type default values for creates. The agent passes attributes as `name: value`; the server encodes the NGSI-LD
    attribute type (one of the eight: `Property`, `GeoProperty`, `Relationship`, `VocabProperty`, `LanguageProperty`,
    `ListProperty`, `ListRelationship`, `JsonProperty`), `unitCode` and `observedAt` from the schema's `x-ngsi-type` /
    `x-unitCode` / `x-observedAt` keywords. A `location` GeoProperty is timestamped only when the schema has
    `x-mobile: true`; a bare `[lng, lat]` becomes a GeoJSON Point. `create_<type>` enforces required attributes.
    `update_<type>_attribute` merges one attribute (value and named sub-attributes updated, the rest kept), creates it if
    absent, and takes `unitCode` / `observedAt` overrides. `PROVIDED_BY`, when set, is attached as a `providedBy` link to
    every asserted measurement.
-   **Context discovery**: `list_entity_types`, `get_entity_type`, `list_attributes` and `get_attribute` wrap the
    `/types` and `/attributes` endpoints for run-time introspection.
-   **Prompts** (opt-in): each `prompt.json` (see `PROMPTS_DIR`) becomes an MCP prompt whose template names the tools this
    instance exposes, falling back to the generic tool for any type without a typed one.
-   **Resources**: each model's dereferenced schema is served at `ontology://<model>/<type>`. `ontology://attributes` is
    the canonical attribute-name list: `core` (the NGSI-LD core terms, each with a one-line meaning) and `attributes`
    (every attribute name across the loaded models and the deployment `@context`, sorted). `ngsi://types` and
    `ngsi://attributes` are live views of the broker.
-   **`@context` injection**: the agent never handles a context URI. The server adds the `Link` header on every call;
    reads accept `application/ld+json`, writes send a plain `application/json` body so the `Link` header carries the
    context.

Add `DEBUG=mcp:*` for debug output. All logging goes to `stderr`, safe alongside the stdio transport.

## Environment Variables

### Core

-   `MCP_TRANSPORT` - `stdio` or `http`. Default: `stdio` (the Docker image sets `http`).
-   `MCP_PORT` - Port for the HTTP-stream transport. Default: `3000`.
-   `DEBUG` - Set to `mcp:*` for full output on `stderr`.

### Context Broker

-   `CONTEXT_BROKER` - Base path of the target broker. Default: `http://localhost:1026/ngsi-ld/v1`.
-   `TEMPORAL_BROKER` - Base path of the temporal interface, which may be a separate service (e.g. Mintaka for Orion). No default;
    unset means the history tools are not registered.
-   `NGSI_LD_CONTEXT` - JSON-LD `@context` added to the `Link` header on every call. Default:
    `http://context/ngsi-context.jsonld`.
-   `READ_TENANT` - `NGSILD-Tenant` header (with `NGSILD-Path: /`) on read requests. Unset means the broker's default tenant.
-   `WRITE_TENANT` - Same, for write and delete requests. Independent of `READ_TENANT`, no fallback, so reads and writes
    can target different tenants.
-   `WRITE_LOCAL_ONLY` - Defaults to a `true`, every write appends `?local=true` so the broker does not cascade it
    to matching Context Source Registrations. Set `false` to let writes propagate.
-   `TEMPORAL_TENANT` - Like `READ_TENANT`, for `TEMPORAL_BROKER` requests. Independent, no fallback.

### Schemas

-   `SCHEMA_DIR` - Flat folder of Smart Data Models `schema.json` files, plus a `common/` sub-directory of GSMA and domain
    commons for offline `$ref` resolution. Default: `./schemas` (`/schemas` in the image, a mounted volume). Empty or
    absent is valid; the server then offers only the generic and context-discovery tools.
-   `NGSI_CORE_SCHEMA_DIR` - The bundled context-discovery response schemas. Default: `./ngsi-schemas`. Shipped in the
    image; you should not need to change it.
-   `QUERIABLE_TYPES` - Comma-separated type names (case-insensitive) to get a typed `query_<type>`; `*` for all, unset
    for none. Default: unset.
-   `READABLE_TYPES` - Same, for `get_<type>` (and `get_<type>_history` when `TEMPORAL_BROKER` is set). Default: unset.
    Every loaded schema is still served as an `ontology://<model>/<type>` resource and the generic tools still handle
    retrieval.

### Write Requests

-   `WRITABLE` - Master switch. Only if set to `true` is the server is considered as read-write: no `create_`, `update_` or `delete_` tool,
    whatever the `*_TYPES` lists say. This is the audit point for "can this server mutate the broker?". Default: unset
    (read-only).
-   `WRITABLE_TYPES` - Read only when `WRITABLE=true`. Unset gives one generic `create_entity` /
    `update_entity_attribute` pair (schema-encoded when a schema is loaded for the `type`, else inferred: `urn:ngsi-ld:`
    is a Relationship, GeoJSON a GeoProperty, else a Property). A comma-separated list (or `*`) gives typed
    `create_<type>` / `update_<type>_attribute` per type and no generic tool. Batch operations, subscriptions and
    context-source registrations are out of scope.
-   `DELETABLE_TYPES` - Read only when `WRITABLE=true`, decided independently of `WRITABLE_TYPES`. Unset gives generic
    `delete_entity` / `delete_entity_attribute`; a list gives typed `delete_<type>` / `delete_<type>_attribute` and no
    generic tool. Default: unset.
-   `ENTITY_DEFAULTS` - JSON `{ "TypeName": { "attr": value } }`. On `create_<type>` a listed attribute the caller omits
    is filled in from here; caller values win, an explicit `null` suppresses a default. Values are simplified form and go
    through the usual schema encoding. Strict parse: bad JSON stops start-up, and so does a key naming a type with no
    loaded schema. Default: unset.
-   `PROVIDED_BY` - URN attached as a `providedBy` relationship to every asserted measurement (the `x-observedAt`
    attributes, plus a moving `location`). Unset means no provenance link.
-   `UNKNOWN_ATTRIBUTES` - How create/update handles an attribute not in the target type's schema: `accept` (default,
    encode best-effort), `reject` (fail the call), or `additionalProperty` (collect into one `JsonProperty`). In
    `additionalProperty` mode, `update_<type>_attribute` deep-merges an unmodelled attr into that JsonProperty;
    `delete_<type>_attribute` removes one with the `urn:ngsi-ld:null` sentinel; and `query_<type>` / `get_<type>` /
    `get_entity` lift its members to the top level so they read as ordinary fields. The agent addresses collected
    attributes by their plain name: a `q` clause like `colour=="red"` is rewritten to `additionalProperty[colour]=="red"`,
    and a `pick` of an unmodelled name pulls the container back so the member survives projection. Generic
    `query_entities` has no schema and cannot rewrite `q`; use bracket syntax there. Not surfaced in the tool
    descriptions.
-   `ADDITIONAL_PROPERTY` - Name of that catch-all `JsonProperty`. Default: `additionalProperty`.

### Prompts

-   `PROMPTS_DIR` - Flat folder of prompt `*.json` specs. Default: `./prompts` (`/prompts` in the image, a mounted
    volume). Empty or absent is valid; the server then offers no prompts.

    Each file is one MCP prompt. `name`, `description` and `template` are required. `arguments` maps each argument name to
    the description shown to the caller (one starting with "Optional" is optional, the rest required). `template` is plain
    text with `{{placeholder}}` tokens, filled at call time from: the caller's argument values; `{{type}}` (the prompt's
    `types` entry, or a comma-joined list for more than one); `{{tools}}`, resolved from `tools` patterns like
    `"get_{{type}}"` or `"query_entities_geo"`. A `{{type}}` pattern expands once per `types` entry, keeping the typed
    tool name only if this instance exposes it, otherwise falling back to the pattern's generic tool. Every other
    top-level field (`pick`, `relationships`, `rules`, ...) is stringified as-is: an array joins with `, `, an object
    renders as `key: value` pairs joined with `; `.

### Validation and Retrieval

-   `SCHEMA_VALIDATION` - For a broker payload that fails its schema: `filter` drops the offending entities and returns
    the rest, `strict` returns an error, `off` passes it through. Default: `filter`.
-   `ENTITY_LIMIT` - Default and maximum for the query tools' `limit`. Default: `100`. Every `query_*` call sends
    `count=true` and returns a `pagination` block (`total`, `limit`, `offset`, `returned`, `hasMore`, `nextOffset`)
    alongside `entities`. When matches remain, a leading `_notice` tells the agent to page or narrow rather than treat the
    first page as complete.
-   `SEND_PICK_AS_ATTRS` - `true` remaps `pick` to the deprecated `attrs` parameter for brokers that predate NGSI-LD v1.4.
    Default: `false`.

## Building

TypeScript; compile before running.

```console
npm install
npm run build
npm start
```

Debug output:

```console
DEBUG=mcp:* npm start
```

Tests:

```console
npm test
```

The image expects the Smart Data Models schemas as a mounted volume at `/schemas`, and optionally prompt specs at
`/prompts`:

```console
docker run --rm -p 3000:3000 \
  -e CONTEXT_BROKER=http://orion:1026/ngsi-ld/v1 \
  -v "$(pwd)/schemas:/schemas:ro" \
  -v "$(pwd)/prompts:/prompts:ro" \
  fiware/tutorials.mcp-server
```

---

## License

[MIT](LICENSE) © 2026 FIWARE Foundation e.V.
