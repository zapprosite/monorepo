#!/usr/bin/env bash
# capacity_calculator.sh — Calculate available resources for orchestrator agents
# Part of: SPEC-071-V5 (CAPACITY PLANNER)
# Usage: bash capacity_calculator.sh [--json]

OUTPUT_JSON=""
if [[ "${1:-}" == "--json" ]]; then
  OUTPUT_JSON="yes"
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$(dirname "$(dirname "$SCRIPT_DIR")")")"

# ── RAM ───────────────────────────────────────────────────────────────────────
RAM_TOTAL_KB=$(grep MemTotal /proc/meminfo | awk '{print $2}')
RAM_AVAILABLE_KB=$(grep MemAvailable /proc/meminfo | awk '{print $2}' || echo "$RAM_TOTAL_KB")
RAM_TOTAL_GB=$(echo "scale=1; $RAM_TOTAL_KB / 1024 / 1024" | bc)
RAM_AVAILABLE_GB=$(echo "scale=1; $RAM_AVAILABLE_KB / 1024 / 1024" | bc)
RAM_FREE_PCT=$(echo "scale=1; ($RAM_AVAILABLE_KB * 100 / $RAM_TOTAL_KB)" | bc)

# ── CPU ──────────────────────────────────────────────────────────────────────
CPU_CORES=$(nproc 2>/dev/null || echo "4")
CPU_MODEL=$(grep "model name" /proc/cpuinfo | head -1 | awk -F: '{print $2}' | sed 's/^ //' || echo "unknown")

LOAD=$(uptime | sed 's/.*load average://' | awk '{print $1}' | tr -d ',' | tr -d ' ')
LOAD_1="${LOAD:-0}"

CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d. -f1 || echo "0")
CPU_USAGE="${CPU_USAGE:-0}"

# ── Capacity ─────────────────────────────────────────────────────────────────
RAM_PER_AGENT_KB=4194304  # 4GB
MAX_AGENTS_RAM=${RAM_AVAILABLE_KB}
MAX_AGENTS_RAM=$((MAX_AGENTS_RAM / RAM_PER_AGENT_KB))
MAX_PARALLEL_CPU=$((CPU_CORES > 2 ? CPU_CORES - 1 : 1))
MAX_PARALLEL=$((MAX_AGENTS_RAM < MAX_PARALLEL_CPU ? MAX_AGENTS_RAM : MAX_PARALLEL_CPU))
MAX_PARALLEL=${MAX_PARALLEL:-1}

# ── Orchestrator load ────────────────────────────────────────────────────────
ORCH_COUNT=0
for pid in $(pgrep -f "agent-wrapper.sh" 2>/dev/null); do
  if [[ -d "/proc/$pid" ]]; then
    cmdline=$(cat "/proc/$pid/cmdline" 2>/dev/null | tr '\0' ' ' || echo "")
    if echo "$cmdline" | grep -q "agent-wrapper"; then
      ORCH_COUNT=$((ORCH_COUNT + 1))
    fi
  fi
done

# ── Warnings ─────────────────────────────────────────────────────────────────
WARNINGS=""
RAM_FREE_INT=$(echo "$RAM_FREE_PCT" | cut -d. -f1 || echo "0")
if [[ -n "$RAM_FREE_INT" ]] && [[ "$RAM_FREE_INT" -lt 20 ]]; then
  WARNINGS="${WARNINGS}LOW_RAM:${RAM_FREE_PCT}%,"
fi
if [[ "$CPU_USAGE" =~ ^[0-9]+$ ]] && [[ "$CPU_USAGE" -gt 80 ]]; then
  WARNINGS="${WARNINGS}HIGH_CPU:${CPU_USAGE}%,"
fi
LOAD_INT=$(echo "$LOAD_1" | cut -d. -f1 || echo "0")
if [[ -n "$LOAD_INT" ]] && [[ "$LOAD_INT" -gt "$CPU_CORES" ]]; then
  WARNINGS="${WARNINGS}HIGH_LOAD:${LOAD_1}>${CPU_CORES},"
fi

# ── Output ──────────────────────────────────────────────────────────────────
if [[ -n "$OUTPUT_JSON" ]]; then
  python3 - "$RAM_TOTAL_GB" "$RAM_AVAILABLE_GB" "$RAM_FREE_PCT" "$CPU_CORES" "$CPU_USAGE" "$LOAD_1" "$MAX_AGENTS_RAM" "$MAX_PARALLEL_CPU" "$MAX_PARALLEL" "$ORCH_COUNT" "$WARNINGS" <<'PYEOF'
import json, sys

ram_total_gb = float(sys.argv[1])
ram_available_gb = float(sys.argv[2])
ram_free_pct = float(sys.argv[3])
cpu_cores = int(sys.argv[4])
cpu_usage = int(sys.argv[5])
load_1 = float(sys.argv[6])
max_agents_ram = int(sys.argv[7])
max_parallel_cpu = int(sys.argv[8])
max_parallel = int(sys.argv[9])
orch_count = int(sys.argv[10])
warnings_str = sys.argv[11]

warnings = []
for w in warnings_str.split(',')[:-1]:
    if w:
        warnings.append(w)

result = {
    "ram_total_gb": ram_total_gb,
    "ram_available_gb": ram_available_gb,
    "ram_free_pct": ram_free_pct,
    "ram_per_agent_gb": 4,
    "max_agents_ram_bound": max_agents_ram,
    "cpu_cores": cpu_cores,
    "cpu_usage_pct": cpu_usage,
    "load_1m": load_1,
    "max_parallel_cpu_bound": max_parallel_cpu,
    "max_parallel_recommended": max_parallel,
    "orchestrator_agents_running": orch_count,
    "warnings": warnings,
    "timestamp": "$(date -Iseconds)"
}
print(json.dumps(result, indent=2))
PYEOF
else
  echo "=== CAPACITY PLANNER ==="
  echo ""
  echo "CPU:       $CPU_CORES cores, ${CPU_MODEL:-unknown}"
  echo "  Usage:  ${CPU_USAGE}% (instant)"
  echo "  Load:   ${LOAD_1} (1m)"
  echo "RAM:       ${RAM_TOTAL_GB}GB total, ${RAM_AVAILABLE_GB}GB avail (${RAM_FREE_PCT}% free)"
  echo "Capacity:  max_agents=$MAX_AGENTS_RAM (RAM), max_parallel=$MAX_PARALLEL (conservative)"
  echo "Running:   $ORCH_COUNT orchestrator agents"
  if [[ -n "$WARNINGS" ]]; then
    echo "WARNINGS:  ${WARNINGS%,}"
  fi
fi
