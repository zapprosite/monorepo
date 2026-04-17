# RESEARCH-7: Spec-Driven Development + Pipeline Patterns

## Key Findings (April 2026 Best Practices)

### 1. SPEC-\*.md Structure

**Location:** `docs/SPECS/SPEC-NNN-name.md`

**Standard Frontmatter:**

```yaml
---
name: SPEC-058-hermes-agency-suite
description: Hermes Agency Suite — 11-agent marketing agency...
status: IMPLEMENTED
priority: critical
author: Principal Engineer
date: 2026-04-17
specRef: SPEC-011 (archived), SPEC-046, SPEC-053
---
```

**Status Values:** `DRAFT | PENDING | IN_PROGRESS | IMPLEMENTED | COMPLETED | ARCHIVED`

**Core Sections:**

- Objective
- Tech Stack (table format)
- Architecture Overview (ASCII diagrams)
- N Agency Agents/Skills
- Database Schema (Qdrant collections)
- LLM Routing / LiteLLM Fallback Chain
- 5 Autonomous Workflows (WF-1 through WF-5)
- Human Gates (decision tables)
- Commands
- Project Structure
- Non-Goals
- Dependencies
- Decisions Log
- Success Criteria
- Acceptance Criteria (checklist format)

### 2. Pipeline Generation Flow

```
/spec "description" → docs/SPECS/SPEC-NNN.md created
         ↓
/pg → tasks/pipeline.json generated
         ↓
14 agents in parallel via orchestrator
         ↓
PR via SHIPPER
```

**Pipeline Gen Skill:** `.claude/skills/pipeline-gen/SKILL.md`

**Phase Mapping:**
| SPEC Priority | Phase |
|--------------|-------|
| Must Have | Phase 1 |
| Should Have | Phase 2 |
| Could Have | Phase 3 |

### 3. Pipeline.json Structure

**Location:** `tasks/pipeline.json`

```json
{
  "tasks": [
    {
      "id": "TASK-05801-T2",
      "title": "[SPEC-058-01] Setup 9 Qdrant collections",
      "description": "Detailed task description",
      "status": "pending",
      "priority": "critical",
      "dependencies": [],
      "specRef": "SPEC-058-01",
      "files": ["apps/hermes-agency/src/qdrant/collections/"],
      "testRequired": true,
      "subtasks": [
        { "id": "TASK-05801-T2.1", "title": "Schema agency_clients", "status": "pending" }
      ]
    }
  ],
  "meta": {
    "totalTasks": 24,
    "completedTasks": 0,
    "pendingTasks": 24,
    "generatedAt": "2026-04-17T15:00",
    "projectName": "zappro-monorepo",
    "version": "2.0",
    "specs": ["SPEC-058", "SPEC-059", "SPEC-060"]
  }
}
```

### 4. 14-Agent Parallel Execution

**Orchestrator:** `.claude/skills/orchestrator/SKILL.md`

| #   | Agent         | Type   | Function                           |
| --- | ------------- | ------ | ---------------------------------- |
| 1   | SPEC-ANALYZER | claude | Analyze SPEC, extract AC and files |
| 2   | ARCHITECT     | claude | Review architecture, flag issues   |
| 3   | CODER-1       | claude | Implement backend                  |
| 4   | CODER-2       | claude | Implement frontend                 |
| 5   | TESTER        | claude | Write tests                        |
| 6   | SMOKE         | claude | Generate smoke tests               |
| 7   | SECURITY      | claude | OWASP audit + secrets              |
| 8   | DOCS          | claude | Update documentation               |
| 9   | TYPES         | inline | Type check (pnpm tsc)              |
| 10  | LINT          | inline | Lint                               |
| 11  | SECRETS       | claude | Scan secrets                       |
| 12  | GIT           | claude | Commit changes                     |
| 13  | REVIEWER      | claude | Code review final                  |
| 14  | SHIPPER       | claude | Create PR                          |

