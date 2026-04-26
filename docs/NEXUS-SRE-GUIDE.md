# Nexus SRE Automation Guide — Enterprise Edition

## Status: OPERATIONAL

**Last Updated**: 2026-04-25

## Architecture

```
Internet → Cloudflare Edge → Cloudflare Tunnel → Home Lab Services
                              (aee7a93d...)
                                    ↓
                         ingress rules route by hostname
                                    ↓
              gym.zappro.site  → localhost:4010 (Docker)
              hermes.zappro.site → localhost:8642 (Python)
              api.zappro.site  → localhost:4000
              chat.zappro.site  → localhost:3456
              qdrant.zappro.site → localhost:6333
              coolify.zappro.site → localhost:8000
              git.zappro.site  → localhost:3300
              llm.zappro.site  → localhost:4002
              pgadmin.zappro.site → localhost:4050
```

## Current Service Health (VERIFIED)

| Service | Status | Port | Process | Notes |
|---------|--------|------|---------|-------|
| gym | ✅ HEALTHY | 4010 | docker-proxy | Docker container |
| hermes | ✅ HEALTHY | 8642 | python | /health returns 200 |
| api | ✅ HEALTHY | 4000 | python | |
| chat | ✅ HEALTHY | 3456 | python | |
| qdrant | ✅ HEALTHY | 6333 | qdrant | Vector DB |
| coolify | ✅ HEALTHY | 8000 | php | PaaS |
| git | ✅ HEALTHY | 3300 | gitea | Git hosting |
| llm | ✅ HEALTHY | 4002 | node | ai-gateway |
| pgadmin | ✅ HEALTHY | 4050 | docker-proxy | PGAdmin container |

## Critical Discovery: CFD Tunnel API

**Endpoint**: `PUT /accounts/{account_id}/cfd_tunnel/{tunnel_id}/configurations`

Note: `/cfd_tunnel/` not `/tunnels/`

**Authentication**: Global Key (`${CF_GLOBAL_KEY}`) with headers:
- `X-Auth-Key: ${CF_GLOBAL_KEY}`
- `X-Auth-Email: ${CF_EMAIL}`

## Nexus Scripts

### nexus-investigate.sh — Deep Health Investigation

**Purpose**: Verify service health WITHOUT false positives using multiple verification layers.

```bash
# Test single service (depth 3 = deep)
nexus-investigate.sh gym 3

# Test all services
nexus-investigate.sh all 3

# Research patterns
nexus-investigate.sh research hermes
```

**Verification Layers**:
1. HTTP endpoint (multiple paths)
2. Local port binding (critical check)
3. Process verification
4. Log analysis
5. Pattern research

**Exit Codes**:
- 0 = VERIFIED HEALTHY
- 1 = VERIFIED UNHEALTHY
- 2 = VERIFICATION FAILED

**Anti-Fake Guarantee**: If HTTP works but port isn't listening = IMPOSSIBLE = investigation triggered.

### nexus-ufw.sh — Firewall Automation

```bash
# Ensure port is open (main function)
nexus-ufw.sh ensure 4010 "gym-mvp"

# Check port
nexus-ufw.sh check 4010

# Find available port
nexus-ufw.sh find 4000
```

### nexus-tunnel.sh — Tunnel Ingress

```bash
# List ingress rules
nexus-tunnel.sh list

# Test ingress
nexus-tunnel.sh test gym

# Reload tunnel
nexus-tunnel.sh reload
```

### nexus-governance.sh — Full Deploy Pipeline

```bash
# Deploy with full governance
nexus-governance.sh quick-deploy /srv/myapp myapp 4011
```

### nexus-sre.sh — SRE Autonomous Deploy System

**Purpose**: Autonomous deploy from planning to execution for MVP/Medium/Large projects.

```bash
# Deploy a project
nexus-sre.sh deploy /srv/myapp

# Auto-detect project type
nexus-sre.sh detect /srv/myapp

# Create DNS subdomain
nexus-sre.sh dns myapp.zappro.site
```

**Features**:
- Automatic project type detection (MVP/Medium/Large)
- Port allocation (finds available port)
- DNS creation via Cloudflare API
- Deploy method detection (Docker/Coolify/Fly/Terraform)

### nexus-auto.sh — Context-Aware Automation

