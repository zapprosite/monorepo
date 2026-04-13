---
name: SPEC-INDEX
description: Canonical index of all SPECs — source of truth for agent navigation
type: reference
status: ACTIVE
---

# SPEC Canonical Index

**Purpose:** Every agent working in this monorepo should read this index FIRST to understand which specs are source of truth and which are historical.

## Canonical Specs (ACTIVE)

| Domain | SPEC | Status | Notes |
|--------|------|--------|-------|
| Audio Stack | SPEC-009-openclaw-persona-audio-stack.md | ✅ ACTIVE | Kokoro + wav2vec2 + TTS Bridge — immutable, PROTECTED |
| Agent Monorepo | SPEC-024-UNIFIED-CLAUDE-AGENT-MONOREPO.md | ✅ ACTIVE | Turbo pipeline + git mirror + CI/CD |
| Voice Pipeline | SPEC-027-voice-pipeline-humanized-ptbr.md | ✅ ACTIVE | cron active, humanized PT-BR, Kokoro v0.2.4 |
| Infisical SDK | SPEC-029-INFISICAL-SDK-MANDATORY.md | ✅ ACTIVE | Zero tolerance mandate, no exceptions |
| List Web | SPEC-030-AGENTS-MD-TOP-LINKS.md | ✅ ACTIVE | /new-list-web skill — zero-to-deploy |
| Maintenance | SPEC-031-homelab-maintenance.md | ✅ ACTIVE | 7 tasks: Kokoro, node-exporter, loki, cadvisor, ZFS cron |
| Tunnel Health | SPEC-032-tunnel-health-automation.md | ✅ ACTIVE | smoke-tunnel.sh, pre-commit hook, autoheal, cron |
| Supabase Tunnel | SPEC-033-supabase-tunnel-exposure.md | ✅ ACTIVE | HTTP health proxy at :5433, supabase.zappro.site |
| MiniMax Agents | SPEC-034-minimax-agent-use-cases.md | ✅ ACTIVE | 10 new skills: /codegen, /msec, /dm, /bug-triage, /bcaffold, /mxr + more |

## Archived Specs (Historical)

| SPEC | Title | Canonical Replacement |
|------|-------|----------------------|
| SPEC-001 | Template fusionado | SPEC-024 + CLAUDE.md |
| SPEC-002a | HomeLab Monitor Agent | SPEC-023 (monitoring) |
| SPEC-002b | Homelab Network Refactor | SUBDOMAINS.md + PORTS.md |
| SPEC-004 | Kokoro TTS Kit | SPEC-009 (merged as historical appendix) |
| SPEC-005 | wav2vec2 STT Kit | SPEC-009 (merged as historical appendix) |
| SPEC-006 | Playwright E2E | SPEC-024 (test pipeline) |
| SPEC-007 | OpenClaw OAuth Profiles | SPEC-009 (OAuth implemented in bot.zappro.site) |
| SPEC-010 | OpenClaw Agents Kit | SPEC-009 + openclaw-audio-governance.md |
| SPEC-011 | OpenClaw Agency Suite | SPEC-009 + SPEC-027 (conceptual, never fully implemented) |
| SPEC-012 | openclaw-update-discoverer | SPEC-023 (monitoring stack) |
| SPEC-014 | Cursor AI CI/CD Pattern | SPEC-024 + cursor-loop skill |
| SPEC-015 | Gitea Actions Enterprise | SPEC-024 + git mirror scripts |
| SPEC-016 | Voice Pipeline Cursor Loop | SPEC-027 + SPEC-032 |
| SPEC-017 | Voice API Deploy | SPEC-027 + SPEC-032 |
| SPEC-018 | wav2vec2 Deepgram Proxy | SPEC-009 + SPEC-027 |
| SPEC-019 | OpenWebUI Repair | SUBDOMAINS.md (chat.zappro.site routing fixed) |
| SPEC-020 | OpenWebUI OpenClaw Bridge | SPEC-027 + SPEC-032 |
| SPEC-021 | Claude Code Cursor Loop | cursor-loop skill + SPEC-024 |
| SPEC-022 | Cursor Loop CLI Solutions | cursor-loop skill + SPEC-024 |
| SPEC-023 | Claude Code CLI Integration | SPEC-023-unified-monitoring-self-healing.md |
| SPEC-025 | OpenClaw CEO Mix Voice Stack | SPEC-009 + SPEC-027 |
| SPEC-025-REPORT | CEO Mix Report | SPEC-024 + SPEC-025 |
| SPEC-026 | OpenClaw TTS Route Fix | SPEC-009 + openclaw-audio-governance.md |
| SPEC-028 | Perplexity GitOps | SPEC-024 + perplexity-agent |

## How to Use This Index

1. **Before starting any work**, check if your domain has a canonical SPEC above
2. **If yes, read that SPEC first** — it's the source of truth
3. **If your feature intersects an archived SPEC**, check the replacement column
4. **When creating new specs**, update this index

## Spec Domains

- **Audio Stack:** SPEC-009 (canonical, PROTECTED), SPEC-027 (voice pipeline)
- **Infrastructure:** SPEC-032 (tunnel health), SPEC-033 (supabase tunnel), SPEC-031 (maintenance)
- **Agent/CLI:** SPEC-024 (monorepo), SPEC-030 (list-web skill)
- **Voice Pipeline:** SPEC-027 (canonical voice pipeline)
- **Infisical:** SPEC-029 (mandate)
- **Maintenance:** SPEC-031 (homelab improvements)

## Protected Specs

These specs are **PROTEGIDO** — changes require explicit approval from will-zappro:

- ✅ SPEC-009 — Audio stack immutable (STT, TTS, TTS Bridge, voices)
- ✅ SPEC-027 — Voice pipeline canonical
- ✅ SPEC-029 — Infisical SDK mandate (zero tolerance)

## Quick Reference

```
Audio/STT/TTS issues     → SPEC-009
Voice pipeline            → SPEC-027
Infisical/secrets        → SPEC-029
List-web from zero        → SPEC-030
Tunnel/subdomain health   → SPEC-032
Supabase database         → SPEC-033
Monorepo/git/CI           → SPEC-024
Homelab maintenance       → SPEC-031
```

## Obsidian Navigation

Archived specs contain `see_also:` links for Obsidian cross-referencing. Each archived spec has:
- `archived: true` frontmatter
- `superseded_by:` pointing to canonical replacement
- `see_also:` pointing to related active specs
- Warning banner at top

## Archive Location

All archived specs are in: `docs/SPECS/archive/`
