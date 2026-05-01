#!/bin/bash
# cleanup-vibe.sh — Log retention for vibe-kit
# Removes worker logs older than 7 days, rotates main logs, cleans empty dirs
# Usage: bash cleanup-vibe.sh [--dry-run]

set -euo pipefail

VIBE_DIR="${HOME}/.claude/vibe-kit"
LOG_DIR="${VIBE_DIR}/logs"
MAX_AGE_DAYS="${VIBE_LOG_RETENTION:-7}"
DRY_RUN="${1:-}"

echo "=== Vibe-kit Cleanup ==="
echo "Retention: ${MAX_AGE_DAYS} days"
echo "Log dir: ${LOG_DIR}"

# Dry run check
if [ "$DRY_RUN" = "--dry-run" ]; then
    echo "[DRY RUN] No changes will be made"
    DRY_RUN=echo
else
    DRY_RUN=""
fi

# Count before
before=$(find "$LOG_DIR" -type f 2>/dev/null | wc -l)
before_size=$(du -sh "$LOG_DIR" 2>/dev/null | cut -f1)

# 1. Remove worker logs older than MAX_AGE_DAYS
$DRY_RUN find "$LOG_DIR" -name "worker-*.log" -mtime "+${MAX_AGE_DAYS}" -delete 2>/dev/null || true
$DRY_RUN find "$LOG_DIR" -name "TEST-*.log" -mtime "+${MAX_AGE_DAYS}" -delete 2>/dev/null || true
$DRY_RUN find "$LOG_DIR" -name "AGENT-*.log" -mtime "+${MAX_AGE_DAYS}" -delete 2>/dev/null || true
$DRY_RUN find "$LOG_DIR" -name "SCRIPT-*.log" -mtime "+${MAX_AGE_DAYS}" -delete 2>/dev/null || true

# 2. Remove done markers older than 7 days
$DRY_RUN find "$LOG_DIR" -name "*-done" -mtime "+${MAX_AGE_DAYS}" -delete 2>/dev/null || true

# 3. Remove empty log files
$DRY_RUN find "$LOG_DIR" -type f -empty -mtime "+1" -delete 2>/dev/null || true

# 4. Remove empty directories
$DRY_RUN find "$LOG_DIR" -type d -empty -delete 2>/dev/null || true

# 5. Rotate main vibe-kit.log if larger than 10MB
if [ -f "${LOG_DIR}/vibe-kit.log" ]; then
    size=$(stat -c%s "${LOG_DIR}/vibe-kit.log" 2>/dev/null || echo 0)
    if [ "$size" -gt 10485760 ]; then
        $DRY_RUN mv "${LOG_DIR}/vibe-kit.log" "${LOG_DIR}/vibe-kit.$(date +%Y%m%d).log"
        $DRY_RUN touch "${LOG_DIR}/vibe-kit.log"
        echo "[ROTATE] vibe-kit.log rotated (was $(numfmt --to=iec-i --suffix=B $size))"
    fi
fi

# 6. Remove rotated logs older than 30 days
$DRY_RUN find "$LOG_DIR" -name "vibe-kit.2*.log" -mtime "+30" -delete 2>/dev/null || true

# Report
after=$(find "$LOG_DIR" -type f 2>/dev/null | wc -l)
after_size=$(du -sh "$LOG_DIR" 2>/dev/null | cut -f1)
echo "Files before: ${before} (${before_size})"
echo "Files after:  ${after} (${after_size})"
echo "Removed:      $((before - after)) files"
