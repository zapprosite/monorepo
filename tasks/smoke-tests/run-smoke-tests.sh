#!/bin/bash
# Smoke Test Runner — Simulates pipelines with errors/conflicts
# Generates results for review

set -e

DIR="$(dirname "$0")"
RESULTS_DIR="$DIR/results"
mkdir -p "$RESULTS_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Simulated results — pipeline errors and conflicts
# Real execution would run actual commands

echo "=== Smoke Test Runner ==="
echo "Timestamp: $TIMESTAMP"
echo ""

run_pipeline() {
    local pipeline=$1
    local name=$(basename "$pipeline" .yaml)
    local result_file="$RESULTS_DIR/${name}.json"

    echo "Running: $name"
    echo "---"

    # Simulate different outcomes
    case $name in
        pipeline-whisper-gpu)
            # SUCCESS — all green
            cat > "$result_file" << 'EOF'
{
  "pipeline": "pipeline-whisper-gpu",
  "status": "PASS",
  "timestamp": "2026-04-07T18:30:00Z",
  "results": [
    {"id": "WT-001", "status": "PASS", "output": "18432"},
    {"id": "WT-002", "status": "PASS", "output": "Up"},
    {"id": "WT-003", "status": "PASS", "output": "200"},
    {"id": "WT-004", "status": "PASS", "output": "1"},
    {"id": "WT-005", "status": "PASS", "output": "/srv/data/whisper-models:/app/models"}
  ],
  "summary": {"passed": 5, "failed": 0, "warnings": 0}
}
EOF
            echo "  Result: PASS (5/5 tests)"
            ;;

        pipeline-alerting)
            # CONFLICT — AL-005 timeout (warning, non-critical)
            cat > "$result_file" << 'EOF'
{
  "pipeline": "pipeline-alerting",
  "status": "CONFLICT",
  "timestamp": "2026-04-07T18:31:00Z",
  "results": [
    {"id": "AL-001", "status": "PASS", "output": "Up"},
    {"id": "AL-002", "status": "PASS", "output": "200"},
    {"id": "AL-003", "status": "PASS", "output": "true"},
    {"id": "AL-004", "status": "PASS", "output": "{\"ok\": true}"},
    {"id": "AL-005", "status": "WARN", "output": "Connection timeout after 2s", "expected": "200", "actual": "timeout"}
  ],
  "summary": {"passed": 4, "failed": 0, "warnings": 1},
  "issues": [
    {
      "severity": "WARNING",
      "id": "AL-005",
      "type": "CONFLICT",
      "description": "AlertManager config reload endpoint unreachable (timeout)",
      "impact": "Non-critical — AlertManager will reload on next container restart",
      "fix": "Check if port 9093 is exposed and firewall allows localhost access"
    }
  ]
}
EOF
            echo "  Result: CONFLICT (4 passed, 1 warning)"
            echo "  ⚠️  AL-005: AlertManager reload timeout"
            ;;

        pipeline-dns)
            # ERROR — DNS-002 wrong IP
            cat > "$result_file" << 'EOF'
{
  "pipeline": "pipeline-dns",
  "status": "FAIL",
  "timestamp": "2026-04-07T18:32:00Z",
  "results": [
    {"id": "DNS-001", "status": "PASS", "output": "Up"},
    {"id": "DNS-002", "status": "FAIL", "output": "10.0.1.10", "expected": "10.0.1.5", "actual": "10.0.1.10"},
    {"id": "DNS-003", "status": "PASS", "output": "3"},
    {"id": "DNS-004", "status": "PASS", "output": "open"}
  ],
  "summary": {"passed": 3, "failed": 1, "warnings": 0},
  "issues": [
    {
      "severity": "CRITICAL",
      "id": "DNS-002",
      "type": "ERROR",
      "description": "DNS resolution returns wrong IP for qdrant",
      "impact": "Services cannot reach qdrant — vector search broken",
      "fix": "Update Corefile forward rule: forward . 10.0.1.5"
    }
  ]
}
EOF
            echo "  Result: FAIL (3 passed, 1 failed)"
            echo "  ❌ DNS-002: Wrong IP for qdrant (expected 10.0.1.5, got 10.0.1.10)"
            ;;
    esac

    echo ""
}

# Run all pipelines
for pipeline in "$DIR"/*.yaml; do
    if [ -f "$pipeline" ]; then
        run_pipeline "$pipeline"
    fi
done

# Generate summary
echo "=== Summary ==="
echo "pipeline-whisper-gpu: PASS"
echo "pipeline-alerting:    CONFLICT (1 warning)"
echo "pipeline-dns:         FAIL (1 critical error)"
echo ""
echo "Full results in: $RESULTS_DIR/"
