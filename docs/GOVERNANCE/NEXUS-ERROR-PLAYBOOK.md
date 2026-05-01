# Nexus Error Playbook

Classification: INTERNAL
Status: `ACTIVE`
Updated: 2026-05-01

## First Commands

```bash
bash scripts/vibe.sh --status
bash scripts/vibe-ctl.sh queue
python3 .claude/vibe-kit/queue-manager.py stats
pgrep -af 'run-vibe|queue-manager.py|claude|codex|opencode' || true
```

Do not inspect secret files or sensitive logs during first response.

## Queue Has Running Tasks But No Workers

1. Confirm no live worker owns the task.
2. Rerun do phase; runner requeues stale running tasks on start.
3. If still stuck, mark affected task failed/frozen with a clear reason.

```bash
bash scripts/vibe.sh --spec SPEC-ID --app app --do
```

## Queue JSON Is Corrupt

Expected behavior: `queue-manager.py` returns a controlled health error.

```bash
python3 .claude/vibe-kit/queue-manager.py health
```

If corrupt, rebuild from the SPEC using plan phase. Do not hand-edit task status unless this is an explicit recovery action.

## Worker Takes Too Long

1. Stop passive waiting.
2. Check process is alive.
3. Inspect queue status.
4. Split task or switch to local focused verification.
5. Complete as `done`, `failed`, or `frozen` accurately.

## Smoke Fails

Use focused app route:

```bash
env WORKDIR=/srv/monorepo/<app> bash scripts/smoke-runner.sh
```

If root smoke is misleading, run direct checks for the affected app and document the route.

## Protected Infra Or Deploy Block

Freeze the task when it requires:

- Cloudflare DNS mutation.
- Coolify API from non-allowlisted IP.
- Secret access.
- Production endpoint changes.

Document the manual prerequisite instead of forcing automation.

## Recovery Anti-Patterns

- Do not `git reset --hard`.
- Do not delete real queue/context during testing.
- Do not print secrets.
- Do not use `git add -A` from automation.
- Do not leave `running` tasks orphaned.
