#!/bin/bash
# nexus-redis-stats.sh — Redis metrics (sessions, cache)
# Run: */8 * * * *

set -euo pipefail

REDIS_HOST="${REDIS_HOST:-localhost}"
REDIS_PORT="${REDIS_PORT:-6379}"
REDIS_PASS="${REDIS_PASSWORD:-}"
LOG="/srv/logs/redis-metrics.log"

timestamp() { date '+%Y-%m-%d %H:%M:%S'; }

# Redis INFO via redis-cli
redis_info=$(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" -a "$REDIS_PASS" INFO stats 2>/dev/null || echo "")

# Key counts
keys=$(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" -a "$REDIS_PASS" DBSIZE 2>/dev/null | grep -E '^[0-9]+$' || echo "0")

# Memory usage
used_memory=$(echo "$redis_info" | grep -E '^used_memory_human:' | cut -d: -f2 | tr -d '\r' || echo "unknown")
connected_clients=$(echo "$redis_info" | grep -E '^connected_clients:' | cut -d: -f2 | tr -d '\r' || echo "0")
total_commands=$(echo "$redis_info" | grep -E '^total_commands_processed:' | cut -d: -f2 | tr -d '\r' || echo "0")
keyspace_hits=$(echo "$redis_info" | grep -E '^keyspace_hits:' | cut -d: -f2 | tr -d '\r' || echo "0")
keyspace_misses=$(echo "$redis_info" | grep -E '^keyspace_misses:' | cut -d: -f2 | tr -d '\r' || echo "0")

# Hit rate calc
if [ "$keyspace_hits" != "0" ] && [ "$keyspace_misses" != "0" ]; then
    total=$((keyspace_hits + keyspace_misses))
    hit_rate=$(( keyspace_hits * 100 / total ))
else
    hit_rate=0
fi

# Log
echo "$(timestamp) keys=$keys used_memory=$used_memory clients=$connected_clients commands=$total_commands hit_rate=${hit_rate}%" >> "$LOG"

# Rotate
tail -n 1000 "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"

exit 0
