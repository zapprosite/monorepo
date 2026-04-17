# RESEARCH-1: Enterprise CLAUDE.md Patterns

**Date:** 2026-04-17
**Focus:** Skill orchestration, cron strategy, delegation hierarchy
**Status:** COMPLETE

---

## 1. KEY FINDINGS (April 2026 Best Practices)

### 1.1 Multi-Level CLAUDE.md Hierarchy

O monorepo demonstra um sistema **3-níveis** bem estabelecido:

| Level | Path                              | Scope                                            |
| ----- | --------------------------------- | ------------------------------------------------ |
| Root  | `/srv/monorepo/CLAUDE.md`         | Stack overview, spec-flow, secrets mandate       |
| Local | `/srv/monorepo/.claude/CLAUDE.md` | Network governance, auto-orchestration, specflow |
| User  | `/home/will/.claude/CLAUDE.md`    | Multi-claude CLI, agent skills                   |

**Best Practice:** Separação clara de responsabilidades entre níveis.

### 1.2 Skill Orchestration System (26 skills)

**Estrutura padrão skill:**

```
skill-name/
├── SKILL.md              # YAML frontmatter + documentation
└── references/*.md       # Optional supplementary docs
```

**Frontmatter schema:**

```yaml
---
name: skill-name
description: One-line description
trigger: /command-name # Optional slash command
version: 1.0.0
type: skill
user-invocable: true # CLI accessible
allowed-tools: [Bash, Read] # Optional whitelist
---
```

### 1.3 Orchestrator Pattern (14 Agents)

O orchestrator `/execute` é o flagship pattern:

| Agent                | Function        | Criticality   |
| -------------------- | --------------- | ------------- |
| CODER-1, CODER-2     | Implementation  | **BLOCKS PR** |
| TESTER, SECURITY     | Quality gates   | Warnings      |
| TYPES, LINT, SECRETS | CI verification | CI catches    |
| SHIPPER              | Final PR        | Orchestration |

**Execution:** `agent-states/` filesystem coordination + `wait-for-completion.sh`

### 1.4 Cron Strategy (8 Jobs)

| Frequency  | Job            | Purpose                 |
| ---------- | -------------- | ----------------------- |
| `*/5 min`  | SRE Monitor    | Coolify, Docker, health |
| `*/30 min` | Memory Sync    | docs → memory index     |
| `3 AM`     | Repo Scan      | SPEC → pipeline.json    |
| `4 AM`     | Code Review    | Auto-review commits     |
| `5 AM`     | Coverage Check | Test coverage           |
| `6 AM`     | Secrets Audit  | Hardcoded scan          |
| `8 AM`     | MCP Health     | Verify MCPs             |

### 1.5 Delegation Hierarchy

```
High-Level:   /execute, /auto-spec, /prd-to-deploy
Mid-Level:    /spec, /pg, /plan
Low-Level:    /ship, /turbo, /sync
Specialized:  /review, /sec, /hg, /img
System:       /rr, /ss, /dv, /rs
```

### 1.6 Anti-Alucinação Pattern (Mandatory Query Order)

1. `.env` → secrets/tokens (se existe, usar `process.env`)
2. `.env.example` → variável documentada?
3. `.claude/skills/` → skill existente?
4. `AGENTS.md` → workflow definido?
5. `.claude/CLAUDE.md` → regra existente?

---

## 2. SPECIFIC RECOMMENDATIONS FOR CLAUDE.md

### 2.1 ADD: Orchestrator Section Documentation

**Current Gap:** `/execute` not documented in CLAUDE.md

**Recommendation:** Add section:

```markdown
## Orchestrator (`/execute`)

Full SPEC → PR pipeline with 14 parallel agents:

| Agent         | Role                | Blocks PR? |
| ------------- | ------------------- | ---------- |
| SPEC-ANALYZER | Extract AC + files  | No         |
| ARCHITECT     | Architecture review | No         |
| CODER-1       | Backend impl        | **YES**    |
| CODER-2       | Frontend impl       | **YES**    |
| TESTER        | Tests               | Warnings   |
| SMOKE         | Smoke tests         | No         |
| SECURITY      | OWASP audit         | No         |
| ...           | ...                 | ...        |

**Commands:**

- `/execute` — Start full pipeline
- `/pg` — Generate pipeline.json from SPEC
- Monitor: `ls tasks/agent-states/`
```

### 2.2 ADD: Skill-that-Calls-Skills Pattern

**Current Gap:** No documented meta-skill pattern

