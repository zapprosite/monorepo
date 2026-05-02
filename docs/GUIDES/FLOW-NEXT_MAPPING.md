# Flow-Next to Nexus Command Mapping

> **Created:** 2026-04-25
> **Purpose:** Map Nexus harness commands to Flow-Next equivalents for cross-framework understanding

---

## Overview

| Framework | Entry Point | Architecture | Agents |
|-----------|-------------|--------------|--------|
| **Nexus** | `nexus.sh` | PREVC + vibe-kit (15× parallel) + LangGraph | 49 agents (7 modes × 7 roles) |
| **Flow-Next** | MCP dotcontext `workflow-*` tools | PREVC + MCP harness | 16 agent-native skills (built-in) |

---

## Command Mapping Table

| Nexus Command | Flow-Next Equivalent | Notes |
|--------------|---------------------|-------|
| `nexus.sh --status` | `workflow-status` | Shows current phase, gates, progress |
| `nexus.sh --mode list` | `skill --list` or `agent --listTypes` | List all available modes/skills |
| `nexus.sh --mode <mode>` | `agent --getInfo --agentType <role>` | Show agents for a specific mode |
| `nexus.sh --mode <mode> --agent <name>` | `skill --getContent --skillSlug <slug>` | Show specific agent/skill details |
| `nexus.sh --spec X --phase plan` | `workflow-init` + `context --fill` | Initialize workflow from SPEC |
| `nexus.sh --spec X --phase review` | `workflow-advance` (P→R) + human approval | Phase review gate |
| `nexus.sh --spec X --phase execute` | `workflow-advance` (R→E) + autonomous execution | Launch parallel workers |
| `nexus.sh --spec X --phase verify` | `workflow-advance` (E→V) + sensors | Run quality gates |
| `nexus.sh --spec X --phase complete` | `workflow-advance` (V→C) + `workflow-manage --completeSession` | Finalize and ship |
| `nexus.sh --resume` | `harness --resumeSession` | Resume interrupted workflow |
| `nexus.sh --snapshot` | `harness --checkpoint` + ZFS snapshot | Manual state snapshot |
| `nexus.sh --spec X --phase execute --parallel N` | `workflow-advance --outputs` with multiple agents | Parallel execution |

---

## PREVC Phase Correspondence

| Phase | Nexus | Flow-Next |
|-------|-------|-----------|
| **P** (Plan) | `nexus.sh --spec X --phase plan` | `workflow-init` + `skill --feature-breakdown` |
| **R** (Review) | `nexus.sh --spec X --phase review` | `agent --orchestrate --phase R` + approval gate |
| **E** (Execute) | `nexus.sh --phase execute --parallel 15` | `workflow-advance` + parallel agents |
| **V** (Verify) | `nexus.sh --phase verify` | `workflow-advance` + sensors (test, lint, build) |
| **C** (Complete) | `nexus.sh --phase complete` | `workflow-manage --completeSession` |

---

## Agent/Skill Mapping

### Nexus debug mode ↔ Flow-Next

| Nexus Agent | Flow-Next Skill | Notes |
|-------------|-----------------|-------|
| `log-diagnostic` | `bug-investigation` | Log analysis + pattern detection |
| `stack-trace` | `bug-investigation` | Root cause analysis |
| `perf-profiler` | `code-review` (perf aspects) | Performance review |
| `security-scanner` | `security-audit` | Vulnerability detection |
| `incident-response` | `bug-investigation` | Troubleshooting flow |

### Nexus test mode ↔ Flow-Next

| Nexus Agent | Flow-Next Skill | Notes |
|-------------|-----------------|-------|
| `unit-tester` | `test-generation` | Unit test generation |
| `coverage-analyzer` | Sensors: `test` + `typecheck` | Coverage thresholds |
| `boundary-tester` | `test-generation` (edge cases) | Edge case testing |
| `flaky-detector` | `bug-investigation` | Test reliability issues |

### Nexus review mode ↔ Flow-Next

| Nexus Agent | Flow-Next Skill | Notes |
|-------------|-----------------|-------|
| `correctness-reviewer` | `code-review` | Logic errors, spec adherence |
| `security-reviewer` | `security-audit` | OWASP, secrets |
| `architecture-reviewer` | `code-review` + `api-design` | Dependencies, layers |
| `quality-scorer` | `pr-review` | Aggregate scoring |

### Nexus docs mode ↔ Flow-Next

| Nexus Agent | Flow-Next Skill | Notes |
|-------------|-----------------|-------|
| `api-doc-writer` | `api-design` | OpenAPI specs |
| `readme-writer` | `documentation` | README, guides |
| `changelog-writer` | `commit-message` | Release notes |
| `adr-writer` | `documentation` | Architecture decisions |

### Nexus backend mode ↔ Flow-Next

| Nexus Agent | Flow-Next Skill | Notes |
|-------------|-----------------|-------|
| `api-developer` | `api-design` | REST/GraphQL APIs |
| `db-migrator` | `feature-breakdown` | Schema migrations |
| `auth-engineer` | `security-audit` | Authentication patterns |
| `cache-specialist` | `code-review` | Caching patterns |

### Nexus frontend mode ↔ Flow-Next

