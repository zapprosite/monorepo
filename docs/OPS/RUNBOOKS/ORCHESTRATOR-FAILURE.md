# ORCHESTRATOR-FAILURE — Orchestrator Pipeline Failure Runbook

> **Component:** Claude Code Orchestrator (SPEC-071)
> **Context:** 14-agent pipeline failing or producing bad PRs

## Symptoms

- Pipeline produces no PR
- SHIPPER agent fails
- One or more agents consistently failing
- Circuit breaker triggered (DLQ entries in `.claude/skills/orchestrator/dlq/`)

## Diagnosis

```bash
# Check agent states
ls -la tasks/agent-states/
cat tasks/agent-states/*.json | python3 -c "import json,sys; [print(d['agent'], d.get('status','?'), d.get('exit_code','?')) for d in [json.load(open(f)) for f in sys.argv[1:]]]" tasks/agent-states/*.json

# Check DLQ
ls -la .claude/skills/orchestrator/dlq/
cat .claude/skills/orchestrator/dlq/*.json

# Check logs
ls -la .claude/skills/orchestrator/logs/
cat .claude/skills/orchestrator/logs/SHIPPER.log | tail -50
```

## Common Issues

### Agent exits with code 99 (reentrancy lock)

```bash
# Agent already running — wait for it or kill stale lock
PID=$(cat .claude/skills/orchestrator/locks/*-{AGENT}.lock 2>/dev/null | cut -d: -f1)
if [[ -d "/proc/$PID" ]]; then
  echo "Agent PID $PID still running — waiting..."
  wait $PID
else
  echo "Stale lock — removing"
  rm -f .claude/skills/orchestrator/locks/*-{AGENT}.lock
fi
```

### All agents fail with exec format error

```bash
# Check bash scripts have LF line endings
file .claude/skills/orchestrator/scripts/*.sh
sed -i 's/\r$//' .claude/skills/orchestrator/scripts/*.sh
```

### Claude API auth failure

```bash
# Verify API key is set
echo "GW key: ${AI_GATEWAY_FACADE_KEY:0:8}..." 
# If empty: missing in .env → generate and add
openssl rand -hex 32
```

### Pipeline hangs (no completion signal)

```bash
# Force kill all agent processes
pkill -f "agent-wrapper.sh"
pkill -f "claude -p"

# Clear locks
rm -f .claude/skills/orchestrator/locks/*.lock

# Restart fresh
bash .claude/skills/orchestrator/scripts/run-agents.sh docs/SPECS/SPEC-XXX.md
```

## Manual Recovery

```bash
# Kill and restart from SPEC
bash .claude/skills/orchestrator/scripts/run-agents.sh {SPEC_FILE}

# Monitor completion
bash .claude/skills/orchestrator/scripts/wait-for-completion.sh
```

## DLQ Recovery

```bash
# Inspect DLQ entries
cat .claude/skills/orchestrator/dlq/{AGENT}.json

# Clear DLQ (after fixing the issue)
rm -f .claude/skills/orchestrator/dlq/{AGENT}.json

# Re-run failed agent
bash .claude/skills/orchestrator/scripts/agent-wrapper.sh {AGENT} "{command}" {SPEC}
```

## Escalation

If SHIPPER fails → PR not created → escalate to team lead for manual PR review
