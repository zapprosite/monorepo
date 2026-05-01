#!/bin/bash
#────────────────────────────────────────────────────────────────────────────
# run-vibe.sh — Hardened vibe-kit runner
#────────────────────────────────────────────────────────────────────────────
# Hardening applied:
#   • Error handling: set -euo pipefail everywhere
#   • Timeouts on all external commands (curl, mclaude, etc)
#   • Retry logic with exponential backoff
#   • Structured logging (timestamps + DEBUG/INFO/WARN/ERROR)
#   • Health check at startup
#   • Graceful shutdown (SIGTERM cleans up workers)
#   • Max runtime enforcement (8h)
#   • Context isolation between tasks
#────────────────────────────────────────────────────────────────────────────

# ─── Bash strictness ────────────────────────────────────────────────────────
set -euo pipefail

# ─── Constants ──────────────────────────────────────────────────────────────
WORKDIR="/srv/monorepo/.claude/vibe-kit"
QUEUE_FILE="$WORKDIR/queue.json"
STATE_FILE="$WORKDIR/state.json"
LOG_DIR="$WORKDIR/logs"
RUNNING_FILE="$WORKDIR/.running_tasks.json"
CONTEXT_DIR="$WORKDIR/context"
MAX_WORKERS="${VIBE_PARALLEL:-5}"
MAX_HOURS="${VIBE_HOURS:-8}"
PROVIDER="${VIBE_PROVIDER:-minimax}"
MODEL="${VIBE_MODEL:-MiniMax-M2.7}"
POLL_INTERVAL=5
SNAPSHOT_EVERY="${VIBE_SNAPSHOT_EVERY:-3}"
SMOKE_MAX_RETRIES=3
MAX_RUNTIME_SECS=$((MAX_HOURS * 3600))

# External scripts
SCRIPT_CONTEXT_RESET="/srv/monorepo/scripts/context-reset.sh"
SCRIPT_SMOKE_RUNNER="/srv/monorepo/scripts/smoke-runner.sh"
SCRIPT_NOTIFY_COMPLETE="/srv/monorepo/scripts/notify-complete.sh"
SCRIPT_TYPESCRIPT_TO_VIDEO="/srv/monorepo/scripts/typescript-to-video.py"

# Retry defaults
RETRY_BASE_DELAY=2
RETRY_MAX_DELAY=60
RETRY_MAX_ATTEMPTS=5

# ─── External command timeouts (seconds) ────────────────────────────────────
TIMEOUT_MCLAUDE=1800   # 30 min per task
TIMEOUT_CURL=30
TIMEOUT_ZFS=60
TIMEOUT_GIT=60
TIMEOUT_PYTHON=30

# ─── Global state ───────────────────────────────────────────────────────────
declare -A BG_PIDS        # background worker PIDs
LOG_LEVEL="${LOG_LEVEL:-INFO}"

# ─── Claude Code native flags ────────────────────────────────────────────────
# Derived from: claude --help | grep -E "(resume|settings|permission)"
# Patterns for Claude Code native integration

# Resume mode: --resume with optional session ID or search term
# Fuzzy resume via --resume without args opens interactive picker
RESUME_SESSION="${RESUME_SESSION:-}"           # Session ID or search term
FORK_ON_RESUME="${FORK_ON_RESUME:-false}"     # Use --fork-session with resume

# Settings loading: use project-level settings.json + optional local override
SETTINGS_FILE="${SETTINGS_FILE:-}"            # Extra settings file to load

# Permission mode: use bypassPermissions in headless workers
PERMISSION_MODE="${PERMISSION_MODE:-bypassPermissions}"  # auto|bypassPermissions|dontAsk

# CLAUDE.md reading: project-level .claude/CLAUDE.md is auto-read by Claude Code
# No flag needed - this is default behavior unless --bare is used
# We explicitly do NOT use --bare to preserve CLAUDE.md discovery

# ─── Worker command builder ──────────────────────────────────────────────────
_build_worker_cmd() {
    local provider="$1"
    local model="$2"

    local cmd="$WORKER_CMD"  # from multi-cli-adapter.sh
    local cmd_bin="${cmd%% *}"
    local cmd_name
    cmd_name="$(basename "$cmd_bin" 2>/dev/null || echo "$cmd_bin")"

    # Add --dangerously-skip-permissions if not already in WORKER_CMD
    if [[ ! "$cmd" =~ "--dangerously-skip-permissions" ]]; then
        cmd="$cmd --dangerously-skip-permissions"
    fi

    # Add --resume if RESUME_SESSION is set
    if [[ -n "$RESUME_SESSION" ]]; then
        cmd="$cmd --resume $RESUME_SESSION"
        if [[ "$FORK_ON_RESUME" == "true" ]]; then
            cmd="$cmd --fork-session"
        fi
    fi

    # Add --settings if SETTINGS_FILE is set
    if [[ -n "$SETTINGS_FILE" ]] && [[ -f "$SETTINGS_FILE" ]]; then
        cmd="$cmd --settings $SETTINGS_FILE"
    fi

    # Set permission mode for headless operation
    cmd="$cmd --permission-mode $PERMISSION_MODE"

    # Provider and model. Claude Code does not accept --provider; mclaude does.
    if [[ "$cmd_name" == "claude" ]] || [[ "$cmd_name" == "claude-code" ]]; then
        [[ -n "$model" ]] && cmd="$cmd --model $model"
    else
        cmd="$cmd --provider $provider --model $model"
    fi

    echo "$cmd"
}

