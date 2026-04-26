# SPEC-093 — Homelab Intelligence Architecture

**Data:** 2026-04-23
**Autor:** Team Lead (William Rodrigues)
**Status:** Active
**Review:** Claude Code Sessions

---

## 1. Architecture Overview

O homelab em `zappro.site` implementa uma arquitetura de IA em camadas com agentes especializados orquestrados por um supervisor CEO. O sistema integra memória vetorial, RAG, LLMs externos e locais, e múltiplos provedores de API.

### 1.1 Stack de Componentes

```
PC PRINCIPAL (Gen5 4TB NVMe + RTX 4090 24GB + 64GB RAM)
│
├── Ubuntu Server (headless, SSH do PC secundario)
├── ZFS pool: tank (4TB RAID-Z)
│
├── ┌─────────────────────────────────────────────────────────────┐
├── │  Bare Metal Services                                        │
│   │  • Hermes Gateway :8642 (Telegram bot + voice agent)      │
│   │  • Hermes MCP :8092 (MCPO bridge para Claude Code)        │
│   │  • Ollama :11434 (RTX 4090 — Gemma4 local)               │
│   │  • ai-gateway :4002 (OpenAI-compat facade — TTS/STT/Vision)│
│   │  • zappro-api :4003 (FastAPI auth JWT)                    │
│   │  • opencode-go :9000 (OpenCode CLI)                        │
│   └─────────────────────────────────────────────────────────────┘
│
├── ┌─────────────────────────────────────────────────────────────┐
├── │  Docker Compose Stack                                       │
│   │  • LiteLLM :4000 (multi-provider proxy — MiniMax/GPT)    │
│   │  • Grafana :3100 (dashboards)                             │
│   │  • Loki :3101 (logs)                                       │
│   │  • Prometheus :9090 (metrics)                             │
│   │  • Qdrant :6333 (vector DB — RAG/embeddings)              │
│   │  • ai-router :4005 (routing inteligente)                  │
│   │  • nginx-ratelimit :4004 (rate limiting → :4000)          │
│   └─────────────────────────────────────────────────────────────┘
│
└── PC SECUNDARIO (Gen3 1TB NVMe + RTX 3060 12GB + 32GB RAM)
    └── Dashboard principal (SSH para PC principal)
```

### 1.2 Diagrama de Conectividade

```
                        Cloudflare Tunnel
                    (cloudflared — SSL termination)
                              │
            ┌─────────────────┼─────────────────┐
            │                 │                 │
     coolify.zappro.    hermes.zappro.    api.zappro.
           site             site              site
            │                 │                 │
     ┌──────▼──────┐   ┌──────▼──────┐   ┌──────▼──────┐
     │   Traefik   │   │  Cloudflared│   │  Cloudflared│
     │  (Coolify)  │   │  Tunnel     │   │  Tunnel     │
     └──────┬──────┘   └──────┬──────┘   └──────┬──────┘
            │                 │                 │
     ┌──────▼──────┐   ┌──────▼──────┐   ┌──────▼──────┐
     │   Coolify   │   │  Hermes    │   │   LiteLLM   │
     │   PaaS      │   │  Gateway   │   │   Proxy     │
     │   :8000     │   │  :8642     │   │   :4000     │
     └──────┬──────┘   └──────┬──────┘   └──────┬──────┘
            │                 │                 │
     ┌──────▼──────┐   ┌──────▼──────┐   ┌──────▼──────┐
     │   Qdrant    │   │  Hermes    │   │   Ollama    │
     │   :6333     │   │  MCP :8092 │   │  (RTX 4090) │
     └─────────────┘   └─────────────┘   │  :11434     │
                                         └─────────────┘
```

---

## 2. Intelligence Layers

O sistema implementa 4 camadas de inteligência:

