# Nexus + vibe-kit Enterprise Architecture

**Version:** 1.0.0
**Date:** 2026-04-30
**Status:** Active
**Author:** William Rodrigues

---

## 1. Overview

Nexus is an enterprise-grade agent orchestration framework that coordinates 49 specialized agents through a structured PREVC workflow. vibe-kit is the runtime runner that executes tasks in parallel using Claude Code headless workers.

### Core Concept

```
Nexus = vibe-kit (loop runner) + PREVC (workflow) + 49 agents (execution)
```

| Component | Role |
|-----------|------|
| **Nexus** | Orchestrator — coordinates 49 agents across 7 modes |
| **vibe-kit** | Runtime — parallel task execution with 15 workers |
| **PREVC** | Workflow — Plan → Review → Execute → Verify → Complete |
| **49 Agents** | Execution — specialized per mode (debug, test, backend, frontend, review, docs, deploy) |

### Quick Reference

```bash
# Full workflow with SPEC
nexus.sh --spec SPEC-NNN --phase plan
nexus.sh --spec SPEC-NNN --phase review
nexus.sh --spec SPEC-NNN --phase execute --parallel 15
nexus.sh --spec SPEC-NNN --phase verify
nexus.sh --spec SPEC-NNN --phase complete

# Direct vibe-kit execution
SPEC=SPEC-068 APP=crm-ownership vibe-kit.sh

# Headless worker
mclaude --provider minimax --model MiniMax-M2.7 -p "task prompt..."
```

---

