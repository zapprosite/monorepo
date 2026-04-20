---
name: SPEC-058-hermes-agency-suite
description: Hermes Agency Suite — 11-agent marketing agency on Hermes bare metal with Qdrant, LangGraph, Telegram, and MiniMax text-only (Ollama Vision/STT/Embeddings only)
status: IN_PROGRESS
priority: critical
author: Principal Engineer
date: 2026-04-17
specRef: SPEC-011 (archived), SPEC-046, SPEC-053
---

# SPEC-058: Hermes Agency Suite

> ⚠️ **Audio Stack:** Não se aplica — Hermes Agency Suite usa Telegram como interface (não voz). STT/TTS só para workflows de voice broadcast.

> ⚠️ **Immutable Services:** Qdrant, Hermes Gateway (:8642/:8092), Ollama (:11434) são IMMUTABLE. Ver docs/GOVERNANCE/IMMUTABLE-SERVICES.md antes de propor mudanças.

---

## Objective

Construir uma **marketing agency 100% operacional em português** com 11 agentes especializados orchestrados por Hermes Agent como CEO router, usando hub-and-spoke pattern (não sub-agent spawning). Cada agente é uma skill Hermes registrada com tools específicas. LangGraph gerencia workflows complexos multi-etapa. Qdrant multi-tenant serve como RAG memory centralizado com 9 coleções. Telegram é interface primária para clientes e para gestão interna.

**Problema resolvido:** SPEC-011 (OpenClaw 11-agent) era executado em infraestrutura pesada (crewAI + 11 processos). Hermes Agency Suite executa os 11 agentes como skills no Hermes Agent existente (:8642) com overhead mínimo (~500MB RAM incremental vs 11GB crewAI).

> **NOTE (SPEC-089):** Fallback de texto via Ollama REMOVIDO — texto vai SEMPRE via MiniMax (SPEC-053). Ollama usado apenas para Vision e STT.

---

## Tech Stack

| Component            | Technology              | Notes                                                                            |
| -------------------- | ----------------------- | -------------------------------------------------------------------------------- |
| Agent Orchestrator   | Hermes Agent bare metal | systemd service :8642 gateway + :8092 MCP                                        |
| Multi-Agent Workflow | LangGraph               | Complex workflows; simple routing via Hermes skills                              |
| Vector Database      | Qdrant                  | Multi-tenant 9 coleções, bge-m3 embeddings                                       |
| LLM Router           | Hermes | Hermes: minimax-m2.7 PRIMARY (text only), Ollama Vision/STT only |
| Embeddings           | bge-m3                  | Hybrid sparse+dense search, PT-BR optimized                                      |
| Message Broker       | Redis                   | Semantic cache, session locks, pub/sub                                           |
| Interface (Client)   | Telegram Bot            | Polling mode, per-chat locks, voice streaming                                    |
| Interface (Internal) | Hermes MCP              | Skill-based tool access                                                          |
| Deployment           | Coolify bare metal      | RTX 4090 + Intel embedded GPU                                                    |

---

## Architecture Overview

