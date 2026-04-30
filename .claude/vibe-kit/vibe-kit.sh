#!/bin/bash
# vibe-kit.sh — Infinite loop runner for brain-refactor queue
# Polls /srv/monorepo/.claude/brain-refactor/queue.json continuously
# Runs up to 15 parallel mclaude workers (or VIBE_PARALLEL override)
# All queue ops go through queue-manager.py (fcntl.flock + os.replace)
set -euo pipefail

WORKDIR=/srv/monorepo/.claude/vibe-kit
CLAUDE_DIR=/srv/monorepo/.claude
BRAIN_QUEUE=$CLAUDE_DIR/brain-refactor/queue.json
VIBE_QUEUE=$WORKDIR/queue.json
STATE=$CLAUDE_DIR/state.json
LOGDIR=$WORKDIR/logs
LOCK=$WORKDIR/.vibe-kit.lock
QUEUE_MANAGER=$WORKDIR/queue-manager.py
MAX_WORKERS=${VIBE_PARALLEL:-15}
POLL_INTERVAL=${VIBE_POLL_INTERVAL:-5}
SNAPSHOT_EVERY=${VIBE_SNAPSHOT_EVERY:-3}
MAX_TASK_TIME=${VIBE_MAX_TASK_TIME:-600}
WATCH_MODE=${VIBE_WATCH_MODE:-false}

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

# claim_task — atomic claim via queue-manager.py (fcntl.flock + os.replace)
claim_task() {
    local worker_id=$1
    local result
    result=$(QUEUE_FILE="$BRAIN_QUEUE" python3 "$QUEUE_MANAGER" claim "$worker_id" 2>&1) || {
        echo "[claim_task] claim failed: $result" >> "$LOGDIR/vibe-kit.log"
        return 1
    }
    # queue-manager.py returns JSON or {"error": "no_pending_tasks"}
    if echo "$result" | python3 -c "import sys,json; d=json.load(sys.stdin); sys.exit(0 if d.get('error') else 1)" 2>/dev/null; then
        return 1  # no pending tasks
    fi
    # Print id|name|description for spawn_worker consumption
    echo "$result" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f\"{d.get('id','')}|{d.get('name','')}|{d.get('description','')}\")
" 2>/dev/null
}

spawn_worker() {
    local worker_id=$1
    local task_id=$2
    local task_name=$3
    local description=$4
    local log=$LOGDIR/W${worker_id}-${task_id}.log

    echo "[$(date -u)] [$worker_id] START $task_id: $task_name" > "$log"

    (
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

Output: Describe what you completed." >> "$log" 2>&1
    ) &
    local worker_pid=$!
    echo "$worker_pid" >> $WORKDIR/.worker-pids
    echo "[$(date -u)] [$worker_id] SPAWNED $task_id PID=$worker_pid" >> $LOGDIR/vibe-kit.log
    wait_task "$worker_id" "$worker_pid" "$MAX_TASK_TIME" &
    CURRENT_WORKERS=$((CURRENT_WORKERS + 1))
}

# wait_task — waits for a specific worker PID with timeout (SIGKILL after MAX_TASK_TIME)
# Returns: 0=success, 1=timeout, 2=error
wait_task() {
    local worker_id=$1
    local worker_pid=$2
    local timeout_secs=${3:-$MAX_TASK_TIME}
    local elapsed=0
    local interval=5

    echo "[$(date -u)] [$worker_id] WAIT PID=$worker_pid (timeout=${timeout_secs}s)" >> "$LOGDIR/vibe-kit.log"

    while kill -0 "$worker_pid" 2>/dev/null; do
        if [ $elapsed -ge $timeout_secs ]; then
            echo "[$(date -u)] [$worker_id] TIMEOUT PID=$worker_pid (${timeout_secs}s) — sending SIGKILL" >> "$LOGDIR/vibe-kit.log"
            kill -KILL "$worker_pid" 2>/dev/null || true
            return 1
        fi
        sleep $interval
        elapsed=$((elapsed + interval))
    done

    wait "$worker_pid" 2>/dev/null
    local exit_code=$?
    echo "[$(date -u)] [$worker_id] DONE PID=$worker_pid exit=$exit_code" >> "$LOGDIR/vibe-kit.log"
    return 0
}

