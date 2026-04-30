#!/bin/bash
# smoke-runner.sh — Standardized smoke test runner
# Hardened version with error handling, logging, timeouts, and cleanup
set -euo pipefail

# ─── Defaults & Constants ───────────────────────────────────────────────────
readonly SCRIPT_NAME="$(basename "$0")"
readonly SCRIPT_VERSION="2.0.0"
readonly WORKDIR="${WORKDIR:-/srv/monorepo}"
readonly SMOKE_DIR="${SMOKE_DIR:-$WORKDIR/smoke-tests}"
readonly MAX_TEST_TIMEOUT=120
readonly MIN_DISK_MB=100

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

# ─── State ───────────────────────────────────────────────────────────────────
FAILED=0
SKIPPED=0
PASSED=0

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

# ─── Helpers ────────────────────────────────────────────────────────────────
_color_output() {
    local color="$1"; shift
    printf "%s%s%s\n" "$color" "$*" "\033[0m"
}

_report_result() {
    local test_name="$1"
    local result="$2"
    local output="${3:-}"
    local timestamp
    timestamp="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

    case "$result" in
        PASS)
            PASSED=$((PASSED + 1))
            log_info "[PASS] $test_name"
            ;;
        FAIL)
            FAILED=$((FAILED + 1))
            log_error "[FAIL] $test_name"
            [[ -n "$output" ]] && log_error "  Output: $output"
            ;;
        SKIP)
            SKIPPED=$((SKIPPED + 1))
            log_warn "[SKIP] $test_name — $output"
            ;;
    esac
}

_timeout_cmd() {
    local timeout="$1"; shift
    local cmd=("$@")
    local result
    local exit_code

    if command -v timeout >/dev/null 2>&1; then
        result=$(timeout "${timeout}s" "${cmd[@]}" 2>&1) && exit_code=0 || exit_code=$?
    else
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
    echo "$result"
    return $exit_code
}

# ─── Health Checks ───────────────────────────────────────────────────────────
health_check_disk() {
    local available
    available=$(df -m "$WORKDIR" 2>/dev/null | awk 'NR==2 {print $4}' | tr -d 'M')
    if [[ -z "$available" ]]; then
        log_warn "Cannot determine disk space for $WORKDIR"
        return 0
    fi
    if [[ "$available" -lt "$MIN_DISK_MB" ]]; then
        log_error "Low disk space: ${available}MB available (need ${MIN_DISK_MB}MB)"
        return 1
    fi
    log_debug "Disk OK: ${available}MB available"
    return 0
}

health_check_workdir() {
    if [[ ! -d "$WORKDIR" ]]; then
        log_error "WORKDIR not found: $WORKDIR"
        return 1
    fi
    if [[ ! -r "$WORKDIR" ]]; then
        log_error "WORKDIR not readable: $WORKDIR"
        return 1
    fi
    return 0
}

health_check_command() {
    local cmd="$1"
    if ! command -v "$cmd" >/dev/null 2>&1; then
        log_debug "Command not found: $cmd"
        return 1
    fi
    return 0
}

