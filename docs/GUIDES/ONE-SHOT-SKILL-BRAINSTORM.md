# One-Shot PRD-to-Deploy Pipeline — Skill Brainstorm

**Date:** 2026-04-13
**Goal:** Human writes PRD → app is live with subdomain + OAuth in < 15 minutes
**Stack:** nginx static apps + Docker Compose + Cloudflare Tunnel + Google OAuth
**Agents:** cursor-loop / prd-to-deploy (Claude Code CLI)

---

## 1. Existing Skills That Support One-Shot Flow

| Skill | Contribution to One-Shot | Gaps |
|-------|--------------------------|------|
| **`prd-to-deploy`** | **Core orchestrator** — full chain from PRD to deployed app with OAuth. Exists at `.claude/skills/prd-to-deploy/SKILL.md` | No automatic port allocation; no compose-generator; no rollback on failure; no subdomains health watcher |
| `list-web-from-zero-to-deploy` | File generation templates for static OAuth apps | Not orchestrating; only generates files |
| `cloudflare-terraform` | Handles subdomain DNS + tunnel ingress via Terraform | Manual invocation required |
| `coolify-access` | Deploys via Coolify API; restarts services | No compose generation; separate from app scaffold |
| `infra-from-spec` | Generates Docker Compose, Terraform subdomain, Prometheus alerts from natural language | Not end-to-end; doesn't orchestrate |
| `backend-scaffold` | Fastify + tRPC + OrchidORM from Zod schema | Only backend; no deploy, no OAuth, no network |
| `human-gates` | Identifies blockers requiring approval | Does not manage confirmation flow or async handoffs |
| `deploy-validate` | Pre-deploy health validation | Post-deploy only; not part of one-shot orchestration |
| `smoke-test-gen` | Generates smoke tests from specs | Does not execute; not integrated into deploy |
| `secrets-audit` | Scans for hardcoded secrets | Prevents leaks but not part of deploy chain |
| `doc-maintenance` | Syncs PORTS.md, SUBDOMAINS.md, API ref | Manual sync; could be automated post-deploy |
| `coolify-deploy-trigger` | Trigger Coolify deploy via API | No health-check wait; no rollback |
| `coolify-health-check` | Verify health endpoint after deploy | Waits and validates HTTP 200 |

### Key Integration Points Already Exist
- `prd-to-deploy` → `cloudflare-terraform` → `coolify-access` chain is defined
- `/infra-gen terraform subdomain` reads PORTS.md/SUBDOMAINS.md before generating
- MiniMax LLM (1M context) handles multi-file generation in single call
- `list-web-from-zero-to-deploy/references/` has all file templates

### What's Still Needed (Gap Analysis)

| Gap | Impact | Workaround |
|-----|--------|------------|
| No automatic port allocation | Manual port selection can cause conflicts | Read PORTS.md manually, pick from range 4002-4099 |
| No compose-generator skill | Must manually create docker-compose.yml | Use list-web-from-zero-to-deploy templates |
| No rollback on failure | Failed deploy requires manual cleanup | `terraform apply` rollback manually |
| No subdomains health watcher | New app not monitored post-deploy | Manual `smoke-tunnel.sh` cron |
| No changelog generator | No auto-CHANGELOG entry | Manual entry |
| No DNS propagation checker | Smoke test fails immediately after terraform | Wait 30s manually |
| No post-deploy reporter | No summary with URLs + next steps | Manual notification |

---

## 2. Missing Skills (to create)

### 🏗️ Scaffolding Skills

#### 1. `prd-parser`
**What it does:** Extracts structured data from freeform PRD text — app name, description, dependencies, auth requirements, expected traffic, external APIs.

**Why critical:** Without this, every one-shot flow starts with a human manually creating a SPEC. PRD-parser enables "write PRD in Notion → paste into Claude Code → app is live."

**Input:** Freeform PRD text (markdown or plain)
**Output:**
```yaml
app_name: "inventory-tracker"
type: "static" | "api" | "react" | "agent"
description: "..."
subdomain: "inventory"
oauth: true | false
port: null  # auto-allocate
env_vars: [...]
dependencies: ["postgres", "redis"]
health_check_path: "/health"
```

