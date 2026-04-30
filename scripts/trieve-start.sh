#!/bin/bash
# trieve-start.sh — Orchestrated startup for Trieve and its dependencies
# Version: 1.0.0
set -euo pipefail

# ─── Defaults & Constants ───────────────────────────────────────────────────
readonly SCRIPT_NAME="$(basename "$0")"
readonly SCRIPT_VERSION="1.0.0"
readonly WORKDIR="/srv/monorepo"
readonly COMPOSE_FILE="$WORKDIR/docker-compose.trieve.yml"
readonly MAX_TIMEOUT="${MAX_TIMEOUT:-120}"
readonly HEALTH_INTERVAL=5
readonly HEALTH_MAX_ATTEMPTS=$((MAX_TIMEOUT / HEALTH_INTERVAL))

# ─── Logging ────────────────────────────────────────────────────────────────
readonly LOG_PREFIX="[START]"
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
    printf "%s%s %s[%s] [%s] %s%s%s\n" \
        "${color:-}" "$LOG_PREFIX" "$timestamp" "$level" "$msg" "${color:+\033[0m}" >&2
}
log_error()  { _log ERROR "$@"; }
log_warn()   { _log WARN  "$@"; }
log_info()   { _log INFO  "$@"; }
log_debug()  { [[ "${DEBUG:-0}" == "1" ]] && _log DEBUG "$@" || true; }

# ─── Cleanup Handler ─────────────────────────────────────────────────────────
_CLEANUP_STACK=()
_push_cleanup() { _CLEANUP_STACK+=("$1"); }
_run_cleanup() {
    log_debug "Running cleanup handlers..."
    local rev
    for rev in $(printf '%s\n' "${_CLEANUP_STACK[@]}" | tac); do
        eval "$rev" 2>/dev/null || true
    done
}
trap _run_cleanup EXIT

# ─── Helpers ───────────────────────────────────────────────────────────────
_port_open() {
    local host="$1"
    local port="$2"
    if command -v nc >/dev/null 2>&1; then
        nc -z -w 3 "$host" "$port" 2>/dev/null
    elif command -v timeout >/dev/null 2>&1 && command -v bash >/dev/null 2>&1; then
        timeout 3 bash -c "echo >/dev/tcp/$host/$port" 2>/dev/null
    else
        # Fallback using curl if available
        curl -sf --max-time 3 "http://$host:$port" >/dev/null 2>&1
    fi
}

_wait_for_service() {
    local host="$1"
    local port="$2"
    local name="$3"
    local max_attempts="${4:-$HEALTH_MAX_ATTEMPTS}"
    local interval="${5:-$HEALTH_INTERVAL}"

    log_info "Waiting for $name ($host:$port)..."

    local attempt=0
    while [[ $attempt -lt $max_attempts ]]; do
        attempt=$((attempt + 1))
        log_debug "Health check $attempt/$max_attempts for $name..."

        if _port_open "$host" "$port"; then
            log_info "✓ $name is ready"
            return 0
        fi

        if [[ $attempt -lt $max_attempts ]]; then
            log_debug "Not ready — waiting ${interval}s..."
            sleep "$interval"
        fi
    done

    log_error "✗ $name failed to become ready after $MAX_TIMEOUT seconds"
    return 1
}

# ─── Diagnostic Commands ─────────────────────────────────────────────────────
show_diagnostics() {
    log_error "=== Diagnostic Commands ==="
    log_error "Check dependency status:"
    log_error "  docker ps --filter 'name=qdrant' --filter 'name=ollama' --filter 'name=postgres'"
    log_error "  docker compose -f $COMPOSE_FILE ps"
    log_error ""
    log_error "Check port availability:"
    log_error "  ss -tlnp | grep -E ':(6333|11434|5432)'"
    log_error ""
    log_error "View Trieve logs:"
    log_error "  docker compose -f $COMPOSE_FILE logs -f"
    log_error ""
    log_error "Restart dependencies:"
    log_error "  docker compose -f $COMPOSE_FILE up -d qdrant ollama postgres"
}

# ─── Dependency Checks ───────────────────────────────────────────────────────
check_qdrant() {
    log_info "Checking Qdrant (:6333)..."
    if _port_open localhost 6333; then
        log_info "Qdrant already running on :6333"
        return 0
    fi
    log_warn "Qdrant not detected on :6333"
    return 1
}

check_ollama() {
    log_info "Checking Ollama (:11434)..."
    if _port_open localhost 11434; then
        log_info "Ollama already running on :11434"
        return 0
    fi
    log_warn "Ollama not detected on :11434"
    return 1
}