**State Tracking:** `tasks/agent-states/{AGENT}.json`
**Logs:** `.claude/skills/orchestrator/logs/{AGENT}.log`

**Critical Agents (block on failure):** CODER-1, CODER-2
**Important Agents (warning on failure):** TESTER, SECURITY
**Verification Agents (CI catches):** TYPES, LINT, SECRETS

### 5. /execute Command

```markdown
# /execute — Full SPEC → PR Pipeline

/execute "Build a user authentication module with JWT"

# What happens:

1. /spec "description" → creates SPEC.md
2. /pg → generates pipeline.json
3. 14 agents in parallel → execute pipeline tasks
4. SHIPPER → creates PR when all complete
```

**Command Definition:** `.claude/commands/execute.md`

### 6. Cron Automation

**Scheduled Tasks:** `.claude/scheduled_tasks.json`

| Cron           | Purpose                            |
| -------------- | ---------------------------------- |
| `*/30 * * * *` | Sync docs to memory                |
| `0 3 * * *`    | Generate pipeline, list priorities |
| `0 4 * * *`    | Daily code review                  |
| `0 5 * * *`    | Test coverage check                |
| `0 6 * * *`    | Secrets audit scan                 |
| `0 8 * * *`    | MCP health check                   |

## Recommendations for CLAUDE.md / AGENTS.md

### ADD to CLAUDE.md

1. **Document /execute workflow:**

```markdown
## /execute — Full Pipeline

/execute "description" → SPEC.md → pipeline.json → 14 agents → PR
```

2. **Document orchestrator agent states:**

```markdown
## Agent State Tracking

- States: `tasks/agent-states/{AGENT}.json`
- Logs: `.claude/skills/orchestrator/logs/`
```

3. **Add monitoring commands:**

```bash
# Check agent states
ls tasks/agent-states/

# View pipeline status
cat tasks/pipeline.json | jq '.meta'
```

### ADD to AGENTS.md

1. **Document 14-agent execution pattern with table**

2. **Document phase mapping:**

```markdown
| Priority    | Phase   |
| ----------- | ------- |
| Must Have   | Phase 1 |
| Should Have | Phase 2 |
```

3. **Document criticality tiers:**

- **CRITICAL:** CODER-1, CODER-2 (block PR on failure)
- **IMPORTANT:** TESTER, SECURITY (warning on failure)
- **VERIFICATION:** TYPES, LINT, SECRETS (CI catches)

4. **Document filesystem coordination:**

- Agent states in `tasks/agent-states/`
- Logs in `.claude/skills/orchestrator/logs/`
- Pipeline in `tasks/pipeline.json`

### UPDATE in AGENTS.md

1. **Add /execute to command table:**

```markdown
| /execute | SPEC → PG → 14 agents → PR |
```

2. **Expand /pg documentation:**

```markdown
| /pg | Generate pipeline.json from SPECs |
```

## What to Add/Update/Delete

| File      | Action | Reason                                           |
| --------- | ------ | ------------------------------------------------ |
| CLAUDE.md | ADD    | `/execute` documentation, orchestrator section   |
| AGENTS.md | ADD    | 14-agent table, phase mapping, criticality tiers |
| CLAUDE.md | UPDATE | Expand /pg description                           |
| AGENTS.md | UPDATE | Add /execute to command table                    |

## Files Reference

| Path                                    | Purpose                |
| --------------------------------------- | ---------------------- |
| `docs/SPECS/*.md`                       | Feature specifications |
| `tasks/pipeline.json`                   | Task pipeline (16KB)   |
| `tasks/agent-states/*.json`             | 14 agent states        |
| `.claude/skills/orchestrator/`          | 14-agent execution     |
| `.claude/commands/{pg,spec,execute}.md` | Slash commands         |
| `.claude/skills/pipeline-gen/SKILL.md`  | Pipeline gen logic     |
| `.claude/scheduled_tasks.json`          | Cron automation        |