## 2. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              NEXUS FRAMEWORK                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐     ┌─────────────────────────────────────────────────┐  │
│  │   SPEC.md  │────▶│                   PREVC WORKFLOW                  │  │
│  │  (Input)   │     │                                                   │  │
│  └─────────────┘     │   P ──▶ R ──▶ E ──▶ V ──▶ C                      │  │
│                      │   │     │     │     │     │                      │  │
│                      │   │     │     │     │     └── Complete           │  │
│                      │   │     │     │     │         (deploy + docs)    │  │
│                      │   │     │     │     └── Verify                   │  │
│                      │   │     │     │         (test suite)             │  │
│                      │   │     │     └── Execute (15 parallel workers)  │  │
│                      │   │     └── Review (risk assessment + approval)   │  │
│                      │   └── Plan (SPEC → queue.json)                    │  │
│                      └─────────────────────────────────────────────────┘  │
│                                        │                                   │
│                                        ▼                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │                         VIBE-KIT RUNTIME                             │  │
│  │  ┌────────────────────────────────────────────────────────────────┐  │  │
│  │  │                     TASK QUEUE (queue.json)                    │  │  │
│  │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │  │  │
│  │  │  │ TASK-001 │ │ TASK-002 │ │ TASK-003 │ │ TASK-00N │  ...       │  │  │
│  │  │  │ pending  │ │ running  │ │ pending  │ │ pending  │           │  │  │
│  │  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │  │  │
│  │  └────────────────────────────────────────────────────────────────┘  │  │
│  │                              │                                         │  │
│  │         ┌────────────────────┼────────────────────┐                   │  │
│  │         │                    │                    │                   │  │
│  │         ▼                    ▼                    ▼                   │  │
│  │  ┌─────────────┐      ┌─────────────┐      ┌─────────────┐            │  │
│  │  │  WORKER-01  │      │  WORKER-02  │      │  WORKER-15  │  (VIBE_PARALLEL) │
│  │  │ mclaude -p  │      │ mclaude -p  │      │ mclaude -p  │            │  │
│  │  └─────────────┘      └─────────────┘      └─────────────┘            │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                        │                                   │
│                                        ▼                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │                    49 AGENTS (7 MODES × 7 AGENTS)                   │  │
│  │                                                                       │  │
│  │   ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐      │  │
│  │   │  debug  │  │  test  │  │backend  │  │frontend │  │  review │      │  │
│  │   │ (11 ag) │  │ (7 ag) │  │ (7 ag)  │  │ (9 ag)  │  │ (10 ag) │      │  │
│  │   ├─────────┤  ├─────────┤  ├─────────┤  ├─────────┤  ├─────────┤      │  │
│  │   │  docs   │  │  deploy │  │         │  │         │  │         │      │  │
│  │   │ (12 ag) │  │ (8 ag)  │  │         │  │         │  │         │      │  │
│  │   └─────────┘  └─────────┘  └─────────┘  └─────────┘  └─────────┘      │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Mode Breakdown

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              AGENT MODES                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  debug (11 agents)                                                          │
│  ├── log-diagnostic                                                         │
│  ├── stack-trace                                                            │
│  ├── perf-profiler                                                          │
│  ├── network-tracer                                                         │
│  ├── security-scanner                                                       │
│  ├── sre-monitor                                                            │
│  ├── incident-response                                                      │
│  ├── config-debugger                                                        │
│  ├── dependency-resolver                                                    │
│  ├── cache-debugger                                                         │
│  └── db-query-analyzer                                                      │
│                                                                             │
│  test (7 agents)                                                            │
│  ├── unit-tester                                                            │
│  ├── integration-tester                                                     │
│  ├── e2e-tester                                                             │
│  ├── coverage-analyzer                                                      │
│  ├── boundary-tester                                                        │
│  ├── flaky-detector                                                         │
│  └── property-tester                                                        │
│                                                                             │
│  backend (7 agents)                                                          │
│  ├── api-developer                                                          │
│  ├── service-architect                                                      │
│  ├── db-migrator                                                            │
│  ├── cache-specialist                                                       │
│  ├── auth-engineer                                                          │
│  ├── event-developer                                                        │
│  └── file-pipeline                                                          │
│                                                                             │
│  frontend (9 agents)                                                         │
│  ├── component-dev                                                          │
│  ├── responsive-dev                                                         │
│  ├── state-manager                                                          │
│  ├── animation-dev                                                          │
│  ├── a11y-auditor                                                          │
│  ├── perf-optimizer                                                         │
│  ├── design-system                                                          │
│  ├── routing-dev                                                            │
│  └── form-dev                                                              │
│                                                                             │
│  review (10 agents)                                                         │
│  ├── correctness-reviewer                                                   │
│  ├── readability-reviewer                                                   │
│  ├── architecture-reviewer                                                  │
│  ├── security-reviewer                                                      │
│  ├── perf-reviewer                                                         │
│  ├── dependency-auditor                                                    │
│  ├── quality-scorer                                                        │
│  ├── test-coverage-reviewer                                                │
│  ├── docs-reviewer                                                         │
│  └── contract-reviewer                                                     │
│                                                                             │
│  docs (12 agents)                                                           │
│  ├── api-doc-writer                                                         │
│  ├── readme-writer                                                          │
│  ├── changelog-writer                                                       │
│  ├── inline-doc-writer                                                      │
│  ├── diagram-generator                                                      │
│  ├── adr-writer                                                            │
│  ├── doc-coverage-auditor                                                  │
│  ├── runbook-writer                                                        │
│  ├── architecture-writer                                                   │
│  ├── troubleshooting-writer                                                │
│  ├── onboarding-writer                                                     │
│  └── release-notes-writer                                                   │
│                                                                             │
│  deploy (8 agents)                                                          │
│  ├── docker-builder                                                        │
│  ├── compose-orchestrator                                                   │
│  ├── coolify-deployer                                                       │
│  ├── secret-rotator                                                         │
│  ├── rollback-executor                                                     │
│  ├── zfs-snapshotter                                                       │
│  ├── health-checker                                                        │
│  └── dns-manager                                                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Components

### 3.1 Nexus Orchestrator

| Property | Value |
|----------|-------|
| Entry point | `.claude/vibe-kit/nexus.sh` |
| Workflow | PREVC (Plan → Review → Execute → Verify → Complete) |
| Task distribution | Agent role assignment from SPEC.md |
| State persistence | `state.json` (phase, counters) |
| Lock mechanism | `.vibe-kit.lock` (PID lock, prevents dual runners) |

**State Files:**

```
.claude/vibe-kit/
├── queue.json      # Task queue with status, worker assignment, timestamps
├── state.json      # Current phase, workflow state, counters
├── .vibe-kit.lock  # PID lock file (flock via fcntl)
└── logs/           # Per-worker execution logs
```