```
                                    ┌─────────────────────────────────────────────┐
                                    │           TELEGRAM CLIENTS                  │
                                    │   (per-chat locks, polling, voice stream)   │
                                    └────────────────────┬────────────────────────┘
                                                         │
                                                         ▼
                                    ┌─────────────────────────────────────────────┐
                                    │         HERMES GATEWAY (:8642)              │
                                    │   CEO Router — hub-and-spoke supervisor     │
                                    │   • Routes to 11 specialized skills         │
                                    │   • LangGraph for complex workflows         │
                                    │   • Human gates at confidence < 0.7         │
                                    └──────────┬──────────────────┬───────────────┘
                                               │                  │
                          ┌────────────────────┼──────────────────┼────────────────┐
                          │                    │                  │                │
                          ▼                    ▼                  ▼                ▼
                   ┌────────────┐       ┌────────────┐    ┌────────────┐   ┌────────────┐
                   │  ONBOARDING│       │   EDITOR   │    │   SOCIAL   │   │  ANALYTICS│
                   │   Skill    │       │   Skill    │    │   Skill    │   │   Skill    │
                   └────────────┘       └────────────┘    └────────────┘   └────────────┘
                          │                    │                  │                │
                          │                    │                  │                │
                          ▼                    ▼                  ▼                ▼
                   ┌────────────┐       ┌────────────┐    ┌────────────┐   ┌────────────┐
                   │  CREATIVE  │       │  DESIGN    │    │    PM      │   │   BRAND    │
                   │   Skill    │       │   Skill    │    │   Skill    │   │  GUARDIAN  │
                   └────────────┘       └────────────┘    └────────────┘   └────────────┘
                          │                    │                  │                │
                          │                    │                  │                │
                          ▼                    ▼                  ▼                ▼
                   ┌────────────┐       ┌────────────┐    ┌────────────┐   ┌────────────┐
                   │   CLIENT   │       │ORGANIZADOR │    │   AUDIT    │   │   HELPER   │
                   │  SUCCESS   │       │   Skill    │    │   LOG      │   │   (misc)   │
                   └────────────┘       └────────────┘    └────────────┘   └────────────┘
                          │                    │                  │
                          │                    │                  │
                          └────────────────────┼──────────────────┘
                                                 │
                                    ┌────────────▼─────────────────────────────┐
                                    │         QDRANT (9 Collections)           │
                                    │  agency_clients | agency_campaigns       │
                                    │  agency_conversations | agency_assets    │
                                    │  agency_brand_guides | agency_tasks      │
                                    │  agency_video_metadata | agency_knowledge│
                                    │  agency_working_memory                   │
                                    └──────────────────────────────────────────┘
                                                 │
                                    ┌────────────▼─────────────────────────────┐
                                    │         HERMES LLM CHAIN (17/04)          │
                                    │  PRIMARY: minimax/MiniMax-M2.7 (50$)     │
                                    │  NOTE: Texto SEMPRE via MiniMax (SPEC-053)│
                                    │  + Redis semantic cache                   │
                                    └──────────────────────────────────────────┘
```

---

## The 11 Agency Agents (Skills)

### CEO MIX (Hermes Gateway — Supervisor)

- **Skill ID:** `agency-ceo`
- **Tools:** LangGraph workflow execution, skill routing, human gate trigger
- **Responsibility:** Orchestrates all other skills, routes tasks, calls human gates

### ONBOARDING Agent

- **Skill ID:** `agency-onboarding`
- **Tools:** `create_client_profile`, `init_qdrant_collection`, `send_welcome_sequence`
- **Trigger:** New client starts bot
- **Output:** `agency_clients` collection record

### EDITOR DE VIDEO Agent

- **Skill ID:** `agency-video-editor`
- **Tools:** `transcribe_video`, `extract_key_moments`, `generate_caption`, `upload_to_r2`
- **Trigger:** Client sends video or YouTube link
- **Output:** `agency_video_metadata` collection record

### ORGANIZADOR Agent

- **Skill ID:** `agency-organizer`
- **Tools:** `create_task`, `update_task_status`, `assign_to_agent`, `set_reminder`
- **Trigger:** Any task creation request
- **Output:** `agency_tasks` collection record

### CREATIVE Agent

- **Skill ID:** `agency-creative`
- **Tools:** `generate_script`, `brainstorm_angles`, `write_copy`, `create_mood_board`
- **Trigger:** Campaign brief received
- **Output:** `agency_knowledge` collection record

### DESIGN Agent

- **Skill ID:** `agency-design`
- **Tools:** `generate_image_prompt`, `create_brand_kit`, `suggest_colors`, `mockup_layout`
- **Trigger:** Visual content request
- **Output:** `agency_assets` collection record

### SOCIAL MEDIA Agent

- **Skill ID:** `agency-social`
- **Tools:** `schedule_post`, `generate_hashtags`, `cross_post`, `analyze_engagement`
- **Trigger:** Content ready for publishing
- **Output:** `agency_campaigns` + `agency_conversations` records

### PROJECT MANAGER Agent

- **Skill ID:** `agency-pm`
- **Tools:** `create_milestone`, `check_deliverables`, `send_status_update`, `escalate_if_needed`
- **Trigger:** Weekly status check or milestone due
- **Output:** `agency_tasks` updates

