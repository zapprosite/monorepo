# RESEARCH-14: Homelab-Specific Patterns

**Agent:** RESEARCH-14
**Focus:** Homelab-specific patterns — ZFS snapshots, Docker/Coolify, Traefik, Cloudflare tunnels, reserved ports, network governance
**Date:** 2026-04-17
**Spec:** SPEC-ENTERPRISE-REFACTOR-2026-04-17

---

## 1. Key Findings (April 2026 Best Practices)

### 1.1 ZFS Snapshot Pattern

**Current State:**

- ZFS pool `tank` on `nvme0n1` (3.64 TB) with `compression=lz4`, `atime=off`
- Datasets: `tank/docker-data`, `tank/postgres`, `tank/qdrant`, `tank/n8n`, `tank/monorepo`, `tank/backups`
- Snapshot naming: `tank@pre-YYYYMMDD-HHMMSS-pinned-services`

**Best Practices (April 2026):**

- **Mandatory pre-change snapshots** for PINNED services (Kokoro, Whisper, LiteLLM, Hermes, Ollama)
- **snapshot-safe skill** (`/ss`) provides pre-flight checklist workflow
- **Rollback command always documented** alongside snapshot creation
- snapshots auto-expire after 30 days
- TIER classification: TIER1 (postgres, qdrant, n8n, backups) → daily; TIER2 (monorepo, docker-data) → pre-change

**Snapshot Command Pattern:**

```bash
# Pre-change snapshot (mandatory for PINNED services)
sudo zfs snapshot -r tank@pre-$(date +%Y%m%d-%H%M%S)-pinned-services

# List snapshots
zfs list -t snapshot -r tank | grep pinned

# Rollback (if needed)
sudo zfs rollback -r tank@pre-YYYYMMDD-HHMMSS-pinned-services
```

### 1.2 Docker/Coolify Pattern

**Coolify as PaaS:**

- Coolify manages: Qdrant (:6333), OpenWebUI (:8080), Prometheus (:9090), Grafana (:3100), Loki (:3101)
- Coolify Traefik proxy on port 8080 — **IMMUTABLE** (port conflict resolution)
- Docker data-root at `/srv/docker-data` (on ZFS) — enables snapshots

**PINNED Containers (require ZFS snapshot before change):**
| Container | Port | Why Pinned |
|-----------|------|------------|
| `zappro-tts-bridge` | 8013 | Voice filter — only pm_santa/pf_dora allowed |
| `zappro-kokoro` | 8012 | GPU TTS, model cache large |
| `zappro-whisper-stt` | 8204 | HF model cache ~1.5GB, watchdog depends on 8204 |
| `zappro-litellm` | 4000 | GPU proxy, config.yaml validated |
| `coolify-proxy` | 8080 | Port conflict resolution |

**Verification CMD:**

```bash
docker ps --format "{{.Names}}\t{{.Status}}" | grep -E "kokoro|whisper|hermes|litellm|coolify-proxy"
ss -tlnp | grep -E "8012|8204|4000|8080"
```

### 1.3 Traefik Pattern

**Architecture:**

```
INTERNET → Cloudflare → cloudflared → TRAEFIK (80/443/8080) → UFW → SERVICES
```

**Key Rules:**

- All ingress passes through Traefik (Coolify Proxy) on 80/443/8080
- **Never** bypass Traefik with direct port forwarding
- cloudflared daemon shares port 8080 with Traefik (conflict resolved via SPEC-009)

### 1.4 Cloudflare Tunnel Pattern

**Current Setup (April 2026):**

- Tunnel ID: `aee7a93d-c2e2-4c77-a395-71edc1821402`
- Tunnel Name: `will-zappro-homelab`
- Zone: `zappro.site`
- Token sourced from `.env` (`CLOUDFLARE_API_TOKEN`)

**Add Subdomain (fast path ~30s):**

```bash
source /srv/monorepo/.env
# 1. DNS CNAME
curl -s -X POST "https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/dns_records" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type":"CNAME","name":"SUBDOMAIN","content":"'"${CLOUDFLARE_TUNNEL_ID}"'.cfargotunnel.com","proxied":true}' | jq .success
# 2. Tunnel ingress
curl -s -X PUT "https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/cfd_tunnel/${CLOUDFLARE_TUNNEL_ID}/configurations" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ingress":[{"hostname":"SUBDOMAIN.zappro.site","service":"http://TARGET:PORT"},{"hostname":"*.zappro.site","service":"http_status:404"}]}' | jq .success
# 3. Verify
curl -sfI --max-time 10 https://SUBDOMAIN.zappro.site/ | head -1
```

