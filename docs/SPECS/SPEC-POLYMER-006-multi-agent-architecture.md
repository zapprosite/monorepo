# SPEC-POLYMER-006 — Hermes Multi-Agent Architecture (Enterprise)

**Version:** 1.0.0  
**Date:** 2026-05-01  
**Author:** Hermes (Sênior Architecture)  
**Status:** DRAFT → EXECUTE  

---

## 1. Context

### Problem

Cron chaos was solved in SPEC-POLYMER-005 (Phase 1). Now we need proper multi-agent orchestration that:

1. Distributes work across specialized sub-agents
2. Handles 500 RPM rate limit without throttling
3. Uses abundant token budget for deep reasoning
4. Provides clear mode-based routing (DEV/JUNIOR/SÊNIOR/EMERGENCY)

### Current State

- `hermes-agent` running on port 8092 (MCP bridge)
- `hermes-orchestrator` on port 8095 (LangGraph, but DRAFT status)
- 8+ scripts in `/srv/monorepo/scripts/` running standalone (no coordination)
- No unified task queue

### Rate Limit Reality

| Provider | Limit | Strategy |
|----------|-------|----------|
| **MiniMax M2.7** | 500 RPM | Primary — aggressive but not unbounded |
| **Groq Whisper** | 150 min/day | STT — batch wisely |
| **OpenAI** | Varies | Fallback only |
| **Ollama (local)** | ∞ (no rate limit) | Preferred for heavy tasks |

---

## 2. Architecture

### 2.1 Agent Hierarchy

```
                         ┌─────────────────────────────────────┐
                         │        HERMES SUPERVISOR           │
                         │  (Port 8092 — MCP Bridge / CLI)    │
                         │  MiniMax-M2.7 / Claude Code CLI    │
                         └──────────────────┬──────────────────┘
                                            │
                    ┌───────────────────────┼───────────────────────┐
                    │                       │                       │
           ┌────────▼────────┐    ┌────────▼────────┐    ┌────────▼────────┐
           │   SRE AGENT     │    │   DEV AGENT    │    │  DOCS AGENT    │
           │   (Infrastructure)│  │  (Code/Tasks)  │    │ (Knowledge/Wiki)│
           │   Port 8096     │    │   Port 8097     │    │   Port 8098     │
           └────────┬────────┘    └────────┬────────┘    └────────┬────────┘
                    │                       │                       │
           ┌────────▼────────┐    ┌────────▼────────┐    ┌────────▼────────┐
           │  BACKUP AGENT   │    │  SECURITY AGENT │    │  VISION AGENT  │
           │   (ZFS/Backup)  │    │  (Audit/Monitor)│   │  (qwen2.5vl)   │
           │   Port 8099     │    │   Port 8100     │    │   Port 8101     │
           └─────────────────┘    └─────────────────┘    └─────────────────┘
```

### 2.2 Agent Specifications

#### HERMES SUPERVISOR (Main Agent)
- **Port:** 8092 (MCP) / CLI mode
- **Model:** MiniMax-M2.7 (primary) or Claude Code CLI
- **Role:** Route tasks, coordinate sub-agents, final approval
- **Context:** Full system context, all skills loaded
- **Rate Limit:** Tracks global RPM, queues if approaching 500

#### SRE AGENT (Infrastructure)
- **Port:** 8096
- **Model:** MiniMax-M2.7
- **Skills:** `coolify-sre`, `docker-healthcheck-missing-binary`, `service-port-mismatch-debug`, `smoke-test-false-positive-debug`
- **Tools:** Docker, ZFS, health endpoints, Coolify API
- **Mode Priority:** JUNIOR (day-to-day ops) + SÊNIOR (incidents)
- **Rate Limit Budget:** 100 RPM (20% of total)

