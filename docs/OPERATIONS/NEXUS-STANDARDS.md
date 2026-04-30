# Nexus Standards — Enterprise Operations

Enterprise-grade operational standards for Nexus autonomous pipeline execution.

---

## 1. Script Standards

### Error Handling

```bash
# ✅ DO — propagate errors with set -e, validate inputs early
set -euo pipefail
IFS=$'\n\t'

validate_input() {
    [[ -z "${1:-}" ]] && { echo "ERROR: input required" >&2; return 1; }
    return 0
}

main() {
    local input="${1:-}"
    validate_input "$input" || exit 1
    # ... proceed
}
main "$@"

# ❌ DON'T — silent failures, unvalidated variables, set +e
set +e
if [ -f $FILE ]; then
    cat $FILE
fi
```

### Logging

```bash
# ✅ DO — structured logs with timestamps, log levels, context
log() { echo "[$(date +%H:%M:%S)] $*"; }
log_info()  { log "INFO:  $*" | tee -a "$LOG_FILE"; }
log_warn()  { log "WARN:  $*" | tee -a "$LOG_FILE"; }
log_error() { log "ERROR: $*" | tee -a "$LOG_FILE" >&2; }

log_info "Task started" "task_id=$TASK_ID" "worker=$WORKER_ID"

# ❌ DON'T — echo without context, print secrets, unbuffered output
echo "Done"
echo $API_KEY
```

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 2 | Usage error (bad arguments) |
| 3 | Validation failure |
| 4 | Lock contention |
| 5 | Resource not found |
| 6 | Transient error (retryable) |
| 7 | Configuration error |
| 8 | Timeout |
| 10+ | Custom application codes |

```bash
# ✅ DO — named exit codes, never use 0 for failures
readonly EXIT_SUCCESS=0
readonly EXIT_ERROR=1
readonly EXIT_LOCK_FAILED=4

acquire_lock() {
    flock -n "$LOCK_FILE" || exit $EXIT_LOCK_FAILED
}

# ❌ DON'T — exit 1 for everything, no distinction between error types
[ $? -ne 0 ] && exit 1
```

---

## 2. Queue Operations

### Atomic Operations

```bash
# ✅ DO — use file locking + atomic rename for queue state
enqueue() {
    local task_id="$1"
    local queue_file="/srv/nexus/queue/tasks.json"
    local tmp_file
    tmp_file=$(mktemp)

    (
        flock -u 200 || exit 1
        local content
        content=$(cat "$queue_file" 2>/dev/null || echo '[]')
        local new_entry
        new_entry=$(jq -n --arg id "$task_id" \
            --argjson now "$(date +%s)" \
            '{id: $id, created_at: $now, status: "pending"}')
        echo "$content" | jq ". += [$new_entry]" > "$tmp_file"
        mv "$tmp_file" "$queue_file"
    ) 200>"$LOCK_FILE"
}

# ❌ DON'T — read-modify-write without locking, race conditions
tasks=$(cat queue.json)
echo "$tasks" | jq ". += [{id: \"$task_id\"}]" > queue.json
```

### Distributed Locking

```bash
# ✅ DO — exclusive lock with timeout, release on exit
LOCK_FILE="/srv/nexus/locks/process.lock"
LOCK_TIMEOUT=30

acquire_lock() {
    flock -x -w "$LOCK_TIMEOUT" "$LOCK_FILE" || {
        log_error "Lock acquisition timed out" "lock=$LOCK_FILE"
        return $EXIT_LOCK_FAILED
    }
    log_info "Lock acquired" "lock=$LOCK_FILE"
}

release_lock() {
    flock -u "$LOCK_FILE" && log_info "Lock released" "lock=$LOCK_FILE"
}

with_lock() {
    acquire_lock || return $?
    trap release_lock EXIT
    "$@"
}

# ❌ DON'T — no timeout, forgotten unlocks, trap without cleanup
flock -e "$LOCK" ./script.sh
# lock never released if script crashes
```

### Retry with Backoff