# ─── Multi-CLI detection ─────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "$SCRIPT_DIR/../../scripts/multi-cli-adapter.sh" ]]; then
    source "$SCRIPT_DIR/../../scripts/multi-cli-adapter.sh"
fi

# Worker command — allow override, default based on detected CLI
WORKER_CMD="${WORKER_CMD:-${CLI_TYPE:-mclaude}}"

# OpenCode specifics
_is_opencode_worker() {
    [[ "${WORKER_CMD}" == "opencode" ]] || [[ "$(basename "${WORKER_CMD}" 2>/dev/null)" == opencode* ]]
}

# Codex CLI specifics
# Codex CLI: https://docs.codex.cli
# Key flags:
#   -C, --cd <DIR>         Set working directory
#   -s, --sandbox <MODE>   sandbox mode: read-only|workspace-write|danger-full-access
#   --full-auto             Low-friction automatic execution
#   --dangerously-bypass-approvals-and-sandbox  Skip confirmations (dangerous!)
#   --json                  Print events as JSONL (streaming output)
#   -o, --output-last-message <FILE>  Write last message to file
#   --ephemeral             Don't persist session
#   --ignore-rules          Don't load .rules files
#   -m, --model <MODEL>     Specify model
#   -c, --config <k=v>     Override config values
#   -p, --profile <PROFILE> Use config profile
#   --search                Enable web search
_is_codex_worker() {
    [[ "${CLI_TYPE:-}" == "codex" ]] || [[ "${WORKER_CMD}" == *"codex"* ]]
}

# Codex configuration (set after sourcing adapter)
_codex_config() {
    if _is_codex_worker; then
        CODEX_MODE="${CODEX_MODE:-exec}"
        CODEX_SANDBOX="${CODEX_SANDBOX:-workspace-write}"
        CODEX_FULL_AUTO="${CODEX_FULL_AUTO:-true}"
        CODEX_JSON_OUTPUT="${CODEX_JSON_OUTPUT:-false}"
        CODEX_WORKDIR="${CODEX_WORKDIR:-/srv/monorepo}"
        CODEX_TIMEOUT="${CODEX_TIMEOUT:-1800}"
        export CODEX_MODE CODEX_SANDBOX CODEX_FULL_AUTO CODEX_JSON_OUTPUT CODEX_WORKDIR CODEX_TIMEOUT
        log_info "Codex CLI worker configured — mode=$CODEX_MODE sandbox=$CODEX_SANDBOX workdir=$CODEX_WORKDIR"
    fi
}

_codex_config

# Derive basename for pkill/health-check patterns
_WORKER_BASENAME="$(basename "$WORKER_CMD" 2>/dev/null || echo "$WORKER_CMD")"

# ─── Logging ─────────────────────────────────────────────────────────────────
# Levels: DEBUG(0) INFO(1) WARN(2) ERROR(3)

declare -A LOG_LEVELS=(
    [DEBUG]=0 [INFO]=1 [WARN]=2 [ERROR]=3
)

_log() {
    local level="$1"
    shift
    local msg="$*"
    local now
    now=$(date '+%Y-%m-%dT%H:%M:%S%z')
    local current_level="${LOG_LEVELS[$LOG_LEVEL]:-1}"
    local msg_level="${LOG_LEVELS[$level]:-1}"
    [[ $msg_level -lt $current_level ]] && return 0
    echo "[$now] [$level] $msg"
}

log_debug() { _log DEBUG "$@"; }
log_info()  { _log INFO  "$@"; }
log_warn()  { _log WARN  "$@"; }
log_error() { _log ERROR "$@"; }

# ─── Cleanup helpers ─────────────────────────────────────────────────────────
_cleanup_file() {
    local f="$1"
    [[ -f "$f" ]] && rm -f "$f"
}

_cleanup_context() {
    local task_id="$1"
    log_debug "Cleaning context for task: $task_id"
    _cleanup_file "$CONTEXT_DIR/${task_id}.ctx"
    _cleanup_file "$CONTEXT_DIR/${task_id}.env"
}