**Drift Detection:**

```bash
cd /srv/ops/terraform/cloudflare && terraform plan
# Non-empty diff = drift
```

### 1.5 Port Governance Pattern

**Complete Reserved Ports (2026-04-17):**
| Port | Service | Status |
|------|---------|--------|
| 3000 | Open WebUI proxy | RESERVED |
| 4000 | LiteLLM production | RESERVED |
| 4001 | Hermes Agent Bot | RESERVED (service removed) |
| 4002 | ai-gateway OpenAI compat | RESERVED (SPEC-047) |
| 6333 | Qdrant | RESERVED |
| 8000 | Coolify PaaS | RESERVED |
| 8080 | Open WebUI (Coolify) | RESERVED |
| 8092 | Hermes MCP | RESERVED |
| 8204 | faster-whisper STT | RESERVED |
| 8642 | Hermes Gateway | RESERVED |

**Free for Dev:** 4002–4099 (microserviços), 5173 (Vite)

### 1.6 Network Governance Pattern (SPEC-050)

**UFW Configuration:**

- `default INPUT DROP`
- Authorized: 22 (SSH), 80, 443, 8080 (Cloudflare), 8000 (Coolify via Cloudflare)
- **Never** open 2222 (Gitea SSH) without approval
- **Never** disable UFW

**Pre-Port Checklist:**

1. Read `docs/INFRASTRUCTURE/PORTS.md` — confirm available
2. Read `docs/INFRASTRUCTURE/SUBDOMAINS.md` — confirm subdomain available
3. `ss -tlnp | grep :PORTA` — verify free
4. Update both docs if adding
5. If public: SUBDOMAINS.md + Terraform + cloudflared restart
6. If firewall needed: `sudo ufw allow PORT/tcp`

---

## 2. Specific Recommendations for CLAUDE.md / AGENTS.md

### 2.1 Add to CLAUDE.md — Homelab Operations Section

**Recommendation:** Add a dedicated "Homelab Operations" section after "Network & Port Governance":

````markdown
## Homelab Operations (SPEC-050)

### Before Any Infrastructure Change

1. Check service is PINNED or IMMUTABLE (docs/GOVERNANCE/IMMUTABLE-SERVICES.md)
2. If PINNED: ZFS snapshot mandatory before change
3. If IMMUTABLE: NEVER change — requires full homelab rebuild

### ZFS Snapshot Pattern (Required for PINNED Services)

```bash
sudo zfs snapshot -r tank@pre-$(date +%Y%m%d-%H%M%S)-pinned-services
zfs rollback -r tank@pre-YYYYMMDD-HHMMSS-pinned-services
```
````

### PINNED Services (Require ZFS Snapshot Before Change)

| Service       | Port      | Why                           |
| ------------- | --------- | ----------------------------- |
| TTS Bridge    | 8013      | Voice filter pm_santa/pf_dora |
| Kokoro TTS    | 8012      | GPU model cache               |
| Whisper STT   | 8204      | HF model cache ~1.5GB         |
| LiteLLM       | 4000      | Config validated              |
| Coolify Proxy | 8080      | Port conflict resolved        |
| Hermes Agent  | 8642/8092 | Agent brain, Telegram polling |
| Ollama        | 11434     | GPU inference, model cache    |

````

### 2.2 Add to AGENTS.md — Homelab SRE Agent

| Agent | Invocation | Best For |
|-------|------------|----------|
| `homelab-sre` | `/homelab` | ZFS snapshots, Docker/Coolify, Traefik, Cloudflare tunnels |

---

## 3. Code/Config Examples

### 3.1 Anti-Hardcoded Env Var Pattern (SPEC-059)

