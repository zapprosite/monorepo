# VIBEKIT-AUDIT — Security & Operations Audit

> Audit date: 2026-04-30
> All output in English per project language convention

---

## Componente: queue-manager.py

- **Path:** `/srv/monorepo/.claude/vibe-kit/queue-manager.py`
- **Function:** Atomic task queue operations (claim/complete/retry/freeze/set-limit/stats) using `fcntl.flock` for file locking and `os.replace()` for atomic writes via temp file.
- **Dependencies:**
  - Python 3 standard library: `sys`, `json`, `os`, `fcntl`, `tempfile`, `shutil`, `pathlib`, `time`
  - External env vars: `QUEUE_FILE` (defaults to `/srv/monorepo/.claude/vibe-kit/queue.json`)
  - Files: `queue.json`, `.queue.lock` (created if absent)

### Failure Modes

| Mode | Cause | Impact |
|------|-------|--------|
| Lock starvation | `fcntl.LOCK_EX` blocks indefinitely if lock file held by dead process | Workers hang, queue freezes |
| Temp file leak | Exception between `mkstemp` and `os.replace` leaves orphan temp file | Disk growth, eventual ENOSPC |
| Corrupt queue.json | Interrupted write (crash after mkstemp, before replace) | Partial JSON, parse failure on next read |
| Permission error on lock | Lock file created with `0o644` but process lacks write | `os.open` throws, all queue ops fail |
| Double `os.close` on valid fd | Lock fd closed in `finally` after prior close from error path | `OSError: Bad file descriptor` |

### Hardening Needed

- [ ] Add `fcntl.LOCK_NB` (non-blocking) with timeout loop for lock acquisition to prevent indefinite hang
- [ ] Register temp file for cleanup on any exception in `_write_queue`
- [ ] Validate JSON structure after read before returning (schema check)
- [ ] Close lock fd only once — track state or use context manager wrapper
- [ ] Add `atexit` handler to ensure lock file removed on abnormal Python exit

---

## Componente: run-vibe.sh

- **Path:** `/srv/monorepo/.claude/vibe-kit/run-vibe.sh`
- **Function:** Main entry point. Three phases: `lead_think()` parses SPEC into tasks and writes `queue.json`; `do_loop()` spawns up to 5 mclaude worker processes; `do_verify()` runs `pnpm test/tsc/lint`.
- **Dependencies:**
  - External scripts: `/srv/monorepo/scripts/context-reset.sh`, `/srv/monorepo/scripts/smoke-runner.sh`, `/srv/monorepo/scripts/notify-complete.sh`
  - External binaries: `python3`, `jq`, `mclaude`, `git`, `sudo`, `pnpm`
  - Env vars: `VIBE_PARALLEL` (default 5), `VIBE_HOURS` (default 8), `VIBE_PROVIDER` (default minimax), `VIBE_MODEL` (default MiniMax-M2.7), `VIBE_PHASE`, `QUEUE_FILE`
  - Files: `queue.json`, `state.json`, `.running_tasks.json`, `context/` dir

### Failure Modes

| Mode | Cause | Impact |
|------|-------|--------|
| Worker zombie processes | SIGCHLD handler race — `wait $pid` inside subshell may collect wrong pid | `.running_tasks.json` diverges from reality, stale entries accumulate |
| Smoke test false positives | `smoke-runner.sh` runs in background subshell but result captured via pipe; if subshell exits before `grep` runs | Task marked `done` even if smoke actually failed |
| SIGCHLD race (handle_sigchld) | Reads pids via `jobs -p` which lists ONLY jobs in current shell process, not child processes of the script itself | Dead workers not removed from `.running_tasks.json`, zombies |
| ZFS snapshot failure | `sudo zfs snapshot` fails silently (`2>/dev/null`) — pool `tank` may not exist | No snapshot, zero error signal to operator |
| lead_think() empty tasks | SPEC parsing regexes match nothing — `$tasks` is `null` or empty | Script exits with code 1 after creating empty queue |
| mclaude not on PATH | `mclaude` call fails | Worker exits, task stays `running` forever (no completion) |
| Queue file deleted mid-run | `rm queue.json` by external process | `_write_queue` `os.replace` fails, temp file leaks, subsequent ops corrupt |
| Git operations fail silently | `git checkout -b`, `git add -A`, `git commit` all use `|| true` | No branch/commit created, ship phase silently skipped |
| `pnpm` not installed | `do_verify` calls pnpm but binary absent | Verify always fails, final exit code = 1 despite tasks completing |
| Context reset script missing | `context-reset.sh` not found — `|| true` swallows exit | Task proceeds without context reset, stale context persists |
| Worker PID collision | Worker ID uses `W$$` (shell PID) — if same PID reused across cycles | Task completion could be attributed to wrong worker |