```bash
# ✅ DO — exponential backoff, max attempts, jitter
retry_with_backoff() {
    local max_attempts=${MAX_ATTEMPTS:-5}
    local base_delay=${BASE_DELAY:-2}
    local task_id="$1"; shift
    local attempt=1

    while (( attempt <= max_attempts )); do
        if "$@"; then
            log_info "Succeeded after $attempt attempt(s)" "task=$task_id"
            return 0
        fi

        local delay=$(( base_delay * (2 ** (attempt - 1)) ))
        local jitter=$(( RANDOM % 5 ))
        local sleep_time=$(( delay + jitter ))

        log_warn "Attempt $attempt/$max_attempts failed" \
            "task=$task_id" "retry_in=${sleep_time}s"

        sleep "$sleep_time"
        (( attempt++ ))
    done

    log_error "All $max_attempts attempts failed" "task=$task_id"
    return $EXIT_ERROR
}

# ❌ DON'T — fixed sleep, no attempt tracking, swallow failures
sleep 5
$@
sleep 5
$@
```

---

## 3. Context Management

### Reset Per Task

```bash
# ✅ DO — fresh context for each task, isolated env
TASK_CONTEXT_DIR="/srv/nexus/context/tasks/${TASK_ID}"
mkdir -p "$TASK_CONTEXT_DIR"

export NEXUS_TASK_ID="$TASK_ID"
export NEXUS_CONTEXT_DIR="$TASK_CONTEXT_DIR"
export NEXUS_COMPACTION_COUNT=0

# Load base context, not accumulated state
export NEXUS_BASE_CONTEXT="${NEXUS_BASE_CONTEXT:-/srv/nexus/context/base.json}"

reset_task_context() {
    local task_id="$1"
    export NEXUS_TASK_ID="$task_id"
    export NEXUS_CONTEXT_DIR="/srv/nexus/context/tasks/$task_id"
    export NEXUS_COMPACTION_COUNT=0
    # Do not inherit WORKER_ID or previous TASK_ID
    unset NEXUS_PREV_TASK_ID
}

# ❌ DON'T — carry forward context variables, mutate global state
export ACCUMULATED_STATE="$((ACCUMULATED_STATE + 1))"
```

### Context Compaction

```bash
# ✅ DO — trigger compaction when context exceeds threshold
readonly CONTEXT_MAX_TOKENS=150000
readonly COMPACTION_THRESHOLD=120000

check_and_compact() {
    local context_size=${1:-0}

    if (( context_size > COMPACTION_THRESHOLD )); then
        log_info "Compaction triggered" \
            "size=$context_size" "threshold=$COMPACTION_THRESHOLD"

        local compacted
        compacted=$(jq -n \
            --argjson size "$context_size" \
            --argjson threshold "$CONTEXT_MAX_TOKENS" \
            '{action: "compact", target_size: $threshold * 3 / 4, reason: "threshold_exceeded"}')

        echo "$compact"
        log_info "Compaction completed" "new_size=$?"
    fi
}

# ❌ DON'T — let context grow unbounded, no compaction trigger
# unbounded growth → degraded performance, truncated responses
```

---

## 4. Worker Patterns

### Spawn Worker

```bash
# ✅ DO — isolate worker process, pass task_id, clean env
spawn_worker() {
    local task_id="$1"
    local worker_id
    worker_id="worker-$(date +%s)-$$"

    (
        export NEXUS_WORKER_ID="$worker_id"
        export NEXUS_TASK_ID="$task_id"
        export NEXUS_STARTED_AT="$(date +%s)"

        log_info "Worker spawned" \
            "worker=$worker_id" "task=$task_id"

        exec ./worker.sh "$task_id"
    ) &

    echo $!
}

# ❌ DON'T — reuse worker ID, share parent environment, fork without exec
./worker.sh &
WORKER_PID=$!
```

### Monitor Worker

