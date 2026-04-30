#!/bin/bash
# health-check-trieve.sh — Health check for Trieve RAG service and dependencies
set -euo pipefail

# ─── Defaults & Constants ───────────────────────────────────────────────────
readonly SCRIPT_NAME="$(basename "$0")"
readonly SCRIPT_VERSION="1.0.0"
readonly DEFAULT_TRIEVE_HOST="${TRIEVE_HOST:-http://localhost:6333}"
readonly DEFAULT_QDRANT_HOST="${QDRANT_HOST:-http://localhost:6334}"
readonly DEFAULT_OLLAMA_HOST="${OLLAMA_HOST:-http://localhost:11434}"
readonly DEFAULT_POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
readonly DEFAULT_POSTGRES_PORT="${POSTGRES_PORT:-5432}"
readonly DEFAULT_POSTGRES_DB="${POSTGRES_DB:-trieve}"
readonly DEFAULT_POSTGRES_USER="${POSTGRES_USER:-postgres}"
readonly POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-}"
readonly MAX_CHECKS=3

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

# ─── Helpers ───────────────────────────────────────────────────────────────
_http_get() {
    local url="$1"
    local timeout="${2:-10}"
    local max_wait="${3:-5}"

    if command -v curl >/dev/null 2>&1; then
        timeout "$max_wait" curl -sf "$url" 2>/dev/null && return 0 || return 1
    elif command -v wget >/dev/null 2>&1; then
        timeout "$max_wait" wget -q -O - "$url" 2>/dev/null && return 0 || return 1
    else
        log_error "No HTTP client found (curl/wget)"
        return 1
    fi
}

_pg_is_reachable() {
    local host="$1"
    local port="$2"
    local db="$3"
    local user="$4"
    local pass="$5"

    if command -v pg_isready >/dev/null 2>&1; then
        PGCONNECT_TIMEOUT=5 pg_isready -h "$host" -p "$port" -d "$db" -U "$user" 2>/dev/null && return 0 || return 1
    elif command -v psql >/dev/null 2>&1; then
        PGPASSWORD="$pass" timeout 5 psql -h "$host" -p "$port" -d "$db" -U "$user" -c "SELECT 1" -t 2>/dev/null && return 0 || return 1
    else
        log_warn "No PostgreSQL client found (pg_isready/psql)"
        return 1
    fi
}

# ─── Health Checks ───────────────────────────────────────────────────────────
check_trieve() {
    local tries=1
    local success=false

    while [[ $tries -le $MAX_CHECKS ]]; do
        log_info "[CHECK] Trieve API health: ${TRIEVE_HOST}/api/v1/health"

        if _http_get "${TRIEVE_HOST}/api/v1/health" 10 5; then
            log_info "[CHECK] Trieve API — OK"
            success=true
            return 0
        fi

        if [[ $tries -lt $MAX_CHECKS ]]; then
            log_debug "Retrying in 3s... ($tries/$MAX_CHECKS)"
            sleep 3
        fi
        tries=$((tries + 1))
    done

    log_error "[CHECK] Trieve API — FAILED"
    return 1
}

check_qdrant() {
    local tries=1
    local success=false

    while [[ $tries -le $MAX_CHECKS ]]; do
        log_info "[CHECK] Qdrant health: ${QDRANT_HOST}/health"

        if _http_get "${QDRANT_HOST}/health" 10 5; then
            log_info "[CHECK] Qdrant — OK"
            success=true
            return 0
        fi

        if [[ $tries -lt $MAX_CHECKS ]]; then
            log_debug "Retrying in 3s... ($tries/$MAX_CHECKS)"
            sleep 3
        fi
        tries=$((tries + 1))
    done

    log_error "[CHECK] Qdrant — FAILED"
    return 1
}

check_ollama() {
    local tries=1
    local success=false

    while [[ $tries -le $MAX_CHECKS ]]; do
        log_info "[CHECK] Ollama health: ${OLLAMA_HOST}/api/tags"

        if _http_get "${OLLAMA_HOST}/api/tags" 10 5; then
            log_info "[CHECK] Ollama — OK"
            success=true
            return 0
        fi

        if [[ $tries -lt $MAX_CHECKS ]]; then
            log_debug "Retrying in 3s... ($tries/$MAX_CHECKS)"
            sleep 3
        fi
        tries=$((tries + 1))
    done

    log_error "[CHECK] Ollama — FAILED"
    return 1
}

check_postgres() {
    local tries=1
    local success=false

    while [[ $tries -le $MAX_CHECKS ]]; do
        log_info "[CHECK] Postgres health: ${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}"

        if _pg_is_reachable "$POSTGRES_HOST" "$POSTGRES_PORT" "$POSTGRES_DB" "$POSTGRES_USER" "$POSTGRES_PASSWORD"; then
            log_info "[CHECK] Postgres — OK"
            success=true
            return 0
        fi

        if [[ $tries -lt $MAX_CHECKS ]]; then
            log_debug "Retrying in 3s... ($tries/$MAX_CHECKS)"
            sleep 3
        fi
        tries=$((tries + 1))
    done

    log_error "[CHECK] Postgres — FAILED"
    return 1
}

# ─── Main ────────────────────────────────────────────────────────────────────
main() {
    # Parse --verbose flag
    if [[ "${1:-}" == "--verbose" ]] || [[ "${1:-}" == "-v" ]]; then
        export DEBUG=1
        export LOG_LEVEL=DEBUG
        log_debug "Verbose mode enabled"
    fi

    log_info "health-check-trieve.sh v$SCRIPT_VERSION starting"
    log_info "TRIEVE: ${TRIEVE_HOST}"
    log_info "QDRANT: ${QDRANT_HOST}"
    log_info "OLLAMA: ${OLLAMA_HOST}"
    log_info "POSTGRES: ${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}"

    local failed=0

    check_trieve    || failed=$((failed + 1))
    check_qdrant    || failed=$((failed + 1))
    check_ollama    || failed=$((failed + 1))
    check_postgres  || failed=$((failed + 1))

    if [[ $failed -eq 0 ]]; then
        log_info "═══════════════════════════════════════"
        log_info "ALL HEALTH CHECKS PASSED"
        log_info "═══════════════════════════════════════"
        exit 0
    else
        log_error "═══════════════════════════════════════"
        log_error "HEALTH CHECK FAILED: $failed service(s) unreachable"
        log_error "═══════════════════════════════════════"
        exit 1
    fi
}

main "$@"