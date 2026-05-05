# Blueprint — OpenWebUI + Swarm Go Integration (v1.0)

> **Status:** BLUEPRINT EXECUTÁVEL  
> **Date:** 2026-05-05  
> **Scope:** Migrar backend de RAG/context do OpenWebUI básico → Swarm Go enterprise  
> **Target:** OpenWebUI (:3456) mantido como UI; Swarm Go (:8643) vira motor  
> **Prune Strategy:** Morte sem dó de placeholder/legado

---

## 1. Estado Atual (Pre-Migração)

### O que está UP agora
| Serviço | Porta | Stack | Status | Destino |
|---------|-------|-------|--------|---------|
| OpenWebUI | :3456 | Docker, Python | ✅ UP | **Mantém UI** |
| Ollama | :11434 | systemd, Go | ✅ UP | **Mantém** (embeddings) |
| Qdrant | :6333 | Docker | ✅ UP | **Mantém** (vectors) |
| Redis | :6379 | Docker | ✅ UP | **Mantém** (cache) |
| LiteLLM | :4018 | Docker | ✅ UP | **Mantém** (gateway LLM) |
| ai-gateway | :4002 | Docker | ✅ UP | **Mantém** (TTS/STT) |

### O que está DOWN (ou morto)
| Serviço | Porta | Status | Ação |
|---------|-------|--------|------|
| Swarm Go | :8643 | ❌ DOWN | **Reviver** |
| Hermes Python API | :8642 | ❌ DOWN | **Transformar em memory-service** |
| hermes-second-brain | :6337 | ❌ DOWN | **Matar** (substituído por swarm) |
| sync-engine Python | — | ⚠️ Parcial | **Matar** (swarm já faz RAG) |
| ai-context-sync.sh | — | ❌ Fake embeddings | **Matar** |
| zappro-api | :4003 | ❌ DOWN | **Avaliar** — se não for CRM, matar |
| hermes-mcp | :8092 | ❌ DOWN | **Matar** (não usado) |

### Collections Qdrant
| Collection | Points | Ação |
|------------|--------|------|
| `hvac_manuals_v1` | 442 | **Manter** (corpus principal) |
| `skills` | 115 | **Migrar** → `hermes-context` |
| `mem0` | 26 | **Manter** (memórias ativas) |
| `hermes-context` | 19 | **Manter** (código/docs) |
| `hermes-knowledge` | 17 | **Avaliar** — duplicado? |
| `will` | 0 | **Deletar** (zombie) |
| `mem0migrations` | 0 | **Deletar** (zombie) |

---

## 2. Blueprint de Integração (O que vira o quê)

### Arquitetura Pós-Migração

```
┌──────────────────────────────────────────────────────────────────────┐
│                           LAYER DE INTERFACE                          │
│                                                                       │
│  ┌──────────────┐         ┌──────────────┐                           │
│  │  OpenWebUI   │         │  WhatsApp    │  (futuro)                 │
│  │  :3456       │         │  Webhook     │                           │
│  │  UI/Webchat  │         │  :8092       │                           │
│  └──────┬───────┘         └──────┬───────┘                           │
│         │                        │                                    │
│         └────────┬───────────────┘                                   │
│                  ▼                                                   │
│         ┌─────────────────┐                                          │
│         │  API Gateway    │  ← FastAPI (Hermes simplificado)         │
│         │  :8642          │  Responsabilidade: ROUTING, AUTH, RATE   │
│         │  (Python)       │  NÃO faz embed, NÃO faz RAG              │
│         └────────┬────────┘                                          │
└──────────────────┼───────────────────────────────────────────────────┘
                   │ gRPC/HTTP :8643
                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│                           LAYER DE MOTOR                              │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │  SWARM ENGINE — Go  :8643                                    │    │
│  │  ├─ RAG Pipeline (chunker → verifier → refiner → ranker)     │    │
│  │  ├─ 9 Agents (intake, classifier, ranking, response...)      │    │
│  │  ├─ 3-Layer Memory (Redis/Qdrant/SQLite)                     │    │
│  │  ├─ Circuit Breaker                                          │    │
│  │  └─ DAG Executor                                             │    │
│  └──────────────────────────────────────────────────────────────┘    │
│                                                                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │
│  │   Ollama     │  │   Qdrant     │  │   Redis      │               │
│  │  :11434      │  │  :6333       │  │  :6379       │               │
│  │  Embeddings  │  │  Vectors     │  │  Cache/State │               │
│  └──────────────┘  └──────────────┘  └──────────────┘               │
└──────────────────────────────────────────────────────────────────────┘
```

