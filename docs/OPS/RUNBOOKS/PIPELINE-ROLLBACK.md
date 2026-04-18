# PIPELINE-ROLLBACK — Pipeline State Rollback Runbook

> **Component:** SPEC-071-V4 (Rollback Engine)
> **Scripts:** `.claude/skills/orchestrator/scripts/snapshot.sh`, `.claude/skills/orchestrator/scripts/rollback.sh`
> **Context:** Need to revert orchestrator pipeline to previous state

## Prerequisites

```bash
# Verify rollback scripts exist
ls -la .claude/skills/orchestrator/scripts/snapshot.sh
ls -la .claude/skills/orchestrator/scripts/rollback.sh

# Dry-run verify works
bash .claude/skills/orchestrator/scripts/snapshot.sh --help
bash .claude/skills/orchestrator/scripts/rollback.sh --help
```

## How It Works

Every agent in the orchestrator automatically creates a snapshot **before** running (integrated in `agent-wrapper.sh`). Snapshots capture:
- `src/` workspace copy
- `git.commit` (current commit hash)
- `git.info` (branch, label, timestamp)
- `manifest.json` (snapshot metadata)

Snapshots are stored in: `tasks/snapshots/<pipeline_id>/<agent_id>/`

## Snapshot Before Risky Operation

```bash
# Manual snapshot (automatically done by agent-wrapper.sh)
bash .claude/skills/orchestrator/scripts/snapshot.sh <agent_id> <pipeline_id> [label]
# Example:
bash .claude/skills/orchestrator/scripts/snapshot.sh CODER-1 SPEC-071 "before-refactor"
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

### Option 2: Snapshot Restore (using snapshot.sh + rollback.sh)

```bash
# List available snapshots for a pipeline
bash .claude/skills/orchestrator/scripts/rollback.sh --list SPEC-071

# Restore specific agent from snapshot
bash .claude/skills/orchestrator/scripts/rollback.sh \
  --agent=CODER-1 \
  --to=SPEC-071

# Dry-run first
bash .claude/skills/orchestrator/scripts/rollback.sh \
  --agent=CODER-1 \
  --to=SPEC-071 \
  --dry-run
```

### Option 3: Agent-Level Rollback

```bash
# Restore specific agent from snapshot and re-run
AGENT=SPEC-ANALYZER
PIPELINE=SPEC-071
SPEC_FILE=docs/SPECS/SPEC-071.md

# 1. Rollback to snapshot
bash .claude/skills/orchestrator/scripts/rollback.sh \
  --agent="$AGENT" \
  --to="$PIPELINE"

# 2. Re-run specific agent
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
bash .claude/skills/orchestrator/scripts/run-agents.sh docs/SPECS/SPEC-071.md
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