**Dependencies:** MiniMax M2.7 (1M context for PRD analysis), `MINIMAX_API_KEY` via Infisical

**Priority:** 🔴 CRITICAL — gates entire one-shot flow

---

#### 2. `app-type-detector`
**What it does:** Analyzes PRD or app structure and selects the correct scaffolding template — static nginx, Fastify+React, Python agent, etc.

**Why critical:** Without type detection, the wrong template gets applied, causing rework.

**Input:** PRD text OR directory structure
**Output:** `static` | `fastify-react` | `fastify-tRPC` | `python-agent` | `node-agent` + confidence score

**Decision tree:**
```
Has .html files only? → static
Has package.json + src/ + tRPC? → fastify-react
Has Zod schemas in packages/zod-schemas? → fastify-tRPC
Has requirements.txt + langchain? → python-agent
Has .tsx + MUI? → react-dashboard
Default → static
```

**Dependencies:** File system access; reads `package.json`, `requirements.txt`, directory structure

---

#### 3. `template-generator`
**What it does:** Generates Dockerfile, docker-compose.yml, nginx.conf from app type + spec. Uses existing templates in `list-web-from-zero-to-deploy/references/` as base.

**Why critical:** Ensures consistent Docker patterns across all apps — healthcheck, non-root user, network isolation.

**Input:** `app-type-detector` output + `prd-parser` output + port number
**Output:** `Dockerfile`, `docker-compose.yml`, `nginx.conf` (if static)

**Templates it picks from:**
- `templates/static-nginx/` — nginx:alpine, non-root, healthcheck on :80
- `templates/fastify-tRPC/` — Fastify + tRPC + PostgreSQL
- `templates/react-mUI/` — React 19 + MUI + Vite
- `templates/python-agent/` — Python + LangChain + uvicorn

**Dependencies:** `app-type-detector`, `prd-parser`; reads existing templates from `.claude/skills/list-web-from-zero-to-deploy/references/`

---

#### 4. `port-allocator`
**What it does:** Reads PORTS.md, finds the next available port in the dev range (4002-4099 for microservices, 5000-5999 for Python), reserves it, returns the port number.

**Why critical:** Manual port selection causes conflicts. Automatic allocation ensures no collision.

**Input:** App type (`microservice` | `python` | `static`)
**Output:** `{"port": 4057, "reserved": true, "range": "4002-4099"}`

**Process:**
1. Read `/srv/ops/ai-governance/PORTS.md`
2. Parse occupied ports from `ss -tlnp` output
3. Pick first free port in correct range
4. Return port (does NOT update PORTS.md — caller is responsible)

**Dependencies:** `PORTS.md` read access; optionally `ss -tlnp` for live verification

---

#### 5. `compose-generator`
**What it does:** Generates `docker-compose.yml` with correct network, depends_on, healthcheck, and port binding from app spec. Differs from `template-generator` by focusing specifically on compose orchestration.

**Why critical:** Docker Compose is the deploy unit for Coolify. Must be correct before hitting Coolify API.

**Input:** App name, port, network name (if needed), env_vars list
**Output:** `docker-compose.yml` content (raw YAML string)

**Features:**
- Adds `healthcheck` with `test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:PORT/health"]`
- Non-root user in Dockerfile
- External network reference if service needs to join existing network (e.g., `qgtzrmi6771lt8l7x8rqx72f` for OpenClaw)
- Port binding to `127.0.0.1:PORT:80` (not exposed to host)

**Dependencies:** `port-allocator`, network knowledge from `cloudflare-terraform`

---

### 🔐 Auth Skills

#### 6. `oauth-test-validator`
**What it does:** After OAuth setup, validates the complete OAuth flow — authorization URL, callback, token exchange — using Playwright or curl.

**Why critical:** OAuth is the most common failure point. Validates before declaring deploy complete.

**Input:** Subdomain URL, expected email domain (e.g., `zappro.site`)
**Output:**
```json
{
  "authorization_url_valid": true,
  "callback_200": true,
  "token_exchange_success": true,
  "user_email_domain_correct": true,
  "errors": []
}
```

**Process:**
1. `curl -sfI https://SUBDOMAIN.zappro.site/auth/callback` → 200
2. Extract OAuth authorization URL from app
3. Simulate authorization code exchange (test creds)
4. Validate ID token claims

