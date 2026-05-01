# SPEC-POLYMER-005 — Cron Strategy & Second Brain Memory Modes

**Version:** 1.0.0  
**Date:** 2026-05-01  
**Author:** Hermes (Sênior Architecture Review)  
**Status:** DRAFT → EXECUTE  

---

## 1. Context & Problem Statement

### Current State (Chaos Analysis)

| Cron Area | Problem | Scripts Involved |
|-----------|---------|-----------------|
| **SRE Monitor** | 4+ redundant monitors | coolify-sre, hermes-sre-monitor.sh, health_agent.sh, service_monitor.sh, overseer_agent.sh |
| **ZFS Snapshots** | 3 competing snapshot systems | coolify-backup (duplicates), zfs-snapshots.sh, backup-zfs-snapshot.sh |
| **Brain Backup** | 3 separate brain backups | hermes-brain-backup.sh, hermes-second-brain (ai-context-sync), memory-keeper-backup |
| **Metrics** | 4+ metric collectors | nexus-qdrant-stats.sh, nexus-ollama-stats.sh, nexus-redis-stats.sh, nexus-hermes-stats.sh, metrics_agent.sh |
| **GPU Monitor** | 2 overlapping | gpu_agent.sh, homelab-gemma-monitor.sh |
| **Security** | fragmented | security_agent.sh, fail2ban (native), UFW (native) |
| **Log Rotation** | inconsistent | cron.daily (anacron) + manual find in homelab-agents |
| **Backup** | scattered | 10+ backup-*.sh scripts, no unified rotation |
| **LLM Monitor** | 2 overlapping | llm_agent.sh, hermes-sre-monitor.sh (has LLM checks) |

### Root Cause

Ad-hoc growth: scripts added without consolidation, multiple agents created for same purpose, no unified taxonomy.

---

## 2. Proposed Architecture

### 2.1 Four Operation Modes

Every cron job and memory query belongs to one of these modes:

| Mode | Trigger | Description | Response Time |
|------|---------|-------------|---------------|
| **DEV** | `@here` or explicit | Development mode, experimental changes, rapid iteration | Minutes |
| **JUNIOR** | `/start` or routine | Day-to-day operations, standard procedures | Hours |
| **SÊNIOR** | `/sre` or escalation | Incident response, architecture changes, audits | Immediate |
| **EMERGENCY** | `/panic` or auto-detect | Service down, data loss, security breach | Seconds |

### 2.2 Memory Tiers & When to Use

| Tier | Storage | Access Pattern | Use Case |
|------|---------|---------------|----------|
| **Mem0 (Qdrant)** | Vector semantic | `mem0_search` for patterns, `mem0_conclude` for facts | Cross-session learnings, user preferences |
| **SOUL.md** | Plain text | Read at startup, update on structural changes | Operational rules, architecture truth |
| **Skills** | ~/.hermes/skills/ | `skill_view` before task, `skill_manage` after | Procedural knowledge, tool patterns |
| **SESSION_SEARCH** | SQLite FTS5 | `session_search` for past sessions | Conversation history, specific events |
| **CRON OUTPUT** | /srv/ops/logs/ | Tail logs for status | Real-time health, metrics |

### 2.3 Mode → Memory Mapping

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER REQUEST                                │
└─────────────────────────┬───────────────────────────────────────────┘
                          ▼
            ┌─────────────────────────────┐
            │     DETERMINE MODE         │
            │  DEV / JUNIOR / SÊNIOR /   │
            │  EMERGENCY                 │
            └─────────────┬───────────────┘
                          │
    ┌─────────────────────┼─────────────────────┐
    │         │           │           │         │
    ▼         ▼           ▼           ▼         ▼
  ┌────┐  ┌──────┐   ┌───────┐  ┌────────┐ ┌──────────┐
  │DEV │  │JUNIOR│   │SÊNIOR │  │EMERGENCY│ │  QUERY   │
  │    │  │      │   │       │  │        │ │ PRIORITY │
  └────┘  └──────┘   └───────┘  └────────┘ └──────────┘
    │         │           │           │         │
    ▼         ▼           ▼           ▼         ▼
Skills    Skills +    Skills +    SOUL.md   Mem0
ONLY      SESSION      ALL        ONLY      Search
          _SEARCH     + DOCS                  +
                     SOUL.md    Immediate   Session
                                  triage    Search
