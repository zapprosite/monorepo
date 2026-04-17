# RESEARCH-4: Skill-that-Calls-Skills Patterns

**Date:** 2026-04-17
**Agent:** RESEARCH-4
**Focus:** Meta-skills that orchestrate other skills, skill composition patterns

---

## 1. Key Findings (April 2026 Best Practices)

### 1.1 Orchestrator Pattern (`/execute`)

The `orchestrator` skill demonstrates the **parallel composition** pattern:

```bash
# run-agents.sh spawns 14 agents in parallel
declare -a AGENTS=(
  "SPEC-ANALYZER:claude:/researcher"
  "ARCHITECT:claude:/infra-from-spec"
  "CODER-1:claude:/backend-scaffold"
  ...
  "SHIPPER:claude:/turbo"  # Waits for all others
)
```

**Key characteristics:**

- Coordination via filesystem (`tasks/agent-states/*.json`)
- Agent wrapper handles claim → execute → mark done lifecycle
- SHIPPER agent waits for all others via `wait-for-completion.sh`
- State files track: agent, spec, status, started, finished, exit_code

### 1.2 Sequential Composition Pattern (`prd-to-deploy`)

The `prd-to-deploy` skill chains phases sequentially:

```
PARSE_PRD → SPEC → SUBDOMAIN_CREATION → FILE_GENERATION
          → HUMAN_GATE → DEPLOY → SMOKE_TEST → DOCS_UPDATE → /turbo
```

**Key characteristics:**

- Each phase may call a sub-skill or execute inline
- Human gate pauses flow for user interaction
- Error recovery per phase
- Prints OAuth URI BEFORE any work (user configures while AI works)

### 1.3 Skill Invocation Patterns

| Pattern           | How                  | Example                       |
| ----------------- | -------------------- | ----------------------------- |
| **Slash command** | `/skill-name`        | `/spec`, `/pg`, `/execute`    |
| **Bash script**   | `bash script.sh`     | `agent-wrapper.sh`            |
| **Inline code**   | `claude -p "prompt"` | Research agents via `-p` flag |
| **Conditional**   | Check before invoke  | "If subdomain exists: skip"   |

### 1.4 SKILL.md Frontmatter Standard

```yaml
---
name: skill-name
description: One-line description
trigger: /slash-command # optional: for user-invocable skills
user-invocable: true # optional
disable-model-invocation: false # optional
allowed-tools: # optional: restrict tool access
  - Bash
  - Read
  - Grep
paths: # optional: paths to include in context
  - ~/.claude/skills/skill/**
version: 1.0.0
type: skill # required
---
```

### 1.5 Bounded Context Pattern

Every skill explicitly declares what it does AND doesn't do:

```markdown
## Bounded Context

**Faz:**

- SPEC → PR completo em 14 agentes paralelos
- Coordenação via filesystem (agent-states/)
- Error handling com SHIPPER como decisor final

**Nao faz:**

- Substituir CI/CD do Gitea (smoke tests, deploys)
- Auto-healing de serviços
- Operações de infra (Coolify, Terraform)
```

---

## 2. Specific Recommendations for CLAUDE.md/AGENTS.md

### 2.1 Add Meta-Skill Documentation Section

**Location:** CLAUDE.md, after "Specflow" section

**Add:**

```markdown
## Skill Composition (Meta-Skills)

Skills that orchestrate other skills follow these patterns:

### Sequential Composition

Phase-based workflow: `prd-to-deploy`
```

PHASE_1 → PHASE_2 → ... → HUMAN_GATE → FINAL

```

### Parallel Composition
14-agent orchestrator: `/execute`
```

bash run-agents.sh → 14 agents in parallel
→ wait-for-completion.sh
→ SHIPPER creates PR

```

### Skill Delegation Rules
1. **Check before invoke:** If work is done, skip the skill
2. **State via filesystem:** Agent states in `tasks/agent-states/`
3. **Error escalation:** SHIPPER is the final decision-maker
4. **Bounded context:** Always declare what the skill does AND doesn't do

### Known Meta-Skills
| Skill | Type | Invokes |
|-------|------|---------|
| `/execute` | Parallel | 14 agents via `run-agents.sh` |
| `/prd-to-deploy` | Sequential | `/spec`, `/new-subdomain`, `/turbo` |
| `/orchestrator` | Parallel | All skills via agent states |
```