```bash
# Run automation
nexus-auto.sh run

# Analyze context
nexus-auto.sh analyze
```

### nexus-tutor.sh — Interactive SRE Learning

```bash
# Start tutor
nexus-tutor.sh start

# Learn topic
nexus-tutor.sh learn health-check
```

## Cron Jobs

| Schedule | Command | Purpose |
|----------|---------|---------|
| */5 * * * * | nexus-tunnel.sh test gym | Quick gym check |
| */30 * * * * | nexus-cron-helper.sh health | Deep health check (all services) |
| 0 * * * * | nexus-cron-helper.sh status | Nexus status |
| */5 * * * * | nexus-cron-helper.sh queue | Queue check |
| 0 0 * * * | nexus-ufw.sh status | UFW daily status |

## Quick Reference

### Test All Services
```bash
nexus-investigate.sh all 3
```

### Add New Service (Manual)

1. Update Cloudflare tunnel config:
```bash
curl -X PUT "https://api.cloudflare.com/client/v4/accounts/1a41f45591a50585050f664fa015d01b/cfd_tunnel/aee7a93d-c2e2-4c77-a395-71edc1821402/configurations" \
  -H "X-Auth-Key: ${CF_GLOBAL_KEY}" \
  -H "X-Auth-Email: zappro.ia@gmail.com" \
  -H "Content-Type: application/json" \
  -d '{"config": {"ingress": [...], "origin_request": {...}}}'
```

2. Add DNS CNAME in Terraform or dashboard

3. Open UFW port:
```bash
nexus-ufw.sh ensure 4011
```

## Environment Variables

```bash
# From /srv/monorepo/.env (canonical source)
CLOUDFLARE_API_TOKEN=${CLOUDFLARE_API_TOKEN}    # User token (DNS only)
CF_GLOBAL_KEY=${CF_GLOBAL_KEY}                  # Global Key (tunnel management)
CF_EMAIL=${CF_EMAIL}
```

See `.env.example` for full variable list.

## Files

### Core Nexus Scripts
| Script | Purpose |
|--------|---------|
| `nexus-investigate.sh` | Deep health verification (4 layers) |
| `nexus-ufw.sh` | Firewall automation |
| `nexus-tunnel.sh` | Tunnel ingress automation |
| `nexus-governance.sh` | Full deploy pipeline with governance |
| `nexus-sre.sh` | Autonomous deploy system |
| `nexus-auto.sh` | Context-aware automation |
| `nexus-tutor.sh` | Interactive SRE learning |
| `nexus-cron-helper.sh` | Cron orchestration |
| `nexus-cron-legacy.sh` | Legacy detection cron |
| `nexus-legacy-detector.sh` | Legacy file detection |
| `nexus-code-scanner.sh` | Claude CLI code analysis |
| `nexus-alert.sh` | Persistent alerts with escalation |
| `nexus-context-window-manager.sh` | Context window monitoring |
| `nexus-session-scheduler.sh` | Session scheduling |

### Infrastructure
| Path | Purpose |
|------|---------|
| `/srv/ops/terraform/cloudflare/main.tf` | Tunnel + DNS Terraform |
| `/srv/ops/terraform/cloudflare/variables.tf` | Service definitions |

## Tunnel Info

- **ID**: aee7a93d-c2e2-4c77-a395-71edc1821402
- **CNAME**: aee7a93d-c2e2-4c77-a395-71edc1821402.cfargotunnel.com
- **Status**: healthy
- **Connections**: 8 active
- **Config Source**: cloudflare (remotely managed)
- **Config Version**: 46

## Troubleshooting

### Service returns 404
- Check ingress rule exists: `nexus-tunnel.sh list`
- Verify tunnel is healthy: `curl -s .../tunnels/{id} | jq .result.status`

### Service returns 502
- Check if local service is running: `ss -tlnp | grep PORT`
- Check process: `nexus-investigate.sh SVC 3`

### Terraform fails with auth error
- Use `-refresh=false` flag
- Or use Global Key directly via API

## Legacy Detection & Code Quality

### nexus-legacy-detector.sh — Legacy File Detection