_terminate_pid() {
    local pid="$1"
    local name="$2"
    if kill -0 "$pid" 2>/dev/null; then
        log_info "Sending SIGTERM to $name (pid=$pid)"
        kill -TERM "$pid" 2>/dev/null || true
        local count=0
        while kill -0 "$pid" 2>/dev/null && [ $count -lt 10 ]; do
            sleep 0.5
            count=$((count + 1))
        done
        if kill -0 "$pid" 2>/dev/null; then
            log_warn "PID $pid still alive after SIGTERM, sending SIGKILL"
            kill -KILL "$pid" 2>/dev/null || true
        fi
    fi
}

# ─── Graceful shutdown ───────────────────────────────────────────────────────
_shutdown() {
    log_info "Shutdown signal received — stopping workers cleanly"
    for pid in "${!BG_PIDS[@]}"; do
        _terminate_pid "$pid" "worker-${BG_PIDS[$pid]}"
    done
    pkill -f "${_WORKER_BASENAME}.*worker" 2>/dev/null || true
    log_info "Shutdown complete"
}

trap _shutdown SIGTERM SIGINT SIGHUP

# ─── Run with timeout wrapper ────────────────────────────────────────────────
_run_with_timeout() {
    local timeout_secs="$1"
    local description="$2"
    shift 2
    local cmd=("$@")

    log_debug "Running [$description] with ${timeout_secs}s timeout: ${cmd[*]}"

    local status

    if command -v timeout &>/dev/null; then
        timeout --signal=TERM "$timeout_secs" "${cmd[@]}" 2>&1
        status=$?
    else
        local pid
        (
            "${cmd[@]}" 2>&1
            exit $?
        ) &
        pid=$!
        local elapsed=0
        while kill -0 "$pid" 2>/dev/null && [ $elapsed -lt "$timeout_secs" ]; do
            sleep 1
            elapsed=$((elapsed + 1))
        done
        if kill -0 "$pid" 2>/dev/null; then
            log_warn "[$description] timed out after ${timeout_secs}s — killing PID $pid"
            kill -TERM "$pid" 2>/dev/null || true
            wait "$pid" 2>/dev/null || true
            return 124
        fi
        wait "$pid"
        status=$?
    fi

    if [ $status -eq 124 ]; then
        log_error "[$description] timed out after ${timeout_secs}s"
    elif [ $status -ne 0 ]; then
        log_warn "[$description] exited with status $status"
    else
        log_debug "[$description] completed successfully"
    fi

    return $status
}

# ─── Retry with exponential backoff ─────────────────────────────────────────
_retry() {
    local max_attempts="${1:-${RETRY_MAX_ATTEMPTS}}"
    local base_delay="${2:-${RETRY_BASE_DELAY}}"
    local description="$3"
    shift 3
    local cmd=("$@")

    local attempt=1
    local delay="$base_delay"

    while [ $attempt -le $max_attempts ]; do
        log_debug "Retry $attempt/$max_attempts for [$description]"
        if "${cmd[@]}"; then
            [ $attempt -gt 1 ] && log_info "[$description] succeeded on attempt $attempt"
            return 0
        fi

        if [ $attempt -eq $max_attempts ]; then
            log_error "[$description] failed after $max_attempts attempts"
            return 1
        fi

        log_warn "[$description] failed (attempt $attempt/$max_attempts) — retrying in ${delay}s"
        sleep "$delay"
        delay=$((delay * 2 < RETRY_MAX_DELAY ? delay * 2 : RETRY_MAX_DELAY))
        attempt=$((attempt + 1))
    done

    return 1
}

# ─── Health check ────────────────────────────────────────────────────────────
_health_check() {
    log_info "Running health check..."

    local errors=0

    for script in "$SCRIPT_CONTEXT_RESET" "$SCRIPT_SMOKE_RUNNER" "$SCRIPT_NOTIFY_COMPLETE"; do
        if [ ! -f "$script" ]; then
            log_error "Required script not found: $script"
            errors=$((errors + 1))
        else
            log_debug "  [OK] $script exists"
        fi
    done

    for cmd in python3 jq; do
        if ! command -v "$cmd" &>/dev/null; then
            log_error "Required command not found: $cmd"
            errors=$((errors + 1))
        else
            log_debug "  [OK] $cmd available"
        fi
    done

    local worker_bin="${WORKER_CMD%% *}"
    if ! command -v "$worker_bin" &>/dev/null; then
        log_error "Required command not found: $WORKER_CMD (WORKER_CMD)"
        errors=$((errors + 1))
    else
        log_debug "  [OK] $worker_bin available"
    fi

    if [ ! -f "$WORKDIR/queue-manager.py" ]; then
        log_error "queue-manager.py not found: $WORKDIR/queue-manager.py"
        errors=$((errors + 1))
    else
        log_debug "  [OK] queue-manager.py exists"
    fi

    if [ ! -w "$WORKDIR" ]; then
        log_error "Workdir not writable: $WORKDIR"
        errors=$((errors + 1))
    fi

    if [ ! -w "$LOG_DIR" ]; then
        log_error "Log dir not writable: $LOG_DIR"
        errors=$((errors + 1))
    fi

    if [ $errors -gt 0 ]; then
        log_error "Health check failed with $errors error(s)"
        return 1
    fi

    log_info "Health check passed"
    return 0
}

