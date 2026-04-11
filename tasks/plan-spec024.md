# SPEC-024: Web Post-Discontinuity Architecture Cleanup

**Type:** Cleanup / Migration
**Status:** PLANNING
**Created:** 2026-04-10
**Author:** will
**Related:** SPEC-PERPLEXITY-GITOPS, SPEC-007, SPEC-013, SPEC-015

---

## Context

- `web.zappro.site` was **DISCONTINUED** — the subdomain DNS/Cloudflare entry points to the old `apps/web` React app which was never deployed and is now orphaned
- OpenClaw Bot now has **internal browser** (browser-use) — external browser endpoint no longer needed
- `perplexity-agent` container running on port **4004** with MiniMax M2.7 (newly integrated)
- `apps/web` in monorepo is **ORPHANED** (React Bundle Visualiser, `dist/` exists but no container, never deployed)
- Coolify API is currently returning **"Unauthenticated"** (needs investigation)
- `/srv/ops/secrets/infisical.service-token` accessible from host but **NOT from container** (mount pending)
- `apps/perplexity-agent/docker-compose.yml` updated with volume mount but **NOT YET DEPLOYED**

---

## Problem Statement

The old `web.zappro.site` infrastructure was designed around the assumption that `apps/web` (React) would be deployed. That plan was abandoned. Instead:

1. `perplexity-agent` is the new service on port 4004 — but its docker-compose volume mount for `/srv/ops/secrets` is not yet deployed
2. Coolify API auth is broken — all CI/CD workflows that trigger deploys via Coolify will fail
3. 24 files still reference `web.zappro.site` — many as HEALTH_URL targets that no longer match the intended service
4. `apps/web` occupies space in the monorepo but has never been deployed and is not maintained
5. Terraform still defines `web = { url = "http://localhost:4004", subdomain = "web" }` — this is now correct (pointing to perplexity-agent) but should be verified after the new service is stable

---

## Goals

- [ ] Zero broken references to `web.zappro.site` after cleanup
- [ ] `perplexity-agent` container deployed and verified with working browser-use via MiniMax M2.7
- [ ] Coolify API authentication resolved
- [ ] `apps/web` archived (moved to `archive/apps-web/`)
- [ ] Terraform verified clean (no stale web entries)
- [ ] All CI/CD workflows using correct HEALTH_URL and deploy targets
- [ ] Full smoke test passes after each phase

---

## Non-Goals

- This spec does NOT cover OAuth profile persistence (SPEC-007)
- This spec does NOT cover Grafana/monitoring (existing SPEC-024 monitoring implementation is separate)
- This spec does NOT cover n8n or other services

---

## Inventory of `web.zappro.site` References (24 files)

