#!/bin/bash
WORKER_ID=$1
TASK_ID=$2
TASK_NAME=$3
DESC=$4

LOG=/srv/monorepo/.claude/brain-refactor/logs/${WORKER_ID}-${TASK_ID}.log
QUEUE=/srv/monorepo/.claude/brain-refactor/queue.json

echo "[$(date)] [$WORKER_ID] START $TASK_ID: $TASK_NAME" > $LOG

# Update queue to running
cd /srv/monorepo/.claude/brain-refactor
TASKS=$(jq --argjson id "$TASK_ID" --arg w "$WORKER_ID" 'map(if .id == $id then .status = "running" | .worker = $w else . end)' queue.json)
echo "$TASKS" > queue.json

# Build context-aware prompt
PROMPT="You are working on the Brain Refactor project.

Your task: $DESC

Project context:
- Second brain location: ~/Desktop/hermes-second-brain/
- Monorepo: /srv/monorepo/
- SPEC: /srv/monorepo/docs/SPECs/SPEC-VIBE-BRAIN-REFACTOR.md

Steps:
1. Read the SPEC to understand the task
2. Execute the task as described
3. If it involves creating files, create them in the correct location
4. Report what you did

Output: Describe what you completed."

mclaude --provider minimax --model MiniMax-M2.7 -p "$PROMPT" 2>&1 >> $LOG

# Mark done
TASKS=$(jq --argjson id "$TASK_ID" 'map(if .id == $id then .status = "done" | .completed_at = (now | strftime("%Y-%m-%dT%H:%M:%SZ")) else . end)' queue.json)
echo "$TASKS" > queue.json

echo "[$(date)] [$WORKER_ID] DONE $TASK_ID" >> $LOG
