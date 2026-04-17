# GIT Agent Research — SPEC-066 Claude Commands Audit

## Current State

### Nested Artifact Found
- `/srv/monorepo/.claude/.claude/` — **DELETE RECURSIVELY**
  - Contains only orchestrator logs from previous runs
  - No unique content

### Obsolete Scripts
- `~/.claude/tools/` — exists but empty (no `img-analyze.sh` found)
- Nested `.claude/.claude/skills/orchestrator/` — just logs, no skill content

## Skills Audit

### Global Skills (20) — Duplicates to DELETE
| Skill | Action |
|-------|--------|
| `gitea-coolify-deploy` | **DELETE** — combines `gitea-access` + `coolify-deploy-trigger` |
| `pipeline-orchestrate` | **DELETE** — superseded by `orchestrator` |
| `openclaw-oauth-profiles` | **DELETE** — OpenClaw deprecated (SPEC-051) |
| `voice` | **DELETE** — Hermes voice is SOTA |
| `researcher` | **KEEP MONOREPO VERSION** — global is older |

### Monorepo Skills (24) — Duplicates to DELETE
| Skill | Action |
|-------|--------|
| `researcher` | **DELETE** — duplicate of global, global is canonical |
| `cloudflare-terraform` | **DELETE** — replaced by `cloudflare-tunnel-enterprise` |

### Orchestrator — Different Versions (CONFLICT)
| Location | Version | Status |
|----------|---------|--------|
| `~/.claude/skills/orchestrator/` | No SKILL.md, only scripts | Legacy |
| `/srv/monorepo/.claude/skills/orchestrator/` | Has SKILL.md + scripts | **Canonical** |

**Decision:** Use monorepo version as canonical. Delete global orchestrator copy.

## Commands Audit

### Duplicates Found (plan.md, review.md, ship.md)
The monorepo versions are more detailed and project-specific. Global versions invoke agent-skills directly.

| Command | Global | Monorepo | Action |
|---------|--------|----------|--------|
| `plan.md` | 14 lines, invokes skill | 32 lines, detailed | **KEEP MONOREPO** |
| `review.md` | 14 lines, invokes skill | ~50 lines, detailed | **KEEP MONOREPO** |
| `ship.md` | 17 lines, invokes skill | ~23 lines, detailed | **KEEP MONOREPO** |

**Action:** Delete global symlinks, keep monorepo versions.

## Directory Audit

### `agents/`, `tasks/`, `rules/` inside `.claude/`

| Path | Content | vs Root-level | Action |
|------|---------|---------------|--------|
| `.claude/agents/` | implementer, mcp-operator, orchestrator.md (symlink), planner, researcher, reviewer | Root has `agent-states/`, `pipeline.json/` | **AUDIT** — orchestrator.md is symlink to `.context/`, others are agent definitions |
| `.claude/tasks/` | agent-skills.rules, context7.md | Root has `pipeline.json`, `smoke-tests/`, `agent-states/` | **KEEP** — these are skill/rules, not task files |
| `.claude/rules/` | anti-hardcoded-env.md, anti-hardcoded-secrets.md, backend.md, REVIEW-SKILLS.md, search.md | Root has only symlinks | **KEEP** — these are project-specific rules |

### `db-migration/` Skill
- **Status:** Orchid ORM not in use (replaced by tRPC/Prisma patterns)
- **Action:** Mark as DEPRECATED or DELETE

## April 2026 Best Practices

1. **Single source of truth** — Skills live in one location (monorepo for project-specific, global for cross-project)
2. **No nested `.claude/.claude/`** — These are backup artifacts from orchestrator runs
3. **Commands as documentation** — Commands should be self-documenting, not just skill invocations
4. **Consistent naming** — `universal-*` prefix for cross-project skills

## Recommendations

### CLAUDE.md Updates

1. **Add skill canonical location rules:**
   ```
   ## Skill Canonical Locations
   - Global skills (cross-project): `~/.claude/skills/`
   - Project skills (monorepo-specific): `.claude/skills/`
   - Never duplicate skills across both locations
   ```

2. **Add command canonical location:**
   ```
   ## Commands
   - Project commands: `.claude/commands/` (monorepo)
   - Global commands: `~/.claude/commands/` (symlinks to agent-skills)
   ```

### AGENTS.md Updates

1. **Clarify agent definitions location:**
   ```
   ## Agent Definitions
   - Project agents: `.claude/agents/` (implementer, planner, reviewer, researcher, mcp-operator)
   - Orchestrator: `.context/agents/orchestrator.md` (canonical, not in .claude/)
   ```

2. **Add orchestrator version note:**
   ```
   ## Orchestrator (SPEC-066)
   - Canonical location: `.claude/skills/orchestrator/`
   - Global `~/.claude/skills/orchestrator/` is deprecated
   ```

## Delete清单 (SPEC-066 Execution)

```bash
# 1. Nested artifact
rm -rf /srv/monorepo/.claude/.claude/

# 2. Obsolete global skills
rm -rf ~/.claude/skills/gitea-coolify-deploy/
rm -rf ~/.claude/skills/pipeline-orchestrate/
rm -rf ~/.claude/skills/openclaw-oauth-profiles/
rm -rf ~/.claude/skills/voice/

# 3. Global orchestrator (keep monorepo version)
rm -rf ~/.claude/skills/orchestrator/

# 4. Duplicate monorepo skills
rm -rf /srv/monorepo/.claude/skills/researcher/
rm -rf /srv/monorepo/.claude/skills/cloudflare-terraform/

# 5. Global command symlinks (keep monorepo versions)
rm ~/.claude/commands/plan.md
rm ~/.claude/commands/review.md
rm ~/.claude/commands/ship.md

# 6. Optional: db-migration (Orchid ORM deprecated)
# rm -rf /srv/monorepo/.claude/skills/db-migration/
```

## What to Add/Update in CLAUDE.md / AGENTS.md

### Add to AGENTS.md (new section):
```markdown
## SPEC-066 Cleanup (2026-04-17)

### Skills Canonical Locations
| Type | Location | Examples |
|------|----------|----------|
| Cross-project | `~/.claude/skills/` | `universal-*`, `spec`, `img`, `context7-mcp` |
| Project-specific | `.claude/skills/` | `orchestrator`, `gitea-access`, `pipeline-gen` |

### Commands Canonical Locations
| Type | Location |
|------|----------|
| Project commands | `.claude/commands/` |
| Global command symlinks | `~/.claude/commands/` (→ agent-skills) |

### Obsolete Skills Removed (SPEC-066)
- `gitea-coolify-deploy` (duplicated functionality)
- `pipeline-orchestrate` (superseded by orchestrator)
- `openclaw-oauth-profiles` (OpenClaw deprecated)
- `voice` (Hermes voice is SOTA)
- `researcher` in monorepo (use global version)
- `cloudflare-terraform` (replaced by cloudflare-tunnel-enterprise)
```

### Update in CLAUDE.md:
```markdown
## Obsolete Artifacts (do not recreate)
- Nested `.claude/.claude/` directories
- Skills duplicated across global and project
- Command files in both `~/.claude/commands/` and `.claude/commands/`
```