```bash
# ✅ DO — heartbeat, timeout detection, graceful termination
MONITOR_INTERVAL=10
WORKER_TIMEOUT=300

monitor_worker() {
    local worker_pid=$1
    local task_id=$2
    local start_time=$(date +%s)

    while kill -0 "$worker_pid" 2>/dev/null; do
        local elapsed=$(( $(date +%s) - start_time ))

        if (( elapsed > WORKER_TIMEOUT )); then
            log_warn "Worker timeout exceeded, terminating" \
                "worker_pid=$worker_pid" "task=$task_id" "elapsed=${elapsed}s"
            kill -TERM "$worker_pid" 2>/dev/null
            sleep 5
            kill -KILL "$worker_pid" 2>/dev/null
            return $EXIT_TIMEOUT
        fi

        log_info "Worker alive" "worker_pid=$worker_pid" \
            "task=$task_id" "elapsed=${elapsed}s"

        sleep "$MONITOR_INTERVAL"
    done

    wait "$worker_pid"
    local exit_code=$?
    log_info "Worker exited" "worker_pid=$worker_pid" \
        "task=$task_id" "exit_code=$exit_code"
    return $exit_code
}

# ❌ DON'T — no timeout, no heartbeat, zombie processes
wait $WORKER_PID
```

### Worker Completion

```bash
# ✅ DO — atomic completion marker, cleanup, signal parent
complete_task() {
    local task_id="$1"
    local status="${2:-success}"
    local exit_code="${3:-0}"

    local completed_file="/srv/nexus/tasks/$task_id/completed.json"
    local tmp_file
    tmp_file=$(mktemp)

    jq -n \
        --arg id "$task_id" \
        --arg status "$status" \
        --argjson exit_code "$exit_code" \
        --argjson completed_at "$(date +%s)" \
        '{id: $id, status: $status, exit_code: $exit_code, completed_at: $completed_at}' \
        > "$tmp_file"

    mv "$tmp_file" "$completed_file"
    log_info "Task completed" "task=$task_id" "status=$status" "exit_code=$exit_code"

    # Cleanup task context
    rm -rf "/srv/nexus/context/tasks/$task_id"
}

# ❌ DON'T — write to file without atomic rename, leave orphans
echo "status=done" > /srv/nexus/tasks/$task_id/completed.txt
```

---

## 5. Testing Standards

### Smoke Tests

```bash
# ✅ DO — fast, isolated, deterministic smoke test
smoke_test_suite() {
    local failed=0

    smoke_test_queue_ops() {
        local test_queue
        test_queue=$(mktemp -d)
        export QUEUE_DIR="$test_queue"
        export LOCK_DIR=$(mktemp -d)

        # Enqueue
        enqueue "task-001"
        local count
        count=$(jq 'length' "$QUEUE_DIR/tasks.json")
        (( count == 1 )) || { echo "FAIL: enqueue"; return 1; }

        # Dequeue
        dequeue "task-001"
        count=$(jq 'length' "$QUEUE_DIR/tasks.json")
        (( count == 0 )) || { echo "FAIL: dequeue"; return 1; }

        rm -rf "$test_queue"
        return 0
    }

    smoke_test_locking() {
        local lock_file
        lock_file=$(mktemp)
        export LOCK_FILE="$lock_file"

        # Simulate concurrent acquisition
        (acquire_lock) &
        local pid1=$!
        sleep 1
        (acquire_lock) &
        local pid2=$!

        wait $pid1
        local result1=$?
        wait $pid2
        local result2=$?

        # One should succeed, one should fail
        (( (result1 == 0 && result2 != 0) || (result1 != 0 && result2 == 0) )) \
            || { echo "FAIL: lock contention"; return 1; }

        rm -f "$lock_file"
        return 0
    }

    smoke_test_queue_ops || (( failed++ ))
    smoke_test_locking || (( failed++ ))

    return $failed
}

# ❌ DON'T — smoke tests that require external services, slow execution
# smoke test touching real queue, network calls, secrets
```

### Stress Tests