### 3.2 vibe-kit Runtime

| Property | Value |
|----------|-------|
| Entry point | `.claude/vibe-kit/vibe-kit.sh` |
| Parallel workers | `VIBE_PARALLEL` (default: 15) |
| Poll interval | `VIBE_POLL_INTERVAL` (default: 5s) |
| Max runtime | `VIBE_HOURS` (default: 8h) |
| Snapshot interval | `VIBE_SNAPSHOT_EVERY` (default: 3 tasks) |

**Control Variables:**

| Variable | Default | Purpose |
|----------|--------|---------|
| `VIBE_PARALLEL` | 15 | Number of parallel workers |
| `VIBE_POLL_INTERVAL` | 5s | Queue poll interval |
| `VIBE_SNAPSHOT_EVERY` | 3 | ZFS snapshot every N tasks |
| `VIBE_HOURS` | 8 | Maximum execution time |
| `VIBE_DRY_RUN` | — | Dry-run mode (no execution) |

### 3.3 Agents

Each agent is defined by `system-prompt.md` containing:

1. **Capabilities** — what the agent can do
2. **Protocol** — step-by-step execution steps
3. **Output Format** — JSON output schema
4. **Handoff** — next agent in chain

**Agent Interface:**

```typescript
interface SwarmTask {
  ID: string
  GraphID: string
  NodeID: string
  AgentType: string
  Input: Record<string, unknown>
  Output: Record<string, unknown>
  Status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped'
  Retries: number
  MaxRetries: number
  TimeoutMs: number
}

interface AgentInterface {
  Execute(ctx: Context, task: SwarmTask): Promise<Record<string, unknown>>
}
```

### 3.4 Task Queue

**queue.json schema:**

```json
{
  "id": "pipeline-20260430XXXXXX",
  "spec": "SPEC-NNN",
  "status": "PENDING",
  "created": "2026-04-30T12:00:00Z",
  "phases": [
    {
      "phase": 1,
      "name": "Implementation",
      "tasks": [
        {
          "id": "TASK-001",
          "name": "Implement authentication",
          "type": "implement",
          "agent_role": "backend/auth-engineer",
          "status": "pending",
          "spec_ref": "SPEC-NNN",
          "acceptance_criteria": ["AC-1", "AC-2"],
          "retry_count": 0
        }
      ]
    }
  ],
  "stats": {
    "total": 10,
    "done": 3,
    "failed": 1,
    "pending": 6
  }
}
```

### 3.5 Context Management

**SPEC.md parsing:**

```
SPEC.md ──► nexus.sh --phase plan ──► queue.json
                │
                └─► Extracts:
                     • Acceptance Criteria (ACs)
                     • Task list
                     • Agent role assignments
                     • Dependencies
```

---

## 4. Data Flow