```
┌─────────────────────────────────────────────────────────────┐
│                    INTELLIGENCE LAYERS                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐                                           │
│  │   ACTION     │  Skills + Tools (13 skills especializadas) │
│  │   LAYER      │  executam tarefas concretas               │
│  └──────┬───────┘                                           │
│         │                                                   │
│  ┌──────▼───────┐                                           │
│  │   REASONING  │  LLM (MiniMax M2.7 via LiteLLM)           │
│  │   LAYER      │  Decide, gera, reasona                    │
│  └──────┬───────┘                                           │
│         │                                                   │
│  ┌──────▼───────┐                                           │
│  │   KNOWLEDGE  │  Trieve RAG (:6435)                       │
│  │   LAYER      │  Retrieval de documentos indexados        │
│  └──────┬───────┘                                           │
│         │                                                   │
│  ┌──────▼───────┐                                           │
│  │   MEMORY     │  Mem0 + Qdrant (:6333)                    │
│  │   LAYER      │  Preferências, fatos, histórico           │
│  └──────────────┘                                           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 2.1 Memory Layer (Mem0 + Qdrant)

| Provider | Port | Collection | Purpose |
|----------|------|------------|---------|
| Qdrant | :6333 | `mem0` | Mem0 managed vectors |
| Qdrant | :6333 | `hermes` | Agency session history |
| Qdrant | :6333 | `trieve` | RAG knowledge base |

**Mem0 Collections:**
- `clients` — perfis e preferências de clientes
- `campaigns` — histórico de campanhas
- `conversations` — histórico de conversas
- `assets` — creatives, copy, imagens
- `brand_guides` — guias de marca por cliente
- `tasks` — tarefas e estado
- `working_memory` — contexto atual da sessão

### 2.2 Knowledge Layer (Trieve RAG)

| Dataset | Purpose | Source |
|---------|---------|--------|
| `hermes-second-brain` | Skills e procedures | `~/Desktop/hermes-second-brain/docs/` |
| `monorepo-specs` | SPECs ativos | `/srv/monorepo/docs/SPECS/` |
| `ops-governance` | Regras operacionais | `/srv/ops/ai-governance/` |

### 2.3 Reasoning Layer (LLM Providers)

| Provider | Model | Custo | Endpoint |
|----------|-------|-------|----------|
| MiniMax | M2.7 | Token plan | LiteLLM :4000 |
| OpenAI | GPT-4o-mini | $0.15/1M | LiteLLM :4000 |
| Groq | Whisper Turbo | Grátis | API Groq |
| Ollama | Gemma4:26b-q4 | Grátis | :11434 (RTX 4090) |

### 2.4 Action Layer (13 Skills)

Orquestradas pelo CEO (agency-ceo) via LangGraph.

---

## 3. Data Flow

### 3.1 Request Flow Completo

```
USER (Telegram)
    │
    ▼
HERMES GATEWAY (:8642)
    │
    ▼
CEO_REFRIMIX_bot (agency-ceo skill)
    │
    ├──► MEM0 (Qdrant :6333)
    │    └──► Busca preferências + histórico
    │
    ├──► TRIEVE RAG (:6435)
    │    └──► Recupera conhecimento relevante
    │
    ├──► POSTGRESQL (MCP :4017)
    │    └──► Dados estruturados (leads, campaigns)
    │
    ▼
SKILL SPECIALIZADA (ex: agency-creative)
    │
    ├──► LiteLLM (:4000) ──► MiniMax / GPT
    │                       │
    │   ◄───────────────────┘
    │
    ├──► Redis (:6379) ──► Locks, rate limit, cache
    │
    └──► Qdrant (:6333) ──► Salva resultado
                                │
                                ▼
                         RESPONSE (Telegram)
```

### 3.2 Context Building Sequence

```
1. user message
   │
   ├─► Mem0.search() → recent memories (last 5)
   │
   ├─► Mem0.get() → user profile (tags: client_id)
   │
   ├─► Trieve.search() → relevant docs (top_k=5)
   │
   └─► MCP postgres → client record (if client_id known)
         │
         ▼
   [COMPACTED CONTEXT STRING]
   │  System prompt (512 tokens)
   │  User profile (1375 tokens max)
   │  Recent memories (2200 tokens max)
   │  RAG context (1500 tokens max)
   │  Conversation history (1500 tokens max)
   │  ───────────────────────────────
   │  Total: ~7200 tokens (under 8k budget)
   │
   ▼
   LLM (MiniMax M2.7 via LiteLLM)