# ─── Snapshot wrapper ────────────────────────────────────────────────────────
_do_snapshot() {
    log_debug "Creating ZFS snapshot..."
    _retry 3 2 "ZFS snapshot" sudo zfs snapshot "tank@vibe-pre-$(date +%Y%m%d-%H%M%S)" 2>/dev/null || {
        log_warn "ZFS snapshot failed (non-fatal)"
    }
}

# ─── Context isolation ───────────────────────────────────────────────────────
_isolate_context() {
    local task_id="$1"
    log_debug "Isolating context for task $task_id"
    _cleanup_context "$task_id"
    find "$LOG_DIR" -name "worker-*.log" -mmin +60 -delete 2>/dev/null || true
    return 0
}

# ─── Video recording on failure ──────────────────────────────────────────────
# Uses script(1) to record terminal sessions and ffmpeg to encode MP4.
# The recording is only produced when a task fails.

_record_session() {
    local task_id="$1"
    local recording_dir="$2"
    local typescript_file="${recording_dir}/session-${task_id}.typescript"
    local timing_file="${recording_dir}/session-${task_id}.timing"

    # Start script recording in background — captures full terminal session
    # -q: quiet (no startup/shutdown messages)
    # -a: append to file (overwrites if exists)
    # -t: output timing to stderr (we capture via fd 3)
    # The worker command is passed via -c
    mkdir -p "$recording_dir"
    echo "RECORDING_TYPESCRIPT=${typescript_file}"
    echo "RECORDING_TIMING=${timing_file}"
}

# Convert a completed typescript + timing recording to MP4 on failure.
# Produces both .cast (asciicast for asciinema replay) and .mp4.
_convert_recording_on_failure() {
    local task_id="$1"
    local typescript_file="$2"
    local timing_file="$3"
    local output_dir
    output_dir=$(dirname "$typescript_file")

    if [ ! -f "$timing_file" ] || [ ! -f "$typescript_file" ]; then
        log_warn "Recording files missing for $task_id — skipping video"
        return 1
    fi

    local timing_size script_size
    timing_size=$(stat -c%s "$timing_file" 2>/dev/null || echo 0)
    script_size=$(stat -c%s "$typescript_file" 2>/dev/null || echo 0)

    if [ "$timing_size" -lt 4 ] || [ "$script_size" -lt 4 ]; then
        log_warn "Recording files too small for $task_id — skipping video"
        return 1
    fi

    local mp4_file="${output_dir}/recording-${task_id}.mp4"
    local cast_file="${output_dir}/recording-${task_id}.cast"

    log_info "Converting recording for $task_id to video (typescript=${script_size}B)..."

    if [ -x "$SCRIPT_TYPESCRIPT_TO_VIDEO" ]; then
        python3 "$SCRIPT_TYPESCRIPT_TO_VIDEO" "$timing_file" "$typescript_file" "$mp4_file" >> "$LOG_DIR/recording-${task_id}.log" 2>&1 && {
            log_info "Video saved: $mp4_file"
        } || {
            log_warn "Video conversion failed for $task_id — check $LOG_DIR/recording-${task_id}.log"
        }
    else
        log_warn "typescript-to-video.py not found — recording available as typescript: $typescript_file"
    fi
    return 0
}

# ─── SIGCHLD handler ─────────────────────────────────────────────────────────
handle_sigchld() {
    local pid
    while IFS= read -r pid; do
        wait "$pid" 2>/dev/null || true
        if [ -f "$RUNNING_FILE" ]; then
            jq "map(select(.pid != $pid))" "$RUNNING_FILE" > "$RUNNING_FILE.tmp" 2>/dev/null && \
                mv "$RUNNING_FILE.tmp" "$RUNNING_FILE" || true
        fi
        for key in "${!BG_PIDS[@]}"; do
            if [ "${BG_PIDS[$key]}" = "$pid" ]; then
                unset BG_PIDS[$key]
                break
            fi
        done
    done < <(jobs -p 2>/dev/null || true)
}

# do_loop prunes worker state explicitly. Avoid a SIGCHLD wait loop here because
# it can deadlock the scheduler while workers are still writing logs.
trap - CHLD

_prune_running_file() {
    if [ ! -f "$RUNNING_FILE" ]; then
        return 0
    fi

    local tmp="${RUNNING_FILE}.tmp"
    : > "$tmp"

    local active_pids
    active_pids=" $(jobs -r -p 2>/dev/null | tr '\n' ' ') "

    while IFS= read -r entry; do
        local pid
        pid=$(echo "$entry" | jq -r ".pid // empty" 2>/dev/null || true)
        if [ -n "$pid" ] && [[ "$active_pids" == *" $pid "* ]]; then
            echo "$entry" >> "$tmp"
        fi
    done < <(jq -c ".[]?" "$RUNNING_FILE" 2>/dev/null || true)

    jq -s "." "$tmp" > "${tmp}.json" 2>/dev/null && mv "${tmp}.json" "$RUNNING_FILE"
    rm -f "$tmp" "${tmp}.json"
}

