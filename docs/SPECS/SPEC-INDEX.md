---
name: SPEC-INDEX
description: Canonical index of all SPECs — source of truth for agent navigation
type: reference
status: ACTIVE
---

# SPEC Canonical Index

> **TL;DR — START HERE:** Para entender a arquitectura completa do sistema em 5 minutos, ler primeiro: [docs/ARCHITECTURE-OVERVIEW.md](../ARCHITECTURE-OVERVIEW.md)

**Purpose:** Every agent working in this monorepo should read this index FIRST to understand which specs are source of truth and which are historical. For the full system architecture, see [ARCHITECTURE-OVERVIEW.md](../ARCHITECTURE-OVERVIEW.md).

---

## How to Navigate This Index

**New to the project?** Start with [ARCHITECTURE-OVERVIEW.md](../ARCHITECTURE-OVERVIEW.md) — it explains the complete stack in 5 minutes.

**Working on a specific domain?** Use the table below to find the canonical SPEC:

| Domain                       | Start Here                                              | Canonical SPEC                                                                                   | Notes                               |
| ---------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------- |
| **System architecture**      | [ARCHITECTURE-OVERVIEW.md](../ARCHITECTURE-OVERVIEW.md) | —                                                                                                | Complete stack overview             |
| **Audio/voice (TTS/STT)**    | SPEC-027                                                | [SPEC-027-voice-pipeline-humanized-ptbr.md](./SPEC-027-voice-pipeline-humanized-ptbr.md)         | PT-BR humanized, Kokoro v0.2.4      |
| **Voice pipeline**           | SPEC-027                                                | [SPEC-027-voice-pipeline-humanized-ptbr.md](./SPEC-027-voice-pipeline-humanized-ptbr.md)         | PT-BR humanized, Kokoro v0.2.4      |
| **Secrets / Infisical**      | SPEC-029                                                | [SPEC-029-INFISICAL-SDK-MANDATORY.md](./SPEC-029-INFISICAL-SDK-MANDATORY.md)                     | Zero tolerance mandate              |
| **Tunnel / subdomains**      | SPEC-032                                                | [SPEC-032-tunnel-health-automation.md](./SPEC-032-tunnel-health-automation.md)                   | smoke-tunnel.sh ✅                  |
| **Hermes Agent**             | SPEC-038                                                | [SPEC-038-hermes-agent-migration.md](./SPEC-038-hermes-agent-migration.md)                       | OPERAÇÃO OVERLORD                   |
| **Hermes Gateway**           | SPEC-039                                                | [SPEC-039-hermes-gateway-tunnel.md](./SPEC-039-hermes-gateway-tunnel.md)                         | hermes.zappro.site → :8642          |
| **Alerting & rate limiting** | SPEC-040                                                | [SPEC-040-homelab-alerting-rate-limit.md](./SPEC-040-homelab-alerting-rate-limit.md)             | GPU security                        |
| **Monorepo polish**          | SPEC-041                                                | [SPEC-041-monorepo-estado-arte-polish.md](./SPEC-041-monorepo-estado-arte-polish.md)             | Tech debt resolution                |
| **AI Gateway PT-BR**         | SPEC-047                                                | [SPEC-047-enterprise-polish-ai-gateway-ptbr.md](./SPEC-047-enterprise-polish-ai-gateway-ptbr.md) | ai-gateway :4002 ✅                 |
| **OpenClaw prune**           | SPEC-051                                                | [SPEC-051-openclaw-prune-specs-polish.md](./SPEC-051-openclaw-prune-specs-polish.md)             | Prune total OpenClaw legacy ✅      |
| **Hermes MCP + Context7**    | SPEC-052                                                | [SPEC-052-hermes-mcp-context7-integration.md](./SPEC-052-hermes-mcp-context7-integration.md)     | Context7 MCP research               |
| **OpenAI Facade Completo**   | SPEC-048 ✅                                             | [SPEC-048-openai-facade-completo.md](./SPEC-048-openai-facade-completo.md)                       | texto+visão+voz, llm.zappro.site ✅ |
| **Maintenance**              | SPEC-031                                                | [SPEC-031-homelab-maintenance.md](./SPEC-031-homelab-maintenance.md)                             | ZFS, HEALTHCHECKs                   |
| **MiniMax agents**           | SPEC-034                                                | [SPEC-034-minimax-agent-use-cases.md](./SPEC-034-minimax-agent-use-cases.md)                     | 6 skills created                    |
| **Todo web app**             | SPEC-036                                                | [SPEC-036-todo-web.md](./SPEC-036-todo-web.md)                                                   | ✅ DONE — OAuth deployed            |
| **Obsidian vault UI**        | SPEC-037                                                | [SPEC-037-md-zappro-site.md](./SPEC-037-md-zappro-site.md)                                       | 📋 PROPOSED — Google OAuth          |

