# PIPELINE-ROLLBACK — Pipeline State Rollback Runbook

> **Component:** SPEC-071-V4 (Rollback Engine)
> **Context:** Need to revert orchestrator pipeline to previous state

## Prerequisites

```bash
# Verify rollback scripts exist
ls -la scripts/snapshot.sh scripts/rollback.sh
bash scripts/snapshot.sh --dry-run  # verify works
```

## Snapshot Before Risky Operation

```bash
# Create snapshot before pipeline run
bash scripts/snapshot.sh {optional-label}

# Or manually
cp -r src src.snapshot.$(date +%Y%m%d_%H%M%S)
git rev-parse HEAD > .snapshot/$(date +%Y%m%d_%H%M%S).HEAD
```

## Rollback Options

### Option 1: Git Revert (Preferred)

```bash
# Revert last commit
git revert HEAD --no-edit

# Revert range of commits
git revert HEAD~3..HEAD --no-edit

# Push
git push origin {branch}
```

### Option 2: Snapshot Restore

```bash
# List snapshots
ls -la .snapshot/

# Restore from snapshot
SNAPSHOT=.snapshot/{timestamp}
cp -r "$SNAPSHOT/src" ./src
git checkout $(cat "$SNAPSHOT/HEAD")

# Or use rollback.sh
bash scripts/rollback.sh --to "$SNAPSHOT"
```

### Option 3: Agent-Level Rollback

```bash
# Restore specific agent's last good state
AGENT=SPEC-ANALYZER
LAST_GOOD=$(cat tasks/agent-states/{AGENT}.json | jq -r '.started')
echo "Last good run: $LAST_GOOD"

# Re-run specific agent
SPEC_FILE=docs/SPECS/SPEC-XXX.md
bash .claude/skills/orchestrator/scripts/agent-wrapper.sh \
  "$AGENT" "/researcher" "$SPEC_FILE"
```

## Full Pipeline Reset

```bash
# 1. Stop all running agents
pkill -f "agent-wrapper.sh" || true

# 2. Clear state
rm -f tasks/agent-states/*.json
rm -f .claude/skills/orchestrator/locks/*.lock
rm -f .claude/skills/orchestrator/dlq/*.json

# 3. Git revert to known good state
git revert HEAD --no-edit

# 4. Restart fresh
bash .claude/skills/orchestrator/scripts/run-agents.sh {SPEC_FILE}
```

## Verify Rollback

```bash
# Check service is healthy after rollback
curl -s http://localhost:4002/health
curl -s http://localhost:8642/health

# Run smoke test
bash smoke-tests/smoke-{service}.sh

# Verify no regressions
pnpm tsc --noEmit
pnpm lint
```