| File | Type | Reference |
|------|------|-----------|
| `.gitea/workflows/deploy-perplexity-agent.yml` | CI | `HEALTH_URL: https://web.zappro.site/_stcore/health` |
| `.github/workflows/deploy-perplexity-agent.yml` | CI | `HEALTH_URL: https://web.zappro.site/_stcore/health` |
| `.gitea/workflows/deploy-main.yml` | CI | `url: https://web.zappro.site` + `HEALTH_URL: https://web.zappro.site/_stcore/health` |
| `.github/workflows/deploy-main.yml` | CI | `url: https://web.zappro.site` + `HEALTH_URL: https://web.zappro.site/_stcore/health` |
| `.gitea/workflows/rollback.yml` | CI | `HEALTH_URL="https://web.zappro.site/_stcore/health"` |
| `.github/workflows/rollback.yml` | CI | `HEALTH_URL="https://web.zappro.site/_stcore/health"` |
| `.gitea/workflows/voice-proxy-deploy.yml` | CI | `HEALTH_URL: https://web.zappro.site/_stcore/health` |
| `smoke-tests/smoke-bridge-stack-e2e.sh` | Smoke | References `web.zappro.site` indirectly |
| `docs/OPERATIONS/guide.md` | Docs | `web.zappro.site` in architecture section |
| `docs/OPERATIONS/SKILLS/openclaw-oauth-login.md` | Docs | Login instructions for `web.zappro.site` |
| `docs/SPECS/SPEC-007-openclaw-oauth-profiles.md` | Spec | OAuth target `web.zappro.site` |
| `docs/SPECS/SPEC-PERPLEXITY-GITOPS.md` | Spec | Container exposed at `web.zappro.site` |
| `docs/SPECS/SPEC-013-CLAUDE-CODE-CLI-INTEGRATION.md` | Spec | Smoke test target |
| `docs/SPECS/SPEC-015-GITEA-ACTIONS-ENTERPRISE.md` | Spec | CI HEALTH_URL |
| `docs/INCIDENTS/CONSOLIDATED-PREVENTION-PLAN.md` | Ops | Health check target |
| `docs/INCIDENTS/INCIDENT-2026-04-08-perplexity-gitops-gap.md` | Ops | Incident documentation |
| `obsidian/SPECS/SPEC-007-openclaw-oauth-profiles.md` | Mirror | Same as docs |
| `obsidian/SPECS/SPEC-PERPLEXITY-GITOPS.md` | Mirror | Same as docs |
| `obsidian/SPECS/SPEC-013-UNIFIED-CLAUDE-AGENT-MONOREPO.md` | Mirror | Smoke test target |
| `obsidian/SPECS/SPEC-015-GITEA-ACTIONS-ENTERPRISE.md` | Mirror | Same as docs |
| `.claude/skills/cloudflare-terraform/SKILL.md` | Skill | Services table includes `web.zappro.site` |
| `.context/docs/architecture.md` | Arch | Cloudflare Tunnel reference |
| `SPEC.md` | Root | Subdomain `web.zappro.site` DONE |
| `tasks/pipeline.json` | Tasks | Task titles referencing `web.zappro.site` (T4.2, T4.3) |

---

## Vertical Slices (10 Phases)

```
PHASE 0 ──── Snapshot (safety checkpoint, no dependencies)
    │
PHASE 1 ──── Coolify API Auth Investigation
    │         └─→ unblocks ALL deploy workflows
    │
PHASE 2 ──── Deploy perplexity-agent with new volume mounts
    │         └─→ verifies Infisical token accessible in container
    │
PHASE 3 ──── CI/CD HEALTH_URL Cleanup (.github + .gitea workflows)
    │
PHASE 4 ──── CI/CD Deploy Target Remapping (deploy-main.yml)
    │
PHASE 5 ──── Documentation Updates (SPECs, guides, docs)
    │
PHASE 6 ──── Terraform Verification + Skill Update
    │
PHASE 7 ──── Archive apps/web
    │
PHASE 8 ──── SPECs Cleanup (remove/update stale references)
    │
PHASE 9 ──── Final Smoke Test + Acceptance Verification
```

---

## Dependency Graph

```
                    ┌─────────────────┐
                    │  PHASE 0        │
                    │  ZFS Snapshot   │
                    └───────┬─────────┘
                            │
            ┌──────────────┴──────────────┐
            │                             │
    ┌───────▼─────────┐         ┌────────▼────────┐
    │  PHASE 1        │         │  PHASE 2        │
    │  Coolify API    │         │  Deploy p-a     │
    │  Auth Fix       │         │  + volume mount │
    └───────┬─────────┘         └────────┬────────┘
            │                            │
            │    ┌───────────────────────┘
            │    │
    ┌───────▼────▼────────┐
    │  PHASE 3            │
    │  CI/CD HEALTH_URL   │◄──────────────────────┐
    └───────┬─────────────┘                       │
            │                                     │
    ┌───────▼─────────────┐                       │
    │  PHASE 4            │                       │
    │  CI/CD Deploy       │◄──────────────────────┤
    │  Target Remap       │                       │
    └───────┬─────────────┘                       │
            │                                     │
    ┌───────▼─────────────┐         ┌────────────▼────────┐
    │  PHASE 5            │         │  PHASE 6             │
    │  Documentation     │         │  Terraform + Skill  │◄────┐
    │  Updates           │         │  Verification        │     │
    └───────┬─────────────┘         └──────────┬──────────┘     │
            │                                  │               │
    ┌───────▼─────────────┐           ┌─────────▼──────────┐  │
    │  PHASE 8            │           │  PHASE 7            │  │
    │  SPECs Cleanup      │           │  Archive apps/web   │  │
    └───────┬─────────────┘           └─────────┬──────────┘  │
            │                                  │               │
            └──────────────────────────────────┴───────────────┘
                            │
                    ┌──────▼─────────┐
                    │  PHASE 9       │
                    │  Final Smoke   │
                    │  Test         │
                    └───────────────┘
```

