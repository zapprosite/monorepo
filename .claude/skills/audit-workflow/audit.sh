#!/usr/bin/env bash
# audit.sh — List workflow audit log entries
# Usage: ~/.claude/skills/audit-workflow/audit.sh | tail -50

set -euo pipefail

AUDIT_DIR="${AUDIT_DIR:-$HOME/.claude/audit}"
MAX_ENTRIES="${1:-50}"

echo "=== Audit Log: workflow-performatico ==="
echo ""

# ── Health check ───────────────────────────────────────────────
echo "--- Tool Health ---"
if command -v claude &>/dev/null; then
    echo "[OK] Claude Code CLI: $(claude --version 2>/dev/null | head -1)"
else
    echo "[DOWN] Claude Code CLI not found"
fi

if command -v opencode &>/dev/null; then
    echo "[OK] OpenCode CLI: $(opencode --version 2>/dev/null | head -1)"
else
    echo "[DOWN] OpenCode CLI not found"
fi

if curl -sf -m 3 http://localhost:8080/health >/dev/null 2>&1; then
    echo "[OK] OpenClaw is UP"
else
    echo "[DOWN] OpenClaw is NOT responding (container may be down)"
fi
echo ""

# ── Audit entries ──────────────────────────────────────────────
echo "--- Recent Entries ---"
audit_file=$(ls "$AUDIT_DIR"/workflow-*.jsonl 2>/dev/null | sort -r | head -1)

if [[ -z "$audit_file" || ! -f "$audit_file" ]]; then
    echo "No audit entries yet. Run /audit-workflow to start tracking."
    echo ""
    echo "This audit log records actions from:"
    echo "  - Claude Code CLI (claude)"
    echo "  - OpenCode CLI (opencode)"
    echo "  - OpenClaw Bot (Telegram alerts)"
    echo ""
    echo "Audit file location: $AUDIT_DIR/workflow-YYYYMMDD.jsonl"
    echo "Total: 0 entries"
    exit 0
fi

echo "File: $audit_file"
echo ""
total=$(wc -l < "$audit_file")
echo "Total entries in file: $total"
echo ""

if [[ "$total" -eq 0 ]]; then
    echo "File is empty (0 entries)"
    exit 0
fi

echo "Last $MAX_ENTRIES entries (newest first):"
tail -n "$MAX_ENTRIES" "$audit_file" | sort -r | while IFS= read -r line; do
    echo "$line"
done

echo ""
echo "Total: $total entries"
