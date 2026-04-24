#!/bin/bash
# launch.sh — Worker launcher with failure detection
# Enhanced with retry support
set -euo pipefail

WORKDIR=/srv/monorepo/.claude/brain-refactor
QUEUE=$WORKDIR/queue.json

WORKER_ID=$1
TASK_ID=$2
TASK_NAME=$3
DESC="$4"

LOG=$WORKDIR/logs/${WORKER_ID}-${TASK_ID}.log
mkdir -p $WORKDIR/logs

log() {
    echo "[$(date -u)] $1" >> "$LOG"
}

mark_running() {
    python3 -c "
import json
with open('$QUEUE') as f: q=json.load(f)
for t in q['tasks']:
    if t['id']=='$TASK_ID': 
        t['status']='running'
        t['worker']='$WORKER_ID'
        t['started_at']='$(date -u +%Y-%m-%dT%H:%M:%SZ)'
        break
with open('$QUEUE','w') as f: json.dump(q,f,indent=2)
"
}

mark_done() {
    python3 -c "
import json
with open('$QUEUE') as f: q=json.load(f)
for t in q['tasks']:
    if t['id']=='$TASK_ID': 
        t['status']='done'
        t['completed_at']='$(date -u +%Y-%m-%dT%H:%M:%SZ)'
        break
with open('$QUEUE','w') as f: json.dump(q,f,indent=2)
"
}

mark_failed() {
    local ERROR_MSG="$1"
    python3 -c "
import json
with open('$QUEUE') as f: q=json.load(f)
for t in q['tasks']:
    if t['id']=='$TASK_ID': 
        t['status']='failed'
        t['last_error']='''$ERROR_MSG'''
        break
with open('$QUEUE','w') as f: json.dump(q,f,indent=2)
"
}

# Main
log "START $TASK_ID ($TASK_NAME)"
mark_running

# Run mclaude
set +e
mclaude --provider minimax --model MiniMax-M2.7 -p "You are working on the Brain Refactor project.
Task: $TASK_NAME
Description: $DESC
Context:
- Second brain: ~/Desktop/hermes-second-brain/
- Monorepo: /srv/monorepo/
- SPEC: /srv/monorepo/docs/SPECs/SPEC-VIBE-BRAIN-REFACTOR.md
Steps:
1. Read SPEC-VIBE-BRAIN-REFACTOR.md
2. Execute the task
3. Create output files in /srv/monorepo/.claude/brain-refactor/
4. Mark done in queue.json
Output: What you completed." 2>&1 >> "$LOG"
EXIT_CODE=$?
set -e

if [ $EXIT_CODE -eq 0 ]; then
    log "DONE $TASK_ID (exit=$EXIT_CODE)"
    mark_done
else
    log "FAILED $TASK_ID (exit=$EXIT_CODE)"
    mark_failed "mclaude exited with code $EXIT_CODE"
fi