### Hardening Needed

- [ ] Replace `jobs -p` SIGCHLD handler with proper `wait -n` or `wait $pid` in loop indexed by PID
- [ ] Make ZFS snapshot failures visible (remove `2>/dev/null` or log to file)
- [ ] Add `set -u` check before accessing `SCRIPT_CONTEXT_RESET` etc. — fail fast if missing
- [ ] Add `--exitstatus` for mclaude to detect real failure vs empty output
- [ ] Capture smoke output reliably — avoid pipe race by using temp file instead of variable
- [ ] Use UUID or monotonic counter instead of `W$$` for worker ID
- [ ] Validate queue file exists before `_write_queue` — add atomic rename validation

---

## Componente: pipeline.json

- **Path:** `/srv/monorepo/.claude/vibe-kit/pipeline.json`
- **Function:** Static configuration file for lead model, worker model, rate limits, queue paths, loop behavior, ZFS snapshot settings, ship/git settings, and verify commands.
- **Dependencies:**
  - External env vars referenced: `VIBE_PARALLEL` (for `parallel_limit_env`), `VIBE_PHASE` (for `phase_env`)
  - Runtime files derived from config: `queue.json`, `state.json`, `queue.json.lock`, `context/`

### Failure Modes

| Mode | Cause | Impact |
|------|-------|--------|
| Invalid JSON | File corrupted or edited manually | Python `json.load` throws, entire vibe-kit crashes on startup |
| Snapshot pool missing | `tank` ZFS pool does not exist on host | Every snapshot attempt silently fails |
| Snapshot prefix collision | `vibe-pre-YYYYMMDD-HHMMSS` format could collide if called twice per second | ZFS refuses duplicate snapshot names, errors swallowed |
| Verify command missing | `pnpm` not in PATH — verify fails | Pipeline fails even on correct implementations |
| Lock file path overflow | `QUEUE_FILE.parent` on very long path + `/.queue_tmp_` prefix exceeds PATH_MAX | `tempfile.mkstemp` fails with `OSError` |

### Hardening Needed

- [ ] Add JSON schema validation at startup (Zod or jsonschema)
- [ ] Pre-check ZFS pool existence before snapshot loop
- [ ] Add uniqueness salt to snapshot name to prevent collisions
- [ ] Validate verify commands exist (`command -v pnpm`) before running

---

## Componente: state.json

- **Path:** `/srv/monorepo/.claude/vibe-kit/state.json`
- **Function:** Runtime state persistence. Minimal — only stores spec name, phase, task counts, gate flags, and `updated_at`.
- **Dependencies:** None (read-only during normal operation, written by external orchestrator)

### Failure Modes

| Mode | Cause | Impact |
|------|-------|--------|
| Missing file | Deleted between checks | Downstream tools expecting state.json fail |
| Stale data | Updated by old run but read by new run expecting fresh state | Wrong phase routing |

### Hardening Needed

- [ ] Create file on first run if missing (currently empty directory is fine since state is optional)

---

## Componente: SPEC.md

- **Path:** `/srv/monorepo/.claude/vibe-kit/SPEC.md`
- **Function:** Design specification documenting architecture, 3-phase pipeline, queue schema, rate limit math, worker behavior, ZFS snapshot policy, loop behavior, and file inventory.
- **Dependencies:** None (read-only documentation)

### Failure Modes

| Mode | Cause | Impact |
|------|-------|--------|
| Out-of-sync with code | Code changes not reflected in SPEC | Misleading documentation, incorrect onboarding |
| Deleted files still documented | e.g. `nexus.sh` listed as deleted but `state-manager.py` reference unclear | Confusion about what actually exists |

### Hardening Needed

- [ ] Add a CI check that all files listed in SPEC actually exist on disk
- [ ] Track version in SPEC to sync with `pipeline.json`

---

## Vulnerabilities

