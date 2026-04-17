# RESEARCH-10: Documentation Drift Prevention Patterns

**Agent:** RESEARCH-10
**Date:** 2026-04-17
**Focus:** Keeping docs in sync with code, ai-context patterns, obsidian mirror
**Status:** COMPLETED

---

## 1. Key Findings (April 2026 Best Practices)

### 1.1 Existing Infrastructure

| Pattern             | Location                                 | Status                                       |
| ------------------- | ---------------------------------------- | -------------------------------------------- |
| **Obsidian Mirror** | `scripts/sync-obsidian-mirror.sh`        | ✅ Active — rsync from `docs/` → `obsidian/` |
| **AI Context Sync** | `~/.claude/mcps/ai-context-sync/sync.sh` | ✅ Active — docs → memory                    |
| **Cron Sync Jobs**  | Cron (30min, daily)                      | ✅ Active                                    |
| **Drift Detection** | `docs/GOVERNANCE/DOCUMENTATION_MAP.md`   | ⚠️ Dated 2026-03-16                          |
| **Pre-push Hooks**  | Git hooks                                | ✅ Active                                    |

### 1.2 Obsidian Mirror Pattern

**Current implementation (`scripts/sync-obsidian-mirror.sh`):**

```bash
# Source: docs/ (read-only)
# Target: obsidian/ (mirror)
# Excludes: archive/, logs/, plans/, BAU-*, .DS_Store
# Cron: */15 * * * * (every 15 minutes)

rsync -av --delete "$SOURCE/" "$TARGET/"
```

**Problem:** The obsidian mirror is ONE-WAY (docs → obsidian), but:

- Obsidian is described as "read-only mirror" yet no enforcement
- No verification that obsidian hasn't diverged
- No alerting on drift

### 1.3 AI-Context Sync Pattern

**Current implementation:**

```bash
# After every commit + push — MANDATORY
bash /home/will/.claude/mcps/ai-context-sync/sync.sh

# Cron: 614f0574 runs every 30 min
```

**What it syncs:**

- `docs/GOVERNANCE/` → `memory/`
- `docs/SPECS/` → `memory/`
- `docs/SKILLS/` → `memory/skills/`
- `.context/docs/` → `memory/`

**Problem:** Memory sync is in AGENTS.md but NOT prominent in `/ship` workflow.

### 1.4 Documentation Drift Types

| Drift Type          | Cause                                | Detection     | Prevention            |
| ------------------- | ------------------------------------ | ------------- | --------------------- |
| **Content Drift**   | Docs updated but code changed        | Manual review | Post-commit sync      |
| **Reference Drift** | Links point to moved files           | Broken links  | Path conventions      |
| **State Drift**     | Docs claim X status but reality is Y | Health checks | Periodic verification |
| **Obsidian Drift**  | Obsidian modified manually           | None          | rsync --delete        |

---

## 2. Specific Recommendations

### 2.1 For CLAUDE.md — Add Documentation Drift Section

**ADD to "Before Work in Monorepo" section:**

