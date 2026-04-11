# Cursor Loop Agent System Audit

**Date:** 2026-04-11
**Auditor:** Claude Code autonomous audit
**Scope:** `/srv/monorepo/.claude/agents/`, `.agent/`, workflows, scripts, SPECs

---

## 1. Agent Inventory

All 10 Cursor Loop agents are defined in `.claude/agents/` (not `.agent/agents/`).

### 1.1 cursor-loop-leader

| Attribute | Value |
|-----------|-------|
| **Purpose** | Orchestrator — checks Infisical secrets, validates env vars, coordinates all other agents |
| **Model** | `cm` (MiniMax M2.7) |
| **Invocation** | Auto-invoked by `cursor-loop-runner.sh` or `/cursor-loop` command |
| **Tools** | Read (pipeline-state.json, tasks/pipeline.json), Bash (bootstrap-check.sh) |
| **State** | Reads `currentState`, `retryCount`, `humanGateRequired` from `tasks/pipeline-state.json` |
| **Communication** | Emits Bootstrap Effect JSON to stdout; delegates to sub-agents |
| **Decision matrix** | `IDLE` → next task; `TEST_FAILED` → debug; `READY_TO_SHIP` → ship; `BLOCKED_HUMAN_REQUIRED` → STOP |

### 1.2 cursor-loop-giteaai

| Attribute | Value |
|-----------|-------|
| **Purpose** | Push branch to Gitea, trigger CI pipeline, poll for PASS/FAIL |
| **Model** | `cm` |
| **Invocation** | Called by leader agent after Infisical check |
| **Tools** | Bash (`git push gitea`), Gitea API via `gh` CLI |
| **State** | Reports PASS/FAIL back to leader via pipeline-state.json |
| **Communication** | Branch → Gitea Actions → status polled via API |

### 1.3 cursor-loop-research

| Attribute | Value |
|-----------|-------|
| **Purpose** | Analyze CI failure root cause using web research |
| **Model** | `cm` |
| **Invocation** | When CI fails; parallel-5 agents in research loop |
| **Tools** | MCP Tavily (web search), MCP Context7 (docs fetch) |
| **State** | Writes findings to `.cursor-loop/logs/research-TIMESTAMP.md` |
| **Output schema** | `{ root_cause, solutions: [{source, url, solution, confidence}], recommended_fix }` |
| **Communication** | Output consumed by cursor-loop-refactor |

### 1.4 cursor-loop-refactor

| Attribute | Value |
|-----------|-------|
| **Purpose** | Apply code fixes based on research findings |
| **Model** | `cm` |
| **Invocation** | After research completes |
| **Tools** | Read (research logs), Edit, Bash (test re-run) |
| **State** | Reads research output; updates code; loops back to CI |
| **Communication** | Signals leader to re-run CI after fix |

### 1.5 cursor-loop-spec

| Attribute | Value |
|-----------|-------|
| **Purpose** | Update SPEC.md when code changes; document decisions |
| **Model** | `cm` |
| **Invocation** | After refactor completes |
| **Tools** | Read (refactored code), Write (SPEC-*.md) |
| **State** | Syncs with pipeline-state.json |
| **Communication** | Writes decisions log; notifies leader |

### 1.6 cursor-loop-debug

| Attribute | Value |
|-----------|-------|
| **Purpose** | Run systematic debugging on failing code |
| **Model** | `cm` |
| **Invocation** | When `currentState = "TEST_FAILED"` |
| **Tools** | Bash (`yarn test --reporter=verbose`, `bunx tsc --noEmit`, `yarn lint`) |
| **State** | Appends debug output to log |
| **Output** | Structured fix recommendations: `{file, line, issue, fix, confidence}` |

### 1.7 cursor-loop-ship

| Attribute | Value |
|-----------|-------|
| **Purpose** | Stage → semantic commit → push → create PR |
| **Model** | `cm` |
| **Invocation** | After CI PASS and before mirror |
| **Tools** | Bash (`git add -A`, `git commit`, `git push --force-with-lease gitea HEAD`, `gh pr create`) |
| **Safety** | Uses `--force-with-lease` (never `--force`); includes `Co-Authored-By` |
| **Never does** | Commit directly to `main`; generic commit messages |

### 1.8 cursor-loop-review

