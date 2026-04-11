# Code vs Documentation Divergence Audit

**Date:** 2026-04-11
**Auditor:** Claude Code
**Scope:** /srv/monorepo

---

## Executive Summary

| Category | Count |
|----------|-------|
| **Aligned** | Items where code matches spec |
| **Drift** | Items where code diverged from spec |
| **Orphan** | SPECs with no implementation |
| **Ghost** | Code with no SPEC |

---

## 1. APPS & PACKAGES

### 1.1 Apps - Actual vs Documented

#### `apps/api` ✅ ALIGNED
| Aspect | Spec/Doc | Reality |
|--------|----------|---------|
| Stack | Fastify + tRPC + Orchid ORM | Fastify + tRPC + Orchid ORM |
| Port | Not specified | 3000 (from docker-compose) |
| DB | PostgreSQL | PostgreSQL |
| CLAUDE.md | Exists, matches stack | ✅ |
| SPEC | None explicit | N/A |

#### `apps/orchestrator` ⚠️ DRIFT
| Aspect | Spec/Doc | Reality |
|--------|----------|---------|
| CLAUDE.md | Does NOT exist | Missing governance doc |
| Description | "Universal Orchestration System" in package.json | Matches |
| Stack | Node.js + tRPC + YAML + human gates + agent pool + MCP adapters | Matches |
| SPEC | No SPEC found | Orphan feature |

#### `apps/perplexity-agent` ⚠️ DRIFT
| Aspect | Spec/Doc | Reality |
|--------|----------|---------|
| Stack | Python + Streamlit + LangChain | Python + Streamlit (LangChain not found in pyproject.toml) |
| Browser automation | Yes | browser_agent.py exists |
| SPEC | SPEC-PERPLEXITY-GITOPS (APPROVED) | Not implemented per spec |
| docker-compose.yml | Referenced in SPEC-PERPLEXITY-GITOPS | Exists |
| CLAUDE.md | Does NOT exist | Missing governance doc |

#### `apps/workers` ❌ GHOST
| Aspect | Reality |
|--------|---------|
| Status | Directory exists but appears empty or minimal |
| CLAUDE.md | Does NOT exist |
| SPEC | No SPEC found |
| Purpose | Unclear from codebase |

#### `apps/web` ❌ GHOST (was mentioned in AGENTS.md)
| Aspect | Spec/Doc | Reality |
|--------|----------|---------|
| AGENTS.md says | "React 19 + MUI + tRPC" | ❌ DOES NOT EXIST |
| Actual location | - | `web.archive/` exists |
| SPEC | No SPEC | - |

### 1.2 Packages - Actual vs Documented

#### `packages/ui` (actually `@connected-repo/ui-mui`) ✅ ALIGNED
| Aspect | Reality |
|--------|---------|
| Name in package.json | `@connected-repo/ui-mui` |
| Structure | src/components, form, layout, feedback, data-display, rhf-form, theme |
| CLAUDE.md | Exists, very detailed (1000+ lines) |
| SPEC | None explicit |

#### `packages/zod-schemas` ✅ ALIGNED
| Aspect | Reality |
|--------|---------|
| CLAUDE.md | Exists |
| Entity schemas | 30+ zod files matching API modules |
| SPEC | No SPEC |

#### `packages/config` ✅ ALIGNED
| Aspect | Reality |
|--------|---------|
| Files | base.json, library.json, react-library.json, vite.json |
| CLAUDE.md | Does NOT exist |
| SPEC | No SPEC |

#### `packages/db` ✅ ALIGNED
| Aspect | Reality |
|--------|---------|
| Structure | Orchid ORM with migrations |
| CLAUDE.md | Does NOT exist |
| SPEC | No SPEC |

#### `packages/email` ✅ ALIGNED
| Aspect | Reality |
|--------|---------|
| Description | React Email templates for Resend |
| README.md | Exists |
| CLAUDE.md | Does NOT exist |
| SPEC | No SPEC |

#### `packages/env` ✅ ALIGNED
| Aspect | Reality |
|--------|---------|
| Description | Zod-validated environment variables |
| README.md | Exists |
| CLAUDE.md | Does NOT exist |
| SPEC | No SPEC |