```

### 2.4 Services Topology (Where Each Lives)

```
PC PRINCIPAL (Ubuntu Server, 10.0.0.4)
├── ZFS Pool: tank (Gen5 4TB NVMe)
│   ├── tank/srv (monorepo)
│   ├── tank/coolify
│   ├── tank/postgres
│   ├── tank/qdrant
│   ├── tank/backup (incremental offsite target)
│   └── tank/docker-data
├── Docker (system level, not in ZFS)
│   ├── hermes-agent (main agent)
│   ├── hermes-gateway (Telegram bot)
│   ├── hermes-mcp (MCP bridge)
│   ├── coolify (self-hosted PaaS)
│   ├── crm-api (NestJS + PostgreSQL)
│   ├── gitea (git server)
│   └── [more via Coolify]
├── Native Services (bare metal)
│   ├── faster-whisper-server :8204 (STT)
│   ├── Edge TTS :8012 (TTS)
│   └── cloudflared (Tunnel)
├── Ollama :11434 (LLaVA, qwen2.5vl:3b)
├── LiteLLM :4000 (router)
├── Qdrant :6333 (vector DB)
├── ai-gateway :4002
├── hermes-orchestrator :8095 (LangGraph)
├── PostgreSQL :5432 (crm_mvp + orchestrator schema)
├── Mem0 API :8642 (⚠️ INVALID key)
└── Redis :6379 (future)

PC SECUNDÁRIO (Ubuntu Desktop, 10.0.0.8)
├── Development tools
├── Claude Code CLI
└── Tailscale SSH access → PC Principal

MOBILE (iPhone, Tailscale 100.115.201.9)
└── Telegram → Hermes

SERVICES TOPOLOGY BY MODE:
┌──────────────────────────────────────────────────────────────────────┐
│                        SERVICE PORT MAP                              │
├──────────────┬───────┬──────────────────────────────────────────────┤
│ Service      │ Port  │ Access from                                  │
├──────────────┼───────┼──────────────────────────────────────────────┤
│ SSH          │ 22    │ Tailscale VPN (100.64.0.0/10) only           │
│ Docker API   │ 2375  │ Localhost only (socket)                      │
│ Tailscale    │ ─     │ Kernel-level (not port-based)                │
│ Coolify      │ 3000  │ LAN + Tailscale (exposed via cloudflared)    │
│ Gitea        │ 3000  │ Same as Coolify (same host, different route) │
│ CRM          │ 80    │ LAN + Tailscale (Coolify managed)            │
│ Qdrant       │ 6333  │ Localhost only (should not be exposed)      │
│ LiteLLM      │ 4000  │ Localhost only (should not be exposed)       │
│ Ollama       │ 11434 │ Localhost only (should not be exposed)       │
│ Mem0 API     │ 8642  │ ⚠️ INVALID — check QDRANT_API_KEY            │
│ ai-gateway   │ 4002  │ Localhost only                               │
│ orchestrator │ 8095  │ Localhost only                               │
│ Edge TTS     │ 8012  │ Localhost only                               │
│ Whisper STT  │ 8204  │ Localhost only                               │
│ PostgreSQL   │ 5432  │ Docker networks only (CRM + orchestrator)    │
│ Redis        │ 6379  │ Docker networks only                          │
│ Grafana      │ 3100  │ LAN + Tailscale                              │
│ Prometheus   │ 9090  │ LAN + Tailscale                              │
└──────────────┴───────┴──────────────────────────────────────────────┘
```

---

## 3. Cron Consolidation (Enterprise Pattern)

### 3.1 Unified Cron Taxonomy

Replace all fragmented crons with ONE consolidated `/etc/cron.d/hermes-ops` file with clear sections:

```
╔══════════════════════════════════════════════════════════════════════╗
║              HERMES OPS CRON — UNIFIED SCHEDULE                      ║
╠══════════════════════════════════════════════════════════════════════╣
║ SHELL=/bin/bash                                                     ║
║ PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin   ║
║ LOG_DIR=/srv/ops/logs                                               ║
╠══════════════════════════════════════════════════════════════════════╣
║ SECTION A: HEALTH (every 5 min — unified SRE)                       ║
║ SECTION B: SNAPSHOTS (daily 3am — ZFS)                               ║
║ SECTION C: BACKUPS (staggered — avoid overlap)                      ║
║ SECTION D: METRICS (every 30 min)                                    ║
║ SECTION E: SECURITY (every 15 min)                                   ║
║ SECTION F: CLEANUP (weekly + daily prune)                           ║
║ SECTION G: BRAIN SYNC (hourly)                                       ║
╠══════════════════════════════════════════════════════════════════════╣
║ ARCHITECTURE NOTES:                                                  ║
║ - ONE monitor, not four (health_agent merged into hermes-sre)       ║
║ - ONE snapshot system, not three (backup-zfs-snapshot.sh)           ║
║ - ONE brain backup, not three (hermes-brain-backup.sh)              ║
║ - Metrics: nexus-*-stats.sh → ONE hermes-metrics.sh                 ║
║ - Remove: homelab-agents/ (superseded by hermes-sre + cron.daily)   ║
╚══════════════════════════════════════════════════════════════════════╝
```

### 3.2 Schedule (Staggered to Avoid I/O Contention)

| Time | Job | Rationale |
|------|-----|-----------|
| `*/5 * * * *` | SRE health check (hermes-sre-monitor.sh) | 5-min industry standard |
| `5 */6 * * *` | Backup: PostgreSQL (crm_mvp) | Offset 5min to avoid health check load |
| `10 */6 * * *` | Backup: Qdrant collections | Stagger from PG |
| `15 */6 * * *` | Backup: Ollama models | Stagger from Qdrant |
| `20 */6 * * *` | Backup: Redis | Stagger from Ollama |
| `0 3 * * *` | ZFS snapshot (tank@polymer-daily) | Low usage window |
| `30 3 * * *` | ZFS prune (snapshots > 90d) | After snapshot |
| `0 4 * * *` | ZFS incremental to tank/backup | Off-peak |
| `0 5 * * *` | Brain backup (mem0_export + git push) | After all backups |
| `*/30 * * * *` | Metrics collection (unified) | Half-hourly |
| `*/15 * * * *` | Security: fail2ban + UFW check + Docker logs | 15-min security |
| `0 2 * * 0` | ZFS scrub (tank) | Weekly Sunday 2am |
| `0 0 * * 0` | Log rotation (logs > 30d) | Weekly Sunday midnight |
| `0 * * * *` | Brain sync (ai-context-sync.sh quick-status) | Hourly |
| `0 3 * * *` | Chinese char scan | Daily 3am |
| `*/3 * * * *` | GPU monitor (if mining/training active) | Only when needed |
| `* * * * *` | Alert queue processor (1min) | Immediate escalation |

### 3.3 Remove/Deprecate

```
REMOVE (superseded):
- /etc/cron.d/coolify-sre-monitor        → hermes-sre-monitor.sh already checks Coolify
- /etc/cron.d/coolify-backup             → backup-zfs-snapshot.sh handles
- /etc/cron.d/hermes-second-brain        → ai-context-sync handles (consolidated)
- /etc/cron.d/hermes-surveyor            → hermes-sre-monitor.sh covers
- /etc/cron.d/homelab-agents/            → DELETE entire directory
- /srv/monorepo/.claude/skills/coolify-sre/scripts/escalate.sh → merge into hermes-sre-monitor.sh
- nexus-*-stats.sh (4 files)            → hermes-metrics.sh (unified)
- gpu_agent.sh, homelab-gemma-monitor.sh → conditional gpu-monitor.sh (only when needed)
- llm_agent.sh                           → hermes-sre-monitor.sh already checks LLM services
- overseer_agent.sh                      → health_agent.sh covers (merged)