```typescript
// ✅ CORRETO — env var with fallback
const REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6379';
const ADMIN_USER_IDS = (process.env['HERMES_ADMIN_USER_IDS'] ?? '').split(',').filter(Boolean);
const MAX_FILE_SIZE = parseInt(process.env['HERMES_MAX_FILE_SIZE'] ?? '20971520', 10);
const MAX_CONCURRENT_PER_USER = parseInt(process.env['HERMES_MAX_CONCURRENT'] ?? '3', 10);

// ❌ ERRADO — hardcoded
const REDIS_URL = 'redis://localhost:6379'; // PROIBIDO
````

### 3.2 Smoke Test Pattern

```bash
#!/usr/bin/env bash
set -uo pipefail
RED='\033[0;31m'; GRN='\033[0;32m'; NC='\033[0m'
PASS=0; FAIL=0
pass() { echo -e "${GRN}[PASS]${NC} $1"; ((PASS++)); }
fail() { echo -e "${RED}[FAIL]${NC} $1"; ((FAIL++)); }
HERMES_URL="${HERMES_AGENCY_URL:-http://localhost:3001}"
# Test...
[ "$FAIL" -gt 0 ] && exit 1; exit 0
```

---

## 4. What to Add/Update/Delete

### ADD to CLAUDE.md

| Section                 | Content                                            | Rationale                            |
| ----------------------- | -------------------------------------------------- | ------------------------------------ |
| Homelab Operations      | ZFS snapshot pattern, PINNED table, Coolify basics | Missing — agents need these patterns |
| `/ss` skill reference   | Snapshot-safe skill invocation                     | Pre-change checklist                 |
| Cloudflare tunnel skill | Reference to cloudflare-tunnel-enterprise          | Agents should use skill              |

### UPDATE in CLAUDE.md

| Section            | Change                                  |
| ------------------ | --------------------------------------- |
| Cron jobs          | Add homelab health check (smoke tests)  |
| Network Governance | Consolidate duplicate SPEC-050 sections |

### DELETE from CLAUDE.md

| Content                              | Reason                 |
| ------------------------------------ | ---------------------- |
| Duplicate Network Governance section | SPEC-050 appears twice |

---

## 5. Skill Patterns

### snapshot-safe (`/ss`)

- `ss deploy` | `ss backup` | `ss list` | `ss rollback SNAPSHOT`
- Pre-flight checklist: Backup → Snapshot → Rollback documented → Team notified

### cloudflare-tunnel-enterprise

- Triggers: Add/remove subdomain, token rotation, drift detection, troubleshoot 1010/502
- References: token-management, terraform-structure, drift-detection, runbooks

---

## 6. Cron Jobs Recommendations

| Cron                      | Schedule  | Purpose                                |
| ------------------------- | --------- | -------------------------------------- |
| `homelab-health-daily`    | 06:00     | `smoke-agency-hardening.sh` validation |
| `zfs-snapshot-weekly`     | Sun 03:00 | Weekly backup snapshot                 |
| `cloudflare-drift-weekly` | Sun 04:00 | `terraform plan` drift detection       |
| `docker-cleanup-weekly`   | Sun 05:00 | `docker system prune -f`               |

---

## 7. Gap Analysis

| Gap                                       | Severity | Recommendation                    |
| ----------------------------------------- | -------- | --------------------------------- |
| No ZFS snapshot pattern in CLAUDE.md      | HIGH     | Add snapshot-safe skill reference |
| No PINNED/IMMUTABLE registry in CLAUDE.md | HIGH     | Add inline table                  |
| No Coolify/Docker governance in CLAUDE.md | MEDIUM   | Add Docker data-root pattern      |
| No cloudflare-tunnel skill reference      | MEDIUM   | Reference skill for subdomain ops |
| Duplicate Network Governance section      | LOW      | Consolidate SPEC-050              |

---

## 8. Summary

**Pattern Library Status:**

- ✅ ZFS: Well-documented (PARTITIONS.md, IMMUTABLE-SERVICES.md, snapshot-safe skill)
- ✅ Docker/Coolify: Well-documented (PINNED-SERVICES.md)
- ✅ Traefik: Well-documented (SPEC-050, PORTS.md)
- ✅ Cloudflare: Well-documented (cloudflare-tunnel-enterprise skill)
- ✅ Port Governance: Well-documented (PORTS.md, SUBDOMAINS.md)
- ⚠️ Skills Integration: CLAUDE.md doesn't reference all available skills

**Key Integration Points:**

1. Reference `snapshot-safe` skill in CLAUDE.md
2. Reference `cloudflare-tunnel-enterprise` skill in CLAUDE.md
3. Add PINNED/IMMUTABLE table inline to CLAUDE.md
4. Consolidate duplicate Network Governance section
5. Add homelab-specific cron jobs