**Dependencies:** Google OAuth credentials in Infisical; Playwright for full flow test

---

#### 7. `session-manager`
**What it does:** Generates session storage pattern for the app — file-based (for static), Redis (for API), or memory (for ephemeral agents).

**Why critical:** Different app types need different session strategies. Generates correct pattern automatically.

**Input:** App type (`static` | `api` | `react` | `agent`)
**Output:** Session strategy + implementation snippet

| Type | Strategy | Implementation |
|------|----------|----------------|
| static | Cookie only (no server session) | JWT in localStorage |
| api | Redis session | `ioredis` + `session` middleware |
| react | Server-side session | NextAuth / tRPC context |
| agent | Ephemeral (no session) | Stateless |

---

#### 8. `auth-bypass-toggle`
**What it does:** Temporarily disables Cloudflare Access for a subdomain to allow testing without OAuth. Re-enables automatically after timeout.

**Why critical:** Debugging OAuth without this means manually editing `access.tf` and running `terraform apply` — 5-minute task becomes 30 seconds.

**Input:** Subdomain, action (`enable` | `disable`), timeout_minutes (default: 30)
**Output:** `{"status": "disabled", "expires_at": "2026-04-13T12:00:00Z", "terraform_patch": "..."}`

**Process:**
1. Patch `access.tf` to exclude subdomain from Access policy
2. `terraform apply` (local, no remote state issue)
3. Set timeout
4. After timeout, re-apply to re-enable

**Dependencies:** `cloudflare-terraform` skill; Terraform state write access

---

### 🌐 Network Skills

#### 9. `subdomain-health-watcher`
**What it does:** Cron skill that monitors all subdomains in SUBDOMAINS.md, alerts via Gotify if any are DOWN, and logs to Grafana/Loki.

**Why critical:** After one-shot deploy, human needs confidence the new app is healthy. This provides continuous monitoring without manual check.

**Input:** SUBDOMAINS.md (implicitly)
**Output:** Gotify alert if DOWN; log entry to Loki

**Cron:** `*/5 * * * *` (every 5 minutes)

**Process:**
1. Read SUBDOMAINS.md for list of subdomains
2. `curl -sfI https://SUBDOMAIN.zappro.site` for each
3. If any return non-2xx or timeout: alert via Gotify
4. Log result to Loki with labels: `subdomain`, `status_code`, `response_time_ms`

**Dependencies:** Gotify endpoint (`localhost:8050/gotify`), Loki endpoint, SUBDOMAINS.md read access

---

#### 10. `dns-propagation-checker`
**What it does:** After Terraform apply, polls DNS until subdomain resolves correctly before proceeding to smoke test.

**Why critical:** DNS propagation takes 30s-5min. Without this, smoke test fails immediately after terraform apply and human thinks deploy broke.

**Input:** Subdomain (e.g., `newapp.zappro.site`)
**Output:** `{"propagated": true, "ip": "104.21.0.1", "elapsed_seconds": 12}`

**Process:**
1. `dig +short newapp.zappro.site` or `nslookup`
2. Retry every 5 seconds for up to 120 seconds
3. Validate IP matches expected Cloudflare IP range
4. Return elapsed time

**Dependencies:** `dig` or `nslookup`; Terraform apply completion

---

#### 11. `tunnel-ingress-validator`
**What it does:** Validates ingress rules in `variables.tf` will route to correct container IP before running `terraform apply`.

**Why critical:** Wrong IP in `variables.tf` causes "Connection refused" post-deploy with no indication until smoke test.

**Input:** Subdomain + expected container IP + port
**Output:** `{"valid": true, "current_ip": "10.0.5.3", "expected_ip": "10.0.5.3", "issues": []}`

**Process:**
1. Parse `variables.tf` for subdomain entry
2. Extract `url = "http://X.X.X.X:PORT"`
3. Validate IP is in expected Docker network range (`10.0.5.0/24`, `10.0.6.0/24`, etc.)
4. Check port matches PORTS.md allocation
5. Warn if IP looks like localhost (`127.0.0.1`)

**Dependencies:** `variables.tf` read; Docker network range knowledge

---

### 🚀 Deploy Skills

