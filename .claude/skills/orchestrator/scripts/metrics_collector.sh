#!/usr/bin/env bash
# metrics_collector.sh — Prometheus metrics exporter for orchestrator pipeline
# Part of: SPEC-071-V3 (OBSERVABILITY LAYER)
# Exposes: pipeline_duration_seconds, agent_errors_total, llm_tokens_total, pipeline_runs_total
# Usage: bash metrics_collector.sh [scrape|record <metric> <value>|report]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$(dirname "$(dirname "$SCRIPT_DIR")")")"
METRICS_DIR="$ROOT_DIR/.claude/skills/orchestrator/metrics"
mkdir -p "$METRICS_DIR"

METRICS_FILE="$METRICS_DIR/registry.prom"
PIPELINE_ID="${PIPELINE_ID:-default}"
TRACE_ID="${TRACELINE_TRACE_ID:-$(bash "$SCRIPT_DIR/trace_id.sh" get "$PIPELINE_ID")}"

# ── Metric definitions ─────────────────────────────────────────────────────────
# Format: metric_name:type:help

init_metrics() {
  cat > "$METRICS_FILE" << 'HEADER'
# HELP pipeline_runs_total Total number of pipeline runs
# TYPE pipeline_runs_total counter
pipeline_runs_total{pipeline=""} 0

# HELP pipeline_duration_seconds Duration of pipeline runs in seconds
# TYPE pipeline_duration_seconds gauge
pipeline_duration_seconds{pipeline="",status=""} 0

# HELP agent_errors_total Total number of agent errors by agent and exit code
# TYPE agent_errors_total counter
agent_errors_total{agent="",exit_code=""} 0

# HELP agent_duration_seconds Duration of agent execution in seconds
# TYPE agent_duration_seconds gauge
agent_duration_seconds{agent="",status=""} 0

# HELP llm_tokens_total Total LLM tokens consumed (estimated)
# TYPE llm_tokens_total counter
llm_tokens_total{pipeline="",model=""} 0

# HELP pipeline_queue_depth Number of pending tasks in pipeline
# TYPE pipeline_queue_depth gauge
pipeline_queue_depth{pipeline=""} 0

HEADER
}

# ── Record a metric ─────────────────────────────────────────────────────────────
record() {
  local METRIC="$1"
  local VALUE="$2"
  local LABELS="$3"  # e.g., 'pipeline="spec-071",status="success"'

  case "$METRIC" in
    pipeline_runs_total)
      python3 -c "
import re
with open('$METRICS_FILE') as f:
    content = f.read()
pattern = r'(pipeline_runs_total\{[^}]*\})\s+[\d.]+'
replacement = f'pipeline_runs_total{{{LABELS}}} {VALUE}'
if re.search(pattern, content):
    content = re.sub(pattern, replacement, content)
else:
    content += f'pipeline_runs_total{{{LABELS}}} {VALUE}\n'
with open('$METRICS_FILE', 'w') as f:
    f.write(content)
"
      ;;

    pipeline_duration_seconds)
      python3 -c "
import re
with open('$METRICS_FILE') as f:
    content = f.read()
# Remove old entry for same pipeline+status
pattern = r'pipeline_duration_seconds\{[^}]*pipeline=\"$PIPELINE_ID\"[^}]*,[^}]*\}\s+[\d.]+'
content = re.sub(pattern, '', content)
content += f'pipeline_duration_seconds{{{LABELS},pipeline=\"$PIPELINE_ID\"}} {VALUE}\n'
with open('$METRICS_FILE', 'w') as f:
    f.write(content)
"
      ;;

    agent_errors_total)
      python3 -c "
import re
with open('$METRICS_FILE') as f:
    content = f.read()
# Remove old entry for same agent+exit_code
pattern = r'agent_errors_total\{[^}]*agent=\"$2\"[^}]*,[^}]*\}\s+[\d.]+'
content = re.sub(pattern, '', content)
content += f'agent_errors_total{{{LABELS}}} {VALUE}\n'
with open('$METRICS_FILE', 'w') as f:
    f.write(content)
"
      ;;

    llm_tokens_total)
      python3 -c "
import re
with open('$METRICS_FILE') as f:
    content = f.read()
content += f'llm_tokens_total{{{LABELS}}} {VALUE}\n'
with open('$METRICS_FILE', 'w') as f:
    f.write(content)
"
      ;;
  esac
}

# ── Scrape (output Prometheus format) ─────────────────────────────────────────
scrape() {
  if [[ ! -f "$METRICS_FILE" ]]; then
    init_metrics
  fi

  # Enrich with current trace and pipeline labels
  python3 -c "
import re
with open('$METRICS_FILE') as f:
    content = f.read()
# Add trace_id label to all metrics that support it
for line in content.split('\n'):
    if line and not line.startswith('#') and 'trace_id=' not in line:
        # Add trace_id label
        line = line.replace('{', '{trace_id=\"$TRACE_ID\",')
        print(line)
    elif line:
        print(line)
"
}

# ── Main ────────────────────────────────────────────────────────────────────────
ACTION="${1:-scrape}"

case "$ACTION" in
  scrape|report)
    scrape
    ;;
  record)
    METRIC="$2"
    VALUE="$3"
    LABELS="${4:-}"
    if [[ -z "$METRIC" ]] || [[ -z "$VALUE" ]]; then
      echo "Usage: metrics_collector.sh record <metric> <value> [labels]" >&2
      exit 1
    fi
    record "$METRIC" "$VALUE" "$LABELS"
    ;;
  init)
    init_metrics
    echo "Metrics initialized at $METRICS_FILE"
    ;;
  *)
    echo "Usage: metrics_collector.sh [scrape|report|record|init]" >&2
    exit 1
    ;;
esac