#### DEV AGENT (Code/Tasks)
- **Port:** 8097
- **Model:** Claude Code CLI (for code tasks) + MiniMax-M2.7 (for planning)
- **Skills:** `vibe`, `crm-mvp-debug`, `systematic-debugging`, `test-driven-development`
- **Tools:** git, terminal, file tools, execute_code
- **Mode Priority:** DEV (iterations) + JUNIOR (features)
- **Rate Limit Budget:** 200 RPM (40% of total — heaviest user)

#### DOCS AGENT (Knowledge/Wiki)
- **Port:** 8098
- **Model:** MiniMax-M2.7
- **Skills:** `second-brain`, `brain-analytics`, `brain-backup`, `brain-dashboard`
- **Tools:** mem0, session_search, file tools
- **Mode Priority:** SÊNIOR (documentation) + JUNIOR (context sync)
- **Rate Limit Budget:** 50 RPM (10% of total)

#### BACKUP AGENT (ZFS/Recovery)
- **Port:** 8099
- **Model:** MiniMax-M2.7
- **Skills:** `zfs-disaster-recovery`, `zfs-snapshot-prune-debug`, `readonly-mount-debug`
- **Tools:** ZFS, cron, backup scripts
- **Mode Priority:** JUNIOR (scheduled) + SÊNIOR (disaster recovery)
- **Rate Limit Budget:** 50 RPM (10% of total)

#### SECURITY AGENT (Audit/Monitor)
- **Port:** 8100
- **Model:** MiniMax-M2.7
- **Skills:** `infra-audit-ruthless`, `anti-hardcoded-api-key-audit`, `secure-vps-setup`, `firewall-config`
- **Tools:** fail2ban, UFW, audit logs, security scripts
- **Mode Priority:** SÊNIOR (audits) + EMERGENCY (incidents)
- **Rate Limit Budget:** 50 RPM (10% of total)

#### VISION AGENT (qwen2.5vl)
- **Port:** 8101
- **Model:** qwen2.5vl:3b via Ollama :11434
- **Role:** Image analysis, screenshot understanding, visual verification
- **VRAM:** ~4GB active when loaded
- **Mode Priority:** All modes (as needed)
- **Rate Limit Budget:** N/A (local Ollama, no RPM limit)

### 2.3 Rate Limiter Design

```python
# Global rate limiter — shared across all agents
# Location: /srv/monorepo/services/rate-limiter/rate_limiter.py

class RateLimiter:
    """
    500 RPM shared across all MiniMax requests.
    Uses sliding window algorithm with per-agent budgets.
    """
    RPM_LIMIT = 500
    WINDOW_SECONDS = 60
    
    # Per-agent budgets (percentages)
    AGENT_BUDGETS = {
        "supervisor": 0.20,      # 100 RPM — routes requests
        "dev": 0.40,             # 200 RPM — heaviest user
        "sre": 0.20,             # 100 RPM — ops monitoring
        "docs": 0.10,            # 50 RPM
        "backup": 0.05,          # 25 RPM
        "security": 0.05,        # 25 RPM
    }
    
    def acquire(agent: str, tokens: int = 1) -> bool:
        """
        Returns True if request allowed, False if rate limited.
        Auto-queues with exponential backoff if approaching limit.
        """
    
    def get_wait_time(agent: str) -> float:
        """Returns seconds to wait if rate limited."""
```

### 2.4 Task Queue (Redis-backed)

```python
# /srv/monorepo/services/task-queue/task_queue.py

class TaskQueue:
    """
    Redis-backed priority queue for task distribution.
    Priorities: EMERGENCY(0) > SÊNIOR(1) > JUNIOR(2) > DEV(3)
    """
    REDIS_HOST = "localhost"
    REDIS_PORT = 6379
    QUEUE_KEY = "hermes:tasks"
    
    def enqueue(task: dict, priority: int, agent: str = None) -> str:
        """
        Enqueue task with priority.
        agent=None means auto-route to appropriate agent.
        """
    
    def dequeue(agent: str, timeout: int = 5) -> dict:
        """
        Block for up to timeout seconds waiting for task.
        Only returns tasks for specified agent.
        """
    
    def requeue(task: dict) -> None:
        """
        Return task to queue (if couldn't process).
        Decrements priority.
        """
```