**Recommendation:** Add:

````markdown
## Skill Composition (Meta-Skills)

Skills can call other skills for composition:

### Pattern

```bash
claude --agent /infra-from-spec   # Generate infra from SPEC
claude --agent /backend-scaffold  # Scaffold from infra
```
````

### Meta-Skill Examples

- `/prd-to-deploy`: PRD → SPEC → SUBDOMAIN → FILE_GEN → HUMAN_GATE → DEPLOY
- `/orchestrator`: SPEC → PG → 14 AGENTS → PR

### Skill Dependencies

Document skill → skill dependencies explicitly:

```
researcher → (no deps)
backend-scaffold → researcher
orchestrator → pg, researcher, smoke-test-gen, secrets-audit
prd-to-deploy → new-subdomain, infra-from-spec, deploy-validate
```

### Self-Healing

Skills auto-create when pattern detected:

1. Detect recurring problem
2. Check if skill exists
3. If not: create skill from learnings

````

### 2.3 UPDATE: Cron Section

**Current:** Cron jobs listed by ID + description
**Recommendation:** Expand with dependency matrix:

```markdown
## Cron Jobs (Automated Operations)

| Frequency | Job ID | Purpose | Self-Healing |
|-----------|--------|---------|--------------|
| `*/5 min` | `sre-monitor` | Coolify/Docker health | Creates incidents |
| `*/30 min` | `614f0574` | Memory sync | Updates MEMORY.md |
| `3 AM` | `modo-dormir` | SPEC → pipeline | Updates tasks.md |
| `4 AM` | `code-review` | Commit review | Creates REVIEW-*.md |
| `5 AM` | `coverage` | Coverage check | Alerts if <80% |
| `6 AM` | `secrets-audit` | Secret scan | Blocks push |
| `8 AM` | `mcp-health` | MCP verification | Restarts if needed |

### Cron-Memory Integration
- Cron jobs sync results → memory (`MEMORY.md`)
- Memory stale after 30 min → cron triggers resync
- Idle detection: if no cron activity for 2h → self-orchestration triggers
````

### 2.4 UPDATE: Auto-Orquestration Section

**Current:** Basic self-orchestration logic
**Recommendation:** Add explicit states:

```markdown
## Auto-Orquestration States

### Idle State Detection

When no pending tasks, system checks:

1. `git status --short` — uncommitted changes?
2. Memory freshness — last sync >30 min?
3. `docs/` drift — pending SPEC updates?
4. Cron health — all jobs passing?

### Orchestration States

| State        | Trigger         | Action                |
| ------------ | --------------- | --------------------- |
| IDLE         | No pending work | Check git/docs/memory |
| RESEARCHING  | Question asked  | Invoke /researcher    |
| IMPLEMENTING | Task accepted   | Delegate to coder     |
| REVIEWING    | Code changed    | Invoke /review        |
| DEPLOYING    | PR approved     | Invoke /ship          |
| HEALING      | Error detected  | Self-healing skill    |

### Memory Sync Protocol

After each significant action:

1. Run `sync-memory.sh`
2. Update MEMORY.md index
3. Verify no drift from docs/
```

### 2.5 ADD: Safe Operations Matrix Expansion

```markdown
## Safe Operations Matrix

### By Scope

| Operation      | /srv/monorepo | /srv/ops    | External |
| -------------- | ------------- | ----------- | -------- |
| Code dev       | ✅            | ❌          | N/A      |
| Docker changes | ⚠️ Approval   | ❌          | N/A      |
| ZFS/Snapshot   | ❌            | ⚠️ Approval | N/A      |
| Network/Ports  | ⚠️ Approval   | ❌          | ❌       |
| Secrets        | ❌ Hardcode   | ❌          | ❌       |

### By Risk Level

**✅ No Approval Needed:**

- Read-only operations
- Code development in apps/packages
- Documentation updates
- Test execution
- Git commits/pushes

**⚠️ Requires Approval:**

- Service restart/stop
- Docker compose changes
- Port additions
- Subdomain changes
- Firewall modifications

**❌ Forbidden:**

- Hardcoded secrets
- .env commits
- ZFS destroy/rollback
- Bypass UFW/Traefik
- Direct host modifications
```

### 2.6 ADD: Skill Lifecycle

````markdown
## Skill Lifecycle

### Creation

1. Identify need → recurring pattern or new capability
2. Create `/skills/skill-name/SKILL.md` with YAML frontmatter
3. Add references if needed
4. Test in isolation
5. Document in CLAUDE.md skill index

### Versioning

```yaml
# SKILL.md
version: 1.0.0 # Semantic versioning
changelog:
  - 1.0.0: Initial release
  - 1.1.0: Added /new-command