# wait_any_worker — non-blocking wait for any finished background worker
# Decrements CURRENT_WORKERS and cleans up .worker-pids for each completed worker
wait_any_worker() {
    while true; do
        local finished_pid
        # wait -n returns immediately when any bg job completes (bash 4.x+)
        finished_pid=$(wait -n 2>&1 || echo "")
        [ -z "$finished_pid" ] && break
        # Remove finished PID from tracking file
        grep -v "^${finished_pid}$" "$WORKDIR/.worker-pids" > "$WORKDIR/.worker-pids.tmp" 2>/dev/null || true
        mv "$WORKDIR/.worker-pids.tmp" "$WORKDIR/.worker-pids"
        echo "[$(date -u)] Worker PID=$finished_pid finished" >> "$LOGDIR/vibe-kit.log"
    done
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

# mark_done — atomic completion via queue-manager.py (validates worker ownership)
mark_done() {
    local task_id=$1
    local worker_id=$2
    local result=${3:-done}
    QUEUE_FILE="$BRAIN_QUEUE" python3 "$QUEUE_MANAGER" complete "$task_id" "$worker_id" "$result" >> "$LOGDIR/vibe-kit.log" 2>&1 || true
}

# heal_stale_workers — read-only detection of stale running tasks
# (auto-healing removed: queue writes must go through queue-manager.py)
heal_stale_workers() {
    QUEUE_FILE="$BRAIN_QUEUE" python3 -c "
import json, sys
try:
    with open('$BRAIN_QUEUE') as f:
        q = json.load(f)
    for t in q.get('tasks', []):
        if t.get('status') == 'running' and t.get('worker'):
            wid = t['worker']
            log_file = f'$LOGDIR/{wid}-{t[\"id\"]}.log'
            try:
                with open(log_file, 'r') as lf:
                    lines = lf.read().strip().split('\n')
                    if lines and ('DONE' in lines[-1] or 'FAIL' in lines[-1]):
                        sys.stderr.write(f'STALE: {t[\"id\"]} on {wid} (DONE={chr(68) in lines[-1]}, FAIL={chr(70) in lines[-1]})\n')
            except FileNotFoundError:
                sys.stderr.write(f'STALE_ORPHANED: {t[\"id\"]} on {wid} (log missing)\n')
except Exception as e:
    sys.stderr.write(f'heal_stale_workers error: {e}\n')
" 2>&1 || true
}

# queue_stats — atomic stats via queue-manager.py (LOCK_SH)
queue_stats() {
    QUEUE_FILE="$BRAIN_QUEUE" python3 "$QUEUE_MANAGER" stats 2>/dev/null | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f\"total={d.get('total',0)} pending={d.get('pending',0)} running={d.get('running',0)} done={d.get('done',0)} failed={d.get('failed',0)}\")
" 2>/dev/null || echo "total=0 pending=0 running=0 done=0 failed=0"
}

echo "[$(date -u)] vibe-kit.sh started (PID=$$, MAX_WORKERS=$MAX_WORKERS)" >> $LOGDIR/vibe-kit.log
START_EPOCH=$(date +%s)
update_state "looping" "idle" 0
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

    # Extract pending/running from stats (avoid redundant queue reads)
    PENDING_COUNT=$(echo "$STATS" | python3 -c "import sys; s=sys.stdin.read(); print(s.split('pending=')[1].split()[0] if 'pending=' in s else '999')" 2>/dev/null || echo "999")
    RUNNING_COUNT=$(echo "$STATS" | python3 -c "import sys; s=sys.stdin.read(); print(s.split('running=')[1].split()[0] if 'running=' in s else '0')" 2>/dev/null || echo "0")

    # Respect parallel_limit from queue (stress-test guard)
    if [ -f "$BRAIN_QUEUE" ]; then
        QUEUE_LIMIT=$(python3 -c "import json; q=json.load(open('$BRAIN_QUEUE')); print(q.get('parallel_limit', $MAX_WORKERS))" 2>/dev/null || echo "$MAX_WORKERS")
        effective_max=$((QUEUE_LIMIT < MAX_WORKERS ? QUEUE_LIMIT : MAX_WORKERS))
    else
        effective_max=$MAX_WORKERS
    fi

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

    while [ "$CURRENT_WORKERS" -lt "$effective_max" ]; do
        wait_any_worker
        CURRENT_WORKERS=$(count_workers)
        if [ "$CURRENT_WORKERS" -ge "$effective_max" ]; then
            break
        fi
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

        if [ $TASKS_SINCE_SNAPSHOT -ge $SNAPSHOT_EVERY ]; then
            snapshot_zfs "auto"
            TASKS_SINCE_SNAPSHOT=0
        fi

        sleep 1
    done

    wait_any_worker
    CURRENT_WORKERS=$(count_workers)
    update_state "running" "multi" $ELAPSED

    # React immediately to state changes (inotify) instead of fixed poll interval
    if [ "$WATCH_MODE" = "true" ] && command -v inotifywait &>/dev/null; then
        inotifywait -t 0 -e modify "$STATE" 2>/dev/null || sleep "$POLL_INTERVAL"
    else
        sleep $POLL_INTERVAL
    fi
done

# Wait for all remaining workers before shutdown
if [ -f "$WORKDIR/.worker-pids" ]; then
    while read -r pid; do
        if kill -0 "$pid" 2>/dev/null; then
            echo "[$(date -u)] Waiting for remaining PID=$pid" >> "$LOGDIR/vibe-kit.log"
            wait "$pid" 2>/dev/null || true
        fi
    done < "$WORKDIR/.worker-pids"
    rm -f "$WORKDIR/.worker-pids"
fi

echo "[$(date -u)] vibe-kit.sh stopped (elapsed=${ELAPSED}s)" >> $LOGDIR/vibe-kit.log
rm -f "$LOCK"
update_state "stopped" "idle" $ELAPSED