---

## Phase 0 — ZFS Snapshot (Safety Checkpoint)

**Goal:** Create a ZFS snapshot before any destructive changes.

### Task 0.1 — Create pre-cleanup ZFS snapshot
**File:** N/A (host operation)
**Command:**
```bash
# On host (srv):
sudo zfs snapshot -r rpool/data@spec024-pre-cleanup-2026-04-10
sudo zfs list -t snapshot rpool/data | grep spec024
```

**Acceptance Criteria:**
- Snapshot `rpool/data@spec024-pre-cleanup-2026-04-10` exists

**Verification:**
```bash
sudo zfs list -t snapshot rpool/data | grep spec024
# Expected: rpool/data@spec024-pre-cleanup-2026-04-10
```

---

## Phase 1 — Coolify API Authentication Investigation

**Goal:** Resolve the "Unauthenticated" response from Coolify API. All CI/CD workflows are blocked by this.

### Task 1.1 — Diagnose Coolify API authentication failure
**File:** N/A
**Command:**
```bash
# Test Coolify API directly from host
curl -s -w "\n%{http_code}" http://localhost:8000/api/v1/applications \
  -H "Authorization: Bearer $(cat /srv/ops/secrets/coolify-api-key.secret 2>/dev/null || echo 'INVALID')"

# Also test with the secret from Infisical if available
```

**Acceptance Criteria:**
- Coolify API returns 200 with application list (not 401 "Unauthenticated")

**Verification:**
- `curl -s http://localhost:8000/api/v1/applications -H "Authorization: Bearer <key>"` returns JSON with `data` array

### Task 1.2 — Update Coolify API key in Gitea Secrets if needed
**File:** Gitea Actions Secrets (`git.zappro.site` → Settings → Secrets)
**Command:** Manual — compare Infisical `COOLIFY_API_KEY` vs Gitea secret

**Acceptance Criteria:**
- Gitea secret matches Infisical value exactly (no whitespace, no trailing newline)

**Verification:**
```bash
# Compare values (do NOT print secrets)
infisical_val=$(curl -s -X GET "https://vault.zappro.site/api/v3/secrets/COOLIFY_API_KEY" ...)
gitea_val="<compare via Gitea UI only>"
```

### Task 1.3 — Verify GitHub Actions Coolify secrets
**File:** GitHub repo Settings → Secrets
**Command:** Manual — verify `COOLIFY_URL` and `COOLIFY_API_KEY` match Infisical

**Acceptance Criteria:**
- GitHub secret `COOLIFY_API_KEY` is current (not expired, matches Infisical)

---

## Phase 2 — Deploy perplexity-agent with New Volume Mounts

**Goal:** Deploy the updated `docker-compose.yml` that mounts `/srv/ops/secrets` into the container, and verify MiniMax M2.7 browser is operational.

### Task 2.1 — Trigger Coolify deploy for perplexity-agent
**File:** N/A (Coolify operation)
**Command:**
```bash
# Option A: Via Coolify UI (coolify.zappro.site)
#   Navigate to perplexity-agent → Redeploy

# Option B: Via Gitea Action
git push origin main  # (if changes pending)
```

**Acceptance Criteria:**
- Container `perplexity-agent` status = `running` or `idle` in Coolify dashboard
- Volume mount `/srv/ops/secrets:/srv/ops/secrets:ro` applied

**Verification:**
```bash
docker exec perplexity-agent ls -la /srv/ops/secrets/
# Expected: infisical.service-token visible inside container
```

