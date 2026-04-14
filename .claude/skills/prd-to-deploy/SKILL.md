---
name: prd-to-deploy
description: One-shot pipeline from PRD description to production deploy — subdomain + OAuth + app live
type: skill  
trigger: /prd-to-deploy
---

# Skill: prd-to-deploy

One-shot pipeline from PRD description to production deploy — subdomain + OAuth + app live.

**Trigger:** `/prd-to-deploy "Description of the app"`
**Expected total time:** 10-15 minutes (including user OAuth setup ~5min)
**Human interaction required:** 2 steps (OAuth URI config + final approval)

---

## Overview

This skill orchestrates all sub-skills into a single automated flow:

```
PARSE_PRD → SPEC → SUBDOMAIN_CREATION → FILE_GENERATION → HUMAN_GATE → DEPLOY → SMOKE_TEST → DOCS_UPDATE → /turbo
```

Unlike `cursor-loop` (which iterates autonomously until completion), this skill adds:
- **Subdomain creation** via Cloudflare Terraform
- **OAuth URI print** before any work (user configures while AI works)
- **Human gate** between file generation and deploy
- **One-shot deploy** (no iteration loop)

---

## Differences from cursor-loop

| Aspect | cursor-loop | prd-to-deploy |
|--------|-------------|---------------|
| Subdomain creation | No | Yes (Cloudflare Terraform) |
| OAuth setup | After or inline | **Before** (printed first, user configures while AI works) |
| Iteration | Continuous until done | One-shot flow |
| Human gate | No | Yes (before deploy) |
| Human effort | Minimal | 2 touchpoints |
| Speed | Slower (iterations) | Faster (parallel work) |
| OAuth mode | App-level only | App-level **or** Cloudflare Access |

---

## Phase 0: PARSE PRD + PRINT OAUTH URI FIRST

**This MUST be the first visible output — before any file generation.**

Parse from the PRD description:
- `APP_NAME`: extracted slug (e.g., "tools dashboard" → "tools-dash")
- `SUBDOMAIN`: suggested (e.g., "dash")
- `OAUTH_REQUIRED`: yes/no
- `OAUTH_MODE`: direct (default) or cloudflare

Immediately print the OAuth URI box:

```
╔═══════════════════════════════════════════════════════════════╗
║       One-Shot Deploy — [APP_NAME]                            ║
╠═══════════════════════════════════════════════════════════════╣
║ Subdomain: https://SUBDOMAIN.zappro.site                      ║
║                                                               ║
║  CONFIGURE GOOGLE OAUTH NOW (do this while I work):           ║
║                                                               ║
║  1. Go to: console.cloud.google.com/apis/credentials          ║
║  2. Add Redirect URI: https://SUBDOMAIN.zappro.site/auth/callback ║
║  3. Add JS Origin:    https://SUBDOMAIN.zappro.site           ║
║                                                               ║
║  I'll generate the code while you do this...                  ║
╚═══════════════════════════════════════════════════════════════╝
```

---

## Phase 1: SPEC

Call `/spec` with the PRD description.

**Output:** `docs/SPECS/SPEC-NNN-app-name.md`

```bash
# Invoke spec skill
/spec "A dashboard showing all homelab services with status indicators"
```

---

## Phase 2: SUBDOMAIN CREATION

Call `/new-subdomain` skill or use Cloudflare Terraform directly:

1. Read `/srv/ops/terraform/cloudflare/variables.tf`
2. Add entry to `services` map:
   ```hcl
   app_name = {
     url              = "http://10.0.X.X:PORT"
     subdomain        = "app-name"
     http_host_header = null
   }
   ```
3. `cd /srv/ops/terraform/cloudflare && terraform plan && terraform apply`
4. Verify DNS: `curl -sfI https://SUBDOMAIN.zappro.site`

**If subdomain already exists:** skip creation, continue to Phase 3.

---

## Phase 3: FILE GENERATION

Generate based on `/list-web-from-zero-to-deploy` skill pattern:

```
apps/APP_NAME/
├── index.html          # HTML principal com OAuth Google
├── auth-callback.html  # OAuth callback handler
├── nginx.conf          # Config nginx com rota /auth/callback
├── Dockerfile          # Build nginx:alpine
├── docker-compose.yml  # Compose com healthcheck + env vars
└── build.sh            # Script de build com env substitution
```