| Componente | Vulnerabilidade | Impacto | Severity |
|------------|-----------------|---------|----------|
| `run-vibe.sh` | **Zombie process accumulation** — SIGCHLD handler uses `jobs -p` which only sees subshell jobs, not detached background processes. Dead workers remain in `.running_tasks.json` | Resource leak, stale tracking, eventual loop malfunction | HIGH |
| `run-vibe.sh` | **Smoke result race condition** — `smoke_output=$(bash ...)` pipe race: if subshell exits before capture, `$smoke_output` is empty, `$smoke_exit=0`, task wrongly marked `done` | Incorrect task status, bugs shipped to PR | HIGH |
| `queue-manager.py` | **Blocking lock with no timeout** — `fcntl.flock(lock_fd, LOCK_EX)` without `LOCK_NB` will hang forever if the lock holder is dead | Workers hang indefinitely, pipeline deadlock | HIGH |
| `run-vibe.sh` | **Worker ID via PID collision** — `W$$` reuses shell PID within same run or across resumed runs. Same PID = task attributed to wrong worker | Task state corruption, completion race | MEDIUM |
| `run-vibe.sh` | **Git operations swallowed** — all git commands use `|| true` with no visibility | Ship phase silently skipped on error, no indication to operator | MEDIUM |
| `queue-manager.py` | **Temp file leak on exception** — `_write_queue` creates temp file, exception before `os.replace` leaves orphan `.queue_tmp_*` file | Disk growth, eventual ENOSPC | MEDIUM |
| `run-vibe.sh` | **Context reset failure silenced** — `|| true` on `context-reset.sh` call means missing/broken script goes unnoticed | Stale context persists across tasks, cross-contamination | MEDIUM |
| `pipeline.json` | **ZFS pool `tank` not validated** — snapshot commands fail silently (`2>/dev/null`) if pool absent | No snapshots taken despite config saying otherwise | MEDIUM |
| `queue-manager.py` | **Lock fd double-close potential** — if `os.close` is called twice (once in error path, once in `finally`) | `OSError: Bad file descriptor` crash | LOW |
| `run-vibe.sh` | **Empty queue exit not distinguishable** — loop breaks with `echo "Queue empty. Done."` but exit code 0 whether all tasks were done or none existed | Downstream notify script receives same signal for success and no-work | LOW |
| `run-vibe.sh` | **Verify fails open** — if `pnpm test/tsc/lint` not found, `eval "$cmd"` sets `$?` to 127 but `>/dev/null 2>&1` hides it — verify still "passes" if `failed=0` by luck | Bugs shipped to PR | LOW |
| `run-vibe.sh` | **Lead task parsing silent failure** — if SPEC matches no regex pattern, `$tasks` is empty, script prints error to stderr but `overall_exit=1` is set — however `do_loop` may still run on empty queue | No tasks executed despite pipeline appearing to start | LOW |
| `run-vibe.sh` | **Parallel limit not enforced by queue** — `set-limit` updates `parallel_limit` in queue header but workers never read it. `MAX_WORKERS` is bash-only from env `VIBE_PARALLEL`. No coordination between script and `queue-manager.py` | Queue limit config is inert, workers ignore it | LOW |
| `pipeline.json` | **Verify commands unchecked** — commands `["pnpm test", "pnpm tsc --noEmit", "pnpm lint"]` are static; no pre-flight check they exist | Every verify phase fails if pnpm missing | LOW |

---

## External Dependencies Summary

| Dependency | Type | Used By |
|-----------|------|---------|
| `python3` | Binary | `queue-manager.py`, `run-vibe.sh` (inline python) |
| `mclaude` | Binary | `run-vibe.sh` (worker spawn) |
| `jq` | Binary | `run-vibe.sh` (JSON manipulation) |
| `git` | Binary | `run-vibe.sh` (ship phase) |
| `sudo` + ZFS | Binary + FS | `run-vibe.sh` (snapshots) |
| `pnpm` | Binary | `run-vibe.sh` (verify) |
| `/srv/monorepo/scripts/context-reset.sh` | Script | `run-vibe.sh` |
| `/srv/monorepo/scripts/smoke-runner.sh` | Script | `run-vibe.sh` |
| `/srv/monorepo/scripts/notify-complete.sh` | Script | `run-vibe.sh` |
| `/srv/monorepo/docs/SPECS/{spec}.md` | File | `run-vibe.sh` (input) |
| `tank` ZFS pool | Filesystem | `run-vibe.sh` + `pipeline.json` |
| Env: `VIBE_PARALLEL`, `VIBE_HOURS`, `VIBE_PROVIDER`, `VIBE_MODEL`, `VIBE_PHASE` | Env vars | `run-vibe.sh` |
| Env: `QUEUE_FILE` | Env var | `queue-manager.py` |
