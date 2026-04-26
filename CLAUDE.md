# CLAUDE.md — Monorepo Agent Instructions

**Project:** Homelab Monorepo | **Status:** Production
**Model:** MiniMax-M2.7 | **Context:** 100K tokens
**Updated:** 2026-04-25

---

## 🎯 Project Overview

This monorepo powers **zappro.site** — a self-hosted AI platform with:

- **Nexus SRE Framework** — 7×7=49 specialized agents for automation
- **Hermes + Mem0** — Multi-agent orchestration with persistent memory
- **Qdrant Vector DB** — RAG infrastructure
- **LiteLLM** — Multi-provider LLM gateway
- **Gitea** — Git hosting with CI/CD

## 🏠 Infrastructure Map

### `/srv/` — Core Services

| Path | Purpose |
|------|---------|
| `/srv/monorepo` | **THIS REPO** — Nexus + Hermes + Mem0 |
| `/srv/ops` | Terraform IaC |
| `/srv/hermes-second-brain` | Knowledge graph |
| `/srv/fit-tracker-v2` | Fitness app |
| `/srv/hvacr-swarm` | HVAC automation |
| `/srv/edge-tts` | TTS service |
| `/srv/data` | ZFS volumes |
| `/srv/backups` | Backups |
| `/srv/docker-data` | Docker volumes |
| `/srv/models` | Ollama models |
| `/srv/archive` | Archived projects |

### `/home/will/` — Ubuntu Desktop LTS

| Path | Purpose |
|------|---------|
| `/home/will/pc-cel` | RustDesk remote control |
| `/home/will/go` | Go modules |
| `/home/will/dev/skills` | Homelab skills |
| `/home/will/mcp-data` | Memory keeper |
| `/home/will/obsidian-vault` | Notes |

## 📁 Directory Conventions

| Path | Purpose |
|------|---------|
| `apps/` | Applications (api, web, fit-v3, ai-gateway) |
| `packages/` | Shared libraries |
| `docs/` | Enterprise documentation |
| `scripts/` | Operations scripts (nexus-*.sh) |
| `archive/` | Deprecated/archived code |

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

---

## 🔄 Context Management

### Thresholds

| Usage | Status | Action |
|-------|--------|--------|
| 0-70% | 🟢 Normal | Continue |
| 70-85% | 🟡 Warning | Auto-snapshot + Nexus Tutor |
| 85-95% | 🔴 Critical | Compact + save |
| 95-100% | ⚫ Emergency | Save all + recommend `/new` |

### Scripts

```bash
nexus-context-window-manager.sh status
nexus-context-window-manager.sh save
nexus-context-window-manager.sh monitor
```

---

## 📜 Scripts Reference

| Script | Purpose |
|--------|---------|
| `nexus-investigate.sh` | Deep health investigation (4 layers) |
| `nexus-legacy-detector.sh` | Legacy file detection |
| `nexus-tunnel.sh` | Tunnel ingress management |
| `nexus-ufw.sh` | Firewall automation |
| `nexus-alert.sh` | Persistent alerts |
| `nexus-context-window-manager.sh` | Context monitoring |
| `nexus-session-scheduler.sh` | Session scheduling |
| `nexus-sre.sh` | Autonomous deploy |
| `nexus-governance.sh` | Full deploy pipeline |
| `nexus-code-scanner.sh` | Claude CLI analysis |
| `nexus-tutor.sh` | Interactive SRE learning |
| `fit-v3/fit-v3.sh` | Fitness assistant |

---

## 📋 Documentation Standards

- **SPECs/** — Formal feature specifications (use SPEC template)
- **AGENTS.md** — Multi-agent orchestration + full infrastructure map
- **NEXUS-SRE-GUIDE.md** — SRE automation guide
- **ARCHITECTURE.md** — System architecture
- **`/srv/hermes-second-brain/CLAUDE.md`** — Knowledge graph docs
- **`docs/SECRETS-CLEANUP.md`** — Secrets cleanup runbook

---

## 🏷️ Commit Convention

```
feat:新增功能
fix:修复问题
refactor:重构代码
docs:文档更新
chore:杂项
```

---

## 🚨 Escalation Matrix

| Level | Response Time | Contact | Action |
|-------|---------------|---------|--------|
| P1 Critical | 15 min | On-call | Full outage |
| P2 High | 1 hour | Platform Team | Degradation |
| P3 Medium | 4 hours | SRE on-duty | Non-critical |
| P4 Low | 24 hours | Next day | Documentation |

---

## 📊 Status Indicators

- ✅ Healthy/Complete
- ⚠️ Warning/Needs attention
- ❌ Error/Failed
- 🔄 In progress

**Last updated:** 2026-04-25
**Owner:** Platform Engineering