```bash
# ✅ DO — configurable concurrency, metrics, failure threshold
STRESS_TEST_CONCURRENCY=${STRESS_TEST_CONCURRENCY:-50}
STRESS_TEST_DURATION=${STRESS_TEST_DURATION:-60}
STRESS_TEST_FAILURE_THRESHOLD=${STRESS_TEST_FAILURE_THRESHOLD:-0.05}

stress_test_queue() {
    local start_time
    start_time=$(date +%s)
    local end_time=$(( start_time + STRESS_TEST_DURATION ))
    local total=0
    local failures=0

    while (( $(date +%s) < end_time )); do
        (
            local tid
            tid="stress-$(date +%s%N)"
            enqueue "$tid" || exit 1
            dequeue "$tid" || exit 1
        ) &

        (( total++ ))
        (( total % STRESS_TEST_CONCURRENCY == 0 )) && wait

        # Check for failures periodically
        if (( total % 100 == 0 )); then
            local rate
            rate=$(echo "scale=2; $failures / $total" | bc)
            echo "Progress: $total total, $failures failures, rate=${rate}"
        fi
    done

    wait

    local failure_rate
    failure_rate=$(echo "scale=4; $failures / $total" | bc)
    local max_allowed
    max_allowed=$(echo "scale=4; $STRESS_TEST_FAILURE_THRESHOLD" | bc)

    echo "STRESS RESULT: total=$total failures=$failures rate=$failure_rate"

    # Compare as strings due to bc output format
    local passes_threshold
    passes_threshold=$(echo "$failure_rate <= $max_allowed" | bc)
    (( passes_threshold == 1 )) || {
        echo "FAIL: failure rate $failure_rate exceeds threshold $max_allowed"
        return 1
    }
}

# ❌ DON'T — hardcoded concurrency, no failure threshold, no metrics
for i in {1..1000}; do ./enqueue.sh; done
```

### Benchmarks

```bash
# ✅ DO — reproducible benchmarks with warmup, stats
benchmark_enqueue() {
    local iterations=${1:-100}
    local warmup=${2:-10}

    # Warmup
    for (( i=0; i<warmup; i++ )); do
        enqueue "warmup-$i" >/dev/null 2>&1
    done

    # Benchmark
    local total_time=0
    for (( i=0; i<iterations; i++ )); do
        local task_id
        task_id="bench-$i-$(date +%s%N)"

        local start
        start=$(date +%s%N)

        enqueue "$task_id"

        local end
        end=$(date +%s%N)
        total_time=$(( total_time + (end - start) ))
    done

    local avg_ns=$(( total_time / iterations ))
    local avg_ms
    avg_ms=$(echo "scale=3; $avg_ns / 1000000" | bc)

    jq -n \
        --argjson iterations "$iterations" \
        --arg avg_ms "$avg_ms" \
        --argjson avg_ns "$avg_ns" \
        '{operation: "enqueue", iterations: $iterations, avg_ms: $avg_ms, avg_ns: $avg_ns}'
}

# ❌ DON'T — single run, no warmup, no statistical significance
echo "Testing once..."
time ./enqueue.sh
```

---

## 6. Deployment Standards

### CI/CD Pipeline

```bash
# ✅ DO — staged pipeline, each stage validates before proceeding
STAGES="validate build test deploy"

Nexus_pipeline() {
    for stage in $STAGES; do
        log_info "Running stage" "stage=$stage"

        case "$stage" in
            validate)
                ./scripts/validate.sh || { log_error "Validation failed"; exit 1; }
                ;;
            build)
                ./scripts/build.sh || { log_error "Build failed"; exit 1; }
                ;;
            test)
                ./scripts/run-tests.sh || { log_error "Tests failed"; exit 1; }
                ;;
            deploy)
                ./scripts/deploy.sh || { log_error "Deploy failed"; exit 1; }
                ;;
        esac

        log_info "Stage completed" "stage=$stage"
    done

    log_info "Pipeline completed successfully"
}

# ❌ DON'T — skip stages, combine multiple validations in one step
./build-and-deploy.sh  # no intermediate feedback
```

### Rollback

```bash
# ✅ DO — versioned deployments, rollback to specific version
DEPLOY_DIR="/srv/nexus/deploy"
CURRENT_LINK="/srv/nexus/deploy/current"
VERSIONS_DIR="/srv/nexus/deploy/versions"

rollback() {
    local target_version=${1:-previous}
    local previous_link
    previous_link=$(readlink "$CURRENT_LINK")

    if [[ "$target_version" == "previous" ]]; then
        target_version=$(basename "$(readlink -f "$CURRENT_LINK/..")")
    fi

    local target_path="$VERSIONS_DIR/$target_version"

    if [[ ! -d "$target_path" ]]; then
        log_error "Version not found" "version=$target_version"
        return $EXIT_ERROR
    fi

    log_info "Rolling back" "from=$previous_link" "to=$target_version"

    # Atomic swap
    local tmp_link
    tmp_link=$(mktemp -d)
    ln -sf "$target_path" "$tmp_link/current"
    mv "$tmp_link/current" "$CURRENT_LINK"

    log_info "Rollback complete" "version=$target_version"

    # Verify
    ./scripts/health-check.sh || {
        log_error "Health check failed after rollback"
        return $EXIT_ERROR
    }
}

# ❌ DON'T — no version tracking, in-place overwrite, no health check after rollback
cp -r /backup/versions/v1.2 /srv/nexus/deploy/current
```