```

---

## 4. Multi-Agent Supervisor Pattern

### 4.1 CEO_REFRIMIX_bot (agency-ceo)

O CEO é o supervisor que:
1. Recebe todas as mensagens
2. Decide qual skill acionar (trigger-based ou LLM-based)
3. Executa LangGraph workflows quando necessário
4. Insere human gates para aprovações críticas

### 4.2 Routing Decision Tree

```
MESSAGE
  │
  ▼
CHECK TRIGGERS (skills/index.ts)
  │
  ├─► Match found ──► EXECUTE SKILL
  │
  └─► No match ──► ASK CEO (LLM)
                      │
                      ▼
                 "Which skill should handle this?"
                      │
                      ▼
                 EXECUTE SKILL
```

### 4.3 Supervisor State

```typescript
interface SupervisorState {
  sessionId: string;
  userId: string;
  clientId?: string;
  campaignId?: string;
  currentSkill?: string;
  context: {
    memories: MemoryEntry[];
    ragContext: RagChunk[];
    conversationHistory: Message[];
    userProfile?: ClientProfile;
  };
  workflow?: {
    name: WorkflowName;
    threadId: string;
    interruptedAt?: string;
  };
}
```

### 4.4 Circuit Breaker Integration

Cada skill tem seu próprio circuit breaker (SPEC-068):

```
CLOSED (normal)
  │  3 failures consecutive → OPEN
  ▼
OPEN (tripped)
  │  30s timeout → HALF_OPEN
  ▼
HALF_OPEN (testing)
  │  success → CLOSED
  │  failure → OPEN (reset timer)
  ▼
```

---

## 5. Skill Taxonomy (13 Skills)

### 5.1 Core Skills

| ID | Name | Tools | Triggers |
|----|------|-------|----------|
| `agency-ceo` | CEO MIX | `langgraph_execute`, `skill_route`, `human_gate_trigger`, `qdrant_query` | `/start`, `/agency`, `brief`, `campaign` |
| `agency-onboarding` | ONBOARDING | `create_client_profile`, `init_qdrant_collection`, `send_welcome_sequence`, `create_first_milestone` | `novo cliente`, `onboarding`, `bem-vindo` |
| `agency-organizer` | ORGANIZADOR | `create_task`, `update_task_status`, `assign_to_agent`, `set_reminder`, `list_tasks` | `tarefa`, `task`, `organizar`, `lembrete` |
| `agency-pm` | PROJECT MANAGER | `create_milestone`, `check_deliverables`, `send_status_update`, `escalate_if_needed`, `get_campaign_status` | `milestone`, `status`, `entrega`, `projeto` |
| `agency-client-success` | CLIENT SUCCESS | `send_nps_survey`, `collect_feedback`, `schedule_call`, `renew_subscription`, `update_health_score` | `nps`, `feedback`, `cliente`, `sucesso` |

### 5.2 Content Skills

| ID | Name | Tools | Triggers |
|----|------|-------|----------|
| `agency-creative` | CREATIVE | `generate_script`, `brainstorm_angles`, `write_copy`, `create_mood_board`, `qdrant_retrieve` | `criar`, `script`, `copy`, `ideia`, `criativo` |
| `agency-design` | DESIGN | `generate_image_prompt`, `create_brand_kit`, `suggest_colors`, `mockup_layout` | `design`, `imagem`, `visual`, `cores` |
| `agency-video-editor` | VIDEO EDITOR | `transcribe_video`, `extract_key_moments`, `generate_caption`, `upload_to_r2` | `vídeo`, `video`, `youtube`, `transcrever` |
| `agency-social` | SOCIAL MEDIA | `schedule_post`, `generate_hashtags`, `cross_post`, `analyze_engagement`, `post_to_social` | `postar`, `social`, `hashtag`, `publicar` |

### 5.3 Intelligence Skills

| ID | Name | Tools | Triggers |
|----|------|-------|----------|
| `agency-analytics` | ANALYTICS | `fetch_metrics`, `generate_report`, `compare_campaigns`, `alert_anomaly`, `qdrant_aggregate` | `métricas`, `analytics`, `relatório`, `dashboard` |
| `agency-brand-guardian` | BRAND GUARDIAN | `check_brand_consistency`, `scan_for_violations`, `approve_content`, `flag_for_review`, `score_content` | `brand`, `marca`, `consistência`, `approvar` |
| `rag-instance-organizer` | INSTANCE ORGANIZER | `rag_retrieve`, `rag_index_document`, `rag_list_datasets`, `rag_search`, `qdrant_query` | `organizar instância`, `rag`, `knowledge base` |

---

## 6. Memory Architecture

### 6.1 Qdrant Collections

```
Qdrant (:6333)
│
├── mem0 (Mem0 managed)
│   ├── vectors: 1024-float (qwen2.5:3b)
│   └── payload: text, tags, source, user_id, created_at
│
├── hermes (Agency sessions)
│   ├── vectors: 1024-float
│   └── payload: session_id, role, content, timestamp, metadata
│
└── trieve (Knowledge base)
    ├── vectors: 768-float (bge-m3)
    └── payload: content, metadata {source, type, dataset_id}
