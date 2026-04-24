# SPEC-122: Homelab Polish v2 — Final Fixes

## Context

Run 2 of homelab polish after applying iptables MASQUERADE fixes for Docker bridge networks. Previous run (SPEC-121) identified 5 env var mismatches, LiteLLM embeddings hanging due to TCP external blocked, and mcp-memory errors.

## Goals

1. Verify if LiteLLM `/v1/embeddings` works after MASQUERADE fix
2. Test container→host LAN connectivity (192.168.15.83:11434)
3. Check if mcp-memory errors are resolved
4. Confirm Qdrant accessible from LiteLLM
5. Test embeddings with `ollama/nomic-embed-text` via host LAN Ollama
6. Verify Docker bridge network gateway (10.0.10.1) is reachable
7. Document final state and propose remaining fixes
8. Check if any env var mismatches remain

## Acceptance Criteria

- [ ] LiteLLM `/v1/embeddings` returns valid vectors
- [ ] Container can reach `192.168.15.83:11434` (Ollama on host LAN)
- [ ] mcp-memory shows healthy status (no 500 errors)
- [ ] Qdrant collections accessible from LiteLLM
- [ ] Docker bridge gateway `10.0.10.1` reachable from containers
- [ ] All env vars canonical in `/srv/monorepo/.env`
- [ ] Final state documented in SPEC-122-RESULTS.md

## Agents (15)

| #  | Agent               | Task |
|----|---------------------|------|
| 1  | TEST-LITELLM-EMBED  | Test `/v1/embeddings` endpoint with nomic-embed-text |
| 2  | CHECK-HOST-LAN      | Test container reachability to 192.168.15.83:11434 |
| 3  | VERIFY-MCP-MEMORY   | Check mcp-memory health and 500 errors |
| 4  | TEST-QDRANT-FROM-LLM | Verify Qdrant accessible from LiteLLM container |
| 5  | CHECK-DOCKER-GATEWAY | Test reachability to 10.0.10.1 from containers |
| 6  | VERIFY-ENV-VARS     | Confirm all env vars match canonical .env |
| 7  | OLLAMA-EMBED-TEST   | Direct test of Ollama embeddings on host |
| 8  | NETWORK-PATH-VALIDATE| Trace full path container→host→ollama |
| 9  | CHECK-DOCKER-RULES   | Verify iptables MASQUERADE still active |
| 10 | LITELLM-ROUTES      | Check LiteLLM model routing for embeddings |
| 11 | VERIFY-REDIS         | Redis healthy and accessible |
| 12 | DOCKER-NETWORK-TOPO | Document current Docker network topology |
| 13 | FIX-RECOMMENDATION  | Propose permanent fix for bridge networking |
| 14 | FINAL-REPORT        | Compile final state into SPEC-122-RESULTS.md |
| 15 | HEALTH-SUMMARY      | Quick health check all critical services |

## Verification

```bash
# Test embeddings
curl -X POST http://localhost:4000/v1/embeddings \
  -H "Authorization: Bearer sk-zappro-lm-2026-s8k3m9x2p7r6t5w1v4c8n0d5j7f9g3h6i2k4l6m8n0p1" \
  -H "Content-Type: application/json" \
  -d '{"model":"embedding-nomic","input":"hello"}'

# Test Ollama directly
curl -X POST http://192.168.15.83:11434/api/embeddings \
  -d '{"model":"nomic-embed-text","input":"hello"}'

# Check mcp-memory logs
docker logs mcp-memory --tail 50 2>&1 | grep -i error
```

---
_Generated: 2026-04-23_