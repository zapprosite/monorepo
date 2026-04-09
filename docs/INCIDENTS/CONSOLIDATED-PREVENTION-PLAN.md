# INCIDENTS CONSOLIDATED ANALYSIS — 2026-04-08 to 2026-04-09

**Date:** 2026-04-09
**Incidents Analyzed:** 6
**Status:** Complete

---

## 1. ROOT CAUSE MATRIX

### What Caused What

| Root Cause | Incidents Affected | Severity |
|------------|-------------------|----------|
| **Docker bridge TCP isolation** (container cannot TCP to host native processes) | #4 (voice pipeline), #5 (wav2vec2) | 🔴 HIGH |
| **GitOps gap** (DNS/Tunnel UP but container not deployed) | #3 (perplexity site down ~4h), #4 (voice pipeline) | 🔴 HIGH |
| **Config schema stripping** (fields removed on write) | #6 (OpenClaw baseUrl) | 🟡 MEDIUM |
| **Token/auth expiry** (temp token expired) | #1 (Gitea runner registration) | 🟡 MEDIUM |
| **No env var loading** (entrypoint doesn't load .env) | #6 (OpenClaw TTS route) | 🟡 MEDIUM |
| **Workflow not tested** (commit ≠ real push trigger) | #1 (Gitea workflows), #3 (perplexity deploy) | 🔴 HIGH |
| **Health check gaps** (check without route verification) | #1, #3, #4, #5 | 🔴 HIGH |
| **No auto-healer cron** (scripts exist but not scheduled) | #3 (perplexity) | 🟡 MEDIUM |

---

## 2. INCIDENT BREAKDOWN

### INC-1: Gitea Actions Runner
**File:** `INCIDENT-2026-04-08-gitea-actions-runner.md`

| Field | Value |
|-------|-------|
| **Root cause** | Runner not deployed; registration token expired; Docker socket conflicts; host.docker.internal DNS failed; $GITHUB_ENV incompatible |
| **Fix** | `network_mode: host`; IP `10.0.1.1` instead of host.docker.internal; `::set-env` instead of `$GITHUB_ENV` |
| **Prevention** | Generate token before deploy; verify runner online; test with real push; configure repo secrets |
| **Anti-patterns** | Assuming runner auto-registers; assuming host.docker.internal works inside container; using GitHub syntax in Gitea |

### INC-2: Kokoro Voice Access Control
**File:** `INCIDENT-2026-04-08-kokoro-voice-access.md`

| Field | Value |
|-------|-------|
| **Root cause** | Kokoro exposes all 67 voices — no native voice filter |
| **Fix** | TTS Bridge created as Python stdlib proxy, filters to pm_santa/pf_dora only |
| **Prevention** | TTS Bridge registered as PINNED service |
| **Anti-patterns** | Assuming TTS provider has built-in access control |

### INC-3: Perplexity Agent GitOps Gap
**File:** `INCIDENT-2026-04-08-perplexity-gitops-gap.md`

| Field | Value |
|-------|-------|
| **Root cause** | Terraform DNS created → Cloudflare Tunnel UP → (no deploy triggered) → container missing → site down |
| **Prevention** | Manual deploy verification; health endpoint; smoke test; cron auto-healer |
| **Anti-patterns** | DNS UP = container UP; Gitea Action auto-trigger assumption; health check without endpoint |
| **What could have prevented** | Test deploy with real push; smoke test after deploy; ZFS snapshot before changes |

### INC-4: Voice Pipeline Stability
**File:** `INCIDENT-2026-04-08-voice-pipeline-stable.md`

| Field | Value |
|-------|-------|
| **Root cause** | Docker bridge TCP isolation; Traefik/OpenClaw network segregation; loopback bind; cloud firewall |
| **Prevention** | All services containerized; verify network shared; smoke test via Tunnel |
| **Anti-patterns** | Host process as container backend; testing from host only; DNS/Tunnel UP = service UP |

### INC-5: wav2vec2 Network Isolation
**File:** `INCIDENT-2026-04-08-wav2vec2-network-isolation.md`

| Field | Value |
|-------|-------|
| **Root cause** | Docker bridge cannot TCP to native host process port 8201; ping works, TCP does not |
| **Fix** | wav2vec2 containerized; LiteLLM config updated to `wav2vec2:8201` |
| **Prevention** | Docker network connectivity test in smoke test; all internal services containerized |
| **Anti-patterns** | Testing from host (loopback); ICMP ping working ≠ TCP working; assuming "port open" = "reachable" |

### INC-6: OpenClaw TTS Route Fix
**File:** `INCIDENT-2026-04-09-openclaw-tts-route-fix.md`

| Field | Value |
|-------|-------|
| **Root cause** | OpenClaw schema strips `baseUrl` from `messages.tts.openai` on write; only env var works |
| **Fix** | `OPENAI_TTS_BASE_URL` env var via Coolify UI |
| **Prevention** | Document schema limitations; always use env vars for custom TTS endpoints |
| **Anti-patterns** | Writing config fields not in schema; assuming file config = runtime config |

---

## 3. UNIFIED PREVENTION CHECKLIST

### GitOps / Deployment

- [ ] **DNS UP ≠ Container UP** — Always verify container is "Up (healthy)" after deploy
- [ ] **Health endpoint required** — Every new service needs `/health` returning HTTP 200
- [ ] **Smoke test after deploy** — curl the actual endpoint, not just `docker ps`
- [ ] **Test with real push** — Gitea Action trigger only fires on push, not commit
- [ ] **Secrets configured** — COOLIFY_URL, COOLIFY_API_KEY etc. before marking "deploy ready"
- [ ] **Auto-healer cron active** — If auto-healer script exists, verify cron job is scheduled
- [ ] **ZFS snapshot before** — Before any deploy or config change affecting containers

### Network / Containerization

- [ ] **All internal services containerized** — No native host process as container backend
- [ ] **Verify TCP (not just ICMP)** — `docker exec container curl http://target:port/health` for all routes
- [ ] **Shared network confirmed** — Consumer and producer containers must share Docker network
- [ ] **No loopback for internal routes** — Never use `localhost:PORT` for inter-container communication
- [ ] **Use container hostname/IP** — Not `host.docker.internal` or `10.x.x.x` of host
- [ ] **Traefik routing verified** — Test via Cloudflare Tunnel, not just `localhost`

### Config / Schema

- [ ] **Env vars for dynamic config** — baseUrl, api_base etc. via environment variable, not config file
- [ ] **Verify schema supports field** — Check generated schema before writing custom config
- [ ] **Restart reloads config** — File config may be stripped on init; env vars survive restart
- [ ] **No .env loading in entrypoint** — If .env doesn't work, use Coolify UI env var editor

### Health Checks

- [ ] **Health check returns 200** — `/health` or `/_stcore/health` endpoint verified
- [ ] **Route end-to-end verified** — Not just "container running" but "container can reach target"
- [ ] **Smoke test includes all routes** — STT, TTS, VL, LLM all tested in smoke test
- [ ] **Network connectivity from container** — `docker exec liteLLM curl http://wav2vec2:8201/health`

---

## 4. MONITORING REQUIREMENTS

### Per Component

| Component | Health Check | Smoke Test | Auto-healer | Cron |
|-----------|-------------|------------|-------------|------|
| **Gitea Runner** | `/admin/actions/runners` UI | Push trigger test | N/A | N/A |
| **Perplexity Agent** | `https://web.zappro.site/_stcore/health` | HTTP 200 + content check | ✅ | `*/5 * * * *` |
| **wav2vec2 STT** | `http://wav2vec2:8201/health` | STT via LiteLLM | ✅ | N/A |
| **TTS Bridge** | `http://localhost:8013/v1/audio/speech` (pm_santa) | 3 voices (2 pass, 1 blocked) | N/A | N/A |
| **OpenClaw** | `https://bot.zappro.site/` via Tunnel | Full pipeline test | ✅ | N/A |
| **LiteLLM** | `http://localhost:4000/health` | All model routes | N/A | N/A |
| **Traefik/Coolify** | `http://localhost:80/ping` | Tunnel routing | ✅ | N/A |

### Network Connectivity Tests (Run on Deploy)

```bash
# Container → Internal Service (e.g. LiteLLM → wav2vec2)
docker exec zappro-litellm curl -sf -m 5 http://wav2vec2:8201/health

# Shared network check (Traefik → OpenClaw)
check_shared_network() { ... }

# Host service NOT reachable from container (expected for native host services)
check_host_service_reachable() { ... }
```

### Smoke Test Requirements

Every smoke test MUST include:
1. **Container alive** — `docker ps | grep container`
2. **Health endpoint** — `curl -sf -m 5 http://target/health`
3. **Route end-to-end** — Actual API call from consumer to producer
4. **Network from container** — Verify TCP works from inside container, not from host

---

## 5. ANTI-PATTERNS REFERENCE

| Anti-Pattern | Why It Fails | Correct Approach |
|-------------|--------------|-----------------|
| Host process as container backend | Docker bridge TCP isolation | Containerize the service |
| `curl localhost:8201` from host | Host uses loopback, not bridge | `docker exec container curl http://target:8201` |
| `docker ps` = "service OK" | Container up but route broken | Verify health + route |
| DNS/Tunnel UP = service UP | Tunnel UP but no backend | Smoke test actual endpoint |
| $GITHUB_ENV in Gitea | Not supported in Gitea Actions | Use `::set-env` |
| Config file for baseUrl | Schema strips on write | Use env var `OPENAI_TTS_BASE_URL` |
| host.docker.internal inside container | DNS fails in bridge network | Use IP or container hostname |
| Health check without route check | "Up" but unreachable | End-to-end test |
| Commit = deploy trigger | Action only fires on push | Test with real push |

---

## 6. SNAPSHOT REQUIREMENTS

**OBRIGATÓRIO** before:
- Any container deploy or update
- Docker compose / network changes
- Traefik/Coolify config changes
- Schema changes (OpenClaw config)

```bash
sudo zfs snapshot -r tank@pre-$(date +%Y%m%d-%H%M%S)-$(whoami)
```

---

## 7. FILES CREATED/MODIFIED

| File | Purpose |
|------|---------|
| `INCIDENT-2026-04-08-gitea-actions-runner.md` | Gitea runner deploy incident |
| `INCIDENT-2026-04-08-kokoro-voice-access.md` | Kokoro voice access control |
| `INCIDENT-2026-04-08-perplexity-gitops-gap.md` | Perplexity deploy gap |
| `INCIDENT-2026-04-08-voice-pipeline-stable.md` | Voice pipeline master incident |
| `INCIDENT-2026-04-08-wav2vec2-network-isolation.md` | wav2vec2 containerization |
| `INCIDENT-2026-04-09-openclaw-tts-route-fix.md` | OpenClaw TTS config fix |
| `docs/OPERATIONS/SKILLS/tts-bridge.md` | TTS Bridge documentation |
| `docs/OPERATIONS/SKILLS/tts-bridge.py` | TTS Bridge proxy |
| `docs/OPERATIONS/SKILLS/tts-bridge-docker-compose.yml` | TTS Bridge deploy |
| `docs/OPERATIONS/SKILLS/wav2vec2-health-check.md` | wav2vec2 health check |

---

**Next Review:** 2026-05-08 (+30 days)
**Authority:** will-zappro
