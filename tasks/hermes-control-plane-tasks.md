# Hermes Control Plane Tasks

Updated: 2026-04-24

## P0

| ID | Task | Status | Acceptance |
|---|---|---|---|
| HCP-P0-001 | Redact real secrets from specs/tasks/docs | done | Secret scan finds no real tokens in active docs/tasks |
| HCP-P0-002 | Canonicalize active SPECs to SPEC-001..004 | done | `docs/SPECS/ACTIVE.md` points only to active minimal specs |
| HCP-P0-003 | Fix embedding dimension drift | queued | Env, Qdrant collection size, Mem0 fallback, and tests agree on one dimension |
| HCP-P0-004 | Add Hermes homelab-control route/skill | queued | Hermes can route ops/control-plane intent separately from marketing agency intent |
| HCP-P0-005 | Add CLI adapter tools | queued | Codex, Claude, mclaude, opencode-go, opencode execute through typed tool wrappers |
| HCP-P0-006 | Repair Plan Mode Phase 0 | queued | No fake Qdrant vector syntax; real embedding or explicit skip path |
| HCP-P0-007 | Normalize Hermes port docs | queued | Gateway `:8642` and Agency `:3001` are consistently described |
| HCP-P0-008 | Boot Hermes Agency runtime | queued | Bot startup path explicit, `:3001` health works, deploy path has Dockerfile/compose or systemd |
| HCP-P0-009 | Normalize env var names used by code/docs | queued | Webhook and STT env vars match between `.env.example`, code, compose, docs |
| HCP-P0-010 | Enforce tool registry implementation coverage | queued | P0 tools fail tests if declared but not implemented |

## P1

| ID | Task | Status | Acceptance |
|---|---|---|---|
| HCP-P1-001 | Add Coolify adapter health/deploy/status actions | queued | Hermes can query app status and trigger deploy through env-based config |
| HCP-P1-002 | Add queue runner for `tasks/pipeline.json` | queued | One command claims next queued task and records result |
| HCP-P1-003 | Add RAG health endpoint/check | queued | Trieve/Qdrant/Ollama embedding failures visible in health output |
| HCP-P1-004 | Harden `ship.sh` Gitea issue/PR creation | queued | Uses env URL/token safely and posts valid JSON |
| HCP-P1-005 | Add smoke for CLI adapter availability | queued | Smoke reports installed/missing: codex, claude, mclaude, opencode-go-cli, opencode |

## P2

| ID | Task | Status | Acceptance |
|---|---|---|---|
| HCP-P2-001 | Migrate useful `docs/SPECs/` content into canonical specs | queued | Legacy casing no longer needed for active context |
| HCP-P2-002 | Add retrieval evals for second brain and monorepo docs | queued | 20 retrieval questions tracked with pass/fail |
| HCP-P2-003 | Convert old agent-state JSON into archived incident records | queued | `tasks/agent-states/` only holds current state or archived history |