#### 12. `coolify-deploy-bridge`
**What it does:** Orchestrates the full deploy via Coolify API — build, push, deploy, health check — in a single skill.

**Why critical:** Currently, deploy requires chaining multiple tools manually. This skill wraps Coolify API + smoke test + rollback into one call.

**Input:**
```yaml
app_name: "inventory-tracker"
docker_compose_raw: "..."
git_repo: "git@github.com:zapprosite/monorepo.git"
branch: "main"
```

**Output:**
```json
{
  "status": "deployed",
  "url": "https://inventory.zappro.site",
  "container_ip": "10.0.5.7",
  "health_check_passed": true,
  "deploy_duration_seconds": 47
}
```

**Process:**
1. `coolify_get_service` by name → get UUID
2. `coolify_update_service` with docker-compose raw
3. Wait for build (poll status)
4. `curl -sfI https://SUBDOMAIN.zappro.site` for health
5. If health fails after 3 retries → `coolify_restart_service`
6. Return summary

**Dependencies:** `coolify-access` skill; Coolify API token via Infisical

---

#### 13. `health-check-generator`
**What it does:** Adds a `/health` endpoint to any app type — static (nginx), Fastify, Python (FastAPI), etc.

**Why critical:** Healthcheck is required for Coolify and docker-autoheal. Without it, containers get restart-looped.

**Input:** App type + main file path
**Output:** Health endpoint code + nginx.conf snippet (if static)

**Patterns:**
| Type | Endpoint | Implementation |
|------|----------|-----------------|
| nginx static | `location /health { return 200 'OK'; }` | Built into nginx.conf |
| Fastify | `server.get('/health', async () => ({ status: 'ok' }))` | Add to routes |
| Python FastAPI | `@app.get('/health')` | Add to main.py |
| Node Express | `app.get('/health', (req, res) => res.json({ status: 'ok' }))` | Add to app.js |

**Dependencies:** Reads existing main file to insert health endpoint in correct location

---

#### 14. `rollback-manager`
**What it does:** If post-deploy smoke test fails, automatically rolls back — redeploys previous docker-compose version, restores previous Terraform state.

**Why critical:** One-shot must be safe. If something breaks, human shouldn't have to manually revert.

**Input:** App name + reason for rollback
**Output:** `{"rolled_back": true, "previous_version": "v1.2.3", "duration_seconds": 23}`

**Process:**
1. ZFS snapshot BEFORE deploy (automatic)
2. On failure: `coolify_get_service` for current compose
3. Store failed compose as `appname-FAILED-v1.2.3.compose`
4. Redeploy last known good compose
5. Alert human via Gotify

**Dependencies:** ZFS snapshots; Coolify API; previous good compose stored in git tag

---

### 📊 Monitoring Skills

#### 15. `post-deploy-reporter`
**What it does:** After successful deploy, generates a markdown report with URLs, status, next steps, and credentials needed.

**Why critical:** Human needs to know the app is live and how to access it. Manual notification is error-prone.

**Input:** App name, subdomain, port, OAuth status, deployment duration
**Output:**
```markdown
## Deploy Report: inventory-tracker

| Item | Value |
|------|-------|
| **URL** | https://inventory.zappro.site |
| **Subdomain** | inventory |
| **Port** | 4057 |
| **OAuth** | Enabled (Google) |
| **Status** | ✅ HEALTHY |
| **Deploy Time** | 47 seconds |
| **Container IP** | 10.0.5.7 |

### Next Steps
1. Verify login at https://inventory.zappro.site/auth/callback
2. Add team members in Google Admin console
3. Update onboarding docs

### Credentials (via Infisical)
- `inventory-tracker/GOOGLE_CLIENT_ID`
- `inventory-tracker/GOOGLE_CLIENT_SECRET`
```

**Dependencies:** Subdomain smoke test results; Infisical secret paths

---

#### 16. `smoke-test-orchestrator`
**What it does:** Runs the full smoke test suite after deploy — HTTP 200, OAuth flow, container health, DNS resolution, tunnel connectivity.

**Why critical:** Ensures the app is fully functional before reporting success. Different from single curl check.

