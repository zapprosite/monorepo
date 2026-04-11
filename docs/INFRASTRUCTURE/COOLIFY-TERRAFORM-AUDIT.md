# Coolify + Terraform Audit

**Date:** 2026-04-11
**Host:** will-zappro homelab
**Author:** Claude Code audit

---

## 1. Coolify Deployment Inventory

### What is Deployed on Coolify

| Service | UUID | Tipo | Rede | Status |
|---------|------|------|------|--------|
| `openclaw` | — | Docker Compose | `qgtzrmi6771lt8l7x8rqx72f` (10.0.19.x) | healthy |
| `openwebui` | — | Docker Compose | `wbmqefxhd7vdn2dme3i6s9an` (10.0.5.x) | UP |
| `bridge-stack` | — | Docker Compose (SPEC-020) | dual (qgtzrmi + wbmqefx) | UP |
| `perplexity-agent` | — | Docker Compose (SPEC-024) | Coolify-managed | deploying |
| `gitea-runner` | — | Docker Compose | Coolify-managed | restarts=3 |
| `n8n` | — | Coolify-managed | `coolify` (10.0.6.x) | UP |
| `browser` (x3) | — | Docker Compose | `qgtzrmi...` | healthy |
| `mcp-monorepo` | — | Docker Compose | `qgtzrmi` (10.0.19.50:4006) | UP |
| `mcp-qdrant` | — | Docker Compose | `qgtzrmi` (10.0.19.51:4011) | UP |

**Coolify core stack:**
- coolify (:8000, :8080 internal)
- coolify-proxy (Traefik :80/:443/:8080)
- coolify-db (PostgreSQL 15)
- coolify-redis (Redis 7)
- coolify-realtime (:6001, :6002 — Soketi)
- coolify-sentinel

### coolify.zappro.site vs cloud.zappro.site

| URL | What It Is | Correct Usage |
|----|------------|---------------|
| `https://coolify.zappro.site` | **Coolify PaaS panel** (port 8000, via Cloudflare tunnel) | The canonical URL for Coolify UI |
| `https://cloud.zappro.site` | **Cloudflare management panel** (Cloudflare dashboard — NOT Coolify) | NEVER use for Coolify API |

**CRITICAL BUG FOUND:** SPEC-022 uses `https://cloud.zappro.site/api/v1/deploy` for Coolify API calls. This is WRONG — `cloud.zappro.site` is the Cloudflare dashboard, not Coolify. The correct URL is `https://coolify.zappro.site` (external tunnel) or `http://127.0.0.1:8000` (local).

**Files with this bug:**
- `docs/SPECS/SPEC-022-CURSOR-LOOP-CLI-SOLUTIONS.md` (lines 68, 72)
- `obsidian/SPECS/SPEC-022-CURSOR-LOOP-CLI-SOLUTIONS.md` (lines 68, 72)

---

## 2. COOLIFY_API_KEY — Where It Is Used

| File | Usage | URL Used |
|------|-------|----------|
| `.claude/skills/coolify-access/SKILL.md` | Bearer token auth | `http://127.0.0.1:8000` (local) or `https://coolify.zappro.site` |
| `.claude/skills/spec-024-cleanup/SKILL.md` | Bearer token auth + IP AllowList | `https://cloud.zappro.site` (WRONG — should be `coolify.zappro.site`) |
| `docs/OPERATIONS/SKILLS/coolify-api-guide.md` | Bearer token auth | `http://127.0.0.1:8000` (local) |
| `docs/OPERATIONS/SKILLS/coolify-auth-dashboard.md` | AllowList management | `https://cloud.zappro.site` (Cloudflare dashboard, not Coolify) |
| `docs/SPECS/SPEC-022-CURSOR-LOOP-CLI-SOLUTIONS.md` | Deploy API | `https://cloud.zappro.site` (WRONG) |
| `SPEC-100-PIPELINE-BOOTSTRAP.md` | Bootstrap config | `COOLIFY_URL=https://coolify.zappro.site` (CORRECT) |
| `tasks/plan-spec024.md` | Phase 1 Coolify auth | IP AllowList check |

**Auth requirement:** IP must be in Coolify AllowList at `https://coolify.zappro.site/settings/allowlist` (NOT `cloud.zappro.site`).

### COOLIFY_URL Correct Value

