# RESEARCH-12: Code Review Automation Patterns

**Agent:** RESEARCH-12
**Date:** 2026-04-17
**Focus:** Automated PR reviews, multi-axis review, Gitea integration
**Status:** COMPLETE

---

## 1. Current State Analysis

### Existing Code Review Infrastructure

| Component              | Location                                   | Status              |
| ---------------------- | ------------------------------------------ | ------------------- |
| Gitea Actions Workflow | `.gitea/workflows/code-review.yml`         | ✅ Active (5 gates) |
| 5-Axis Review Guide    | `docs/GUIDES/CODE-REVIEW-GUIDE.md`         | ✅ Comprehensive    |
| `/code-review` Command | `.claude/commands/code-review.md`          | ✅ Functional       |
| Agent Workflow         | `.agent/workflows/code-review-workflow.md` | ✅ Defined          |
| Cron Daily Job         | `8b052672` (0 4 \* \* \*)                  | ✅ Scheduled        |
| Gitea API Skill        | `.claude/skills/gitea-access/SKILL.md`     | ✅ Documented       |

### Gitea Actions Code Review Pipeline (Current)

```
pull_request → automated-checks (lint+test+build)
           → security-scan (Trivy)
           → ai-review (Claude Code CLI → PR comment)
           → human-approval (Gitea environment protection)
           → merge gate
```

### Current 5 Gates in `.gitea/workflows/code-review.yml`

1. **Automated Checks** — lint, typecheck, build, test
2. **Security Scan** — Trivy vulnerability scanner
3. **AI Review** — Claude Code CLI review posted as PR comment
4. **Human Approval** — Gitea environment protection
5. **Merge Gate** — signal completion

---

## 2. Key Findings (April 2026 Best Practices)

### Finding 1: Gitea Actions Uses Wrong Credential Source

**Issue:** Line 146 in `.gitea/workflows/code-review.yml`:

```yaml
CLAUDE_API_KEY: ${{ secrets.CLAUDE_API_KEY }}
```

**Problem:** The monorepo mandates `.env` as canonical source. Gitea Actions `secrets` is not aligned with the anti-hardcoded pattern.

**Fix:** Use `GITEA_TOKEN` from `.env` for Gitea API calls (already documented in `gitea-access/SKILL.md`), and configure `CLAUDE_API_KEY` as a Gitea Actions secret synced from `.env`.

### Finding 2: Missing `universal-code-review` Skill

**Issue:** `REVIEW-SKILLS.md` references `universal-code-review` skill, but no such skill exists in `.claude/skills/`.

**Evidence:**

- `.claude/rules/REVIEW-SKILLS.md` line 31: `"universal-code-review" skill`
- Glob search: `.claude/skills/universal-code-review*` → No files found

**Impact:** `/review` command cannot find the skill it references.

### Finding 3: AI Review Gate Has Shell Injection Risk

**Issue:** Lines 154-159 in `.gitea/workflows/code-review.yml`:

```bash
printf '%s' "$PR_TITLE" > /tmp/pr_title.txt
printf '%s' "$PR_BODY" > /tmp/pr_body.txt
PR_TITLE=$(cat /tmp/pr_title.txt)
PR_BODY=$(cat /tmp/pr_body.txt)
```

**Problem:** PR_TITLE/PR_BODY are written to temp files then re-read, but the variables still contain potentially malicious content if the initial assignment was crafted. The `printf '%s'` pattern is correct but the subsequent variable reassignment defeats the purpose.

**Better Pattern:** Pass content directly via file reference or environment variable throughout.

### Finding 4: No Skill-that-Calls-Skills for Code Review

**Current State:** Code review is a single step. No orchestration of multiple specialized review agents.

**Best Practice (April 2026):** Skill-that-calls-skills pattern where one meta-skill orchestrates specialized agents:

```
code-review (meta-skill)
├── correctness-review (agent)
├── security-review (agent)
├── performance-review (agent)
├── readability-review (agent)
└── architecture-review (agent)
```

### Finding 5: Orchestrator's 14 Agents Don't Include Parallel Code Review

**Issue:** The `/execute` orchestrator (SKILL.md lines 36-52) has agent #13 as `REVIEWER` using `/review`, but it runs sequentially after all other agents.

**Best Practice:** Code review should be parallel to other verification agents (TYPES, LINT, SECRETS) in the 14-agent model.

### Finding 6: Daily Cron Job Is Incomplete

**Current Cron Task (ID: `8b052672`):**

```
0 4 * * * /review on recent commits and changes. Generate REVIEW-*.md reports
```

**Gap:** No Gitea API integration to:

