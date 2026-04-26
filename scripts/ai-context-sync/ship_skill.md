#!/usr/bin/env bash
#===============================================================================
# Ship Skill — End-of-session sync pattern with AI Context Sync
#
# Pre-launch checklist + production deploy preparation
#
# Usage: /ship [options]
#   --no-sync        Skip AI context sync
#   --full-sync      Force full reindex
#   --dry-run        Show what would sync
#===============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MONOREPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SYNC_SCRIPT="$SCRIPT_DIR/ai-context-sync/ai-context-sync.sh"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log() { echo -e "${GREEN}[SHIP]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*" >&2; }
error() { echo -e "${RED}[ERROR]${NC} $*" >&2; }

# ═══════════════════════════════════════════════════════════════════════════════
# Pre-flight Checks
# ═══════════════════════════════════════════════════════════════════════════════

preflight() {
    log "Running pre-flight checks..."

    # Check for hardcoded secrets (basic)
    if grep -rE "(sk-[a-zA-Z0-9]{20,}|api_key\s*=\s*[\"'][^$]" "$MONOREPO_ROOT"/{apps,packages,scripts} --include="*.py" --include="*.ts" --include="*.js" 2>/dev/null | grep -v "node_modules" | head -5; then
        error "Hardcoded secrets detected!"
        return 1
    fi

    # Check git status
    if ! git -C "$MONOREPO_ROOT" status &>/dev/null; then
        error "Not a git repository"
        return 1
    fi

    log "Pre-flight checks passed"
    return 0
}

# ═══════════════════════════════════════════════════════════════════════════════
# AI Context Sync
# ═══════════════════════════════════════════════════════════════════════════════

run_sync() {
    local skip_sync="${1:-false}"
    local full_sync="${2:-false}"

    if [[ "$skip_sync" == "true" ]]; then
        warn "Skipping AI context sync (--no-sync)"
        return 0
    fi

    log "Running AI context delta sync..."

    if [[ ! -x "$SYNC_SCRIPT" ]]; then
        chmod +x "$SYNC_SCRIPT" 2>/dev/null || true
    fi

    if [[ -f "$SYNC_SCRIPT" ]]; then
        # Show dry-run first
        if [[ "$full_sync" == "true" ]]; then
            "$SYNC_SCRIPT" --full 2>&1 || warn "Sync had issues (non-fatal)"
        else
            "$SYNC_SCRIPT" 2>&1 || warn "Sync had issues (non-fatal)"
        fi
    else
        warn "AI Context Sync not found at $SYNC_SCRIPT"
    fi

    return 0
}

# ═══════════════════════════════════════════════════════════════════════════════
# Git Operations
# ═══════════════════════════════════════════════════════════════════════════════

git_commit_push() {
    log "Git operations..."

    cd "$MONOREPO_ROOT"

    # Check for changes
    if git diff --quiet && git diff --cached --quiet; then
        warn "No changes to commit"
        return 0
    fi

    # Stage all changes
    git add -A

    # Commit with timestamp
    local commit_msg
    commit_msg="chore: sync at $(date '+%Y-%m-%d %H:%M')"

    if git diff --cached --quiet; then
        warn "Nothing staged"
        return 0
    fi

    git commit -m "$commit_msg" --allow-empty

    # Push dual remotes
    local remote_branch
    remote_branch=$(git symbolic-ref --short HEAD 2>/dev/null || echo "main")

    log "Pushing to Gitea..."
    git push origin "$remote_branch" 2>&1 || warn "Gitea push failed"

    log "Pushing to GitHub..."
    git push github "$remote_branch" 2>&1 || warn "GitHub push failed (optional)"

    log "Git operations complete"
    return 0
}

# ═══════════════════════════════════════════════════════════════════════════════
# Main
# ═══════════════════════════════════════════════════════════════════════════════

usage() {
    cat <<EOF
Ship — End-of-session sync with AI Context Sync

Usage: /ship [options]

Options:
  --no-sync        Skip AI context sync
  --full-sync      Force full reindex before ship
  --dry-run        Show sync preview only
  -h, --help       Show this help

Examples:
  /ship                    Standard ship with delta sync
  /ship --no-sync          Ship without syncing
  /ship --full-sync        Force full reindex

EOF
}

main() {
    local skip_sync=false
    local full_sync=false
    local dry_run=false

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --no-sync) skip_sync=true ;;
            --full-sync) full_sync=true ;;
            --dry-run)
                dry_run=true
                ;;
            -h|--help) usage; exit 0 ;;
            *) warn "Unknown option: $1" ;;
        esac
        shift
    done

    echo ""
    echo -e "${CYAN}═══════════════════════════════════════${NC}"
    echo -e "${CYAN}  SHIP — AI Context Sync Workflow${NC}"
    echo -e "${CYAN}═══════════════════════════════════════${NC}"
    echo ""

    # Pre-flight
    if ! preflight; then
        error "Pre-flight checks failed"
        exit 1
    fi

    # AI Context Sync
    if [[ "$dry_run" == "true" ]]; then
        log "DRY RUN mode"
        if [[ -x "$SYNC_SCRIPT" ]]; then
            "$SYNC_SCRIPT" --dry-run
        fi
    else
        run_sync "$skip_sync" "$full_sync"
    fi

    # Git operations (skip in dry-run)
    if [[ "$dry_run" == "false" ]]; then
        git_commit_push
    fi

    echo ""
    echo -e "${GREEN}✓ Ship complete at $(date '+%Y-%m-%d %H:%M:%S')${NC}"
    echo ""
}

main "$@"
