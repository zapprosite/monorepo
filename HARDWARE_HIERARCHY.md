# Hardware Hierarchy — Homelab Complete Map

**Classification:** INTERNAL | **Owner:** Platform Engineering
**Version:** 1.0.0 | **Updated:** 2026-04-26
**Purpose:** Single source of truth for entire homelab infrastructure

---

## Overview

This document maps the **COMPLETE** homelab infrastructure. Any LLM reading this monorepo
must consult this file to understand the full hardware/software stack.

```
Internet
    └── Cloudflare Tunnel (*.zappro.site)
            │
            ▼
    ┌───────────────────────────────────────────────┐
    │     UBUNTU DESKTOP LTS (bare metal)           │
    │     Host: zappro.site                         │
    │     GPU: NVIDIA RTX 4090 24GB                 │
    │     Storage: ZFS 3.5TB (tank)                │
    │                                               │
    │     ┌─────────────────────────────┐           │
    │     │  CORE SERVICES (this repo) │           │
    │     │  /srv/monorepo            │           │
    │     │  ├── apps/ai-gateway       │           │
    │     │  ├── apps/api              │           │
    │     │  ├── apps/monitoring       │           │
    │     │  ├── .claude/vibe-kit/     │           │
    │     │  └── docs/                 │           │
    │     └─────────────────────────────┘           │
    │                                               │
    │     ┌─────────────────────────────┐           │
    │     │  LINKED SERVICES          │           │
    │     │  ├── ops/ → /srv/ops      │           │
    │     │  ├── hermes-second-brain/ │           │
    │     │  ├── hermes/ → ~/.hermes  │           │
    │     │  ├── fit-tracker/         │           │
    │     │  ├── hvacr-swarm/         │           │
    │     │  └── edge-tts/            │           │
    │     └─────────────────────────────┘           │
    └───────────────────────────────────────────────┘
```

---

## Hardware Specs

| Component | Specification |
|-----------|---------------|
| **Host** | Ubuntu Desktop LTS (bare metal) |
| **CPU** | See `/srv/ops/hardware/` |
| **GPU** | NVIDIA RTX 4090 24GB |
| **RAM** | See `/srv/ops/hardware/` |
| **Storage** | ZFS pool "tank" 3.5TB |
| **Network** | Cloudflare Tunnel (aee7a93d...) |

---

## Service Ports (Canonical)

| Port | Service | Location |
|------|---------|----------|
| 4000 | LiteLLM (LLM Proxy) | `/srv/ops/docker/` |
| 4002 | AI Gateway (Hermes) | `/srv/ops/docker/` |
| 6333 | Qdrant Vector DB | `/srv/ops/docker/` |
| 8000 | Coolify PaaS | `/srv/ops/docker/` |
| 8642 | Hermes Agent | `/srv/ops/docker/` |
| 11434 | Ollama (LLM Local) | `/srv/ops/docker/` |

**Full port list:** `/srv/ops/ai-governance/PORTS.md`

---

## Linked Repositories & Services

```
monorepo/
├── ops/                    # Infrastructure as Code (Terraform, Ansible)
│   ├── ai-governance/      # Security & compliance (CONTRACT.md, GUARDRAILS.md)
│   ├── docker/             # Docker compose files
│   ├── terraform/          # Terraform configs
│   ├── ansible/            # Ansible playbooks
│   ├── network/            # Network configs
│   ├── mcp-*/              # MCP servers (coolify, ollama, qdrant, system)
│   ├── grafana/             # Grafana dashboards
│   └── docs/               # Ops documentation
│
├── hermes-second-brain/     # Mem0 memory layer
│   ├── libs/subagents/     # Memory archivist, collection manager
│   ├── SOUL.md            # Security & architecture docs
│   └── libs/mem0_client.py
│
├── hermes/                 # Hermes Agency (symlinked to ~/.hermes)
│   ├── libs/agents/        # Agent implementations
│   ├── libs/tools/          # Tool definitions
│   └── configs/             # Configuration files
│
├── fit-tracker/            # Fitness tracking app
├── hvacr-swarm/            # HVAC automation
└── edge-tts/               # Edge TTS service
```

---

## Quick Reference Commands

```bash
# Infrastructure
cd /srv/ops && cat HOMELAB.md

# Port governance
cat /srv/ops/ai-governance/PORTS.md

# Network map
cat /srv/ops/ai-governance/NETWORK_MAP.md

# Active subdomains
cat /srv/ops/ai-governance/SUBDOMAINS.md

# Security rules
cat /srv/ops/ai-governance/CONTRACT.md
cat /srv/ops/ai-governance/GUARDRAILS.md

# Hardware specs
ls /srv/ops/hardware/

# Docker services
docker ps
cat /srv/ops/docker/docker-compose.yml

# Monitoring
curl -sf http://localhost:9090/api/v1/status

# ZFS status
zpool status tank
```

---

## Governance

All changes must follow:

1. **Read APPROVAL_MATRIX** — `/srv/ops/ai-governance/APPROVAL_MATRIX.md`
2. **Check PORTS.md** — Before using any port
3. **Check SUBDOMAINS.md** — Before adding subdomains
4. **Snapshot before risky ops** — ZFS snapshots

---

## NEXUS Framework (49 Agents)

Located in: `.claude/vibe-kit/nexus.sh`

| Mode | Purpose |
|------|---------|
| debug | Diagnostic & troubleshooting |
| test | Unit/Integration/E2E |
| backend | API, Services, DB |
| frontend | UI, Components |
| review | Code review, Quality gates |
| docs | Documentation |
| deploy | Docker, Coolify, Rollback |

---

**Reference:** Full architecture in `/srv/ops/HOMELAB.md`