DEPRECATE (keep but not new crons):
- /srv/ops/scripts/backup-*.sh (10 files) → continue but consolidate output format
- /srv/monorepo/scripts/zfs-snapshots.sh   → point to backup-zfs-snapshot.sh
```

---

## 4. Memory Query Patterns by Mode

### 4.1 DEV Mode (Rapid Iteration)

```python
# On start:
session_search(query="recent dev work")  # What was I doing?
skill_view(name="relevant-skill")        # Refresh on skill I'm using

# Before task:
skill_view(name="task-skill")            # Fresh read of procedure
# NO mem0 search (too slow for dev loop)

# After task:
# Store in session, NOT in brain (dev is ephemeral)
session_search(query="what I just did")
```

### 4.2 JUNIOR Mode (Day-to-Day)

```python
# On start:
mem0_profile()                           # Load user preferences
session_search(query="recent work")       # What happened recently?

# Before task:
skill_view(name="task-skill")            # Procedure for this task
mem0_search(query="similar past tasks") # Any learnings from before?
# → If found: apply stored pattern
# → If not found: proceed, store result after

# After task (success):
mem0_conclude(conclusion="Pattern X worked for task Y")
# AND store in session for reference

# After task (failure):
mem0_conclude(conclusion="Pattern X failed for Y because Z")
skill_manage(action="patch", ...)         # Update skill if procedure was wrong
```

### 4.3 SÊNIOR Mode (Architecture/Audit)

```python
# On start:
read_file(SOUL.md)                       # Fresh load of operational rules
skill_view(name="relevant-skill")         # All relevant skills

# Before task:
mem0_search(query="architecture decisions")  # Past decisions
session_search(query="incidents related")    # Similar problems solved

# During task:
# → Check all memory layers for cross-references
# → Update SOUL.md if new pattern found
# → Create/update skills if new procedure discovered

# After task:
skill_manage(action="patch", ...)          # Update skills with new learnings
mem0_conclude(conclusion="Architecture decision X made because Y")
git commit + push to second-brain
```

### 4.4 EMERGENCY Mode (Incident Response)

```python
# On start:
read_file(SOUL.md, section="EMERGENCY")  # Emergency runbook
session_search(query="past incident same-service")

