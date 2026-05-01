---
spec: SPEC-204
title: Nexus — Unified Agent Harness Framework
status: active
date: 2026-04-24
author: Agent Architecture Team
---

# SPEC-204 — Nexus: Unified Agent Harness Framework

## 1. Overview

**Nexus** is a unified agent harness framework that synthesizes:
- **vibe-kit** loop runner (15x parallel micro-task execution with ZFS snapshots)
- **PREVC workflow** (5-phase gated development: Plan → Review → Execute → Verify → Complete)
- **LangGraph** orchestration (cycles support, checkpointing, fault tolerance)
- **MCP dotcontext** state management (sessions, artifacts, sensors, handoffs)
- **Specialized agent roles** (debug, test, backend, frontend, review, docs, deploy)

**Design Philosophy:**
- Each agent role has a single, focused responsibility
- Workflow gates prevent progress until quality thresholds are met
- Context is ephemeral per task; state lives in filesystem (queue.json, state.json, artifacts)
- LangGraph provides graph-based orchestration with native cycle support
- MCP dotcontext provides durable session state across agent handoffs

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              NEXUS ORCHESTRATION                             │
│                         (LangGraph Directed Graph)                           │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐ │
│  │   P     │───▶│   R     │───▶│   E     │───▶│   V     │───▶│   C     │ │
│  │ (Plan)  │    │(Review) │    │(Execute)│    │(Verify) │    │(Complete│ │
│  └─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘ │
│       │              │              │              │               │        │
│       │ Gate:        │ Gate:        │ Gate:        │ Gate:         │        │
│       │ Plan Approval│ R→E Approval │ AC Complete  │ V→C Approval  │        │
└───────┼──────────────┼──────────────┼──────────────┼───────────────┼────────┘
        │              │              │              │               │
        ▼              ▼              ▼              ▼               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SPECIALIZED AGENT ROLES                             │
├─────────────┬─────────────┬─────────────┬─────────────┬────────────────────┤
│ debug-agent │  test-agent │ backend-agent│frontend-agent│  review-agent   │
│ Diagnostic  │ Unit/Int/E2E│ API/Services │ UI/Components│ Code Review     │
│ troubleshot │ test writes │ DB/Logic     │ Styling      │ Quality gates     │
├─────────────┼─────────────┼─────────────┼─────────────┼────────────────────┤
│  docs-agent │ deploy-agent│              │              │                    │
│ Doc generation│Docker/Coolify│           │              │                    │
│ README/API   │ Rollback     │              │              │                    │
└─────────────┴─────────────┴─────────────┴─────────────┴────────────────────┘
        │              │              │              │               │
        └──────────────┴──────────────┴──────────────┴───────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            VIBE-KIT EXECUTION LOOP                           │
│  ┌─────────────────────────────────────────────────────────────────────┐     │
│  │  15× mclaude workers (parallel headless sessions)                  │     │
│  │  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐     ┌─────┐              │     │
│  │  │ W01 │ │ W02 │ │ W03 │ │ W04 │ │ W05 │ ... │ W15 │              │     │
│  │  └─────┘ └─────┘ └─────┘ └─────┘ └─────┘     └─────┘              │     │
│  │  Atomic queue claim via jq (no race conditions)                   │     │
│  │  Fresh context per task (mclaude -p flag)                         │     │
│  │  ZFS snapshot every 3 tasks                                      │     │
│  └─────────────────────────────────────────────────────────────────────┘     │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐     │
│  │   queue.json    │  │   state.json    │  │   /artifacts/{task_id}  │     │
│  │   Task queue    │  │   Phase state   │  │   Context snippets     │     │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          MCP dotcontext SESSION                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │
│  │   sessions  │  │   handoffs  │  │  artifacts  │  │    sensors      │ │
│  │  Durable    │  │  Agent→Agent│  │  Named docs │  │  Quality checks │ │
│  │  workflow   │  │  Transfer   │  │  outputs    │  │  pass/fail      │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Agent Mode Matrix (7×7 = 49 Agents)

Nexus provides **7 operational modes**, each with **7 specialized agents** = **49 total agents**.
Select a mode based on focus area, then choose the specific agent for the task.

### Mode: debug

| Agent | Specialization | Use When |
|-------|---------------|----------|
| `log-diagnostic` | Log analysis and pattern detection | Error bursts, log correlation |
| `stack-trace` | Stack trace parsing and root cause | Exceptions, crashes |
| `perf-profiler` | CPU, memory, I/O profiling | Slow performance, memory leaks |
| `network-tracer` | HTTP/DNS/TLS tracing | Network issues, timeouts |
| `security-scanner` | Vulnerability detection | Suspicious activity, CVEs |
| `sre-monitor` | SLO/SLA monitoring | Alert triage, capacity planning |
| `incident-response` | Incident handling | Service outages, P1 events |

### Mode: test

| Agent | Specialization | Use When |
|-------|---------------|----------|
| `unit-tester` | Unit test generation | Functions, pure logic |
| `integration-tester` | Service boundary testing | API endpoints, DB queries |
| `e2e-tester` | End-to-end user flows | Playwright, Cypress scenarios |
| `coverage-analyzer` | Coverage metrics | Coverage gaps, thresholds |
| `boundary-tester` | Edge case testing | Min/max/empty/null values |
| `flaky-detector` | Test reliability | Intermittent failures |
| `property-tester` | Property-based testing | fast-check, invariants |

### Mode: backend

| Agent | Specialization | Use When |
|-------|---------------|----------|
| `api-developer` | REST/GraphQL APIs | New endpoints, OpenAPI |
| `service-architect` | Dependency injection | Service composition |
| `db-migrator` | Schema migrations | Postgres, migrations |
| `cache-specialist` | Redis caching | Cache-aside, TTL, invalidation |
| `auth-engineer` | Authentication/authorization | JWT, sessions, OAuth |
| `event-developer` | Event-driven architecture | RabbitMQ, Kafka, queues |
| `file-pipeline` | File processing | Uploads, transformations |

### Mode: frontend

| Agent | Specialization | Use When |
|-------|---------------|----------|
| `component-dev` | React/Vue components | New UI components |
| `responsive-dev` | Mobile-first CSS | Breakpoints, fluid layouts |
| `state-manager` | Zustand/Redux/Query | Global state, server state |
| `animation-dev` | Framer Motion/CSS | Transitions, page flows |
| `a11y-auditor` | WCAG 2.1 AA | Accessibility, ARIA |
| `perf-optimizer` | Core Web Vitals | LCP, INP, CLS optimization |
| `design-system` | Design tokens | Theme, tokens, multi-brand |

### Mode: review

| Agent | Specialization | Use When |
|-------|---------------|----------|
| `correctness-reviewer` | Logic errors, edge cases | Spec adherence |
| `readability-reviewer` | Naming, complexity | Code clarity |
| `architecture-reviewer` | Dependencies, layers | Module boundaries |
| `security-reviewer` | OWASP, secrets | Security audit |
| `perf-reviewer` | N+1, pagination | Performance anti-patterns |
| `dependency-auditor` | Outdated packages | Dependency health |
| `quality-scorer` | Aggregate scoring | Final approval gate |

### Mode: docs

| Agent | Specialization | Use When |
|-------|---------------|----------|
| `api-doc-writer` | OpenAPI specs | Swagger, API reference |
| `readme-writer` | README, guides | Getting started docs |
| `changelog-writer` | Keepachangelog | Release notes |
| `inline-doc-writer` | JSDoc, comments | Code documentation |
| `diagram-generator` | Mermaid diagrams | Architecture, flows |
| `adr-writer` | ADR templates | Architecture decisions |
| `doc-coverage-auditor` | Docs completeness | Gap analysis |

### Mode: deploy

| Agent | Specialization | Use When |
|-------|---------------|----------|
| `docker-builder` | Multi-stage Dockerfile | Image builds |
| `compose-orchestrator` | Docker Compose | Multi-container |
| `coolify-deployer` | Coolify API | Deployments |
| `secret-rotator` | Vault, env rotation | Secret management |
| `rollback-executor` | Deploy/migration rollback | Incident response |
| `zfs-snapshotter` | ZFS snapshots | Pre-deploy safety |
| `health-checker` | Health endpoints | Deployment verification |

---

## 4. PREVC Workflow Phases

### 4.1 Phase P — Plan

**Entry:** New SPEC or feature request

**Activities:**
1. Parse SPEC.md → extract acceptance criteria (ACs)
2. Break down ACs into micro-tasks (< 5 min each)
3. Assign tasks to appropriate agent roles
4. Create queue.json with task definitions
5. Establish success metrics per task

**Exit Gate:** Human approves plan
- Review task breakdown
- Validate agent assignments
- Approve or request revisions

---

### 4.2 Phase R — Review

**Entry:** Plan approved, queue.json populated

**Activities:**
1. Review agent reviews all tasks for:
   - Feasibility assessment
   - Risk identification
   - Dependency mapping
   - Test strategy definition
2. Debug agent pre-scans for obvious issues
3. test-agent validates testability of ACs
4. docs-agent outlines documentation scope

**Exit Gate:** R→E Approval required
- All agents confirm readiness
- Risk level acceptable
- No blocking dependencies

---

### 4.3 Phase E — Execute

**Entry:** Review approved

**Activities:**
1. vibe-kit.sh launches 15× mclaude workers
2. Workers claim tasks atomically from queue.json
3. Each worker runs with fresh context (mclaude -p)
4. ZFS snapshot every 3 completed tasks
5. MCP dotcontext records:
   - Session state per task
   - Artifacts produced
   - Handoffs between agents
6. On failure: debug-agent diagnostics + retry

**Exit Gate:** All tasks complete OR ACs met
- Queue shows 100% completion
- No blocking failures

---

### 4.4 Phase V — Verify

**Entry:** Execution phase complete

**Activities:**
1. test-agent runs full test suite
2. review-agent performs final code review
3. Quality gates evaluated:
   - Coverage threshold met
   - No critical findings
   - Performance benchmarks pass
4. Manual verification if required
5. debug-agent confirms no regressions

**Exit Gate:** V→C Approval required
- All quality gates green
- Human sign-off on verification

---

### 4.5 Phase C — Complete

**Entry:** Verification approved

**Activities:**
1. deploy-agent performs deployment
2. docs-agent finalizes documentation
3. Artifact collection and tagging
4. ZFS snapshot of final state
5. Git commit + PR creation
6. Session cleanup and reporting

**Output:**
- Deployed application
- Complete documentation
- PR for review/merge

---

## 5. Tech Stack Integration

### 5.1 LangGraph (Orchestration)

**Role:** Directed graph execution with cycle support

**Why LangGraph:**
- Native support for cycles (unlike simple DAGs)
- Built-in checkpointing for fault tolerance
- Streaming support for real-time updates
- Fault tolerance with retry policies

**Integration Points:**
```
State Graph:
  Plan → Review → Execute → Verify → Complete
                              ↓
                         (cycle back to Execute on failure)
```

### 5.2 MCP dotcontext (State Management)

**Role:** Durable session state across agent handoffs

**Tools Used:**
- `mcp__dotcontext__harness` — session lifecycle
- `mcp__dotcontext__workflow-*` — PREVC phase transitions
- `mcp__dotcontext__context` — semantic context
- `mcp__dotcontext__skill` — agent capabilities

**State Schema:**
```json
{
  "session_id": "nexus-2026-04-24-001",
  "phase": "execute",
  "current_task": "T005",
  "agents": {
    "debug-agent": {"status": "idle", "last_task": "T003"},
    "test-agent": {"status": "running", "last_task": "T005"},
    "backend-agent": {"status": "done", "last_task": "T002"}
  },
  "artifacts": ["api-spec.json", "test-coverage.json"],
  "gates": {
    "plan_approved": true,
    "review_approved": true,
    "execute_complete": false,
    "verify_approved": false
  }
}
```

### 5.3 vibe-kit (Execution Loop)

**Role:** Parallel micro-task execution

**Integration:**
- Entry point: `nexus.sh` (wraps vibe-kit.sh)
- Task format: Same queue.json schema
- Agent role injected via task metadata
- ZFS snapshots coordinated with PREVC phases

**Execution Flow:**
```bash
nexus.sh --spec SPEC-204 --phase execute --parallel 15
```

---

## 6. Implementation

### 6.1 Entry Point: nexus.sh

**Location:** `/srv/monorepo/.claude/vibe-kit/nexus.sh`

**Usage:**
```bash
# Start from SPEC
nexus.sh --spec SPEC-204 --phase plan

# Execute with parallel workers
nexus.sh --spec SPEC-204 --phase execute --parallel 15

# Resume interrupted run
nexus.sh --resume

# Skip to specific phase
nexus.sh --spec SPEC-204 --phase verify
```

**Phases:**
- `--phase plan` — Initialize queue from SPEC, await approval
- `--phase review` — Run review agents, await approval
- `--phase execute` — Launch vibe-kit loop, await completion
- `--phase verify` — Run verification, await approval
- `--phase complete` — Finalize and ship

### 6.2 Queue Schema Extension

```json
{
  "spec": "SPEC-204",
  "phase": "execute",
  "total": 24,
  "pending": 20,
  "running": 3,
  "done": 1,
  "failed": 0,
  "tasks": [
    {
      "id": "T001",
      "name": "implement-auth-endpoint",
      "description": "Add JWT authentication to /api/auth/login",
      "agent_role": "backend-agent",
      "status": "done",
      "attempts": 1,
      "worker": "W03",
      "created_at": "2026-04-24T12:00:00Z",
      "completed_at": "2026-04-24T12:03:45Z",
      "artifacts": ["/artifacts/T001/auth-endpoint.json"],
      "context_snippet": null
    }
  ]
}
```

### 6.3 Agent Handoff Protocol

**Via SendMessage:**
```json
{
  "to": "test-agent",
  "from": "backend-agent",
  "task_id": "T005",
  "artifacts": ["/artifacts/T005/coverage.json"],
  "requirements": {
    "min_coverage": 80,
    "flaky_threshold": 2
  }
}
```

### 6.4 ZFS Snapshot Coordination

**Naming Convention:**
```
tank@nexus-{spec}-{phase}-{timestamp}
```

**Snapshots Taken:**
- Before each phase transition
- Every 3 completed tasks during Execute
- On explicit checkpoint via `nexus.sh --snapshot`

**Rollback:**
```bash
sudo zfs rollback -r tank@nexus-SPEC-204-execute-20260424T120000
```

---

## 7. File Structure

```
/srv/monorepo/
├── .claude/
│   ├── vibe-kit/
│   │   ├── nexus.sh              # Entry point
│   │   ├── vibe-kit.sh           # Existing loop runner
│   │   ├── queue.json            # Task queue
│   │   ├── state.json           # Phase state
│   │   ├── artifacts/           # Task outputs
│   │   └── logs/                # Execution logs
│   └── agents/
│       ├── debug-agent/         # Role-specific prompts
│       ├── test-agent/
│       ├── backend-agent/
│       ├── frontend-agent/
│       ├── review-agent/
│       ├── docs-agent/
│       └── deploy-agent/
└── docs/
    └── SPEC-204.md               # This specification
```

---

## 8. Quality Gates Reference

| Gate | Condition | Blocking |
|------|-----------|----------|
| P→R | Human approves plan | YES |
| R→E | All agents confirm readiness | YES |
| E→V | All tasks complete OR ACs met | NO (warning) |
| V→C | Quality gates green + human approves | YES |

### Quality Thresholds

| Metric | Threshold | Agent |
|--------|-----------|-------|
| Test coverage | ≥ 80% | test-agent |
| Security findings | 0 Critical | review-agent |
| Cyclomatic complexity | ≤ 15 | review-agent |
| Flaky test rate | < 5% | test-agent |
| Doc coverage | ≥ 70% | docs-agent |

---

## 9. Comparison with Prior Art

| Feature | smolagents | LangGraph | CrewAI | AutoGen | **Nexus** |
|---------|-----------|-----------|--------|---------|-----------|
| Multi-agent orchestration | AgentGroup | Graph | Crew | GroupChat | **PREVC + LangGraph** |
| Cycle support | Limited | **Full** | No | Limited | **Full** |
| Checkpointing | No | **Yes** | No | No | **Yes** |
| Parallel execution | No | **Yes** | **Yes** | **Yes** | **15× vibe-kit** |
| Role-based agents | No | No | **Yes** | No | **7 roles** |
| Human gates | No | No | No | No | **PREVC gates** |
| State durability | No | **Yes** | No | No | **MCP dotcontext** |
| ZFS snapshots | No | No | No | No | **Yes** |

---

## 10. Known Limitations

1. **No cross-task context** — Each mclaude worker gets fresh context; use artifacts for state transfer
2. **SPEC must have explicit ACs** — Fallback to natural language decomposition is fragile
3. **Human gates create blocking** — For rapid iteration, gates can be bypassed with `--force`
4. **Agent role granularity** — 7 roles may not map perfectly to all task types
5. **ZFS dependency** — Rollback only works on ZFS-backed storage

---

## 11. References

- vibe-kit SPEC: `/srv/monorepo/.claude/vibe-kit/SPEC.md`
- PREVC workflow: MCP dotcontext `workflow-*` tools
- LangGraph: `SPEC-068-langgraph-circuit-breaker.md`
- Agent frameworks: Research findings (agent-frameworks-1 through -5)
- Monorepo SOUL: `/srv/monorepo/docs/SPECS/SPEC-200-hermes-ecosystem-architecture.md`

---

## 12. Implementation Phases

| Phase | Deliverable | Status |
|-------|-------------|--------|
| 1 | nexus.sh wrapper script | ✅ Done |
| 2 | 49 specialized agent prompts (7×7) | ✅ Done |
| 3 | MCP dotcontext integration | TODO |
| 4 | Quality gate implementation | TODO |
| 5 | ZFS snapshot coordination | TODO |
| 6 | End-to-end test run | TODO |

### Implementation Notes

**Phase 1:** `.claude/vibe-kit/nexus.sh` — Full PREVC workflow entry point with:
- `nexus.sh --phase plan` → parses SPEC, creates queue.json
- `nexus.sh --phase review` → review gate with human approval
- `nexus.sh --phase execute` → launches vibe-kit workers
- `nexus.sh --phase verify` → quality gate verification
- `nexus.sh --phase complete` → finalization and ship
- `nexus.sh --mode debug` → switch to debug mode with 7 agents
- `nexus.sh --mode test` → switch to test mode with 7 agents

**Phase 2:** `.claude/vibe-kit/agents/` — **49 specialized agents** across 7 modes:

| Mode | Agents (7) |
|------|------------|
| debug | log-diagnostic, stack-trace, perf-profiler, network-tracer, security-scanner, sre-monitor, incident-response |
| test | unit-tester, integration-tester, e2e-tester, coverage-analyzer, boundary-tester, flaky-detector, property-tester |
| backend | api-developer, service-architect, db-migrator, cache-specialist, auth-engineer, event-developer, file-pipeline |
| frontend | component-dev, responsive-dev, state-manager, animation-dev, a11y-auditor, perf-optimizer, design-system |
| review | correctness-reviewer, readability-reviewer, architecture-reviewer, security-reviewer, perf-reviewer, dependency-auditor, quality-scorer |
| docs | api-doc-writer, readme-writer, changelog-writer, inline-doc-writer, diagram-generator, adr-writer, doc-coverage-auditor |
| deploy | docker-builder, compose-orchestrator, coolify-deployer, secret-rotator, rollback-executor, zfs-snapshotter, health-checker |

Each agent has `system-prompt.md` with full capabilities, protocols, and handoff patterns.