### O que cada componente faz

| Componente | Antes | Depois | Motivo |
|------------|-------|--------|--------|
| **OpenWebUI** | RAG próprio (básico) + UI | **Só UI** | UI é madura; RAG dele é fraco |
| **Swarm Go** | Parado, para WhatsApp HVAC | **Motor universal** | RAG avançado (verifier, refiner), circuit breaker, 9 agents |
| **Hermes API (:8642)** | Mem0 + sync + context | **API Gateway** | Recebe requests OpenWebUI/WhatsApp → delega ao swarm |
| **Hermes sync-engine.py** | Indexa código dos repos | **DELETADO** | Swarm já tem RAG indexer |
| **ai-context-sync.sh** | Fake embeddings | **DELETADO** | Proibido por policy |
| **Mem0** | Isolado no Hermes | **Integrado no swarm** | Swarm usa Qdrant direto; Mem0 é wrapper |

---

## 3. Prune — O que Morre Sem Dó

### 🔴 Morte Imediata (Deletar hoje)

| Item | Por que morre | Substituto |
|------|--------------|------------|
| `services/sync-engine.py` | Reimplementa o que swarm Go faz melhor | `cmd/swarm/main.go` + RAG indexer |
| `libs/context/ranker.py` | PageRank fake (co-ocorrência) | `internal/swarm/` ranker real |
| `ai-context-sync.sh` | Fake embeddings (vetores 0.5) | `cmd/sync/main.go` (quando criado) |
| `docs/ARCHITECTURE-v2.md` (Hermes) | Definia arquitetura que não vingou | Este blueprint |
| Collection `will` (Qdrant) | Zombie, 0 points, deprecada | Nada |
| Collection `mem0migrations` | Zombie, 0 points | Nada |
| `hermes-second-brain.service` (:6337) | Hermes velho, SQLite corrompido | `swarm-engine.service` (:8643) |
| `apps/cli/memory_commands.py` | CLI que fala com API morta | `apps/cli/swarm_client.py` (novo) |

### 🟡 Morte Programada (Deprecar, remover em 7 dias)

| Item | Por que deprecar | Plano de remoção |
|------|-----------------|------------------|
| `libs/memory/manager.py` | Mem0 wrapper isolado | Swarm usa Qdrant direto; Mem0 vira opcional |
| `apps/api/router_memory.py` | Endpoints /memory isolados | Migrar para `/context` com memória no swarm |
| `apps/api/router_tasks.py` | Task board SQLite simples | Avaliar se ainda usado; se não, matar |
| Collection `hermes-knowledge` | 17 points, possivelmente duplicado | Verificar se contém dados únicos vs `hermes-context` |
| `apps/api/context.py` (Python) | Context injector Python | Swarm Go faz isso melhor; Hermes só repassa |

### 🟢 Mantém (É bom)

| Item | Por que mantém |
|------|---------------|
| OpenWebUI (:3456) | UI excelente, OAuth pronto, comunidade ativa |
| Qdrant (:6333) | Banco vetorial sólido, 442 manuais indexados |
| Redis (:6379) | Cache rápido, filas, dirty-set |
| Ollama (:11434) | Embeddings locais, nomic-embed-text |
| LiteLLM (:4018) | Gateway LLM multi-provider |
| ai-gateway (:4002) | TTS/STT para WhatsApp futuro |
| `hvac_manuals_v1` (Qdrant) | Corpus principal de ajuda técnica |
| `internal/swarm/` (Go) | Motor enterprise completo |
| `internal/rag/` (Go) | RAG pipeline avançado |
| `internal/agents/` (Go) | 9 agents especializados |

