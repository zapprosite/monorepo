---
name: SPEC-002
description: Hermes Agent Runtime — routing, skills, CLI/API adapters, execution boundaries
status: draft
owner: AI Team
created: 2026-04-27
---

# SPEC-002 — Hermes Agent Runtime

## 1. Overview

Hermes is the agent runtime that routes requests, manages skills, exposes CLI/API adapters, and enforces execution boundaries for autonomous operations in the homelab.

**Purpose:** Single entry point for Claude Code, Codex, and other agents to interact with homelab services through a controlled, auditable runtime.

---

## 2. Components

### 2.1 Router

- **Skills registry** — list of available skills with metadata (name, description, params, scope)
- **Request routing** — map incoming requests to appropriate skill or handler
- **Priority queue** — manage concurrent agent requests with fairness

### 2.2 CLI Adapter

- **Command interface** — `hermes <skill> [args]` CLI entry point
- **Auth** — API key / token validation per request
- **Logging** — all requests logged to `hermes logs`

### 2.3 API Adapter

- **REST endpoints** — skill invocation, status, history
- **WebSocket** — streaming responses for long-running tasks
- **Rate limiting** — per-client and global limits

### 2.4 Execution Boundaries

- **Sandbox** — skills run in isolated environments (Docker container or venv)
- **Timeout** — max execution time per skill (configurable)
- **Resource limits** — CPU, memory, network egress caps

---

## 3. Related Files

| File | Topic | Status |
|------|-------|--------|
| `SPEC-002-homelab-monitor-agent.md` | HomeLab Monitor Agent | misnamed — not Hermes runtime |
| `SPEC-002-homelab-network-refactor.md` | Cloudflare + Coolify refactor | misnamed — not Hermes runtime |

### Migration

- `SPEC-002-homelab-monitor-agent.md` → reclassify as historical (SPEC-068 circuit breaker context) or merge into SPEC-001
- `SPEC-002-homelab-network-refactor.md` → reclassify as implementation-note under SPEC-001

---

## 4. Acceptance Criteria

1. Hermes CLI accepts `hermes <skill-name> [args]` and returns structured JSON
2. API exposes `/v1/skills`, `/v1/invoke`, `/v1/status` endpoints
3. Execution timeout is enforced — skill that exceeds `HERMES_TIMEOUT` is killed
4. All invocations are logged with requester, skill, duration, exit code
5. Skills are registered in `hermes/skills/` with a `skill.yaml` manifest

---

## 5. Related SPECs

- [SPEC-001](../SPEC-001-homelab-control-plane.md) — Homelab Control Plane (host platform)
- [SPEC-003](../SPEC-003-memory-rag-llm-stack.md) — Memory RAG LLM Stack (downstream consumer)
- [SPEC-004](../SPEC-004-autonomous-execution-pipeline.md) — Autonomous Pipeline (Nexus workflow)
