# Operations Skills

> **Directory:** `docs/OPERATIONS/SKILLS/`
> **Host:** will-zappro homelab
> **Updated:** 2026-04-08

Comprehensive index of all operational skills for the homelab. These skills are used by Claude Code, Codex CLI, and cron jobs to maintain system health, diagnose issues, and recover from failures.

---

## Skill Index

| Skill | Purpose | When to Use |
|-------|---------|--------------|
| [traefik-health-check.md](traefik-health-check.md) | Diagnose Traefik routing issues | When site returns 502/504 |
| [traefik-route-tester.md](traefik-route-tester.md) | Test all Traefik routes | After any routing change |
| [verify-network.md](verify-network.md) + [verify-network.sh](verify-network.sh) | Network isolation checks | When containers can't talk |
| [deploy-validator.md](deploy-validator.md) | Full validation before deploy | Before any deploy |
| [self-healing-cron.md](self-healing-cron.md) + [self-healing.sh](self-healing.sh) | Auto-monitor and heal | Setup as cron job |
| [incident-runbook.md](incident-runbook.md) | Systematic incident response | When something breaks |
| [container-health-check.md](container-health-check.md) + [container-health-check.sh](container-health-check.sh) | Container status and resources | Routine monitoring |
| [litellm-health-check.md](litellm-health-check.md) | LiteLLM proxy health | Before LLM calls |
| [wav2vec2-health-check.md](wav2vec2-health-check.md) | wav2vec2 STT health | Before transcription tasks |
| [liteLLM-usage.md](liteLLM-usage.md) | LiteLLM usage analytics | Cost monitoring |
| [tts-bridge.md](tts-bridge.md) + [tts-bridge.py](tts-bridge.py) | Kokoro voice filter (pm_santa/pf_dora only) | Restrict TTS voices |
| [voice-pipeline-desktop.md](voice-pipeline-desktop.md) | Voice pipeline desktop (F12, Ctrl+Shift+C, hotkeys) | Voice recording and TTS on Ubuntu desktop |
| [openclaw-agents-kit](./openclaw-agents-kit/SKILL.md) | OpenClaw multi-agent orchestration | Create leader + sub-agent teams for any niche |

---

## Quick Reference

### Daily Health Check

```bash
# Container + network combined check
bash docs/OPERATIONS/SKILLS/container-health-check.sh
bash docs/OPERATIONS/SKILLS/verify-network.sh

# Self-healing cron (if installed)
tail -f /srv/ops/logs/self-healing.log
```

### Pre-Deploy

```bash
# Full validation (all 6 phases)
bash docs/OPERATIONS/SKILLS/deploy-validator.sh

# Or via skill:
# See deploy-validator.md
```

### Incident Response

```bash
# Systematic triage
bash docs/OPERATIONS/SKILLS/incident-runbook.md

# One-liner triage
docker ps --format "table {{.Names}}\t{{.Status}}" | grep -E "openclaw|litellm|wav2vec2|coolify" && \
curl -sf -m 5 http://localhost:80/ping && echo " Traefik OK" || echo " Traefik FAIL"
```

---

## Skills by Category

### Diagnostic

| Skill | File | What It Checks |
|-------|------|----------------|
| traefik-health-check | `traefik-health-check.md` | Traefik container health, ports, DNS, SSL certs, network isolation |
| traefik-route-tester | `traefik-route-tester.sh` | All active Traefik routes, backend reachability, network isolation |
| verify-network | `verify-network.md` + `.sh` | Container-to-container connectivity, shared networks, HTTP routes |
| container-health-check | `container-health-check.md` + `.sh` | Container status, health endpoints, resource usage, log errors, OOM kills |
| litellm-health-check | `litellm-health-check.md` | LiteLLM process, port, API health, model list, rate-limited proxy |
| wav2vec2-health-check | `wav2vec2-health-check.md` | wav2vec2 container, GPU memory, transcription test |

### Deploy

| Skill | File | What It Does |
|-------|------|-------------|
| deploy-validator | `deploy-validator.md` | ZFS snapshot, container health, network, routing, smoke test, rollback |

### Monitoring

| Skill | File | What It Does |
|-------|------|-------------|
| self-healing-cron | `self-healing-cron.md` + `.sh` | Monitors critical containers + routes, auto-restarts (rate-limited), alerts on network isolation |
| container-health-check | `container-health-check.md` + `.sh` | Detailed container health with JSON output for external monitoring |
| liteLLM-usage | `liteLLM-usage.md` | Usage analytics and cost monitoring |

### Agent Orchestration

| Skill | File | What It Does |
|-------|------|-------------|
| openclaw-agents-kit | `openclaw-agents-kit/SKILL.md` | Universal kit for creating leader + sub-agent teams. Teaches OpenClaw to act as senior dev orchestrator: identity-patch (safe config), Coolify API, Infisical SDK, sub-agent patterns, governance template |

