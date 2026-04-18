#!/usr/bin/env bash
# snapshot.sh — State snapshot before each orchestrator agent runs
# Part of: SPEC-071-V4 (ROLLBACK ENGINE)
# Usage: bash snapshot.sh <agent_id> <pipeline_id> [label]
# Snapshot dir: tasks/snapshots/<pipeline_id>/<agent_id>/
# Creates: src.before/, git.commit

set -euo pipefail

AGENT_ID="${1:-}"
PIPELINE_ID="${2:-}"
LABEL="${3:-snapshot}"

if [[ -z "$AGENT_ID" ]] || [[ -z "$PIPELINE_ID" ]]; then
  echo "Usage: snapshot.sh <agent_id> <pipeline_id> [label]" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$(dirname "$(dirname "$SCRIPT_DIR")")")"
SNAPSHOT_DIR="$ROOT_DIR/tasks/snapshots/${PIPELINE_ID}/${AGENT_ID}"
TIMESTAMP=$(date -Iseconds)

mkdir -p "$SNAPSHOT_DIR"

WORKSPACE="$ROOT_DIR"

echo "[snapshot] $AGENT_ID: creating snapshot for pipeline=$PIPELINE_ID label=$LABEL"
echo "[snapshot] $AGENT_ID: snapshot_dir=$SNAPSHOT_DIR"

# ── Capture git state ──────────────────────────────────────────────────────────
GIT_COMMIT=$(git -C "$WORKSPACE" rev-parse HEAD 2>/dev/null || echo "unknown")
GIT_BRANCH=$(git -C "$WORKSPACE" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
GIT_STATUS=$(git -C "$WORKSPACE" status --porcelain 2>/dev/null | wc -l || echo "0")

cat > "$SNAPSHOT_DIR/git.commit" <<EOF
$GIT_COMMIT
EOF

cat > "$SNAPSHOT_DIR/git.info" <<EOF
{
  "commit": "$GIT_COMMIT",
  "branch": "$GIT_BRANCH",
  "label": "$LABEL",
  "timestamp": "$TIMESTAMP",
  "uncommitted_files": $GIT_STATUS
}
EOF

# ── Capture workspace state (src/) ───────────────────────────────────────────
if [[ -d "$WORKSPACE/src" ]]; then
  echo "[snapshot] $AGENT_ID: copying src/ → $SNAPSHOT_DIR/src.before/"
  rsync -a --delete \
    "$WORKSPACE/src/" \
    "$SNAPSHOT_DIR/src.before/" 2>/dev/null \
    || cp -r "$WORKSPACE/src" "$SNAPSHOT_DIR/src.before"
else
  echo "[snapshot] $AGENT_ID: WARNING: src/ not found, skipping"
fi

# ── Capture package state ─────────────────────────────────────────────────────
if [[ -f "$WORKSPACE/package.json" ]]; then
  cp "$WORKSPACE/package.json" "$SNAPSHOT_DIR/package.json"
fi

# ── Snapshot manifest ────────────────────────────────────────────────────────
cat > "$SNAPSHOT_DIR/manifest.json" <<EOF
{
  "agent_id": "$AGENT_ID",
  "pipeline_id": "$PIPELINE_ID",
  "label": "$LABEL",
  "timestamp": "$TIMESTAMP",
  "git_commit": "$GIT_COMMIT",
  "git_branch": "$GIT_BRANCH",
  "workspace": "$WORKSPACE",
  "src_snapshot": "$SNAPSHOT_DIR/src.before",
  "status": "created"
}
EOF

echo "[snapshot] $AGENT_ID: snapshot created successfully at $SNAPSHOT_DIR"
echo "[snapshot] $AGENT_ID: git_commit=$GIT_COMMIT"

# List snapshot contents
echo "[snapshot] $AGENT_ID: snapshot contents:"
ls -la "$SNAPSHOT_DIR/"

exit 0