- List recent PRs
- Post review comments
- Check review status
- Trigger re-review after fixes

### Finding 7: Missing PR Review Comment API

**Issue:** Gitea Actions workflow (line 186-190) uses raw `curl` for posting PR comments. No dedicated skill for:

- Listing open PRs
- Getting PR diff
- Posting structured review comments
- Approving/Requesting changes

**Gitea MCP** (`@masonator/gitea-mcp`) is documented but not integrated into the code review workflow.

---

## 3. Recommendations for CLAUDE.md / AGENTS.md

### 3.1 Add Code Review Orchestration Section

In `AGENTS.md`, add a section for the code review orchestrator:

```markdown
## Code Review Orchestrator (SPEC-ENTERPRISE-REFACTOR)

### 5-Axis Parallel Review

| Axis         | Agent                   | Skill     | Parallel To |
| ------------ | ----------------------- | --------- | ----------- |
| Correctness  | `bug-investigator`      | `/bug`    | LINT        |
| Security     | `security-auditor`      | `/sec`    | SECRETS     |
| Performance  | `performance-optimizer` | —         | TYPES       |
| Readability  | `code-reviewer`         | `/review` | BUILD       |
| Architecture | `architect-specialist`  | —         | TEST        |

### Integration with /execute

Agent #13 (REVIEWER) in the 14-agent orchestrator runs `/review` in parallel with other verification agents (TYPES, LINT, SECRETS, TESTER).

### Gitea API Integration

Code review automation uses `GITEA_TOKEN` from `.env`:

- List open PRs: `GET /api/v1/repos/{owner}/{repo}/pulls`
- Post review: `POST /api/v1/repos/{owner}/{repo}/issues/{index}/comments`
- Set status: `POST /api/v1/repos/{owner}/{repo}/pulls/{index}/reviews`
```

### 3.2 Document `universal-code-review` Skill Pattern

Create `.claude/skills/universal-code-review/SKILL.md`:

```markdown
---
name: universal-code-review
description: 5-axis code review — Correctness, Readability, Architecture, Security, Performance
trigger: /review
version: 1.0.0
type: skill
---

# Universal Code Review Skill

## 5-Axis Review Framework

Each axis maps to a specialized review:

| Axis         | Focus           | Key Questions                    |
| ------------ | --------------- | -------------------------------- |
| Correctness  | Logic bugs      | Does it do what it claims?       |
| Security     | Vulnerabilities | No injection, secrets safe?      |
| Performance  | Efficiency      | N+1, indexes, complexity?        |
| Readability  | Clarity         | Clear naming, self-documenting?  |
| Architecture | Design          | Proper separation, dependencies? |

## Workflow

1. Load context: `git diff main..HEAD`
2. Run each axis in parallel (if agents available)
3. Aggregate findings by severity
4. Generate structured review report
5. Post to PR via Gitea API

## Integration

- Uses `GITEA_TOKEN` from `.env` for API calls
- Uses `github` MCP or `gitea` MCP for PR operations
- Outputs `REVIEW-*.md` to `docs/SPECS/reviews/`
```

### 3.3 Fix Gitea Actions Credentials Pattern

In `.gitea/workflows/code-review.yml`, update the AI review step to:

1. Pass `GITEA_TOKEN` from a Gitea Actions secret (not `secrets.CLAUDE_API_KEY`)
2. Use the same `.env`-based credential pattern as the monorepo

---

## 4. Specific Code Examples

### 4.1 Gitea API: Post PR Review Comment

```bash
# Using .env GITEA_TOKEN
curl -s -X POST \
  "https://git.zappro.site/api/v1/repos/$OWNER/$REPO/issues/$PR_NUMBER/comments" \
  -H "Authorization: token $GITEA_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"body\": \"## AI Code Review\n\n$REVIEW_OUTPUT\n\n---\n*Generated by Claude Code*\"}"
```

### 4.2 Multi-Axis Parallel Review Agent Pattern

```bash
# Spawn 5 review agents in parallel
for axis in correctness security performance readability architecture; do
  claude --agent "code-review-$axis" \
    --system "Review code changes for $axis axis" \
    --output "/tmp/review-$axis.md" &
done
wait

# Aggregate results
cat /tmp/review-*.md > /tmp/full-review.md
```

### 4.3 Skill-that-Calls-Skills Code Review

```yaml
# universal-code-review/SKILL.md
skills:
  - bug-investigation # Correctness axis
  - security-audit # Security axis
  - minimax-security-audit # Security (OWASP)
  - code-review # Readability + Architecture
```

---

## 5. What to Add/Update/Delete

### ADD

