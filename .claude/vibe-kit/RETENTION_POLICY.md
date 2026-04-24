# VIBE-KIT — Retention Policy

## Log Retention

| Type | Retention | Reason |
|------|-----------|--------|
| `vibe-kit.log` | 10MB rotate, 30d max | Main runner log |
| `worker-*.log` | 7 days | Worker execution traces |
| `TEST-*.log` | 7 days | Test output |
| `AGENT-*.log` | 7 days | Agent session logs |
| `SCRIPT-*.log` | 7 days | Script execution |
| `*-done` markers | 7 days | Completion markers |
| `vibe-kit.2*.log` | 30 days | Rotated archives |

## Run Cleanup

```bash
# Manual
bash ~/.claude/vibe-kit/cleanup-vibe.sh

# Dry run
bash ~/.claude/vibe-kit/cleanup-vibe.sh --dry-run

# Set retention via env
VIBE_LOG_RETENTION=14 bash cleanup-vibe.sh
```

## Cron (recommended)

Add to crontab:
```
0 3 * * * bash /home/will/.claude/vibe-kit/cleanup-vibe.sh >> /home/will/.claude/vibe-kit/logs/vibe-kit-cron.log 2>&1
```

## Active Files (never delete)

- `vibe-kit.sh` — main runner
- `SPEC.md` — this document
- `queue.json` — task queue (persistent)
- `state.json` — runner state
- `cleanup-vibe.sh` — retention script
- `RETENTION_POLICY.md` — this file
- `context/` — task context snippets
- `logs/` — (cleaned automatically)

## Log Size Budget

Target: logs/ directory < 50MB total
- ~7 days × 15 workers × ~500KB per worker log ≈ ~50MB worst case
- With retention: ~20-30MB typical
