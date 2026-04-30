#!/bin/bash
set -euo pipefail

WORKDIR="/srv/monorepo/.claude/vibe-kit"
QUEUE_FILE="$WORKDIR/queue.json"
STATE_FILE="$WORKDIR/state.json"
LOG_DIR="$WORKDIR/logs"
RUNNING_FILE="$WORKDIR/.running_tasks.json"
MAX_WORKERS="${VIBE_PARALLEL:-5}"
MAX_HOURS="${VIBE_HOURS:-8}"
PROVIDER="${VIBE_PROVIDER:-minimax}"
MODEL="${VIBE_MODEL:-MiniMax-M2.7}"
POLL_INTERVAL=5
SNAPSHOT_EVERY=3
SMOKE_MAX_RETRIES=3

SCRIPT_CONTEXT_RESET="/srv/monorepo/scripts/context-reset.sh"
SCRIPT_SMOKE_RUNNER="/srv/monorepo/scripts/smoke-runner.sh"
SCRIPT_NOTIFY_COMPLETE="/srv/monorepo/scripts/notify-complete.sh"

# ─── Ensure directories exist ───────────────────────────────
mkdir -p "$WORKDIR/logs" "$WORKDIR/context"

# ─── SIGCHLD handler ───────────────────────────────────────
handle_sigchld() {
    local pid
    while IFS= read -r pid; do
        wait "$pid" 2>/dev/null || true
        if [ -f "$RUNNING_FILE" ]; then
            jq "map(select(.pid != $pid))" "$RUNNING_FILE" > "$RUNNING_FILE.tmp" 2>/dev/null && \
                mv "$RUNNING_FILE.tmp" "$RUNNING_FILE" || true
        fi
    done < <(jobs -p 2>/dev/null || true)
}

trap handle_sigchld CHLD