### 4.1 Complete Workflow

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              DATA FLOW                                       │
└──────────────────────────────────────────────────────────────────────────────┘

  USER                PLAN phase           REVIEW phase         EXECUTE phase
   │                      │                     │                    │
   │  ┌──────────────┐     │     ┌──────────────┐│    ┌──────────────┐│
   │  │  SPEC.md    │     │     │ queue.json  ││    │ queue.json  ││
   │  │  (input)    │────▶│     │  (tasks)    ││    │  (tasks)    ││
   │  └──────────────┘     │     └──────────────┘│    └──────────────┘│
   │                      │                     │         │            │
   │                      │                     │         ▼            │
   │                      │                     │  ┌──────────────────┐│
   │                      │                     │  │   ZFS SNAPSHOT    ││
   │                      │                     │  │ tank@nexus-...    ││
   │                      │                     │  └──────────────────┘│
   │                      │                     │         │            │
   │                      │                     │         ▼            │
   │                      │                     │  ┌──────────────────┐│
   │                      │                     │  │  15 WORKERS       ││
   │                      │                     │  │  (mclaude -p)     ││
   │                      │                     │  │                   ││
   │                      │                     │  │  Worker-01 ───────┼──▶ Agent
   │                      │                     │  │  Worker-02 ───────┼──▶ Agent
   │                      │                     │  │  Worker-03 ───────┼──▶ Agent
   │                      │                     │  │  ...             ││
   │                      │                     │  │  Worker-15 ───────┼──▶ Agent
   │                      │                     │  └──────────────────┘│
   │                      │                     │         │            │
   │                      │                     │         ▼            │
   │                      │                     │  ┌──────────────────┐│
   │                      │                     │  │  state.json      ││
   │                      │                     │  │  (updated)       ││
   │                      │                     │  └──────────────────┘│
   │                      │                     │                     │
   │                      │                     │         VERIFY phase│
   │                      │                     │         │            │
   │                      │                     │         ▼            │
   │                      │                     │  ┌──────────────────┐│
   │                      │                     │  │ pnpm test        ││
   │                      │                     │  │ pnpm tsc         ││
   │                      │                     │  │ pnpm lint        ││
   │                      │                     │  │ pnpm build       ││
   │                      │                     │  └──────────────────┘│
   │                      │                     │         │            │
   │                      │                     │         ▼            │
   │                      │                     │  ┌──────────────────┐│
   │                      │                     │  │ COMPLETE phase   ││
   │                      │                     │  │ - deploy        ││
   │                      │                     │  │ - docs          ││
   │                      │                     │  │ - PR creation   ││
   │                      │                     │  └──────────────────┘│
   │                      │                     │                     │
   │                      │                     │         ▼            │
   │  ┌───────────────────┴─────────────────────┴─────────────────────┘
   │  │                              │
   ▼  ▼                              ▼
 RESULT                        Done/PR
```

### 4.2 Task Lifecycle

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           TASK LIFECYCLE                                   │
└──────────────────────────────────────────────────────────────────────────────┘

  CREATED          QUEUED            RUNNING           COMPLETED
     │               │                 │                   │
     │               │                 │                   │
     ▼               ▼                 ▼                   ▼
 ┌───────┐      ┌────────┐       ┌──────────┐       ┌───────────┐
 │ pending │───▶│ pending │───▶│  pending  │───▶│ completed │
 └───────┘      └────────┘       └──────────┘       └───────────┘
                                  │                     ▲
                                  │ (worker assigned)    │ (output written)
                                  ▼                     │
                             ┌──────────┐                │
                             │ running  │────────────────┘
                             └──────────┘
                                  │
              ┌───────────────────┼───────────────────┐
              │                   │                   │
              ▼                   ▼                   ▼
         ┌─────────┐       ┌──────────┐       ┌──────────┐
         │  retry  │       │  failed  │       │ skipped  │
         │ (retry<3)│       │(retries>3)│       │(upstream)│
         └─────────┘       └──────────┘       └──────────┘
```

---

## 5. External Dependencies

### 5.1 Service Dependencies

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          EXTERNAL DEPENDENCIES                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐                  │
│  │  MiniMax    │     │   Ollama    │     │  LiteLLM     │                  │
│  │  API        │     │  (local)    │     │   Proxy      │                  │
│  │  (M2.7)     │     │             │     │  (:4000)     │                  │
│  └─────────────┘     └─────────────┘     └─────────────┘                  │
│         │                   │                   │                          │
│         │                   │                   │                          │
│         ▼                   ▼                   ▼                          │
│  ┌─────────────────────────────────────────────────────────────┐          │
│  │                    Claude Code Workers                       │          │
│  │              (mclaude -p "task prompt..." )                  │          │
│  └─────────────────────────────────────────────────────────────┘          │
│                               │                                             │
│                               ▼                                             │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐                  │
│  │   Redis     │     │   Qdrant    │     │  Coolify    │                  │
│  │  (7.x)      │     │  (vector)   │     │  (:8000)    │                  │
│  │  task board │     │  embeddings │     │  deploy     │                  │
│  │  + pub/sub  │     │  + recall   │     │             │                  │
│  └─────────────┘     └─────────────┘     └─────────────┘                  │
│         │                   │                   │                          │
│         │                   │                   ▼                          │
│         │                   │           ┌─────────────┐                  │
│         │                   │           │ Cloudflare  │                  │
│         │                   │           │  (DNS)      │                  │
│         │                   │           └─────────────┘                  │
│         │                   │                                             │
│         ▼                   ▼                                             │
│  ┌─────────────────────────────────────────────────────────────┐          │
│  │                    ZFS Storage (tank)                       │          │
│  │  • Snapshots before execute phase                           │          │
│  │  • Rollback capability for failed deployments              │          │
│  └─────────────────────────────────────────────────────────────┘          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Dependency Matrix