```

### 6.2 Mem0 Schema

```json
{
  "version": "v1",
  "user_id": "string",
  "agent_id": "hermes",
  "collection": "clients | campaigns | conversations | assets | brand_guides | tasks | working_memory",
  "memory": {
    "text": "string",
    "tags": ["string"],
    "source": "manual | skill | workflow | rag",
    "metadata": {
      "client_id": "string?",
      "campaign_id": "string?",
      "skill_id": "string?",
      "workflow_id": "string?"
    }
  }
}
```

### 6.3 Memory Best Practices (Nous Research)

- **Capacity limits:** memory 2200, user 1375 tokens
- **Consolidate at 80% capacity**
- **Pack related facts** into single entries using section delimiters
- **Skip:** trivial info, easily re-discovered facts, raw data dumps
- **Proactive save:** preferences, env facts, corrections, conventions

---

## 7. Knowledge Architecture (Trieve RAG)

### 7.1 Dataset Sources

```
FASE 1 — Indexação inicial
  ├── hermes-second-brain/docs/    (skills, TREE.md)
  ├── monorepo/docs/SPECS/         (SPECs ativos)
  └── /srv/ops/ai-governance/      (governança)

FASE 2 — Expansão
  ├── hvacr-swarm/docs/
  ├── monorepo/AGENTS.md
  └── README.md files (raiz dos repos)
```

### 7.2 Chunking Strategy

| Strategy | When to Use | Size |
|----------|-------------|------|
| `heading` | Docs with headers (#, ##) | Variable |
| `sentence` | Prose text | 512 tokens |
| `page` | PDFs | 1024 tokens |

**Decision:** Use `heading` for markdown docs (preserves structure).

### 7.3 Embedding Model

**Primary:** `BAAI/bge-m3` (768-float)
**Fallback:** `nomic-ai/qwen2.5:3b` (1024-float)

### 7.4 Trieve API

```
Base URL: http://localhost:6435/api/v1

Endpoints:
  POST /datasets              — Create dataset
  POST /chunks                — Upload chunks
  POST /search                — Semantic search
  POST /datasets/{id}/chunks  — Search dataset

Auth: Bearer token (TRIEVE_API_KEY)
```

---

## 8. Circuit Breaker Strategy

### 8.1 Per-Skill Thresholds

| Skill | Failure Threshold | Timeout | Half-Open Trials |
|-------|------------------|---------|------------------|
| agency-ceo | 3 | 30s | 1 |
| agency-analytics | 3 | 30s | 1 |
| agency-creative | 3 | 30s | 1 |
| agency-social | 3 | 30s | 1 |
| rag-instance-organizer | 3 | 30s | 1 |
| * (all others) | 3 | 30s | 1 |

### 8.2 Fallback Behavior

When circuit is OPEN:
1. Log: `[CircuitBreaker] skillId: state=OPEN, skipping`
2. Return cached response if available
3. Notify user: "Skill temporariamente indisponível"
4. After 30s, allow one trial request (HALF_OPEN)

### 8.3 Monitoring Endpoint

```
GET /health/circuit-breakers?userId=XXX

