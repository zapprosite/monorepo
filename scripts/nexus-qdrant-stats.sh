#!/bin/bash
# nexus-qdrant-stats.sh — Qdrant metrics (Gen5 NVMe)
# Run: */8 * * * *

set -euo pipefail

source /srv/monorepo/.env
QDRANT_URL="${QDRANT_URL:-http://localhost:6333}"
QDRANT_KEY="${QDRANT_API_KEY:-}"
LOG="/srv/logs/qdrant-metrics.log"

timestamp() { date '+%Y-%m-%d %H:%M:%S'; }

# Collections count
collections=$(curl -s -H "api-key: $QDRANT_KEY" "$QDRANT_URL/collections" 2>/dev/null | \
    jq '.result.collections | length' 2>/dev/null || echo "0")

# Vector count per collection (using points_count)
vector_data=$(curl -s -H "api-key: $QDRANT_KEY" "$QDRANT_URL/collections" 2>/dev/null | \
    jq -r '.result.collections[].name' 2>/dev/null | while read col; do
        count=$(curl -s -H "api-key: $QDRANT_KEY" "$QDRANT_URL/collections/$col" 2>/dev/null | \
            jq '.result.points_count' 2>/dev/null || echo "0")
        echo "$col=$count"
    done | tr '\n' ' ')

# API latency test
start=$(date +%s%3N)
curl -s -H "api-key: $QDRANT_KEY" "$QDRANT_URL/collections" -o /dev/null
latency=$(( $(date +%s%3N) - start ))

# Log
echo "$(timestamp) collections=$collections latency_ms=$latency vectors=$vector_data" >> "$LOG"

# Rotate (keep last 1000 lines)
tail -n 1000 "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"

exit 0
