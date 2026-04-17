# SPEC-066: Claude Commands Audit — SECRETS Agent Report

**Date:** 2026-04-17
**Agent:** SECRETS
**Focus:** Security audit of `.claude/` structure — duplicates, obsolete skills, anti-hardcoded enforcement

---

## 1. Key Findings

### 1.1 Nested Backup Artifact (CRITICAL — DELETE)

**`.claude/.claude/`** — nested accidental backup
- Contains: `skills/orchestrator/logs/*.log` (26 log files from past orchestrator runs)
- **Action:** DELETE recursively — no useful content, just old logs
- **Risk:** Low (logs only, no secrets)

### 1.2 Duplicate Tools (DELETE)

**`.claude/tools/img-analyze.sh`** vs **`/img` skill**
- `img-analyze.sh` uses **LLaVA model** (`llava`)
- `/img` skill uses **qwen2.5vl:7b** (correct, SOTA for this stack)
- **Action:** DELETE `img-analyze.sh` — skill is the correct implementation
- **Conflict:** The script uses deprecated `llava` model (crashes per SPEC-053)

### 1.3 Obsolete Skills (DELETE)

| Skill | Reason |
|-------|--------|
| `cloudflare-terraform/` | Replaced by `cloudflare-tunnel-enterprise/` (SPEC-043). Contains Infisical SDK references (legacy, pruned per ADR-001) |
| `researcher/` (monorepo) | Duplicate of global `~/.claude/skills/researcher/`. MiniMax-dependent (PROIBIDO per SPEC-066) |
| `db-migration/` | OrchidORM not in use (deprecated stack). MiniMax-dependent (PROIBIDO) |

### 1.4 Duplicate Commands (RESOLVE)

| Command | Location | Issue |
|---------|----------|-------|
| `plan.md` | `.claude/commands/` (2x) | Duplicated |
| `review.md` | `.claude/commands/` (2x) | Duplicated |
| `ship.md` | `.claude/commands/` (2x) | Duplicated |

**Action:** Keep most recent version, delete older duplicate.

### 1.5 Agents Inside `.claude/` vs Root Level

**`.claude/agents/`** contains 6 agent files:
- `implementer.md`, `mcp-operator.md`, `orchestrator.md`, `planner.md`, `researcher.md`, `reviewer.md`

**Root level `tasks/agent-states/`** has 15 state files.
**`.claude/tasks/agent-states/`** has 27 state files (more complete, includes RESEARCH-5 through -14, ARCHITECT, SECRETS, SPEC-ANALYZER).

**Action:** Keep `.claude/agents/` as they serve the orchestrator. The separation is intentional — `.claude/agents/` are agent *definitions* used by orchestrator, `tasks/agent-states/` are *runtime state* files.

### 1.6 Rules Inside `.claude/` vs Root Level

**`.claude/rules/`** contains 5 rule files:
- `REVIEW-SKILLS.md`, `anti-hardcoded-env.md`, `anti-hardcoded-secrets.md`, `backend.md`, `search.md`

These are **project-specific rules** that should stay in `.claude/rules/` (CLAUDE.md references them as `.claude/rules/`).

### 1.7 Security Audit Findings

#### ✅ GOOD — Anti-Hardcoded Secrets Enforced

| File | Status | Notes |
|------|--------|-------|
| `anti-hardcoded-secrets.md` | ✅ ACTIVE | .env canonical, Infisical pruned, PROIBIDO patterns defined |
| `anti-hardcoded-env.md` | ✅ ACTIVE | process.env pattern, fallback conventions |
| `SECRETS-MANDATE.md` | ✅ ACTIVE | ADR-001 canonical source |

#### ⚠️ ISSUE — Legacy References in Old Skills

**`cloudflare-terraform/SKILL.md`** contains:
```python
# Read CLOUDFLARE_API_TOKEN from .env (synced from Infisical)
token = os.environ.get("CLOUDFLARE_API_TOKEN")
if not token:
    raise RuntimeError("... — ensure .env is synced from Infisical")
```

**This references Infisical as "synced source" which is outdated.** Per ADR-001 (2026-04-13), `.env` IS the canonical source — no "sync from Infisical" language should appear.

**Action:** When deleting `cloudflare-terraform/`, ensure `cloudflare-tunnel-enterprise/` has correct language.

#### ✅ GOOD — MiniMax PROIBIDO in SPEC-066

Confirmed: `researcher/` skill uses MiniMax MiniMax-M2.7 via `cursor-loop-research-minimax.sh`. This is PROIBIDO and the monorepo copy should be deleted. The global copy should also be flagged for deletion.

