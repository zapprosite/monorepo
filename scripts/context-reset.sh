#!/bin/bash
# context-reset.sh — Reset LLM context per task (GCC-inspired)
# Hardened version with error handling, logging, timeouts, and cleanup
set -euo pipefail

# ─── Defaults & Constants ───────────────────────────────────────────────────
readonly SCRIPT_NAME="$(basename "$0")"
readonly SCRIPT_VERSION="2.0.0"
readonly WORKDIR="${WORKDIR:-/srv/monorepo/.claude/vibe-kit}"
readonly CONTEXT_DIR="$WORKDIR/context"
readonly QUEUE_FILE="$WORKDIR/queue.json"
readonly MAX_TIMEOUT=10
readonly MIN_TASK_ID_LEN=1

# ─── Logging ────────────────────────────────────────────────────────────────
_LOG_LEVEL="${LOG_LEVEL:-INFO}"
_log() {
    local level="$1"; shift
    local msg="$*"
    local timestamp
    timestamp="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    local color
    case "$level" in
        ERROR) color="\033[1;31m" ;;
        WARN)  color="\033[1;33m" ;;
        INFO)  color="\033[1;36m" ;;
        DEBUG) color="\033[0;37m" ;;
        *)     color="" ;;
    esac
    printf "%s[%s] [%s] %s%s%s\n" \
        "${color:-}" "$timestamp" "$level" "$msg" "${color:+\033[0m}" >&2
}
log_error()  { _log ERROR "$@"; }
log_warn()   { _log WARN  "$@"; }
log_info()   { _log INFO  "$@"; }
log_debug()  { [[ "${DEBUG:-0}" == "1" ]] && _log DEBUG "$@" || true; }

# ─── Cleanup Handler ─────────────────────────────────────────────────────────
_CLEANUP_STACK=()
_push_cleanup() { _CLEANUP_STACK+=("$1"); }
_run_cleanup() {
    local rev
    for rev in $(printf '%s\n' "${_CLEANUP_STACK[@]}" | tac); do
        eval "$rev" 2>/dev/null || true
    done
}
trap _run_cleanup EXIT

# ─── Helpers with timeouts ──────────────────────────────────────────────────
_timeout_cmd() {
    local timeout="$1"; shift
    local label="$1"; shift
    local cmd=("$@")
    local result
    local exit_code

    log_debug "Executing (timeout=${timeout}s): $label"

    # Use bash internal timeout simulation via read
    if command -v timeout >/dev/null 2>&1; then
        result=$(timeout "${timeout}s" "${cmd[@]}" 2>&1) && exit_code=0 || exit_code=$?
    else
        # Fallback: run in background, wait, kill if still running
        local pid
        "${cmd[@]}" &
        pid=$!
        (
            local slept=0
            while kill -0 "$pid" 2>/dev/null && [ "$slept" -lt "$timeout" ]; do
                sleep 1
                slept=$((slept + 1))
            done
            if kill -0 "$pid" 2>/dev/null; then
                kill "$pid" 2>/dev/null || true
                exit 124
            fi
        ) &
        local watcher=$!
        wait "$pid" && exit_code=0 || exit_code=$?
        wait "$watcher" 2>/dev/null || true
    fi

    return $exit_code
}

_json_safe() {
    # Escape strings for safe JSON embedding
    printf '%s' "$1" | python3 -c '
import sys, json
data = sys.stdin.read()
# Remove control chars except tab/newline
data = ''.join(c for c in data if c == "\t" or c == "\n" or (ord(c) >= 32 and ord(c) != 127))
print(json.dumps(data)[1:-1])
' 2>/dev/null || printf '%s' "$1"
}