| Attribute | Value |
|-----------|-------|
| **Purpose** | AI code review — posts inline comments, blocks on critical |
| **Model** | `cm` |
| **Invocation** | After PR created |
| **Tools** | `gh pr diff`, `gh pr comment` |
| **5-axis review** | Correctness, Readability, Architecture, Security, Performance |
| **Severity** | Critical = blocks merge; Important = must fix; Suggestion = consider |
| **Communication** | Posts comments via MCP GitHub/Gitea |

### 1.9 cursor-loop-sync

| Attribute | Value |
|-----------|-------|
| **Purpose** | Trigger ai-context-sync after PR merge |
| **Model** | `cm` |
| **Invocation** | After ship + review |
| **Tools** | Bash (`~/.claude/mcps/ai-context-sync/sync.sh`) |
| **State** | Logs to `/srv/ops/logs/healing.log`; updates MEMORY.md index |
| **Communication** | Notifies leader sync complete |

### 1.10 cursor-loop-mirror

| Attribute | Value |
|-----------|-------|
| **Purpose** | Merge PR to main, push to both remotes (Gitea + GitHub), create new random branch |
| **Model** | `cm` |
| **Invocation** | After ship + sync |
| **Tools** | Bash (`git checkout main`, `git merge --no-ff`, `git push` x2) |
| **Branch name format** | `[adjective]-[noun]-[hex]` — e.g., `quantum-dispatch-a7k2p` |
| **Adjective list** | quantum, iron, stellar, neon, silent, rust, chrome, void, async, oracle |
| **Noun list** | dispatch, codex, sentinel, pivot, reactor, signal, prism, vector, guard, oracle |

---

## 2. Directory Structure

### `.claude/agents/` (Monorepo local agents — 10 Cursor Loop agents)

```
/srv/monorepo/.claude/agents/
├── architect-specialist.md
├── backend-specialist.md
├── bug-fixer.md
├── code-reviewer.md
├── cursor-loop-debug.md              ✅
├── cursor-loop-giteaai.md            ✅
├── cursor-loop-leader.md             ✅
├── cursor-loop-mirror.md             ✅
├── cursor-loop-refactor.md           ✅
├── cursor-loop-research.md           ✅
├── cursor-loop-review.md             ✅
├── cursor-loop-ship.md              ✅
├── cursor-loop-spec.md              ✅
├── cursor-loop-sync.md              ✅
├── database-specialist.md
├── debugger.md
├── devops-specialist.md
├── documentation-writer.md
├── feature-developer.md
├── frontend-specialist.md
├── implementer.md
├── mcp-operator.md
├── mobile-specialist.md
├── orchestrator.md
├── performance-optimizer.md
├── planner.md
├── refactoring-specialist.md
├── researcher.md
├── reviewer.md
├── security-auditor.md
└── test-writer.md
```
NOTE: `README.md` does NOT exist in `.claude/agents/` (but is referenced in SPEC-021)

### `.agent/agents/` (Antigravity Kit agents — 30 agents, reference only)

```
/srv/monorepo/.agent/agents/
├── architect-specialist.md
├── backend-specialist.md
├── bug-fixer.md
├── code-reviewer.md
├── cursor-loop-*.md  (9 files listed but DO NOT EXIST on disk)
├── database-specialist.md
├── debugger.md
├── devops-specialist.md
├── documentation-writer.md
├── feature-developist.md
├── frontend-specialist.md
├── implementer.md
├── mcp-operator.md
├── mobile-specialist.md
├── orchestrator.md
├── performance-optimizer.md
├── planner.md
├── refactoring-specialist.md
├── researcher.md
├── reviewer.md
├── security-auditor.md
└── test-writer.md
```
NOTE: cursor-loop-* files listed in `.agent/agents/` DO NOT EXIST on disk. The real agents are in `.claude/agents/`.

### `.claude/commands/`

```
/srv/monorepo/.claude/commands/
├── cursor-loop.md    ✅ Main loop invocation command
├── feature.md
├── img.md
├── mirror.md
├── pg.md
├── scaffold.md
├── sync.md
├── turbo.md
└── update-docs.md
```

### `.claude/workflows/` (Claude Code native workflows)

```
/srv/monorepo/.claude/workflows/
├── code-review-workflow.md
├── debug.md
└── ui-ux-pro-max.md
```

### `.agent/workflows/` (Antigravity Kit workflows)

```
/srv/monorepo/.agent/workflows/
├── GIT-WORKFLOWS.md
├── examples/pipeline-crm.yaml
├── git-feature.md
├── git-mirror-gitea-github.md     ✅ Used by cursor-loop-mirror
├── git-ship.md                    ✅ Used by cursor-loop-ship
├── git-turbo.md
├── scaffold.md
└── sincronizar-tudo.md
```

