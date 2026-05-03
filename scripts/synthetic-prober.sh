#!/usr/bin/env bash
# =============================================================================
# synthetic-prober.sh — HTTP probe for all 13 zappro.site subdomains
# =============================================================================
# SPEC-210 Phase 3: Synthetic monitoring via Prometheus textfile collector
#
# Usage:
#   bash synthetic-prober.sh [--metrics /var/lib/node_exporter/textfile_collector]
#
# Output: Prometheus textfile metrics format
#   synthetic_probe_success{service="..."} 1|0
#   synthetic_probe_duration_seconds{service="..."} X.XXX
#
# Cron: */5 * * * * bash /srv/monorepo/scripts/synthetic-prober.sh
#
set -euo pipefail

METRICS_DIR="${1:-/tmp}"
METRICS_FILE="${METRICS_DIR}/synthetic-prober.prom"
TMP_FILE="${METRICS_FILE}.$$"

TIMEOUT=5

SERVICES=(
  # SERVICE | URL | TIER
  "gitea|https://git.zappro.site|critical"
  "coolify|https://coolify.zappro.site|critical"
  "qdrant|http://localhost:6333/health|critical"
  "ollama|http://localhost:11434/api/tags|critical"
  "litellm|https://llm.zappro.site/health|critical"
  "hermes-gateway|http://localhost:8642/health|critical"
  "openwebui|https://chat.zappro.site|standard"
  "keycloak|https://auth.zappro.site|standard"
  "grafana|https://grafana.zappro.site/api/health|standard"
  "prometheus|http://localhost:9090/api/v1/status/buildinfo|standard"
  "alertmanager|http://localhost:9093/api/v2/status|standard"
  "pgadmin4|https://pgadmin.zappro.site|standard"
  "searxng|https://searxng.zappro.site|standard"
)

probe_service() {
  local name="$1" url="$2" tier="$3"
  local code start end duration success

  start=$(date +%s%N)
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time "$TIMEOUT" "$url" 2>/dev/null || echo "000")
  end=$(date +%s%N)
  duration=$(echo "scale=3; ($end - $start) / 1000000000" | bc 2>/dev/null || echo "0")

  if [[ "$code" =~ ^(200|301|302|307|401|403)$ ]]; then
    success=1
  else
    success=0
  fi

  echo "synthetic_probe_success{service=\"$name\",tier=\"$tier\"} $success"
  echo "synthetic_probe_duration_seconds{service=\"$name\",tier=\"$tier\"} $duration"
  echo "synthetic_probe_http_code{service=\"$name\",tier=\"$tier\"} ${code#0}"
}

{
  echo "# HELP synthetic_probe_success HTTP probe success (1=ok, 0=fail)"
  echo "# TYPE synthetic_probe_success gauge"
  echo "# HELP synthetic_probe_duration_seconds HTTP probe duration"
  echo "# TYPE synthetic_probe_duration_seconds gauge"
  echo "# HELP synthetic_probe_http_code HTTP status code"
  echo "# TYPE synthetic_probe_http_code gauge"

  for svc_line in "${SERVICES[@]}"; do
    IFS='|' read -r name url tier <<<"$svc_line"
    probe_service "$name" "$url" "$tier"
  done
} > "$TMP_FILE"

mv "$TMP_FILE" "$METRICS_FILE"
echo "Synthetic prober: metrics written to $METRICS_FILE"
