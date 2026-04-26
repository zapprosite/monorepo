# CLAUDE.md — Monorepo Agent Instructions

> **⚠️ READ FIRST:** See `HARDWARE_HIERARCHY.md` for complete infrastructure map
>
> **Project:** Homelab Monorepo | **Status:** Production
> **Model:** MiniMax-M2.7 | **Context:** 100K tokens
> **Updated:** 2026-04-26

---

## 🏠 Complete Homelab Structure

This monorepo is the **SINGLE SOURCE OF TRUTH** for the entire homelab:

```
/srv/monorepo/                    ← YOU ARE HERE
│
├── [SYMLINKS - Full Access to All Services]
│   ├── ops/                    → /srv/ops              # IaC + Governance
│   ├── hermes-second-brain/    → /srv/hermes-second-brain  # Mem0 Memory
│   ├── hermes/                 → ~/.hermes            # Hermes Agency
│   ├── fit-tracker/            → /srv/fit-tracker-v2  # Fitness App
│   ├── hvacr-swarm/            → /srv/hvacr-swarm     # HVAC Automation
│   └── edge-tts/               → /srv/edge-tts        # TTS Service
│
├── apps/                        # PRODUCTION SERVICES
│   ├── ai-gateway/             # OpenAI-compatible facade
│   ├── api/                    # Fastify + tRPC backend
│   └── monitoring/             # SRE dashboard
│
├── docs/                        # Enterprise Documentation
│   ├── NEXUS-SRE-GUIDE.md     # SRE Automation Guide
│   ├── VOICE-STT-STACK.md     # Voice Pipeline (STT/TTS)
│   └── [full docs in /srv/ops/HOMELAB.md]
│
└── .claude/vibe-kit/           # NEXUS FRAMEWORK
    └── nexus.sh                 # 49-Agent Orchestrator
```

---

## 🎯 Project Overview

This monorepo powers **zappro.site** — a self-hosted AI platform with:

- **Nexus SRE Framework** — 7×7=49 specialized agents for automation
- **Hermes + Mem0** — Multi-agent orchestration with persistent memory
- **Qdrant Vector DB** — RAG infrastructure
- **LiteLLM** — Multi-provider LLM gateway
- **Gitea** — Git hosting with CI/CD

---

## 🔗 Quick Reference

| Command | Purpose |
|---------|---------|
| `cat HARDWARE_HIERARCHY.md` | **START HERE** — Full infrastructure map |
| `cat ops/HOMELAB.md` | Source of truth for homelab |
| `cat ops/ai-governance/PORTS.md` | Port governance |
| `cat ops/ai-governance/CONTRACT.md` | Security rules |
| `nexus.sh --status` | Nexus framework status |
| `nexus.sh --mode debug` | List debug agents |

---

## ⚡ Quick Commands

```bash
# Development
pnpm dev              # All apps
pnpm build            # Production build
pnpm tsc --noEmit     # Type check

# Nexus Health
nexus-investigate.sh all 3
nexus-legacy-detector.sh full /srv/monorepo

# Linting
pnpm lint
biome check .
```

---

## 🔐 Security Rules

**⚠️ Authoritative security rules:** `/srv/ops/ai-governance/CONTRACT.md` and `GUARDRAILS.md`

### ✅ Safe (No Approval Needed)
- Read-only operations (logs, status, inspection)
- Backups and snapshots
- Documentation updates
- Application development in `/srv/monorepo`

### ⚠️ Requires Approval
- Service restart/stop/start
- Package installation/upgrade
- ZFS operations
- Firewall changes
- Network modifications

### ❌ Forbidden
- Disk wipe operations
- Delete `/srv/data`, `/srv/backups`
- ZFS pool destruction
- Exposing ports without updating PORTS.md + SUBDOMAINS.md

### Secrets
- All secrets via `.env` — never hardcoded
- See `.env.example` for canonical variable list
- If secrets are leaked: see `docs/SECRETS-CLEANUP.md`
- **NEVER** hardcode in logs or echo

---

## 📊 Status Indicators

- ✅ Healthy/Complete
- ⚠️ Warning/Needs attention
- ❌ Error/Failed
- 🔄 In progress

**Last updated:** 2026-04-26
**Owner:** Platform Engineering