---

## Active Specs by Status

### ✅ DONE (Deployed/Complete)

| SPEC     | Title                  | Deployed                                             |
| -------- | ---------------------- | ---------------------------------------------------- |
| SPEC-036 | Todo web app           | todo.zappro.site (OAuth, 2026-04-13)                 |
| SPEC-043 | Subdomain prune        | bot/supabase PRUNED, hermes.zappro.site ACTIVE       |
| SPEC-048 | OpenAI Facade Completo | llm.zappro.site (:4002), smoke (6/6) ✅              |
| SPEC-039 | Hermes Gateway tunnel  | hermes.zappro.site → :8642                           |
| SPEC-051 | OpenClaw prune total   | ✅ DONE — OpenClaw legacy PRUNED, 40+ files archived |

### 🟡 IN_PROGRESS (Active Work)

| SPEC     | Title                            | Progress                                                                                                                 |
| -------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| SPEC-031 | Homelab maintenance              | 7 tasks: node-exporter, loki, cadvisor HEALTHCHECKs, ZFS cron                                                            |
| SPEC-032 | Tunnel health automation         | smoke-tunnel.sh ✅, pre-commit hook ✅, autoheal ✅, cron ⏳                                                             |
| SPEC-034 | MiniMax agent use cases          | 6 skills: minimax-code-gen, minimax-debugger, minimax-refactor, minimax-research, minimax-security-audit, review-minimax |
| SPEC-040 | Homelab alerting & rate limiting | alert-sender deployed, Loki deploying                                                                                    |
| SPEC-041 | Monorepo polish                  | Tech debt resolution, ESLint flat config, TypeScript upgrade                                                             |
| SPEC-052 | Hermes MCP + Context7            | Research completo — MCP architecture, Context7 patterns, quotas esgotadas plano contingência                             |

### 🚧 IMPLEMENTING (In Active Migration)

| SPEC     | Title                  | Notes                                                 |
| -------- | ---------------------- | ----------------------------------------------------- |
| SPEC-038 | Hermes Agent migration | OPERAÇÃO OVERLORD — OpenClaw → Hermes-Agent           |
| SPEC-051 | OpenClaw prune total   | Prune total OpenClaw legacy — HERMES único assistente |
| SPEC-052 | Hermes MCP + Context7  | Context7 MCP + web search integration research        |

### 📋 SPECIFIED (Planned/Proposed)

| SPEC     | Title          | Notes                              |
| -------- | -------------- | ---------------------------------- |
| SPEC-037 | md.zappro.site | Obsidian vault UI via Google OAuth |

---

## Quick Reference

```
Audio/STT/TTS issues         → SPEC-027
Voice pipeline                → SPEC-027
Infisical/secrets            → SPEC-029 (mandate)
Tunnel/subdomain health      → SPEC-032
Hermes Agent migration       → SPEC-038
Hermes Gateway tunnel         → SPEC-039
Alerting & rate limiting     → SPEC-040
Monorepo polish              → SPEC-041
OpenClaw prune (done)        → SPEC-051
Hermes MCP + Context7        → SPEC-052
Todo web app (done)          → SPEC-036
Obsidian vault UI            → SPEC-037 (proposed)
Subdomain prune (done)       → SPEC-043
Homelab maintenance          → SPEC-031
MiniMax agent skills         → SPEC-034
```

---

## Protected Specs

These specs are **PROTEGIDO** — changes require explicit approval from owner:

- SPEC-027 — Voice pipeline canonical
- SPEC-029 — Infisical SDK mandate (zero tolerance)

---

## Archived Specs (Historical)

If your feature intersects an archived SPEC, check the replacement column:

| SPEC            | Title                         | Canonical Replacement                           |
| --------------- | ----------------------------- | ----------------------------------------------- |
| SPEC-001        | Template fusionado            | SPEC-024 + CLAUDE.md                            |
| SPEC-002a       | HomeLab Monitor Agent         | SPEC-023 (monitoring)                           |
| SPEC-002b       | Homelab Network Refactor      | SUBDOMAINS.md + PORTS.md                        |
| SPEC-004        | Kokoro TTS Kit                | SPEC-027 (voice pipeline, merged as historical) |
| SPEC-005        | wav2vec2 STT Kit              | SPEC-027 (voice pipeline, merged as historical) |
| SPEC-009        | OpenClaw Persona Audio Stack  | SPEC-027 (voice pipeline, archived OpenClaw)    |
| SPEC-006        | Playwright E2E                | SPEC-024 (test pipeline)                        |
| SPEC-007        | OpenClaw OAuth Profiles       | SPEC-027 (voice pipeline, OAuth deprecated)     |
| SPEC-010        | OpenClaw Agents Kit           | SPEC-027 (voice pipeline)                       |
| SPEC-011        | OpenClaw Agency Suite         | SPEC-027 (voice pipeline)                       |
| SPEC-012        | openclaw-update-discoverer    | SPEC-023 (monitoring stack)                     |
| SPEC-014        | Cursor AI CI/CD Pattern       | SPEC-024 + cursor-loop skill                    |
| SPEC-015        | Gitea Actions Enterprise      | SPEC-024 + git mirror scripts                   |
| SPEC-016        | Voice Pipeline Cursor Loop    | SPEC-027 + SPEC-032                             |
| SPEC-017        | Voice API Deploy              | SPEC-027 + SPEC-032                             |
| SPEC-018        | wav2vec2 Deepgram Proxy       | SPEC-027 (voice pipeline)                       |
| SPEC-019        | OpenWebUI Repair              | SUBDOMAINS.md (chat.zappro.site routing fixed)  |
| SPEC-020        | OpenWebUI OpenClaw Bridge     | SPEC-027 + SPEC-032                             |
| SPEC-021        | Claude Code Cursor Loop       | cursor-loop skill + SPEC-024                    |
| SPEC-022        | Cursor Loop CLI Solutions     | cursor-loop skill + SPEC-024                    |
| SPEC-023        | Claude Code CLI Integration   | SPEC-023-unified-monitoring-self-healing.md     |
| SPEC-024        | Unified Claude Agent Monorepo | SPEC-041 + current .claude/ structure           |
| SPEC-025        | OpenClaw CEO Mix Voice Stack  | SPEC-027 (voice pipeline)                       |
| SPEC-025-REPORT | CEO Mix Report                | SPEC-024 + SPEC-025                             |
| SPEC-026        | OpenClaw TTS Route Fix        | SPEC-027 (voice pipeline)                       |
| SPEC-028        | Perplexity GitOps             | SPEC-024 + perplexity-agent                     |
| SPEC-030        | AGENTS.md Top Links Audit     | SPEC-041 + current AGENTS.md                    |
| SPEC-033        | Supabase Tunnel Exposure      | SPEC-043 (supabase PRUNED)                      |

All archived specs are in: `docs/SPECS/archive/`

---

## Environment Variables Standard

All secrets and environment-specific values MUST:

| Standard             | Description                                                    |
| -------------------- | -------------------------------------------------------------- |
| **Secrets**          | Store in `.env` files, read via `process.env` or Infisical SDK |
| **No hardcoding**    | Never embed tokens/keys directly in SPECs or code              |
| **Reference format** | Use `${SECRET_NAME}` syntax (e.g., `${CLOUDFLARE_API_TOKEN}`)  |
| **Infisical SDK**    | Use Infisical SDK for runtime secret retrieval in code         |

See [SPEC-029-INFISICAL-SDK-MANDATORY.md](./SPEC-029-INFISICAL-SDK-MANDATORY.md) for enforcement details.

---

## Spec Domains Summary

| Domain         | Canonical                | Active Work                            |
| -------------- | ------------------------ | -------------------------------------- |
| Audio Stack    | SPEC-027                 | SPEC-027 (voice pipeline)              |
| Infrastructure | SPEC-039 (Hermes tunnel) | SPEC-032, SPEC-031, SPEC-038, SPEC-043 |
| Agent/CLI      | SPEC-041 (polish)        | SPEC-034 (MiniMax skills)              |
| Voice Pipeline | SPEC-027                 | —                                      |
| Infisical      | SPEC-029 (mandate)       | —                                      |
| Maintenance    | SPEC-031                 | SPEC-040 (alerting)                    |
| Apps           | SPEC-036 (DONE)          | SPEC-037 (proposed)                    |