### Task 2.2 — Verify Infisical token accessible inside container
**File:** N/A
**Command:**
```bash
docker exec perplexity-agent cat /srv/ops/secrets/infisical.service-token | head -c 5
# Expected: non-empty token (first 5 chars visible)
```

**Acceptance Criteria:**
- `/srv/ops/secrets/infisical.service-token` readable inside container

**Verification:**
```bash
docker exec perplexity-agent python3 -c "
import urllib.request
try:
    urllib.request.urlopen('http://localhost:4004/_stcore/health', timeout=5)
    print('HEALTH OK')
except Exception as e:
    print(f'HEALTH FAIL: {e}')
"
# Expected: HEALTH OK
```

### Task 2.3 — Verify browser-use operational with MiniMax M2.7
**File:** `apps/perplexity-agent/main.py` (updated code)
**Command:**
```bash
# Test browser invocation
docker logs perplexity-agent --tail 30 2>&1 | grep -i "browser\|chromium\|playwright\|error" | head -20
```

**Acceptance Criteria:**
- Container logs show no chromium/playwright fatal errors on startup
- `curl -s http://localhost:4004/_stcore/health` returns HTTP 200

**Verification:**
```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:4004/_stcore/health
# Expected: 200
```

---

## Phase 3 — CI/CD HEALTH_URL Cleanup

**Goal:** Replace all `web.zappro.site/_stcore/health` references with the correct health endpoint for each target service. There are two categories:
1. `perplexity-agent` HEALTH_URLs → should point to `http://localhost:4004/_stcore/health` (Gitea Actions) or remain `https://web.zappro.site/_stcore/health` with updated DNS after Terraform verification
2. `monorepo-web` HEALTH_URLs → these are for the old React app — need careful mapping

### Task 3.1 — Update `.github/workflows/deploy-perplexity-agent.yml` HEALTH_URL
**File:** `.github/workflows/deploy-perplexity-agent.yml`
**Change:**
```yaml
# BEFORE:
HEALTH_URL: https://web.zappro.site/_stcore/health
# AFTER:
HEALTH_URL: http://localhost:4004/_stcore/health
```
*(Note: Gitea Actions runners reach host network directly, so localhost:4004 works)*

**Verification:**
```bash
grep -n "HEALTH_URL" .github/workflows/deploy-perplexity-agent.yml
# Expected: HEALTH_URL: http://localhost:4004/_stcore/health
```

### Task 3.2 — Update `.gitea/workflows/deploy-perplexity-agent.yml` HEALTH_URL
**File:** `.gitea/workflows/deploy-perplexity-agent.yml`

**Verification:**
```bash
grep -n "HEALTH_URL" .gitea/workflows/deploy-perplexity-agent.yml
# Expected: HEALTH_URL: http://localhost:4004/_stcore/health
```

### Task 3.3 — Update `.github/workflows/rollback.yml` HEALTH_URL
**File:** `.github/workflows/rollback.yml`
**Line 234:** `HEALTH_URL="https://web.zappro.site/_stcore/health"`

**Verification:**
```bash
grep -n "HEALTH_URL" .github/workflows/rollback.yml
# Expected: HEALTH_URL="http://localhost:4004/_stcore/health"
```

### Task 3.4 — Update `.gitea/workflows/rollback.yml` HEALTH_URL
**File:** `.gitea/workflows/rollback.yml`
**Line 234:** `HEALTH_URL="https://web.zappro.site/_stcore/health"`

**Verification:**
```bash
grep -n "HEALTH_URL" .gitea/workflows/rollback.yml
# Expected: HEALTH_URL="http://localhost:4004/_stcore/health"
```

### Task 3.5 — Update `.gitea/workflows/voice-proxy-deploy.yml` HEALTH_URL
**File:** `.gitea/workflows/voice-proxy-deploy.yml`
**Line 15:** `HEALTH_URL: https://web.zappro.site/_stcore/health`

**Verification:**
```bash
grep -n "HEALTH_URL" .gitea/workflows/voice-proxy-deploy.yml
# Expected: HEALTH_URL: http://localhost:4004/_stcore/health (or appropriate target)
```