_remove_running_entry() {
    local task_id="$1"
    if [ ! -f "$RUNNING_FILE" ]; then
        return 0
    fi

    jq --arg task_id "$task_id" 'map(select(.task_id != $task_id))' "$RUNNING_FILE" > "${RUNNING_FILE}.tmp" 2>/dev/null && \
        mv "${RUNNING_FILE}.tmp" "$RUNNING_FILE" || rm -f "${RUNNING_FILE}.tmp"
}

_requeue_stale_running_tasks() {
    if [ ! -f "$QUEUE_FILE" ]; then
        return 0
    fi

    local active_ids_json="[]"
    if [ -f "$RUNNING_FILE" ]; then
        _prune_running_file
        active_ids_json=$(jq -c '[.[]?.task_id]' "$RUNNING_FILE" 2>/dev/null || echo "[]")
    fi

    jq --argjson active "$active_ids_json" '
        (.tasks |= map(
            if .status == "running" and ((.id as $id | $active | index($id)) | not)
            then .status = "pending" | .worker = null | .claimed_at = null
            else .
            end
        ))
        | .pending = ([.tasks[] | select(.status == "pending")] | length)
        | .running = ([.tasks[] | select(.status == "running")] | length)
        | .done = ([.tasks[] | select(.status == "done")] | length)
        | .failed = ([.tasks[] | select(.status == "failed")] | length)
        | .frozen = ([.tasks[] | select(.status == "frozen")] | length)
    ' "$QUEUE_FILE" > "${QUEUE_FILE}.tmp" && mv "${QUEUE_FILE}.tmp" "$QUEUE_FILE"
}

