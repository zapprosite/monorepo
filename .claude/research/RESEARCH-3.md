# RESEARCH-3 — Daily Cron Strategy for Homelab Monorepo

**Agent:** RESEARCH-3
**Date:** 2026-04-17
**Focus:** Daily cron strategy — which jobs, when, what they do
**Sources:** `scheduled_tasks.json`, `CLAUDE.md`, skill SKILL.md files, smoke-tests/

---

## 1. Current State Analysis

### 1.1 Actual Cron Jobs (Source: `scheduled_tasks.json`)

| ID            | Schedule       | Job                              | Last Fired | Status |
| ------------- | -------------- | -------------------------------- | ---------- | ------ |
| `sre-monitor` | `*/5 * * * *`  | Coolify SRE monitor + auto-heal  | ~5min ago  | ACTIVE |
| `f72c7852`    | `*/30 * * * *` | Memory sync (docs → MEMORY.md)   | ~30min ago | ACTIVE |
| `14d0bbe8`    | `0 3 * * *`    | `/rs` repo-scan → pipeline.json  | ~2h ago    | ACTIVE |
| `8b052672`    | `0 4 * * *`    | Daily code review → REVIEW-\*.md | ~3h ago    | ACTIVE |
| `d38dae54`    | `0 5 * * *`    | Test coverage check              | ~4h ago    | ACTIVE |
| `238fccfa`    | `0 6 * * *`    | Secrets audit (`/se`)            | ~5h ago    | ACTIVE |
| `165ff990`    | `0 8 * * *`    | MCP health check (`/mcp`)        | ~6h ago    | ACTIVE |

**Total: 7 jobs**

### 1.2 Critical Drift: CLAUDE.md vs Reality

The `## Cron` section in `CLAUDE.md` (lines ~195-200) is **stale**:

```
### Cron
- Job `614f0574`: a cada 30 min, checa pendências e syncs memory   ← WRONG ID
- Job `modo-dormir-daily`: às 3h, escaneia SPECs e gera pipeline  ← WRONG NAME (should be `/rs`)
```

**Problems:**

1. Job IDs don't match `scheduled_tasks.json` (`614f0574` → `f72c7852`)
2. `modo-dormir-daily` doesn't exist — actual job is `14d0bbe8` running `/rs`
3. **`sre-monitor` completely missing** — it's the most critical infra job (every 5 min)
4. No mention of what `/rs` actually does (repo-scan + pipeline gen)
5. No mention of the `sre-monitor` replacement of old auto-healer/resource-monitor jobs

### 1.3 Time Distribution

```
00:00-03:00  ░░░░░░░░░░  (idle)
03:00  →  /rs repo-scan
04:00  →  code review
05:00  →  test coverage
06:00  →  secrets audit
07:00  →  idle
08:00  →  MCP health
09:00-23:59 ░░░░░░░░░░  (idle)
*/5 min →  SRE monitor (Coolify containers, health endpoints, tunnels)
*/30 min →  memory sync
```

**Gap:** 9am–midnight has zero cron activity. The morning block (3–8am) is well-structured but the afternoon/evening is empty.

---

## 2. Key Findings (April 2026 Best Practices)

### 2.1 What Works Well

1. **Morning block (3–8am)** is well-designed — runs heavy analytical jobs before human day starts
2. **Memory sync every 30min** keeps AI context fresh without overwhelming
3. **SRE monitor at `*/5` min** catches container issues before they escalate
4. **`/rs` at 3am** is smart — pipeline generation is IO-heavy, benefits from quiet hours
5. **Secrets audit at 6am** catches any midnight pushes before business hours
6. **MCP health at 8am** verifies AI toolchain readiness for human start

### 2.2 Gaps and Risks

| Gap                                       | Severity | Impact                                                  |
| ----------------------------------------- | -------- | ------------------------------------------------------- |
| **No smoke test cron**                    | HIGH     | Service degradation goes undetected until human notices |
| **No docs drift cron**                    | MEDIUM   | Docs diverge from code silently                         |
| **No git mirror sync cron**               | MEDIUM   | Gitea/GitHub can drift                                  |
| **`/rs` job ID mismatch in CLAUDE.md**    | HIGH     | Documentation drift breaks trust                        |
| **`sre-monitor` missing from CLAUDE.md**  | HIGH     | Critical infra job undocumented                         |
| **Weekday vs weekend not differentiated** | LOW      | Weekends could skip test-coverage, run deeper scans     |