# IMMEDIATE triage (seconds):
hermes-sre-monitor.sh --triage            # Fast health check
# → Identify: which service, what's broken, since when

# During:
# → No mem0 (too slow for emergency)
# → Use session_search for similar past incidents (fast FTS5)
# → Document incident in real-time to session

# After (post-mortem):
mem0_conclude(conclusion="Incident X caused by Y, fix was Z")
skill_manage(action="patch", name="emergency-runbook", ...)
# → Update SOUL.md with new failure pattern
```

---

## 5. Skill → Memory Integration

### 5.1 When Skills Read Memory

```
┌──────────────────────────────────────────────────────┐
│                  SKILL EXECUTION FLOW                │
└──────────────────────────┬───────────────────────────┘
                           │
                           ▼
              ┌─────────────────────────┐
              │  skill_view(NAME)       │
              │  → Load SKILL.md        │
              │  → Check LEARNINGS.md   │
              │  → Check updates?       │
              └───────────┬─────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        │ MODE?            │                 │
        ▼                 ▼                 ▼
   ┌────────┐        ┌────────┐        ┌────────┐
   │ DEV    │        │ JUNIOR │        │ SÊNIOR │
   │        │        │        │        │        │
   │ SKILL  │        │ SKILL  │        │ SKILL  │
   │ ONLY   │        │ +      │        │ +      │
   │        │        │ MEM0   │        │ MEM0   │
   │        │        │ +      │        │ +      │
   │        │        │ SESSION│        │ SESSION│
   │        │        │ _SEARCH│        │ _SEARCH│
   │        │        │        │        │ +      │
   │        │        │        │        │ DOCS   │
   └────────┘        └────────┘        │ +      │
                          │            │ SOUL   │
                          ▼            └────────┘
              ┌─────────────────────────┐
              │  EXECUTE TASK           │
              └───────────┬─────────────┘
                          │
                          ▼
              ┌─────────────────────────┐
              │  STORE RESULT           │
              │  → session (all)       │
              │  → mem0 (if learned)    │
              │  → skill (if procedure) │
              └─────────────────────────┘
```

### 5.2 Skill Confidence Triggers

| Pattern | Confidence | Action |
|---------|------------|--------|
| Same task succeeded 3x in mem0 | 0.85+ | Auto-use pattern |
| Same task failed 1x in mem0 | 0.3 | Show warning before use |
| Task never seen before | 0.5 | Normal execution, store result |
| Emergency task | N/A | Skip mem0, use SOUL only |

---

## 6. Implementation Plan

### Phase 1: Consolidate Cron (DO NOW)

1. Create `/etc/cron.d/hermes-ops` unified file
2. Create `hermes-metrics.sh` (unified metrics collector)
3. Remove deprecated crons (move to `/srv/backups/deprecated-crons/`)
4. Test health checks still work
5. Document changes in SPEC-POLYMER-005

### Phase 2: Consolidate Brain (DO AFTER PHASE 1)

1. Audit ai-context-sync.sh (what does it actually sync?)
2. Unify hermes-brain-backup.sh + memory-keeper-backup.sh
3. Test mem0 search works (currently INVALID)
4. Create mem0_health.sh script

### Phase 3: Skills + Memory Integration (SÊNIOR MODE)

1. Update all skills to have LEARNINGS.md
2. Create mode-selector.sh (DEV/JUNIOR/SÊNIOR/EMERGENCY)
3. Update SOUL.md v4 with emergency runbook
4. Create memory_query.py (unified query interface)

---

## 7. Verification

```bash
# After Phase 1:
sudo systemctl restart cron
sudo crontab -l | grep hermes-ops
ls -la /etc/cron.d/hermes-ops
cat /srv/ops/logs/sre-monitor-cron.log | tail -20

# Verify old crons removed:
ls /etc/cron.d/ | grep -E "coolify-sre|hermes-second-brain|homelab-agents"

# Verify health still works:
/srv/monorepo/scripts/hermes-sre-monitor.sh --dry-run

# Verify metrics still work:
/srv/monorepo/scripts/hermes-metrics.sh --dry-run
```

---

## 8. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Removing homelab-agents breaks something | Keep copies in /srv/backups/deprecated-crons/ for 7 days |
| Mem0 still invalid after consolidation | Fix QDRANT_API_KEY first (separate ticket) |
| ZFS snapshots overlap with Coolify backup | Verify coolify backup is deleted before enabling new schedule |
| Metric gap during transition | Run old and new in parallel for 24h |

---

## 9. Related SPECs

- SPEC-POLYMER-001: Monorepo organization
- SPEC-POLYMER-002: Docker organization
- SPEC-POLYMER-003: Enterprise orchestration (LangGraph)
- SPEC-POLYMER-004: Skills audit
- SPEC-POLYMER-005: This document
