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

## 3. Agent Role Specifications

### 3.1 debug-agent

**Responsibility:** Diagnostic and troubleshooting

**Capabilities:**
- Log analysis and pattern detection
- Stack trace parsing and root cause identification
- Performance profiling (CPU, memory, I/O)
- Network request tracing
- Error classification (transient vs permanent)

**Trigger Conditions:**
- Task failure in any agent
- Quality gate failure
- Performance regression detected

**Output:**
- Diagnostic report with root cause
- Suggested fixes as actionable tasks
- Correlation IDs for related failures

---

### 3.2 test-agent

**Responsibility:** Unit, integration, and end-to-end testing

**Capabilities:**
- Unit test generation (Jest, Vitest, Pytest)
- Integration test orchestration
- E2E scenario writing (Playwright, Cypress)
- Test coverage analysis
- Boundary condition testing
- Property-based testing (fast-check)

**Quality Gates:**
- Coverage must meet threshold (default: 80%)
- All previous tests must pass
- No flaky tests (retry threshold: 2)

**Output:**
- Test suite with assertions
- Coverage report
- Flaky test detection

---

### 3.3 backend-agent

**Responsibility:** API, services, and database

**Capabilities:**
- REST/GraphQL API development
- Service orchestration (dependency injection)
- Database schema migrations
- Query optimization
- Caching strategies (Redis)
- Authentication/authorization

**Specializations:**
- Microservices communication
- Event-driven architecture (message queues)
- File processing pipelines

**Output:**
- Working API endpoints
- Database migrations
- Service contracts (OpenAPI/AsyncAPI)

---

### 3.4 frontend-agent

**Responsibility:** UI, components, and styling

**Capabilities:**
- Component library development
- Responsive design implementation
- State management (Zustand, Redux, Context)
- Animation and transitions
- Accessibility compliance (WCAG 2.1 AA)
- Performance optimization (lazy loading, code splitting)

**Specializations:**
- React/Vue/Svelte component authoring
- CSS-in-JS and design systems
- Form validation and handling

**Output:**
- Functional UI components
- Design system tokens
- Responsive layouts

---

### 3.5 review-agent

**Responsibility:** Code review and quality gates

**Capabilities:**
- Static analysis (ESLint, TypeScript)
- Security vulnerability scanning
- Code complexity analysis
- Dependency audit
- Performance anti-pattern detection
- Architectural consistency check

**Quality Gates (configurable):**
- No critical security findings
- Complexity score below threshold
- No deprecated API usage
- Dependencies are stable versions

**Output:**
- Review report with findings
- Quality score (0-100)
- Approve/reject with rationale

---

### 3.6 docs-agent

**Responsibility:** Documentation generation

**Capabilities:**
- API documentation (OpenAPI → MD/SwaggerUI)
- README and guide generation
- Changelog management
- Inline code documentation
- Architecture diagram generation (Mermaid)
- Decision log (ADR format)

**Output:**
- Structured documentation files
- API reference
- Usage examples
- Architecture decision records

---

### 3.7 deploy-agent

**Responsibility:** Docker, Coolify, and rollback

**Capabilities:**
- Docker image building and pushing
- Docker Compose orchestration
- Coolify deployment integration
- Environment configuration management
- Secret rotation handling
- Rollback execution

**Specializations:**
- ZFS snapshot coordination (pre-deploy)
- Health check monitoring
- Traffic routing (blue/green, canary)

**Output:**
- Deployed artifacts
- Rollback procedures
- Deployment report

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
| 2 | Agent role prompt templates | ✅ Done |
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

**Phase 2:** `.claude/vibe-kit/agents/` — 7 agent role templates:
- `debug-agent/system-prompt.md` — Diagnostic and troubleshooting
- `test-agent/system-prompt.md` — Unit, integration, E2E testing
- `backend-agent/system-prompt.md` — API, services, database
- `frontend-agent/system-prompt.md` — UI, components, styling
- `review-agent/system-prompt.md` — Code review, quality gates
- `docs-agent/system-prompt.md` — Documentation generation
- `deploy-agent/system-prompt.md` — Docker, Coolify, rollback
