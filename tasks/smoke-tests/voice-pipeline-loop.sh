#!/bin/bash
# Voice Pipeline Self-Healing Loop
# Runs every 5 minutes via cron: */5 * * * * /srv/monorepo/tasks/smoke-tests/voice-pipeline-loop.sh
# Based on: docs/GUIDES/voice-pipeline-loop.md

set -euo pipefail

SCRIPT_DIR="$(dirname "$0")"
LOG_DIR="/srv/monorepo/logs/voice-pipeline"
RESULTS_DIR="$SCRIPT_DIR/results"
COUNTER_FILE="$LOG_DIR/.heal_counters.json"
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
TODAY=$(date +%Y%m%d)
SMOKE_LOG="$LOG_DIR/smoke.log.$TODAY"

mkdir -p "$LOG_DIR"
mkdir -p "$RESULTS_DIR"

# Load or init counters
init_counters() {
    if [ -f "$COUNTER_FILE" ]; then
        alert_count=$(python3 -c "import json; d=json.load(open('$COUNTER_FILE')); print(d.get('alert_count', 0))" 2>/dev/null || echo 0)
    else
        alert_count=0
    fi
}

save_counters() {
    python3 -c "
import json
d = {'alert_count': $alert_count, 'last_run': '$TIMESTAMP'}
with open('$COUNTER_FILE', 'w') as f:
    json.dump(d, f)
"
}

# Telegram alert
send_alert() {
    local msg="$1"
    local token="${TELEGRAM_BOT_TOKEN:-}"
    local chat_id="${TELEGRAM_CHAT_ID:-}"
    if [ -n "$token" ] && [ -n "$chat_id" ]; then
        curl -s -X POST "https://api.telegram.org/bot$token/sendMessage" \
            -d "chat_id=$chat_id" -d "text=$msg" -d "parse_mode=HTML" > /dev/null 2>&1 || true
    fi
}

log() {
    echo "[$TIMESTAMP] $1" | tee -a "$SMOKE_LOG" >&2
}

# Check HTTP via curl on localhost (host-networked services)
check_local() {
    local name="$1"; local port="$2"; local path="$3"
    local code
    code=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${port}${path}" --max-time 8 2>/dev/null || echo "000")
    echo "$code"
}

# Check HTTP via docker exec wget (container-internal services)
check_container() {
    local container="$1"; local internal_port="$2"; local path="$3"
    local code
    code=$(docker exec "$container" wget --spider -q -T 5 "http://localhost:${internal_port}${path}" 2>/dev/null && echo "200" || echo "000")
    echo "$code"
}

# --- Smoke test against voice pipeline endpoints ---
run_smoke() {
    local failed=0
    local passed=0
    local -a failed_arr=()

    # Host-networked services: curl to localhost
    declare -a LOCAL_SERVICES=(
        "whisper-api:8204:/health"
        "kokoro:8012:/v1/models"
        "litellm:4000:/health"
    )

    # NOTE: Hermes Agent was removed (port 4001 marked RESERVED in PORTS.md)
    # Removing from smoke test until it's redeployed via Coolify.

    for svc in "${LOCAL_SERVICES[@]}"; do
        IFS=':' read -r name port path <<< "$svc"
        http_code=$(check_local "$name" "$port" "$path")

        # Accept 200, 401 (auth required = service up), 000 (down)
        if [ "$http_code" = "200" ] || [ "$http_code" = "401" ]; then
            passed=$((passed + 1))
            log "  PASS  $name (HTTP $http_code)"
        else
            failed=$((failed + 1))
            failed_arr+=("$name")
            log "  FAIL  $name (HTTP $http_code)"
        fi
    done

    # mcp-qdrant health check via host curl (mcp-qdrant container has no wget/curl)
    # mcp-qdrant listens on host port 4011 (qdrant-c95x9bgnhpedt0zp7dfsims7 has no host port bindings)
    http_code=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:4011/health" --max-time 8 2>/dev/null || echo "000")
    if [ "$http_code" = "200" ]; then
        passed=$((passed + 1))
        log "  PASS  qdrant (HTTP $http_code)"
    else
        failed=$((failed + 1))
        failed_arr+=("qdrant")
        log "  FAIL  qdrant (HTTP $http_code)"
    fi

    for svc in "${DOCKER_SERVICES[@]}"; do
        IFS=':' read -r name container_port path <<< "$svc"
        http_code=$(check_container "$name" "$container_port" "$path")

        if [ "$http_code" = "200" ]; then
            passed=$((passed + 1))
            log "  PASS  $name (HTTP $http_code)"
        else
            failed=$((failed + 1))
            failed_arr+=("$name")
            log "  FAIL  $name (HTTP $http_code)"
        fi
    done

    # Return: fail_count, pass_count, then newline-delimited failed names
    printf "%d:%d\n" "$failed" "$passed"
    for svc in "${failed_arr[@]}"; do
        echo "$svc"
    done
}