| Service | Purpose | Connection | Health Check |
|---------|---------|------------|--------------|
| MiniMax API | LLM inference (M2.7) | Remote API | `curl -s` |
| Ollama | Local inference fallback | localhost:11434 | `curl -s /v1/models` |
| LiteLLM Proxy | Unified LLM interface | localhost:4000 | `curl -s /health` |
| Redis | Task queue + pub/sub | localhost:6379 | `redis-cli ping` |
| Qdrant | Vector storage + embeddings | localhost:6333 | `curl -s /collections` |
| Coolify | Deployment target | coolify.zappro.site | API polling |
| Cloudflare | DNS management | API | `curl -s /zones` |
| ZFS (tank) | Snapshots + rollback | Local | `zfs list tank` |

---

## 6. Rate Limits

### 6.1 Global Rate Limits

| Limit | Value | Scope | Enforcement |
|-------|-------|-------|-------------|
| **RPM** | 500 | Global | `nexus-rate-limiter.sh` |
| **5h window** | 15,000 requests | Hermes agent | Token bucket |
| **Hermes agents** | 1 per run | Per workflow | PREVC gate |

### 6.2 Rate Limit Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         RATE LIMIT ENFORCEMENT                             │
└──────────────────────────────────────────────────────────────────────────────┘

                        ┌──────────────────┐
                        │  Token Bucket     │
                        │  (15K / 5 hours)  │
                        └────────┬─────────┘
                                 │
                    ┌────────────┼────────────┐
                    │            │            │
                    ▼            ▼            ▼
             ┌───────────┐ ┌───────────┐ ┌───────────┐
             │ MiniMax   │ │  Ollama   │ │ LiteLLM  │
             │   API     │ │  (local)  │ │  Proxy   │
             └───────────┘ └───────────┘ └───────────┘
                    │            │            │
                    └────────────┼────────────┘
                                 │
                        ┌────────┴────────┐
                        │                 │
                        ▼                 ▼
               ┌─────────────┐    ┌─────────────┐
               │  Success    │    │ Rate Limited │
               │  (proceed)  │    │ (retry+exp)  │
               └─────────────┘    └─────────────┘
```

### 6.3 Rate Limit Enforcement Script

```bash
# nexus-rate-limiter.sh
# Implements token bucket: 15K requests per 5 hours

REQUETS_REMAINING=$(redis-cli GET rate_limit:remaining)
WINDOW_RESET=$(redis-cli GET rate_limit:reset)

if [ "$REQUESTS_REMAINING" -le 0 ]; then
    SLEEP_TIME=$((WINDOW_RESET - $(date +%s)))
    sleep "$SLEEP_TIME"
    redis-cli SET rate_limit:remaining 15000
fi

redis-cli DECR rate_limit:remaining
```

### 6.4 500 RPM Isolation

For isolated testing without hitting rate limits:

```bash
# test-worktree.sh — creates isolated git worktree
bash .claude/vibe-kit/scripts/test-worktree.sh SPEC-204 'pnpm test'

# Features:
# - Isolated git worktree
# - Dependency installation
# - 0.12s delay between requests (500 RPM)
# - Automatic cleanup
```

---

## 7. Error Handling Strategy

### 7.1 Error Recovery Flow

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         ERROR HANDLING FLOW                                │
└──────────────────────────────────────────────────────────────────────────────┘

                           ┌───────────────┐
                           │     TASK      │
                           │    FAILED     │
                           └───────┬───────┘
                                   │
                    ┌──────────────┼──────────────┐
                    │              │              │
                    ▼              ▼              ▼
              ┌──────────┐  ┌──────────┐  ┌──────────┐
              │ retry<3  │  │ retry=3  │  │ upstream │
              │          │  │          │  │ failed   │
              └────┬─────┘  └────┬─────┘  └────┬─────┘
                   │             │             │
                   ▼             │             ▼
           ┌─────────────┐       │     ┌───────────┐
           │ Exponential │       │     │  SKIPPED  │
           │   backoff   │       │     │ (deps)    │
           │  (1,2,4s)   │       │     └───────────┘
           └─────────────┘       │
                 │                │
                 ▼                ▼
           ┌──────────────┐ ┌──────────────┐
           │ Re-queued    │ │   FAILED     │
           │ (pending)   │ │ (max retries)│
           └──────────────┘ └──────────────┘
                                   │
                                   ▼
                         ┌──────────────────┐
                         │ Debug agent       │
                         │ (log-diagnostic)  │
                         └──────────────────┘
```