---

## 4. Blueprint de Substituição (Migration Path)

### Fase 1: Reviver o Motor (0-4h)

```
1. Fixar Go (remover snap, instalar tarball) → 1h
2. Buildar swarm: go build ./... → 1h
3. Criar systemd unit swarm-engine.service → 30min
4. Startar swarm em :8643 → 30min
5. Testar health: curl localhost:8643/health → 15min
6. Testar RAG: curl -X POST localhost:8643/rag -d '{"query":"erro CH 05 LG"}' → 30min
```

**Output:** Motor no ar, respondendo perguntas técnicas.

### Fase 2: Conectar OpenWebUI (4-8h)

```
1. Criar pipeline function no OpenWebUI que chama swarm :8643 → 2h
2. Desativar RAG nativo do OpenWebUI → 30min
3. Testar pergunta via web → 30min
4. Verificar que resposta vem do swarm (com fontes do manual) → 30min
```

**Output:** OpenWebUI com RAG do swarm.

### Fase 3: Transformar Hermes em Gateway (8-12h)

```
1. Simplificar Hermes: manter só routers de routing → 2h
2. POST /context → delega para swarm :8643 → 1h
3. POST /memory → delega para swarm memory layer → 1h
4. Health check integrado (swarm + Qdrant + Redis) → 1h
```

**Output:** Hermes é gateway, não motor.

### Fase 4: Prune (12-16h)

```
1. Deletar sync-engine.py → 5min
2. Deletar ai-context-sync.sh → 5min
3. Deletar collections zombie no Qdrant → 10min
4. Parar hermes-second-brain.service (:6337) → 5min
5. Remover libs/memory/manager.py (deprecar) → 30min
6. Atualizar docker-compose.yml (remover sync service morto) → 30min
```

**Output:** Sistema limpo, sem lixo.

---

## 5. Regras de Ouro (Anti-Regressão)

### R1: Nada de Python fazendo embed
- Embed é responsabilidade do swarm Go (Ollama client otimizado)
- Python só repassa requests

### R2: Nada de fake embeddings
- Se não tem Ollama, não indexa
- `ai-context-sync.sh` não pode ser recriado

### R3: OpenWebUI nunca acessa Qdrant direto
- Sempre via swarm :8643
- Swarm aplica circuit breaker, rate limit, ranking

### R4: Tree-sitter ou nada
- Parser regex proibido em produção
- `nexus_repo_map.py` portado para Go (`internal/ast/`)

### R5: Um sync só
- `cmd/sync/main.go` (Go) é o único indexador
- Roda via cron ou pre-commit hook

---

## 6. Rollback Plan

Se algo quebrar:
1. **Swarm não builda:** Manter Hermes Python como fallback, remover integração OpenWebUI
2. **OpenWebUI quebra:** Isolar swarm, testar via curl direto
3. **RAG do swarm ruim:** Temporariamente reativar RAG nativo OpenWebUI
4. **Qdrant corrompido:** Restaurar ZFS snapshot `tank/qdrant@daily`

---

## 7. Checklist de Sucesso

```bash
# Motor
$ curl -sf http://localhost:8643/health
{"status":"ok","engine":"swarm-go","version":"1.0.0"}

# RAG técnico
$ curl -X POST http://localhost:8643/v1/rag \
  -H "Content-Type: application/json" \
  -d '{"query":"ar condicionado LG 12k erro CH 05","top_k":5}'
{"answer":"O erro CH 05 indica...","sources":["lg_split_type_2024.pdf"],"confidence":0.92}

# OpenWebUI integrado
# (Acessar https://chat.zappro.site, perguntar, ver resposta técnica com fonte)

# Sem lixo
$ docker ps --format "{{.Names}}" | grep -E "sync-engine|hermes-second-brain|hermes-mcp"
# (vazio — nenhum container morto rodando)

$ curl -s http://localhost:6333/collections | jq '.result.collections[].name'
"hvac_manuals_v1"
"hermes-context"
"mem0"
"skills"
# (sem will, sem mem0migrations)
```

---

*Blueprint definido. Não é sugestão — é lei de implementação.*
