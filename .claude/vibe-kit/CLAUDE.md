# Vibe-Kit Worker Instructions

Status: `ACTIVE`

You are running inside the Nexus/vibe-kit automation context for `/srv/monorepo`.

## Mandatory Rules

- Stay inside `/srv/monorepo`.
- Do not read or print `.env`, `secrets/`, private data, databases, or sensitive logs.
- Do not use `git add -A`, forced checkout, or destructive cleanup unless explicitly instructed.
- Use queue-manager for task state. Do not edit `queue.json` directly.
- Run focused verification before marking work done.
- If blocked by protected infra, secrets, DNS, Coolify allowlist, or production deploy, mark/freeze the task instead of guessing.

## Runtime Flow

```text
SPEC -> queue-manager claim -> execute bounded task -> smoke verify -> queue-manager complete
```

## Useful Commands

```bash
python3 .claude/vibe-kit/queue-manager.py stats
bash scripts/vibe.sh --status
bash scripts/vibe-ctl.sh queue
bash scripts/smoke-runner.sh
```

## Multi-CLI

The supported CLIs are detected through `scripts/multi-cli-adapter.sh`.

Do not print API key values or prefixes while diagnosing CLI availability.

## Timebox

If a task runs longer than normal, stop waiting passively. Inspect state, choose a shorter verification route, split the task, or mark it failed/frozen with a clear reason.