### Health Checks

```bash
# ✅ DO — comprehensive health check with timeout, retries, dependency verification
HEALTH_CHECK_TIMEOUT=30
HEALTH_CHECK_RETRIES=3

health_check() {
    local endpoint="${1:-http://localhost:8080/health}"
    local start_time
    start_time=$(date +%s)

    log_info "Health check starting" "endpoint=$endpoint"

    for (( attempt=1; attempt<=HEALTH_CHECK_RETRIES; attempt++ )); do
        local http_code
        http_code=$(curl -s -o /dev/null -w "%{http_code}" \
            --max-time "$HEALTH_CHECK_TIMEOUT" \
            "$endpoint" 2>/dev/null || echo "000")

        if [[ "$http_code" == "200" ]]; then
            local elapsed
            elapsed=$(($(date +%s) - start_time))
            log_info "Health check passed" \
                "endpoint=$endpoint" "attempts=$attempt" "elapsed=${elapsed}s"
            return $EXIT_SUCCESS
        fi

        log_warn "Health check attempt $attempt/$HEALTH_CHECK_RETRIES failed" \
            "http_code=$http_code"
        sleep 5
    done

    log_error "Health check failed after $HEALTH_CHECK_RETRIES attempts"
    return $EXIT_ERROR
}

# Also verify dependencies
check_dependencies() {
    local deps=("queue" "lock-manager" "context-store")
    for dep in "${deps[@]}"; do
        if ! systemctl is-active --quiet "nexus-$dep"; then
            log_error "Dependency not running" "dep=$dep"
            return $EXIT_ERROR
        fi
    done
}

# ❌ DON'T — single attempt, no timeout, ignore non-200 as healthy
curl -s "$endpoint" && echo "OK"
```

---

## 7. Monitoring Standards

### Metrics

```bash
# ✅ DO — expose metrics in Prometheus format, include labels
METRICS_FILE="/srv/nexus/metrics/prometheus.txt"
METRICS_LOCK="/srv/nexus/locks/metrics.lock"

record_metric() {
    local metric_name="$1"
    local metric_value="$2"
    local labels="${3:-}"

    (
        flock -x "$METRICS_LOCK" || exit 1
        local timestamp
        timestamp=$(date +%s)
        echo "${metric_name}${labels:+{${labels}}} ${metric_value} ${timestamp}" \
            >> "$METRICS_FILE"
    ) 200>"$METRICS_LOCK"
}

# Metric definitions
record_queue_depth() {
    local depth
    depth=$(jq 'length' "$QUEUE_FILE" 2>/dev/null || echo 0)
    record_metric "nexus_queue_depth" "$depth" "queue=tasks"
}

record_worker_status() {
    local worker_id="$1"
    local status="$2"
    record_metric "nexus_worker_status" "1" "worker_id=${worker_id},status=${status}"
}

# ❌ DON'T — write metrics without locking, use namespaced keys incorrectly
echo "queue_depth $depth" >> /tmp/metrics.txt
```

### Alerts

