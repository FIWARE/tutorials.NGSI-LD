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

- **Generic tools**: `query_entities`, `get_entity` and `geoquery_entities` work on any type, with an NGSI-LD `q`
  filter, attribute projection (`pick`) and the broker geo engine (`georel` / `geometry` / `coordinates`).
  `geoquery_entities` always includes `geoproperty` (default `location`) in the response even when `pick` omits
  it. `get_entity_history` adds the temporal interface (`timerel` / `timeAt`) when `TEMPORAL_BROKER` is set.
  `metadataOnly` turns any read into a probe: just the `pagination` block on `query_*`, or `{ exists, id, type }`
  on `get_entity` (`{ exists: false }` for a missing entity, not an error).
- **Write tools** (off unless `WRITABLE=true`): `create_entity` / `upsert_attribute`, plus `delete_entity` /
  `delete_attribute`. `ENTITY_DEFAULTS` supplies per-type default values for creates. The agent passes
  attributes as `name: value`; the server encodes the NGSI-LD attribute type (one of the eight: `Property`,
  `GeoProperty`, `Relationship`, `VocabProperty`, `LanguageProperty`, `ListProperty`, `ListRelationship`,
  `JsonProperty`), `unitCode` and `observedAt` from the schema's `x-ngsi-type` / `x-unitCode` / `x-observedAt`
  keywords when a schema is loaded for the type (else inferred from the value). A `location` GeoProperty is
  timestamped only when the schema has `x-mobile: true`; a bare `[lng, lat]` becomes a GeoJSON Point.
  `create_entity` enforces required attributes when a schema is loaded. `upsert_attribute` merges one
  attribute (value and named sub-attributes updated, the rest kept), creates it if absent, and takes `unitCode` /
  `observedAt` overrides. `PROVIDED_BY`, when set, is attached as a `providedBy` link to every asserted measurement.
- **Context discovery**: `discover_context_meta_data` covers what exists — `live_data` (live broker state: types
  and attributes) plus three schema-derived maps that are always complete even before anything is populated:
  `enums` (allowed values per attribute), `relationships` and `properties` (every attribute, split by NGSI-LD
  kind, each as `{ relationship, property, description }`). `pick` selects which kinds to return (omit for all
  four); `name` drills into one item instead of listing every one; `compact` trims a `live_data` listing to just
  names. `live_data` also carries an `ontology`/`ontologies` link to the full modelled schema (required
  attributes, units, nested structure) for when this tool's own data isn't enough. See the tool's own description
  for the exact per-kind resolution rules and response shape.
- **Prompts** (opt-in): each `prompt.json` (see `PROMPTS_DIR`) becomes an MCP prompt whose template names the tools this
  instance exposes.
- **Resources**: each model's dereferenced schema is served at `ontology://<model>/<type>`. `ontology://attributes` is
  the canonical attribute-name list: `core` (the NGSI-LD core terms, each with a one-line meaning) and `attributes`
  (every attribute name across the loaded models and the deployment `@context`, sorted). `ngsi://types` and
  `ngsi://attributes` are live views of the broker.
- **`@context` injection**: the agent never handles a context URI. The server adds the `Link` header on every call;
  reads accept `application/ld+json`, writes send a plain `application/json` body so the `Link` header carries the
  context.

Add `DEBUG=mcp:*` for debug output. All logging goes to `stderr`, safe alongside the stdio transport.

## Environment Variables

### Core

- `MCP_TRANSPORT` - `stdio` or `http`. Default: `stdio` (the Docker image sets `http`).
- `MCP_PORT` - Port for the HTTP-stream transport. Default: `3000`.
- `DEBUG` - Set to `mcp:*` for full output on `stderr`.

### Context Broker

- `CONTEXT_BROKER` - Base path of the target broker. Default: `http://localhost:1026/ngsi-ld/v1`.
- `TEMPORAL_BROKER` - Base path of the temporal interface, which may be a separate service (e.g. Mintaka for Orion). No default;
  unset means the history tools are not registered.
- `NGSI_LD_CONTEXT` - JSON-LD `@context` added to the `Link` header on every call. Default:
  `http://context/ngsi-context.jsonld`.
- `READ_TENANT` - `NGSILD-Tenant` header (with `NGSILD-Path: /`) on read requests. Unset means the broker's default tenant.
- `WRITE_TENANT` - Same, for write and delete requests. Independent of `READ_TENANT`, no fallback, so reads and writes
  can target different tenants.
