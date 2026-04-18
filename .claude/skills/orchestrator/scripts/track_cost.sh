#!/usr/bin/env bash
# track_cost.sh — Track LLM cost per pipeline against budget
# Part of: SPEC-071-V6 (COST ENGINE)
# Usage: bash track_cost.sh --pipeline=<ID> --model=<MODEL> --input=<TOKENS> --output=<TOKENS>
#        bash track_cost.sh --report [--pipeline=<ID>]
#        bash track_cost.sh --check-budget [--pipeline=<ID>]
# Budget file: .orchestrator/budget.yml (or .orchestrator/budget.json)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$(dirname "$(dirname "$(dirname "$SCRIPT_DIR")")")")"
BUDGET_FILE="$ROOT_DIR/.orchestrator/budget.yml"
COST_FILE="$ROOT_DIR/.orchestrator/cost-tracking.json"

# Default cost per 1M tokens (OpenAI API approximate pricing)
# Format: MODEL=PRICE_PER_1M_INPUT,PRICE_PER_1M_OUTPUT
declare -A MODEL_COSTS=(
  ["o1-preview"]="15.00,60.00"
  ["o1-mini"]="3.00,12.00"
  ["claude-3-haiku"]="0.25,1.25"
  ["gpt-4o"]="2.50,10.00"
  ["gpt-4o-mini"]="0.15,0.60"
  ["gpt-4-turbo"]="10.00,30.00"
  ["gemma4-12b-it"]="0.00,0.00"
  ["llama3-portuguese-tomcat-8b"]="0.00,0.00"
  ["minimax-m2.7"]="0.00,0.00"
)

# Defaults
PIPELINE_ID=""
MODEL=""
INPUT_TOKENS=0
OUTPUT_TOKENS=0
REPORT_MODE=""
CHECK_BUDGET=""

# ── Parse arguments ───────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --pipeline=*)
      PIPELINE_ID="${1#*=}"
      shift
      ;;
    --model=*)
      MODEL="${1#*=}"
      shift
      ;;
    --input=*)
      INPUT_TOKENS="${1#*=}"
      shift
      ;;
    --output=*)
      OUTPUT_TOKENS="${1#*=}"
      shift
      ;;
    --report)
      REPORT_MODE="yes"
      shift
      ;;
    --check-budget)
      CHECK_BUDGET="yes"
      shift
      ;;
    *)
      echo "Unknown: $1" >&2
      exit 1
      ;;
  esac
done

# ── Init cost file ───────────────────────────────────────────────────────────
init_cost_file() {
  if [[ ! -f "$COST_FILE" ]]; then
    mkdir -p "$(dirname "$COST_FILE")"
    cat > "$COST_FILE" <<EOF
{
  "pipelines": {},
  "total_cost_usd": 0,
  "last_updated": "$(date -Iseconds)"
}
EOF
  fi
}

# ── Calculate cost ───────────────────────────────────────────────────────────
calc_cost() {
  local model="$1"
  local input="$2"
  local output="$3"

  local cost_data="${MODEL_COSTS[$model]:-0.00,0.00}"
  local input_price output_price
  input_price=$(echo "$cost_data" | cut -d, -f1)
  output_price=$(echo "$cost_data" | cut -d, -f2)

  # Cost in USD: (tokens / 1_000_000) * price_per_1M
  # Note: bc outputs ".255" instead of "0.255" for values <1, use +0 to normalise
  local input_cost output_cost total
  input_cost=$(echo "scale=6; ($input / 1000000 * $input_price) + 0" | bc)
  output_cost=$(echo "scale=6; ($output / 1000000 * $output_price) + 0" | bc)
  total=$(echo "scale=6; $input_cost + $output_cost + 0" | bc)

  echo "$total"
}

# ── Load budget ───────────────────────────────────────────────────────────────
load_budget() {
  local pipeline="${1:-default}"

  local default_budget="0.50"
  local alert_threshold="0.80"

  if [[ -f "$BUDGET_FILE" ]]; then
    # Try YAML parsing
    default_budget=$(grep "default_budget_per_pipeline:" "$BUDGET_FILE" | awk '{print $2}' | tr -d ' "' || echo "0.50")
    alert_threshold=$(grep "alert_threshold:" "$BUDGET_FILE" | awk '{print $2}' | tr -d ' "' || echo "0.80")
  fi

  echo "$default_budget $alert_threshold"
}

