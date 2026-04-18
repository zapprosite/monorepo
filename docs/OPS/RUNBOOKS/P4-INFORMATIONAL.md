# P4 — Informational Runbook

> **Severity:** P4 — LOW
> **Definition:** Informational, no action required unless it escalates
> **Response:** Log only, review in weekly triage

## Examples

- Smoke test failure in CI (but deployment still works)
- Prometheus alert firing for a metric that's informational only
- Disk usage > 70% (but not yet critical)
- Deprecation warning in logs

## Actions

```bash
# Log informational event
echo "[$(date -Iseconds)] P4: {event}" >> docs/OPS/INCIDENT_LOG.md

# No immediate action required
# Review in weekly ops triage
```

## Disk Usage Monitoring

```bash
# Check disk
df -h /srv

# If > 70%: clean up
docker system prune -f
rm -rf /tmp/*.log 2>/dev/null || true
```

## Weekly Review

In weekly ops triage, review all P4 events logged since last review.
