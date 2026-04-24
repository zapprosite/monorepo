#!/bin/bash
# Master launcher for brain-refactor queue
# Relaunches pending tasks every 10min until queue is empty or 8h limit
QUEUE=/srv/monorepo/.claude/brain-refactor/queue.json
LOG=/srv/monorepo/.claude/brain-refactor/logs/master-launcher.log
LOCK=/srv/monorepo/.claude/brain-refactor/.master-launcher.lock
WORKDIR=/srv/monorepo/.claude/brain-refactor

# Prevent concurrent runs
if [ -f "$LOCK" ]; then
    LOCKPID=$(cat $LOCK)
    if kill -0 $LOCKPID 2>/dev/null; then
        echo "[$(date)] Already running PID=$LOCKPID" >> "$LOG"
        exit 0
    fi
    echo "[$(date)] Stale lock cleared" >> "$LOG"
fi
echo $$ > "$LOCK"

# Count running workers
RUNNING=$(python3 -c "
import json
with open('$QUEUE') as f: q=json.load(f)
print(sum(1 for t in q['tasks'] if t.get('status')=='running'))
")

# Count pending
PENDING=$(python3 -c "
import json
with open('$QUEUE') as f: q=json.load(f)
print(sum(1 for t in q['tasks'] if t.get('status')=='pending'))
")

echo "[$(date)] running=$RUNNING pending=$PENDING" >> "$LOG"

# Launch if < 5 workers running and pending exist
if [ "$RUNNING" -lt 5 ] && [ "$PENDING" -gt 0 ]; then
    WORKER_ID="W$(date +%H%M%S)"
    TASK=$(python3 -c "
import json
with open('$QUEUE') as f: q=json.load(f)
for t in q['tasks']:
    if t.get('status') == 'pending':
        print(t['id'] + '|' + t['name'] + '|' + t.get('description',''))
        break
")

    if [ -n "$TASK" ]; then
        TID=$(echo "$TASK" | cut -d'|' -f1)
        TNAME=$(echo "$TASK" | cut -d'|' -f2)
        DESC=$(echo "$TASK" | cut -d'|' -f3-)

        echo "[$(date)] Launching $WORKER_ID -> $TID ($TNAME)" >> "$LOG"

        # Mark running
        python3 -c "
import json
with open('$QUEUE') as f: q=json.load(f)
for t in q['tasks']:
    if t['id']=='$TID': t['status']='running'; t['worker']='$WORKER_ID'; break
with open('$QUEUE','w') as f: json.dump(q,f,indent=2)
"

        nohup bash "$WORKDIR/launch.sh" "$WORKER_ID" "$TID" "$TNAME" "$DESC" > /dev/null 2>&1 &
        echo "[$(date)] Launched PID=$! $TID" >> "$LOG"
    fi
fi

# Cleanup lock
rm -f "$LOCK"