| Context | Correct URL |
|---------|-------------|
| Local access (host) | `http://127.0.0.1:8000` |
| External (via Cloudflare tunnel) | `https://coolify.zappro.site` |
| Via Gitea Actions / remote | `https://coolify.zappro.site` |

---

## 3. What Apps Reference Coolify

| App/Workflow | How It Uses Coolify |
|--------------|---------------------|
| `cursor-loop` skill | Deploy bridge-stack via `coolify-mcp: update_service` |
| SPEC-024 cleanup plan | P1: Coolify API auth fix, P2: deploy perplexity-agent |
| SPEC-022 CLI solutions | Coolify API deploy via curl |
| SPEC-020 bridge-stack | Deploy openclaw-mcp-wrapper + openwebui-bridge-agent |
| `coolify-deploy-trigger` skill | Trigger deploy by UUID |
| `coolify-health-check` skill | Verify health after deploy |
| CI/CD workflows (7 files) | HEALTH_URL points to Coolify-managed services |

---

## 4. Terraform Resource Map

**Location:** `/srv/ops/terraform/cloudflare/`

### Managed by Terraform

| Resource Type | What It Manages |
|--------------|----------------|
| `cloudflare_zero_trust_tunnel_cloudflared_config` | Cloudflare Tunnel (id: aee7a93d-c2e2-4c77-a395-71edc1821402, name: will-zappro-homelab) |
| `cloudflare_record` | DNS A records for all subdomains |
| `cloudflare_access_application` | OAuth protection for vault, n8n, qdrant, api, llm, coolify, git, monitor, painel |
| `cloudflare_access_policy` | Email domain-based access policies |

### NOT in Terraform (manual/Docker-managed)

- Docker containers and Compose files
- ZFS pools/datasets/snapshots
- Coolify installation itself (runs as Docker container)
- n8n deployments (Coolify-managed)
- Internal Docker networks (qgtzrmi, wbmqefxhd, etc.)

### Services Map (from variables.tf)

| Subdomain | Target | http_host_header | Access |
|-----------|--------|------------------|--------|
| `vault.zappro.site` | localhost:8200 | — | @zappro.site OAuth |
| `n8n.zappro.site` | 10.0.6.3:5678 | — | @zappro.site OAuth |
| `qdrant.zappro.site` | localhost:6333 | — | @zappro.site OAuth |
| `bot.zappro.site` | localhost:80 | openclaw-qgtzrmi...sslip.io | **public** |
| `chat.zappro.site` | 10.0.5.2:8080 | openwebui-wbmqefx...sslip.io | @zappro.site OAuth |
| `llm.zappro.site` | localhost:4000 | — | @zappro.site OAuth |
| `git.zappro.site` | localhost:3300 | — | @zappro.site OAuth |
| `coolify.zappro.site` | localhost:8000 | — | @zappro.site OAuth |
| `api.zappro.site` | localhost:4000 | — | @zappro.site OAuth |
| `web.zappro.site` | localhost:4004 | — | @zappro.site OAuth |
| `monitor.zappro.site` | localhost:3100 | — | LAN only |
| `painel.zappro.site` | localhost:4003 | — | @zappro.site OAuth |

---

## 5. Network Topology Accuracy Report

### PORTS.md (monorepo docs) — Status: ✅ ACCURATE

Matches the host state. Last verified 2026-04-06.

### NETWORK_MAP.md (monorepo docs) — Status: ✅ ACCURATE

Comprehensive and correct as of 2026-04-07. Key points verified:
- Ingress rules point to localhost:4001 for OpenClaw (port mapping 4001→8080)
- n8n at 10.0.6.3:5678 (Docker network IP, not localhost)
- Docker networks: `qgtzrmi` (10.0.19.x), `wbmqefxhd` (10.0.5.x), `zappro-lite` (docker0 10.0.1.x), `monitoring_monitoring`
- Grafana ↔ Prometheus: both in `monitoring_monitoring` Docker network

### Cross-Network Communication

| Source | Destination | IP | How |
|--------|-------------|-----|-----|
| Coolify containers (qgtzrmi) | LiteLLM (host) | 10.0.1.1:4000 | docker0 bridge |
| Coolify containers | Kokoro TTS | 10.0.19.7:8880 | bridge network |
| Coolify containers | Qdrant | 10.0.19.5:6333 | bridge network |
| Coolify containers | wav2vec2 STT | 10.0.19.8:8201 | qgtzrmi network |
| Coolify containers | wav2vec2-proxy | 10.0.19.9:8203 | qgtzrmi network |
| Grafana (monitoring_monitoring) | Prometheus (monitoring_monitoring) | :9090 | same Docker network |
| Grafana (monitoring_monitoring) | Loki (monitoring_monitoring) | :3101 | same Docker network |