# ─── Lead: think + delegate ──────────────────────────────────────────────────
lead_think() {
    local spec_file="$1"
    local app_name="$2"

    log_info "Lead thinking on spec=$spec_file app=$app_name"

    local tasks
    tasks=$(python3 -c "
import re, json, sys

with open('$spec_file') as f:
    content = f.read()

tasks = []
for line in content.split('\n'):
    m = re.match(r'^\d+\. \[ \] (.+)', line)
    if m:
        desc = m.group(1).strip()
        name = re.sub(r'[^a-z0-9]+', '-', desc.lower())[:40]
        tasks.append({'id': 'T{:03d}'.format(len(tasks)+1), 'name': name, 'description': desc})

if not tasks:
    for line in content.split('\n'):
        m = re.match(r'^\- \[ \] AC-\d+: (.+)', line)
        if m:
            desc = m.group(1).strip()
            name = 'ac-' + re.sub(r'[^a-z0-9]+', '-', desc.lower())[:30]
            tasks.append({'id': 'T{:03d}'.format(len(tasks)+1), 'name': name, 'description': desc})

if not tasks:
    for line in content.split('\n'):
        m = re.match(r'^\- \[ \] (.+)', line)
        if m:
            desc = m.group(1).strip()
            name = re.sub(r'[^a-z0-9]+', '-', desc.lower())[:40]
            tasks.append({'id': 'T{:03d}'.format(len(tasks)+1), 'name': name, 'description': desc})

if not tasks:
    for line in content.split('\n'):
        m = re.search(r'\| B(\d+) \| ([^|]+) \|', line)
        if m:
            bug_id = m.group(1)
            desc = m.group(2).strip()
            name = 'bug-{}-{}'.format(bug_id, re.sub(r'[^a-z0-9]+', '-', desc.lower())[:30])
            tasks.append({'id': 'T{:03d}'.format(len(tasks)+1), 'name': name, 'description': 'Bug B{}: {}'.format(bug_id, desc)})

print(json.dumps(tasks))
" 2>/dev/null)

    if [ -z "$tasks" ] || [ "$tasks" = "null" ]; then
        log_error "Lead could not parse any tasks from SPEC"
        return 1
    fi

    local total
    total=$(echo "$tasks" | jq "length")
    log_info "Lead parsed $total tasks from spec"

    echo "$tasks" | jq --arg spec "$(basename "$spec_file" .md)" --arg app "$app_name" --argjson total "$total" "
        {
            spec: \$spec,
            app: \$app,
            total: \$total,
            pending: \$total,
            running: 0,
            done: 0,
            failed: 0,
            frozen: 0,
            phase: \"do\",
            parallel_limit: $MAX_WORKERS,
            tasks: [.[] | . + {
                app: \$app,
                spec: \$spec,
                status: \"pending\",
                attempts: 0,
                worker: null,
                created_at: now | todate,
                completed_at: null,
                error: null
            }]
        }
    " > "$QUEUE_FILE"

    log_info "Lead: queue created with $total tasks"
}

# ─── Do: spawn + monitor workers ────────────────────────────────────────────
do_loop() {
    local start_epoch
    start_epoch=$(date +%s)
    local tasks_since_snapshot=0

    log_info "Starting do_loop — max_workers=$MAX_WORKERS max_runtime=${MAX_HOURS}h"
    _requeue_stale_running_tasks

    while true; do
        local now_secs
        now_secs=$(date +%s)
        local elapsed=$((now_secs - start_epoch))

        if [ $elapsed -ge $MAX_RUNTIME_SECS ]; then
            log_error "Max runtime of ${MAX_HOURS}h exceeded — terminating loop"
            break
        fi

        _prune_running_file
        local running_count=0
        running_count=$(jobs -r -p 2>/dev/null | wc -l | tr -d ' ')

        local pending queue_total
        pending=$(jq ".pending" "$QUEUE_FILE" 2>/dev/null || echo 0)
        queue_total=$(jq ".total" "$QUEUE_FILE" 2>/dev/null || echo 0)

        log_debug "do_loop: pending=$pending running=$running_count elapsed=${elapsed}s"

        if [ "$pending" -eq 0 ] && [ "$running_count" -eq 0 ]; then
            log_info "Queue empty. Exiting do_loop."
            break
        fi

        while [ "$running_count" -lt "$MAX_WORKERS" ] && [ "$pending" -gt 0 ]; do
            local task_json
            task_json=$(QUEUE_FILE="$QUEUE_FILE" python3 "$WORKDIR/queue-manager.py" claim "W$$" 2>/dev/null)

            if [ -z "$task_json" ] || echo "$task_json" | jq -e ".error" > /dev/null 2>&1; then
                log_debug "No more claimable tasks or queue error"
                break
            fi

            local task_id task_name description app
            task_id=$(echo "$task_json" | jq -r ".id")
            task_name=$(echo "$task_json" | jq -r ".name")
            description=$(echo "$task_json" | jq -r ".description")
            app=$(echo "$task_json" | jq -r ".app")

            log_info "Task $task_id claimed: $task_name"

            _isolate_context "$task_id"

            log_debug "Resetting context for $task_id..."
            _retry 3 2 "context-reset-$task_id" bash "$SCRIPT_CONTEXT_RESET" "$task_id" 2>/dev/null || {
                log_warn "context-reset failed for $task_id (non-fatal)"
            }

            (
                local worker_result="done"
                local worker_log="$LOG_DIR/worker-$task_id.log"
                local typescript_file="$LOG_DIR/session-${task_id}.typescript"
                local timing_file="$LOG_DIR/session-${task_id}.timing"

                # Build Claude Code native worker command using _build_worker_cmd
                local worker_cmd
                if _is_opencode_worker; then
                    # OpenCode: different CLI syntax, uses OPENCODE_API_KEY env var
                    worker_cmd="$WORKER_CMD run --dangerously-skip-permissions --format json --dir /srv/monorepo --model ${MODEL:-minimax/MiniMax-M2.7}"
                elif _is_codex_worker; then
                    # Codex: codex exec with sandbox and auto-approval
                    # Key Codex flags:
                    #   -C, --cd <DIR>         Set working directory
                    #   -s, --sandbox <MODE>   sandbox: read-only|workspace-write|danger-full-access
                    #   --full-auto            Low-friction automatic execution
                    #   --dangerously-bypass-approvals-and-sandbox  Skip confirmations (dangerous!)
                    #   --json                 Print events as JSONL (streaming output)
                    #   -o, --output-last-message <FILE>  Write last message to file
                    #   --ephemeral            Don't persist session
                    #   --ignore-rules         Don't load .rules files
                    #   -m, --model <MODEL>    Specify model
                    # Rate limits: handled via CODEX_MODEL env var, max_threads in config.toml
                    local codex_args=()
                    codex_args+=(-C "${CODEX_WORKDIR:-/srv/monorepo}")
                    codex_args+=(--sandbox "${CODEX_SANDBOX:-workspace-write}")
                    [[ "${CODEX_FULL_AUTO:-true}" == "true" ]] && codex_args+=(--full-auto)
                    [[ "${CODEX_JSON_OUTPUT:-false}" == "true" ]] && codex_args+=(--json)
                    codex_args+=(--ephemeral)
                    codex_args+=(--ignore-rules)
                    codex_args+=(--output-last-message "$LOG_DIR/worker-$task_id.last.json")
                    [[ -n "${CODEX_MODEL:-}" ]] && codex_args+=(-m "$CODEX_MODEL")

                    # Build Codex exec command as string for proper quoting
                    worker_cmd="codex exec ${codex_args[*]}"
                else
                    # mclaude/claude: use _build_worker_cmd for native flags
                    worker_cmd="$(_build_worker_cmd "$PROVIDER" "$MODEL")"
                fi

                # ─── Terminal recording with script(1) ─────────────────────────────────
                # Always record when VIBE_RECORD is not "false"
                # Video (MP4) is produced only on failure via _convert_recording_on_failure
                local use_recording="${VIBE_RECORD:-true}"
                local worker_exit=0

                if [[ "$use_recording" != "false" ]] && command -v script &>/dev/null; then
                    # Remove stale recording files
                    rm -f "$typescript_file" "$timing_file"

                    # -q: quiet (no "Script started/finished" messages)
                    # -a: append to typescript file
                    # -c: command to run
                    # --log-timing: output timing to file
                    # Worker output goes to worker_log via bash redirect
                    script -q -a "$typescript_file" --log-timing "$timing_file" -c \
                        "$worker_cmd -p 'You are worker-$$.
APP: $app
TASK: $task_name
DESCRIPTION: $description

Working directory: /srv/monorepo

Execute completely. Output [COMPLETE] task_id=$task_id result=done when done.
If you cannot complete, output [COMPLETE] task_id=$task_id result=failed reason=...

Save your work context to: $CONTEXT_DIR/${task_id}.ctx'" \
                        >> "$worker_log" 2>&1 || worker_exit=$?
                else
                    # No recording — run directly
                    if ! _run_with_timeout "$TIMEOUT_MCLAUDE" "worker-$task_id" \
                        $worker_cmd -p "You are worker-$$.
APP: $app
TASK: $task_name
DESCRIPTION: $description

Working directory: /srv/monorepo

Execute completely. Output [COMPLETE] task_id=$task_id result=done when done.
If you cannot complete, output [COMPLETE] task_id=$task_id result=failed reason=...

Save your work context to: $CONTEXT_DIR/${task_id}.ctx" \
                        >> "$worker_log" 2>&1; then
                        worker_exit=$?
                    fi
                fi

                if [ $worker_exit -ne 0 ]; then
                    worker_result="failed"
                    log_warn "Task $task_id worker command failed with exit=$worker_exit"
                fi

                if grep -q "result=failed" "$worker_log" 2>/dev/null; then
                    worker_result="failed"
                    log_warn "Task $task_id worker reported failure"
                fi

                # ─── Produce video on failure ─────────────────────────────────────────
                if [[ "$worker_result" == "failed" ]] && [[ "$use_recording" != "false" ]]; then
                    log_info "Task $task_id failed — producing video recording..."
                    _convert_recording_on_failure "$task_id" "$typescript_file" "$timing_file" || true
                fi

                local smoke_exit=0
                local smoke_attempts=0
                local smoke_workdir="/srv/monorepo"
                if [ -n "$app" ] && [ -d "/srv/monorepo/$app" ]; then
                    smoke_workdir="/srv/monorepo/$app"
                fi
                while [ $smoke_attempts -lt $SMOKE_MAX_RETRIES ]; do
                    if _run_with_timeout 300 "smoke-$task_id" env WORKDIR="$smoke_workdir" bash "$SCRIPT_SMOKE_RUNNER" 2>&1; then
                        break
                    else
                        smoke_exit=$?
                        smoke_attempts=$((smoke_attempts + 1))
                        log_warn "Smoke attempt $smoke_attempts/$SMOKE_MAX_RETRIES failed for $task_id"
                        [ $smoke_attempts -lt $SMOKE_MAX_RETRIES ] && sleep $((2 ** smoke_attempts))
                    fi
                done

                if [ $smoke_exit -ne 0 ]; then
                    log_error "Smoke FAILED after $SMOKE_MAX_RETRIES retries for $task_id"
                    worker_result="failed"
                fi

                QUEUE_FILE="$QUEUE_FILE" python3 "$WORKDIR/queue-manager.py" complete "$task_id" "W$$" "$worker_result" 2>/dev/null || {
                    log_error "Failed to mark task $task_id complete in queue"
                }

                _remove_running_entry "$task_id"
                _cleanup_context "$task_id"

            ) &
            local worker_pid=$!
            BG_PIDS[$worker_pid]="$task_id"

            local worker_entry
            worker_entry=$(jq -n --argjson pid $worker_pid --arg id "$task_id" "{pid: \$pid, task_id: \$id}")
            if [ -f "$RUNNING_FILE" ]; then
                jq ". + [$worker_entry]" "$RUNNING_FILE" > "$RUNNING_FILE.tmp" && mv "$RUNNING_FILE.tmp" "$RUNNING_FILE"
            else
                echo "[$worker_entry]" > "$RUNNING_FILE"
            fi

            running_count=$((running_count + 1))
            pending=$((pending - 1))

            log_info "Spawned worker for $task_id (pid=$worker_pid, running: $running_count)"
        done

        tasks_since_snapshot=$((tasks_since_snapshot + 1))
        if [ "$SNAPSHOT_EVERY" -gt 0 ] && [ $tasks_since_snapshot -ge $SNAPSHOT_EVERY ]; then
            _do_snapshot
            tasks_since_snapshot=0
        fi

        sleep $POLL_INTERVAL
    done

    log_info "do_loop finished"
}

# ─── Verify ──────────────────────────────────────────────────────────────────
do_verify() {
    log_info "Starting verify phase"

    local failed=0

    for cmd_str in "pnpm test" "pnpm tsc --noEmit" "pnpm lint"; do
        local cmd_name
        cmd_name=$(echo "$cmd_str" | awk '{print $1}')
        log_info "Verifying: $cmd_str"

        if _run_with_timeout 300 "verify-$cmd_name" bash -c "$cmd_str" > /dev/null 2>&1; then
            log_info "  PASSED: $cmd_str"
        else
            log_error "  FAILED: $cmd_str"
            failed=$((failed + 1))
        fi
    done

    if [ $failed -gt 0 ]; then
        log_error "VERIFY FAILED: $failed command(s) failed"
        return 1
    fi
    log_info "VERIFY PASSED"
    return 0
}

# ─── Max runtime watchdog ────────────────────────────────────────────────────
_watchdog() {
    local start_epoch="$1"
    while true; do
        sleep 60
        local now_secs
        now_secs=$(date +%s)
        local elapsed=$((now_secs - start_epoch))
        if [ $elapsed -ge $MAX_RUNTIME_SECS ]; then
            log_error "WATCHDOG: max runtime of ${MAX_HOURS}h exceeded — initiating shutdown"
            kill -TERM $$ 2>/dev/null
            break
        fi
    done
}

# ─── Main ────────────────────────────────────────────────────────────────────
main() {
    local spec="${1:-}"
    local app="${2:-}"
    local phase="${VIBE_PHASE:-}"
    local overall_exit=0

    log_info "run-vibe.sh started — spec=$spec app=$app phase=$phase"

    mkdir -p "$LOG_DIR" "$CONTEXT_DIR"

    _health_check || {
        log_error "Health check failed — aborting"
        exit 1
    }

    # CLAUDE.md is mandatory
    if [[ ! -f "$WORKDIR/CLAUDE.md" ]]; then
        log_error "CLAUDE.md not found at $WORKDIR/CLAUDE.md — required for vibe-kit execution"
        exit 1
    fi

    if [ -z "$spec" ]; then
        echo "Usage: run-vibe.sh <SPEC> [app] [--plan|--do|--verify]"
        echo "  Or set SPEC=... APP=... VIBE_PHASE=..."
        exit 1
    fi

    local spec_file="/srv/monorepo/docs/SPECS/${spec}.md"
    if [ ! -f "$spec_file" ]; then
        log_error "SPEC not found: $spec_file"
        exit 1
    fi

    local start_epoch
    start_epoch=$(date +%s)
    _watchdog "$start_epoch" &
    local watchdog_pid=$!
    BG_PIDS[$watchdog_pid]="watchdog"
    disown $watchdog_pid 2>/dev/null || true

    case "$phase" in
        plan)
            lead_think "$spec_file" "$app" || overall_exit=1
            ;;
        do)
            do_loop || overall_exit=1
            ;;
        verify)
            do_verify || overall_exit=1
            ;;
        *)
            lead_think "$spec_file" "$app" || overall_exit=1
            do_loop || overall_exit=1
            do_verify || overall_exit=1
            ;;
    esac

    local done_count failed_count
    done_count=$(jq ".done" "$QUEUE_FILE" 2>/dev/null || echo 0)
    failed_count=$(jq ".failed" "$QUEUE_FILE" 2>/dev/null || echo 0)

    log_info "Pipeline done — done=$done_count failed=$failed_count exit=$overall_exit"

    _terminate_pid $watchdog_pid "watchdog" 2>/dev/null || true

    if [ "${VIBE_SKIP_GIT_COMMIT:-false}" = "true" ]; then
        log_info "Skipping automatic git commit because VIBE_SKIP_GIT_COMMIT=true"
    elif [ "$done_count" -gt 0 ] && [ "$failed_count" -le 5 ]; then
        log_info "Creating vibe branch and committing"
        _run_with_timeout "$TIMEOUT_GIT" "git-checkout" git checkout -b "vibe-$(date +%Y%m%d-%H%M%S)" 2>/dev/null || true
        _run_with_timeout "$TIMEOUT_GIT" "git-add" git add -A 2>/dev/null || true
        _run_with_timeout "$TIMEOUT_GIT" "git-commit" git commit -m "vibe: $spec completed ($done_count done, $failed_count failed)" 2>/dev/null || true
    fi

    log_info "Sending completion notification"
    _retry 3 5 "notify-complete" bash "$SCRIPT_NOTIFY_COMPLETE" "$overall_exit" "$done_count" "$failed_count" 2>/dev/null || {
        log_warn "notify-complete failed (non-fatal)"
    }

    log_info "run-vibe.sh exiting with code $overall_exit"
    exit $overall_exit
}

main "$@"