---

## Phase 4 — CI/CD Deploy Target Remapping

**Goal:** Update deploy workflows that reference `web.zappro.site` as an application deploy target (not just health check). Specifically `deploy-main.yml` which maps app names to Coolify UUIDs.

### Task 4.1 — Update `.gitea/workflows/deploy-main.yml`
**File:** `.gitea/workflows/deploy-main.yml`
**Changes:**
- Line 115: `url: https://web.zappro.site` → human gate URL should be `https://git.zappro.site` (not web)
- Line 223: `HEALTH_URL: https://web.zappro.site/_stcore/health` → remove or point to correct service

**Note:** The `deploy-main.yml` deploys `monorepo-web` (the old React app). If this app is no longer deployed, the workflow should either:
- Be disabled/archived, OR
- Be redirected to deploy the correct application

**Verification:**
```bash
grep -n "web.zappro.site" .gitea/workflows/deploy-main.yml
# Expected: no results (or only comments)
```

### Task 4.2 — Update `.github/workflows/deploy-main.yml`
**File:** `.github/workflows/deploy-main.yml`
**Changes:** Same as 4.1

**Verification:**
```bash
grep -n "web.zappro.site" .github/workflows/deploy-main.yml
# Expected: no results
```

---

## Phase 5 — Documentation Updates

**Goal:** Update all documentation files that reference `web.zappro.site`.

### Task 5.1 — Update `docs/OPERATIONS/guide.md`
**File:** `docs/OPERATIONS/guide.md`

**Verification:**
```bash
grep -n "web.zappro.site" docs/OPERATIONS/guide.md
# Expected: no results
```

### Task 5.2 — Update `docs/OPERATIONS/SKILLS/openclaw-oauth-login.md`
**File:** `docs/OPERATIONS/SKILLS/openclaw-oauth-login.md`
**Note:** This doc describes OAuth login flow to `web.zappro.site`. Since the site is discontinued, this guide needs either:
- Update to point to the new perplexity-agent URL directly, OR
- Archive with note that `web.zappro.site` is EOL

**Verification:**
```bash
grep -n "web.zappro.site" docs/OPERATIONS/SKILLS/openclaw-oauth-login.md
# Expected: no results
```

### Task 5.3 — Update `.context/docs/architecture.md`
**File:** `.context/docs/architecture.md`
**Line 118:** Cloudflare Tunnel reference

**Verification:**
```bash
grep -n "web.zappro.site" .context/docs/architecture.md
# Expected: no results
```

### Task 5.4 — Update `SPEC.md`
**File:** `SPEC.md`
**Lines 114, 182, 192:** References to `web.zappro.site` subdomain

**Verification:**
```bash
grep -n "web.zappro.site" SPEC.md
# Expected: no results
```

### Task 5.5 — Update `smoke-tests/smoke-bridge-stack-e2e.sh`
**File:** `smoke-tests/smoke-bridge-stack-e2e.sh`
**Note:** Check if it references `web.zappro.site` directly (Step 7 references `chat.zappro.site` which is separate)

**Verification:**
```bash
grep -n "web.zappro.site" smoke-tests/smoke-bridge-stack-e2e.sh
# Expected: no results
```

---

## Phase 6 — Terraform Verification + Skill Update

**Goal:** Verify Terraform `web` entry is correct, update cloudflare-terraform skill documentation.

### Task 6.1 — Verify Terraform `web` service entry
**File:** `/srv/ops/terraform/cloudflare/variables.tf`
**Lines 105-109:**
```hcl
web = {
  url              = "http://localhost:4004"
  subdomain        = "web"
  http_host_header = null
}
```

**Note:** This is already correct — `localhost:4004` is where perplexity-agent runs. No change needed unless the service URL changes.

**Verification:**
```bash
grep -A4 "web = {" /srv/ops/terraform/cloudflare/variables.tf
# Expected: url = "http://localhost:4004", subdomain = "web"
```

