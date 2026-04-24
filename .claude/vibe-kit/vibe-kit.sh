#!/bin/bash
# vibe-kit.sh — Infinite loop runner for brain-refactor queue
# Polls /srv/monorepo/.claude/brain-refactor/queue.json continuously
# Runs up to 15 parallel mclaude workers
set -euo pipefail

WORKDIR=/srv/monorepo/.claude/vibe-kit
BRAIN_QUEUE=/srv/monorepo/.claude/brain-refactor/queue.json
VIBE_QUEUE=$WORKDIR/queue.json
STATE=$WORKDIR/state.json
LOGDIR=$WORKDIR/logs
LOCK=$WORKDIR/.vibe-kit.lock
MAX_WORKERS=${VIBE_PARALLEL:-15}
POLL_INTERVAL=${VIBE_POLL_INTERVAL:-5}
SNAPSHOT_EVERY=${VIBE_SNAPSHOT_EVERY:-3}

mkdir -p $LOGDIR

# Lock to prevent concurrent runners
if [ -f "$LOCK" ]; then
    LOCKPID=$(cat "$LOCK" 2>/dev/null || echo "")
    if [ -n "$LOCKPID" ] && kill -0 "$LOCKPID" 2>/dev/null; then
        echo "[$(date -u)] Already running PID=$LOCKPID, exiting" >> $LOGDIR/vibe-kit.log
        exit 0
    fi
    echo "[$(date -u)] Stale lock cleared" >> $LOGDIR/vibe-kit.log
fi
echo $$ > "$LOCK"

# ── Log retention (run once per invocation) ───────────────────────
if [ -x "$WORKDIR/cleanup-vibe.sh" ]; then
    bash "$WORKDIR/cleanup-vibe.sh" >> "$LOGDIR/vibe-kit-cleanup.log" 2>&1 || true
fi

snapshot_zfs() {
    local label=$1
    if command -v zfs &>/dev/null; then
        local snap="tank@vibe-pre-$(date +%Y%m%d-%H%M%S)-${label}"
        sudo zfs snapshot "$snap" 2>/dev/null || true
        echo "[$(date -u)] ZFS snapshot: $snap" >> $LOGDIR/vibe-kit.log
    fi
}

count_workers() {
    pgrep -f "mclaude.*brain-refactor" 2>/dev/null | wc -l
}

sync_queue() {
    if [ -f "$BRAIN_QUEUE" ]; then
        cp "$BRAIN_QUEUE" "$VIBE_QUEUE" 2>/dev/null || true
    fi
}

