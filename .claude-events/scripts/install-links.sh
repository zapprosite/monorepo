#!/bin/bash
# install-links.sh - Create symlinks from monorepo config to real locations
# Usage: ./install-links.sh [--dry-run]

DRY_RUN=false
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=true

CLAUDE_DIR="${HOME}/.claude"
LOCAL_BIN="${HOME}/.local/bin"
CODEX_DIR="${HOME}/.codex"
MONOREPO_EVENTS="/srv/monorepo/.claude-events"

# Helper functions
do_ln() {
    local src="$1"
    local dest="$2"
    local desc="$3"

    # Dry-run mode: just echo what would happen
    if $DRY_RUN; then
        echo "[DRY-RUN] $desc: ln -sf $src -> $dest"
        return 0
    fi

    # Ensure parent directory exists
    local parent_dir
    parent_dir="$(dirname "$dest")"
    if [[ ! -d "$parent_dir" ]]; then
        echo -n "Creating parent dir $parent_dir: "
        mkdir -p "$parent_dir" && echo "OK" || { echo "FAILED"; return 1; }
    fi

    # Remove existing link/file if present
    if [[ -e "$dest" || -L "$dest" ]]; then
        echo -n "Removing existing $dest: "
        rm -rf "$dest" && echo "OK" || { echo "FAILED"; return 1; }
    fi

    echo -n "$desc: "
    ln -sf "$src" "$dest" && echo "OK" || { echo "FAILED"; return 1; }
}

echo "=== Creating symlinks ==="

# events dir - create first (needed for subsequent links inside it)
if $DRY_RUN; then
    echo "[DRY-RUN] events dir: rm -rf $CLAUDE_DIR/events && ln -s $MONOREPO_EVENTS -> $CLAUDE_DIR/events"
else
    if [[ -L "$CLAUDE_DIR/events" || -e "$CLAUDE_DIR/events" ]]; then
        echo -n "Removing existing $CLAUDE_DIR/events: "
        rm -rf "$CLAUDE_DIR/events" && echo "OK" || { echo "FAILED"; exit 1; }
    fi
    echo -n "Creating events dir -> $MONOREPO_EVENTS: "
    mkdir -p "$(dirname "$CLAUDE_DIR/events")" && ln -s "$MONOREPO_EVENTS" "$CLAUDE_DIR/events" && echo "OK" || { echo "FAILED"; exit 1; }
fi

# Config symlinks
do_ln "$MONOREPO_EVENTS/config/codex-hooks.json" "$CODEX_DIR/hooks.json" "codex-hooks.json -> $CODEX_DIR/hooks.json"
do_ln "$MONOREPO_EVENTS/config/opencode-config.toml" "$CODEX_DIR/config.toml" "opencode-config.toml -> $CODEX_DIR/config.toml"

# Self-link for install-links.sh inside events dir
do_ln "$MONOREPO_EVENTS/scripts/install-links.sh" "$CLAUDE_DIR/events/install-links.sh" "install-links.sh (self) -> $CLAUDE_DIR/events/install-links.sh"

# OpenCode wrappers
for wrapper in opencode-original opencode-minimax opencode-gpt; do
    do_ln "$MONOREPO_EVENTS/config/opencode-wrappers/$wrapper" "$LOCAL_BIN/$wrapper" "$wrapper -> $LOCAL_BIN/$wrapper"
done

echo "=== Done ==="