---

## 3. Communication Patterns

### 3.1 Supervisor → Sub-Agent

```
Supervisor decides: "This is an SRE task"
↓
1. Check rate limiter (can agent handle it now?)
   - YES: Send directly to SRE agent
   - NO: Enqueue with priority, return task_id to user
↓
2. Task goes to SRE Agent (port 8096)
   - SRE agent processes
   - Returns result to Supervisor
↓
3. Supervisor formats response
   - If success: return to user
   - If failure: escalate to SRE agent with more context
   - If EMERGENCY: bypass queue, send immediately
```

### 3.2 Sub-Agent → Sub-Agent (Lateral)

```
SRE Agent detects: "Disk space critical, might need ZFS snapshot"
↓
1. Check if BACKUP_AGENT is available (rate limit)
2. If yes: send lateral task to BACKUP_AGENT (port 8099)
3. BACKUP_AGENT processes ZFS snapshot
4. Returns result to SRE_AGENT
5. SRE_AGENT continues monitoring
```

### 3.3 Emergency Bypass

```
User types "/panic" or "EMERGENCY"
↓
Supervisor immediately:
1. Suspends all queued DEV/JUNIOR tasks
2. Routes EMERGENCY task to SECURITY_AGENT (port 8100)
3. SECURITY_AGENT runs incident response
4. All other agents receive "standby" signal
5. Supervisor provides real-time updates
```

---

## 4. Mode-Based Routing

### 4.1 How Modes Affect Agent Selection

| Mode | Supervisor | Sub-Agent | Rate Limit Mode |
|------|-----------|----------|----------------|
| **DEV** | Minimal | DEV_AGENT only | Burst (up to 300 RPM) |
| **JUNIOR** | Moderate | SRE + DEV + DOCS | Normal (400 RPM) |
| **SÊNIOR** | Full | All agents | Conservative (300 RPM) |
| **EMERGENCY** | None | SECURITY + BACKUP only | Emergency (500 RPM to those two) |

### 4.2 Mode Detection

```python
def detect_mode(message: str, context: dict) -> str:
    """
    Auto-detect mode from message content and context.
    Can be overridden by explicit "/mode dev|junior|senior|emergency"
    """
    msg_lower = message.lower()
    
    # Emergency keywords
    if any(kw in msg_lower for kw in ["/panic", "emergency", "incidente", "down", "crash", "ataque"]):
        return "EMERGENCY"
    
    # Senior keywords
    if any(kw in msg_lower for kw in ["/audit", "/senior", "arquitetura", "especificacao", "spec", "refatorar"]):
        return "SÊNIOR"
    
    # Dev keywords
    if any(kw in msg_lower for kw in ["/dev", "codar", "implementar", "bug", "teste"]):
        return "DEV"
    
    # Default: JUNIOR
    return "JUNIOR"
```

---

## 5. Token Budget Strategy

With abundant tokens available:

| Layer | Budget | Purpose |
|-------|--------|---------|
| **System Prompt** | 8,000 tokens | Full context (SOUL + AGENTS.md + active skills) |
| **Conversation** | 32,000 tokens | Per-agent conversation window |
| **Context Compression** | When >50% used | Compress old messages, keep recent |
| **技能 Skills** | Full load | All relevant skills loaded per task |
| **Mem0 Search** | Pre-task | Semantic search before task execution |

### 5.1 Token Allocation Per Agent

```
SUPERVISOR:  8K system + 32K context = 40K tokens
DEV_AGENT:   4K system + 32K context = 36K tokens  
SRE_AGENT:   4K system + 16K context = 20K tokens
DOCS_AGENT:  2K system + 16K context = 18K tokens
BACKUP:      2K system + 8K context  = 10K tokens
SECURITY:    2K system + 8K context  = 10K tokens
VISION:      N/A (local Ollama)     = unlimited
```

---

## 6. Implementation Plan