claim_task() {
    local worker_id=$1
    python3 -c "
import json, sys, time
queue_path = '$BRAIN_QUEUE'
worker_id = '$worker_id'
try:
    with open(queue_path, 'r') as f:
        q = json.load(f)
    for t in q.get('tasks', []):
        if t.get('status') == 'pending':
            t['status'] = 'running'
            t['worker'] = worker_id
            t['started_at'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
            with open(queue_path, 'w') as f:
                json.dump(q, f, indent=2)
            print(f\"{t['id']}|{t.get('name','')}|{t.get('description','')}\")
            sys.exit(0)
    sys.exit(1)
except Exception as e:
    sys.stderr.write(f'claim_task error: {e}\n')
    sys.exit(1)
" 2>&1
}

spawn_worker() {
    local worker_id=$1
    local task_id=$2
    local task_name=$3
    local description=$4
    local log=$LOGDIR/W${worker_id}-${task_id}.log

    echo "[$(date -u)] [$worker_id] START $task_id: $task_name" > "$log"

    mclaude --provider minimax --model MiniMax-M2.7 -p "You are working on the Brain Refactor project.

Your task: $task_name
Description: $description

Project context:
- Second brain: ~/Desktop/hermes-second-brain/
- Monorepo: /srv/monorepo/
- SPEC: /srv/monorepo/docs/SPECs/SPEC-VIBE-BRAIN-REFACTOR.md

Steps:
1. Read the SPEC to understand the task
2. Execute the task as described
3. If it involves creating files, create them in the correct location in /srv/monorepo/.claude/brain-refactor/
4. Report what you completed

Output: Describe what you completed." 2>&1 >> "$log" &

    echo $! >> $WORKDIR/.worker-pids
    echo "[$(date -u)] [$worker_id] SPAWNED $task_id PID=$!" >> $LOGDIR/vibe-kit.log
}

update_state() {
    local phase=${1:-running}
    local current_task=${2:-}
    local elapsed=${3:-0}
    python3 -c "
import json, time
state = {
    'phase': '$phase',
    'current_task': '$current_task',
    'status': 'running',
    'elapsed_seconds': $elapsed,
    'provider': 'minimax',
    'model': 'MiniMax-M2.7',
    'saved_at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
}
with open('$STATE', 'w') as f:
    json.dump(state, f, indent=2)
" 2>/dev/null || true
}

mark_done() {
    local task_id=$1
    python3 -c "
import json, time
with open('$BRAIN_QUEUE', 'r') as f:
    q = json.load(f)
for t in q.get('tasks', []):
    if t['id'] == '$task_id':
        t['status'] = 'done'
        t['completed_at'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
        break
with open('$BRAIN_QUEUE', 'w') as f:
    json.dump(q, f, indent=2)
" 2>/dev/null || true
}

heal_stale_workers() {
    python3 -c "
import json, time
with open('$BRAIN_QUEUE', 'r') as f:
    q = json.load(f)
for t in q.get('tasks', []):
    if t.get('status') == 'running' and t.get('worker'):
        wid = t['worker']
        log_file = f'$LOGDIR/{wid}-{t[\"id\"]}.log'
        try:
            with open(log_file, 'r') as lf:
                lines = lf.read().strip().split('\n')
                if lines and ('DONE' in lines[-1] or 'FAIL' in lines[-1]):
                    t['status'] = 'done' if 'DONE' in lines[-1] else 'failed'
                    t['completed_at'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
                    print(f'Healed {t[\"id\"]} -> {t[\"status\"]}', file=__import__(\"sys\").stderr)
        except:
            pass
with open('$BRAIN_QUEUE', 'w') as f:
    json.dump(q, f, indent=2)
" 2>&1 || true
}

queue_stats() {
    python3 -c "
import json
with open('$BRAIN_QUEUE', 'r') as f:
    q = json.load(f)
tasks = q.get('tasks', [])
total = len(tasks)
pending = sum(1 for t in tasks if t.get('status') == 'pending')
running = sum(1 for t in tasks if t.get('status') == 'running')
done = sum(1 for t in tasks if t.get('status') == 'done')
failed = sum(1 for t in tasks if t.get('status') == 'failed')
print(f'total={total} pending={pending} running={running} done={done} failed={failed}')
" 2>/dev/null
}

echo "[$(date -u)] vibe-kit.sh started (PID=$$, MAX_WORKERS=$MAX_WORKERS)" >> $LOGDIR/vibe-kit.log
update_state "looping" "idle" 0

START_EPOCH=$(date +%s)
TASKS_SINCE_SNAPSHOT=0
SHUTDOWN_REQUESTED=0

trap 'SHUTDOWN_REQUESTED=1' TERM INT

IDLE_COOLDOWN=${VIBE_IDLE_COOLDOWN:-180}
IDLE_START=

while [ $SHUTDOWN_REQUESTED -eq 0 ]; do
    ELAPSED=$(($(date +%s) - START_EPOCH))

    sync_queue
    heal_stale_workers

    CURRENT_WORKERS=$(count_workers)
    STATS=$(queue_stats)
    echo "[$(date -u)] workers=$CURRENT_WORKERS $STATS" >> $LOGDIR/vibe-kit.log

    PENDING_COUNT=$(python3 -c "
import json
with open('$BRAIN_QUEUE', 'r') as f:
    q = json.load(f)
print(sum(1 for t in q.get('tasks', []) if t.get('status') == 'pending'))
" 2>/dev/null || echo "999")

    RUNNING_COUNT=$(python3 -c "
import json
with open('$BRAIN_QUEUE', 'r') as f:
    q = json.load(f)
print(sum(1 for t in q.get('tasks', []) if t.get('status') == 'running'))
" 2>/dev/null || echo "0")

    if [ "$PENDING_COUNT" -eq 0 ] && [ "$RUNNING_COUNT" -eq 0 ]; then
        echo "[$(date -u)] Queue empty, all tasks done. Continuing idle loop..." >> $LOGDIR/vibe-kit.log
        if [ -z "$IDLE_START" ]; then
            IDLE_START=$(date +%s)
            echo "[$(date -u)] Idle timer started (${IDLE_COOLDOWN}s)" >> $LOGDIR/vibe-kit.log
        fi
        IDLE_ELAPSED=$(($(date +%s) - IDLE_START))
        if [ $IDLE_ELAPSED -ge $IDLE_COOLDOWN ]; then
            echo "[$(date -u)] Idle timeout reached (${IDLE_COOLDOWN}s). Exiting for cooldown." >> $LOGDIR/vibe-kit.log
            break
        fi
    else
        IDLE_START=
    fi

    while [ "$CURRENT_WORKERS" -lt "$MAX_WORKERS" ]; do
        WORKER_ID="W$(date +%H%M%S%3N | tail -c 4)"
        CLAIM=$(claim_task "$WORKER_ID" 2>&1) || break

        if [ -z "$CLAIM" ]; then
            break
        fi

        TASK_ID=$(echo "$CLAIM" | cut -d'|' -f1)
        TASK_NAME=$(echo "$CLAIM" | cut -d'|' -f2)
        DESCRIPTION=$(echo "$CLAIM" | cut -d'|' -f3-)

        echo "[$(date -u)] [$WORKER_ID] Claimed $TASK_ID: $TASK_NAME" >> $LOGDIR/vibe-kit.log
        spawn_worker "$WORKER_ID" "$TASK_ID" "$TASK_NAME" "$DESCRIPTION"

        TASKS_SINCE_SNAPSHOT=$((TASKS_SINCE_SNAPSHOT + 1))
        CURRENT_WORKERS=$((CURRENT_WORKERS + 1))

        if [ $TASKS_SINCE_SNAPSHOT -ge $SNAPSHOT_EVERY ]; then
            snapshot_zfs "auto"
            TASKS_SINCE_SNAPSHOT=0
        fi

        sleep 1
    done

    update_state "running" "multi" $ELAPSED
    sleep $POLL_INTERVAL
done

echo "[$(date -u)] vibe-kit.sh stopped (elapsed=${ELAPSED}s)" >> $LOGDIR/vibe-kit.log
rm -f "$LOCK"
update_state "stopped" "idle" $ELAPSED
