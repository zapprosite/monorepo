---
name: spec-024-cleanup
description: SPEC-024 — Web Post-Discontinuity Architecture Cleanup. Executa plano de limpeza de referencias web.zappro.site, archive apps/web, e update workflows CI/CD.
---

# SPEC-024: Web Post-Discontinuity Cleanup Skill

## Overview

This skill executes the SPEC-024 cleanup plan for removing deprecated `web.zappro.site` references after the OpenClaw browser integration rendered the old web stack obsolete.

## Context

- `web.zappro.site` was DISCONTINUED — replaced by OpenClaw internal browser
- `perplexity-agent` (port 4004) is the new browser-use service
- `apps/web` in monorepo is ORPHANED (never deployed, can be archived)
- 24 files reference `web.zappro.site` across CI/CD, SPECs, and docs

## Plan

The cleanup is organized in 10 vertical phases (saved in `tasks/plan-spec024.md`):

```
P0 (Snapshot) → P1 (Coolify Auth) → P2 (Deploy p-a)
    → P3 (CI/CD Cleanup) → P4 (Deploy Remap) → P5 (Docs)
    → P6 (Terraform) → P7 (Archive apps/web) → P8 (SPECs) → P9 (Final Smoke)
```

| Phase | Description | Tasks |
|-------|-------------|-------|
| P0 | ZFS Snapshot (safety) | 1 |
| P1 | Coolify API Auth Fix | 3 |
| P2 | Deploy perplexity-agent + verify secrets | 3 |
| P3 | CI/CD HEALTH_URL cleanup | 5 |
| P4 | CI/CD deploy target remap | 2 |
| P5 | Documentation updates | 5 |
| P6 | Terraform verification | 3 |
| P7 | Archive apps/web | 3 |
| P8 | SPECs cleanup | 6 |
| P9 | Final smoke test | 6 |

**Total: 31 tasks across 10 phases**

## Execution

### Quick Start

```bash
# Read the full plan
cat tasks/plan-spec024.md

# Execute phase by phase (checkpoint after each)
# P0 is already done (snapshot created)

# Start with P1 (Coolify Auth) - CRITICAL BLOCKER
# Then P2 (Deploy)

# Track progress
cat tasks/todo-spec024.md
```

### Phase Dependencies

**Critical path:** P0 → P1 → P2 → P9

P1 (Coolify auth) is the blocker for all CI/CD deploys. Coolify API returns "Unauthenticated" — need to investigate Bearer token vs session cookie vs IP allowlist.

### ZFS Snapshot

Created automatically at start:
```
tank/monorepo@spec024-pre-cleanup-2026-04-11
```

**Rollback if needed:**
```bash
sudo zfs rollback tank/monorepo@spec024-pre-cleanup-2026-04-11
```

## Inventory

### Files to Update (before any change)

**CI/CD Workflows (7 files):**
- `.github/workflows/deploy-perplexity-agent.yml` — HEALTH_URL
- `.github/workflows/deploy-main.yml` — web.zappro.site url
- `.github/workflows/rollback.yml` — HEALTH_URL
- `.gitea/workflows/deploy-perplexity-agent.yml` — HEALTH_URL
- `.gitea/workflows/deploy-main.yml` — web.zappro.site url
- `.gitea/workflows/rollback.yml` — HEALTH_URL
- `.gitea/workflows/voice-proxy-deploy.yml` — HEALTH_URL

**SPECs (4 files):**
- `docs/SPECS/SPEC-007-openclaw-oauth-profiles.md`
- `docs/SPECS/SPEC-PERPLEXITY-GITOPS.md`
- `docs/SPECS/SPEC-013-UNIFIED-CLAUDE-AGENT-MONOREPO.md`
- `docs/SPECS/SPEC-015-GITEA-ACTIONS-ENTERPRISE.md`

**Documentation (5 files):**
- `docs/OPERATIONS/guide.md`
- `docs/OPERATIONS/SKILLS/openclaw-oauth-login.md`
- `.context/docs/architecture.md`
- `SPEC.md`
- `smoke-tests/smoke-bridge-stack-e2e.sh`

**Terraform (verify only):**
- `/srv/ops/terraform/cloudflare/variables.tf` — `web` entry already correct (localhost:4004)

**Archive:**
- `apps/web/` → `archive/apps-web-YYYYMMDD/`

## Coolify API Auth Issue

**Symptom:** `curl http://localhost:8000/api/v1/services` returns `{"message":"Unauthenticated."}`

**Possible causes:**
1. IP not in Coolify AllowList
2. Bearer token doesn't work for API (needs session cookie)
3. API endpoint changed

**Investigate:**
```bash
# Test with Bearer token from Infisical
python3 -c "
from infisical_client import InfisicalClient
from infisical_client.schemas import ClientSettings, GetSecretOptions
with open('/srv/ops/secrets/infisical.service-token') as f:
    token = f.read().strip()
c = InfisicalClient(settings=ClientSettings(access_token=token, site_url='http://127.0.0.1:8200'))
key = c.getSecret(GetSecretOptions(environment='dev', project_id='e42657ef-98b2-4b9c-9a04-46c093bd6d37', secret_name='COOLIFY_API_KEY', path='/'))
print(key.secret_value)
"

# Test API
curl -s http://localhost:8000/api/v1/applications \
  -H "Authorization: Bearer <key>"
```

**Solutions:**
- Add IP to AllowList: https://cloud.zappro.site/settings/allowlist
- Use session auth instead of Bearer
- Manual deploy via Coolify UI as fallback

## Acceptance Criteria

- ✅ P0: ZFS snapshot exists (`tank/monorepo@spec024-pre-cleanup-2026-04-11`)
- ⏳ P1: Coolify API returns 200 JSON (not "Unauthenticated")
- ⏳ P2: Container `perplexity-agent` healthy + `/srv/ops/secrets` mounted
- ⏳ P3-P8: All web.zappro.site references removed from workflows, docs, SPECs
- ⏳ P7: `apps/web` archived, workspace config updated
- ⏳ P9: Full smoke test passes (Coolify deploy, health check, no broken refs)

## Skills Cheat Sheet

| Skill | When to Use |
|-------|-------------|
| `snapshot-safe` | Before destructive changes (already done) |
| `coolify-access` | Coolify API operations, deploy trigger |
| `secrets-audit` | Before git push to verify no exposed secrets |
| `smoke-test-gen` | Generate smoke tests after deploy |
| `gitea-access` | Check CI/CD status, trigger workflows |

## Related SPECs

- SPEC-PERPLEXITY-GITOPS — Perplexity Agent deployment
- SPEC-007 — OpenClaw OAuth Profiles (DEPRECATED web.zappro.site target)
- SPEC-013 — Claude Agent Monorepo
- SPEC-015 — Gitea Actions Enterprise

## Status

```
Phase 0 (ZFS Snapshot):     ✅ DONE
Phase 1 (Coolify Auth):        ⏳ PENDING (BLOCKER)
Phase 2-9:                    ⏳ PENDING
```

**Created:** 2026-04-11
**Plan:** tasks/plan-spec024.md
**Todo:** tasks/todo-spec024.md