### Incident

| Skill | File | What It Does |
|-------|------|-------------|
| incident-runbook | `incident-runbook.md` | Systematic triage, root cause categories, decision tree, rollback procedure |

---

## All Skills (Alphabetical)

| Skill | Type | Complexity |
|-------|------|------------|
| ai-stress-test | Diagnostic | Medium |
| alert-deduplicator | Monitoring | Low |
| backup-rotate-verify | Monitoring | Medium |
| catalog-sync | Utility | Low |
| container-health-check | Diagnostic | Medium |
| container-self-healer | Healing | Medium |
| deploy-validator | Deploy | Medium |
| docker-health-watcher | Monitoring | Low |
| incident-runbook | Incident | Medium |
| kokoro-health-check | Diagnostic | Low |
| litellm-health-check | Diagnostic | Low |
| litellm-skill-creator-template | Template | - |
| liteLLM-usage | Monitoring | Low |
| maintain-system-documentation | Utility | Low |
| monitoring-diagnostic | Diagnostic | Medium |
| monitoring-health-check | Diagnostic | Low |
| monitoring-zfs-snapshot | Backup | Low |
| ollama-health-check | Diagnostic | Low |
| oom-killer | Diagnostic | Medium |
| resource-monitor | Monitoring | Low |
| self-healing-cron | Monitoring | Medium |
| traefik-health-check | Diagnostic | Low |
| traefik-route-tester | Diagnostic | Low |
| verify-network | Diagnostic | Medium |
| openclaw-agents-kit | Agent Orchestration | Medium |
| wav2vec2-health-check | Diagnostic | Low |
| zfs-smart-scrub | Maintenance | Low |
| zfs-snapshot-and-rollback | Backup | Medium |

---

## Container Reference

Critical containers monitored by these skills:

| Container | Purpose | Skill |
|-----------|---------|-------|
| `coolify-proxy` | Traefik reverse proxy | traefik-health-check, self-healing-cron |
| `openclaw-qgtzrmi6771lt8l7x8rqx72f` | Voice AI bot | verify-network, incident-runbook |
| `zappro-litellm` | LLM proxy (Ollama + OpenRouter) | litellm-health-check, self-healing-cron |
| `zappro-wav2vec2` | STT GPU inference | wav2vec2-health-check, self-healing-cron |
| `zappro-litellm-db` | LiteLLM PostgreSQL | container-health-check |

## Network Reference

| Network | Purpose |
|---------|---------|
| `qgtzrmi6771lt8l7x8rqx72f` | OpenClaw container network |
| `zappro-lite_default` | LiteLLM + wav2vec2 + Ollama |
| `coolify` | Traefik external network |

---

## Integration Points

### Gitea Actions

```yaml
- name: Network Verification
  run: bash docs/OPERATIONS/SKILLS/verify-network.sh --json

- name: Deploy Validator
  run: bash docs/OPERATIONS/SKILLS/deploy-validator.sh
```

### Cron Jobs

```cron
# Self-healing every 5 minutes
*/5 * * * * /srv/monorepo/docs/OPERATIONS/SKILLS/self-healing.sh >> /srv/ops/logs/self-healing-cron.log 2>&1

# Container health every 5 minutes
*/5 * * * * /srv/monorepo/docs/OPERATIONS/SKILLS/container-health-check.sh --json >> /srv/ops/logs/container-health.log 2>&1

# Daily network verification
0 */4 * * * /srv/monorepo/docs/OPERATIONS/SKILLS/verify-network.sh --json
```

### Claude Code

```bash
# Run skill documentation
cat docs/OPERATIONS/SKILLS/traefik-health-check.md

# Execute skill
bash docs/OPERATIONS/SKILLS/verify-network.sh
```

---

## Anti-Patterns Detected

| ID | Anti-Pattern | Detected By |
|----|--------------|-------------|
| AP-1 | Host process as Docker backend | verify-network, deploy-validator |
| AP-2 | Test from host only | verify-network, deploy-validator |
| AP-3 | Health check without route check | deploy-validator, container-health-check |
| AP-4 | DNS/Tunnel UP = Service UP | deploy-validator, traefik-route-tester |

---

## Related Documentation

- `/srv/monorepo/docs/OPERATIONS/guide.md` — Operations guide
- `docs/GOVERNANCE/CONTRACT.md` — Governance contract
- `docs/GOVERNANCE/GUARDRAILS.md` — Guardrails (forbidden/approval required)
- `docs/INCIDENTS/` — Incident reports
- `HOMELAB-SURVIVAL-GUIDE.md` — Golden rules for the homelab

---

**Last updated:** 2026-04-08
**Maintainer:** will