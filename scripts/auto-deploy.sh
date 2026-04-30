#!/bin/bash
# auto-deploy.sh — Subdomain creation + Coolify deploy
# Hardened version with error handling, logging, timeouts, and cleanup
set -euo pipefail

# ─── Defaults & Constants ───────────────────────────────────────────────────
readonly SCRIPT_NAME="$(basename "$0")"
readonly SCRIPT_VERSION="2.0.0"
readonly WORKDIR="/srv/monorepo"
readonly DOMAIN_BASE="${DOMAIN_BASE:-zappro.site}"
readonly MAX_DEPLOY_TIMEOUT=300
readonly MAX_HEALTH_CHECKS=12
readonly HEALTH_CHECK_INTERVAL=5

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
_DEPLOY_PID=""
_CLEANUP_STACK=()
_push_cleanup() { _CLEANUP_STACK+=("$1"); }
_run_cleanup() {
    log_debug "Running cleanup handlers..."
    if [[ -n "$_DEPLOY_PID" ]] && kill -0 "$_DEPLOY_PID" 2>/dev/null; then
        log_debug "Killing stale deploy process: $_DEPLOY_PID"
        kill "$_DEPLOY_PID" 2>/dev/null || true
    fi
    local rev
    for rev in $(printf '%s\n' "${_CLEANUP_STACK[@]}" | tac); do
        eval "$rev" 2>/dev/null || true
    done
}
trap _run_cleanup EXIT

# ─── Helpers ────────────────────────────────────────────────────────────────
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

_curl_json() {
    local method="$1"
    local url="$2"
    local token="$3"
    local data="$4"
    local timeout="${5:-30}"

    if ! command -v curl >/dev/null 2>&1; then
        log_error "curl not found"
        return 1
    fi

    local curl_args=(-s -X "$method" -H "Authorization: Bearer $token" -H "Content-Type: application/json")
    [[ -n "$data" ]] && curl_args+=(-d "$data")

    timeout "$timeout" curl "${curl_args[@]}" "$url" 2>/dev/null || return 1
}

_is_valid_app_name() {
    local name="$1"
    # Alphanumeric, dash, underscore — must start with letter
    [[ "$name" =~ ^[a-z][a-z0-9_-]*$ ]]
}

_is_valid_port() {
    local port="$1"
    [[ "$port" =~ ^[0-9]+$ ]] && [[ "$port" -ge 1 ]] && [[ "$port" -le 65535 ]]
}

_is_valid_branch() {
    local branch="$1"
    # Allow alphanumeric, dash, underscore, dot
    [[ "$branch" =~ ^[a-zA-Z0-9._/-]+$ ]]
}

# ─── Input Validation ────────────────────────────────────────────────────────
validate_inputs() {
    local app_name="$1"
    local branch="$2"
    local port="$3"

    if [[ -z "$app_name" ]]; then
        log_error "APP_NAME cannot be empty"
        log_error "Usage: auto-deploy.sh <app-name> [branch] [port]"
        return 1
    fi

    if ! _is_valid_app_name "$app_name"; then
        log_error "Invalid app name: $app_name"
        log_error "Must start with letter, contain only alphanumeric/dash/underscore"
        return 1
    fi

    if ! _is_valid_branch "$branch"; then
        log_error "Invalid branch name: $branch"
        return 1
    fi

    if ! _is_valid_port "$port"; then
        log_error "Invalid port: $port (must be 1-65535)"
        return 1
    fi

    return 0
}

# ─── Health Checks ───────────────────────────────────────────────────────────
health_check_disk() {
    local available
    available=$(df -m "$WORKDIR" 2>/dev/null | awk 'NR==2 {print $4}' | tr -d 'M')
    if [[ -z "$available" ]] || [[ "$available" -lt 50 ]]; then
        log_warn "Low disk space: ${available:-?}MB"
    fi
    log_debug "Disk space: ${available:-?}MB"
}

health_check_network() {
    log_debug "Checking network connectivity..."
    if ! timeout 5 ping -c 1 8.8.8.8 >/dev/null 2>&1; then
        log_warn "No internet connectivity"
        return 1
    fi
    log_debug "Network OK"
    return 0
}

health_check_coolify() {
    local host="$COOLIFY_HOST"
    log_debug "Checking Coolify connectivity: $host"
    if ! _http_get "$host/api/v1/health" 10 5; then
        log_warn "Coolify health check failed: $host"
        return 1
    fi
    log_debug "Coolify OK"
    return 0
}

health_check_subdomain_script() {
    local script="$1"
    if [[ ! -f "$script" ]]; then
        log_warn "Subdomain script not found: $script"
        return 1
    fi
    if [[ ! -x "$script" ]]; then
        log_warn "Subdomain script not executable: $script"
        return 1
    fi
    log_debug "Subdomain script OK"
    return 0
}

# ─── Subdomain Creation ─────────────────────────────────────────────────────
create_subdomain() {
    local app_name="$1"
    local target_url="$2"
    local subdomain_script="/srv/ops/scripts/create-subdomain.sh"

    log_info "Creating subdomain: ${app_name}.${DOMAIN_BASE} → $target_url"

    if ! health_check_subdomain_script "$subdomain_script"; then
        log_warn "Cannot create subdomain — script not available"
        return 1
    fi

    if bash "$subdomain_script" "$app_name" "$target_url" 2>&1 | head -20; then
        log_info "Subdomain creation completed"
        return 0
    else
        log_warn "Subdomain creation returned non-zero — may already exist or partial"
        return 0  # Don't fail hard on subdomain issues
    fi
}

