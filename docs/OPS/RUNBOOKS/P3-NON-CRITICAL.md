# P3 — Non-Critical Issue Runbook

> **Severity:** P3 — MEDIUM
> **Definition:** Minor degradation, workarounds available, no user impact
> **Escalation:** Schedule fix within next sprint

## Examples

- Single non-essential endpoint returning errors
- Warning logs appearing consistently (but service functional)
- Non-critical container in restart loop (but core service stable)
- Version drift detected (but tests passing)

## Actions

```bash
# Document the issue
echo "P3 incident: $(date) - {description}" >> docs/OPS/INCIDENT_LOG.md

# Check if there's a known issue / recent change
git log --oneline -5
docker images | grep {app}

# Schedule fix (do not escalate unless escalates to P2/P1)
```

## Version Drift (SPEC-071-V1)

```bash
# Detect drift
bash scripts/versions-check.sh

# If drift found, update
bash scripts/versions-update.sh
git add VERSION-LOCK.md
git commit -m "fix: reconcile version drift $(date -I)"
```

## Post-Incident

- Create issue/ticket for fix
- Add to next sprint backlog
- Document workaround if applicable