# ── Check budget ─────────────────────────────────────────────────────────────
check_budget() {
  local pipeline="${1:-default}"

  init_cost_file

  read -r budget alert <<< "$(load_budget "$pipeline")"

  local pipeline_cost
  pipeline_cost=$(python3 -c "
import json
with open('$COST_FILE') as f:
    data = json.load(f)
print(data.get('pipelines', {}).get('$pipeline', {}).get('total_cost', 0))
" 2>/dev/null || echo "0")

  local pct
  pct=$(echo "scale=4; $pipeline_cost / $budget * 100" | bc)

  echo "[track_cost] Pipeline: $pipeline"
  echo "[track_cost] Budget: \$$budget"
  echo "[track_cost] Spent:  \$$pipeline_cost"
  echo "[track_cost] Used:   ${pct}%"

  if [[ $(echo "$pct >= 100" | bc -l) -eq 1 ]]; then
    echo "[track_cost] STATUS: EXCEEDED (>=100%)"
    return 2
  elif [[ $(echo "$pct >= $(echo "$alert * 100" | bc -l)" | bc -l) -eq 1 ]]; then
    echo "[track_cost] STATUS: WARNING (>${alert}% of budget)"
    return 1
  else
    echo "[track_cost] STATUS: OK"
    return 0
  fi
}

# ── Record cost ──────────────────────────────────────────────────────────────
record_cost() {
  local pipeline="$PIPELINE_ID"
  local model="$MODEL"
  local input="$INPUT_TOKENS"
  local output="$OUTPUT_TOKENS"

  if [[ -z "$pipeline" ]]; then
    echo "[track_cost] ERROR: --pipeline required" >&2
    exit 1
  fi
  if [[ -z "$model" ]]; then
    echo "[track_cost] ERROR: --model required" >&2
    exit 1
  fi

  # Validate numeric inputs to prevent shell injection in Python heredoc
  if [[ ! "$input" =~ ^[0-9]+$ ]]; then
    echo "[track_cost] ERROR: --input must be numeric, got: $input" >&2
    exit 1
  fi
  if [[ ! "$output" =~ ^[0-9]+$ ]]; then
    echo "[track_cost] ERROR: --output must be numeric, got: $output" >&2
    exit 1
  fi

  init_cost_file

  local cost
  cost=$(calc_cost "$model" "$input" "$output")

  echo "[track_cost] Recording: pipeline=$pipeline model=$model input=$input output=$output cost=\$$cost"

  python3 - "$COST_FILE" "$pipeline" "$model" "$input" "$output" "$cost" <<-'PYEOF'
import json, sys
from datetime import datetime

cost_file = sys.argv[1]
pipeline = sys.argv[2]
model = sys.argv[3]
input_tok = int(sys.argv[4])
output_tok = int(sys.argv[5])
cost = float(sys.argv[6])

with open(cost_file) as f:
    data = json.load(f)

if pipeline not in data["pipelines"]:
    data["pipelines"][pipeline] = {
        "total_cost": 0,
        "agents": {},
        "created": datetime.now().isoformat()
    }

p_data = data["pipelines"][pipeline]

if model not in p_data["agents"]:
    p_data["agents"][model] = {"calls": 0, "input_tokens": 0, "output_tokens": 0, "cost": 0}

a = p_data["agents"][model]
a["calls"] += 1
a["input_tokens"] += input_tok
a["output_tokens"] += output_tok
a["cost"] = round(a["cost"] + cost, 6)

p_data["total_cost"] = round(p_data["total_cost"] + cost, 6)
data["total_cost_usd"] = round(data.get("total_cost_usd", 0) + cost, 6)
data["last_updated"] = datetime.now().isoformat()

with open(cost_file, "w") as f:
    json.dump(data, f, indent=2)

print(f"[track_cost] Recorded: model={model} cost={cost:.6f} pipeline_total={p_data['total_cost']:.6f}")
PYEOF

  # Check budget after recording
  if [[ -n "$CHECK_BUDGET" ]]; then
    check_budget "$pipeline"
  fi
}

# ── Report ────────────────────────────────────────────────────────────────────
report() {
  init_cost_file

  python3 - "$COST_FILE" <<-'PYEOF'
import json, sys
cost_file = sys.argv[1]

try:
    with open(cost_file) as f:
        data = json.load(f)
except:
    print("No cost data yet")
    sys.exit(0)

print("=== COST REPORT ===")
print(f"Total cost: ${data.get('total_cost_usd', 0):.6f}")
print(f"Last updated: {data.get('last_updated', 'never')}")
print()

pipelines = data.get("pipelines", {})
if not pipelines:
    print("No pipeline data")
else:
    for pid, pdata in sorted(pipelines.items()):
        print(f"Pipeline: {pid}")
        print(f"  Total cost: ${pdata.get('total_cost', 0):.6f}")
        agents = pdata.get("agents", {})
        if agents:
            for model, adata in sorted(agents.items()):
                print(f"    {model}:")
                print(f"      calls: {adata.get('calls', 0)}")
                print(f"      input_tokens: {adata.get('input_tokens', 0):,}")
                print(f"      output_tokens: {adata.get('output_tokens', 0):,}")
                print(f"      cost: ${adata.get('cost', 0):.6f}")
        print()
PYEOF
}

# ── Main ─────────────────────────────────────────────────────────────────────
if [[ -n "$REPORT_MODE" ]]; then
  report
elif [[ -n "$CHECK_BUDGET" ]]; then
  check_budget "${PIPELINE_ID:-default}"
else
  record_cost
fi
