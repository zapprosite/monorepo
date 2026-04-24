---
spec_id: SPEC-002
title: Hermes Agent Runtime
status: active
date: 2026-04-24
owner: Platform Engineering
supersedes:
  - SPEC-068
  - SPEC-106
  - SPEC-PLAN-MODE
---

# SPEC-002: Hermes Agent Runtime

## Objective

Hermes is the operating runtime for the homelab. It should receive intent,
load context, choose a tool or workflow, execute, persist state, and report back.

Hermes is allowed to operate the local control plane through approved adapters.
The safe boundary is not "do nothing"; the safe boundary is logged execution,
env-based config, reversible operations where possible, and no secret leakage.

## Runtime Components

| Component | Current implementation | Role |
|---|---|---|
| Agency entrypoint | `apps/hermes-agency/src/index.ts` | Health, startup checks, Qdrant init |
| Router | `apps/hermes-agency/src/router/agency_router.ts` | Trigger + CEO model routing |
| Skills | `apps/hermes-agency/src/skills/index.ts` | Skill registry and validation |
| Tool registry | `apps/hermes-agency/src/skills/tool_registry.ts` | Concrete tool execution |
| Workflows | `apps/hermes-agency/src/langgraph/` | Multi-step flows |
| Telegram | `apps/hermes-agency/src/telegram/` | Bot, locks, rate limits, file validation |
| Memory | `apps/hermes-agency/src/mem0/` | Working memory |
| RAG | `apps/hermes-agency/src/skills/rag-instance-organizer.ts` | Trieve datasets/search |
| LLM | `apps/hermes-agency/src/litellm/router.ts` | Text completion routing |

## Required Action Adapters

Hermes should expose each external executor as a typed adapter in the tool layer.
Adapters are wrappers around CLI/API commands, not new LLM personas.

| Adapter | Command/API | Purpose | Required state |
|---|---|---|---|
| `codex_cli` | `codex` | Codebase changes and verification | command, cwd, diff, logs |
| `claude_code` | `claude` | Alternate coding/review executor | prompt, cwd, result, logs |
| `mclaude` | `mclaude` | Worker planning/execution | session, phase, result |
| `opencode_go` | `opencode-go-cli` | Fast local code operations | command, exit code |
| `opencode` | `opencode` | Alternate local agent CLI | command, exit code |
| `coolify` | Coolify API/MCP | Deploy/restart/status | app id, action, result |
| `gitea` | Gitea API | PR/issue/status | repo, issue/pr id |
| `system` | shell/systemd/docker | Local ops | command, stdout summary, exit code |

## Routing Policy

1. Trigger match in `AGENCY_SKILLS`.
2. If no match, CEO model decides skill.
3. Router injects recent Mem0 context.
4. Router injects RAG context from Trieve.
5. Circuit breaker checks skill/tool availability.
6. Tool executes and returns structured result.
7. Router stores assistant result in memory and task state.

## Critical Drift To Fix

| Drift | Impact | Fix |
|---|---|---|
| CEO prompt says marketing agency only | Runtime cannot act as homelab operator | Split persona: `agency` vs `homelab-control` modes |
| CLI adapters are not first-class tools | Hermes cannot reliably call Codex/Claude/mclaude/opencode | Add adapter tools to `tool_registry.ts` |
| Plan Mode script has placeholder Qdrant vector syntax | Phase 0 cannot be production reliable | Replace with real embedding call or skip semantic search explicitly |
| `CEO_MODEL` fallback is hardcoded to `gpt-4o` | Model routing drifts from LiteLLM strategy | Move model name to env and document required fallback |
| Human/brand gates fit marketing but not ops | Ops tasks can be blocked by irrelevant gates | Gate by task class: content, infra, destructive, normal |
| Bot startup is ambiguous | `index.ts` says bot launches elsewhere, but entrypoint does not import it | Make polling/webhook startup explicit |
| Deploy script expects missing Dockerfile | `scripts/deploy-hermes-agency.sh` cannot build current app | Add Dockerfile or switch deployment path |
| Env names drift | Docs use `HERMES_WEBHOOK_URL`/`STT_PROXY_URL`, code reads `HERMES_AGENCY_WEBHOOK_URL`/`STT_DIRECT_URL` | Normalize env names and aliases |
| Tool registry coverage is partial | Skills can reference tools that are not implemented | Add coverage test or fail startup for missing P0 tools |

## Acceptance Criteria

- Hermes has a `homelab-control` route or skill for ops/control-plane work.
- Tool registry includes adapters for Codex, Claude, mclaude, opencode, Coolify, Gitea, and shell.
- Each adapter writes structured logs under `tasks/runs/` or a session directory.
- Circuit breaker covers external APIs and CLIs.
- Plan Mode can create a spec, pipeline, run phases, and report status without fake parallelism.
- Hermes Agency has a reproducible local runtime path: Dockerfile/compose or systemd, with health on `HERMES_AGENCY_PORT`.