### Scripts

```
/srv/monorepo/scripts/
├── cursor-loop-runner.sh           ✅ Main orchestrator (bash)
├── cursor-loop-research.sh         ✅ Context7/Tavily research
├── cursor-loop-refactor.sh         ✅ Auto-fix based on research
├── approve.sh                     ✅ Human gate approval
├── query-gate.sh                  ✅ Query pipeline state
├── pipeline-state.sh              ✅ CRUD for pipeline-state.json
├── bootstrap-check.sh             ✅ Secrets verification + Bootstrap Effect
└── bootstrap-effect.sh             ✅ Format Bootstrap Effect for display
```

---

## 3. Orchestration Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    SPEC created by human                      │
│                 (or /spec command via skill)                 │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  [1] CURSOR LOOP LEADER                                        │
│      ├── Read tasks/pipeline.json                              │
│      ├── Check Infisical secrets (Python SDK direct)           │
│      ├── Validate env vars consistency                          │
│      ├── Bootstrap Effect if gaps → STOP + human action       │
│      └── Coordinate 10 agents                                  │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  [2] CURSOR LOOP GITEAi                                         │
│      ├── git push gitea feat/<branch>                           │
│      └── Trigger Gitea Actions CI pipeline                      │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  [3] TEST GATE (Gitea CI — ci-feature.yml)                     │
│      ├── pnpm install --frozen-lockfile                         │
│      ├── pnpm audit --level high                               │
│      ├── pnpm check-types                                      │
│      ├── pnpm build                                            │
│      └── pnpm test                                             │
└─────────────────────────────────────────────────────────────────┘
                            │
                    ┌───────┴───────┐
                    │               │
                 PASS              FAIL
                    │               │
                    ▼               ▼
            ┌──────────┐    ┌───────────────────────────────────┐
            │  [4]     │    │  [5] RESEARCH + REFACTOR LOOP    │
            │  SHIP +  │    │                                   │
            │  SYNC    │    │  5 agents in parallel:            │
            │          │    │  1. cursor-loop-research         │
            │  Ship    │    │  2. cursor-loop-refactor         │
            │  Review  │    │  3. cursor-loop-spec             │
            │  Sync    │    │  4. cursor-loop-debug            │
            │  Mirror  │    │  5. cursor-loop-leader           │
            │          │    │                                   │
            │          │    │  Loop back to [2]                 │
            └──────────┘    └───────────────────────────────────┘
```

### Phase [4] Detail: Ship + Sync + Mirror

```
cursor-loop-ship
    ├── git add -A
    ├── semantic commit (Co-Authored-By)
    ├── git push --force-with-lease gitea HEAD
    └── gh pr create --title "[commit]" --body "## Summary..."

cursor-loop-review
    ├── gh pr diff
    ├── 5-axis review (Correctness/Readability/Architecture/Security/Performance)
    ├── gh pr comment (inline comments)
    └── APPROVE | REQUEST_CHANGES | COMMENT

cursor-loop-sync
    ├── ~/.claude/mcps/ai-context-sync/sync.sh
    └── Log to /srv/ops/logs/healing.log

cursor-loop-mirror
    ├── git checkout main && git merge --no-ff
    ├── git push gitea main && git push github main
    └── git checkout -b feature/[adjective]-[noun]-[hex]
```

### CI/CD Pipeline (Gitea Actions)

**ci-feature.yml** — Runs on every push to non-main branch:
```
pnpm install --frozen-lockfile
pnpm audit --level high
pnpm check-types
pnpm biome check .
pnpm build
pnpm test
```

**deploy-main.yml** — Runs on merge to main (3-stage human-gated deploy):
```
Stage 1: build-and-test (always runs)
Stage 2: human-gate (Gitea environment protection — must approve in UI)
Stage 3: deploy to Coolify + smoke test + rollback on failure
```

---

## 4. Integration Points

### 4.1 Gitea

| Integration | Method |
|-------------|--------|
| Trigger CI | `git push gitea feat/<branch>` |
| Poll CI status | `gh run watch` or Gitea API via `curl` |
| Create PR | `gh pr create` |
| Post review comments | `gh pr comment` |

### 4.2 Coolify

| Integration | Method |
|-------------|--------|
| Trigger deploy | `curl -X POST $COOLIFY_URL/api/v1/applications/$UUID/deploy` |
| Poll deploy status | `curl $COOLIFY_URL/api/v1/applications/$UUID` |
| Health check | `curl -s http://localhost:4004/_stcore/health` |

