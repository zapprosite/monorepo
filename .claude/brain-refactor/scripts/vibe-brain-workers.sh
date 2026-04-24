#!/bin/bash
# vibe-brain-workers — Launch vibe-kit workers every 15 minutes
# Part of SPEC-VIBE-BRAIN-REFACTOR T16
set -euo pipefail

WORKDIR=/srv/monorepo/.claude/brain-refactor
QUEUE=$WORKDIR/queue.json
LOG=$WORKDIR/logs/cron-workers.log
MASTER_LAUNCHER=$WORKDIR/master-launcher.sh

mkdir -p $WORKDIR/logs

echo "[$(date -u)] vibe-brain-workers: starting" >> $LOG

if pgrep -f "vibe-kit.sh" > /dev/null 2>&1; then
    echo "[$(date -u)] vibe-kit.sh is running" >> $LOG
else
    echo "[$(date -u)] vibe-kit.sh not running, checking queue..." >> $LOG
fi

RUNNING=$(python3 -c "
import json
with open('$QUEUE') as f: q=json.load(f)
print(sum(1 for t in q['tasks'] if t.get('status')=='running'))
" 2>/dev/null || echo "0")

PENDING=$(python3 -c "
import json
with open('$QUEUE') as f: q=json.load(f)
print(sum(1 for t in q['tasks'] if t.get('status')=='pending'))
" 2>/dev/null || echo "0")

echo "[$(date -u)] Workers: running=$RUNNING pending=$PENDING" >> $LOG

if [ "$RUNNING" -lt 5 ] && [ "$PENDING" -gt 0 ]; then
    echo "[$(date -u)] Launching via master-launcher.sh" >> $LOG
    nohup bash $MASTER_LAUNCHER > /dev/null 2>&1 &
    echo "[$(date -u)] master-launcher.sh spawned PID=$!" >> $LOG
fi

echo "[$(date -u)] vibe-brain-workers: done" >> $LOG
