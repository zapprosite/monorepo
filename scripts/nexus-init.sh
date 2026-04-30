#!/usr/bin/env bash
# =============================================================================
# Nexus Init — Automatic detection and configuration for nexus workflow
# =============================================================================
# Usage: source nexus-init.sh  (recommended)
#        bash nexus-init.sh    (alternative — subshell)
#
# Detects CLI (claude/codex/opencode), configures paths/env vars,
# checks prerequisites, creates directories, initializes queue.json.
# =============================================================================

set -euo pipefail

# ── Constants ─────────────────────────────────────────────────────────────────

NEXUS_BASE="${NEXUS_BASE:-$HOME/nexus}"
NEXUS_SCRIPTS="${NEXUS_SCRIPTS:-$NEXUS_BASE/scripts}"
NEXUS_STATE="${NEXUS_STATE:-$NEXUS_BASE/state}"
NEXUS_QUEUE="${NEXUS_QUEUE:-$NEXUS_STATE/queue.json}"
NEXUS_VIBE_KIT="${NEXUS_VIBE_KIT:-$HOME/.claude/vibe-kit}"

# ── CLI Detection ─────────────────────────────────────────────────────────────

_detect_cli() {
    # Priority: env var > process tree > PATH
    if [[ -n "${CLAUDE_API_KEY:-}" ]] || [[ -n "${ANTHROPIC_API_KEY:-}" ]]; then
        echo "claude"; return 0
    fi
    if [[ -n "${OPENCODE_API_KEY:-}" ]]; then
        echo "opencode"; return 0
    fi
    if [[ -n "${CODEX_API_KEY:-}" ]]; then
        echo "codex"; return 0
    fi

    # Walk process tree
    local pid=$$
    local depth=0
    while [[ $depth -lt 12 ]]; do
        local ppid
        ppid=$(ps -o ppid= -p "$pid" 2>/dev/null | awk '{print $1}' | tr -d ' ')
        [[ -z "$ppid" ]] || [[ "$ppid" == "0" ]] || [[ "$ppid" == "$pid" ]] && break

        local cmd
        cmd=$(ps -o comm= -p "$pid" 2>/dev/null | tr -d ' ')
        case "$cmd" in
            claude|claude-code)  echo "claude";  return 0 ;;
            codex)               echo "codex";   return 0 ;;
            opencode)            echo "opencode"; return 0 ;;
        esac

        pid="$ppid"
        depth=$((depth + 1))
    done

    # PATH fallback
    if command -v claude &>/dev/null; then echo "claude"; return 0; fi
    if command -v opencode &>/dev/null; then echo "opencode"; return 0; fi
    if command -v codex &>/dev/null; then echo "codex"; return 0; fi

    echo "unknown"
}

# ── CLI-specific Configuration ─────────────────────────────────────────────────

_configure_for_cli() {
    local cli="$1"

    case "$cli" in
        claude)
            export NEXUS_CLI="claude"
            export NEXUS_CONFIG_DIR="$HOME/.claude"
            export NEXUS_AGENTS_DIR="$HOME/.claude/agents"
            export NEXUS_SKILLS_DIR="$HOME/.claude/skills"
            export NEXUS_EVENTS_DIR="$HOME/.claude-events"
            export NEXUS_RUNNER="mclaude"
            ;;

        codex)
            export NEXUS_CLI="codex"
            export NEXUS_CONFIG_DIR="$HOME/.config/codex"
            export NEXUS_AGENTS_DIR="$HOME/.config/codex/agents"
            export NEXUS_SKILLS_DIR="$HOME/.config/codex/skills"
            export NEXUS_EVENTS_DIR="$HOME/.codex-events"
            export NEXUS_RUNNER="codex"
            ;;

        opencode)
            export NEXUS_CLI="opencode"
            export NEXUS_CONFIG_DIR="$HOME/.config/opencode"
            export NEXUS_AGENTS_DIR="$HOME/.config/opencode/agents"
            export NEXUS_SKILLS_DIR="$HOME/.config/opencode/skills"
            export NEXUS_EVENTS_DIR="$HOME/.opencode-events"
            export NEXUS_RUNNER="opencode"
            ;;

        *)
            export NEXUS_CLI="unknown"
            export NEXUS_CONFIG_DIR="$NEXUS_BASE/.config"
            export NEXUS_AGENTS_DIR="$NEXUS_BASE/agents"
            export NEXUS_SKILLS_DIR="$NEXUS_BASE/skills"
            export NEXUS_EVENTS_DIR="$NEXUS_BASE/events"
            export NEXUS_RUNNER="nexus"
            ;;
    esac

    # Common paths derived from base
    export NEXUS_TASKS_DIR="$NEXUS_BASE/tasks"
    export NEXUS_LOGS_DIR="$NEXUS_BASE/logs"
    export NEXUS_CACHE_DIR="$NEXUS_BASE/cache"
    export NEXUS_HOOKS_DIR="$NEXUS_BASE/hooks"
}

