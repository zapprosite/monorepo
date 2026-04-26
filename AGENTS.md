# AGENTS.md — Nexus Command Center

> **⚠️ READ FIRST:** See `HARDWARE_HIERARCHY.md` for complete infrastructure map
>
> **Classification:** INTERNAL | **Owner:** Platform Engineering
> **Version:** 2.1.0 | **Updated:** 2026-04-26

---

## 🔄 AI Context Sync (PRIMEIRO!)

**⚡ KEEP LLM CONTEXT FRESH — Run on every `/ship`**

```
scripts/ai-context-sync/
├── ai-context-sync.sh       # Delta sync to Qdrant + Mem0
├── ship_skill.md            # /ship integration
└── ship_with_sync.md        # Workflow documentation
```

```bash
# Check status
ai-context-sync.sh --status

# Dry-run (see what would sync)
ai-context-sync.sh --dry-run

# Full reindex
ai-context-sync.sh --full

# Integrated with /ship (runs automatically)
# See: scripts/ai-context-sync/ship_with_sync.md
```

**What it does:**
- Delta sync only (changed files since last sync)
- Updates Qdrant collection `monorepo-context`
- Updates Mem0 freshness metadata
- Atomic alias swap (zero-downtime)

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

## 🤖 Nexus Framework (7×7 = 49 Agents)

**Entry:** `.claude/vibe-kit/nexus.sh`

```bash
# Check status
nexus.sh --status

# Modes
nexus.sh --mode debug|test|backend|frontend|review|docs|deploy

# Execute workflow
nexus.sh --spec SPEC-NNN --phase plan|review|execute|verify|complete
```

### Mode Matrix

| Mode | Agents | Purpose |
|------|--------|---------|
| **debug** | log-diagnostic, stack-trace, perf-profiler, network-tracer, security-scanner, sre-monitor, incident-response | Diagnostic & troubleshooting |
| **test** | unit-tester, integration-tester, e2e-tester, coverage-analyzer, boundary-tester, flaky-detector, property-tester | Testing |
| **backend** | api-developer, service-architect, db-migrator, cache-specialist, auth-engineer, event-developer, file-pipeline | Backend development |
| **frontend** | component-dev, responsive-dev, state-manager, animation-dev, a11y-auditor, perf-optimizer, design-system | Frontend development |
| **review** | correctness-reviewer, readability-reviewer, architecture-reviewer, security-reviewer, perf-reviewer, dependency-auditor, quality-scorer | Code review |
| **docs** | api-doc-writer, readme-writer, changelog-writer, inline-doc-writer, diagram-generator, adr-writer, doc-coverage-auditor | Documentation |
| **deploy** | docker-builder, compose-orchestrator, coolify-deployer, secret-rotator, rollback-executor, zfs-snapshotter, health-checker | Deployment |

---

## 🔗 Service Access

| Service | Location | Description |
|---------|----------|-------------|
| **Hermes Agency** | `hermes/` | Multi-agent orchestration with Mem0 |
| **Mem0 Memory** | `hermes-second-brain/libs/mem0_client.py` | Qdrant-backed memory |
| **LiteLLM** | `ops/docker/` | Multi-provider LLM proxy |
| **Qdrant** | `ops/docker/` | Vector database |
| **Edge TTS** | `edge-tts/` | Microsoft TTS bridge |
| **Coolify** | `ops/` | Container management |

---

## 📋 Quick Reference

```bash
# Full homelab map
cat HARDWARE_HIERARCHY.md

# Ops governance
cat ops/ai-governance/CONTRACT.md
cat ops/ai-governance/PORTS.md

# Health check
nexus.sh --status
nexus-investigate.sh all 3

# Architecture
cat ops/HOMELAB.md
```

---

## 📜 Agent Commands Reference

| Command | Purpose |
|---------|---------|
| `/spec` | Create formal specification |
| `/plan` | Plan implementation |
| `/test` | Run test suite |
| `/review` | Code review |
| `/ship` | End-of-session deploy |

---

**Nexus:** 49 specialized agents for enterprise-grade SRE automation
**Stack:** Claude Code + Gitea + Mem0 + Qdrant + LiteLLM + Hermes