```bash
# Full scan
nexus-legacy-detector.sh full /srv/monorepo

# Scan by days
nexus-legacy-detector.sh scan /srv/monorepo 30

# Specific checks
nexus-legacy-detector.sh placeholders /srv/monorepo
nexus-legacy-detector.sh hardcoded /srv/monorepo
nexus-legacy-detector.sh salada /srv/monorepo
nexus-legacy-detector.sh arch /srv/monorepo
```

**Detections:**
- Legacy: Files not modified in 90+ days
- Salada: Directories with >20 files or >10 file types
- Hardcoded: API keys, passwords, IPs, ports in code
- Placeholder: TODO, FIXME, empty files
- Architecture: violations (Terraform in apps/, etc)

### nexus-code-scanner.sh — Claude CLI Analysis

```bash
# Quick structure scan
nexus-code-scanner.sh quick /srv/monorepo

# Deep analysis with Claude CLI
nexus-code-scanner.sh analyze /srv/monorepo

# Legacy analysis
nexus-code-scanner.sh legacy /srv/monorepo 90
```

### nexus-alert.sh — Persistent Alerts

```bash
# Create alert
nexus-alert.sh alert warn "Legacy files detected" "/srv/monorepo has 50 old files"

# List alerts
nexus-alert.sh list

# Resolve alert
nexus-alert.sh resolve ALT-20260425-XXXX

# Pending reminders
nexus-alert.sh remind
```

**Escalation:**
- 24h: Warning
- 72h: Error
- 168h (1 week): Critical

### nexus-cron-legacy.sh — Cron Orchestrator

```bash
# Scan all repos (every 30 min)
nexus-cron-legacy.sh scan

# Deep analysis with Claude CLI (every 6h)
nexus-cron-legacy.sh deep

# Daily summary (weekdays 9am)
nexus-cron-legacy.sh summary
```

**Monitored Repos:**
- `/srv/monorepo` — Monorepo principal
- `/srv/ops` — Infrastructure as Code
- `/srv/hermes-second-brain` — Knowledge management

### nexus-context-window-manager.sh — Context Window Manager

```bash
# Check context status
nexus-context-window-manager.sh status

# Force save current state
nexus-context-window-manager.sh save

# Start monitoring (for cron)
nexus-context-window-manager.sh monitor

# Prepare new session
nexus-context-window-manager.sh new-session
```

**Thresholds:**
- WARN: 70% — Auto-save
- CRIT: 85% — Save + alert
- EMERG: 95% — Save + critical alert + recommend /new

**Cron:**
```bash
*/5 * * * * ~/.claude/scripts/nexus-context-window-manager.sh monitor
```

### nexus-session-scheduler.sh — Session Scheduler

```bash
# List schedules
nexus-session-scheduler.sh list

# Add schedule (name, cron, command)
nexus-session-scheduler.sh schedule morning-fit "0 7 * * 1-5" "fit-v3 preset morning"

# Run now
nexus-session-scheduler.sh run morning-fit

# Remove schedule
nexus-session-scheduler.sh remove morning-fit

# Setup presets (morning-fit, water-reminder, evening-backup)
nexus-session-scheduler.sh presets
```

**Cron:**
```bash
* * * * * ~/.claude/scripts/nexus-session-scheduler.sh tick
```

## Success Criteria

- [x] gym.zappro.site returns HTTP 200
- [x] All scripts idempotent
- [x] Zero human interaction for port/subdomain governance
- [x] Health checks with no false positives
- [x] Deep investigation (4 layers)
- [x] Cron jobs operational
- [x] Documentation complete
- [x] Legacy detection system operational
- [x] Persistent alerts with escalation
- [x] Claude CLI integration for deep analysis

## Escalation Matrix

| Level | Response Time | Contact | Action |
|-------|---------------|---------|--------|
| P1 Critical | 15 min | On-call | Full outage, data loss risk |
| P2 High | 1 hour | Platform Team | Service degradation |
| P3 Medium | 4 hours | SRE on-duty | Non-critical issue |
| P4 Low | 24 hours | Next business day | Documentation, cleanup |

## On-Call

```bash
# Check current on-call
nexus-alert.sh on-call

# Escalate alert
nexus-alert.sh escalate ALT-20260425-XXXX
```

## Last Verification

**Date**: 2026-04-25 21:53:41
**Status**: ✅ ALL SYSTEMS OPERATIONAL
**Services**: 9/9 Healthy
**Alerts**: 0 Active