**Template sources:**
- `references/file-structure.md` (in list-web-from-zero-to-deploy skill)
- `references/oauth-flow.md` (Google OAuth token exchange pattern)
- `references/tunnel-setup.md` (subdomain Terraform config)
- `references/container-deploy.md` (Docker build)

**OAuth Token Exchange — CRITICAL:**
```javascript
// Token exchange POST body — OBRIGATÓRIO
POST https://oauth2.googleapis.com/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code
&client_id=GOOGLE_CLIENT_ID
&client_secret=GOOGLE_CLIENT_SECRET    // SEMPRE presente
&code=AUTH_CODE
&code_verifier=PKCE_VERIFIER
&redirect_uri=https://SUBDOMAIN.zappro.site/auth/callback
```

**No hardcoded secrets — use .env canonical:**
```typescript
// Via env.js injection (web app)
const clientId = window.__ENV__?.GOOGLE_CLIENT_ID;
const clientSecret = window.__ENV__?.GOOGLE_CLIENT_SECRET;

// Via process.env (Node/Fastify)
const clientId = process.env.GOOGLE_CLIENT_ID;
```

**Secrets syncados do Infisical para .env. NUNCA usar Infisical SDK em app code.**

---

## Phase 4: HUMAN GATE

Wait for user to add OAuth redirect URIs in Google Console:

```
Press ENTER when you've added the OAuth redirect URIs to Google Console...
```

**If OAuth not yet configured:** re-print the OAuth URI box and wait again.

---

## Phase 5: DEPLOY

```bash
cd apps/APP_NAME
docker compose build --no-cache
docker compose up -d
```

Wait for health check:

```bash
docker inspect --format='{{.State.Health.Status}}' APP_NAME
```

---

## Phase 6: SMOKE TEST

```bash
curl -sk --max-time 10 -o /dev/null -w "%{http_code}" https://SUBDOMAIN.zappro.site
```

**Must return 200 or 302.**

If fails:
- Show cloudflared logs: `docker logs cloudflared 2>&1 | tail -20`
- Show container logs: `docker logs APP_NAME 2>&1 | tail -20`
- Suggest fix

---

## Phase 7: DOCS UPDATE

Update documentation:
- `SUBDOMAINS.md` — add new subdomain entry
- `PORTS.md` — add new port if exposed
- `docs/SPECS/SPEC-NNN-app-name.md` — mark as deployed

---

## Phase 8: COMMIT + TURBO

```bash
# Commit with /turbo (auto-merge + tag)
# Or use /ship (sync docs + dual remotes + merge)
/turbo
```

---

## OAuth Mode Selection

| Flag | Mode | Use |
|------|------|-----|
| `--oauth direct` (default) | Google OAuth in app JS | MVP apps, quick deploy |
| `--oauth cloudflare` | Via CF Access Zero Trust | Production, extra protection |

---

## Usage Examples

```bash
# Basic deploy — dashboard app
/prd-to-deploy "A dashboard showing all homelab services with status indicators"

/# With Cloudflare Access protection
/prd-to-deploy "Admin panel for managing n8n workflows" --oauth cloudflare

# With custom subdomain
/prd-to-deploy "Simple link list for team bookmarks" --subdomain links

# Full options
/prd-to-deploy "Metrics visualization app" --subdomain metrics --oauth cloudflare
```

---

## Error Recovery

| Error | Action |
|-------|--------|
| Subdomain already exists | Skip creation, continue |
| OAuth not configured | Re-print OAuth URI, wait for user |
| Deploy fails | Show `docker logs`, suggest fix |
| Smoke test fails | Show cloudflared logs + container logs |
| Terraform apply fails | Show terraform error, suggest fix |

---

## Tunnel Checklist (before commit)

- [ ] `curl -sfI https://SUBDOMAIN.zappro.site` → 200 or 302
- [ ] Ingress rule in `variables.tf` → container IP (not localhost)
- [ ] `SUBDOMAINS.md` updated
- [ ] `PORTS.md` updated
- [ ] OAuth login tested and works (not just HTTP 200)
- [ ] `/turbo` executed

---

## References

- `/list-web-from-zero-to-deploy` — file generation templates
- `/cloudflare-terraform` — subdomain + DNS management
- `/spec` — SPEC creation workflow
- `/turbo` — commit + merge + tag + new branch

---

## Authority

**Owner:** will-zappro
**Last update:** 2026-04-13