---

## 2. Specific Recommendations

### 2.1 DELETE Immediately (No Approval Needed)

```bash
# Nested backup artifact
rm -rf /srv/monorepo/.claude/.claude/

# Duplicate tool
rm /srv/monorepo/.claude/tools/img-analyze.sh

# Obsolete skills (MiniMax-dependent or superseded)
rm -rf /srv/monorepo/.claude/skills/researcher/
rm -rf /srv/monorepo/.claude/skills/cloudflare-terraform/
rm -rf /srv/monorepo/.claude/skills/db-migration/
```

### 2.2 Deduplicate Commands

Keep one instance of each: `plan.md`, `review.md`, `ship.md` — most recent version.

### 2.3 Update `cloudflare-tunnel-enterprise/SKILL.md`

Remove any language suggesting "Infisical sync" — should read directly from `.env`:

```markdown
# ✅ CORRETO
token = os.getenv("CLOUDFLARE_API_TOKEN")
if not token:
    raise RuntimeError("CLOUDFLARE_API_TOKEN not set in .env")

# ❌ REMOVE (legacy Infisical language)
# "ensure .env is synced from Infisical"
```

### 2.4 CLAUDE.md Updates

**In `/srv/monorepo/.claude/CLAUDE.md` (monorepo rules):**

Add to "Forbidden" section:
```
❌ MiniMax API calls in skills (PROIBIDO per SPEC-066)
❌ Infisical SDK imports (legacy, pruned)
❌ Nested .claude/.claude/ backup artifacts
```

### 2.5 AGENTS.md Updates

Add a section on skill lifecycle:
```markdown
## Skill Lifecycle

| State | Action |
|-------|--------|
| OBSOLETE | Delete (MiniMax-dependent, superseded by SOTA) |
| DUPLICATE | Keep one, delete rest |
| NESTED BACKUP | Delete recursively |

### PROIBIDO (SPEC-066)
- MiniMax API calls (`minimax`, `MiniMax-M2.7`)
- Infisical SDK imports
- Nested `.claude/.claude/` artifacts
```

---

## 3. April 2026 Best Practices Alignment

| Practice | Status | Evidence |
|----------|--------|----------|
| Zero hardcoded secrets | ✅ | `anti-hardcoded-secrets.md` active, ADR-001 in effect |
| .env as canonical source | ✅ | Infisical pruned 2026-04-13 |
| PROIBIDO tokens enforced | ✅ | SPEC-066 explicitly forbids minimax/anthropic/token |
| Skill deduplication | ⚠️ PENDING | `researcher`, `cloudflare-terraform`, `db-migration` need deletion |
| Nested artifact cleanup | ⚠️ PENDING | `.claude/.claude/` needs deletion |

---

## 4. Compliance Checklist

| Acceptance Criteria | Status |
|---------------------|--------|
| `.claude/.claude/` eliminated | ❌ PENDING |
| `.claude/tools/` audit (img-analyze.sh) | ❌ PENDING |
| `researcher` duplicate deleted (monorepo) | ❌ PENDING |
| `cloudflare-terraform` deleted (superseded) | ❌ PENDING |
| `db-migration` deleted (OrchidORM deprecated) | ❌ PENDING |
| Commands deduplicated | ❌ PENDING |
| Zero minimax touched | ✅ COMPLIANT |
| Zero anthropic touched | ✅ COMPLIANT |
| Zero token touched | ✅ COMPLIANT |
| `.env` canonical enforced | ✅ COMPLIANT |

---

## 5. Summary

**CRITICAL Actions (delete immediately):**
1. `.claude/.claude/` — nested backup artifact (just logs)
2. `.claude/tools/img-analyze.sh` — uses deprecated `llava` model
3. `.claude/skills/researcher/` — MiniMax-dependent duplicate
4. `.claude/skills/cloudflare-terraform/` — superseded by `cloudflare-tunnel-enterprise`
5. `.claude/skills/db-migration/` — OrchidORM deprecated, MiniMax-dependent

**VERIFIED Safe:**
- `.claude/agents/` — intentional orchestrator agent definitions
- `.claude/rules/` — project-specific rules (reviewed, compliant)
- `.claude/tasks/agent-states/` — runtime state (more complete than root)

**Security Posture:** Clean except for legacy MiniMax dependencies and nested artifacts. Anti-hardcoded secrets enforcement is solid (ADR-001 active).
