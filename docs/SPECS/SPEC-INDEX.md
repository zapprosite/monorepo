---
name: SPEC Index
description: Auto-generated index of all SPECs with status
type: index
---

# SPEC Index

**Last Updated:** 2026-04-08
**Generator:** `/pg` (pipeline-gen skill)
**Total SPECs:** 15

---

## Index

| # | Title | Status | Updated | Priority | Owner |
|---|-------|--------|---------|----------|-------|
| [SPEC-001](./SPEC-001-workflow-performatico.md) | Workflow Performatico de AI Tools | DRAFT | 2026-04-08 | Alta | will |
| [SPEC-001](./SPEC-001-template-fusionado.md) | Template Claude-Code-Minimax Fusionado | DONE | 2026-04-07 | — | will |
| [SPEC-002](./SPEC-002-homelab-network-refactor.md) | Homelab Network Refactor — Cloudflare Tunnel + Coolify | DRAFT | 2026-04-08 | Alta | Claude Code |
| [SPEC-002](./SPEC-002-homelab-monitor-agent.md) | Homelab Monitor Agent | DRAFT | 2026-04-08 | Alta | Claude Code |
| [SPEC-004](./SPEC-004-kokoro-tts-kit.md) | Kokoro TTS Kit — PT-BR Voice Synthesis | PROTEGIDO | 2026-04-08 | Critical | will |
| [SPEC-005](./SPEC-005-wav2vec2-stt-kit.md) | wav2vec2 STT Kit — PT-BR Speech-to-Text | PROTEGIDO | 2026-04-08 | Critical | will |
| [SPEC-006](./SPEC-006-playwright-e2e.md) | Playwright E2E + Chrome Extension Testing | DRAFT | 2026-04-08 | Media | will |
| [SPEC-007](./SPEC-007-openclaw-oauth-profiles.md) | OpenClaw OAuth Persistent Login | PROPOSED | 2026-04-08 | Media | will |
| [SPEC-PERPLEXITY](./SPEC-PERPLEXITY-GITOPS.md) | Perplexity Agent — GitOps Deployment Pattern | APPROVED | 2026-04-08 | Alta | will |
| [SPEC-009](./SPEC-009-openclaw-persona-audio-stack.md) | OpenClaw Persona + Audio Stack — PT-BR | PROTEGIDO | 2026-04-08 | Critical | will |
| [SPEC-010](./SPEC-010-openclaw-agents-kit.md) | OpenClaw Agents Kit — Universal Sub-Agent Governance | DRAFT | 2026-04-09 | Media | will + Claude Code |
| [SPEC-011](./SPEC-011-openclaw-agency-reimagined.md) | OpenClaw Agency — Voice-First Marketing & Design Agency | DRAFT | 2026-04-08 | Media | will |
| [SPEC-012](./SPEC-012-openclaw-update-discoverer.md) | openclaw-update-discoverer — Corrigir Local Scan | DRAFT | 2026-04-09 | Media | will |

---

## By Status

### APPROVED (1)

| # | Title | Next Action |
|---|-------|-------------|
| SPEC-PERPLEXITY | Perplexity Agent GitOps | Implementar auto-rollback |

### DONE (1)

| # | Title | Notes |
|---|-------|-------|
| SPEC-001-template | Template Fusionado | Historical — infrastructure creation |

### DRAFT (7)

| # | Title | Blocker |
|---|-------|---------|
| SPEC-001 | Workflow Performatico | Awaiting human approval |
| SPEC-002 | Homelab Network Refactor | Cloudflare Tunnel setup |
| SPEC-002 | Homelab Monitor Agent | Vault integration |
| SPEC-006 | Playwright E2E | Test environment setup |
| SPEC-010 | OpenClaw Agents Kit | Coolify MCP research |
| SPEC-011 | OpenClaw Agency | Depends on SPEC-009, SPEC-010 |
| SPEC-012 | Update Discoverer | Local skills metadata |

### IMPLEMENTING (0)

_None currently._

### PROPOSED (1)

| # | Title |等待 |
|---|-------|-----|
| SPEC-007 | OpenClaw OAuth Profiles | Chrome profile persistence testing |

### PROTEGIDO (3)

| # | Title | Notes |
|---|-------|-------|
| SPEC-004 | Kokoro TTS Kit | Do not alter — immutable voice stack |
| SPEC-005 | wav2vec2 STT Kit | Do not alter — immutable STT stack |
| SPEC-009 | OpenClaw Audio Stack | Do not alter — canonical configuration |

### STALE (0)

_None currently._

---

## By Priority

### Critical (3) — PROTEGIDO

- SPEC-004: Kokoro TTS Kit
- SPEC-005: wav2vec2 STT Kit
- SPEC-009: OpenClaw Persona Audio Stack

### Alta (3)

- SPEC-001: Workflow Performatico
- SPEC-002: Homelab Network Refactor
- SPEC-PERPLEXITY: Perplexity GitOps

### Media (4)

- SPEC-006: Playwright E2E
- SPEC-007: OpenClaw OAuth
- SPEC-010: OpenClaw Agents Kit
- SPEC-011: OpenClaw Agency
- SPEC-012: Update Discoverer

---

## Open Questions Summary

| # | Question | SPEC | Impact | Priority |
|---|----------|------|--------|----------|
| OQ-1 | Auto-rotação GitHub PAT | SPEC-001 | Low | Med |
| OQ-2 | Loki vs local audit logs | SPEC-001 | Low | Med |
| OQ-3 | Telegram group vs DM | SPEC-002-homelab-monitor | Low | Med |

---

## Related ADRs

| ADR | Title | Related SPECs |
|-----|-------|--------------|
| 20260404 | Voice Dev Pipeline | SPEC-004, SPEC-005, SPEC-009 |
| 001 | Governança Centralizada | SPEC-001, SPEC-002 |
| 002 | Ambiente Dev VRV Bot | SPEC-007 |

---

## Metrics

| Metric | Value |
|--------|-------|
| Total SPECs | 15 |
| Active (DRAFT + IMPLEMENTING) | 7 |
| Completed (DONE + APPROVED) | 2 |
| Protected | 3 |
| Stale | 0 |

---

## Pipeline

```
Discovery → SPEC → TASKS → IMPLEMENT → REVIEW → SHIP
    ↑___________/[ regenerate via /pg ]___________↑
```

## Usage

This file is **auto-generated** by `/pg`. Do not edit manually.

To refresh: run `/pg` after creating or updating SPECs.