### Task 6.2 — Update `.claude/skills/cloudflare-terraform/SKILL.md`
**File:** `.claude/skills/cloudflare-terraform/SKILL.md`
**Line 78:** Services table includes `web.zappro.site` — verify accuracy and add note about the service being perplexity-agent

**Verification:**
```bash
grep -n "web.zappro.site" .claude/skills/cloudflare-terraform/SKILL.md
# Expected: table entry shows localhost:4004 with note "perplexity-agent"
```

### Task 6.3 — Run `terraform plan` to verify no stale resources
**File:** `/srv/ops/terraform/cloudflare/` (host operation)
**Command:**
```bash
cd /srv/ops/terraform/cloudflare
terraform plan -out=tfplan 2>&1 | grep -E "web|changed|deleted"
```

**Acceptance Criteria:**
- `terraform plan` shows no unexpected deletions
- `web` resource shows as unchanged or correctly updated

---

## Phase 7 — Archive apps/web

**Goal:** Move `apps/web` to `archive/apps-web/` to mark it as orphaned/abandoned. This keeps the code accessible but clearly marks it as no longer maintained.

### Task 7.1 — Archive `apps/web` directory
**Command (host):**
```bash
# On host:
mv /srv/monorepo/apps/web /srv/monorepo/archive/apps-web-$(date +%Y%m%d)
# Example: archive/apps-web-20260410
```

**Note:** Do NOT use `git mv` — this would create a massive diff. Just move the directory and add a `.archived` marker.

**Verification:**
```bash
ls /srv/monorepo/archive/apps-web-20260410/
# Expected: same contents as former apps/web
ls /srv/monorepo/apps/web
# Expected: directory not found
```

### Task 7.2 — Create `apps/web.archive` marker file in monorepo root
**File:** `apps/web.archive` (new file)
**Content:**
```
This directory was archived on 2026-04-10 as part of SPEC-024 cleanup.

The apps/web React application (Bundle Visualiser) was never deployed and
is now orphaned. The service previously targeted by web.zappro.site has
been replaced by perplexity-agent (port 4004).

Archived location: /srv/monorepo/archive/apps-web-20260410/
Related: SPEC-024, SPEC-PERPLEXITY-GITOPS
```

**Verification:**
```bash
cat /srv/monorepo/apps/web.archive
# Expected: archive notice content
```

### Task 7.3 — Remove `apps/web` from any turbo/pnpm workspace config if referenced
**Files to check:** `pnpm-workspace.yaml`, `turbo.json`, `package.json` (root)

**Command:**
```bash
grep -rn "apps/web" /srv/monorepo/pnpm-workspace.yaml /srv/monorepo/turbo.json 2>/dev/null
```

