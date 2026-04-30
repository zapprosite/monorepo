#!/bin/bash
# nexus-rate-limiter.sh — Token bucket 500 RPM

set -euo pipefail

MAX_RPM=500
REFILL_RATE=500
BURST_WINDOW=60  # seconds

# State file and lock file (separate to avoid lock conflicts)
STATE="/tmp/nexus-rate-state.json"
LOCK_FILE="/tmp/nexus-rate-state.lock"

# Lock acquisition with timeout (5s max)
acquire_lock() {
  exec 200>"$LOCK_FILE"
  flock -w 5 200 || { echo "Failed to acquire lock"; exit 1; }
}

release_lock() {
  flock -u 200
}

with_lock() {
  acquire_lock
  trap release_lock EXIT
  "$@"
}

init_bucket() {
  if [ ! -f "$STATE" ]; then
    echo '{"tokens":'$MAX_RPM',"last_refill":"'$(date +%s)'"}' > "$STATE"
  fi
}

refill() {
  now=$(date +%s)
  last=$(jq -r '.last_refill' "$STATE")
  elapsed=$((now - last))

  # Refill based on time elapsed
  tokens_to_add=$((elapsed * REFILL_RATE / 60))

  if [ "$tokens_to_add" -gt 0 ]; then
    current=$(jq -r '.tokens' "$STATE")
    new_tokens=$((current + tokens_to_add))
    if [ "$new_tokens" -gt "$MAX_RPM" ]; then
      new_tokens=$MAX_RPM
    fi
    echo '{"tokens":'$new_tokens',"last_refill":'$now'}' > "$STATE"
  fi
}

acquire() {
  with_lock _acquire
}

_acquire() {
  init_bucket
  refill

  tokens=$(jq -r '.tokens' "$STATE")

  if [ "$tokens" -gt 0 ]; then
    new_tokens=$((tokens - 1))
    jq '.tokens = '$new_tokens'' "$STATE" > /tmp/state.tmp && mv /tmp/state.tmp "$STATE"
    return 0  # allowed
  else
    return 1  # rate limited
  fi
}

# Usage: nexus-rate-limiter.sh acquire
if [ "${1:-}" = "acquire" ]; then
  if acquire; then
    exit 0
  else
    echo "Rate limited"
    exit 1
  fi
fi

# Usage: nexus-rate-limiter.sh wait
if [ "${1:-}" = "wait" ]; then
  while ! acquire; do
    sleep 0.1
  done
  exit 0
fi

echo "Usage: $0 {acquire|wait}"