Response:
{
  "circuit_breakers": {
    "agency-analytics": { "state": "CLOSED", "failures": 0 },
    "agency-creative": { "state": "OPEN", "failures": 3, "opened_at": "..." },
    ...
  }
}
```

---

## 9. LangGraph Workflows

### 9.1 Workflow Types

| Type | Description | Implementation |
|------|-------------|----------------|
| **WF-1** StateGraph | True LangGraph with nodes + edges | `content_pipeline.ts` |
| **WF-2** Sequential Async | Stub — async/await chain | `onboarding_flow.ts` |
| **WF-3** Sequential Async | Stub — async/await chain | `status_update.ts` |
| **WF-4** Sequential Async | Stub — async/await chain | `social_calendar.ts` |
| **WF-5** Sequential Async | Stub — async/await chain | `lead_qualification.ts` |

### 9.2 Content Pipeline (WF-1 — StateGraph)

```
BRIEF
  │
  ▼
CREATIVE ──► generate_script, brainstorm_angles, write_copy
  │
  ▼
VIDEO ──► transcribe_video, extract_key_moments
  │
  ▼
DESIGN ──► generate_image_prompt, create_brand_kit
  │
  ▼
BRAND_GUARDIAN ──► check_brand_consistency, score_content
  │
  ▼
HUMAN_GATE ──► await approval
  │
  ▼
SOCIAL ──► schedule_post, generate_hashtags
  │
  ▼
ANALYTICS ──► fetch_metrics, alert_anomaly
```

### 9.3 Workflow Registry

```typescript
const WORKFLOW_REGISTRY = {
  content_pipeline: executeContentPipeline,
  onboarding: executeOnboardingFlow,
  lead_qualification: executeLeadQualification,
  social_calendar: executeSocialCalendar,
  status_update: executeStatusUpdate,
};

export async function invokeWorkflow(
  workflowName: string,
  input: string,
  threadId?: string,
): Promise<WorkflowResult>
```

---

## 10. Environment Variables

### 10.1 LLM Providers

| Variable | Default | Description |
|----------|---------|-------------|
| `LITELLM_API_KEY` | — | LiteLLM API key |
| `LITELLM_BASE_URL` | `http://localhost:4000` | LiteLLM endpoint |
| `MINIMAX_API_KEY` | — | MiniMax API key |
| `MINIMAX_API_BASE` | `https://api.minimax.io/anthropic/v1` | MiniMax endpoint |
| `OPENAI_API_KEY` | — | OpenAI API key |
| `OPENROUTER_API_KEY` | — | OpenRouter API key |
| `GROQ_API_KEY` | — | Groq API key |
| `CEO_MODEL` | `gpt-4o` | Model for CEO routing decisions |

### 10.2 Memory & RAG

| Variable | Default | Description |
|----------|---------|-------------|
| `QDRANT_URL` | `http://localhost:6333` | Qdrant endpoint |
| `QDRANT_API_KEY` | — | Qdrant API key |
| `MEM0_API_KEY` | — | Mem0 API key |
| `OLLAMA_URL` | `http://localhost:11434` | Ollama endpoint |
| `OLLAMA_MODEL` | `nomic-ai/qwen2.5:3b` | Embedding model |
| `TRIEVE_API_KEY` | — | Trieve API key |
| `TRIEVE_URL` | `http://localhost:6435` | Trieve endpoint |

### 10.3 PostgreSQL (MCP)

