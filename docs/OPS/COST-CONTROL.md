# COST CONTROL — LLM Budget & Model Fallback

> **Component:** SPEC-071-V6 (COST ENGINE)
> **Scripts:** `orchestrator/scripts/track_cost.sh`, `orchestrator/scripts/model_fallback.sh`
> **Config:** `.orchestrator/budget.yml`

## Overview

The cost engine prevents runaway LLM spend by tracking token usage per pipeline, enforcing a configurable budget, and automatically falling back to cheaper models when limits are approached.

## Configuration

### budget.yml

Located at `.orchestrator/budget.yml`. Source of truth for all cost settings.

```yaml
default_budget_per_pipeline: 0.50   # USD per pipeline run
alert_threshold: 0.80               # warn at 80% of budget

max_tokens_per_agent:
  o1-preview: 100000
  o1-mini: 50000
  claude-3-haiku: 200000
  # Local models: effectively unlimited
  gemma4-12b-it: 1000000

model_fallback:
  - o1-preview       # Most expensive
  - o1-mini
  - gpt-4o
  - gpt-4o-mini
  - claude-3-haiku   # Cheapest paid
  - gemma4-12b-it    # Free local
  - llama3-portuguese-tomcat-8b
  - minimax-m2.7
```

## Scripts

### track_cost.sh

Records and reports LLM cost per pipeline.

```bash
# Record a cost event (after each LLM call)
bash .claude/skills/orchestrator/scripts/track_cost.sh \
  --pipeline=SPEC-071 \
  --model=o1-preview \
  --input=5000 \
  --output=3000

# Check budget status
bash .claude/skills/orchestrator/scripts/track_cost.sh \
  --check-budget \
  --pipeline=SPEC-071

# Full cost report
bash .claude/skills/orchestrator/scripts/track_cost.sh --report
```

**Cost calculation (OpenAI API reference, April 2026):**

| Model | Input $/1M | Output $/1M |
|-------|-----------|-------------|
| o1-preview | $15.00 | $60.00 |
| o1-mini | $3.00 | $12.00 |
| gpt-4o | $2.50 | $10.00 |
| gpt-4o-mini | $0.15 | $0.60 |
| claude-3-haiku | $0.25 | $1.25 |
| gemma4-12b-it | $0.00 (local) | $0.00 |
| llama3-portuguese-tomcat-8b | $0.00 (local) | $0.00 |
| minimax-m2.7 | $0.00 (local) | $0.00 |

**Cost tracking file:** `.orchestrator/cost-tracking.json` (auto-managed)

```json
{
  "pipelines": {
    "SPEC-071": {
      "total_cost": 0.34,
      "agents": {
        "o1-preview": {
          "calls": 3,
          "input_tokens": 15000,
          "output_tokens": 9000,
          "cost": 0.34
        }
      }
    }
  },
  "total_cost_usd": 0.34,
  "last_updated": "2026-04-18T..."
}
```

### model_fallback.sh

Gets the next fallback model when budget or context limits are exceeded.

```bash
# Get fallback for o1-preview when budget exceeded
FALLBACK=$(bash .claude/skills/orchestrator/scripts/model_fallback.sh \
  o1-preview --budget-exceeded)
echo "Use model: $FALLBACK"  # o1-mini

# Get fallback for o1-mini (context exceeded)
FALLBACK=$(bash .claude/skills/orchestrator/scripts/model_fallback.sh \
  o1-mini --context-exceeded)
echo "Use model: $FALLBACK"  # gpt-4o

# List full fallback chain
bash .claude/skills/orchestrator/scripts/model_fallback.sh --list
```

**Exit codes:**
- `0` — fallback available, model name echoed
- `1` — no fallback (already at cheapest model)

## Integration

### In agent-wrapper.sh (after LLM call)

```bash
# After agent completes, record cost
if [[ -n "$LLM_MODEL" ]] && [[ -n "$INPUT_TOKENS" ]]; then
  bash "$SCRIPT_DIR/track_cost.sh" \
    --pipeline="$PIPELINE_ID" \
    --model="$LLM_MODEL" \
    --input="$INPUT_TOKENS" \
    --output="$OUTPUT_TOKENS" \
    --check-budget || {
    # Budget warning or exceeded
    FALLBACK=$(bash "$SCRIPT_DIR/model_fallback.sh" \
      "$LLM_MODEL" --budget-exceeded || true)
    if [[ -n "$FALLBACK" ]]; then
      echo "[$AGENT_ID] WARNING: budget exceeded, fallback to $FALLBACK"
      export LLM_MODEL="$FALLBACK"
    fi
  }
fi
```

### In metrics_collector.sh

```bash
# Emit LLM cost as Prometheus metric
LLM_COST=$(bash "$SCRIPT_DIR/track_cost.sh" --pipeline="$PIPELINE_ID" --report 2>/dev/null | grep total_cost | awk '{print $2}')
prometheus gauge orchestrator_llm_cost_usd{pipeline="$PIPELINE_ID"} "$LLM_COST"
```

## Acceptance Criteria

- [x] Budget per pipeline configurable in `.orchestrator/budget.yml`
- [x] Model fallback automatic when budget exceeded
- [x] Alert when 80% of budget used
- [x] Cost tracking per pipeline per model
- [x] Local models (Gemma4, llama3, MiniMax) cost $0

## Notes

- Costs are approximate (OpenAI API reference pricing, April 2026)
- Actual costs may vary by provider/region
- Local models always fallback to free tier
- Pipeline budget resets per run (new `cost-tracking.json` per execution context)
