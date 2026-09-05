#!/usr/bin/env bash
# Run the MCP server from source against the tutorial's dockerized broker + Mintaka
# (start those first: cd ../tutorials.MCP-Server && ./services orion).
# Override any var by exporting it before calling this script.
set -euo pipefail

export MCP_TRANSPORT="${MCP_TRANSPORT:-http}"
export MCP_PORT="${MCP_PORT:-3005}"
export CONTEXT_BROKER="${CONTEXT_BROKER:-http://localhost:1026/ngsi-ld/v1}"
export NGSI_LD_CONTEXT="${NGSI_LD_CONTEXT:-http://context/user-context.jsonld}"
# NGSI_LD_TENANT left unset ⇒ default tenant.
export TEMPORAL_BROKER="${TEMPORAL_BROKER:-http://localhost:8080}"
export TEMPORAL_TENANT="${TEMPORAL_TENANT:-openiot}"
export PROMPTS_DIR="${PROMPTS_DIR:-../tutorials.MCP-Server/prompts}"
export DEBUG="${DEBUG:-mcp:*}"

npm run dev
