# SPEC-032 — Homelab Tunnel Health Automation

**Date:** 2026-04-12
**Status:** IN_PROGRESS
**Type:** Operations / Self-Healing

---

## Objective

Criar automacao que nunca mais deixa tunnel ou subdomain cair. Todo subdomain novo passa por validacao automatica antes de commit.

---

## Problem Statement

O smoke test de 15 agents revelou que:
1. n8n.zappro.site → DOWN ha semanas (IP errado 10.0.6.3 vs 10.0.6.2)
2. qdrant.zappro.site → DOWN ha semanas (localhost:6333 mas container nao expoe)
3. Docs desalignados (SUBDOMAINS.md + PORTS.md vs realidade)

---

## Acceptance Criteria

- [ ] Smoke test script: `/srv/ops/scripts/smoke-tunnel.sh` — curl every subdomain, report DOWN
- [ ] Pre-commit hook: valida subdomain URLs antes de git commit
- [ ] Cron job: smoke test every 30 min, alert via Gotify se DOWN
- [ ] Tunnel ingress validation: verifica que every ingress rule points to reachable IP
- [ ] Auto-heal: restart cloudflared se tunnel DOWN por >5min

---

## Components

### 1. smoke-tunnel.sh

- Loop through all subdomains from SUBDOMAINS.md
- curl -sfI each one
- Report 000 (connection refused) or non-2xx as DOWN
- Exit 1 if any DOWN found
- Output: table format (subdomain | expected | actual | status)

### 2. Pre-commit Hook

- Location: `/srv/ops/scripts/pre-commit-subdomain-check.sh`
- Called from: `.git/hooks/pre-commit` or as part of CI
- Checks: validate that any new subdomain in variables.tf has corresponding SUBDOMAINS.md entry
- Checks: validate that subdomain URL is reachable (curl test)
- Exit 1 if validation fails

### 3. Cron Job

- `smoke-tunnel-cron` job: `*/30 * * * *`
- Runs `/srv/ops/scripts/smoke-tunnel.sh`
- If DOWN detected → send Gotify alert (POST to http://localhost:8050/gotify)
- Log results to `/srv/ops/logs/tunnel-health.log`

### 4. Tunnel Ingress Validator

- Script: `/srv/ops/scripts/validate-ingress.sh`
- Reads variables.tf service URLs
- For each: verify IP is reachable (curl or nc)
- Flag localhost URLs pointing to services that should use container IPs

### 5. Auto-Heal

- If cloudflared status != active → systemctl restart cloudflared
- If tunnel has 0 ingress rules active → alert immediately
- ZFS snapshot before any restart

---

## Files to Create

| File | Purpose |
|------|---------|
| `/srv/ops/scripts/smoke-tunnel.sh` | Smoke test all subdomains |
| `/srv/ops/scripts/pre-commit-subdomain-check.sh` | Pre-commit validation |
| `/srv/ops/scripts/validate-ingress.sh` | Validate ingress rules |
| `/srv/ops/scripts/tunnel-autoheal.sh` | Auto-heal cloudflared |
| `/srv/ops/scripts/gotify-alert.sh` | Gotify alert helper |
| `/srv/ops/logs/tunnel-health.log` | Health log |

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Shell scripts | Bash |
| Smoke test | curl |
| Alerting | Gotify (localhost:8050) |
| Service management | systemd (cloudflared) |
| Snapshot | ZFS |

---

## Success Criteria

- Every subdomain returns 200 or 302 (never 000)
- Pre-commit hook catches new subdomain without SUBDOMAINS.md entry
- Cron job runs every 30 min without failure
- Auto-heal restarts cloudflared within 5 min of failure
- Zero manual intervention needed for tunnel issues

---

## Out of Scope

- Cloudflare Tunnel creation (already exists)
- DNS record management (via Terraform)
- Multi-tunnel support (single tunnel assumed)