**Acceptance Criteria:**
- No workspace config references `apps/web` (or it's commented out)

---

## Phase 8 — SPECs Cleanup

**Goal:** Remove or update stale `web.zappro.site` references in SPEC documents.

### Task 8.1 — Update SPEC-007 (OpenClaw OAuth Profiles)
**File:** `docs/SPECS/SPEC-007-openclaw-oauth-profiles.md`
**Changes:**
- Line 12: "comandar Perplexity Agent em `web.zappro.site`" → "comandar Perplexity Agent via localhost:4004"
- Line 22: Navigate target → localhost:4004 or perplexity-agent local URL
- Line 30: "web.zappro.site:4004" → "localhost:4004"
- Line 52: Remove web.zappro.site reference
- Lines 104, 146: Navigate references → localhost:4004

**Verification:**
```bash
grep -n "web.zappro.site" docs/SPECS/SPEC-007-openclaw-oauth-profiles.md
# Expected: no results
```

### Task 8.2 — Update SPEC-PERPLEXITY-GITOPS
**File:** `docs/SPECS/SPEC-PERPLEXITY-GITOPS.md`
**Changes:**
- Line 40: "web.zappro.site" → "localhost:4004" (port reference only)
- Line 98: Cloudflare Tunnel reference — keep DNS but note service changed
- Lines 250, 284: Health check verification commands

**Verification:**
```bash
grep -n "web.zappro.site" docs/SPECS/SPEC-PERPLEXITY-GITOPS.md
# Expected: no results
```

### Task 8.3 — Update SPEC-013 (Unified Claude Agent Monorepo)
**File:** `docs/SPECS/SPEC-013-UNIFIED-CLAUDE-AGENT-MONOREPO.md`
**Line 423:** Smoke test command referencing `web.zappro.site`

**Verification:**
```bash
grep -n "web.zappro.site" docs/SPECS/SPEC-013-UNIFIED-CLAUDE-AGENT-MONOREPO.md
# Expected: no results
```

### Task 8.4 — Update SPEC-015 (Gitea Actions Enterprise)
**File:** `docs/SPECS/SPEC-015-GITEA-ACTIONS-ENTERPRISE.md`
**Line 447:** HEALTH_URL reference

**Verification:**
```bash
grep -n "web.zappro.site" docs/SPECS/SPEC-015-GITEA-ACTIONS-ENTERPRISE.md
# Expected: no results
```

### Task 8.5 — Update incident docs
**Files:**
- `docs/INCIDENTS/CONSOLIDATED-PREVENTION-PLAN.md`
- `docs/INCIDENTS/INCIDENT-2026-04-08-perplexity-gitops-gap.md`

**Note:** These are historical incident docs. Update if they contain misleading current-state info.

**Verification:**
```bash
grep -n "web.zappro.site" docs/INCIDENTS/CONSOLIDATED-PREVENTION-PLAN.md
# Expected: results if they describe current monitoring targets
```

### Task 8.6 — Sync to obsidian mirrors
**Command:**
```bash
# Obsidian is a read-only mirror of docs/
# After updating docs/, sync if there's a sync script:
ls /srv/monorepo/sync*.sh 2>/dev/null || echo "No sync script"
```

---

## Phase 9 — Final Smoke Test + Acceptance Verification

**Goal:** Verify the entire system is working after all changes.

### Task 9.1 — Verify perplexity-agent health
**Command:**
```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:4004/_stcore/health
# Expected: 200
```

### Task 9.2 — Verify Coolify API is authenticated
**Command:**
```bash
curl -s http://localhost:8000/api/v1/applications \
  -H "Authorization: Bearer $(cat /srv/ops/secrets/coolify-api-key.secret)" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(f\"Apps: {len(d.get('data',[]))}\")"
# Expected: Apps: N (non-zero)
```

### Task 9.3 — Verify no broken workflow references
**Command:**
```bash
# Count remaining web.zappro.site references
grep -r "web.zappro.site" .github/workflows/ .gitea/workflows/ 2>/dev/null | wc -l
# Expected: 0
```

### Task 9.4 — Verify Terraform state
**Command:**
```bash
cd /srv/ops/terraform/cloudflare
terraform show | grep -A3 'web ='
# Expected: web resource listed with localhost:4004
```

### Task 9.5 — Verify apps/web is archived
**Command:**
```bash
ls /srv/monorepo/apps/web 2>&1
# Expected: No such file or directory
ls /srv/monorepo/archive/apps-web-20260410/
# Expected: directory listing
```

### Task 9.6 — Full Gitea Action smoke test
**Command:**
```bash
# Trigger a test deploy via Gitea Actions UI
# Verify deploy-perplexity-agent workflow completes successfully
```

---

## Checkpoints

| Checkpoint | Phase | Criteria |
|-----------|-------|----------|
| CP-0 | Phase 0 | ZFS snapshot exists |
| CP-1 | Phase 1 | Coolify API returns 200 (authenticated) |
| CP-2 | Phase 2 | perplexity-agent container healthy + secrets mounted |
| CP-3 | Phase 3 | All CI/CD workflow HEALTH_URLs updated |
| CP-4 | Phase 4 | All CI/CD deploy workflow references fixed |
| CP-5 | Phase 5 | Documentation updated (no stale references) |
| CP-6 | Phase 6 | Terraform plan shows no stale deletions |
| CP-7 | Phase 7 | apps/web archived, workspace config clean |
| CP-8 | Phase 8 | SPECs updated and synced to obsidian |
| CP-9 | Phase 9 | All acceptance criteria verified |

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Coolify API auth unfixable | Low | Critical | Have backup: manual deploy via Coolify UI |
| perplexity-agent browser-use fails | Medium | High | Verify via `docker logs` before declaring deploy success |
| GitOps workflows broken after edit | Medium | High | Test each workflow individually after edit |
| apps/web has untracked deps | Low | Medium | Archive rather than delete, verify workspace still builds |
| Terraform misapplied | Medium | High | Snapshot first, `terraform plan` before `apply` |

---

## Files to Modify

| File | Phase | Change |
|------|-------|--------|
| `.github/workflows/deploy-perplexity-agent.yml` | 3 | HEALTH_URL update |
| `.gitea/workflows/deploy-perplexity-agent.yml` | 3 | HEALTH_URL update |
| `.github/workflows/rollback.yml` | 3 | HEALTH_URL update |
| `.gitea/workflows/rollback.yml` | 3 | HEALTH_URL update |
| `.gitea/workflows/voice-proxy-deploy.yml` | 3 | HEALTH_URL update |
| `.gitea/workflows/deploy-main.yml` | 4 | Remove web.zappro.site references |
| `.github/workflows/deploy-main.yml` | 4 | Remove web.zappro.site references |
| `docs/OPERATIONS/guide.md` | 5 | Remove stale references |
| `docs/OPERATIONS/SKILLS/openclaw-oauth-login.md` | 5 | Update or archive |
| `.context/docs/architecture.md` | 5 | Remove stale reference |
| `SPEC.md` | 5 | Remove stale reference |
| `.claude/skills/cloudflare-terraform/SKILL.md` | 6 | Update services table |
| `/srv/ops/terraform/cloudflare/variables.tf` | 6 | Verify (no change expected) |
| `docs/SPECS/SPEC-007-openclaw-oauth-profiles.md` | 8 | Update all references |
| `docs/SPECS/SPEC-PERPLEXITY-GITOPS.md` | 8 | Update all references |
| `docs/SPECS/SPEC-013-UNIFIED-CLAUDE-AGENT-MONOREPO.md` | 8 | Update all references |
| `docs/SPECS/SPEC-015-GITEA-ACTIONS-ENTERPRISE.md` | 8 | Update all references |
| `archive/apps-web-YYYYMMDD/` | 7 | Move directory |
| `apps/web.archive` | 7 | Create marker file |
| `pnpm-workspace.yaml` | 7 | Remove apps/web reference if present |

---

## Dependencies on External Systems

| System | Access | Used In |
|--------|--------|---------|
| Coolify API | `http://localhost:8000` | Phase 1, 2, 9 |
| Infisical | `https://vault.zappro.site` | Phase 2 |
| Gitea | `https://git.zappro.site` | Phase 4, 9 |
| GitHub | `https://github.com` | Phase 4 |
| Terraform Cloudflare | `/srv/ops/terraform/cloudflare/` | Phase 6 |
| ZFS (host) | `rpool/data` | Phase 0 |

---

## Command Reference

```bash
# Phase 0: Snapshot
sudo zfs snapshot -r rpool/data@spec024-pre-cleanup-2026-04-10

# Phase 1: Test Coolify API
curl -s http://localhost:8000/api/v1/applications \
  -H "Authorization: Bearer $(cat /srv/ops/secrets/coolify-api-key.secret)"

# Phase 2: Verify container
docker exec perplexity-agent cat /srv/ops/secrets/infisical.service-token | wc -c
curl -s -o /dev/null -w "%{http_code}" http://localhost:4004/_stcore/health

# Phase 3-4: Count remaining references
grep -r "web.zappro.site" .github/workflows/ .gitea/workflows/ 2>/dev/null | wc -l

# Phase 6: Terraform
cd /srv/ops/terraform/cloudflare && terraform plan

# Phase 7: Archive
mv /srv/monorepo/apps/web /srv/monorepo/archive/apps-web-20260410

# Phase 9: Final verification
curl -s -o /dev/null -w "%{http_code}" http://localhost:4004/_stcore/health
```