# ─── Lead: think + delegate ─────────────────────────────────
lead_think() {
    local spec_file="$1"
    local app_name="$2"

    local tasks
    tasks=$(python3 -c "
import re, json

with open('$spec_file') as f:
    content = f.read()

# Strategy 1: numbered tasks
tasks = []
for line in content.split('\n'):
    m = re.match(r'^\d+\. \[ \] (.+)', line)
    if m:
        desc = m.group(1).strip()
        name = re.sub(r'[^a-z0-9]+', '-', desc.lower())[:40]
        tasks.append({'id': f'T{len(tasks)+1:03d}', 'name': name, 'description': desc})

# Strategy 2: AC lines
if not tasks:
    for line in content.split('\n'):
        m = re.match(r'^\- \[ \] AC-\d+: (.+)', line)
        if m:
            desc = m.group(1).strip()
            name = 'ac-' + re.sub(r'[^a-z0-9]+', '-', desc.lower())[:30]
            tasks.append({'id': f'T{len(tasks)+1:03d}', 'name': name, 'description': desc})

# Strategy 3: bug table
if not tasks:
    for line in content.split('\n'):
        m = re.search(r'\| B(\d+) \| ([^|]+) \|', line)
        if m:
            bug_id = m.group(1)
            desc = m.group(2).strip()
            name = f'bug-{bug_id}-{re.sub(r\"[^a-z0-9]+\", \"-\", desc.lower())[:30]}'
            tasks.append({'id': f'T{len(tasks)+1:03d}', 'name': name, 'description': f'Bug B{bug_id}: {desc}'})

print(json.dumps(tasks))
" 2>/dev/null)

    if [ -z "$tasks" ] || [ "$tasks" = "null" ]; then
        echo "ERROR: lead could not parse any tasks from SPEC" >&2
        return 1
    fi

    local total
    total=$(echo "$tasks" | jq "length")

    echo "$tasks" | jq --arg spec "$(basename "$spec_file" .md)" --arg app "$app_name" --argjson total "$total" "
        {
            spec: \$spec,
            app: \$app,
            total: \$total,
            pending: \$total,
            running: 0,
            done: 0,
            failed: 0,
            frozen: 0,
            phase: \"do\",
            parallel_limit: $MAX_WORKERS,
            tasks: [.[] | . + {
                app: \$app,
                spec: \$spec,
                status: \"pending\",
                attempts: 0,
                worker: null,
                created_at: now | todate,
                completed_at: null,
                error: null
            }]
        }
    " > "$QUEUE_FILE"

    echo "Lead: created queue with $total tasks"
}

# ─── Do: spawn + monitor workers ───────────────────────────
do_loop() {
    local max_runtime=$(($MAX_HOURS * 3600))
    local start_epoch
    start_epoch=$(date +%s)
    local tasks_since_snapshot=0
    local total_done=0
    local total_failed=0

    while true; do
        local elapsed=$(($(date +%s) - start_epoch))
        [ $elapsed -ge $max_runtime ] && break

        # Load running count from JSON
        local running_count=0
        if [ -f "$RUNNING_FILE" ]; then
            running_count=$(jq "length" "$RUNNING_FILE" 2>/dev/null || echo 0)
        fi

        # Check queue
        local pending queue_total
        pending=$(jq ".pending" "$QUEUE_FILE" 2>/dev/null || echo 0)
        queue_total=$(jq ".total" "$QUEUE_FILE" 2>/dev/null || echo 0)

        if [ "$pending" -eq 0 ] && [ "$running_count" -eq 0 ]; then
            echo "Queue empty. Done."
            break
        fi

        # Spawn up to available slots
        while [ "$running_count" -lt "$MAX_WORKERS" ] && [ "$pending" -gt 0 ]; do
            local task_json
            task_json=$(QUEUE_FILE="$QUEUE_FILE" python3 "$WORKDIR/queue-manager.py" claim "W$$" 2>/dev/null)

            if [ -z "$task_json" ] || echo "$task_json" | jq -e ".error" > /dev/null 2>&1; then
                break
            fi

            local task_id task_name description app
            task_id=$(echo "$task_json" | jq -r ".id")
            task_name=$(echo "$task_json" | jq -r ".name")
            description=$(echo "$task_json" | jq -r ".description")
            app=$(echo "$task_json" | jq -r ".app")

            # Before task: call context-reset.sh
            echo "Resetting context for $task_id..."
            bash "$SCRIPT_CONTEXT_RESET" "$task_id" 2>/dev/null || true

            (
                local worker_result="done"
                mclaude --provider "$PROVIDER" --model "$MODEL" -p "You are worker-$$.
APP: $app
TASK: $task_name
DESCRIPTION: $description

Working directory: /srv/monorepo

Execute completely. Output [COMPLETE] task_id=$task_id result=done when done.
If you cannot complete, output [COMPLETE] task_id=$task_id result=failed reason=...

Save your work context to: $WORKDIR/context/${task_id}.ctx" \
                >> "$LOG_DIR/worker-$$.log" 2>&1

                if grep -q "result=failed" "$LOG_DIR/worker-$$.log" 2>/dev/null; then
                    worker_result="failed"
                fi

                # After worker completes: run smoke-runner.sh with retry
                local smoke_exit=0
                local smoke_attempts=0
                local smoke_output
                while [ $smoke_attempts -lt $SMOKE_MAX_RETRIES ]; do
                    smoke_output=$(bash "$SCRIPT_SMOKE_RUNNER" 2>&1) || smoke_exit=$?
                    if [ $smoke_exit -eq 0 ]; then
                        break
                    fi
                    smoke_attempts=$((smoke_attempts + 1))
                    echo "Smoke attempt $smoke_attempts/$SMOKE_MAX_RETRIES failed for $task_id, retrying..." >&2
                    sleep 2
                done

                if [ $smoke_exit -ne 0 ]; then
                    echo "Smoke FAILED after $SMOKE_MAX_RETRIES retries for $task_id" >&2
                    worker_result="failed"
                fi

                QUEUE_FILE="$QUEUE_FILE" python3 "$WORKDIR/queue-manager.py" complete "$task_id" "W$$" "$worker_result" 2>/dev/null || true
            ) &

            # Track running worker
            local worker_entry
            worker_entry=$(jq -n --argjson pid $! --arg id "$task_id" "{pid: \$pid, task_id: \$id}")
            if [ -f "$RUNNING_FILE" ]; then
                jq ". + [$worker_entry]" "$RUNNING_FILE" > "$RUNNING_FILE.tmp" && mv "$RUNNING_FILE.tmp" "$RUNNING_FILE"
            else
                echo "[$worker_entry]" > "$RUNNING_FILE"
            fi

            running_count=$((running_count + 1))
            pending=$((pending - 1))

            echo "Spawned worker for $task_id (running: $running_count)"
        done

        # Snapshot every N tasks
        tasks_since_snapshot=$((tasks_since_snapshot + 1))
        if [ $tasks_since_snapshot -ge $SNAPSHOT_EVERY ]; then
            sudo zfs snapshot "tank@vibe-pre-$(date +%Y%m%d-%H%M%S)" 2>/dev/null || true
            tasks_since_snapshot=0
        fi

        sleep $POLL_INTERVAL
    done
}

# ─── Verify ───────────────────────────────────────────────
do_verify() {
    echo "=== VERIFY PHASE ==="
    local failed=0

    for cmd in "pnpm test" "pnpm tsc --noEmit" "pnpm lint"; do
        echo "Running: $cmd"
        if ! eval "$cmd" > /dev/null 2>&1; then
            echo "FAILED: $cmd"
            failed=$((failed + 1))
        else
            echo "PASSED: $cmd"
        fi
    done

    if [ $failed -gt 0 ]; then
        echo "VERIFY FAILED: $failed commands failed"
        return 1
    fi
    echo "VERIFY PASSED"
    return 0
}

# ─── Main ─────────────────────────────────────────────────
main() {
    local spec="${1:-}"
    local app="${2:-}"
    local phase="${VIBE_PHASE:-}"
    local overall_exit=0

    if [ -z "$spec" ]; then
        echo "Usage: run-vibe.sh <SPEC> [app] [--plan|--do|--verify]"
        echo "  Or set SPEC=... APP=... VIBE_PHASE=..."
        exit 1
    fi

    local spec_file="/srv/monorepo/docs/SPECS/${spec}.md"
    if [ ! -f "$spec_file" ]; then
        echo "SPEC not found: $spec_file"
        exit 1
    fi

    case "$phase" in
        plan)
            lead_think "$spec_file" "$app"
            ;;
        do)
            do_loop
            overall_exit=$?
            ;;
        verify)
            do_verify
            overall_exit=$?
            ;;
        *)
            # Default: run full pipeline
            lead_think "$spec_file" "$app" || overall_exit=1
            do_loop || overall_exit=1
            do_verify || overall_exit=1
            ;;
    esac

    # Collect stats for notify-complete.sh
    local done_count failed_count
    done_count=$(jq ".done" "$QUEUE_FILE" 2>/dev/null || echo 0)
    failed_count=$(jq ".failed" "$QUEUE_FILE" 2>/dev/null || echo 0)

    # Ship on completion
    if [ "$done_count" -gt 0 ] && [ "$failed_count" -le 5 ]; then
        git checkout -b "vibe-$(date +%Y%m%d-%H%M%S)" 2>/dev/null || true
        git add -A 2>/dev/null || true
        git commit -m "vibe: $spec completed ($done_count done, $failed_count failed)" 2>/dev/null || true
    fi

    # Final notification with exit code and stats
    bash "$SCRIPT_NOTIFY_COMPLETE" "$overall_exit" "$done_count" "$failed_count" 2>/dev/null || true

    exit $overall_exit
}

main "$@"