**Known issue:** Coolify Bearer token can fail with 401 — nginx intercepts and requires authenticated session. Workaround: add IP to AllowList at coolify.zappro.site/settings/allowlist.

### 4.3 Cloudflare / Terraform

Cloudflare DNS updates via Terraform are referenced in SPEC-021 but **NOT actually integrated** into the cursor-loop runner script. The `cloudflare-terraform` skill exists (`.claude/skills/cloudflare-terraform/SKILL.md`) but is not called by any cursor-loop script.

### 4.4 Infisical

Used via Python SDK directly (not as MCP) for 144 secrets. Bootstrap-check.sh validates:
- COOLIFY_URL
- COOLIFY_API_KEY
- GITEA_TOKEN
- CLAUDE_API_KEY

### 4.5 MCPs

| MCP | Status | Used By |
|-----|--------|---------|
| openwebui | ✅ Configured | Not used by cursor-loop |
| ai-context-sync | ✅ Script | cursor-loop-sync |
| context7 | ✅ Rule | cursor-loop-research |
| coolify (npm package) | ⚠️ Not installed | — |
| gitea (npm package) | ⚠️ Not installed | — |
| taskmaster-ai | ❌ Not installed | — |
| Tavily | ⚠️ API key missing | cursor-loop-research (planned) |
| Infisical | ⚠️ Python SDK | bootstrap-check.sh |

### 4.6 Grafana + Auto-healer (Monitoring Stack)

The monitoring/healing stack (SPEC-023) operates **independently** from the cursor-loop:
- **Prometheus** scrapes node-exporter, cadvisor, nvidia-gpu-exporter
- **AlertManager** sends alerts to Telegram
- **docker-autoheal** restarts failed containers
- **health_agent.sh** runs on cron

No integration exists where Grafana alerts or auto-healer events trigger a new cursor-loop iteration.

---

## 5. Loop Lifecycle Analysis

### 5.1 Where Does the Loop START?

1. **Human-initiated:** Developer runs `bash scripts/cursor-loop-runner.sh` or `/cursor-loop`
2. **SPEC-driven:** SPEC created via `/spec` skill
3. **Gitea webhook:** Push to feature branch triggers ci-feature.yml (but this is passive — no automatic loop start)

**Current branch:** `feature/quantum-dispatch-ax7k2` (from gitStatus)

### 5.2 Where Does it END?

Loop terminates when:
- All phases pass → `READY_TO_SHIP` → ship + sync + mirror → new random branch created → **IDLE**
- `humanGateRequired = true` → waits for `bash scripts/approve.sh --approve`
- `retryCount >= maxRetries` → **BLOCKED_HUMAN_REQUIRED**
- `iterationCount >= maxIterations` (default 10) → stops and reports

### 5.3 Feedback Mechanism

| Mechanism | Source | Loop reaction |
|-----------|--------|---------------|
| CI PASS/FAIL | Gitea Actions API | FAIL → research+refactor loop |
| Pipeline state | `tasks/pipeline-state.json` | State transitions drive decisions |
| Bootstrap Effect | bootstrap-check.sh output | Gaps → stop + emit JSON |
| Human gate | `humanGateRequired` flag | true → pause + poll |
| Retry exhaustion | `retryCount >= maxRetries` | Block + request unblock |

### 5.4 What Breaks the Loop?

| Failure | Break condition | Recovery |
|---------|-----------------|----------|
| Infisical secrets missing | COOLIFY_URL, COOLIFY_API_KEY not in vault | Bootstrap Effect → human sets secrets |
| CI test failure | Exit code != 0 from `pnpm test` | Research loop (3 iterations max) |
| Gitea API failure | `gh` command fails or 401 | Retry with exponential backoff |
| Coolify deploy fails | HTTP non-200/201 | Rollback to previous commit |
| Human gate timeout | No approval after polling | Pipeline stays blocked |
| Research loop exhaustion | 3 iterations without fix | BLOCKED_HUMAN_REQUIRED |

### 5.5 What's NOT in the Loop but SHOULD be?

