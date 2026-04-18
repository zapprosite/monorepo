#!/usr/bin/env bash
# rollback.sh — Restore orchestrator agent state from snapshot
# Part of: SPEC-071-V4 (ROLLBACK ENGINE)
# Usage: bash rollback.sh --agent=<AGENT_ID> --to=<PIPELINE_ID> [--dry-run]
#        bash rollback.sh --list <PIPELINE_ID>
# Fallback: git revert if no snapshot found

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$(dirname "$(dirname "$SCRIPT_DIR")")")"
SNAPSHOT_BASE="$ROOT_DIR/tasks/snapshots"

AGENT_ID=""
PIPELINE_ID=""
DRY_RUN=""

# ── Parse arguments ───────────────────────────────────────────────────────────
parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --agent=*)
        AGENT_ID="${1#*=}"
        shift
        ;;
      --to=*)
        PIPELINE_ID="${1#*=}"
        shift
        ;;
      --dry-run)
        DRY_RUN="yes"
        shift
        ;;
      --list)
        list_snapshots "${2:-}"
        exit 0
        ;;
      --help|-h)
        usage
        exit 0
        ;;
      *)
        echo "Unknown option: $1" >&2
        usage
        exit 1
        ;;
    esac
  done
}

usage() {
  cat <<EOF
rollback.sh — Restore orchestrator agent state from snapshot

Usage:
  rollback.sh --agent=<AGENT_ID> --to=<PIPELINE_ID> [--dry-run]
  rollback.sh --list <PIPELINE_ID>

Options:
  --agent=<ID>     Agent to rollback (e.g. CODER-1)
  --to=<ID>        Pipeline ID to rollback to (e.g. SPEC-071)
  --dry-run        Show what would be done without executing
  --list <ID>      List available snapshots for a pipeline
  --help, -h       Show this help

Examples:
  rollback.sh --agent=CODER-1 --to=SPEC-071
  rollback.sh --agent=SPEC-ANALYZER --to=SPEC-071 --dry-run
  rollback.sh --list SPEC-071
EOF
}

# ── List snapshots for a pipeline ────────────────────────────────────────────
list_snapshots() {
  local pipeline_id="${1:-}"
  if [[ -z "$pipeline_id" ]]; then
    echo "Usage: rollback.sh --list <PIPELINE_ID>" >&2
    exit 1
  fi

  local snap_dir="$SNAPSHOT_BASE/$pipeline_id"
  if [[ ! -d "$snap_dir" ]]; then
    echo "No snapshots found for pipeline: $pipeline_id"
    echo "Available pipelines:"
    ls -d "$SNAPSHOT_BASE"/*/ 2>/dev/null || echo "  (none)"
    exit 0
  fi

  echo "Snapshots for pipeline: $pipeline_id"
  echo ""
  for agent_dir in "$snap_dir"/*/; do
    local agent
    agent=$(basename "$agent_dir")
    local manifest="$agent_dir/manifest.json"
    local git_info="$agent_dir/git.info"

    if [[ -f "$manifest" ]]; then
      local label timestamp git_commit
      label=$(python3 -c "import json; print(json.load(open('$manifest')).get('label','unknown'))" 2>/dev/null || echo "unknown")
      timestamp=$(python3 -c "import json; print(json.load(open('$manifest')).get('timestamp','unknown'))" 2>/dev/null || echo "unknown")
      git_commit=$(python3 -c "import json; print(json.load(open('$manifest')).get('git_commit','unknown')[:8])" 2>/dev/null || echo "unknown")
      echo "  [$agent] label=$label timestamp=$timestamp commit=$git_commit"
    elif [[ -f "$git_info" ]]; then
      local branch commit
      branch=$(python3 -c "import json; print(json.load(open('$git_info')).get('branch','unknown'))" 2>/dev/null || echo "unknown")
      commit=$(python3 -c "import json; print(json.load(open('$git_info')).get('commit','unknown')[:8])" 2>/dev/null || echo "unknown")
      echo "  [$agent] branch=$branch commit=$commit"
    else
      echo "  [$agent] (no manifest)"
    fi
  done
}

# ── Rollback ─────────────────────────────────────────────────────────────────
rollback_agent() {
  local agent="$1"
  local pipeline_id="$2"
  local snap_dir="$SNAPSHOT_BASE/$pipeline_id/$agent"
  local src_snapshot="$snap_dir/src.before"
  local git_commit_file="$snap_dir/git.commit"

  if [[ ! -d "$snap_dir" ]]; then
    echo "[rollback] ERROR: No snapshot found for agent=$agent in pipeline=$pipeline_id" >&2
    echo "[rollback] Available: $SNAPSHOT_BASE/$pipeline_id/" >&2
    return 1
  fi

  if [[ ! -d "$src_snapshot" ]]; then
    echo "[rollback] WARNING: src.before/ not found in snapshot, trying git fallback" >&2
    if [[ -f "$git_commit_file" ]]; then
      local git_commit
      git_commit=$(cat "$git_commit_file")
      echo "[rollback] $agent: reverting to git commit $git_commit"
      if [[ -n "$DRY_RUN" ]]; then
        echo "[rollback] $agent: git -C $ROOT_DIR checkout $git_commit (dry-run)"
      else
        git -C "$ROOT_DIR" checkout "$git_commit"
        echo "[rollback] $agent: git reverted to $git_commit"
      fi
    else
      echo "[rollback] ERROR: No src.before/ and no git.commit file" >&2
      return 1
    fi
    return 0
  fi

  local git_commit
  git_commit=$(cat "$git_commit_file" 2>/dev/null || echo "unknown")

  echo "[rollback] $agent: pipeline=$pipeline_id"
  echo "[rollback] $agent: snapshot_dir=$snap_dir"
  echo "[rollback] $agent: git_commit=$git_commit"
  echo "[rollback] $agent: restoring src from snapshot..."

  if [[ -n "$DRY_RUN" ]]; then
    echo "[rollback] $agent: rsync -a --delete $src_snapshot/ $ROOT_DIR/src/ (dry-run)"
    echo "[rollback] $agent: git -C $ROOT_DIR checkout $git_commit (dry-run)"
  else
    # Restore src from snapshot
    if [[ -d "$ROOT_DIR/src" ]]; then
      rsync -a --delete "$src_snapshot/" "$ROOT_DIR/src/"
    else
      mkdir -p "$ROOT_DIR/src"
      rsync -a "$src_snapshot/" "$ROOT_DIR/src/"
    fi

    # Restore git state
    git -C "$ROOT_DIR" checkout "$git_commit"

    echo "[rollback] $agent: rollback complete"
  fi

  return 0
}

# ── Main ─────────────────────────────────────────────────────────────────────
parse_args "$@"

if [[ -z "$AGENT_ID" ]] || [[ -z "$PIPELINE_ID" ]]; then
  echo "ERROR: --agent and --to are required" >&2
  usage
  exit 1
fi

echo "=== ROLLBACK ENGINE ==="
echo "Agent: $AGENT_ID"
echo "Pipeline: $PIPELINE_ID"
echo "Dry-run: ${DRY_RUN:-no}"
echo ""

rollback_agent "$AGENT_ID" "$PIPELINE_ID"
exit $?
