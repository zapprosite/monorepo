# SPEC-121 Results

## Estado Final do Sistema

### LiteLLM
- **Embeddings**: hanging (intermittent failures - empty message errors)
- **Chat**: working (service running, health endpoint returns 401 auth required)
- **Network**: isolated - container TCP externo BLOQUEADO, mas host LAN Ollama `192.168.15.83` reachable

### Qdrant
- **API Key**: correct (`QDRANT_API_KEY` present in `.env`; value redacted)
- **Collections**: 12 accessible (agency_video_metadata, agency_campaigns, agency_working_memory, openclaw-memory, agency_assets, will, agency_clients, agency_brand_guides, agency_tasks, mem0migrations, agency_conversations, agency_knowledge)

### mcp-memory
- **Status**: unhealthy (degraded)
- **Errors**: 
  - `ERROR:server:Embedding failed: (empty message)`
  - `ERROR:server:Error adding memory: 500: Embedding generation failed: (empty message)`
  - `422 Unprocessable Entity on /tools/memory_add` (intermittent, ~4 occurrences)
  - `500 Internal Server Error on /tools/memory_add when embedding fails`
- **Connectivity**: Qdrant ok, LiteLLM ok (connections healthy, but embedding generation unreliable)

### Rede Docker
- **Host LAN reachable from containers**: yes (`192.168.15.83:11434` reachable)
- **Ollama accessible**: partially
  - `192.168.15.83` (host): reachable, has `nomic-embed-text:latest`
  - `10.0.2.5`: reachable, NO embeddings (VL models only)
  - `qwen2-vl7b`: NOT reachable (connection timeout)

### Env Vars
- **Mismatches found**: 5
  1. `OLLAMA_URL`: env=`localhost:11434` vs container=`host.docker.internal:11434` (mcp-memory)
  2. `COOLIFY_API_KEY`: env vs container differ (hermes-agency)
  3. `QDRANT_URL`: env=`localhost:6333` vs container=`127.0.0.1:6333` (hermes-agency)
  4. `QDRANT_URL`: env=`localhost:6333` vs container=`qdrant:6333` (zappro-litellm)
  5. `QDRANT_URL`: env=`localhost:6333` vs container=`10.0.19.5:6333` (mcp-qdrant)
- **Corrections applied**: 0 (identified but not fixed)

## Issues Remanescentes

1. **LiteLLM embeddings hanging**: Embedding generation fails silently with empty error messages - LiteLLM container TCP externo bloqueado
2. **mcp-memory degraded**: 500 errors on `/tools/memory_add` when embedding generation fails
3. **Env var mismatches**: 5 containers com valores diferentes do `.env` - 需要 correção
4. **Ollama VL-only instance**: `10.0.2.5` e `qwen2-vl7b` não têm modelos de embedding
5. **QDRANT_URL localhost**: Containers usando `localhost` em vez de IPs reais ou hostnames Docker

## Recomendação

1. **Corrigir env vars**: Atualizar `.env` com valores correctos (especialmente `OLLAMA_URL` para `host.docker.internal`)
2. **LiteLLM network**: Considerar `network_mode: host` ou criar bridge para host LAN
3. **Fallback embeddings**: Configurar Ollama host `192.168.15.83` como fallback primário para embeddings
4. **Monitor mcp-memory**:_embedding errors são intermitentes (~4 occurrences) -，可能是 LiteLLM timeout vs. network isolation

## Acceptance Criteria Status

- [x] Todos os mismatches de env vars identificados (5 encontrados)
- [ ] LiteLLM `/v1/embeddings` funciona (fails intermittently - empty message)
- [ ] mcp-memory conecta a Qdrant e LiteLLm sem erros (conecta mas embeddings falham)
- [x] Documentação de rede actualizada (Ollama hostLAN reachable, VL instances sem embeddings)
- [ ] Rollback plan documentado (não coberto pelos agentes)
- [x] Estado final reportado ao utilizador

---

_Generated: 2026-04-23_
_Agents completed: VERIFY-ENV-MISMATCHES, TEST-OLLAMA-REACHABILITY, VERIFY-QDRANT-CONNECTIVITY, CHECK-MCP-MEMORY, HEALTH-CHECK-CRITICAL_