#### `packages/trpc` ✅ ALIGNED
| Aspect | Reality |
|--------|---------|
| Structure | client.ts, server.ts |
| CLAUDE.md | Does NOT exist |
| SPEC | No SPEC |

---

## 2. SPEC-013 (Unified Claude Agent Monorepo) vs Reality

### 2.1 Project Structure

| SPEC-013 Says | Reality | Status |
|---------------|---------|--------|
| `.gitea/workflows/ci.yml` | `.gitea/workflows/ci.yml` + `ci-feature.yml` | ✅ |
| `.gitea/workflows/ai-review.yml` | `.gitea/workflows/code-review.yml` | ⚠️ Different name |
| `.gitea/workflows/deploy.yml` | `.gitea/workflows/deploy-main.yml` | ⚠️ Different name |
| `.gitea/workflows/rollback.yml` | `.gitea/workflows/rollback.yml` | ✅ |
| `.claude/commands/` - 16 files | `.claude/commands/` - 9 files | ⚠️ DRIFT |
| `.claude/skills/` - 32 skills | `.claude/skills/` - 35 skills | ✅ (more than spec) |
| `.claude/rules/` - 4 rules | `.claude/rules/` - 4 rules | ✅ |
| `.claude/agents/` - 14 agents | `.claude/agents/` - exists | ⚠️ Need to verify count |
| `.agent/` standalone | `.agent/` exists | ✅ |
| `scripts/` utilities | `scripts/` - 22 scripts | ✅ |

### 2.2 Commands (`.claude/commands/`)

| SPEC-013 Lists | Reality |
|----------------|---------|
| feature.md | ✅ |
| ship.md | Missing |
| turbo.md | ✅ |
| scaffold.md | ✅ |
| pg.md | ✅ |
| rr.md | Missing |
| sec.md | Missing |
| ss.md | Missing |
| hg.md | Missing |
| plan.md | Missing |
| spec.md | Missing |
| commit.md | Missing |
| dv.md | Missing |
| rs.md | Missing |
| update-docs.md | ✅ |
| img.md | ✅ |
| mirror.md | ✅ |
| cursor-loop.md | ✅ |

**Status:** ⚠️ DRIFT - Only 9 of 16+ commands exist

### 2.3 Fixes Required (SPEC-013 Section 6)

| Issue | Spec Says | Reality |
|-------|-----------|---------|
| Circular symlink | Remove `.agent/` → `agent-skills/.claude/` | Not verified |
| Skills deduplication | Audit between `.claude/` and `~/.claude/` | Not verified |
| Archive session data | < 50MB target | Not verified |
| Remove `.github/workflows/` | Document as deprecated | `.github/` exists |

---

## 3. SPEC-024 (Monitoring) vs Reality

### 3.1 Implementation Status

| Phase | SPEC-024 Says | Reality |
|-------|---------------|---------|
| Phase 1 | Docker HEALTHCHECK for node-exporter, loki | **NOT in monorepo** - monitoring is at `/srv/apps/monitoring/` |
| Phase 2 | Restart loop protection | SPEC specifies, implementation unknown |
| Phase 3 | Alert routing (Prometheus → AlertManager → Telegram) | Partially implemented per MONITORING.md |
| Phase 4 | Grafana dashboards | Exists at `/srv/data/monitoring/grafana/` |
| Phase 5 | `/heal` CLI commands | SPEC-023-unified-healing-cli.md exists, implementation unknown |
| Phase 6 | Grafana Alloy migration | Not started |

### 3.2 Key Finding

**SPEC-024 implementation lives OUTSIDE the monorepo at:**
- `/srv/apps/monitoring/` - docker-compose
- `/srv/data/monitoring/` - configs, dashboards, alertmanager

This is **aligned** with SPEC-024 noting "monitoring stack is external to monorepo" but creates **documentation gap** - SPEC-024 is in `/srv/monorepo/docs/SPECS/` but implementation is elsewhere.

---

## 4. SPEC Coverage Analysis

### 4.1 IMPLEMENTING (6 SPECs)