| Missing piece | Severity | Description |
|--------------|----------|-------------|
| **Terraform/Cloudflare DNS** | HIGH | Cloudflare DNS updates are NOT part of the loop runner. SPEC-021 step [5] "Cloudflare DNS (terraform)" is listed but no script invokes it |
| **ZFS snapshot before changes** | HIGH | CONTRATO violation — no snapshot created before code modifications in the loop |
| **Auto-healer integration** | MEDIUM | SPEC-023 auto-healer runs independently; no feedback to cursor-loop on healing events |
| **Coolify MCP not installed** | MEDIUM | `coolify-mcp` npm package planned but not installed; Coolify API calls are raw curl |
| **Gitea MCP not installed** | MEDIUM | `gitea-mcp` npm package planned but not installed; `gh` CLI used instead |
| **Tavily MCP with missing API key** | MEDIUM | Research agent requires TAVILY_API_KEY in Infisical |
| **Monitoring alerts → loop trigger** | LOW | Grafana/Prometheus alerts don't trigger new cursor-loop iterations |
| **taskmaster-ai MCP** | LOW | Not installed; leader agent reads pipeline-state.json directly as fallback |
| **Promail → Grafana Alloy migration** | LOW | SPEC-023: Promail EOL March 2026 → Grafana Alloy migration not executed |

---

## 6. Map: The Autonomous Loop

```
                          ┌──────────────────┐
                          │   SPEC created   │
                          │   (human or /spec)│
                          └────────┬────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────┐
│  [1] LEADER: Infisical Check + pipeline-state read           │
│      └── tasks/pipeline.json, tasks/pipeline-state.json     │
└──────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────┐
│  [2] GITEAi: git push gitea + trigger Gitea Actions CI       │
│      └── ci-feature.yml (typecheck, lint, build, test)      │
└──────────────────────────────────────────────────────────────┘
                                   │
                            ┌──────┴──────┐
                            │  CI Result  │
                            └──────┬──────┘
                      PASS ────────┼─────── FAIL
                      │           │           │
                      │           │           ▼
                      │           │    ┌─────────────────────┐
                      │           │    │ [3] RESEARCH LOOP   │
                      │           │    │ (max 3 iterations)  │
                      │           │    │                     │
                      │           │    │ research (Tavily+    │
                      │           │    │   Context7)         │
                      │           │    │ refactor (apply fix)│
                      │           │    │ spec (update docs) │
                      │           │    │ debug (fix recs)   │
                      │           │    │ leader (coordinate)│
                      │           │    └──────────┬──────────┘
                      │           │               │
                      │           │          loop to [2]
                      │           │               │
                      ▼           ▼               │
               ┌─────────────────────────┐       │
               │ [4] SHIP + SYNC + MIRROR │       │
               │                         │       │
               │ ship: git add→commit   │       │
               │       → push → PR      │       │
               │ review: 5-axis review  │       │
               │ sync: ai-context-sync  │       │
               │ mirror: merge → x2    │       │
               │        → new branch   │       │
               └──────────┬──────────────┘       │
                          │                       │
                          ▼                       │
               ┌─────────────────────────┐       │
               │ [5] Gitea Actions CI    │       │
               │ (deploy-main.yml)       │       │
               │                         │       │
               │  stage 1: build+test    │       │
               │  stage 2: human gate   │◄──────┘ (if blocked)
               │  stage 3: Coolify      │       │
               │         deploy+smoke   │       │
               └──────────┬──────────────┘       │
                          │                       │
                          ▼                       │
               ┌─────────────────────────┐       │
               │ [6] COOLIFY DEPLOY      │       │
               │ (via API Bearer token)  │       │
               └──────────┬──────────────┘       │
                          │                      ▼
          ┌──────────────────────────────┐  ┌─────────────────────────┐
          │ [MISSING] Terraform apply   │  │ [EXTERNAL] Grafana +    │
          │ Cloudflare DNS update       │◄─┤ Prometheus + AlertMgr  │
          └──────────┬──────────────────┘  │ docker-autoheal        │
                     │                     │ (SPEC-023, independent) │
                     ▼                     └─────────────────────────┘
          ┌──────────────────────────────┐
          │ [MISSING] ZFS snapshot      │
          │ before code changes         │◄── CONTRATO violation
          └────────────────────────────┘
```

---

## 7. Key Findings

### Finding 1: Two agent directory sources cause confusion

