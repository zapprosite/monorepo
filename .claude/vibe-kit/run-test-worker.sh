#!/bin/bash
set -e
WORKER_ID=$1
TASK_ID=$2
NAME=$3

WORKDIR=/srv/monorepo/.claude/vibe-kit
QUEUE=$WORKDIR/tests-queue/queue.json
LOG=$WORKDIR/logs/${WORKER_ID}-${TASK_ID}.log

echo "[$(date)] [$WORKER_ID] Starting TEST=$TASK_ID: $NAME" > $LOG

# Claim
cd $WORKDIR
TASKS=$(jq --argjson id "$TASK_ID" --arg w "$WORKER_ID" 'map(if .id == $id then .status = "running" | .worker = $w else . end)' tests-queue/queue.json)
echo "$TASKS" > tests-queue/queue.json

# Build prompt
PROMPT="Write and run a test for: $NAME

Working directory: /srv/monorepo/apps/CRM-REFRIMIX
Test location: apps/CRM-REFRIMIX/tests/

Steps:
1. Understand what needs to be tested from the feature
2. Write a test file in the appropriate tests/ subdirectory
3. Run the test: cd apps/CRM-REFRIMIX && pnpm test or npm test
4. If test fails, fix the issue
5. Report pass/fail

Output: PASS or FAIL with brief reason"

mclaude --provider minimax --model MiniMax-M2.7 -p "$PROMPT" 2>&1 >> $LOG

# Mark done
TASKS=$(jq --argjson id "$TASK_ID" 'map(if .id == $id then .status = "done" | .completed_at = (now | strftime("%Y-%m-%dT%H:%M:%SZ")) else . end)' tests-queue/queue.json)
echo "$TASKS" > tests-queue/queue.json

echo "[$(date)] [$WORKER_ID] Finished TEST=$TASK_ID" >> $LOG