- `WRITE_LOCAL_ONLY` - Defaults to a `true`, every write appends `?local=true` so the broker does not cascade it
  to matching Context Source Registrations. Set `false` to let writes propagate.
- `TEMPORAL_TENANT` - Like `READ_TENANT`, for `TEMPORAL_BROKER` requests. Independent, no fallback.

### Schemas

- `SCHEMA_DIR` - Flat folder of Smart Data Models `schema.json` files, plus a `common/` sub-directory of GSMA and domain
  commons for offline `$ref` resolution. Default: `./schemas` (`/schemas` in the image, a mounted volume). Empty or
  absent is valid; the server then offers only the generic and context-discovery tools.
- `NGSI_CORE_SCHEMA_DIR` - The bundled context-discovery response schemas. Default: `./ngsi-schemas`. Shipped in the
  image; you should not need to change it.

### Write Requests

- `WRITABLE` - Master switch: unless set to exactly `"true"`, the server is read-only and no `create_entity`,
  `upsert_attribute`, `delete_entity` or `delete_attribute` tool is registered. The audit point for "can this
  server mutate the broker?". Default: unset (read-only).
- `ENTITY_DEFAULTS` - JSON `{ "TypeName": { "attr": value } }`. On `create_entity` a listed attribute the caller
  omits is filled in from here; caller values win, an explicit `null` suppresses a default. Values are simplified
  form and go through the usual schema encoding. Strict parse: bad JSON stops start-up, and so does a key naming a
  type with no loaded schema. Default: unset.
- `PROVIDED_BY` - URN attached as a `providedBy` relationship to every asserted measurement (the `x-observedAt`
  attributes, plus a moving `location`). Unset means no provenance link.
- `UNKNOWN_ATTRIBUTES` - How create/update handles an attribute not in the target type's schema: `accept` (default,
  encode best-effort), `reject` (fail the call), or `additionalProperty` (collect into one `JsonProperty`). In
  `additionalProperty` mode, `upsert_attribute` deep-merges an unmodelled attr into that JsonProperty;
  `delete_attribute` removes one with the `urn:ngsi-ld:null` sentinel; and `query_entities` / `get_entity`
  lift its members to the top level so they read as ordinary fields. The agent addresses collected attributes by
  their plain name: a `q` clause like `colour=="red"` is rewritten to `additionalProperty[colour]=="red"`, and a
  `pick` of an unmodelled name pulls the container back so the member survives projection. Not surfaced in the tool
  descriptions.
- `ADDITIONAL_PROPERTY` - Name of that catch-all `JsonProperty`. Default: `additionalProperty`.

### Prompts

- `PROMPTS_DIR` - Flat folder of prompt `*.json` specs. Default: `./prompts` (`/prompts` in the image, a mounted
  volume). Empty or absent is valid; the server then offers no prompts.

    Each file is one MCP prompt. `name`, `description` and `template` are required. `arguments` maps each argument name to
    the description shown to the caller (one starting with "Optional" is optional, the rest required). `template` is plain
    text with `{{placeholder}}` tokens, filled at call time from: the caller's argument values; `{{type}}` (the prompt's
    `types` entry, or a comma-joined list for more than one); `{{tools}}`, resolved from `tools` patterns like
    `"get_{{type}}"` or `"geoquery_entities"`. A `{{type}}` pattern expands once per `types` entry, keeping the typed
    tool name only if this instance exposes it, otherwise falling back to the pattern's generic tool. Every other
    top-level field (`pick`, `relationships`, `rules`, ...) is stringified as-is: an array joins with `, `, an object
    renders as `key: value` pairs joined with `; `.

### Validation and Retrieval

- `SCHEMA_VALIDATION` - For a broker payload that fails its schema: `filter` drops the offending entities and returns
  the rest, `strict` returns an error, `off` passes it through. Default: `filter`.
- `ENTITY_LIMIT` - Default and maximum for the query tools' `limit`. Default: `100`. Every `query_*` call sends
  `count=true` and returns a `pagination` block (`total`, `limit`, `offset`, `returned`, `hasMore`, `nextOffset`)
  alongside `entities`. When matches remain, a leading `_notice` tells the agent to page or narrow rather than treat the
  first page as complete.
- `SEND_PICK_AS_ATTRS` - `true` remaps `pick` to the deprecated `attrs` parameter for brokers that predate NGSI-LD v1.4.
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
