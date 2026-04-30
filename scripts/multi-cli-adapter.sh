#!/usr/bin/env bash
# =============================================================================
# Multi-CLI Adapter — Configure environment for claude/codex/opencode workers
# =============================================================================
# Detects CLI type, maps API keys, detects workspace root, sets worker cmd
#
# CLI-specific flags:
#   Claude Code  → --dangerously-skip-permissions  (skip all prompts)
#   OpenCode     → --config ~/.claude/vibe-kit/.opencode.json
#   Codex        → --project /srv/monorepo
#
# Usage: source /srv/monorepo/scripts/multi-cli-adapter.sh
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "${SCRIPT_DIR}/cli-detector.sh"

# ── Detect CLI ────────────────────────────────────────────────────────────────

CLI_TYPE="$(bash "${SCRIPT_DIR}/cli-detector.sh" 2>/dev/null)" || CLI_TYPE="unknown"
export CLI_TYPE

# ── Workspace root detection ─────────────────────────────────────────────────

_detect_workspace() {
    if [[ -n "${WORKSPACE_ROOT:-}" ]]; then
        echo "$WORKSPACE_ROOT"; return 0
    fi
    if [[ -n "${AGENT_WORKSPACE:-}" ]]; then
        echo "$AGENT_WORKSPACE"; return 0
    fi

    local dir="$PWD"
    while [[ "$dir" != "/" ]]; do
        if [[ -d "$dir/.git" ]] || [[ -f "$dir/CLAUDE.md" ]] || [[ -f "$dir/package.json" ]]; then
            echo "$dir"; return 0
        fi
        dir="$(dirname "$dir")"
    done

    echo "/srv/monorepo"
}

WORKSPACE_ROOT="$(_detect_workspace)"
export WORKSPACE_ROOT

# ── API key mapping ───────────────────────────────────────────────────────────
#
# API key priority per CLI:
#   Claude Code:  ANTHROPIC_API_KEY > CLAUDE_API_KEY
#   OpenCode:     OPENCODE_API_KEY > OPENAI_API_KEY
#   Codex:        OPENAI_API_KEY (OpenAI-compatible)
#   Cursor:       CURSOR_API_KEY > OPENAI_API_KEY
#   Zed:          ZED_API_KEY
#
# Note: mclaude wrapper handles its own API key via --provider flag
# and reads from provider-specific env vars (MINIMAX_API_KEY, etc.)

_assign_api_key() {
    case "$CLI_TYPE" in
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
        zed)
            [[ -n "${ZED_API_KEY:-}" ]] && echo "$ZED_API_KEY" && return 0
            return 1
            ;;
        *)
            return 1
            ;;
    esac
}

API_KEY="$(_assign_api_key 2>/dev/null)" || API_KEY=""
export API_KEY

# ── Worker command ─────────────────────────────────────────────────────────────
#
# CLI-specific invocation patterns:
#   Claude Code:  claude --dangerously-skip-permissions [-p "prompt"]
#                 --allowedTools "Bash,Read,Edit,Write,Search"
#                 --max-iterations N
#   OpenCode:     opencode run --dangerously-skip-permissions --format json
#                 --dir /srv/monorepo --model minimax/MiniMax-M2.7
#                 [--config /path/to/.opencode.json]
#   Codex:        codex agent --project /srv/monorepo
#   Cursor:       cursor --headless [--model MODEL]
#   Zed:          zed --plugin [plugin-name]
#   mclaude:      mclaude --provider PROVIDER --model MODEL -p "prompt"
#                 (multi-provider wrapper, handles API key mapping internally)

_assign_worker_cmd() {
    case "$CLI_TYPE" in
        claude)
            echo "claude --dangerously-skip-permissions"
            ;;
        opencode)
            # OpenCode uses config file at ~/.claude/vibe-kit/.opencode.json
            # Override with OPENCODE_CONFIG env var if custom config needed
            local opencode_config="${OPENCODE_CONFIG:-${HOME}/.claude/vibe-kit/.opencode.json}"
            if [[ -f "$opencode_config" ]]; then
                echo "opencode --config $opencode_config"
            else
                echo "opencode"
            fi
            ;;
        codex)
            # Codex requires --project flag to specify workspace
            echo "codex --project ${WORKSPACE_ROOT}"
            ;;
        cursor)
            echo "cursor --headless"
            ;;
        zed)
            echo "zed --plugin"
            ;;
        *)
            echo ""
            ;;
    esac
}

WORKER_CMD="$(_assign_worker_cmd)"
export WORKER_CMD

# ── Worker parallelism ─────────────────────────────────────────────────────────

WORKER_COUNT="${VIBE_PARALLEL:-${WORKER_COUNT:-5}}"
export WORKER_COUNT

# ── Derived exports ────────────────────────────────────────────────────────────

export CLI_DETECTED=1
export ADAPTER_VERSION="1.1.0"

# ── Validation ────────────────────────────────────────────────────────────────

if [[ -z "$API_KEY" ]]; then
    echo "[multi-cli-adapter] WARNING: No API key detected for CLI type '$CLI_TYPE'" >&2
fi

if [[ ! -d "$WORKSPACE_ROOT" ]]; then
    echo "[multi-cli-adapter] WARNING: Workspace root '$WORKSPACE_ROOT' does not exist" >&2
fi