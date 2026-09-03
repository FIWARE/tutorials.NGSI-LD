# FIWARE NGSI-LD Step-by-Step Tutorials MCP Server

[![Documentation](https://fiware.github.io/catalogue/badges/chapters/documentation.svg)](https://fiware-tutorials.rtfd.io)
[![Docker](https://img.shields.io/docker/pulls/fiware/tutorials.mcp-server.svg)](https://hub.docker.com/r/fiware/tutorials.mcp-server/)
[![Support badge](https://img.shields.io/badge/tag-fiware-orange.svg?logo=stackoverflow)](https://stackoverflow.com/questions/tagged/fiware)
[![NGSI LD](https://img.shields.io/badge/NGSI-LD-d6604d.svg)](https://cim.etsi.org/NGSI-LD/official/front-page.html)
[![JSON LD](https://img.shields.io/badge/JSON--LD-1.1-f06f38.svg)](https://w3c.github.io/json-ld-syntax/)

TypeScript [`fastmcp`](https://github.com/punkpeye/fastmcp) application for use with the FIWARE Step-by-Step tutorials. This
is a **Model Context Protocol (MCP) server** that exposes an NGSI-LD Context Broker  to Large Language Model
agents as a set of tools and resources.

The server does the protocol work an LLM should not: it translates a request such as `{ "type": "Animal" }` into
`GET /entities?type=Animal`, injects the JSON-LD `@context` through the `Link` header on every broker call, validates the
response against a schema, and shapes the NGSI-LD payload into a token-efficient form. Its main features include:

*   **Generic tools**: `query_entities`, `get_entity` and `query_entities_geo` cover any entity type with an NGSI-LD `q`
    filter, attribute projection (`pick`) and the broker geo engine (`georel` / `geometry` / `coordinates`).
*   **Schema-driven tools**: for every Smart Data Models `schema.json` supplied at start up, a typed
    `query_<type>` / `get_<type>` / `get_<type>_history` set is generated, documented from the schema itself and validated
    against it.
*   **Context discovery**: `list_entity_types`, `get_entity_type`, `list_attributes` and `get_attribute` wrap the NGSI-LD
    `/types` and `/attributes` endpoints for run-time introspection.
*   **Resources**: the dereferenced schema for each model is served at `ontology://<model>/<type>`, plus live
    `ngsi://types` and `ngsi://attributes` views of the broker.
*   **`@context` injection**: the agent never sees or handles a context URI; the server adds the `Link` header and
    requests `application/ld+json` on every call.

To run the application in debug mode add `DEBUG=mcp:*`. All logging is written to `stderr` so it is safe alongside the
stdio transport.

## Environment Variables

### Core Configuration

-   `MCP_TRANSPORT` - Transport the server listens on, `stdio` or `http`. Default: `stdio` (the Docker image sets `http`).
-   `MCP_PORT` - Port for the HTTP-stream transport. Default: `3000`.
-   `DEBUG` - Debug level. Set to `mcp:*` for full output on `stderr`.

### Context Broker

-   `CONTEXT_BROKER` - Base path of the target Context Broker. Default: `http://localhost:1026/ngsi-ld/v1`.
-   `NGSI_LD_CONTEXT` - JSON-LD `@context` added to the `Link` header on every broker call. Default:
    `http://context/ngsi-context.jsonld`.
-   `NGSI_LD_TENANT` - Value for the `NGSILD-Tenant` header (paired with `NGSILD-Path: /`), applied to every request.
    Unset means the broker default tenant. One server instance targets one tenant.

### Schemas

-   `SCHEMA_DIR` - Directory of Smart Data Models `schema.json` files, one flat folder, plus a `common/` sub-directory
    holding the GSMA and domain commons for offline `$ref` resolution. Default: `./schemas`. The Docker image sets
    `/schemas` and expects it to be a mounted volume. An empty or absent directory is valid - the server then offers the
    generic and context-discovery tools only.
-   `NGSI_CORE_SCHEMA_DIR` - Directory of the bundled NGSI-LD context-discovery response schemas
    (`EntityTypeList`, `EntityType`, `EntityTypeInfo`, `AttributeList`, `Attribute`). Default: `./ngsi-schemas`. Shipped
    inside the image; you should not need to change this.

### Validation and Retrieval

-   `SCHEMA_VALIDATION` - Policy for a broker payload that fails its schema: `filter` drops the offending entities and
    returns the rest, `strict` returns an error object, `off` passes the payload through untouched. Default: `filter`.
-   `ENTITY_LIMIT` - Default and maximum value for the `limit` parameter of the query tools. Default: `100`.
-   `SEND_PICK_AS_ATTRS` - Set to `true` to remap the `pick` parameter to the deprecated `attrs` parameter for brokers
    that predate NGSI-LD v1.4. Default: `false`.

## Building

The application is written in TypeScript and must be compiled before running.

```console
npm install
npm run build
npm start
```

For debug output:

```console
DEBUG=mcp:* npm start
```

Run the test suite with:

```console
npm test
```


The image expects the Smart Data Models schemas as a mounted volume at `/schemas`:

```console
docker run --rm -p 3000:3000 \
  -e CONTEXT_BROKER=http://orion:1026/ngsi-ld/v1 \
  -v "$(pwd)/schemas:/schemas:ro" \
  fiware/tutorials.mcp-server
```

---

## License

[MIT](LICENSE) © 2026 FIWARE Foundation e.V.
