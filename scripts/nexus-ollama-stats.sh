#!/bin/bash
# nexus-ollama-stats.sh — Ollama metrics (Gen5 NVMe)
# Run: */8 * * * *

set -euo pipefail

OLLAMA_URL="${OLLAMA_URL:-http://localhost:11434}"
LOG="/srv/logs/ollama-metrics.log"

timestamp() { date '+%Y-%m-%d %H:%M:%S'; }

# Models loaded
models=$(curl -s "$OLLAMA_URL/api/tags" 2>/dev/null | \
    jq '.models | length' 2>/dev/null || echo "0")

# Model list
model_list=$(curl -s "$OLLAMA_URL/api/tags" 2>/dev/null | \
    jq -r '.models[].name' 2>/dev/null | tr '\n' ',')

# Active requests
active=$(curl -s "$OLLAMA_URL/api/ps" 2>/dev/null | \
    jq '.models | length' 2>/dev/null || echo "0")

# API latency test (simple ping)
start=$(date +%s%3N)
curl -s "$OLLAMA_URL/api/tags" -o /dev/null
latency=$(( $(date +%s%3N) - start ))

# Log
echo "$(timestamp) models=$models active=$active latency_ms=$latency model_list=$model_list" >> "$LOG"

# Rotate
tail -n 1000 "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"

exit 0
