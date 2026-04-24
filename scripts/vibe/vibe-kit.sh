#!/usr/bin/env bash
# vibe-kit.sh — Vibe Coding Kit: 15-micro-task-parallel mclaude runner
# Usage: vibe-kit.sh "build CRM ownership module" [--hours 8] [--parallel 15]
set -euo pipefail

MONOREPO_DIR="/srv/monorepo"
VIBE_DIR="$MONOREPO_DIR/.claude/vibe-kit"
QUEUE_FILE="$VIBE_DIR/queue.json"
STATE_FILE="$VIBE_DIR/state.json"
LOG_DIR="$VIBE_DIR/logs"
CONTEXT_DIR="$VIBE_DIR/context"
SNAPSHOT_LOG="$VIBE_DIR/snapshots.log"

mkdir -p "$VIBE_DIR" "$LOG_DIR" "$CONTEXT_DIR"

# ─── Config ─────────────────────────────────────────────────
PARALLEL="${VIBE_PARALLEL:-15}"
MAX_HOURS="${VIBE_HOURS:-8}"
PROVIDER="${VIBE_PROVIDER:-minimax}"
MODEL="${VIBE_MODEL:-MiniMax-M2.7}"
QUEUE_FILE="${QUEUE_FILE:-}"

log() { echo "[$(date '+%H:%M:%S')] [$(printf '%05d' $$)] [VIBE-KIT] $*" >&2; }

# ─── State Management ───────────────────────────────────────
save_state() {
    local phase="$1"
    local task="$2"
    local status="${3:-running}"
    local context_snippet="${4:-}"
    
    local elapsed=$(($(date +%s) - ${START_EPOCH:-$(date +%s)}))
    local hours_rem=$((MAX_HOURS - elapsed/3600))
    
    jq --arg phase "$phase" \
       --arg task "$task" \
       --arg status "$status" \
       --arg elapsed "$elapsed" \
       --arg hours_rem "$hours_rem" \
       --arg provider "$PROVIDER" \
       --arg model "$MODEL" \
       '{
           phase: $phase,
           current_task: $task,
           status: $status,
           elapsed_seconds: ($elapsed | tonumber),
           hours_remaining: ($hours_rem | tonumber),
           provider: $provider,
           model: $model,
           saved_at: now | todate
       }' > "$STATE_FILE.tmp" && mv "$STATE_FILE.tmp" "$STATE_FILE"
}

snapshot_zfs() {
    local label="$1"
    local zpool="${ZPOOL:-tank}"
    local snap="vibe-$(date +%Y%m%d-%H%M%S)-${label}"
    log "ZFS SNAPSHOT: ${zpool}@${snap}"
    sudo zfs snapshot -r "${zpool}@${snap}" 2>/dev/null && \
        echo "$(date -I) $snap" >> "$VIBE_DIR/snapshots.log" || \
        log "WARN: ZFS snapshot failed (no sudo?)"
}

