#!/bin/bash
# nexus-hermes-stats.sh — Hermes/Mem0 metrics
# Run: */8 * * * *

set -euo pipefail

HERMES_URL="${HERMES_GATEWAY_URL:-http://localhost:8642}"
QDRANT_KEY="${QDRANT_API_KEY:-}"
LOG="/srv/logs/hermes-metrics.log"

timestamp() { date '+%Y-%m-%d %H:%M:%S'; }

# Hermes health
health=$(curl -s "$HERMES_URL/health" 2>/dev/null | jq -r '.status' 2>/dev/null || echo "unknown")

# API latency
start=$(date +%s%3N)
curl -s "$HERMES_URL/health" -o /dev/null
latency=$(( $(date +%s%3N) - start ))

# Mem0 collections
mem0_collections=$(curl -s -H "api-key: $QDRANT_KEY" http://localhost:6333/collections 2>/dev/null | \
    jq '.result.collections | length' 2>/dev/null || echo "0")

# Log
echo "$(timestamp) health=$health latency_ms=$latency mem0_collections=$mem0_collections" >> "$LOG"

# Rotate
tail -n 1000 "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"

exit 0
