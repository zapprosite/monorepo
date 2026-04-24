# SPEC-121: Homelab Polish — Env Vars, Network, LiteLLM

## Contexto

O homelab tem múltiplos problemas identificados:
1. Mismatches de env vars entre `/srv/monorepo/.env` e containers activos
2. LiteLLM embeddings endpoint hanging — container não consegue TCP externo
3. `host.docker.internal` não resolve dentro dos containers
4. Qdrant API key canonicalizada mas não verificada
5. mcp-memory com erros de embedding

## Estado Actual (antes do polish)

### .env corrigido (2026-04-23)
- `MINIMAX_API_KEY` → presente em `.env` ✅
- `QDRANT_API_KEY` → presente em `.env` ✅

### Container env vars (reais)
| Container | QDRANT_API_KEY | OLLAMA_URL |
|----------|----------------|------------|
| mcp-memory | `71cae776...` ✅ | — |
| hermes-agency | `71cae776...` ✅ | `host.docker.internal:11434` ❌ |
| zappro-litellm | — | — |

### Rede Docker
- LiteLLM container: `10.0.2.4`, `10.0.10.3`, `10.0.19.6`
- Host Ollama: `192.168.15.83:11434` (só reachable do host)
- qwen2-vl7b: `10.0.2.5:11434` (só tem VL models, sem embeddings)
- Container TCP externo: BLOQUEADO (DNS funciona, TCP timeout)

## Tarefas de Agentes

### Agent 1: VERIFY-ENV-MISMATCHES
Comparar cada env var do `.env` com os valores reais nos containers activos. Reportar mismatches.

### Agent 2: FIX-LITELLM-NETWORK
Diagnosticar e corrigir network isolation do LiteLLM. O container não consegue TCP externo (OpenRouter, host LAN). Options:
- Adicionar container a network host (`network_mode: host`)
- Criar bridge para host LAN
- Usar Ollama interno ao Docker

### Agent 3: TEST-EMBEDDINGS-ENDPOINT
Testar `POST /v1/embeddings` no LiteLLM. Verificar se funciona com OpenRouter fallback ou se continua hanging.

### Agent 4: VERIFY-QDRANT-CONNECTIVITY
Confirmar que `QDRANT_API_KEY` da `.env` é aceite pelo Qdrant e responde.

### Agent 5: CHECK-MCP-MEMORY
Ver logs do mcp-memory, confirmar erros de embedding, verificar conectividade a Qdrant e LiteLLM.

### Agent 6: DOCS-DOCKER-NETWORK
Documentar topology de rede Docker — quais containers alcançam quais IPs/redes.

### Agent 7: TEST-OLLAMA-REACHABILITY
Testar conectividade Ollama: host (`192.168.15.83:11434`) vs Docker (`10.0.2.5`, `qwen2-vl7b:11434`).

### Agent 8: VERIFY-ALL-API-KEYS
Verificar API keys activas — LiteLLM master key, OpenRouter, Groq, etc.

### Agent 9: HEALTH-CHECK-CRITICAL
Verificar health de: LiteLLM, Qdrant, Redis, Hermes Agency, mcp-memory, Ollama.

### Agent 10: PROPOSE-NETWORK-FIX
Propor solução para LiteLLM alcançar Ollama embeddings. Impact analysis.

### Agent 11: ROLLBACK-PLAN
Documentar como reverter mudanças se algo correr mal.

### Agent 12: UPDATE-DOTENV-CANONICAL
Garantir que `/srv/monorepo/.env` tem todos os valores canonicalizados e documentados.

### Agent 13: TEST-LITELLM-CHAT
Testar `/v1/chat/completions` para confirmar que LiteLLM funciona para texto (não só embeddings).

### Agent 14: FINAL-SUMMARY
Sumarizar estado final do sistema, ACs completados, issues remanescentes.

## Acceptance Criteria

- [ ] Todos os mismatches de env vars identificados e corrigidos
- [ ] LiteLLM `/v1/embeddings` funciona (mesmo que por fallback)
- [ ] mcp-memory conecta a Qdrant e LiteLLM sem erros
- [ ] Documentação de rede actualizada
- [ ] Rollback plan documentado
- [ ] Estado final reportado ao utilizador