```markdown
## Documentation Drift Prevention

After ANY code change that affects docs:

1. Run `/ship` which includes memory sync
2. Verify obsidian mirror: `bash scripts/sync-obsidian-mirror.sh --dry-run`
3. Check for broken links: internal only (no automated tool yet)

**Critical docs that require sync after change:**

- `docs/GOVERNANCE/*` — IMMEDIATE sync required
- `docs/SPECS/SPEC-*.md` — Sync before PR merge
- `docs/INFRASTRUCTURE/PORTS.md` — After port changes
- `docs/INFRASTRUCTURE/SUBDOMAINS.md` — After subdomain changes
```

### 2.2 For AGENTS.md — Strengthen Sync Rules

**CURRENT (AGENTS.md lines 802-836):**

```markdown
## AI-CONTEXT Sync (SPEC-027)

**OBRIGATORIO apos cada feature/PR merge**
```

**RECOMMENDED — Make it more explicit:**

````markdown
## Documentation Sync Pattern (OBRIGATORIO)

### After Every Commit + Push

```bash
# 1. Memory sync (ai-context)
bash /home/will/.claude/mcps/ai-context-sync/sync.sh

# 2. Obsidian mirror
bash scripts/sync-obsidian-mirror.sh

# 3. Verify sync
cat ~/.claude/mcps/ai-context-sync/manifest.json | jq '.last_sync'
```
````

### Post-Sync Verification

- Memory index: `grep -c "last_sync" memory/MEMORY.md` (should be recent)
- Obsidian count: `find obsidian/ -name "*.md" | wc -l` vs `find docs/ -name "*.md" | wc -l`

````

### 2.3 Create Drift Detection Commands

**ADD to `.claude/commands/` — `docs-drift.md`:**

```markdown
# /docs-drift — Check for documentation drift

## Check
1. Obsidian mirror count vs docs count
2. Memory last_sync timestamp
3. Broken internal links (manual)

## Commands
```bash
# Obsidian drift
echo "Docs: $(find docs/ -name '*.md' | wc -l)"
echo "Obsidian: $(find obsidian/ -name '*.md' | wc -l)"

# Memory drift
cat ~/.claude/mcps/ai-context-sync/manifest.json | jq '.last_sync'

# Broken links check
grep -r "docs/.*\.md" docs/ | grep -v "\.md)" | head -20
````

````

---

## 3. Code/Examples

### 3.1 Enhanced Obsidian Sync with Verification

**Current `sync-obsidian-mirror.sh` — add verification:**

```bash
# After rsync, verify counts match
src_count=$(find "$SOURCE" -type f -name "*.md" 2>/dev/null | wc -l)
tgt_count=$(find "$TARGET" -type f -name "*.md" 2>/dev/null | wc -l)

if [ "$src_count" -ne "$tgt_count" ]; then
    log "WARN Count mismatch: docs=$src_count obsidian=$tgt_count"
fi
````

### 3.2 Memory Sync Cron Verification

**Add to manifest.json check in cron:**

```bash
# Check if last sync is > 1 hour old
last_sync=$(cat ~/.claude/mcps/ai-context-sync/manifest.json | jq -r '.last_sync')
sync_age=$(( $(date +%s) - $(date -d "$last_sync" +%s) ))

if [ "$sync_age" -gt 3600 ]; then
    echo "WARNING: Memory sync is $sync_age seconds old"
fi
```

---

## 4. What to Add/Update/Delete

### ADD

| Item                            | Location                          | Reason              |
| ------------------------------- | --------------------------------- | ------------------- |
| `/docs-drift` command           | `.claude/commands/docs-drift.md`  | Quick drift check   |
| Obsidian verification to sync   | `scripts/sync-obsidian-mirror.sh` | Detect manual edits |
| Memory sync in `/ship` workflow | `.claude/commands/ship.md`        | Make it explicit    |

### UPDATE

| Item                        | Current                     | Change                        |
| --------------------------- | --------------------------- | ----------------------------- |
| CLAUDE.md "Before Work"     | No drift prevention         | Add explicit sync rules       |
| AGENTS.md "AI-CONTEXT Sync" | Mentioned but not prominent | Expand with obsidian sync     |
| `sync-obsidian-mirror.sh`   | No verification             | Add count verification        |
| `DOCUMENTATION_MAP.md`      | Dated 2026-03-16            | Refresh with current patterns |

### DELETE

| Item              | Reason                                              |
| ----------------- | --------------------------------------------------- |
| Nothing to delete | Current patterns are sound, just need strengthening |

---

## 5. Anti-Patterns to Avoid

| Anti-Pattern              | Problem                             | Solution                       |
| ------------------------- | ----------------------------------- | ------------------------------ |
| **Docs in two places**    | "Qdrant running in A, stopped in B" | Single source: `docs/` only    |
| **Manual obsidian edits** | rsync --delete wipes them           | Obsidian is read-only mirror   |
| **Stale memory**          | Agents get wrong context            | Sync after every commit        |
| **Broken wiki-links**     | `[[link]]` to deleted files         | Manual check after restructure |

---

## 6. Integration with `/execute` (14-Agent Orchestrator)

For the enterprise refactor, RESEARCH-10 recommends:

```markdown
## Documentation Drift Prevention in /execute

Each of the 14 agents should:

1. Report doc changes in their research
2. Trigger sync after completing research
3. Flag if they found drift between:
   - docs/ vs memory/
   - docs/ vs obsidian/
   - PORTS.md vs live ss output
   - SUBDOMAINS.md vs live curl health
```

---

## 7. Summary

**Current State:** ✅ Good foundation

- Obsidian mirror exists (rsync-based)
- AI-context sync exists (cron + post-commit)
- Pre-push hooks exist

**Gaps:** ⚠️ Enforcement and verification

- No automated verification that mirror is in sync
- Memory sync not prominent in `/ship` workflow
- No quick drift check command

**Recommendations for CLAUDE.md/AGENTS.md:**

1. Add explicit "Documentation Drift Prevention" section
2. Include obsidian sync in `/ship` workflow
3. Create `/docs-drift` command for quick checks
4. Add verification to `sync-obsidian-mirror.sh`

---

**Research conducted by:** RESEARCH-10
**Next:** Integrate findings into enterprise refactor tasks