# ─── SPEC → Micro-tasks ────────────────────────────────────
parse_spec_to_tasks() {
    local spec_file="$1"
    local app_name="$2"
    
    log "Parsing SPEC: $spec_file"
    
    # Strategy 1: Explicit numbered tasks
    local tasks=()
    while IFS= read -r line; do
        local task_name=$(echo "$line" | sed 's/^[0-9]*\. \[ \] //' | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | tr -cd 'a-z0-9-_')
        local task_desc=$(echo "$line" | sed 's/^[0-9]*\. \[ \] //')
        if [ -n "$task_name" ] && [ -n "$task_desc" ]; then
            tasks+=("$task_name|$task_desc")
        fi
    done < <(grep -E '^\d+\. \[ \]' "$spec_file" 2>/dev/null || true)
    
    # Strategy 2: Acceptance criteria
    if [ ${#tasks[@]} -eq 0 ]; then
        log "No explicit tasks — generating from ACs"
        while IFS= read -r line; do
            local ac=$(echo "$line" | sed 's/^- \[ \] AC-[0-9]*: //')
            if [ -n "$ac" ]; then
                local task_name=$(echo "$ac" | cut -c1-40 | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | tr -cd 'a-z0-9-_' | head -c 30)
                tasks+=("ac-$task_name|$ac")
            fi
        done < <(grep -E '^\- \[ \] AC-' "$spec_file" 2>/dev/null || true)
    fi
    
    # Strategy 3: Bugs table (extract from B1-B10 pattern, dedup)
    if [ ${#tasks[@]} -eq 0 ]; then
        log "No ACs — generating from bugs table (B1-B10 pattern)"
        local seen_bugs=""
        while IFS= read -r line; do
            local bug_id=$(echo "$line" | grep -oE 'B[0-9]+' | head -1)
            # Skip duplicate bug entries (same B1 appears twice in table)
            case "$seen_bugs" in *"$bug_id"*) continue;; esac
            seen_bugs="$seen_bugs $bug_id"
            
            local bug_desc=$(echo "$line" | awk -F'|' '{print $3}' | sed 's/^ *//' | sed 's/ *$//')
            # Skip rows where col4 = "ABERTO" (second table with status, not bugs)
            local col4=$(echo "$line" | awk -F'|' '{print $4}' | sed 's/^ *//')
            [ "$col4" = "ABERTO" ] && continue
            [ -z "$bug_desc" ] && continue
            if [ -n "$bug_id" ] && [ -n "$bug_desc" ]; then
                local task_name=$(echo "$bug_desc" | cut -c1-50 | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | tr -cd 'a-z0-9-_' | head -c 40)
                tasks+=("bug-$bug_id-$task_name|Bug $bug_id: $bug_desc")
            fi
        done < <(grep -E '^\| B[0-9]+ ' "$spec_file" 2>/dev/null || true)
    fi
    
    # Strategy 4: Module list (from tables)
    if [ ${#tasks[@]} -eq 0 ]; then
        log "No bugs — generating from module list"
        while IFS= read -r line; do
            local module=$(echo "$line" | awk '{print $1}' | tr -d '|`' | tr '[:upper:]' '[:lower:]')
            local status=$(echo "$line" | grep -oE '(Impl|Partial|Stub|FIXME)' | tr -d ' ')
            if [ -n "$module" ] && [ "$module" != "Modulo" ] && [ "$module" != "---" ]; then
                if [ "$status" = "FIXME" ] || [ "$status" = "Partial" ]; then
                    tasks+=("module-$module|Implement/complete $module module")
                fi
            fi
        done < <(grep -E '^\| [a-z]' "$spec_file" 2>/dev/null || true)
    fi
    
    # Build queue JSON
    local queue_json="[]"
    local i=1
    for task in "${tasks[@]}"; do
        local name="${task%%|*}"
        local desc="${task#*|}"
        local task_json=$(jq -n \
            --arg id "T$(printf '%03d' $i)" \
            --arg name "$name" \
            --arg desc "$desc" \
            --arg app "$app_name" \
            --arg spec "$(basename "$spec_file" .md)" \
            '{
                id: $id,
                name: $name,
                description: $desc,
                app: $app,
                spec: $spec,
                status: "pending",
                attempts: 0,
                created_at: now | todate,
                worker: null,
                log: null
            }')
        queue_json=$(echo "$queue_json" | jq ". + [$task_json]")
        i=$((i+1))
    done
    
    echo "$queue_json" | jq -S .
}

# ─── Queue Management ───────────────────────────────────────
init_queue() {
    local spec_file="$1"
    local app_name="$2"
    
    log "Initializing queue from $spec_file"
    local tasks
    tasks=$(parse_spec_to_tasks "$spec_file" "$app_name") || {
        log "ERROR: parse_spec_to_tasks failed"
        return 1
    }
    if [ -z "$tasks" ] || [ "$tasks" = "null" ]; then
        log "ERROR: parse_spec_to_tasks returned empty/null"
        return 1
    fi
    local total=$(echo "$tasks" | jq 'length' 2>/dev/null || echo 0)
    
    local queue_output
    queue_output=$(echo "$tasks" | jq --arg total "$total" --arg spec "$(basename "$spec_file" .md)" \
        '{"spec": $spec, "total": ($total | tonumber), "pending": (. | map(select(.status == "pending")) | length), "running": 0, "done": 0, "failed": 0, "tasks": .}') || {
        log "ERROR: queue_output jq failed"
        return 1
    }
    printf '%s' "$queue_output" > "$QUEUE_FILE" || {
        log "ERROR: failed to write queue file"
        return 1
    }
    
    log "Queue created: $total tasks"
}

get_pending_task() {
    local worker_id="$1"
    
    # Use Python for truly atomic claim (handles locking properly)
    local task_json
    task_json=$(QUEUE_FILE="$QUEUE_FILE" python3 "$VIBE_DIR/claim-task.py" "$worker_id" 2>/dev/null) || return 1
    
    if [ -z "$task_json" ] || echo "$task_json" | jq -e '.error' > /dev/null 2>&1; then
        return 1
    fi
    
    echo "$task_json"
}

mark_task_done() {
    local task_id="$1"
    local worker_id="$2"
    local result="$3"  # "done" | "failed"
    
    local updated=$(jq --arg tid "$task_id" --arg res "$result" --arg wid "$worker_id" \
        '.tasks |= map(if .id == $tid then .status = $res | .completed_at = (now | todate) else . end) | 
         .done = (.tasks | map(select(.status == "done")) | length) |
         .failed = (.tasks | map(select(.status == "failed")) | length) |
         .running = (.tasks | map(select(.status == "running")) | length) |
         .pending = (.tasks | map(select(.status == "pending")) | length)' \
        "$QUEUE_FILE")
    echo "$updated" > "$QUEUE_FILE.tmp" && mv "$QUEUE_FILE.tmp" "$QUEUE_FILE"
}

# ─── Worker ────────────────────────────────────────────────
worker_loop() {
    local worker_id="$1"
    local max_runtime="$2"  # seconds
    
    local worker_log="$LOG_DIR/worker-${worker_id}.log"
    local start_time=$(date +%s)
    local tasks_done=0
    
    log "[W$worker_id] Started (max ${max_runtime}s)"
    
    while true; do
        # Check time budget
        local elapsed=$(($(date +%s) - start_time))
        if [ $elapsed -ge $max_runtime ]; then
            log "[W$worker_id] Time budget exhausted ($elapsed >= $max_runtime)"
            break
        fi
        
        # Check queue completion
        local remaining=$(jq '.pending + .running' "$QUEUE_FILE" 2>/dev/null || echo "0")
        if [ "$remaining" -eq 0 ] || [ "$remaining" = "null" ]; then
            log "[W$worker_id] Queue empty — done"
            break
        fi
        
        # Claim a task
        local task
        task=$(get_pending_task "$worker_id") || {
            # No pending tasks, wait and retry
            sleep 2
            continue
        }
        
        local task_id=$(echo "$task" | jq -r '.id')
        local task_name=$(echo "$task" | jq -r '.name')
        local task_desc=$(echo "$task" | jq -r '.description')
        local app=$(echo "$task" | jq -r '.app')
        local spec=$(echo "$task" | jq -r '.spec')
        
        log "[W$worker_id] → Task $task_id: $task_name"
        
        # Build mclaude prompt
        local prompt="You are worker-$worker_id implementing micro-task.

APP: $app
SPEC: $spec
TASK ID: $task_id
TASK: $task_name
DESCRIPTION: $task_desc

Working directory: $MONOREPO_DIR/apps/$app

Execute this task completely. When done, output:
[COMPLETE] task_id=$task_id result=done
If you cannot complete, output:
[COMPLETE] task_id=$task_id result=failed reason=...

Save your work to: $CONTEXT_DIR/${task_id}.ctx
Files modified: list them in the [COMPLETE] output."

        # Run mclaude headless
        local task_start=$(date +%s)
        local mclaude_output
        local mclaude_exit=0
        
        mclaude_output=$(mclaude --provider "$PROVIDER" --model "$MODEL" \
            -p "$prompt" 2>&1) || mclaude_exit=$?
        
        local task_duration=$(($(date +%s) - task_start))
        
        # Parse result
        local result="done"
        if echo "$mclaude_output" | grep -q "result=failed"; then
            result="failed"
        fi
        
        # Log output
        echo "=== [W$worker_id] Task $task_id | ${task_duration}s | $result ===" >> "$worker_log"
        echo "$mclaude_output" >> "$worker_log"
        echo "" >> "$worker_log"
        
        # Save context snippet
        echo "$mclaude_output" | tail -50 > "$CONTEXT_DIR/${task_id}.ctx"
        
        # Mark done
        mark_task_done "$task_id" "$worker_id" "$result"
        tasks_done=$((tasks_done+1))
        
        log "[W$worker_id] ← Task $task_id: $result (${task_duration}s) [total: $tasks_done]"
        
        # Checkpoint: save state every 3 tasks
        if [ $((tasks_done % 3)) -eq 0 ]; then
            save_state "coding" "$task_id" "running"
            snapshot_zfs "checkpoint-$task_id"
        fi
    done
    
    log "[W$worker_id] Finished. Tasks done: $tasks_done"
    echo "$tasks_done" > "$LOG_DIR/worker-${worker_id}-done"
}

# ─── Progress Reporter ──────────────────────────────────────
report_progress() {
    local queue=$(cat "$QUEUE_FILE" 2>/dev/null || echo "{}")
    local total=$(echo "$queue" | jq '.total // 0')
    local done=$(echo "$queue" | jq '.done // 0')
    local failed=$(echo "$queue" | jq '.failed // 0')
    local pending=$(echo "$queue" | jq '.pending // 0')
    local running=$(echo "$queue" | jq '.running // 0')
    local elapsed=$(($(date +%s) - ${START_EPOCH:-$(date +%s)}))
    local hours_rem=$((MAX_HOURS - elapsed/3600))
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  VIBE-KIT PROGRESS — $(date '+%H:%M:%S')"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  Elapsed: ${elapsed}s | Remaining: ~${hours_rem}h"
    echo "  Queue:   $total total"
    echo "  Status:  $done done | $failed failed | $running running | $pending pending"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    # Show failed tasks
    if [ "$failed" -gt 0 ]; then
        echo "  FAILED:"
        echo "$queue" | jq -r '.tasks[] | select(.status == "failed") | "  - \(.id): \(.name) (\(.completed_at // "never"))"' 2>/dev/null
    fi
    
    # Show running workers
    echo "  RUNNING:"
    echo "$queue" | jq -r '.tasks[] | select(.status == "running") | "  - \(.id) on \(.worker // "?"): \(.name)"' 2>/dev/null
    
    echo ""
}

# ─── Gitea PR on completion ─────────────────────────────────
ship_to_gitea() {
    log "Shipping to Gitea..."
    
    local branch="vibe-$(date +%Y%m%d-%H%M%S)"
    local spec_name=$(jq -r '.spec // "unknown"' "$QUEUE_FILE" 2>/dev/null || echo "unknown")
    
    cd "$MONOREPO_DIR"
    
    # Create branch
    git checkout -b "$branch" 2>/dev/null || git checkout "$branch" 2>/dev/null
    
    # Stage all changes
    git add -A
    
    # Commit
    git commit -m "vibe: $spec_name completed

$(jq -r '.tasks[] | select(.status == "done") | "- \(.id): \(.name)"' "$QUEUE_FILE" 2>/dev/null)" \
        2>/dev/null || true
    
    # Push
    git push -u gitea "$branch" 2>/dev/null || git push -u origin "$branch" 2>/dev/null || {
        log "WARN: Push failed — changes committed locally"
        return 0
    }
    
    # Create PR via Gitea API
    if [ -n "${GITEA_TOKEN:-}" ]; then
        local repo=$(git remote get-url gitea 2>/dev/null | sed 's/git@[^:]*://' | sed 's/\.git//' | sed 's/.*://')
        local gitea_url="https://gitea.zappro.site/api/v1/repos/$repo/pulls"
        
        curl -s -X POST "$gitea_url" \
            -H "Authorization: Bearer $GITEA_TOKEN" \
            -H "Content-Type: application/json" \
            -d "{
                \"title\": \"vibe: $spec_name completed\",
                \"body\": \"Auto-generated by vibe-kit\\n\\nTasks: $(jq '.done' "$QUEUE_FILE") done, $(jq '.failed' "$QUEUE_FILE") failed\",
                \"head\": \"$branch\",
                \"base\": \"main\"
            }" 2>/dev/null || true
    fi
    
    log "Shipped: $branch"
}

# ─── Main ──────────────────────────────────────────────────
main() {
    local input="${1:-}"
    local hours="${VIBE_HOURS:-8}"
    local parallel="${VIBE_PARALLEL:-15}"
    
    START_EPOCH=$(date +%s)
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  ⭐ VIBE-KIT — 15× Micro-Task Parallel"
    echo "  Provider: $PROVIDER | Model: $MODEL | Parallel: $parallel"
    echo "  Max duration: ${hours}h"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    # ── Step 1: Get SPEC and app ──────────────────────────
    if [ -z "$input" ]; then
        echo "Usage: vibe-kit.sh \"build CRM ownership module\" [--hours 8] [--parallel 15]"
        echo ""
        echo "Or set SPEC directly:"
        echo "  SPEC=SPEC-068 APP=crm-ownership vibe-kit.sh"
        exit 1
    fi
    
    # Resolve SPEC
    local spec_file=""
    local app_name=""
    
    if [ -n "${SPEC:-}" ]; then
        spec_file="$MONOREPO_DIR/docs/SPECS/${SPEC}.md"
        app_name="${APP:-}"
    elif [ -f "$input" ]; then
        spec_file="$input"
        app_name="${APP:-$(dirname "$input" | xargs basename)}"
    else
        # Search for matching SPEC
        spec_file=$(find "$MONOREPO_DIR/docs/SPECS" -name "*.md" -exec grep -l "$input" {} \; 2>/dev/null | head -1)
        if [ -z "$spec_file" ]; then
            log "No SPEC found for: $input"
            exit 1
        fi
        app_name="${APP:-$(echo "$input" | tr '[:upper:]' '[:lower:]' | tr ' ' '-')}"
    fi
    
    if [ ! -f "$spec_file" ]; then
        log "SPEC not found: $spec_file"
        exit 1
    fi
    
    log "SPEC: $spec_file"
    log "APP: $app_name"
    
    # ── Step 2: Init queue (only if not already exists) ───
    if [ -f "$QUEUE_FILE" ] && [ "$(jq '.total' "$QUEUE_FILE" 2>/dev/null)" != "null" ] && [ "$(jq '.total' "$QUEUE_FILE" 2>/dev/null || echo 0)" -gt 0 ]; then
        log "Queue already exists: $QUEUE_FILE ($(jq '.pending' "$QUEUE_FILE") pending)"
    else
        init_queue "$spec_file" "$app_name"
    fi
    
    # ── Step 3: Snapshot before start ───────────────────
    snapshot_zfs "pre-vibe-kit"
    
    # ── Step 4: Save initial state ───────────────────────
    save_state "init" "queue-ready" "running"
    
    # ── Step 5: Launch parallel workers ──────────────────
    local max_runtime=$((hours * 3600))
    local pids=()
    
    log "Launching $parallel workers..."
    
    for i in $(seq 1 "$parallel"); do
        (
            worker_loop "W$(printf '%02d' $i)" "$max_runtime"
        ) >> "$LOG_DIR/worker-$(printf '%02d' $i).log" 2>&1 &
        pids+=($!)
    done
    
    log "All $parallel workers launched (PIDs: ${pids[*]})"
    
    # ── Step 6: Progress monitor loop ────────────────────
    local report_interval=60  # seconds
    local last_report=0
    
    while true; do
        sleep 5
        
        # Check if all workers died
        local alive=0
        for pid in "${pids[@]}"; do
            if kill -0 $pid 2>/dev/null; then
                alive=$((alive+1))
            fi
        done
        
        if [ $alive -eq 0 ]; then
            log "All workers finished"
            break
        fi
        
        # Periodic progress report
        local now=$(date +%s)
        if [ $((now - last_report)) -ge $report_interval ]; then
            report_progress
            last_report=$now
            
            # Check time budget
            local elapsed=$(($(date +%s) - START_EPOCH))
            if [ $elapsed -ge $max_runtime ]; then
                log "Time budget exhausted — killing workers"
                for pid in "${pids[@]}"; do
                    kill $pid 2>/dev/null || true
                done
                break
            fi
        fi
    done
    
    # ── Step 7: Wait for all workers ─────────────────────
    for pid in "${pids[@]}"; do
        wait $pid 2>/dev/null || true
    done
    
    # ── Step 8: Final snapshot ───────────────────────────
    snapshot_zfs "post-vibe-kit"
    
    # ── Step 9: Report final status ──────────────────────
    report_progress
    
    # ── Step 10: Ship to Gitea ─────────────────────────
    local total_done=$(jq '.done' "$QUEUE_FILE" 2>/dev/null || echo "0")
    local total_failed=$(jq '.failed' "$QUEUE_FILE" 2>/dev/null || echo "0")
    
    log "Final: $total_done done, $total_failed failed"
    
    if [ "$total_done" -gt 0 ] && [ "$total_failed" -le 5 ]; then
        ship_to_gitea
    elif [ "$total_failed" -gt 5 ]; then
        log "Too many failures ($total_failed) — skipping ship"
    fi
    
    save_state "done" "all" "complete"
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  VIBE-KIT COMPLETE"
    echo "  Done: $total_done | Failed: $total_failed"
    echo "  Logs: $LOG_DIR/"
    echo "  Queue: $QUEUE_FILE"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
}

main "$@"