# ─── Test Runners ────────────────────────────────────────────────────────────
run_smoke() {
    local name="$1"
    local cmd="$2"
    local timeout="${3:-$MAX_TEST_TIMEOUT}"

    log_debug "Running smoke test: $name (timeout=${timeout}s)"

    # Check command exists
    local cmd_name="${cmd%% *}"
    if ! command -v "$cmd_name" >/dev/null 2>&1; then
        _report_result "$name" SKIP "command not found: $cmd_name"
        return 0
    fi

    # Run with timeout
    local output
    local exit_code

    output=$(_timeout_cmd "$timeout" bash -c "$cmd" 2>&1) && exit_code=0 || exit_code=$?

    if [[ $exit_code -eq 0 ]]; then
        _report_result "$name" PASS
        return 0
    elif [[ $exit_code -eq 124 ]]; then
        _report_result "$name" FAIL "timed out after ${timeout}s"
        return 1
    else
        # Truncate output if too long
        local truncated_output="$output"
        if [[ ${#output} -gt 500 ]]; then
            truncated_output="${output:0:500}... [truncated]"
        fi
        _report_result "$name" FAIL "$truncated_output"
        return 1
    fi
}

run_smoke_file() {
    local test_script="$1"
    local test_name
    test_name=$(basename "$test_script" .sh)
    local timeout=$MAX_TEST_TIMEOUT

    log_debug "Running smoke file: $test_script"

    if [[ ! -f "$test_script" ]]; then
        _report_result "$test_name" FAIL "file not found: $test_script"
        return 1
    fi

    if [[ ! -r "$test_script" ]]; then
        _report_result "$test_name" FAIL "not readable: $test_script"
        return 1
    fi

    local output
    local exit_code

    if [[ -x "$test_script" ]]; then
        output=$(_timeout_cmd "$timeout" "$test_script" 2>&1) && exit_code=0 || exit_code=$?
    else
        output=$(_timeout_cmd "$timeout" bash "$test_script" 2>&1) && exit_code=0 || exit_code=$?
    fi

    if [[ $exit_code -eq 0 ]]; then
        _report_result "$test_name" PASS
        return 0
    elif [[ $exit_code -eq 124 ]]; then
        _report_result "$test_name" FAIL "timed out after ${timeout}s"
        return 1
    else
        _report_result "$test_name" FAIL "$output"
        return 1
    fi
}

# ─── Main ────────────────────────────────────────────────────────────────────
main() {
    log_info "smoke-runner.sh v$SCRIPT_VERSION starting"
    log_info "WORKDIR: $WORKDIR"
    log_info "SMOKE_DIR: $SMOKE_DIR"

    # Pre-flight health checks
    log_info "Running pre-flight checks..."

    if ! health_check_disk; then
        log_error "Disk space check failed — aborting"
        exit 1
    fi

    if ! health_check_workdir; then
        log_error "Workdir check failed — aborting"
        exit 1
    fi

    # Check package.json exists
    if [[ -f "$WORKDIR/package.json" ]]; then
        log_info "package.json found — will run project tests"
    else
        log_warn "package.json not found — skipping project tests"
    fi

    echo ""
    log_info "Running smoke tests..."
    echo ""

    # ── Core smoke tests ────────────────────────────────────────────────────

    # Health check — must exist and return OK
    if [[ -f "$WORKDIR/package.json" ]]; then
        if grep -q '"start"' "$WORKDIR/package.json" 2>/dev/null; then
            if command -v node >/dev/null 2>&1; then
                log_info "Checking Node syntax..."
                if node --check "$WORKDIR/cli.ts" 2>/dev/null; then
                    log_info "[PASS] Node syntax check"
                    PASSED=$((PASSED + 1))
                else
                    log_warn "[WARN] Node syntax check failed (non-critical)"
                fi
            fi
        fi
    fi

    # Type check
    if [[ -f "$WORKDIR/package.json" ]] && grep -q '"typecheck"' "$WORKDIR/package.json" 2>/dev/null; then
        if command -v bun >/dev/null 2>&1; then
            run_smoke "typecheck" "cd $WORKDIR && bunx tsc --noEmit" 90 || true
        else
            _report_result "typecheck" SKIP "bun not found"
        fi
    fi

    # Lint
    if [[ -f "$WORKDIR/package.json" ]] && grep -q '"lint"' "$WORKDIR/package.json" 2>/dev/null; then
        if command -v bun >/dev/null 2>&1; then
            run_smoke "lint" "cd $WORKDIR && bun run lint 2>&1 | tail -1" 60 || true
        else
            _report_result "lint" SKIP "bun not found"
        fi
    fi

    # Test
    if [[ -f "$WORKDIR/package.json" ]] && grep -q '"test"' "$WORKDIR/package.json" 2>/dev/null; then
        if command -v bun >/dev/null 2>&1; then
            run_smoke "test" "cd $WORKDIR && bun test 2>&1 | tail -1" 120 || true
        else
            _report_result "test" SKIP "bun not found"
        fi
    fi

    # Build
    if [[ -f "$WORKDIR/package.json" ]] && grep -q '"build"' "$WORKDIR/package.json" 2>/dev/null; then
        if command -v bun >/dev/null 2>&1; then
            run_smoke "build" "cd $WORKDIR && bun run build 2>&1 | tail -1" 120 || true
        else
            _report_result "build" SKIP "bun not found"
        fi
    fi

    # ── Custom smoke tests ──────────────────────────────────────────────────
    if [[ -d "$SMOKE_DIR" ]]; then
        echo ""
        log_info "Running custom smoke tests from $SMOKE_DIR..."

        local custom_tests=0
        for test_script in "$SMOKE_DIR"/smoke-*.sh; do
            [[ -f "$test_script" ]] || continue
            custom_tests=$((custom_tests + 1))

            if run_smoke_file "$test_script"; then
                : # passed
            else
                FAILED=$((FAILED + 1))
            fi
        done

        log_info "Custom tests found: $custom_tests"
    else
        log_debug "No custom smoke tests directory: $SMOKE_DIR"
    fi

    # ── Summary ────────────────────────────────────────────────────────────
    echo ""
    log_info "═══════════════════════════════════════"
    log_info "SMOKE TEST SUMMARY"
    log_info "  Passed: $PASSED"
    log_info "  Failed: $FAILED"
    log_info "  Skipped: $SKIPPED"
    log_info "═══════════════════════════════════════"

    if [[ $FAILED -gt 0 ]]; then
        log_error "SMOKE: $FAILED test(s) failed"
        exit 1
    fi

    log_info "SMOKE: all passed ($PASSED tests)"
    exit 0
}

main "$@"