| Variable | Default | Description |
|----------|---------|-------------|
| `POSTGRES_HOST` | `localhost` | PostgreSQL host |
| `POSTGRES_PORT` | `5432` | PostgreSQL port |
| `POSTGRES_USER` | — | PostgreSQL user |
| `POSTGRES_PASSWORD` | — | PostgreSQL password |
| `POSTGRES_DB` | — | Database name |
| `MCP_POSTGRES_URL` | — | Full connection URL |

### 10.4 Redis

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_URL` | `redis://localhost:6379` | Redis endpoint |
| `REDIS_PASSWORD` | — | Redis password |

### 10.5 Infrastructure

| Variable | Default | Description |
|----------|---------|-------------|
| `HERMES_ADMIN_USER_IDS` | `7220607041` | Admin Telegram IDs |
| `HUMAN_GATE_THRESHOLD` | `0.7` | Threshold for human approval |
| `LOG_LEVEL` | `info` | Log verbosity |

---

## 11. Service Discovery

### 11.1 Internal Services (localhost-only firewall)

| Service | Port | Access | Purpose |
|---------|------|--------|---------|
| `mcp-monorepo` | 4006 | localhost | Filesystem + git |
| `mcp-qdrant` | 4011 | localhost | Vector search |
| `mcp-coolify` | 4012 | localhost | Infrastructure |
| `mcp-ollama` | 4013 | localhost | Local LLMs |
| `mcp-system` | 4014 | localhost | System metrics |
| `mcp-cron` | 4015 | localhost | Cron management |
| `mcp-memory` | 4016 | localhost | Memory persistence |
| `mcp-postgres` | 4017 | localhost | Structured data |

### 11.2 External Services

| Service | Port | Provider | Purpose |
|---------|------|----------|---------|
| LiteLLM | 4000 | Docker Compose | LLM proxy |
| Qdrant | 6333 | Coolify | Vector DB |
| Trieve | 6435 | Coolify | RAG API |
| Grafana | 3100 | Docker Compose | Metrics |
| Loki | 3101 | Docker Compose | Logs |
| Prometheus | 9090 | Docker Compose | Metrics collection |

---

## 12. Context Loading Order

Para Claude Code sessions, ler nesta ordem:

```bash
# 1. AGENTS.md (source of truth para processos)
cat /srv/monorepo/AGENTS.md | tail -200

# 2. Second Brain TREE (mapeia estrutura de conhecimento)
cat ~/Desktop/hermes-second-brain/TREE.md

# 3. OPS Governance (regras operacionais)
cat /srv/ops/ai-governance/README.md
cat /srv/ops/ai-governance/CONTRACT.md

# 4. System Architecture (infra context)
cat ~/Desktop/SYSTEM_ARCHITECTURE.md

# 5. Homelab Intelligence SPEC (THIS FILE)
cat /srv/monorepo/docs/SPECS/SPEC-093-homelab-intelligence-architecture.md
```

---

## 13. Quick Reference

### 13.1 Health Checks

```bash
# LiteLLM
curl http://localhost:4000/health

# Qdrant
curl http://localhost:6333/health

# Trieve
curl http://localhost:6435/api/v1/health

# Ollama
curl http://localhost:11434/api/tags

# Redis
redis-cli -u redis://localhost:6379 ping
```

### 13.2 Circuit Breaker Status

```bash
curl http://localhost:3001/health/circuit-breakers?userId=7220607041
```

### 13.3 Log Locations

| Service | Log Location |
|---------|--------------|
| Hermes Gateway | `~/.hermes/logs/` |
| LiteLLM | Docker compose logs |
| Qdrant | Docker compose logs |
| Grafana | `~/.hermes/logs/` |

---

## 14. Related SPECs

| SPEC | Topic | Relationship |
|------|-------|--------------|
| SPEC-068 | Circuit Breaker | Per-skill breakers |
| SPEC-074 | Mem0 Second Brain | Memory layer |
| SPEC-092 | Trieve RAG | Knowledge layer |
| SPEC-090 | Orchestrator v3 | Multi-agent pipeline |

---

**Versão:** 1.0
**Última atualização:** 2026-04-23
