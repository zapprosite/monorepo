---
spec_id: SPEC-001
title: Homelab Control Plane
status: active
date: 2026-04-24
owner: Platform Engineering
supersedes:
  - SPEC-093
  - docs/SPECs/SPEC-3LAYER-MEMORY
---

# SPEC-001: Homelab Control Plane

## Objective

`/srv/monorepo` is the central control plane for the Ubuntu Desktop homelab. It
stores the code, specs, tasks, pipelines, operational docs, and adapters that let
Hermes operate the machine as an authorized local agent.

The goal is not more LLM discussion. The goal is executable control:

- Hermes receives work from Telegram, CLI, or scheduled jobs.
- Hermes loads memory and RAG context before acting.
- Hermes dispatches tools for code, infra, deploy, memory, and ops.
- Hermes records state in files under `tasks/` and durable services.
- Humans review only high-risk irreversible changes.

## Scope

In scope:

- Ubuntu Desktop homelab orchestration.
- Hermes Gateway and Hermes Agency.
- Codex CLI, Claude Code, `mclaude`, `opencode-go-cli`, and `opencode` as CLI tools.
- Coolify operations through API/MCP adapters.
- Qdrant, Mem0, Trieve RAG, Ollama, LiteLLM, Redis, and PostgreSQL MCP.
- Gitea Actions as CI/deploy executor.
- `tasks/pipeline.json` as the active queue for monorepo work.

Out of scope:

- Rebuilding the whole repo.
- Keeping old 14-agent plans as active architecture.
- Storing secrets in Markdown, task JSON, logs, or prompts.
- Direct public port exposure outside the documented Cloudflare/Traefik path.

## Control Plane Boundaries

| Layer | Canonical path/service | Purpose |
|---|---|---|
| Repo | `/srv/monorepo` | Source of truth for code, specs, tasks, pipelines |
| Runtime | `apps/hermes-agency` + Hermes Gateway | Agent routing and execution |
| Memory | Mem0 + Qdrant | User/session preferences and working memory |
| Knowledge | Trieve + Qdrant | Docs/specs/runbooks retrieval |
| Reasoning | LiteLLM + Ollama | External and local model access |
| Action | CLI/API adapters | Codex, Claude, mclaude, opencode, Coolify, Gitea, shell |
| State | `tasks/` | Queue, agent states, smoke results, snapshots |

## Non-Negotiable Rules

- `.env` is the only source for real secrets.
- `.env.example` can contain placeholders only.
- Markdown must reference env var names, not values.
- Destructive host actions require a snapshot or explicit rollback note.
- All ports and URLs are read from env or documented in infra docs.
- Agents can execute tools freely inside the authorized local control plane, but they must log intent and result.

## Active Service Map

| Service | Env var | Default/local port | Notes |
|---|---|---:|---|
| Hermes Gateway | `HERMES_GATEWAY_URL` | `8642` | External brain/gateway path |
| Hermes Agency | `HERMES_AGENCY_PORT` | `3001` | App health/router process |
| Hermes MCP | `HERMES_MCP_URL` or MCP config | `8092` | MCP bridge |
| AI Gateway | `AI_GATEWAY_PORT` | `4002` | OpenAI-compatible facade |
| LiteLLM | `LITELLM_LOCAL_URL` | `4000` | LLM proxy |
| Qdrant | `QDRANT_URL` | `6333` | Vector DB |
| Ollama | `OLLAMA_URL` | `11434` | Local models/embeddings |
| Redis | `REDIS_HOST`/`REDIS_PORT` | `6379` | Rate limit, locks |
| Trieve | `TRIEVE_URL` | `6435` | RAG API |
| Coolify | `COOLIFY_URL` | `8000` | PaaS control |

## Current Reality

This repo has useful implementation, not just placeholders:

- `apps/hermes-agency/src/router/agency_router.ts` routes messages to skills.
- `apps/hermes-agency/src/skills/index.ts` declares the active skill registry.
- `apps/hermes-agency/src/mem0/client.ts` persists working memory into Qdrant.
- `apps/hermes-agency/src/skills/rag-instance-organizer.ts` integrates Trieve.
- `apps/ai-gateway/src/index.ts` exposes the OpenAI-compatible facade.
- `scripts/pipeline-helpers/` contains phase/gate/snapshot helper scripts.
- `tasks/agent-states/` and `tasks/smoke-tests/` already hold operational state.

The problem is drift: specs, AGENTS.md, docs, and old task JSON disagree on ports,
agent count, dimensions, secrets, and paths. This spec is the new top-level anchor.

## Acceptance Criteria

- `docs/SPECS/ACTIVE.md` points to `SPEC-001..004` as canonical.
- Old specs are classified as historical, implementation note, or superseded.
- `tasks/pipeline.json` contains the active queue for this control-plane cleanup.
- No active spec contains real secret values.
- Runtime docs distinguish Hermes Gateway `:8642` from Hermes Agency `:3001`.

