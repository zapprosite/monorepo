#!/bin/bash
# uninstall-links.sh - Remove symlinks created by install-links.sh
# Usage: ./uninstall-links.sh

set -euo pipefail

CLAUDE_DIR="${HOME}/.claude"
LOCAL_BIN="${HOME}/.local/bin"
CODEX_DIR="${HOME}/.codex"

echo "=== Removing symlinks ==="

# Config symlinks
echo -n "Removing codex-hooks.json symlink: "
rm -f "$CODEX_DIR/hooks.json" && echo "OK" || echo "Already removed"

echo -n "Removing opencode-config.toml symlink: "
rm -f "$CODEX_DIR/config.toml" && echo "OK" || echo "Already removed"

echo -n "Removing install-links.sh symlink: "
rm -f "$CLAUDE_DIR/events/install-links.sh" && echo "OK" || echo "Already removed"

# OpenCode wrappers
for wrapper in opencode-original opencode-minimax opencode-gpt; do
    echo -n "Removing $wrapper symlink: "
    rm -f "$LOCAL_BIN/$wrapper" && echo "OK" || echo "Already removed"
done

# events dir symlink
echo -n "Removing events dir symlink: "
rm -rf "$CLAUDE_DIR/events" && echo "OK" || echo "Already removed"

# state-manager and event-emit symlinks
echo -n "Removing state-manager.py symlink: "
rm -f "$CLAUDE_DIR/events/state-manager.py" && echo "OK" || echo "Already removed"

echo -n "Removing event-emit.sh symlink: "
rm -f "$CLAUDE_DIR/events/event-emit.sh" && echo "OK" || echo "Already removed"

echo "=== Done ==="