**Input:** App name + subdomain
**Output:**
```json
{
  "http_200": true,
  "oauth_callback_200": true,
  "container_healthy": true,
  "dns_resolved": true,
  "tunnel_reachable": true,
  "overall": "PASS",
  "failed_checks": []
}
```

**Process:**
1. `curl -sfI https://SUBDOMAIN.zappro.site` → HTTP 200
2. `curl -sfI https://SUBDOMAIN.zappro.site/auth/callback` → 200
3. `docker inspect --format='{{.State.Health.Status}}' CONTAINER` → healthy
4. `dig +short SUBDOMAIN.zappro.site` → Cloudflare IP
5. `nc -zv container-ip port` → open

**Dependencies:** Docker CLI; dig/nc; Playwright (for OAuth)

---

### 📚 Doc Skills

#### 17. `auto-doc-updater`
**What it does:** Automatically updates PORTS.md, SUBDOMAINS.md, and NETWORK_MAP.md after successful deploy.

**Why critical:** Manual doc updates are forgotten, causing port conflicts and DNS confusion later.

**Input:** App name, subdomain, port, container IP, network
**Output:** Diff of updated files

**Process:**
1. Read PORTS.md → append new port entry
2. Read SUBDOMAINS.md → append new subdomain entry
3. Read NETWORK_MAP.md → append IP/port mapping
4. Generate diff for human review
5. If approved → write changes

**Dependencies:** Write access to `/srv/ops/ai-governance/` docs; human approval gate

---

#### 18. `changelog-generator`
**What it does:** Generates a CHANGELOG entry for the new deploy — version, date, URL, features.

**Why critical:** Tracking what's deployed where is essential for debugging and audit.

**Input:** App name, subdomain, PRDs/SPECs referenced, deploy time
**Output:**
```markdown
### v1.0.0 (2026-04-13)

**inventory-tracker** — https://inventory.zappro.site

- Initial deployment
- Google OAuth enabled
- Static nginx with healthcheck
- Subdomain: inventory.zappro.site
- Port: 4057

```

**Dependencies:** `CHANGELOG.md` location; git tag for version

---

### 🔄 Loop Enhancement Skills

#### 19. `human-gate-manager`
**What it does:** Manages async human confirmation steps in the one-shot flow — prints decision points, waits for response, continues or aborts.

**Why critical:** One-shot has multiple decision points (approve subdomain, approve OAuth, approve deploy). Without structured gates, human gets lost or flow runs without approval.

**Input:** Gate name + prompt + options
**Output:** `{"approved": true, "selected_option": "deploy", "timestamp": "..."}`

**Example prompts:**
```
[ HUMAN GATE: OAuth Setup ]
Google OAuth requires client credentials. Have you added redirect URI in Google Cloud Console?
Options: [y] Already done, [n] Skip OAuth, [s] Show me how

[ HUMAN GATE: Deploy ]
About to deploy to https://inventory.zappro.site. Continue?
Options: [y] Deploy, [n] Abort, [p] Plan only
```

**Dependencies:** Terminal input capability; can timeout and abort if no response

---

#### 20. `oauth-uri-broadcaster`
**What it does:** At the start of one-shot flow involving OAuth, prints all OAuth URIs the human needs and reminds them to complete Google Cloud Console setup before proceeding.

**Why critical:** OAuth failure is the #1 deploy blocker. Human forgets to add redirect URI until after deploy, causing full rework.

**Input:** App name + OAuth type (Google)
**Output:** Formatted URI list + checklist

```
⚠️  OAuth SETUP REQUIRED — Complete BEFORE continuing

1. Open Google Cloud Console: https://console.cloud.google.com/apis/credentials
2. Select project: zappro-site
3. For OAuth Client ID: inventory-tracker
4. Add Redirect URI: https://inventory.zappro.site/auth/callback

📋 QUICK CHECK — Has the redirect URI been added? [y/n]
```

**Dependencies:** Google Cloud Console access (human); no technical dependency

---

#### 21. `cursor-loop-prd-to-deploy`
**What it does:** The orchestrator skill that chains all others — PRD → parse → scaffold → OAuth → terraform → deploy → smoke test → report.

**Why critical:** This is the main skill that makes one-shot real. Chains existing skills into a loop.

**Input:** PRD text OR GitHub issue URL
**Output:** Deployed app URL + post-deploy report