### 7.2 Error Types and Responses

| Error Type | Detection | Response | Recovery |
|------------|----------|----------|----------|
| **LLM Timeout** | 30s + timeout | Retry with backoff | Exponential 1→2→4s |
| **API Rate Limit** | 429 response | Wait + retry | Token bucket refill |
| **Agent Failure** | Exit code != 0 | Retry up to 3x | Skip if persistent |
| **Orphaned Task** | 10s no heartbeat | Orphan watchdog | Re-queue task |
| **Worker Crash** | Lock file stale | Restart worker | Resume queue |
| **ZFS Snapshot Fail** | `zfs` exit code | Abort phase | Manual intervention |

### 7.3 ZFS Snapshot Strategy

**Automatic snapshots per phase:**

```
tank@nexus-SPEC-205-plan-20260430T120000
tank@nexus-SPEC-205-review-20260430T120500
tank@nexus-SPEC-205-execute-20260430T121000      ← every 3 tasks
tank@nexus-SPEC-205-verify-20260430T121500
tank@nexus-SPEC-205-complete-20260430T122000
```

**Rollback procedure:**

```bash
# Rollback to safe state before execute phase
sudo zfs rollback -r tank@nexus-SPEC-205-execute-20260430T120000

# Verify state
nexus.sh --status
nexus.sh --resume
```

### 7.4 Orphan Watchdog

The orphan watchdog runs every 10 seconds to detect abandoned tasks:

```go
// OrphanWatchdog logic
for {
    orphanedTasks := redis-cli.SMEMBERS "tasks:orphaned"
    for _, taskID := range orphanedTasks {
        // Redistribute to available worker
        redis-cli.LPUSH "queue:pending" taskID
        log.Printf("Orphan redistributed: %s", taskID)
    }
    time.Sleep(10 * time.Second)
}
```

---

## 8. Monitoring and Logging Strategy

### 8.1 Log Structure

```
.claude/vibe-kit/
├── logs/
│   ├── nexus.log              # Main workflow log
│   ├── vibe-daemon.log        # Runtime daemon log
│   ├── nexus-sre.log          # SRE operations log
│   ├── workers/
│   │   ├── worker-01.log
│   │   ├── worker-02.log
│   │   └── ...
│   └── tasks/
│       ├── TASK-001.log
│       ├── TASK-002.log
│       └── ...
├── queue.json                 # Task queue state
├── state.json                 # Workflow state
└── .vibe-kit.lock            # PID lock
```

### 8.2 Log Format

```bash
# Standard log format
[YYYY-MM-DD HH:MM:SS] [LEVEL] [COMPONENT] message

# Examples
[2026-04-30 12:00:00] [INFO] [NEXUS] Phase transition: plan → review
[2026-04-30 12:00:01] [INFO] [VIBE] Worker-01 assigned TASK-001
[2026-04-30 12:00:02] [INFO] [WORKER] Task completed: TASK-001 (1.2s)
[2026-04-30 12:00:03] [WARN] [RATE] Token bucket refilled: 15000
[2026-04-30 12:00:04] [ERROR] [AGENT] TASK-003 failed: timeout after 30s
```

### 8.3 Monitoring Endpoints

| Endpoint | Port | Purpose |
|----------|------|---------|
| Health | `:8081` | Worker health check |
| SSE Board | `:8082` | Real-time task events |
| Metrics | `:9090` | Prometheus metrics |

