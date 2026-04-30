#!/usr/bin/env bash
# =============================================================================
# CLI Detector — Pure detection of which AI CLI is running
# =============================================================================
# Detects: claude, codex, opencode, cursor, zed
# Returns: type name on stdout

_detect_by_env() {
    if [[ -n "${CLAUDE_API_KEY:-}" ]] || [[ -n "${ANTHROPIC_API_KEY:-}" ]]; then
        echo "claude"; return 0
    fi
    if [[ -n "${OPENCODE_API_KEY:-}" ]]; then
        echo "opencode"; return 0
    fi
    if [[ -n "${CODEX_API_KEY:-}" ]]; then
        echo "codex"; return 0
    fi
    if [[ -n "${CURSOR_API_KEY:-}" ]]; then
        echo "cursor"; return 0
    fi
    if [[ -n "${ZED_API_KEY:-}" ]]; then
        echo "zed"; return 0
    fi
    return 1
}

_detect_by_process() {
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
            cursor)              echo "cursor"; return 0 ;;
            zed)                 echo "zed";   return 0 ;;
        esac

        pid="$ppid"
        depth=$((depth + 1))
    done
    return 1
}

_detect_by_path() {
    if command -v claude &>/dev/null; then
        echo "claude"; return 0
    fi
    if command -v opencode &>/dev/null; then
        echo "opencode"; return 0
    fi
    if command -v codex &>/dev/null; then
        echo "codex"; return 0
    fi
    return 1
}

# ── Main ─────────────────────────────────────────────────────────────────────

_detect_by_env || _detect_by_process || _detect_by_path || echo "unknown"