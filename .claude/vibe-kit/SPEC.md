# Vibe-Kit Runtime SPEC

Status: `ACTIVE`
Version: 3.0
Updated: 2026-05-01

## Purpose

Vibe-kit provides a bounded, monorepo-local automation loop:

```text
SPEC -> plan queue -> claim task -> run CLI worker -> smoke verify -> complete/fail/freeze
```

The system is optimized for controlled homelab execution, not blind production deployment.

## Entrypoints

| Entrypoint | Status | Use |
|------------|--------|-----|
| `scripts/vibe.sh` | `ACTIVE` | Preferred user command |
| `scripts/vibe-ctl.sh` | `ACTIVE` | Runtime status/control |
| `scripts/nexus-ctl.sh` | `ACTIVE` | Nexus-facing wrapper |
| `.claude/vibe-kit/run-vibe.sh` | `ACTIVE` | Low-level runner |
| `.claude/vibe-kit/nexus.sh` | `DEPRECATED` | Do not document as required unless recreated |

## Phases

| Phase | Command | Effect |
|-------|---------|--------|
| Plan | `VIBE_PHASE=plan run-vibe.sh SPEC app` | Parse SPEC into queue |
| Do | `VIBE_PHASE=do run-vibe.sh SPEC app` | Execute pending queue tasks |
| Verify | `VIBE_PHASE=verify run-vibe.sh SPEC app` | Run generic verification |
| Full | `run-vibe.sh SPEC app` | Plan, do, verify |

`scripts/vibe.sh --spec SPEC --app app --run` runs plan then do with safe defaults.

## Queue Schema

Required top-level fields:

```json
{
  "spec": "SPEC-ID",
  "app": "app-name",
  "total": 0,
  "pending": 0,
  "running": 0,
  "done": 0,
  "failed": 0,
  "frozen": 0,
  "phase": "do",
  "parallel_limit": 5,
  "tasks": []
}
```

Task fields:

```json
{
  "id": "T001",
  "name": "short-slug",
  "description": "human task text",
  "app": "crm-mvp",
  "spec": "SPEC-ID",
  "status": "pending",
  "attempts": 0,
  "worker": null,
  "created_at": "ISO-8601",
  "completed_at": null,
  "error": null
}
```

`queue-manager.py` validates malformed JSON and wrong `tasks` type as controlled health errors.

## Safety Invariants

- Queue writes are atomic and locked.
- Stress tests must default to temporary queues.
- Automatic commits are disabled by default.
- ZFS snapshots are disabled by default in safe wrapper mode.
- Secrets are never printed.
- Protected infra/deploy tasks are frozen, not guessed.

## Current Verification Baseline

Validated on 2026-05-01:

```text
smoke-queue-atomic                 PASS
smoke-context-isolation            PASS
smoke-multi-cli-detector           PASS
smoke-multi-cli                    PASS
smoke-bare-forbidden               PASS
stress-concurrent                  PASS
stress-lock-contention             PASS
stress-corrupt-queue               PASS
stress-rapid-fire                  PASS
stress-context-overflow            PASS
```

Queue real-state hash was unchanged during isolated stress execution.

## Video Recording on Failure

When a worker task fails, the system automatically produces a terminal video recording for post-mortem analysis.

**How it works:**
- `script(1)` records the full terminal session (typescript + timing file) whenever `VIBE_RECORD` is not `"false"` (default: `true`)
- On failure detection (`result=failed`), `scripts/typescript-to-video.py` converts the recording to:
  - `.cast` — asciicast v2 format, replayable with `asciinema play <file>.cast`
  - `.mp4` — H.264 video, viewable in any video player
- Output files: `$LOG_DIR/recording-<task_id>.cast` and `$LOG_DIR/recording-<task_id>.mp4`
- Video production is skipped if `VIBE_RECORD=false` is set

**Converter dependency:** `python3` + `ffmpeg` (with `libx264` encoder). Gracefully degrades if unavailable — typescript is preserved for `scriptreplay`.

## Non-Goals

- Replacing Gitea/Coolify deployment governance.
- Auto-mutating Cloudflare DNS.
- Reading real secret files.
- Running global cron jobs outside this repository.
- Maintaining a 7 x 7 agent taxonomy as runtime requirement.