- **Real agents:** `.claude/agents/` (10 cursor-loop-* agents)
- **Antigravity Kit reference:** `.agent/agents/` (30 agents including cursor-loop variants that don't exist on disk)

SPEC-021 mentions `.agent/agents/` but those files are not present. The `.claude/agents/` are the authoritative source.

### Finding 2: Terraform is NOT in the loop

Step [5] of SPEC-021 architecture diagram shows "Cloudflare DNS (terraform)" but no script invokes Terraform. The `cloudflare-terraform` skill exists independently but is never called by `cursor-loop-runner.sh`.

### Finding 3: ZFS snapshot is NOT in the loop

CONTRATO.md requires snapshot before destructive changes. The loop modifies code extensively but never calls `zfs snapshot` before modifications. SPEC-023 mentions ZFS snapshot in healing layer but this is separate from cursor-loop.

### Finding 4: Monitoring stack is fully independent

Grafana, Prometheus, AlertManager, docker-autoheal, health_agent.sh operate in a separate闭环. Grafana alerts do not trigger new cursor-loop iterations. The only feedback path is manual human intervention.

### Finding 5: ci-feature.yml and ci.yml are redundant

Two CI workflow files exist with overlapping purpose. ci-feature.yml has security audit + biome lint; ci.yml does not. ci.yml uses `yarn` (wrong package manager per SPEC-021); ci-feature.yml uses `pnpm` (correct).

### Finding 6: Two human gate mechanisms coexist

1. `pipeline-state.json` → `humanGateRequired` → `approve.sh` polling (cursor-loop-runner.sh)
2. Gitea environment → UI approval at `https://git.zappro.site/repo/actions/environments` (deploy-main.yml)

### Finding 7: .claude/agents/README.md missing

SPEC-021 references `.claude/agents/README.md` but the file does not exist.

### Finding 8: Branch naming convention operational

Current branch `feature/quantum-dispatch-ax7k2` follows the random `[adjective]-[noun]-[hex]` format defined in cursor-loop-mirror.

---

## 8. Missing Pieces Summary

| Item | Severity | CONTRATO Issue |
|------|----------|----------------|
| ZFS snapshot before code changes | HIGH | Yes — CONTRATO violation |
| Terraform/Cloudflare DNS in loop | HIGH | Step [5] of SPEC-021 not implemented |
| Auto-healer feedback to loop | MEDIUM | No integration |
| Coolify MCP not installed | MEDIUM | Planned but not done |
| Gitea MCP not installed | MEDIUM | Planned but not done |
| Tavily API key missing | MEDIUM | Research agent can't function |
| Grafana alerts → loop trigger | LOW | No feedback path |
| taskmaster-ai MCP | LOW | Not installed |
| Promail → Grafana Alloy | LOW | EOL passed March 2026 |

---

## 9. Recommendations

| Priority | Recommendation |
|----------|-----------------|
| CRITICAL | Add ZFS snapshot call in cursor-loop-runner.sh before any code modification |
| CRITICAL | Integrate Terraform apply into loop after Coolify deploy (step [5]) |
| HIGH | Install coolify-mcp and gitea-mcp npm packages |
| HIGH | Add Tavily API key to Infisical or disable Tavily-dependent research |
| HIGH | Create `.claude/agents/README.md` documenting all 10 cursor-loop agents |
| MEDIUM | Wire Grafana/AlertManager alerts to trigger cursor-loop restart on healing events |
| MEDIUM | Consolidate ci.yml and ci-feature.yml (remove duplication, fix yarn→pnpm) |
| MEDIUM | Unify human gate mechanisms |
| LOW | Install taskmaster-ai MCP |
| LOW | Execute Promail → Grafana Alloy migration (SPEC-023, EOL passed) |

---

## 10. Reference Files

| File | Role |
|------|------|
| `docs/SPECS/SPEC-CURSOR-LOOP.md` | Primary specification for the loop |
| `docs/SPECS/SPEC-021-CLAUDE-CODE-CURSOR-LOOP.md` | Skills + MCP architecture (fused spec) |
| `docs/SPECS/SPEC-023-unified-monitoring-self-healing.md` | Monitoring/healing stack (separate闭环) |
| `scripts/cursor-loop-runner.sh` | Main orchestrator script |
| `tasks/pipeline-state.json` | Current state (READY_TO_SHIP, retryCount=0) |
| `.gitea/workflows/deploy-main.yml` | Main branch deploy with human gate |
| `.gitea/workflows/ci-feature.yml` | Feature branch CI |
| `.claude/commands/cursor-loop.md` | `/cursor-loop` command definition |
| `.claude/agents/cursor-loop-*.md` | 10 agent definitions |
| `.claude/skills/cloudflare-terraform/SKILL.md` | Cloudflare+Terraform skill (unused by loop) |
| `.claude/skills/coolify-access/SKILL.md` | Coolify API skill |
| `.claude/skills/gitea-access/SKILL.md` | Gitea API skill |
