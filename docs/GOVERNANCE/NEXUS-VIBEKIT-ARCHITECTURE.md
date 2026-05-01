# Nexus + Vibe-Kit Architecture

Classification: INTERNAL
Status: `ACTIVE`
Updated: 2026-05-01

## Purpose

Nexus is the control surface. Vibe-kit is the local execution runtime.

The active architecture is intentionally small:

```text
User/spec
  -> scripts/vibe.sh or scripts/nexus-ctl.sh
  -> .claude/vibe-kit/run-vibe.sh
  -> .claude/vibe-kit/queue-manager.py
  -> CLI worker
  -> scripts/smoke-runner.sh
```

This document replaces older 7 x 7 agent and PREVC claims as operational truth. Those ideas are `PLACEHOLDER` unless backed by current scripts and smoke tests.

## Active Entrypoints

| Entrypoint | Status | Purpose |
|------------|--------|---------|
| `scripts/vibe.sh` | `ACTIVE` | Preferred human command for SPEC plan/do/verify |
| `scripts/vibe-ctl.sh` | `ACTIVE` | Runtime status, queue display, SPEC run |
| `scripts/nexus-ctl.sh` | `ACTIVE` | Nexus-facing wrapper around vibe execution |
| `.claude/vibe-kit/run-vibe.sh` | `ACTIVE` | Low-level runner |
| `.claude/vibe-kit/queue-manager.py` | `ACTIVE` | Atomic queue state |

## Data Flow

1. A tracked SPEC in `docs/SPECS/` provides checkbox tasks.
2. `run-vibe.sh` plan phase parses tasks and writes `queue.json`.
3. Workers claim tasks through `queue-manager.py claim`.
4. Each worker executes a bounded task through the configured CLI.
5. Smoke verification runs with app-scoped `WORKDIR` when available.
6. Worker marks `done` or `failed`; protected/manual work can be `frozen`.

## Queue Invariants

- `queue-manager.py` is the only writer for task state after plan creation.
- File writes use lock plus atomic replace.
- `pending + running + done + failed + frozen` must match `total`.
- Stale `running` tasks are requeued on runner start when no live process owns them.

## CLI Support

| CLI | Status | Notes |
|-----|--------|-------|
| Claude Code | `ACTIVE` | Primary tested worker path |
| Codex | `ACTIVE` | Supported by adapter and command builder |
| OpenCode | `PLACEHOLDER` | Installed/recognized; needs dedicated production smoke |
| mclaude | `OPTIONAL` | Works when auth/provider are valid |

## Safety Boundaries

The runner must not:

- Read or print secrets.
- Auto-deploy through Coolify API without AllowList validation.
- Mutate Cloudflare DNS.
- Auto-commit a dirty monorepo.
- Run destructive stress tests against the real queue.

## Current Placeholders

| Placeholder | Required before ACTIVE |
|-------------|------------------------|
| Unified `scripts/nexus-flow.sh` | Implement local `run/status/doctor/cron`, lock, config |
| Cron automation | Idempotent lock, timeout, redacted report |
| Full PREVC ship gate | Formal gates and non-destructive staging |
| Prometheus/Grafana metrics | Metrics exporter and dashboard config |
| Automated ZFS snapshots | Explicit operator opt-in and pool validation |

## Verification Baseline

Required before changing runtime behavior:

```bash
bash -n .claude/vibe-kit/run-vibe.sh scripts/vibe.sh scripts/vibe-ctl.sh scripts/nexus-ctl.sh
python3 -m py_compile .claude/vibe-kit/queue-manager.py
bash smoke-tests/smoke-queue-atomic.sh
bash smoke-tests/smoke-context-isolation.sh
timeout 75 bash smoke-tests/stress-rapid-fire.sh
timeout 75 bash smoke-tests/stress-lock-contention.sh
```