```
````

### Deprecation

1. Mark as deprecated in SKILL.md
2. Add redirect to replacement skill
3. Archive references in SKILL.md
4. Remove from user-invocable list after 30 days

### Testing

Skills should be tested via:

- Smoke tests in `skills/skill-name/tests/`
- Integration tests with orchestrator
- Manual testing before release

````

---

## 3. CODE EXAMPLES

### 3.1 Orchestrator Execution Flow
```bash
# 1. Create SPEC
/spec "Build user auth with JWT"

# 2. Generate pipeline
/pg

# 3. Execute 14 agents
bash .claude/skills/orchestrator/scripts/run-agents.sh docs/SPECS/SPEC-NNN.md

# 4. Monitor states
ls tasks/agent-states/

# 5. Wait for completion
bash .claude/skills/orchestrator/scripts/wait-for-completion.sh
````

### 3.2 Skill Frontmatter Template

```yaml
---
name: my-skill
description: One-line description
trigger: /my-skill
version: 1.0.0
type: skill
user-invocable: true
allowed-tools:
  - Bash
  - Read
  - Grep
paths:
  - /path/to/relevant/files
---
```

### 3.3 Self-Healing Pattern

```markdown
### Pattern Recognition

1. Read pattern-recognition.md
2. Check if problem is recurring
3. If recurring and no skill exists → create skill

### Skill Auto-Creation

1. Read skill-creation-guide.md
2. Extract learnings from current session
3. Save to correct directory
4. Update CLAUDE.md skill index
```

---

## 4. GAPS IDENTIFIED

| Gap                   | Impact              | Recommendation                    |
| --------------------- | ------------------- | --------------------------------- |
| No skill versioning   | No rollback         | Add semantic versioning per skill |
| No skill testing      | Unclear quality     | Add `tests/` directory per skill  |
| No skill dependencies | Implicit coupling   | Document dependencies explicitly  |
| No skill metrics      | No observability    | Track success/failure rates       |
| Memory system unclear | Incomplete          | Document memory index structure   |
| No cron monitoring    | Silent failures     | Add alerting on job failures      |
| 14-agent untested     | Unknown reliability | Add health dashboard              |

---

## 5. WHAT TO ADD/UPDATE/DELETE

### ADD to CLAUDE.md:

- [ ] `/execute` orchestrator section with 14-agent table
- [ ] Skill-that-calls-skills pattern documentation
- [ ] Skill lifecycle (creation → versioning → deprecation)
- [ ] Expanded safe operations matrix
- [ ] Auto-orchestration states diagram
- [ ] Cron dependency matrix
- [ ] Skill dependency graph

### UPDATE in CLAUDE.md:

- [ ] Cron section → add job dependencies and failure handling
- [ ] Auto-orchestration → expand with explicit states
- [ ] Delegation hierarchy → add skill composition examples
- [ ] Memory sync → add sync protocol
- [ ] Secrets → add skill-specific token access patterns

### DELETE from CLAUDE.md:

- [ ] OpenClaw references (deprecated per SPEC-051)
- [ ] Obsolete command references
- [ ] Duplicate documentation (move to specific skills)

---

## 6. FILES TO MODIFY

| File                              | Action                                                     |
| --------------------------------- | ---------------------------------------------------------- |
| `/srv/monorepo/.claude/CLAUDE.md` | ADD: orchestrator section, skill lifecycle, cron expansion |
| `/srv/monorepo/CLAUDE.md`         | UPDATE: align with local CLAUDE.md patterns                |
| `/srv/monorepo/AGENTS.md`         | UPDATE: add 14-agent patterns, skill composition           |

---

## 7. CONCLUSION

The monorepo has **enterprise-grade CLAUDE.md patterns** already in place. Key strengths:

- 26 skills with standardized structure
- 14-agent parallel execution
- 8 cron jobs for continuous quality
- Multi-level CLAUDE.md hierarchy
- Zero-tolerance secrets governance

**Priority refactors:**

1. **P0:** Document `/execute` orchestrator in CLAUDE.md
2. **P0:** Add skill dependency graph
3. **P1:** Expand cron with failure handling
4. **P1:** Add skill lifecycle documentation
5. **P2:** Add skill versioning

The refactor should focus on **documentation gaps** rather than architectural changes.