| Item                          | Location                                | Reason                     |
| ----------------------------- | --------------------------------------- | -------------------------- |
| `universal-code-review` skill | `.claude/skills/universal-code-review/` | Missing but referenced     |
| `code-review-agents/`         | `.claude/agents/`                       | Specialized review agents  |
| Gitea PR comment script       | `scripts/gitea-pr-comment.sh`           | Reusable API wrapper       |
| Review aggregator             | `scripts/aggregate-reviews.sh`          | Combine multi-axis reviews |

### UPDATE

| Item                 | Location                       | Change                               |
| -------------------- | ------------------------------ | ------------------------------------ |
| `code-review.yml`    | `.gitea/workflows/`            | Use `.env`-aligned secrets           |
| `AGENTS.md`          | Root                           | Add code review orchestrator section |
| `CLAUDE.md`          | Root                           | Document `/review` skill delegation  |
| Cron task `8b052672` | `.claude/scheduled_tasks.json` | Integrate Gitea API                  |

### DELETE

| Item | Reason             |
| ---- | ------------------ |
| —    | No items to delete |

---

## 6. Gitea Integration via .env Credentials

### Required .env Variables

```bash
GITEA_TOKEN=<from .env>
GITEA_INSTANCE_URL=https://git.zappro.site
CLAUDE_API_KEY=<for AI review gate>
```

### Gitea API Endpoints for Code Review

| Operation      | Endpoint                                               | Method |
| -------------- | ------------------------------------------------------ | ------ |
| List open PRs  | `/api/v1/repos/{owner}/{repo}/pulls?state=open`        | GET    |
| Get PR details | `/api/v1/repos/{owner}/{repo}/pulls/{index}`           | GET    |
| Get PR diff    | `/api/v1/repos/{owner}/{repo}/pulls/{index}.diff`      | GET    |
| Post comment   | `/api/v1/repos/{owner}/{repo}/issues/{index}/comments` | POST   |
| Submit review  | `/api/v1/repos/{owner}/{repo}/pulls/{index}/reviews`   | POST   |

### Gitea MCP Tool Integration

The existing `gitea-access` skill provides MCP tools. For code review:

- `gitea_list_repos` — find the repo
- `gitea_create_pr_comment` — post structured review
- `gitea_get_pull_request` — get PR details for context

---

## 7. Anti-Patterns to Avoid

1. **Hardcoded credentials in workflows** — Always use Gitea Actions secrets synced from `.env`
2. **Shell injection in PR title/body** — Use `printf '%s'` or files, never direct variable expansion
3. **Sequential review when parallel is possible** — Run 5-axis reviews concurrently
4. **Single-point of failure** — Skill should handle agent unavailability gracefully
5. **Missing fallback** — If AI review fails, fall back to automated lint/security checks

---

## 8. Integration with Orchestrator (14-Agent)

Current orchestrator has:

- Agent #13: REVIEWER (runs `/review` after agents 1-12)
- Agent #14: SHIPPER (waits for all, creates PR)

**Recommended Enhancement:**

- Move REVIEWER to run in parallel with TYPES, LINT, SECRETS (agents 9-11)
- Add specialized review agents: correctness, security, performance
- SHIPPER should check review status before creating PR

---

## 9. Cron Job Enhancement

Current: `0 4 * * *` runs `/review` on recent commits

**Enhanced Cron Task:**

```bash
# Pseudo-code for enhanced cron
1. Get recent commits via git log
2. Check if any are on open PRs via Gitea API
3. For each PR without recent review:
   a. Run full 5-axis review
   b. Post review comment via Gitea API
   c. Update review log
4. Generate daily review summary
```

---

## 10. Summary

| Aspect       | Current                | Recommended                       |
| ------------ | ---------------------- | --------------------------------- |
| Skill        | `/code-review` (basic) | `universal-code-review` (5-axis)  |
| Parallel     | Sequential             | 5-axis parallel execution         |
| Gitea        | curl raw API           | MCP tools + skill                 |
| Credentials  | `secrets.*`            | `.env` + synced secrets           |
| Cron         | `/review` only         | Full pipeline + PR posting        |
| Orchestrator | Sequential             | Parallel with other verifications |

**Priority Actions:**

1. Create `universal-code-review` skill (blocks `/review`)
2. Fix Gitea Actions credential pattern
3. Add Gitea MCP integration to code review workflow
4. Enhance cron job to use Gitea API
5. Update AGENTS.md with code review orchestrator section

---

**Report Generated:** 2026-04-17
**Agent:** RESEARCH-12
**Research Time:** ~15 minutes
**Files Analyzed:** 8