### 2.3 Smoke Test Integration Gap

`smoke-tests/smoke-multimodal-stack.sh` exists and validates 13/13 endpoints (`:4002` ai-gateway, `:8642` Hermes, `:8204` STT, `:8013` TTS, etc.) but is **only run manually** via `/ss`. No cron job runs it automatically.

**Recommended:** Add smoke test cron at **9:30am** (after MCP health at 8am gives systems time to fully wake up). This catches:

- ai-gateway 401 regressions
- Hermes Telegram bot downtime
- STT/TTS endpoint failures
- Subdomain tunnel degradation

### 2.4 Skill-to-Cron Mapping (What's Already Built)

| Skill            | Cron          | Command        | Status                |
| ---------------- | ------------- | -------------- | --------------------- |
| `secrets-audit`  | `0 6 * * *`   | `/se`          | ✅ Active             |
| `mcp-health`     | `0 8 * * *`   | `/mcp`         | ✅ Active             |
| `smoke-test-gen` | —             | `/ss`          | ❌ Manual only        |
| `self-healing`   | —             | —              | ❌ Not cron-triggered |
| `coolify-sre`    | `*/5 * * * *` | sre-monitor.sh | ✅ Active             |

---

## 3. Specific Recommendations for CLAUDE.md

### 3.1 Fix the Cron Section (HIGH PRIORITY)

**Replace** the entire `### Cron` block in `CLAUDE.md` with:

```markdown
### Cron Jobs (Source: `.claude/scheduled_tasks.json`)

| ID            | Schedule       | Job                     | Purpose                                           |
| ------------- | -------------- | ----------------------- | ------------------------------------------------- |
| `sre-monitor` | `*/5 * * * *`  | coolify-sre SRE monitor | Container health, tunnel status, auto-heal        |
| `f72c7852`    | `*/30 * * * *` | Memory sync             | docs → MEMORY.md index                            |
| `14d0bbe8`    | `0 3 * * *`    | `/rs` repo-scan         | Scan SPECs, generate/update pipeline.json         |
| `8b052672`    | `0 4 * * *`    | `/review` daily         | Code review → docs/SPECS/reviews/REVIEW-\*.md     |
| `d38dae54`    | `0 5 * * *`    | Coverage check          | Test coverage analysis, report gaps               |
| `238fccfa`    | `0 6 * * *`    | `/se` secrets audit     | Scan for hardcoded secrets                        |
| `165ff990`    | `0 8 * * *`    | `/mcp` health           | MCP server status (context7, github, gitea, etc.) |
| _(proposed)_  | `0 9 * * *`    | `/ss` smoke tests       | Stack health (ai-gateway, Hermes, STT, TTS)       |

**Active Jobs:** 7 (`scheduled_tasks.json`) + 1 proposed
**Missing from docs:** `sre-monitor` (critical infra job)
```

### 3.2 Add Smoke Test Cron (NEW)

Create a new cron job:

```json
{
  "id": "smoke-stack-daily",
  "cron": "0 9 * * *",
  "prompt": "Run smoke tests: execute bash smoke-tests/smoke-multimodal-stack.sh and bash smoke-tests/smoke-agency-suite.sh. Report PASS/FAIL for each endpoint. If any FAIL, alert in logs and mark for human review.",
  "recurring": true
}
```

**Why 9am:** MCP health runs at 8am; gives systems 1h to fully initialize before smoke testing.

### 3.3 Add Docs Drift Cron (MEDIUM PRIORITY)

```json
{
  "id": "docs-drift-daily",
  "cron": "0 10 * * *",
  "prompt": "Check for docs drift: verify PORTS.md matches current service ports (ss -tlnp), SUBDOMAINS.md matches cloudflared tunnels, AGENTS.md matches actual skills in .claude/skills/. Report any divergences.",
  "recurring": true
}
```

