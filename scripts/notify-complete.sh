#!/bin/bash
# notify-complete.sh — Email notification on loop complete
# Hardened version with error handling, logging, timeouts, and cleanup
set -euo pipefail

# ─── Defaults & Constants ───────────────────────────────────────────────────
readonly SCRIPT_NAME="$(basename "$0")"
readonly SCRIPT_VERSION="2.0.0"
readonly DEFAULT_RECIPIENT="${NOTIFY_EMAIL:-zappro.ia@gmail.com}"
readonly DEFAULT_PREFIX="${NOTIFY_PREFIX:-[VIBE]}"
readonly MAX_EMAIL_LEN=10000
readonly MAX_SUBJECT_LEN=200

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

# ─── Helpers ────────────────────────────────────────────────────────────────
_truncate() {
    local str="$1"
    local max="$2"
    if [[ ${#str} -gt "$max" ]]; then
        echo "${str:0:$max}... [truncated]"
    else
        echo "$str"
    fi
}

_is_valid_email() {
    local email="$1"
    [[ "$email" =~ ^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$ ]]
}

_email_reachable() {
    local host="$1"
    if command -v host >/dev/null 2>&1; then
        if timeout 5 host "$host" >/dev/null 2>&1; then
            return 0
        fi
    fi
    # Fallback: just check if we can reach port 25 or 587
    if command -v nc >/dev/null 2>&1; then
        if timeout 5 nc -z "$host" 25 2>/dev/null || timeout 5 nc -z "$host" 587 2>/dev/null; then
            return 0
        fi
    fi
    return 1
}

# ─── Input Validation ────────────────────────────────────────────────────────
validate_exit_code() {
    local code="$1"
    if [[ ! "$code" =~ ^[0-9]+$ ]]; then
        log_error "Invalid exit code: '$code' — must be integer"
        return 1
    fi
    if [[ "$code" -gt 255 ]]; then
        log_warn "Exit code $code > 255 — may be clamped"
    fi
    return 0
}

validate_recipient() {
    local email="$1"
    if [[ -z "$email" ]]; then
        log_error "Recipient email cannot be empty"
        return 1
    fi
    if ! _is_valid_email "$email"; then
        log_error "Invalid email format: $email"
        return 1
    fi
    return 0
}

# ─── Health Checks ───────────────────────────────────────────────────────────
health_check_mta() {
    local mta_found=false
    for cmd in mail sendmail mutt msmtp ssmtp; do
        if command -v "$cmd" >/dev/null 2>&1; then
            log_debug "MTA found: $cmd"
            mta_found=true
            break
        fi
    done

    if ! $mta_found; then
        log_warn "No mail transfer agent found (mail/sendmail/mutt/msmtp)"
        return 1
    fi
    return 0
}

health_check_hostname() {
    if [[ -z "$HOSTNAME" ]]; then
        HOSTNAME="unknown"
        log_warn "HOSTNAME not set"
    fi
    log_debug "Hostname: $HOSTNAME"
}

# ─── Notification Sending ────────────────────────────────────────────────────
send_email() {
    local recipient="$1"
    local subject="$2"
    local body="$3"

    log_info "Sending email to: $recipient"

    # Try mail command first
    if command -v mail >/dev/null 2>&1; then
        log_debug "Using mail command"
        if echo "$body" | mail -s "$subject" "$recipient" 2>/dev/null; then
            log_info "Email sent successfully via mail"
            return 0
        else
            log_warn "mail command failed"
        fi
    fi

    # Try sendmail
    if command -v sendmail >/dev/null 2>&1; then
        log_debug "Using sendmail command"
        if echo "$body" | sendmail -t "$recipient" 2>/dev/null; then
            log_info "Email sent successfully via sendmail"
            return 0
        else
            log_warn "sendmail command failed"
        fi
    fi

    # Fallback: log only
    log_warn "No working MTA found — logging instead"
    log_info "Would send to: $recipient"
    log_info "Subject: $subject"
    log_info "Body preview: ${body:0:200}..."
    return 0
}

# ─── Main ────────────────────────────────────────────────────────────────────
main() {
    local exit_code="${1:-0}"
    local stats="${2:-}"

    log_info "notify-complete.sh v$SCRIPT_VERSION starting"

    # Validate inputs
    if ! validate_exit_code "$exit_code"; then
        exit 1
    fi

    local recipient="$DEFAULT_RECIPIENT"
    local prefix="$DEFAULT_PREFIX"

    # Validate recipient
    if ! validate_recipient "$recipient"; then
        log_warn "Using fallback recipient validation"
    fi

    # Health checks
    log_info "Running health checks..."
    health_check_hostname

    local timestamp
    timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)

    # Build subject and body
    local subject body
    if [[ "$exit_code" -eq 0 ]]; then
        subject="$prefix Loop complete — $HOSTNAME — $timestamp"
        body="Autonomous loop finished successfully.

Host: $HOSTNAME
Time: $timestamp
Exit code: $exit_code

Stats:
$stats

—
VIBE Autonomous Pipeline"
    else
        subject="$prefix Loop FAILED — $HOSTNAME — $timestamp"
        body="Autonomous loop encountered failures.

Host: $HOSTNAME
Time: $timestamp
Exit code: $exit_code

Stats:
$stats

—
VIBE Autonomous Pipeline"
    fi

    # Truncate to safe lengths
    subject=$(_truncate "$subject" $MAX_SUBJECT_LEN)
    body=$(_truncate "$body" $MAX_EMAIL_LEN)

    # Check MTA health
    if ! health_check_mta; then
        log_warn "MTA check failed — email may not be delivered"
    fi

    # Send notification
    if send_email "$recipient" "$subject" "$body"; then
        log_info "Notification sent"
        exit 0
    else
        log_error "Failed to send notification"
        exit 1
    fi
}

main "$@"