### ANALYTICS Agent

- **Skill ID:** `agency-analytics`
- **Tools:** `fetch_metrics`, `generate_report`, `compare_campaigns`, `alert_anomaly`
- **Trigger:** Weekly report request or anomaly detected
- **Output:** `agency_campaigns` reports

### BRAND GUARDIAN Agent

- **Skill ID:** `agency-brand-guardian`
- **Tools:** `check_brand_consistency`, `scan_for_violations`, `approve_content`, `flag_for_review`
- **Trigger:** All content before publishing (mandatory gate)
- **Output:** Approval/rejection with score

### CLIENT SUCCESS Agent

- **Skill ID:** `agency-client-success`
- **Tools:** `send_nps_survey`, `collect_feedback`, `schedule_call`, `renew_subscription`
- **Trigger:** Post-delivery or monthly check-in
- **Output:** `agency_clients` health score update

---

## Qdrant Collections (9 Multi-Tenant)

| Collection              | Dimensions    | Payload Schema                                               |
| ----------------------- | ------------- | ------------------------------------------------------------ |
| `agency_clients`        | 1024 (bge-m3) | `{client_id, name, plan, health_score, onboarding_complete}` |
| `agency_campaigns`      | 1024          | `{campaign_id, client_id, status, type, metrics}`            |
| `agency_conversations`  | 1024          | `{conversation_id, client_id, messages[], last_message}`     |
| `agency_assets`         | 1024          | `{asset_id, client_id, type, tags[], url}`                   |
| `agency_brand_guides`   | 1024          | `{guide_id, client_id, voice_tone, colors[], fonts[]}`       |
| `agency_tasks`          | 1024          | `{task_id, campaign_id, assignee, status, priority}`         |
| `agency_video_metadata` | 1024          | `{video_id, campaign_id, transcription, key_moments[]}`      |
| `agency_knowledge`      | 1024          | `{doc_id, type, content, embedding}`                         |
| `agency_working_memory` | 1024          | `{session_id, agent_id, context_window, ttl}`                |

**Search Strategy:** Hybrid BM25 + dense vector (bge-m3) for PT-BR content.

---

## LLM Chain

```
Request
  │
  ▼
[1] minimax-m2.7 (PRIMARY) — premium, plano 50$, texto APENAS ✅
  │  FAIL → ERROR (sem fallback para texto)
  ▼
[2] qwen2.5vl:7b (Ollama :11434) — Vision APENAS, não texto ✅
  │  FAIL → ERROR
  ▼
[3] whisper-1 (Ollama :11434) — STT APENAS ✅
  │
  ▼
ERROR / DEGRADED MODE
```

---

## 5 Autonomous Workflows

### WF-1: Content Pipeline

```
Client sends brief → CEO routes to CREATIVE → EDITOR → DESIGN → BRAND GUARDIAN → (human gate if score < 0.8) → SOCIAL → ANALYTICS
```

### WF-2: Onboarding Automation

```
New client → ONBOARDING creates profile → Qdrant init → HELPER sends welcome → PM creates first milestone → CS schedules check-in
```

### WF-3: Status Update (Recurring)

```
Cron (every Monday 9am) → PM fetches all campaigns → ANALYTICS generates report → CEO formats → Telegram broadcast to all clients
```

### WF-4: Social Calendar + Analytics

```
SOCIAL scrapes calendar → ANALYTICS fetches metrics → BRAND GUARDIAN reviews → Report posted to Telegram channel
```

### WF-5: Lead Qualification

```
New prospect message → CEO routes to CS → CS scores via BRAND GUARDIAN rules → If qualified: create_task for ONBOARDING → else: nurture sequence
```

---

## Human Gates

| Gate                 | Condition            | Action                               |
| -------------------- | -------------------- | ------------------------------------ |
| Brand Guardian Score | < 0.8 confidence     | Pause, send to human for review      |
| Brief Parsing        | < 0.7 confidence     | Ask client for clarification         |
| External Publishing  | Always               | Confirm before posting to social     |
| Recurring Failures   | 3x retry failed      | Escalate to human with error summary |
| Cost Spike           | > 2x monthly average | Alert + pause cloud LLM              |