| SPEC | Title | Gap |
|------|-------|-----|
| SPEC-100 | Unified Claude/Agent Pipeline | Infrastructure at `/srv/ops`, not verified |
| SPEC-CURSOR-LOOP | Autonomous Cursor AI Loop | Scripts exist, implementation partial |
| SPEC-TRANSFORM-MONOREPO | Monorepo Refinement | Not verified |
| SPEC-TROCAR-ROUPA | Template Clothing Swap | Not verified |
| SPEC-013-openclaw-ceo-mix-voice-stack | OpenClaw CEO MIX Voice | Not verified |
| SPEC-014-openclaw-tts-route-fix | OpenClaw TTS Route Fix | Not verified |

### 4.2 APPROVED (1 SPEC)

| SPEC | Title | Implementation Status |
|------|-------|----------------------|
| SPEC-PERPLEXITY-GITOPS | Perplexity Agent GitOps | Partial - docker-compose exists, deploy workflow exists, but CI/CD loop not verified |

### 4.3 DRAFT (14 SPECs) - No Implementation Expected

These are drafts, not orphans.

### 4.4 Orphan Features (Code exists, no SPEC)

| Feature | Location | Risk |
|---------|----------|------|
| `apps/orchestrator` | Node.js orchestration system | Medium - no governance |
| `apps/workers` | Empty/minimal | High - unclear purpose |
| `packages/config` | Config files | Low - tooling |
| `packages/email` | Email templates | Low - utility |
| `packages/env` | Env validation | Low - utility |

---

## 5. CLAUDE.md Analysis

### 5.1 Project-Level (root)

| File | Status | Notes |
|------|--------|-------|
| `CLAUDE.md` | ✅ Exists | Refers to AGENTS.md |
| `AGENTS.md` | ⚠️ DRIFT | Mentions `apps/web` which doesn't exist |

### 5.2 App-Level CLAUDE.md

| App | CLAUDE.md | Notes |
|-----|-----------|-------|
| `apps/api` | ✅ Exists | Matches reality |
| `apps/orchestrator` | ❌ Missing | Should exist |
| `apps/perplexity-agent` | ❌ Missing | README.md exists |
| `apps/workers` | ❌ Missing | Empty directory |

### 5.3 Package-Level CLAUDE.md

| Package | CLAUDE.md | Notes |
|---------|-----------|-------|
| `packages/ui` | ✅ Exists | Very detailed |
| `packages/zod-schemas` | ✅ Exists | Matches reality |
| `packages/config` | ❌ Missing | N/A - config only |
| `packages/db` | ❌ Missing | N/A - ORM setup |
| `packages/email` | ❌ Missing | README exists |
| `packages/env` | ❌ Missing | README exists |
| `packages/trpc` | ❌ Missing | N/A - tRPC utils |

---

## 6. .claude/ Directory Analysis

### 6.1 Commands (`.claude/commands/`)

| Command | Exists | Notes |
|---------|--------|-------|
| cursor-loop.md | ✅ | Not in SPEC-013 original list |
| feature.md | ✅ | Matches SPEC-013 |
| img.md | ✅ | Matches |
| mirror.md | ✅ | Custom addition |
| pg.md | ✅ | Matches |
| scaffold.md | ✅ | Matches |
| sync.md | ✅ | Custom addition |
| turbo.md | ✅ | Matches |
| update-docs.md | ✅ | Matches |

**Missing from SPEC-013:** ship.md, rr.md, sec.md, ss.md, hg.md, plan.md, spec.md, commit.md, dv.md, rs.md

### 6.2 Skills (`.claude/skills/`)

**35 skills exist** - exceeds SPEC-013's "32 skills"

Notable additions not in SPEC-013:
- `audit-workflow`
- `cloudflare-terraform`
- `coolify-access`
- `gitea-access`
- `n8n`
- `skill-inventory`
- `spec-024-cleanup`

### 6.3 Rules (`.claude/rules/`)

| Rule | Exists |
|------|--------|
| backend.md | ✅ |
| search.md | ✅ |
| openclaw-audio-governance.md | ✅ |
| REVIEW-SKILLS.md | ✅ |