# --- Self-heal based on failure type ---
heal() {
    local service="$1"

    case "$service" in
        *"qdrant"*)
            docker restart qdrant-c95x9bgnhpedt0zp7dfsims7 2>/dev/null || true
            ;;
        *"litellm"*)
            docker restart zappro-litellm 2>/dev/null || true
            ;;
        *"whisper"*)
            docker start whisper-api-gpu 2>/dev/null || docker restart whisper-api-gpu 2>/dev/null
            ;;
        *"kokoro"*)
            docker start zappro-kokoro 2>/dev/null || docker restart zappro-kokoro 2>/dev/null || \
            docker start zappro-kokoro-restarted 2>/dev/null || docker restart zappro-kokoro-restarted 2>/dev/null
            ;;
        *)
            log "  WARN  No heal action for: $service"
            ;;
    esac
}

# --- Main ---
init_counters

log "=== Voice Pipeline Smoke Test ==="

# Run smoke test once, capture all output
smoke_output=$(run_smoke)

# Read fail_count and pass_count from first line
IFS=: read -r fail_count pass_count <<< "$(echo "$smoke_output" | head -1)"

# Extract failed services from remaining lines
mapfile -t failed_svcs <<< "$(echo "$smoke_output" | tail -n +2)"

if [ "$fail_count" -eq 0 ]; then
    log "All checks PASSED ($pass_count/$((fail_count + pass_count)))"
    alert_count=0
    save_counters
    exit 0
fi

log "$fail_count failure(s) detected"

# Attempt heal for each failed service
for svc in "${failed_svcs[@]}"; do
    [ -z "$svc" ] && continue
    log "Attempting to heal: $svc"
    heal "$svc"
done

# Wait and recheck
sleep 15
log "Rechecking after heal attempt..."
recheck_output=$(run_smoke)
IFS=: read -r fail_count2 pass_count2 <<< "$(echo "$recheck_output" | head -1)"

if [ "$fail_count2" -eq 0 ]; then
    log "Heal successful — all checks now PASS"
    alert_count=0
    save_counters
    exit 0
fi

# Still failing — increment alert counter
alert_count=$((alert_count + 1))
save_counters

log "Persistent failure (attempt $alert_count/3)"

if [ "$alert_count" -ge 3 ]; then
    alert_msg="🔴 <b>Voice Pipeline ALERT</b>

❌ $fail_count2 test(s) still failing after auto-heal

<code>${failed_svcs[*]}</code>

🔧 <b>Recovery Plan:</b>
1. <code>docker ps | grep Hermes Agent|tts|wav2vec2|litellm</code>
2. <code>docker logs &lt;container&gt; --tail 50</code>
3. Check OPENAI_TTS_BASE_URL in Coolify

📂 Logs: <code>tail -100 $SMOKE_LOG</code>
⏱️ Auto-healer retries in 5 min"
    send_alert "$alert_msg"
    log "Telegram alert sent (alert_count=$alert_count)"
    alert_count=0   # Reset after alert
    save_counters
fi

exit 1