---

## Commands

```bash
# Health check all services
curl -sf http://localhost:8642/health           # Hermes Gateway
curl -sf http://localhost:6333/collections       # Qdrant
curl -sf http://localhost:11434/api/tags         # Ollama

# Test LLM chain
curl -X POST http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -d '{"model": "qwen2.5vl:7b", "messages": [{"role": "user", "content": "test"}]}'

# Run agency smoke test
bash smoke-tests/smoke-agency-suite.sh

# Check Redis cache hit rate
redis-cli info stats | grep hit_rate

# Logs
journalctl -u hermes-agent -f
```

---

## Project Structure

```
/srv/monorepo/
├── apps/
│   ├── hermes-agency/                    # Hermes Agency Suite
│   │   ├── src/
│   │   │   ├── skills/                   # 11 agent skills
│   │   │   │   ├── agency-ceo/
│   │   │   │   ├── agency-onboarding/
│   │   │   │   ├── agency-video-editor/
│   │   │   │   ├── agency-organizer/
│   │   │   │   ├── agency-creative/
│   │   │   │   ├── agency-design/
│   │   │   │   ├── agency-social/
│   │   │   │   ├── agency-pm/
│   │   │   │   ├── agency-analytics/
│   │   │   │   ├── agency-brand-guardian/
│   │   │   │   └── agency-client-success/
│   │   │   ├── langgraph/                # Workflow definitions
│   │   │   │   ├── content_pipeline.ts
│   │   │   │   ├── onboarding_flow.ts
│   │   │   │   ├── status_update.ts
│   │   │   │   ├── social_calendar.ts
│   │   │   │   └── lead_qualification.ts
│   │   │   ├── router/                  # Hermes → skill router
│   │   │   │   └── agency_router.ts
│   │   │   ├── qdrant/                  # Qdrant client + schemas
│   │   │   │   ├── client.ts
│   │   │   │   └── collections/
│   │   │   ├── telegram/                # Telegram bot
│   │   │   │   ├── bot.ts
│   │   │   │   ├── handlers/
│   │   │   │   └── middleware/
│   │   │   ├── litellm/                # LLM fallback chain
│   │   │   │   └── router.ts
│   │   │   └── __tests__/
│   │   └── package.json
│   │
│   └── ai-gateway/                       # Already exists :4002
│       └── src/routes/chat.ts           # Extend with agency routes
│
├── scripts/
│   ├── setup-agency-qdrant.sh          # Initialize 9 collections
│   ├── register-agency-skills.sh       # Register 11 skills in Hermes
│   └── sync-brand-guide.sh              # Sync brand guides to Qdrant
│
└── smoke-tests/
    └── smoke-agency-suite.sh            # 11/11 smoke test
```

---

## Non-Goals

- **Não é multi-tenant de verdade** (single agency, multiple clients within same Qdrant)
- **Não é crewAI replacement** (Hermes skills + LangGraph, not spawned sub-agents)
- **Não cobre voice/TTS** (Telegram text-first; voice broadcast opcional futuro)
- **Não substitui SPEC-053** (Hermes voice+vision para interfaces homem-máquina)

---

## Dependencies

| Dependency            | Status   | Notes                                                   |
| --------------------- | -------- | ------------------------------------------------------- |
| SPEC-053              | DONE     | Hermes 100% local voice+vision                          |
| Qdrant container port | BLOCKING | Container not exposing 6333 to host — needs Coolify fix |
| Hermes Gateway :8642  | READY    | Already operational                                     |
| Ollama :11434         | READY    | Vision + STT + Embeddings ONLY (não texto)                         |
| LiteLLM :4000         | READY    | Already configured                                      |
| Redis                 | READY    | Already in Docker stack                                 |

---

## Decisions Log