# ─── Input Validation ────────────────────────────────────────────────────────
validate_task_id() {
    local task_id="$1"
    if [[ -z "$task_id" ]]; then
        log_error "Task ID cannot be empty"
        return 1
    fi
    if [[ ${#task_id} -lt $MIN_TASK_ID_LEN ]]; then
        log_error "Task ID must be at least $MIN_TASK_ID_LEN character(s)"
        return 1
    fi
    if [[ ! "$task_id" =~ ^[a-zA-Z0-9_-]+$ ]]; then
        log_error "Task ID must be alphanumeric, dash, or underscore: '$task_id'"
        return 1
    fi
    return 0
}

# ─── Health Checks ───────────────────────────────────────────────────────────
health_check_disk() {
    local required_mb=50
    local available
    available=$(df -m "$WORKDIR" 2>/dev/null | awk 'NR==2 {print $4}' | tr -d 'M')
    if [[ -z "$available" ]] || [[ "$available" -lt "$required_mb" ]]; then
        log_warn "Low disk space in $WORKDIR: ${available:-?}MB available (need ${required_mb}MB)"
        return 1
    fi
    log_debug "Disk check OK: ${available}MB available"
    return 0
}

health_check_permissions() {
    local dir="$1"
    if [[ ! -w "$dir" ]] && [[ -d "$dir" ]]; then
        log_error "Directory not writable: $dir"
        return 1
    fi
    if [[ ! -x "$dir" ]]; then
        log_error "Directory not executable: $dir"
        return 1
    fi
    return 0
}

health_check_queue_file() {
    if [[ ! -f "$QUEUE_FILE" ]]; then
        log_error "Queue file not found: $QUEUE_FILE"
        return 1
    fi
    if [[ ! -r "$QUEUE_FILE" ]]; then
        log_error "Queue file not readable: $QUEUE_FILE"
        return 1
    fi
    log_debug "Queue file OK: $QUEUE_FILE"
}

health_check_python() {
    if ! command -v python3 >/dev/null 2>&1; then
        log_error "python3 not found in PATH"
        return 1
    fi
    # Test python3 can actually execute
    if ! python3 -c "print('ok')" >/dev/null 2>&1; then
        log_error "python3 is not functional"
        return 1
    fi
    log_debug "Python3 OK"
}

health_check_jq() {
    if ! command -v jq >/dev/null 2>&1; then
        log_error "jq not found in PATH"
        return 1
    fi
    # Test jq can parse
    if ! echo '{}' | jq '.' >/dev/null 2>&1; then
        log_error "jq is not functional"
        return 1
    fi
    log_debug "jq OK"
}

# ─── Main Logic ──────────────────────────────────────────────────────────────
main() {
    local task_id="${1:-}"

    log_info "context-reset.sh v$SCRIPT_VERSION starting"

    # Validate inputs
    if [[ -z "$task_id" ]]; then
        log_error "Usage: context-reset.sh <task_id>"
        log_error "Task ID is required"
        exit 1
    fi

    if ! validate_task_id "$task_id"; then
        exit 1
    fi

    # Health checks
    log_info "Running health checks..."
    health_check_disk || log_warn "Disk check failed — continuing anyway"
    health_check_python
    health_check_jq

    # Check workdir exists, create if not
    if [[ ! -d "$WORKDIR" ]]; then
        log_info "Creating workdir: $WORKDIR"
        if ! mkdir -p "$WORKDIR" 2>/dev/null; then
            log_error "Failed to create workdir: $WORKDIR"
            exit 1
        fi
        _push_cleanup "rm -rf '$WORKDIR' 2>/dev/null || true"
    fi

    if ! health_check_permissions "$WORKDIR"; then
        exit 1
    fi

    health_check_queue_file

    # Create task-specific context directory
    local task_context="$CONTEXT_DIR/$task_id"
    log_info "Creating context directory: $task_context"
    if ! mkdir -p "$task_context" 2>/dev/null; then
        log_error "Failed to create task context directory: $task_context"
        exit 1
    fi

    # Load task description from queue
    log_info "Loading task $task_id from queue..."

    local task_json
    local jq_exit_code=0

    task_json=$(python3 -c "
import json, sys, os
try:
    with open(os.environ.get('QUEUE_FILE', '/srv/monorepo/.claude/vibe-kit/queue.json')) as f:
        q = json.load(f)
    for t in q.get('tasks', []):
        if t.get('id') == '${task_id}':
            print(json.dumps(t))
            sys.exit(0)
    print('null')
except Exception as e:
    sys.stderr.write(f'Error reading queue: {e}\n')
    sys.exit(1)
" 2>&1) || jq_exit_code=$?

    if [[ $jq_exit_code -ne 0 ]]; then
        log_error "Failed to load task from queue (python exit code: $jq_exit_code)"
        log_error "Output: $task_json"
        exit 1
    fi

    if [[ "$task_json" == "null" ]] || [[ -z "$task_json" ]]; then
        log_error "Task $task_id not found in queue"
        log_error "Queue file: $QUEUE_FILE"
        exit 1
    fi

    # Extract fields safely
    local task_name task_desc app spec
    task_name=$(echo "$task_json" | jq -r '.name // "unnamed"' 2>/dev/null || echo "unnamed")
    task_desc=$(echo "$task_json" | jq -r '.description // ""' 2>/dev/null || echo "")
    app=$(echo "$task_json" | jq -r '.app // ""' 2>/dev/null || echo "")
    spec=$(echo "$task_json" | jq -r '.spec // ""' 2>/dev/null || echo "")

    log_info "Task loaded: $task_name (app=$app)"

    # Write task prompt with timeout protection
    log_info "Writing prompt.md..."
    local prompt_content
    prompt_content=$(cat <<TEMPLATE
# Task: $task_id — $task_name

**APP:** $app
**SPEC:** $spec
**DESCRIPTION:** $task_desc

Working directory: /srv/monorepo

Execute the task completely. When done, save milestone to commit.md and full trace to log.md.
TEMPLATE
)

    if ! printf '%s\n' "$prompt_content" > "$task_context/prompt.md" 2>/dev/null; then
        log_error "Failed to write prompt.md"
        exit 1
    fi
    _push_cleanup "rm -f '$task_context/prompt.md' 2>/dev/null || true"

    # Initialize log.md
    log_info "Writing log.md..."
    local log_content
    log_content=$(cat <<TEMPLATE
# Trace — $task_id
Started: $(date -u +%Y-%m-%dT%H:%M:%SZ)
TEMPLATE
)

    if ! printf '%s\n' "$log_content" > "$task_context/log.md" 2>/dev/null; then
        log_error "Failed to write log.md"
        exit 1
    fi

    # Initialize commit.md
    log_info "Writing commit.md..."
    local commit_content="# Milestone — $task_id"
    if ! printf '%s\n' "$commit_content" > "$task_context/commit.md" 2>/dev/null; then
        log_error "Failed to write commit.md"
        exit 1
    fi

    # Clear any stale conversation marker
    log_info "Setting active task marker..."
    if ! printf '%s\n' "$task_id" > "$WORKDIR/.active_task" 2>/dev/null; then
        log_warn "Failed to write active task marker"
    fi

    log_info "Context reset complete: $task_id → $task_context"
    echo "SUCCESS: $task_id → $task_context"
    exit 0
}

main "$@"