---

## 6. Endpoint Correctness Verification

### Is coolify.zappro.site Being Used Correctly?

**Yes**, with one critical exception:

**The "coolify.zappro.site ja estava estavel" comment is valid** — the Coolify PaaS panel itself at `https://coolify.zappro.site` has been stable. The issue is that some docs/code use `cloud.zappro.site` when they mean Coolify, which is wrong.

**Docs that incorrectly reference cloud.zappro.site for Coolify:**

| File | Line | Bug | Should Be |
|------|------|-----|-----------|
| `docs/SPECS/SPEC-022-CURSOR-LOOP-CLI-SOLUTIONS.md` | 68, 72 | Uses `cloud.zappro.site` (Cloudflare dashboard) for Coolify API | `coolify.zappro.site` |
| `.claude/skills/spec-024-cleanup/SKILL.md` | 140 | AllowList URL says `cloud.zappro.site` | `coolify.zappro.site` |

**AllowList URL correction:**
- WRONG: `https://cloud.zappro.site/settings/allowlist` (Cloudflare dashboard)
- CORRECT: `https://coolify.zappro.site/settings/allowlist` (Coolify panel)

### Docker Network Isolation — Correct

Coolify services run in isolated Docker networks. OpenClaw is NOT on the same network as OpenWebUI — they communicate via the bridge-stack (openclaw-mcp-wrapper ↔ openwebui-bridge-agent) which has dual-network attachment.

### Cloudflare Tunnel Routing — Correct

```
bot.zappro.site → cloudflared → localhost:4001 (OpenClaw port-mapped)
chat.zappro.site → cloudflared → 10.0.5.2:8080 (OpenWebUI direct)
coolify.zappro.site → cloudflared → localhost:8000 (Coolify panel)
```

---

## 7. Summary of Issues Found

| Severity | Issue | Location |
|----------|-------|----------|
| 🔴 HIGH | SPEC-022 uses `cloud.zappro.site` (Cloudflare dashboard) instead of `coolify.zappro.site` for Coolify API deploy calls | docs/SPECS/SPEC-022-CURSOR-LOOP-CLI-SOLUTIONS.md |
| 🔴 HIGH | AllowList instructions in spec-024-cleanup SKILL point to wrong URL | .claude/skills/spec-024-cleanup/SKILL.md |
| ⚠️ MEDIUM | Coolify API guide and coolify-auth-dashboard use `cloud.zappro.site` when explaining AllowList management | docs/OPERATIONS/SKILLS/coolify-auth-dashboard.md |
| ✅ OK | COOLIFY_URL in SPEC-100 is correct (`coolify.zappro.site`) | SPEC-100-PIPELINE-BOOTSTRAP.md |
| ✅ OK | COOLIFY_API_KEY correctly stored in Infisical | — |
| ✅ OK | coolify.zappro.site resolves correctly via Cloudflare tunnel | — |
| ✅ OK | coolify-access skill uses correct local URL `http://127.0.0.1:8000` | .claude/skills/coolify-access/SKILL.md |
| ✅ OK | coolify-api-guide.md uses correct local URL `http://127.0.0.1:8000` | docs/OPERATIONS/SKILLS/coolify-api-guide.md |
| ✅ OK | Terraform correctly manages tunnel + DNS + Access policies | /srv/ops/terraform/cloudflare/ |
| ✅ OK | PORTS.md and NETWORK_MAP.md are accurate | docs/INFRASTRUCTURE/ |

---

## 8. Recommendations

1. **Fix SPEC-022** — replace `cloud.zappro.site` with `coolify.zappro.site` in Coolify API curl examples (lines 68, 72)
2. **Fix spec-024-cleanup SKILL** — correct AllowList URL from `cloud.zappro.site` to `coolify.zappro.site`
3. **Audit coolify-auth-dashboard.md** — clarify that AllowList is at `coolify.zappro.site`, not Cloudflare dashboard
4. **No changes needed** to COOLIFY_URL in SPEC-100 or coolify-access skill (already correct)

---

**End of audit**