| Nexus Agent | Flow-Next Skill | Notes |
|-------------|-----------------|-------|
| `component-dev` | `code-review` | UI components |
| `a11y-auditor` | `code-review` | Accessibility |
| `perf-optimizer` | `code-review` | Core Web Vitals |

### Nexus deploy mode ↔ Flow-Next

| Nexus Agent | Flow-Next | Notes |
|-------------|-----------|-------|
| `docker-builder` | N/A | No direct Flow-Next equivalent |
| `coolify-deployer` | N/A | No direct Flow-Next equivalent |
| `zfs-snapshotter` | `harness --checkpoint` | Snapshot coordination |
| `health-checker` | Sensors: `build`, `test` | Health endpoints |

---

## Flow-Next Unique Capabilities (Not in Nexus)

### 1. Re-anchoring
Flow-Next supports **re-anchoring** — the ability to re-establish context at any point in the workflow. If a worker loses context or a session degrades, Flow-Next can re-anchor to a known-good checkpoint without restarting the entire workflow.

**Nexus equivalent:** Requires manual `--resume` from last checkpoint; no dynamic re-anchoring during execution.

### 2. Cross-Model Review
Flow-Next supports **cross-model review** — reviewing outputs across different LLM models to detect model-specific artifacts or biases.

**Nexus equivalent:** Not available; Nexus workers use the same model configuration per run.

### 3. Zero External Dependencies
Flow-Next runs with **zero external dependencies** — no ZFS requirement, no filesystem state files, no external queue processing. All state is managed via MCP tools.

**Nexus equivalent:** Requires ZFS for snapshots, filesystem for `queue.json`/`state.json`, external `vibe-kit.sh` for execution loop.

### 4. 16 Agent-Native Skills
Flow-Next has **16 built-in skills** that are agent-native (loaded and usable without external configuration):

| Skill | Phase | Description |
|-------|-------|-------------|
| `api-design` | P, R | RESTful API design |
| `bug-investigation` | E, V | Systematic bug investigation |
| `code-review` | R, V | Code quality review |
| `commit-message` | E, C | Conventional commit generation |
| `commit-message` | E, C | Commit message generation |
| `documentation` | P, C | Technical documentation |
| `feature-breakdown` | P | Feature decomposition |
| `pr-review` | R, V | Pull request review |
| `refactoring` | E | Safe refactoring |
| `security-audit` | R, V | Security checklist |
| `test-generation` | E, V | Test case generation |
| `bug-investigation` | E, V | Root cause analysis |
| `code-review` | R, V | Code patterns review |
| `documentation` | P, C | Doc generation |
| `pr-review` | R, V | PR standards |
| `refactoring` | E | Step-by-step refactor |

**Nexus equivalent:** 49 agents but requires external agent definitions (`system-prompt.md` files); not self-contained.

---

## Key Architectural Differences

| Aspect | Nexus | Flow-Next |
|--------|-------|-----------|
| **State Storage** | Filesystem (`queue.json`, `state.json`) | MCP dotcontext (durable sessions) |
| **Parallel Execution** | 15× vibe-kit workers (external) | Built-in parallel orchestration |
| **Snaphots** | ZFS (requires ZFS pool) | MCP checkpoints (storage-agnostic) |
| **Agent Definitions** | External `system-prompt.md` files | Built-in skills with playbooks |
| **Human Gates** | Blocking `read -p` prompts | Formal approval via `workflow-advance` |
| **Cross-Model Review** | Not available | Supported via MCP agent orchestration |
| **Re-anchoring** | Not available | Supported via session checkpointing |
| **External Dependencies** | ZFS, vibe-kit.sh, jq, bash | None (MCP-only) |

---

## Interoperability Notes

### Running Nexus within Flow-Next
Flow-Next can invoke Nexus as a subprocess:
```bash
# Flow-Next executes Nexus for ZFS snapshot coordination
bash /srv/monorepo/.claude/vibe-kit/nexus.sh --snapshot
```

### Running Flow-Next within Nexus
Nexus workers can use Flow-Next MCP tools for enhanced state management:
```json
{
  "to": "workflow-manage",
  "action": "checkpoint",
  "notes": "Mid-execution checkpoint",
  "artifactIds": ["/artifacts/T005/output.json"]
}
```

### Unified Workflow Suggestion
For maximum capability:
1. **Plan:** Use Flow-Next (`workflow-init` + `feature-breakdown`)
2. **Review:** Use Nexus review agents OR Flow-Next `pr-review`
3. **Execute:** Use Nexus 15× parallel workers with Flow-Next checkpointing
4. **Verify:** Use Flow-Next sensors + Nexus verify phase
5. **Complete:** Use Flow-Next `workflow-manage --completeSession`

---

## References

- Nexus entry point: `/srv/monorepo/.claude/vibe-kit/nexus.sh`
- Nexus SPEC: `/srv/monorepo/docs/SPEC-204.md`
- Nexus Guide: `/srv/monorepo/docs/NEXUS_GUIDE.md`
- Flow-Next harness: MCP dotcontext `workflow-*` tools
- Flow-Next skills: 10 built-in skills (see `mcp__dotcontext__skill --list`)