### 3.4 Add Git Mirror Sync Cron (MEDIUM PRIORITY)

```json
{
  "id": "git-mirror-daily",
  "cron": "0 22 * * *",
  "prompt": "Sync git mirrors: run bash scripts/mirror-push.sh to push main branch to both Gitea and GitHub. Verify no drift between remotes.",
  "recurring": true
}
```

---

## 4. What to ADD / UPDATE / DELETE in CLAUDE.md

### ADD

| Item                            | Location          | Reason                                                  |
| ------------------------------- | ----------------- | ------------------------------------------------------- |
| `sre-monitor` job documentation | Cron section      | Currently completely missing — critical                 |
| Smoke test cron (proposed)      | Cron section      | Closes health monitoring gap                            |
| Docs drift cron (proposed)      | Cron section      | Prevents doc/code divergence                            |
| Git mirror sync cron (proposed) | Cron section      | Prevents remote drift                                   |
| `/ss` to command list           | Specflow commands | Currently only listed in docs, not as available command |

### UPDATE

| Item                                           | Current                | Change To                                                      |
| ---------------------------------------------- | ---------------------- | -------------------------------------------------------------- |
| Cron job IDs (`614f0574`, `modo-dormir-daily`) | Wrong/stale            | `f72c7852`, `14d0bbe8` with `/rs`                              |
| Cron section job names                         | Incomplete             | Include `sre-monitor`, `smoke-stack-daily`, `docs-drift-daily` |
| Memory sync cron description                   | Vague                  | `docs/SPECS/ → MEMORY.md index sync`                           |
| `/rs` description in specs                     | Missing from CLAUDE.md | Add to command list under Specflow                             |

### DELETE

| Item                                            | Reason                                                                                            |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Stale job IDs (`614f0574`, `modo-dormir-daily`) | These IDs don't exist in `scheduled_tasks.json`                                                   |
| Duplicate Network section                       | CLAUDE.md has the same "Network & Port Governance" section twice (lines ~1-70 and lines ~155-190) |

---

## 5. Proposed Complete Cron Schedule (After Changes)

```
00:00  ░░░░░░░░░░░░░░░░  idle
03:00  → /rs repo-scan (SPECs → pipeline.json)
04:00  → /review daily (code review → REVIEW-*.md)
05:00  → coverage check (test coverage analysis)
06:00  → /se secrets audit (hardcoded secrets scan)
07:00  ░░░░░░░░░░░░░░░░  idle
08:00  → /mcp health (MCP server status)
09:00  → /ss smoke tests (stack health — PROPOSED)
10:00  → docs drift check (PORTS.md, SUBDOMAINS.md — PROPOSED)
11:00-21:00 ░░░░░░░░░░░░  idle
22:00  → git mirror sync (Gitea ↔ GitHub — PROPOSED)
*/5 min → SRE monitor (Coolify containers, tunnels)
*/30 min → Memory sync
```

---

## 6. Summary for Enterprise Refactor

**For CLAUDE.md:**

1. **FIX immediately** — stale cron IDs + missing `sre-monitor` + duplicate network section
2. **ADD smoke test cron** at 9am (proposed `smoke-stack-daily`)
3. **ADD docs drift cron** at 10am (proposed `docs-drift-daily`)
4. **ADD git mirror sync cron** at 22h (proposed `git-mirror-daily`)
5. **UPDATE** `/rs` command reference — currently not documented in CLAUDE.md command list

**For AGENTS.md:**

- No specific cron changes needed — cron is documented in CLAUDE.md, not AGENTS.md
- Consider adding a "Cron Jobs" subsection under the orchestration section

**For scheduled_tasks.json:**

- Already in good shape — 7 active jobs with proper prompts
- Only needs the 3 proposed new jobs added

**Priority order:**

1. FIX stale cron documentation (5 min change, high impact)
2. ADD smoke test cron (closes critical monitoring gap)
3. ADD docs drift cron (prevents doc rot)
4. ADD git mirror sync cron (prevents remote divergence)