### 8.4 Prometheus Metrics

```yaml
# Exposed metrics
nexus_tasks_total{status="completed|failed|pending"}
nexus_task_duration_seconds{task_type="implement|test|review"}
nexus_workers_active
nexus_rate_limit_remaining
nexus_queue_depth
```

### 8.5 Health Checks

```bash
# Individual service health
curl -s localhost:6379/ping                    # Redis
curl -s localhost:6333/collections             # Qdrant
curl -s localhost:4000/health                 # LiteLLM
curl -s localhost:11434/api/tags              # Ollama

# ZFS status
zfs list tank -t snapshot -r | grep nexus

# Worker status
nexus.sh --status
```

### 8.6 Alerting

```bash
# nexus-alert.sh triggers on:
# - Queue depth > 100 pending tasks
# - Worker crash rate > 20%
# - Rate limit exhausted
# - ZFS snapshot failure
# - Task timeout rate > 10%

# Alert channels:
# - Email: sre@zappro.site
# - Telegram: Hermes bot notification
# - Dashboard: SRE dashboard update
```

### 8.7 Dashboard Queries

```promql
# Tasks by status
nexus_tasks_total{status="pending"}
nexus_tasks_total{status="running"}
nexus_tasks_total{status="completed"}
nexus_tasks_total{status="failed"}

# Worker utilization
rate(nexus_tasks_completed_total[5m]) / nexus_workers_active

# Queue backlog
nexus_queue_depth / (nexus_tasks_total{status="completed"} + nexus_tasks_total{status="failed"} + nexus_queue_depth) * 100
```

---

## Appendix A: File Reference

| File | Location | Purpose |
|------|----------|---------|
| nexus.sh | `.claude/vibe-kit/nexus.sh` | Entry point |
| vibe-kit.sh | `.claude/vibe-kit/vibe-kit.sh` | Runtime runner |
| test-worktree.sh | `.claude/vibe-kit/scripts/test-worktree.sh` | Isolated testing |
| nexus-rate-limiter.sh | `scripts/nexus-rate-limiter.sh` | Rate limit enforcement |
| nexus-alert.sh | `scripts/nexus-alert.sh` | Alerting |
| SPEC.md | `docs/NEXUS_GUIDE.md` | Framework guide |
| agents/ | `.claude/vibe-kit/agents/{mode}/{agent}/` | Agent system prompts |

---

## Appendix B: Cron Configuration

```cron
# Main vibe-kit loop (every 5 minutes)
*/5 * * * * cd /srv/monorepo && \
  VIBE_DIR=/srv/monorepo/.claude/vibe-kit \
  MONOREPO_DIR=/srv/monorepo \
  VIBE_PARALLEL=15 \
  VIBE_HOURS=8 \
  bash /srv/monorepo/.claude/vibe-kit/vibe-kit.sh >> .claude/vibe-kit/cron.log 2>&1

# Daily cleanup (3 AM)
0 3 * * * cd /srv/monorepo && \
  bash scripts/nexus-rate-limiter.sh --reset

# Weekly ZFS snapshot audit
0 4 * * 0 zfs list tank -t snapshot -r | grep nexus >> /srv/ops/logs/nexus-snapshots.log
```

---

## Appendix C: Quick Reference

```bash
# Workflow
nexus.sh --spec SPEC-NNN --phase plan        # Create queue
nexus.sh --spec SPEC-NNN --phase review       # Human gate
nexus.sh --spec SPEC-NNN --phase execute      # Run workers
nexus.sh --spec SPEC-NNN --phase verify       # Test suite
nexus.sh --spec SPEC-NNN --phase complete     # Deploy

# Status
nexus.sh --status                            # Current state
nexus.sh --resume                            # Resume from checkpoint

# Maintenance
nexus.sh --snapshot                           # Manual ZFS snapshot
nexus.sh --abort                             # Abort workflow
nexus-rate-limiter.sh --status               # Rate limit status
nexus-alert.sh --test                        # Test alerting

# Agent queries
nexus.sh --mode list                         # All modes
nexus.sh --mode debug                         # Debug agents
nexus.sh --mode debug --agent log-diagnostic # Specific agent prompt
```
