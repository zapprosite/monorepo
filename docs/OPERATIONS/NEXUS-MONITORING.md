# Nexus Monitoring

Classification: INTERNAL
Status: `PLACEHOLDER`
Updated: 2026-05-01

## Active Monitoring Today

Active local checks:

```bash
bash scripts/vibe.sh --status
bash scripts/vibe-ctl.sh queue
python3 .claude/vibe-kit/queue-manager.py stats
```

Useful queue thresholds:

| Signal | Healthy | Action |
|--------|---------|--------|
| `failed` | `0` | Review failed task before rerun |
| `running` | Matches live worker count | Requeue stale tasks by rerunning do phase |
| `pending` | Decreases during run | Investigate blocked worker if unchanged |
| `frozen` | Only known protected tasks | Manual/operator action |

## Placeholder Metrics

Prometheus/Grafana monitoring is not active unless a metrics exporter exists. These are target metrics, not current guarantees:

- `nexus_queue_pending`
- `nexus_queue_running`
- `nexus_queue_failed`
- `nexus_task_duration_seconds`
- `nexus_worker_exit_total`
- `nexus_smoke_failure_total`

## Alert Policy

Until metrics are implemented, alerts are manual/runbook driven:

- Any `failed > 0` after a run.
- Any `running > 0` without live worker process.
- Any task exceeding expected timebox.
- Any deploy/DNS/Coolify task not explicitly approved.

## Redaction

Monitoring output must not include secret values, token prefixes, raw `.env`, database content, or sensitive logs.
