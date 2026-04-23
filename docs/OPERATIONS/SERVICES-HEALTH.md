# Services Health Summary

**Generated:** 2026-04-22

## Overview

- **Total Containers Running:** 31
- **Unhealthy Containers:** 1

## Docker Containers Status

| Container | Status |
|-----------|--------|
| mcp-memory | UP |
| zappro-kokoro | UP |
| coolify-sentinel | UP (healthy) |
| painel-organism | UP |
| prometheus | UP (healthy) |
| hermes-agency | UP (healthy) |
| zappro-gitea | UP |
| pgadmin-tn29zf1fync4nbiro818daq7 | UP (healthy) |
| zappro-litellm | UP |
| zappro-litellm-db | UP (healthy) |
| node-exporter | UP (healthy) |
| mcp-coolify-mcp-coolify-1 | UP |
| mcp-ollama-mcp-ollama-1 | UP |
| mcp-system-mcp-system-1 | UP |
| mcp-cron-mcp-cron-1 | UP |
| mcp-qdrant | UP |
| qwen2-vl7b | UP |
| edge-tts-server | UP |
| obsidian-web | UP (healthy) |
| qdrant | UP (healthy) |
| static-web | UP (healthy) |
| gitea-runner | UP (healthy) |
| openwebui | UP (healthy) |
| opencode-searxng | UP |
| perplexity-agent | UP (healthy) |
| coolify-redis | UP (healthy) |
| coolify-realtime | UP (healthy) |
| coolify-proxy | UP (healthy) |
| zappro-redis | UP (healthy) |
| redis-opencode | UP (healthy) |
| zappro-ai-gateway | UP (**UNHEALTHY**) |

## MCP Servers (Ports 4011-4016)

| Port | Status |
|------|--------|
| 4011 | UP |
| 4012 | DOWN (404) |
| 4013 | DOWN (404) |
| 4014 | DOWN (404) |
| 4015 | DOWN (404) |
| 4016 | UP |

## Key Services

| Service | Port | Status |
|---------|------|--------|
| LiteLLM | 4000 | UP (auth required on health endpoint) |
| Qdrant | 6333 | UP (auth required on collections endpoint) |

## Issues Found

### Critical
- **zappro-ai-gateway**: Container is UP but marked UNHEALTHY (started ~1 minute ago)

### Warnings
- **MCP Servers 4012-4015**: Returned 404 on /health endpoint (may be missing health route or unavailable)

## Notes

- Docker containers are generally healthy with 10 containers reporting "(healthy)" status
- LiteLLM and Qdrant are running (docker confirmed) but health/collections endpoints require API authentication
- MCP server on port 4016 returned valid health: `{"status":"healthy","service":"mcp-memory",...}`
