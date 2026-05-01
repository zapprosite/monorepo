# Nexus Runtime Audit

Classification: INTERNAL
Status: `ACTIVE`
Updated: 2026-05-01

## Scope

Audited components:

- `.claude/vibe-kit/run-vibe.sh`
- `.claude/vibe-kit/queue-manager.py`
- `scripts/vibe.sh`
- `scripts/vibe-ctl.sh`
- `scripts/nexus-ctl.sh`
- `scripts/multi-cli-adapter.sh`
- `scripts/cli-detector.sh`

## Current Findings

| Severity | Finding | Status |
|----------|---------|--------|
| High | Stress scripts previously mutated real queue/context | `FIXED` for local harnesses |
| High | Queue wrong-type `tasks` produced unhandled AttributeError | `FIXED` with controlled health error |
| High | `smoke-multi-cli.sh` printed API key prefix and failed on unset env | `FIXED` to print presence only |
| Medium | Automatic git commit is unsafe in dirty monorepo | `MITIGATED` by `VIBE_SKIP_GIT_COMMIT=true` |
| Medium | ZFS snapshots are host-specific | `MITIGATED` by `VIBE_SNAPSHOT_EVERY=0` safe default |
| Medium | OpenCode command path is not production-smoked | `PLACEHOLDER` |

## Required Regression Checks

```bash
bash -n .claude/vibe-kit/run-vibe.sh scripts/vibe.sh scripts/vibe-ctl.sh scripts/nexus-ctl.sh
python3 -m py_compile .claude/vibe-kit/queue-manager.py
bash smoke-tests/smoke-multi-cli.sh
timeout 75 bash smoke-tests/stress-corrupt-queue.sh
timeout 75 bash smoke-tests/stress-rapid-fire.sh
```

## Audit Rule

Any doc or script claiming active capability must have:

- A real file path.
- A command that runs from `/srv/monorepo`.
- A smoke or manual verification route.
- A status label.

Otherwise it is `PLACEHOLDER` or `DEPRECATED`.