check_postgres() {
    log_info "Checking Postgres (:5432)..."
    if _port_open localhost 5432; then
        log_info "Postgres already running on :5432"
        return 0
    fi
    log_warn "Postgres not detected on :5432"
    return 1
}

check_dependencies() {
    log_info "Checking dependencies..."

    local dep_status=0

    check_qdrant || dep_status=1
    check_ollama || dep_status=1
    check_postgres || dep_status=1

    if [[ $dep_status -ne 0 ]]; then
        log_error "One or more dependencies are not available"
        return 1
    fi

    log_info "All dependencies are available"
    return 0
}

# ─── Trieve Startup ─────────────────────────────────────────────────────────
start_trieve() {
    log_info "Starting Trieve via docker-compose..."

    if [[ ! -f "$COMPOSE_FILE" ]]; then
        log_error "Compose file not found: $COMPOSE_FILE"
        return 1
    fi

    # Pull latest images to avoid stale pulls on restart
    log_info "Pulling latest images..."
    if ! docker compose -f "$COMPOSE_FILE" pull 2>&1 | tail -5; then
        log_warn "Image pull had warnings — continuing anyway"
    fi

    log_info "Starting Trieve services..."
    if ! docker compose -f "$COMPOSE_FILE" up -d 2>&1; then
        log_error "Failed to start Trieve services"
        show_diagnostics
        return 1
    fi

    _push_cleanup "docker compose -f $COMPOSE_FILE down >/dev/null 2>&1 || true"
    log_info "Trieve services started"
    return 0
}

# ─── Health Verification ─────────────────────────────────────────────────────
wait_for_trieve_health() {
    log_info "Waiting for Trieve health endpoint (max ${MAX_TIMEOUT}s)..."

    local attempt=0
    local health_url="http://localhost:7331/health"

    while [[ $attempt -lt $HEALTH_MAX_ATTEMPTS ]]; do
        attempt=$((attempt + 1))
        log_debug "Health check $attempt/$HEALTH_MAX_ATTEMPTS..."

        if curl -sf --max-time 5 "$health_url" >/dev/null 2>&1; then
            log_info "✓ Trieve health endpoint is ready"
            return 0
        fi

        # Also try alternative endpoints
        if curl -sf --max-time 5 "http://localhost:7331/api/health" >/dev/null 2>&1; then
            log_info "✓ Trieve API health is ready"
            return 0
        fi

        if [[ $attempt -lt $HEALTH_MAX_ATTEMPTS ]]; then
            log_debug "Not ready — waiting ${HEALTH_INTERVAL}s..."
            sleep "$HEALTH_INTERVAL"
        fi
    done

    log_error "Trieve health endpoint did not respond after ${MAX_TIMEOUT}s"
    log_error "Trieve may have started but health check failed"
    show_diagnostics
    return 1
}

# ─── Main ───────────────────────────────────────────────────────────────────
main() {
    local timeout_arg=""

    # Parse --timeout flag
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --timeout)
                if [[ -z "${2:-}" ]]; then
                    log_error "--timeout requires a value"
                    exit 1
                fi
                readonly MAX_TIMEOUT="$2"
                shift 2
                ;;
            --help|-h)
                echo "Usage: $0 [OPTIONS]"
                echo "Options:"
                echo "  --timeout SECS  Max wait for health check (default: 120)"
                echo "  --help, -h      Show this help"
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done

    log_info "=== Trieve Startup v$SCRIPT_VERSION ==="
    log_info "Compose file: $COMPOSE_FILE"
    log_info "Health timeout: ${MAX_TIMEOUT}s"

    # Step 1: Check dependencies
    log_info "Step 1: Checking dependencies..."
    if ! check_dependencies; then
        log_error "Dependency check failed"
        log_error "Ensure Qdrant, Ollama, and Postgres are running before starting Trieve"
        show_diagnostics
        exit 1
    fi

    # Step 2: Start Trieve
    log_info "Step 2: Starting Trieve..."
    if ! start_trieve; then
        log_error "Trieve startup failed"
        exit 1
    fi

    # Step 3: Wait for health
    log_info "Step 3: Verifying Trieve health..."
    if ! wait_for_trieve_health; then
        log_warn "Trieve started but health check did not confirm readiness"
        log_warn "Services may still be initializing — check manually"
        show_diagnostics
        exit 1
    fi

    log_info "═══════════════════════════════════════"
    log_info "Trieve is ready"
    log_info "═══════════════════════════════════════"
    exit 0
}

main "$@"