| Date       | Decision                           | Rationale                                                                                                   |
| ---------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 2026-04-17 | LangGraph over crewAI              | crewAI too heavy (11GB RAM for 11 agents); LangGraph adds orchestration to existing Hermes skills at ~500MB |
| 2026-04-17 | Hub-and-spoke over sub-agent spawn | Hermes Agent cannot spawn sub-agents; skills + LangGraph workflow is the SOTA pattern                   |
| 2026-04-17 | bge-m3 for embeddings              | Hybrid sparse+dense search, best for PT-BR content per AI benchmarks                                        |
| 2026-04-17 | Redis semantic cache               | 35-50% hit rate → reduces cloud LLM costs from $8-10/mo to ~$4-5/mo                                         |

---

## Sub-Specs (Tear-Down)

| Sub-Spec    | Title                                            | Priority | Status   |
| ----------- | ------------------------------------------------ | -------- | -------- |
| SPEC-058-01 | Qdrant Recovery & Multi-Tenant Setup             | Critical | PROPOSED |
| SPEC-058-02 | Hermes Agency Core — 11 Skills Registration      | Critical | PROPOSED |
| SPEC-058-03 | LangGraph Workflows — 5 Autonomous Pipelines     | High     | PROPOSED |
| SPEC-058-04 | LiteLLM Fallback Chain + Semantic Cache          | High     | PROPOSED |
| SPEC-058-05 | Telegram Agency Bot — Interface & Handlers       | High     | PROPOSED |
| SPEC-058-06 | RAG Memory Architecture — 9 Collections & bge-m3 | Medium   | PROPOSED |
| SPEC-058-07 | Security & RBAC — MCP Permissions & Audit        | Medium   | PROPOSED |
| SPEC-058-08 | Smoke Tests & Monitoring — 11/11 Verification    | High     | PROPOSED |

---

## Success Criteria

| #    | Criterion                                               | Verification                                           |
| ---- | ------------------------------------------------------- | ------------------------------------------------------ |
| SC-1 | 11 Hermes skills respond to `/help` command             | `curl http://localhost:8642/skills` returns all 11     |
| SC-2 | Qdrant 9 collections queryable                          | `curl http://localhost:6333/collections` returns all 9 |
| SC-3 | LLM chain: minimax TEXT PRIMARY, Ollama Vision/STT only | MiniMax-only para texto ✅                            |
| SC-4 | Telegram bot responds to `/start` with onboarding       | Manual test with test client                           |
| SC-5 | WF-1 (Content Pipeline) executes end-to-end             | Smoke test delivers test campaign                      |
| SC-6 | Human gate triggers at confidence < 0.7                 | Test with ambiguous brief                              |
| SC-7 | Redis cache hit rate > 30% after 24h                    | `redis-cli info stats`                                 |
| SC-8 | RAM overhead < 1GB for all 11 skills                    | `docker stats` on Coolify                              |

---

## Acceptance Criteria

| #    | Criterion                                           | Test                                 |
| ---- | --------------------------------------------------- | ------------------------------------ |
| AC-1 | Each of 11 skills has at least 3 tools registered   | Hermes skill list API                |
| AC-2 | Qdrant hybrid search returns relevant PT-BR results | `bge-m3` test query                  |
| AC-3 | LLM fallback triggers on minimax failure | MiniMax é PRIMÁRIO — texto SEM fallback |
| AC-4 | Ollama Vision/STT working | Verificar qwen2.5vl:7b + whisper-1            |
| AC-5 | LangGraph WF-1 completes in < 60s for simple brief  | Timer in smoke test                  |
| AC-6 | Brand Guardian score < 0.8 triggers human gate      | Send off-brand content               |
| AC-7 | Semantic cache hit rate measurable                  | Redis metrics after 1h               |
| AC-8 | No hardcoded secrets — all via process.env          | `/sec` audit passes                  |

---

## Checklist

- [ ] SPEC-058 written and reviewed (this document)
- [ ] SPEC-058-01 through SPEC-058-08 created via `/pg`
- [ ] Qdrant port issue resolved (BLOCKING prerequisite)
- [ ] Architecture decisions documented (ADR if needed)
- [ ] Security review for Telegram bot + RBAC
- [ ] LangGraph dependency validated against VERSION-LOCK.md
- [ ] RAM estimation confirmed < 1GB for 11 skills
- [ ] Memory index updated after implementation