### Phase 1: Rate Limiter + Task Queue (DO NOW)

1. Create `/srv/monorepo/services/rate-limiter/` module
2. Create `/srv/monorepo/services/task-queue/` module
3. Test rate limiter with simulated 500 RPM load
4. Verify Redis connection for task queue

### Phase 2: Sub-Agent Services (DO AFTER PHASE 1)

1. Create `subagent-sre.sh` (port 8096)
2. Create `subagent-dev.sh` (port 8097)
3. Create `subagent-docs.sh` (port 8098)
4. Create `subagent-backup.sh` (port 8099)
5. Create `subagent-security.sh` (port 8100)
6. Register each as systemd service

### Phase 3: Supervisor Integration (DO AFTER PHASE 2)

1. Update Hermes supervisor to use rate limiter
2. Implement mode detection
3. Add lateral communication between agents
4. Add emergency bypass

### Phase 4: Monitoring Dashboard (DO AFTER PHASE 3)

1. Create Grafana dashboard for agent health
2. Add Prometheus metrics for rate limiter
3. Create `/status` endpoint showing all agents

---

## 7. File Structure

```
/srv/monorepo/services/
├── rate-limiter/
│   ├── __init__.py
│   ├── rate_limiter.py      # Sliding window RPM tracker
│   ├── budgets.py           # Per-agent budget definitions
│   └── test_rate_limiter.py
├── task-queue/
│   ├── __init__.py
│   ├── task_queue.py        # Redis-backed priority queue
│   ├── priorities.py       # Priority level definitions
│   └── test_task_queue.py
├── subagents/
│   ├── __init__.py
│   ├── supervisor.py        # Main routing agent
│   ├── sre_agent.py         # Port 8096
│   ├── dev_agent.py         # Port 8097
│   ├── docs_agent.py        # Port 8098
│   ├── backup_agent.py      # Port 8099
│   ├── security_agent.py    # Port 8100
│   └── vision_agent.py      # Port 8101 (Ollama direct)
├── api/
│   ├── __init__.py
│   ├── supervisor_api.py    # FastAPI for supervisor
│   ├── agent_status.py      # /status endpoint
│   └── metrics.py           # Prometheus metrics
└── docker-compose.subagents.yml
```

---

## 8. Verification

```bash
# Phase 1 verification:
cd /srv/monorepo/services/rate-limiter
python3 -m pytest test_rate_limiter.py -v

# Test 500 RPM simulation
python3 -c "
from rate_limiter import RateLimiter
rl = RateLimiter()
results = []
for i in range(600):
    results.append(rl.acquire('dev'))
print(f'Allowed: {sum(results)}/600 (expected ~500)')
"

# Phase 2 verification:
curl http://localhost:8096/health  # SRE agent
curl http://localhost:8097/health  # DEV agent
curl http://localhost:8098/health  # DOCS agent

# Phase 3 verification:
curl -X POST http://localhost:8092/enqueue \
  -H "Content-Type: application/json" \
  -d '{"task": "check docker containers", "mode": "junior"}'

# Phase 4 verification:
curl http://localhost:8092/status | python3 -m json.tool
```

---

## 9. Related SPECs

- SPEC-POLYMER-001: Monorepo organization
- SPEC-POLYMER-002: Docker organization  
- SPEC-POLYMER-003: Enterprise orchestration (LangGraph)
- SPEC-POLYMER-004: Skills audit
- SPEC-POLYMER-005: Cron strategy (Phase 1 — this builds on it)
- SPEC-POLYMER-006: This document (multi-agent architecture)

---

## 10. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Rate limiter false positives | Add 10% buffer (450 RPM instead of 500) |
| Sub-agent goes down | Supervisor detects via /health, routes to other agents |
| Redis down | Fall back to in-memory queue (degraded mode) |
| 500 RPM shared across all agents | Per-agent budgets prevent single agent monopolizing |
| Token budget exhaustion | Auto-compress context at 50%, reject at 90% |