# ── Prerequisites Check ────────────────────────────────────────────────────────

_check_prerequisites() {
    local errors=0

    # Python3
    if ! command -v python3 &>/dev/null; then
        echo "[NEXUS-INIT] ERROR: python3 not found" >&2
        errors=$((errors + 1))
    fi

    # jq
    if ! command -v jq &>/dev/null; then
        echo "[NEXUS-INIT] ERROR: jq not found" >&2
        errors=$((errors + 1))
    fi

    # git
    if ! command -v git &>/dev/null; then
        echo "[NEXUS-INIT] ERROR: git not found" >&2
        errors=$((errors + 1))
    fi

    if [[ $errors -gt 0 ]]; then
        echo "[NEXUS-INIT] Prerequisites check failed ($errors missing)" >&2
        return 1
    fi

    echo "[NEXUS-INIT] Prerequisites: OK (python3, jq, git)"
    return 0
}

# ── Directory Creation ─────────────────────────────────────────────────────────

_create_directories() {
    local dirs=(
        "$NEXUS_BASE"
        "$NEXUS_SCRIPTS"
        "$NEXUS_STATE"
        "$NEXUS_TASKS_DIR"
        "$NEXUS_LOGS_DIR"
        "$NEXUS_CACHE_DIR"
        "$NEXUS_HOOKS_DIR"
    )

    for dir in "${dirs[@]}"; do
        if [[ ! -d "$dir" ]]; then
            mkdir -p "$dir"
            echo "[NEXUS-INIT] Created: $dir"
        fi
    done
}

# ── Queue Initialization ───────────────────────────────────────────────────────

_init_queue() {
    if [[ -f "$NEXUS_QUEUE" ]]; then
        echo "[NEXUS-INIT] queue.json exists: $NEXUS_QUEUE"
        return 0
    fi

    # Create with default structure
    local timestamp
    timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

    cat > "$NEXUS_QUEUE" <<EOF
{
  "version": 1,
  "created": "$timestamp",
  "cli": "${NEXUS_CLI:-unknown}",
  "queue": [],
  "history": []
}
EOF

    echo "[NEXUS-INIT] Created queue.json: $NEXUS_QUEUE"
}

# ── Nexus Version / Info ──────────────────────────────────────────────────────

_print_info() {
    echo ""
    echo "╔══════════════════════════════════════════════════════════╗"
    echo "║                    NEXUS INIT v1.0                     ║"
    echo "╠══════════════════════════════════════════════════════════╣"
    printf "║  CLI Detected: %-38s║\n" "$NEXUS_CLI"
    printf "║  Base Directory: %-36s║\n" "$NEXUS_BASE"
    printf "║  Queue: %-44s║\n" "$NEXUS_QUEUE"
    printf "║  Events: %-43s║\n" "${NEXUS_EVENTS_DIR:-N/A}"
    echo "╠══════════════════════════════════════════════════════════╣"
    echo "║  Available env vars:                                    ║"
    echo "║    NEXUS_BASE, NEXUS_SCRIPTS, NEXUS_STATE               ║"
    echo "║    NEXUS_CLI, NEXUS_QUEUE, NEXUS_RUNNER                ║"
    echo "║    NEXUS_TASKS_DIR, NEXUS_LOGS_DIR, NEXUS_CACHE_DIR    ║"
    echo "╚══════════════════════════════════════════════════════════╝"
    echo ""
}

# ── Main ─────────────────────────────────────────────────────────────────────

main() {
    echo "[NEXUS-INIT] Starting nexus initialization..."

    # 1. Detect CLI
    local cli
    cli=$(_detect_cli)
    echo "[NEXUS-INIT] CLI detected: $cli"

    # 2. Configure paths and env vars
    _configure_for_cli "$cli"
    echo "[NEXUS-INIT] Configuration applied for: $NEXUS_CLI"

    # 3. Check prerequisites
    if ! _check_prerequisites; then
        echo "[NEXUS-INIT] WARNING: Some prerequisites missing" >&2
    fi

    # 4. Create directories
    _create_directories

    # 5. Initialize queue.json
    _init_queue

    # 6. Print info
    _print_info

    echo "[NEXUS-INIT] Done. Export NEXUS_CLI=$NEXUS_CLI"
    echo "[NEXUS-INIT] Run 'source nexus-init.sh' in your shell for persistent env vars."
}

# ── Execute ───────────────────────────────────────────────────────────────────

main "$@"