### 2.2 Document Skill Trigger Patterns

**Add to AGENTS.md skills table:**

```markdown
| Skill         | Type | Pattern                                  |
| ------------- | ---- | ---------------------------------------- |
| orchestrator  | meta | Parallel composition (14 agents)         |
| prd-to-deploy | meta | Sequential composition (8 phases)        |
| self-healing  | meta | Loop composition (detect → create skill) |
```

### 2.3 Anti-Pattern: Skill Chain Loops

**Avoid:** Infinite skill chains where A calls B calls A

The `self-healing` skill avoids this by:

- Creating new skills (not re-invoking existing ones)
- Using memory to track patterns
- Bounded iteration (max 3 attempts before alerting)

---

## 3. Code/Examples

### 3.1 Agent Wrapper Pattern (skill-that-calls-skills via CLI)

```bash
# agent-wrapper.sh — wraps a Claude Code invocation
AGENT_ID="$1"
COMMAND="$2"
SPEC_FILE="$3"

TASK_PROMPT="You are the $AGENT_ID agent...
YOUR RESEARCH FOCUS: $COMMAND
Output your findings to: $ROOT_DIR/research/${AGENT_ID}.md"

echo "$TASK_PROMPT" | claude -p 2>&1 | tee "$LOG_FILE"
```

### 3.2 Phase-Based Skill with Human Gate

```bash
# prd-to-deploy Phase 4: HUMAN_GATE
echo "Press ENTER when you've added the OAuth redirect URIs..."
read -r response
if [[ "$response" != "y" && "$response" != "Y" ]]; then
  # Re-print OAuth URI and wait again
  print_oauth_uri
  goto HUMAN_GATE
fi
```

### 3.3 Skill Reference Pattern

```markdown
## Como executar

1. Leia patterns.md para estrutura base
2. Leia error-handling.md para tratamento de erros
3. Se rota protegida: leia auth-patterns.md
```

### 3.4 State-Based Coordination

```bash
# tasks/agent-states/SPEC-ANALYZER.json
{
  "agent": "SPEC-ANALYZER",
  "spec": "042",
  "status": "running",  # running | completed | failed
  "started": "2026-04-17T10:00:00Z",
  "finished": null,
  "command": "/researcher",
  "log": ".claude/skills/orchestrator/logs/SPEC-ANALYZER.log"
}
```

---

## 4. What to Add/Update/Delete

### ADD to CLAUDE.md

1. **Skill Composition section** (after Specflow)
   - Sequential vs parallel composition patterns
   - Skill delegation rules
   - Known meta-skills table

2. **Orchestrator command documentation** (`/execute`)
   - 14-agent parallel execution flow
   - Agent state coordination
   - Error handling hierarchy

### ADD to AGENTS.md

1. **Meta-skill type** in skills table
   - Classify: `orchestrator`, `prd-to-deploy`, `self-healing` as `meta`

2. **Skill composition best practices**
   - Bounded context requirement
   - State management via filesystem
   - Human gate pattern

### UPDATE existing skills

1. **`/execute` orchestrator`**
   - Add clearer error recovery per agent type
   - Document bounded context explicitly

2. **`prd-to-deploy`**
   - Already excellent — minor cleanup of references

3. **`self-healing`**
   - Consider adding max iteration guard (prevent loops)

### DELETE (not applicable)

No deletions recommended — all skills serve distinct purposes.

---

## 5. Summary

**Skill-that-calls-skills is production-ready in this codebase.**

The patterns are:

1. **Orchestrator** (parallel): 14 agents, filesystem coordination, SHIPPER finalizer
2. **Sequential** (prd-to-deploy): 8 phases, human gate, error recovery per phase
3. **Self-healing** (loop): detect pattern → create skill (not recursive call)

**Key principles:**

- Bounded context: always declare what you DON'T do
- State via filesystem: enables parallel execution coordination
- Human gates: pause for user input in sequential flows
- Skill reference files: split long skills into referenced sub-files

**For CLAUDE.md/AGENTS.md:** Add a "Skill Composition" section documenting these patterns with the orchestrator and prd-to-deploy as canonical examples.