# ─── Coolify Deployment ─────────────────────────────────────────────────────
deploy_via_coolify() {
    local app_name="$1"
    local branch="$2"
    local coolify_host="$COOLIFY_HOST"
    local coolify_key="$COOLIFY_API_KEY"

    log_info "Querying Coolify for app: $app_name"

    if [[ -z "$coolify_key" ]]; then
        log_warn "COOLIFY_API_KEY not set — skipping Coolify deployment"
        return 1
    fi

    # Get application UUID
    local response
    response=$(_curl_json GET "$coolify_host/api/v1/applications" "$coolify_key" "" 30) || {
        log_error "Failed to query Coolify applications"
        return 1
    }

    local app_uuid
    app_uuid=$(echo "$response" | jq -r ".data[] | select(.name == \"$app_name\") | .uuid" 2>/dev/null | head -1)

    if [[ -z "$app_uuid" ]] || [[ "$app_uuid" == "null" ]]; then
        log_error "App not found in Coolify: $app_name"
        log_debug "Available apps: $(echo "$response" | jq -r '.data[].name' 2>/dev/null | tr '\n' ' ')"
        return 1
    fi

    log_info "Found app UUID: $app_uuid"

    # Trigger deployment
    log_info "Triggering deploy (branch=$branch)..."
    local deploy_response
    deploy_response=$(_curl_json POST "$coolify_host/api/v1/applications/$app_uuid/deploy" \
        "$coolify_key" "{\"branch\": \"$branch\"}" 60) || {
        log_error "Deploy trigger failed"
        return 1
    }

    local deploy_msg
    deploy_msg=$(echo "$deploy_response" | jq -r '.message // .error // "ok"' 2>/dev/null)
    log_info "Deploy response: $deploy_msg"

    _push_cleanup "log_debug 'Deploy initiated for $app_name'"
    return 0
}

# ─── Health Verification ─────────────────────────────────────────────────────
verify_deployment() {
    local domain="$1"
    local max_checks=${2:-$MAX_HEALTH_CHECKS}
    local interval=${3:-$HEALTH_CHECK_INTERVAL}

    log_info "Verifying deployment: https://$domain"

    local check_num=0
    local success=false

    while [[ $check_num -lt $max_checks ]]; do
        check_num=$((check_num + 1))
        log_info "Health check $check_num/$max_checks..."

        if _http_get "https://$domain/health" 10 5; then
            log_info "SUCCESS: https://$domain/health — OK"
            success=true
            break
        fi

        if _http_get "https://$domain/" 10 5; then
            log_info "SUCCESS: https://$domain/ — responding"
            success=true
            break
        fi

        if [[ $check_num -lt $max_checks ]]; then
            log_info "Not ready yet — waiting ${interval}s..."
            sleep "$interval"
        fi
    done

    if ! $success; then
        log_warn "Deployment not responding after ${max_checks} checks"
        log_warn "Domain: https://$domain"
        log_warn "This may be expected if the app needs more time to start"
        return 1
    fi

    return 0
}

# ─── Main ────────────────────────────────────────────────────────────────────
main() {
    local app_name="${1:-}"
    local branch="${2:-main}"
    local port="${3:-3000}"

    log_info "auto-deploy.sh v$SCRIPT_VERSION starting"
    log_info "App: $app_name | Branch: $branch | Port: $port"

    # Validate inputs
    if ! validate_inputs "$app_name" "$branch" "$port"; then
        exit 1
    fi

    # Pre-flight health checks
    log_info "Running pre-flight checks..."
    health_check_disk
    health_check_network

    # Store deploy pid for cleanup
    _DEPLOY_PID=$$

    local domain="${app_name}.${DOMAIN_BASE}"

    # ── Step 1: Create subdomain ──────────────────────────────────────────
    log_info "Step 1: Subdomain creation..."
    if ! create_subdomain "$app_name" "http://localhost:$port"; then
        log_warn "Subdomain creation had issues — continuing anyway"
    fi

    # ── Step 2: Coolify deploy ───────────────────────────────────────────
    if [[ -n "${COOLIFY_API_KEY:-}" ]]; then
        log_info "Step 2: Coolify deployment..."
        if health_check_coolify; then
            if ! deploy_via_coolify "$app_name" "$branch"; then
                log_warn "Coolify deployment failed — continuing to health check"
            fi
        else
            log_warn "Coolify health check failed — skipping deploy trigger"
        fi
    else
        log_info "Step 2: SKIPPED (COOLIFY_API_KEY not set)"
    fi

    # ── Step 3: Wait and verify ──────────────────────────────────────────
    log_info "Step 3: Health verification..."
    if verify_deployment "$domain"; then
        log_info "═══════════════════════════════════════"
        log_info "DEPLOY SUCCESS: https://$domain"
        log_info "═══════════════════════════════════════"
        exit 0
    else
        log_warn "Health verification did not confirm deployment"
        log_warn "The app may still be starting — check manually: https://$domain"
        exit 1
    fi
}

main "$@"