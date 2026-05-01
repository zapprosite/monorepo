# Result Summary Workflow

## Nexus Verify Phase (V) Entry Point

### 1. Purpose

Summarize Execute phase results for the Verify gate. This document captures what was actually delivered against what was planned, providing a clear Pass/Fail decision input for the V→C (Verify→Complete) transition.

### 2. When to Run

- **Phase:** Nexus V (Verify) — entry point
- **Trigger:** Execute phase (E) has completed; all tasks in queue are in a terminal state (completed, failed, or skipped)
- **Prerequisite:** `queue.json` is finalized, vibe-kit logs are available, context_pack memories are populated

### 3. Inputs

| Input | Source | Description |
|-------|--------|-------------|
| `queue.json` | `/srv/monorepo/.claude/harness/workflows/prevc.json` or task queue export | Task completion status for all executed items |
| `vibe-kit logs` | `~/.claude/projects/*/memory/` or harness session logs | Execution metrics: duration, token usage, agent invocations |
| `context_pack memories` | Memory index files under `.claude/` | What was done — captured decisions, artifacts, and outcomes |

### 4. Output Format

```
## Result Summary — [Session/Epic Name]

### Tasks Completed
- Completed: X / Y
- Success Rate: Z%

### Failed Tasks
| Task | Error Summary |
|------|---------------|
| task-id | Brief error description |

### Coverage Metrics
| Metric | Value |
|--------|-------|
| Files Modified | N |
| Tests Added/Updated | N |
| Docs Updated | N |
| Breaking Changes | Yes/No |

### Performance Benchmarks
| Benchmark | Value |
|-----------|-------|
| Total Duration | HH:MM:SS |
| Tokens Used | N |
| Agent Invocations | N |
| Avg Task Duration | Ns |

### Planned vs Delivered

| Planned | Delivered | Status |
|---------|-----------|--------|
| Feature X | Feature X delivered | Match |
| Bug Y fix | Bug Y not addressed | Gap |
| Refactor Z | Refactor Z complete | Match |

### Gate Decision

**PASS** — All critical tasks completed, success rate >= 90%, no blocking gaps

**FAIL** — Critical tasks failed, success rate < 90%, blocking gaps identified

---

Next: Proceed to V→C transition if PASS, or return to E phase for remediation if FAIL.