```bash
# ✅ DO — alert on actionable thresholds, include context, deduplication key
ALERT_QUEUE_DEPTH_THRESHOLD=1000
ALERT_WORKER_TIMEOUT_THRESHOLD=300
ALERT_CONTEXT_SIZE_THRESHOLD=140000

check_alerts() {
    # Queue depth alert
    local queue_depth
    queue_depth=$(jq 'length' "$QUEUE_FILE" 2>/dev/null || echo 0)

    if (( queue_depth > ALERT_QUEUE_DEPTH_THRESHOLD )); then
        send_alert "QUEUE_DEPTH_HIGH" "$queue_depth" \
            "threshold=$ALERT_QUEUE_DEPTH_THRESHOLD" "severity=warning"
    fi

    # Worker timeout alert
    local stale_workers
    stale_workers=$(find "$WORKER_DIR" -name "*.heartbeat" -mmin +10 2>/dev/null | wc -l)

    if (( stale_workers > 0 )); then
        send_alert "STALE_WORKERS" "$stale_workers" \
            "threshold=0" "severity=critical"
    fi
}

send_alert() {
    local alert_name="$1"
    local alert_value="$2"
    local context="$3"
    local severity="$4"

    # Deduplication: only alert if not recently alerted
    local alert_key="/srv/nexus/alerts/${alert_name}.last"
    local last_alert
    last_alert=$(cat "$alert_key" 2>/dev/null || echo 0)
    local now
    now=$(date +%s)
    local cooldown=300

    if (( now - last_alert < cooldown )); then
        return 0
    fi

    echo "$now" > "$alert_key"

    # Send to alerting system
    jq -n \
        --arg name "$alert_name" \
        --arg value "$alert_value" \
        --arg context "$context" \
        --arg severity "$severity" \
        --argjson timestamp "$now" \
        '{alert: $name, value: $value, context: $context, severity: $severity, timestamp: $timestamp}' \
        | curl -s -X POST -H "Content-Type: application/json" \
            "${ALERT_WEBHOOK_URL}" 2>/dev/null

    log_warn "Alert sent" "name=$alert_name" "value=$alert_value" \
        "severity=$severity"
}

# ❌ DON'T — alert on every occurrence, no deduplication, alert without context
if [ $depth -gt 100 ]; then
    echo "ALERT queue depth" | send_to_slack
fi
```

### Dashboards

```bash
# ✅ DO — Grafana dashboard JSON structure with panels
DASHBOARD_DEFINITION='{
  "dashboard": {
    "title": "Nexus Pipeline",
    "uid": "nexus-pipeline",
    "panels": [
      {
        "title": "Queue Depth",
        "type": "graph",
        "targets": [
          {
            "expr": "nexus_queue_depth{queue=\"tasks\"}",
            "legendFormat": "Queue Depth"
          }
        ],
        "alert": {
          "name": "Queue Depth High",
          "conditions": [
            {"evaluator": {"params": [1000], "type": "gt"}}
          ]
        }
      },
      {
        "title": "Worker Status",
        "type": "stat",
        "targets": [
          {
            "expr": "nexus_worker_status",
            "legendFormat": "{{worker_id}} - {{status}}"
          }
        ]
      },
      {
        "title": "Context Size",
        "type": "gauge",
        "targets": [
          {
            "expr": "nexus_context_size_bytes",
            "legendFormat": "Context Size"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "thresholds": {
              "mode": "absolute",
              "steps": [
                {"color": "green", "value": null},
                {"color": "yellow", "value": 100000},
                {"color": "red", "value": 140000}
              ]
            }
          }
        }
      },
      {
        "title": "Task Completion Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(nexus_tasks_completed_total[5m])",
            "legendFormat": "Completed/sec"
          },
          {
            "expr": "rate(nexus_tasks_failed_total[5m])",
            "legendFormat": "Failed/sec"
          }
        ]
      }
    ]
  }
}'

# ❌ DON'T — hardcoded values in dashboard, no alerts, no thresholds defined
# Dashboard that only shows raw numbers, no context about what is healthy
```

---

## Quick Reference

| Standard | Key Pattern |
|----------|-------------|
| **Error Handling** | `set -euo pipefail`, named exit codes |
| **Logging** | Timestamps + context, never secrets |
| **Queue** | `flock` + atomic `mv` |
| **Retry** | Exponential backoff + jitter |
| **Context** | Reset per task, compaction at 120K tokens |
| **Workers** | Isolated process, heartbeat, timeout |
| **Smoke Tests** | Fast, isolated, deterministic |
| **Stress Tests** | Configurable concurrency + failure threshold |
| **Benchmarks** | Warmup + statistical aggregation |
| **Deploy** | Staged pipeline, atomic rollback |
| **Health Checks** | Retry + dependency verification |
| **Metrics** | Prometheus format, locked writes |
| **Alerts** | Actionable thresholds, deduplication |

---

Last updated: 2026-04-30
