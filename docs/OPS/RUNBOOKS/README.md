# OPS Runbooks Index

> Self-healing runbooks for homelab-monorepo — SPEC-071-V7

## Severity Levels

| Level | Definition | Response Time |
|-------|-----------|---------------|
| P1 | Service completely down | Immediate |
| P2 | Service degraded | Within 1 hour |
| P3 | Non-critical issue | Next sprint |
| P4 | Informational | Weekly triage |

## Runbooks

### Severity Runbooks

| File | Severity | Description |
|------|----------|-------------|
| `P1-SERVICE-DOWN.md` | P1 | Complete service outage — immediate escalation |
| `P2-SERVICE-DEGRADED.md` | P2 | Performance/reliability degradation |
| `P3-NON-CRITICAL.md` | P3 | Minor issue with workaround |
| `P4-INFORMATIONAL.md` | P4 | Log only, no immediate action |

### Component Runbooks

| File | Component | Description |
|------|-----------|-------------|
| `ORCHESTRATOR-FAILURE.md` | Claude Code Orchestrator | Pipeline failure, DLQ, circuit breaker |
| `PIPELINE-ROLLBACK.md` | Pipeline State | Rollback pipeline to previous state |

## Quick Reference

### Health Checks

```bash
# Hermes Gateway
curl -s http://localhost:8642/health

# AI Gateway
curl -s http://localhost:4002/health

# Qdrant
curl -s http://localhost:6333/health

# Ollama
curl -s http://localhost:11434/api/tags
```

### Orchestrator State

```bash
# Agent states
ls -la tasks/agent-states/

# DLQ
ls -la .claude/skills/orchestrator/dlq/

# Locks
ls -la .claude/skills/orchestrator/locks/

# Metrics (Prometheus scrape)
bash .claude/skills/orchestrator/scripts/metrics_collector.sh scrape
```

### Version Drift (SPEC-071-V1)

```bash
# Detect
bash scripts/versions-check.sh

# Fix
bash scripts/versions-update.sh
git add VERSION-LOCK.md && git commit -m "fix: reconcile version drift"
```

## Alert Routing

```
P1 Alert → PagerDuty → On-call → Wake
P2 Alert → Slack #ops-alerts → Team lead
P3 Alert → Slack #ops-info → Sprint backlog
P4 Alert → Log only → Weekly review
```

## Related Docs

- `SPEC-023-unified-monitoring-self-healing.md` — Prometheus + Grafana + AlertManager
- `SPEC-071-enterprise-monorepo-datacenter-architecture.md` — Architecture
- `docs/GOVERNANCE/ALERTING-POLICY.md` — Alert routing and escalation
