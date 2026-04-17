#!/usr/bin/env bash
# sync-docs.sh — Sync docs/ to memory and obsidian mirror
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

echo "=== Syncing docs → ai-context memory ==="
if [[ -x "$ROOT_DIR/scripts/sync-obsidian-mirror.sh" ]]; then
  bash "$ROOT_DIR/scripts/sync-obsidian-mirror.sh"
else
  echo "sync-obsidian-mirror.sh not found, skipping obsidian sync"
fi

echo "=== Syncing memory index ==="
MEMORY_DIR="$HOME/.claude/projects/-srv-monorepo/memory"
if [[ -d "$MEMORY_DIR" ]]; then
  find "$MEMORY_DIR" -name "*.md" -mtime +1 -exec echo "Recent memory files:" {} \;
  echo "Memory sync complete"
else
  echo "No memory directory found"
fi

echo "=== Done ==="
