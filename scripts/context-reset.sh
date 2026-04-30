#!/bin/bash
# context-reset.sh — Reset LLM context per task (GCC-inspired)
# Hardened version with CLI-specific patterns, configurable timeouts, and enhanced logging
set -euo pipefail

# ─── Defaults & Constants ───────────────────────────────────────────────────
readonly SCRIPT_NAME="$(basename "$0")"
readonly SCRIPT_VERSION="3.0.0"
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Workdir & paths
WORKDIR="${WORKDIR:-/srv/monorepo/.claude/vibe-kit}"
CONTEXT_DIR="$WORKDIR/context"
QUEUE_FILE="$WORKDIR/queue.json"

# ─── Configurable timeouts ──────────────────────────────────────────────────
# Per-CLI timeout overrides (seconds)
: "${CLAUDE_TIMEOUT:=600}"
: "${OPENCODE_TIMEOUT:=300}"
: "${CODEX_TIMEOUT:=300}"
: "${CURSOR_TIMEOUT:=600}"
: "${MCLAUDE_TIMEOUT:=300}"
: "${DEFAULT_TIMEOUT:=300}"

# ─── Logging ────────────────────────────────────────────────────────────────
_LOG_LEVEL="${LOG_LEVEL:-INFO}"
_LOG_FILE="${LOG_FILE:-}"
_LOG_TO_STDOUT="${LOG_TO_STDOUT:-0}"

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
    local output="${color:-}${timestamp} [${level}] ${msg}${color:+\033[0m}"
    printf '%s\n' "$output" >&2
    if [[ -n "$_LOG_FILE" ]]; then
        printf '%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ) [${level}] ${msg}" >> "$_LOG_FILE"
    fi
}

log_error()  { _log ERROR "$@"; }
log_warn()   { _log WARN  "$@"; }
log_info()   { _log INFO  "$@"; }
log_debug()  { [[ "${DEBUG:-0}" == "1" ]] && _log DEBUG "$@" || true; }

# ─── CLI Detection ──────────────────────────────────────────────────────────
_detect_cli() {
    # Source multi-cli-adapter for CLI detection
    if [[ -f "${SCRIPT_DIR}/multi-cli-adapter.sh" ]]; then
        # shellcheck source=/dev/null
        source "${SCRIPT_DIR}/multi-cli-adapter.sh"
    elif [[ -f "${SCRIPT_DIR}/cli-detector.sh" ]]; then
        CLI_TYPE="$(bash "${SCRIPT_DIR}/cli-detector.sh" 2>/dev/null)" || CLI_TYPE="unknown"
    else
        CLI_TYPE="${CLI_TYPE:-unknown}"
    fi

    case "${CLI_TYPE:-unknown}" in
        claude|codex|opencode|cursor|zed|mclaude) ;;
        *) CLI_TYPE="${CLI_TYPE:-unknown}" ;;
    esac

    export CLI_TYPE
    log_debug "Detected CLI type: ${CLI_TYPE}"
}

_get_cli_timeout() {
    local cli="${CLI_TYPE:-unknown}"
    local timeout_var="${cli^^}_TIMEOUT"
    local timeout="${!timeout_var:-}"
    if [[ -z "$timeout" ]]; then
        timeout="${DEFAULT_TIMEOUT}"
    fi
    printf '%s' "$timeout"
}

