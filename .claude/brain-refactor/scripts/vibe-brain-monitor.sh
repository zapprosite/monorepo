#!/bin/bash
# vibe-brain-monitor — Monitor brain-refactor progress every 30 minutes
# Part of SPEC-VIBE-BRAIN-REFACTOR T16
set -euo pipefail

WORKDIR=/srv/monorepo/.claude/brain-refactor
QUEUE=$WORKDIR/queue.json
LOG=$WORKDIR/logs/cron-monitor.log
LOCK=$WORKDIR/.vibe-brain-monitor.lock

mkdir -p $WORKDIR/logs

if [ -f "$LOCK" ]; then
    LOCKPID=$(cat "$LOCK" 2>/dev/null || echo "")
    if [ -n "$LOCKPID" ] && kill -0 "$LOCKPID" 2>/dev/null; then
        echo "[$(date -u)] Already running PID=$LOCKPID, exiting" >> $LOG
        exit 0
    fi
fi
echo $$ > "$LOCK"

echo "[$(date -u)] vibe-brain-monitor: starting" >> $LOG

STATS=$(python3 -c "
import json
from datetime import datetime

with open('$QUEUE') as f: q=json.load(f)

total = len(q['tasks'])
done = sum(1 for t in q['tasks'] if t.get('status') == 'done')
running = sum(1 for t in q['tasks'] if t.get('status') == 'running')
pending = sum(1 for t in q['tasks'] if t.get('status') == 'pending')
failed = sum(1 for t in q['tasks'] if t.get('status') == 'failed')

now = datetime.utcnow()
stale = []
for t in q['tasks']:
    if t.get('status') == 'running' and t.get('started_at'):
        started = datetime.fromisoformat(t['started_at'].replace('Z', '+00:00'))
        age_hours = (now - started.replace(tzinfo=None)).total_seconds() / 3600
        if age_hours > 2:
            stale.append((t['id'], t.get('name', 'unknown'), round(age_hours, 1)))

print(f'TOTAL={total} DONE={done} RUNNING={running} PENDING={pending} FAILED={failed}')
for s in stale:
    print(f'STALE: {s[0]} ({s[1]}) - {s[2]}h')
" 2>/dev/null)

echo "[$(date -u)] Queue stats: $STATS" >> $LOG

if pgrep -f "vibe-kit.sh" > /dev/null 2>&1; then
    echo "[$(date -u)] vibe-kit.sh: RUNNING" >> $LOG
else
    echo "[$(date -u)] vibe-kit.sh: NOT RUNNING (may need restart)" >> $LOG
fi

WORKER_COUNT=$(pgrep -f "mclaude.*brain-refactor" 2>/dev/null | wc -l || echo "0")
echo "[$(date -u)] Active mclaude workers: $WORKER_COUNT" >> $LOG

TOTAL=$(echo "$STATS" | grep -oP 'TOTAL=\K\d+')
DONE=$(echo "$STATS" | grep -oP 'DONE=\K\d+')
if [ -n "$TOTAL" ] && [ "$TOTAL" != "0" ]; then
    PCT=$((DONE * 100 / TOTAL))
    echo "[$(date -u)] Progress: $DONE/$TOTAL ($PCT%)" >> $LOG
fi

echo "[$(date -u)] vibe-brain-monitor: done" >> $LOG
rm -f "$LOCK"
