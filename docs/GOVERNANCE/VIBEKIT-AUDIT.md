# Vibe-Kit Audit Notes

Classification: INTERNAL
Status: `ACTIVE`
Updated: 2026-05-01

## Current Security Posture

| Area | Status | Notes |
|------|--------|-------|
| Queue locking | `ACTIVE` | `fcntl.flock` plus atomic replace |
| Lock timeout | `ACTIVE` | Controlled lock timeout path |
| Malformed queue handling | `ACTIVE` | Invalid JSON and wrong `tasks` type return health errors |
| Secret-safe CLI smoke | `ACTIVE` | Presence only; no value/prefix output |
| Stress isolation | `ACTIVE` | Stress harnesses use temporary queue/context |
| Auto commit | `DISABLED BY DEFAULT` | `VIBE_SKIP_GIT_COMMIT=true` |
| Auto deploy | `BLOCKED` | Coolify AllowList required |

## Known Residual Risks

| Risk | Mitigation |
|------|------------|
| Worker prompts are inline shell strings | Move to prompt templates |
| Generic verify can be wrong for some apps | Prefer app-scoped smoke/direct checks |
| OpenCode path not deeply smoked | Keep `PLACEHOLDER` until verified |
| Metrics exporter missing | Keep monitoring doc as `PLACEHOLDER` |

## Required Audit Checks

```bash
python3 -m py_compile .claude/vibe-kit/queue-manager.py
bash smoke-tests/smoke-queue-atomic.sh
bash smoke-tests/smoke-context-isolation.sh
bash smoke-tests/smoke-multi-cli.sh
timeout 75 bash smoke-tests/stress-concurrent.sh
timeout 75 bash smoke-tests/stress-lock-contention.sh
timeout 75 bash smoke-tests/stress-corrupt-queue.sh
timeout 75 bash smoke-tests/stress-rapid-fire.sh
```