**Process:**
```
[1] prd-parser: PRD text → structured spec
[2] app-type-detector: spec → app type
[3] port-allocator: app type → port
[4] template-generator: app type + spec → Dockerfile + compose
[5] oauth-uri-broadcaster: (if OAuth) → wait for human confirmation
[6] cloudflare-terraform: subdomain → DNS + tunnel
[7] dns-propagation-checker: wait for DNS
[8] health-check-generator: add /health to app
[9] coolify-deploy-bridge: compose → Coolify deploy
[10] smoke-test-orchestrator: full smoke test
[11] oauth-test-validator: (if OAuth) → validate flow
[12] auto-doc-updater: update PORTS.md + SUBDOMAINS.md
[13] post-deploy-reporter: generate deploy report
```

**Error handling:** If any step fails → `rollback-manager` → alert human

**Dependencies:** All other skills; MiniMax for generation; Infisical for secrets

---

#### 22. `self-healing-loop`
**What it does:** Monitors deployed apps and auto-heals using Coolify API + ZFS snapshot before restart.

**Why critical:** One-shot deploy means human expects app to stay up. Self-healing loop provides the safety net.

**Input:** App name + alert condition
**Output:** Auto-heal action + Gotify notification

**Process:**
1. Monitor: `docker inspect` health + `curl` endpoint
2. If DOWN → ZFS snapshot → `coolify_restart_service`
3. If restart fails 3x → alert human + create GitHub issue
4. Log all actions to Loki

**Dependencies:** docker-autoheal (existing); Coolify API; ZFS snapshot script

---

## 3. Recommended Priority Order

### Top 5 to Build First

| # | Skill | Justification |
|---|-------|---------------|
| **1** | `cursor-loop-prd-to-deploy` | This is the orchestrator. Without it, other skills are disconnected. Build this first to define the interface other skills must implement. |
| **2** | `prd-parser` | Gates the entire flow. If PRD can't be parsed, human must manually create SPEC, defeating one-shot. MiniMax M2.7 is already available. |
| **3** | `oauth-uri-broadcaster` | OAuth is the #1 failure point. Broadcasting URIs before deploy prevents the most common rework cycle. |
| **4** | `auto-doc-updater` | Without this, PORTS.md/SUBDOMAINS.md drift from reality within 2 deploys. Critical for long-term maintainability. |
| **5** | `coolify-deploy-bridge` | Wraps the Coolify API (already exists via `coolify-access`) into a single deploy-with-health-check call. Closes the gap between compose generation and running app. |

### Why These 5 First

1. **`cursor-loop-prd-to-deploy`** defines the contract — once this exists with a stub implementation, other skills can be slottted in incrementally.
2. **`prd-parser`** unlocks the "human writes PRD → app is live" promise. Without structured output, every step requires manual spec creation.
3. **`oauth-uri-broadcaster`** prevents the #1 failure mode (OAuth misconfiguration) without requiring complex code — mostly templating and prompts.
4. **`auto-doc-updater`** is low-complexity, high-impact. Ensures governance docs stay accurate, which prevents future incidents.
5. **`coolify-deploy-bridge`** combines existing `coolify-access` with health checking and rollback into one callable skill.

---

## 4. Script Equivalents

For each critical skill, whether a bash script would be faster to implement:

| Skill | Script Equivalent? | Rationale |
|-------|-------------------|-----------|
| `prd-parser` | ❌ No | Requires MiniMax LLM with 1M context to analyze freeform PRD. Bash can't parse natural language. |
| `app-type-detector` | ⚠️ Partial | Bash can detect file extensions and `package.json` existence, but complex cases (Zod schema vs plain JSON) need LLM. |
| `port-allocator` | ✅ **YES** | Pure bash: `ss -tlnp | grep -E '^LISTEN' | awk '{print $4}' | grep -oE '[0-9]+$' | sort -n`. 20 lines max. |
| `oauth-uri-broadcaster` | ✅ **YES** | Echo statements + read confirmation. Pure bash. No API calls. |
| `human-gate-manager` | ✅ **YES** | Bash `read -p "Continue? [y/n]"` + case statement. Simple flow control. |
| `dns-propagation-checker` | ✅ **YES** | `dig` + `sleep` loop. 15 lines. Faster than skill overhead. |
| `tunnel-ingress-validator` | ⚠️ Partial | Bash can parse `variables.tf` with `grep`/`awk`, but LLM needed for semantic validation of IP ranges. |
| `coolify-deploy-bridge` | ⚠️ Partial | Bash can call Coolify API via `curl`, but needs Python/JS for JSON parsing and retry logic. |
| `health-check-generator` | ✅ **YES** | Bash can append to files. `echo "location /health { return 200 'OK'; }" >> nginx.conf`. |
| `post-deploy-reporter` | ⚠️ Partial | Bash can generate markdown with `echo`, but needs dynamic values from deploy output (needs JSON parsing). |
| `auto-doc-updater` | ✅ **YES** | `sed -i` or `awk` to append lines to PORTS.md/SUBDOMAINS.md. Straightforward. |
| `smoke-test-orchestrator` | ✅ **YES** | Bash `curl` loop + `jq` for JSON. Very fast to implement. |
| `rollback-manager` | ⚠️ Partial | Bash can trigger rollback via Coolify API (`curl`), but needs ZFS snapshot integration. |
| `subdomain-health-watcher` | ✅ **YES** — but should be cron, not skill | `curl` loop + Gotify `curl`. This is a cron job, not an on-demand skill. |
| `oauth-test-validator` | ⚠️ Partial | Bash can do `curl` checks, but full OAuth flow with Playwright needs Node.js. |

### Scripts That Should Be Pure Bash (Faster Than Skill)

| Script | Location | Why Bash |
|--------|----------|----------|
| `port-allocator.sh` | `/srv/ops/scripts/` | 20 lines, no API, no LLM |
| `dns-propagation-checker.sh` | `/srv/ops/scripts/` | `dig` + `sleep` loop |
| `smoke-tunnel.sh` (exists) | `/srv/ops/scripts/` | Already bash |
| `health-check-generator.sh` | `/srv/ops/scripts/` | File append only |
| `oauth-uri-broadcaster.sh` | `/srv/ops/scripts/` | Echo + read |

### Skills That Must Remain Skills (LLM Required)

| Skill | Reason |
|-------|--------|
| `prd-parser` | Natural language understanding |
| `cursor-loop-prd-to-deploy` | Orchestration logic + error recovery |
| `template-generator` | Multi-file generation with context awareness |
| `oauth-test-validator` | Full OAuth flow simulation |
| `rollback-manager` | Decision logic on failure type |

---

## 5. Integration Architecture

```
PRD (human input)
    │
    ▼
cursor-loop-prd-to-deploy (orchestrator)
    │
    ├─► prd-parser ──────────────────────────► structured spec
    │         (MiniMax M2.7)
    │
    ├─► app-type-detector ──────────────────► app type
    │
    ├─► port-allocator.sh ──────────────────► port (4002-4099)
    │
    ├─► template-generator ─────────────────► Dockerfile + compose
    │         (from existing templates)
    │
    ├─► oauth-uri-broadcaster.sh ───────────► human confirms
    │
    ├─► cloudflare-terraform ────────────────► DNS + tunnel
    │
    ├─► dns-propagation-checker.sh ──────────► wait for DNS
    │
    ├─► health-check-generator.sh ───────────► /health endpoint
    │
    ├─► coolify-deploy-bridge ──────────────► deploy + health
    │         (Coolify API)
    │
    ├─► smoke-test-orchestrator.sh ─────────► full validation
    │
    ├─► oauth-test-validator ───────────────► OAuth flow (if enabled)
    │
    ├─► auto-doc-updater.sh ────────────────► PORTS.md + SUBDOMAINS.md
    │
    └─► post-deploy-reporter ───────────────► markdown report
```

---

## 6. Governance Checkpoints

For each new skill, verify before committing:

- [ ] Does it read PORTS.md before allocating ports?
- [ ] Does it use Infisical SDK for secrets (no hardcoded tokens)?
- [ ] Does it update SUBDOMAINS.md after adding subdomain?
- [ ] Does it use Terraform for DNS (not manual Cloudflare dashboard)?
- [ ] Does it add healthcheck before declaring deploy complete?
- [ ] Does it handle errors gracefully and rollback if smoke test fails?
