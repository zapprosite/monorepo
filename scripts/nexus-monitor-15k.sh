#!/bin/bash
# nexus-monitor-15k.sh — Monitor 15k requests / 5h

set -euo pipefail

MONOREPO="/srv/monorepo"
STATE="/tmp/nexus-15k-state.json"

# 15,000 requests / 5 hours = 50 RPM sustained
# 5 hours = 300 minutes
SUSTAINED_RPM=50
BURST_RPM=500

init() {
  if [ ! -f "$STATE" ]; then
    echo '{"count":0,"start_time":"'$(date +%s)'","rpm":0}' > "$STATE"
  fi
}

record_request() {
  init
  count=$(jq -r '.count' "$STATE")
  count=$((count + 1))
  jq '.count = '$count'' "$STATE" > /tmp/s.tmp && mv /tmp/s.tmp "$STATE"
}

get_stats() {
  init
  count=$(jq -r '.count' "$STATE")
  start=$(jq -r '.start_time' "$STATE")
  now=$(date +%s)
  elapsed=$((now - start))
  minutes=$((elapsed / 60))

  if [ "$minutes" -gt 0 ]; then
    rpm=$((count / minutes))
  else
    rpm=0
  fi

  remaining=$((15000 - count))
  time_remaining=$((300 - minutes))

  echo "=== 15k/5h Monitor ==="
  echo "Requests: $count / 15000"
  echo "RPM atual: $rpm (alvo: $SUSTAINED_RPM)"
  echo "Tempo: ${minutes}min / 300min"
  echo "Restante: $remaining req em ${time_remaining}min"

  if [ "$rpm" -gt "$SUSTAINED_RPM" ]; then
    echo "✅ Dentro do ritmo"
  else
    echo "⚠️ Abaixo do ritmo - acelerar"
  fi
}

reset() {
  rm -f "$STATE"
  echo "Monitor resetado"
}

case "${1:-stats}" in
  stats) get_stats ;;
  record) record_request ;;
  reset) reset ;;
  *)
    echo "Usage: $0 {stats|record|reset}"
    ;;
esac