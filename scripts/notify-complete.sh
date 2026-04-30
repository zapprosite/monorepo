#!/bin/bash
# notify-complete.sh — Email notification on loop complete
# Usage: notify-complete.sh [exit_code] [stats_json]
set -euo pipefail

RECIPIENT="${NOTIFY_EMAIL:-zappro.ia@gmail.com}"
SUBJECT_PREFIX="${NOTIFY_PREFIX:-[VIBE]}"
EXIT_CODE="${1:-0}"
STATS="${2:-}"

HOSTNAME=$(hostname)
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)

if [ $EXIT_CODE -eq 0 ]; then
    SUBJECT="$SUBJECT_PREFIX Loop complete — $HOSTNAME — $TIMESTAMP"
    BODY="Autonomous loop finished successfully.

Host: $HOSTNAME
Time: $TIMESTAMP
Exit code: $EXIT_CODE

Stats:
$STATS

—
VIBE Autonomous Pipeline"
else
    SUBJECT="$SUBJECT_PREFIX Loop FAILED — $HOSTNAME — $TIMESTAMP"
    BODY="Autonomous loop encountered failures.

Host: $HOSTNAME
Time: $TIMESTAMP
Exit code: $EXIT_CODE

Stats:
$STATS

—
VIBE Autonomous Pipeline"
fi

# Send email (requires mailutils or sendmail)
if command -v mail >/dev/null 2>&1; then
    echo "$BODY" | mail -s "$SUBJECT" "$RECIPIENT"
elif command -v sendmail >/dev/null 2>&1; then
    echo "$BODY" | sendmail -t "$RECIPIENT"
else
    # Fallback: log only
    echo "[notify] Would send email to $RECIPIENT: $SUBJECT" >&2
    echo "$BODY" >&2
fi

exit 0