**Matches SPEC-013**

### 6.4 Agents (`.claude/agents/`)

Not enumerated - needs manual count.

---

## 7. CI/CD Workflows

### 7.1 Gitea Actions (`.gitea/workflows/`)

| Workflow | SPEC-013 | Reality |
|----------|----------|---------|
| ci.yml | ✅ | ✅ |
| ci-feature.yml | Not in spec | ✅ Extra |
| code-review.yml | ai-review.yml (name diff) | ✅ |
| deploy-main.yml | deploy.yml (name diff) | ✅ |
| rollback.yml | ✅ | ✅ |
| deploy-perplexity-agent.yml | Not in spec | ✅ Extra |
| daily-report.yml | Not in spec | ✅ Extra |
| failure-report.yml | Not in spec | ✅ Extra |
| voice-proxy-deploy.yml | Not in spec | ✅ Extra |
| deploy-on-green.yml | Not in spec | ✅ Extra |

**Status:** ✅ ALIGNED - Core workflows match, extras are fine

---

## 8. Scripts (`.claude/` root)

| Item | Status |
|------|--------|
| scheduled_tasks.json | ✅ Exists |
| scheduled_tasks.lock | ✅ Exists |
| pipeline.json | ✅ Exists |
| tools/ | ✅ Exists |
| workflows/ | ✅ Exists |

---

## 9. Key Divergences Summary

### Critical Gaps

1. **`apps/web` mentioned in AGENTS.md does NOT exist**
   - AGENTS.md says: `apps/web` is a React 19 + MUI + tRPC app
   - Reality: Only `web.archive/` exists
   - Action: Update AGENTS.md to remove reference or clarify archive status

2. **CLAUDE.md missing for `apps/orchestrator` and `apps/perplexity-agent`**
   - Both apps lack governance documentation
   - Action: Create CLAUDE.md files

3. **`apps/workers` is a ghost directory**
   - Exists but no implementation or SPEC
   - Action: Either implement or remove

### Documentation Gaps

4. **SPEC-024 implementation is external**
   - SPEC lives in monorepo, implementation in `/srv/apps/monitoring/`
   - Creates maintenance burden - changes need sync
   - Action: Document clearly or move implementation into monorepo

5. **SPEC-PERPLEXITY-GITOPS not fully implemented**
   - docker-compose exists, deploy workflow exists
   - But GitOps loop not verified
   - Action: Verify and update SPEC status

6. **Many packages lack CLAUDE.md**
   - `packages/email`, `packages/env`, `packages/trpc`, `packages/db`, `packages/config`
   - Low risk since they're utilities
   - Action: Consider adding if they grow

---

## 10. Recommendations

### High Priority

1. **Update AGENTS.md** - Remove `apps/web` reference or clarify it's archived
2. **Create CLAUDE.md for `apps/orchestrator`** - Document human gates, agent pool, MCP adapters
3. **Create CLAUDE.md for `apps/perplexity-agent`** - Document LangChain usage vs SPEC
4. **Audit `apps/workers`** - Either implement or remove

### Medium Priority

5. **Sync SPEC-024 with monitoring implementation** - Create cross-reference doc
6. **Verify SPEC-PERPLEXITY-GITOPS implementation** - Update status if complete
7. **Add CLAUDE.md to utility packages** - `packages/email`, `packages/env`, `packages/trpc`

### Low Priority

8. **Consider adding missing commands** from SPEC-013 (ship, rr, sec, ss, hg, plan, spec, commit, dv, rs)
9. **Verify circular symlink removal** between `.agent/` and `agent-skills/`

---

## Appendix: File Counts

| Category | Count |
|----------|-------|
| Total SPECs | 29 |
| SPECs in DRAFT | 14 |
| SPECs IMPLEMENTING | 6 |
| SPECs APPROVED | 1 |
| SPECs DONE | 3 |
| SPECs PROTEGIDO | 3 |
| Gitea workflows | 10 |
| .claude/skills | 35 |
| .claude/commands | 9 |
| Scripts in scripts/ | 22 |
| Smoke tests | 4 |