_get_cli_api_key() {
    local cli="${CLI_TYPE:-unknown}"
    case "$cli" in
        claude)
            [[ -n "${ANTHROPIC_API_KEY:-}" ]] && echo "$ANTHROPIC_API_KEY" && return 0
            [[ -n "${CLAUDE_API_KEY:-}" ]] && echo "$CLAUDE_API_KEY" && return 0
            return 1
            ;;
        opencode)
            [[ -n "${OPENCODE_API_KEY:-}" ]] && echo "$OPENCODE_API_KEY" && return 0
            [[ -n "${OPENAI_API_KEY:-}" ]] && echo "$OPENAI_API_KEY" && return 0
            return 1
            ;;
        codex)
            [[ -n "${OPENAI_API_KEY:-}" ]] && echo "$OPENAI_API_KEY" && return 0
            return 1
            ;;
        cursor)
            [[ -n "${CURSOR_API_KEY:-}" ]] && echo "$CURSOR_API_KEY" && return 0
            [[ -n "${OPENAI_API_KEY:-}" ]] && echo "$OPENAI_API_KEY" && return 0
            return 1
            ;;
        mclaude)
            # mclaude uses provider-specific API keys
            [[ -n "${MINIMAX_API_KEY:-}" ]] && echo "$MINIMAX_API_KEY" && return 0
            [[ -n "${OPENAI_API_KEY:-}" ]] && echo "$OPENAI_API_KEY" && return 0
            return 1
            ;;
        *)
            return 1
            ;;
    esac
}

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
    if [[ ${#task_id} -lt 1 ]]; then
        log_error "Task ID must be at least 1 character(s)"
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

# ─── CLI-specific context setup ─────────────────────────────────────────────
_write_cli_context() {
    local task_context="$1"
    local cli_type="${CLI_TYPE:-unknown}"

    log_debug "Writing CLI-specific context for: $cli_type"

    case "$cli_type" in
        claude)
            # Claude Code specific flags
            cat > "$task_context/.clauderc" <<EOF
{
  "cli": "claude",
  "skip_permissions": true,
  "allowed_tools": ["Bash", "Read", "Edit", "Write", "Search", "TaskCreate", "TaskUpdate", "TaskList"],
  "max_iterations": ${CLAUDE_MAX_ITERATIONS:-50}
}
EOF
            ;;
        opencode)
            # OpenCode specific config
            cat > "$task_context/.opencode.json" <<EOF
{
  "cli": "opencode",
  "format": "json",
  "skip_permissions": true
}
EOF
            ;;
        codex)
            # Codex specific config
            cat > "$task_context/.codexrc" <<EOF
{
  "cli": "codex",
  "project": "${WORKSPACE_ROOT:-/srv/monorepo}"
}
EOF
            ;;
        mclaude)
            # mclaude provider config
            local provider="${MCLAUDE_PROVIDER:-openrouter}"
            local model="${MCLAUDE_MODEL:-anthropic/claude-3-5-sonnet-20241022}"
            cat > "$task_context/.mcluderc" <<EOF
{
  "cli": "mclaude",
  "provider": "$provider",
  "model": "$model"
}
EOF
            ;;
    esac
}

# ─── Main Logic ─────────────────────────────────────────────────────────────
main() {
    local task_id="${1:-}"

    # Detect CLI first for timeout and API key configuration
    _detect_cli

    local cli_timeout
    cli_timeout="$(_get_cli_timeout)"
    log_info "context-reset.sh v$SCRIPT_VERSION starting (CLI: ${CLI_TYPE}, timeout: ${cli_timeout}s)"

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

    # Write CLI-specific configuration files
    _write_cli_context "$task_context"

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
    local task_name task_desc app spec cli_api_key
    task_name=$(echo "$task_json" | jq -r '.name // "unnamed"' 2>/dev/null || echo "unnamed")
    task_desc=$(echo "$task_json" | jq -r '.description // ""' 2>/dev/null || echo "")
    app=$(echo "$task_json" | jq -r '.app // ""' 2>/dev/null || echo "")
    spec=$(echo "$task_json" | jq -r '.spec // ""' 2>/dev/null || echo "")

    # Get CLI-specific API key for this context
    if cli_api_key="$(_get_cli_api_key 2>/dev/null)"; then
        log_info "Task loaded: $task_name (app=$app, cli=$CLI_TYPE)"
        log_debug "API key configured for CLI type: $CLI_TYPE"
    else
        log_warn "No API key configured for CLI type: $CLI_TYPE"
        cli_api_key=""
    fi

    # Write task prompt with timeout protection
    log_info "Writing prompt.md..."
    local prompt_content
    prompt_content=$(cat <<TEMPLATE
# Task: $task_id — $task_name

**APP:** $app
**SPEC:** $spec
**DESCRIPTION:** $task_desc
**CLI_TYPE:** ${CLI_TYPE}
**TIMEOUT:** ${cli_timeout}s

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
CLI: ${CLI_TYPE}
Timeout: ${cli_timeout}s
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

    # Write metadata file with CLI context
    log_debug "Writing .context-meta.json..."
    cat > "$task_context/.context-meta.json" <<EOF
{
  "task_id": "$task_id",
  "cli_type": "${CLI_TYPE}",
  "timeout": ${cli_timeout},
  "created_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "api_key_configured": $([ -n "$cli_api_key" ] && echo "true" || echo "false")
}
EOF

    log_info "Context reset complete: $task_id → $task_context"
    echo "SUCCESS: $task_id → $task_context"
    exit 0
}

main "$@"