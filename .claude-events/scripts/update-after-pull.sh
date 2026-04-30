#!/bin/bash
# update-after-pull.sh - Sync event system config files after git pull
# Usage: ./update-after-pull.sh
#
# Run this script after `git pull` to sync .claude-events/ changes:
#   - Recreates symlinks if config files changed
#   - Reloads systemd user daemon if unit files changed
#   - Shows what changed

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MONOREPO_EVENTS_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
MONOREPO_ROOT="$(cd "$MONOREPO_EVENTS_DIR/../.." && pwd)"
PREVIOUS_HEAD=""

echo "=== Checking for .claude-events/ updates ==="

# Check if we're in a git repository
if [[ ! -d "$MONOREPO_ROOT/.git" ]]; then
    echo "Not a git repository, skipping update check"
    exit 0
fi

cd "$MONOREPO_ROOT"

# Fetch latest refs (silent)
git fetch --quiet 2>/dev/null || true

# Get the previous HEAD before pull (if we can determine it)
# This works when run from post-merge hook - HEAD^1 is the commit we merged
if git rev-parse --verify HEAD^1 >/dev/null 2>&1; then
    PREVIOUS_HEAD="$(git rev-parse HEAD^1)"
else
    # Running manually - check against origin/master or similar
    CURRENT_BRANCH=$(git symbolic-ref --short HEAD 2>/dev/null || echo "HEAD")
    TRACKING_BRANCH=$(git config "branch.${CURRENT_BRANCH}.merge" 2>/dev/null | sed 's|refs/heads/||')
    if [[ -n "$TRACKING_BRANCH" ]]; then
        TRACKING_REMOTE=$(git config "branch.${CURRENT_BRANCH}.remote" 2>/dev/null || echo "origin")
        REMOTE_HEAD="${TRACKING_REMOTE}/${TRACKING_BRANCH}"
        if git rev-parse --verify "$REMOTE_HEAD" >/dev/null 2>&1; then
            PREVIOUS_HEAD="$(git rev-parse "$REMOTE_HEAD")"
        fi
    fi
fi

# Check if there are changes in .claude-events/
has_events_changes=false
has_systemd_changes=false
changed_files=""

if [[ -n "$PREVIOUS_HEAD" ]]; then
    # Get list of changed files in .claude-events/
    changed_files=$(git diff --name-only "$PREVIOUS_HEAD" HEAD -- .claude-events/ 2>/dev/null || true)

    if [[ -n "$changed_files" ]]; then
        has_events_changes=true
        echo "Changed files in .claude-events/:"
        echo "$changed_files" | while read -r file; do
            echo "  - $file"
        done

        # Check specifically for systemd unit changes
        if echo "$changed_files" | grep -q "^.claude-events/systemd/"; then
            has_systemd_changes=true
        fi
    fi
else
    # Fallback: check if any .claude-events files are modified in working tree
    if git diff --name-only -- .claude-events/ 2>/dev/null | grep -q .; then
        has_events_changes=true
        changed_files=$(git diff --name-only -- .claude-events/)
        echo "Modified files in .claude-events/ (working tree):"
        echo "$changed_files" | while read -r file; do
            echo "  - $file"
        done

        if echo "$changed_files" | grep -q "^.claude-events/systemd/"; then
            has_systemd_changes=true
        fi
    fi
fi

if [[ "$has_events_changes" != "true" ]]; then
    echo "No changes detected in .claude-events/"
    exit 0
fi

echo ""
echo "=== Running install-links.sh ==="
if "$SCRIPT_DIR/install-links.sh"; then
    echo "Symlinks updated successfully"
else
    echo "Warning: install-links.sh failed" >&2
fi

if [[ "$has_systemd_changes" == "true" ]]; then
    echo ""
    echo "=== Systemd units changed, reloading user daemon ==="
    if systemctl --user daemon-reload 2>/dev/null; then
        echo "User daemon reloaded"

        # Show which units changed
        echo "Systemd units modified:"
        echo "$changed_files" | grep "^.claude-events/systemd/" | while read -r file; do
            unit=$(basename "$file")
            echo "  - $unit"
        done
    else
        echo "Warning: systemctl --user daemon-reload failed (may need to run manually)" >&2
    fi
fi

echo ""
echo "=== Summary of changes ==="
echo "$changed_files" | while read -r file; do
    if [[ -n "$file" ]]; then
        echo "  $file"
    fi
done

echo ""
echo "Update complete."
