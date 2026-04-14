#!/bin/bash
# Voice Pipeline Cursor-Loop — Auto-Healer + Telegram Alert
# Executes smoke test, parses results, self-heals recoverable failures,
# sends Telegram alert with recovery plan on persistent failures.
# Does NOT use set -e — must complete all steps even if some fail.

# =============================================================================
# Load .env (has TELEGRAM_BOT_TOKEN, LITELLM_KEY, etc.)
# =============================================================================
# shellcheck disable=SC1091
if [ -f /srv/monorepo/.env ]; then
    set -a; source /srv/monorepo/.env; set +a
fi

# =============================================================================
# Config
# =============================================================================
OPENCLAW_CONTAINER_NAME="${OPENCLAW_CONTAINER_NAME:-openclaw-qgtzrmi6771lt8l7x8rqx72f}"
TTS_BRIDGE_CONTAINER_NAME="${TTS_BRIDGE_CONTAINER_NAME:-zappro-tts-bridge}"
WAV2VEC2_CONTAINER_NAME="${WAV2VEC2_CONTAINER_NAME:-wav2vec2}"
LITELLM_CONTAINER_NAME="${LITELLM_CONTAINER_NAME:-zappro-litellm}"
LOG_DIR="/srv/monorepo/logs/voice-pipeline"
SMOKE_SCRIPT="/srv/monorepo/tasks/smoke-tests/pipeline-openclaw-voice.sh"
TEST_CHAT_ID="${TEST_CHAT_ID:-7220607041}"

# Auto-heal thresholds
MAX_RESTART_ATTEMPTS=3
MAX_ALERT_ATTEMPTS=3

# =============================================================================
# Infisical — fetch secrets
# =============================================================================
fetch_secret() {
    python3 -c "
import sys
from infisical_sdk import InfisicalSDKClient
import os
token = os.environ.get('INFISICAL_TOKEN', '')
if not token and os.path.exists('/srv/ops/secrets/infisical.service-token'):
    token = open('/srv/ops/secrets/infisical.service-token').read().strip()
client = InfisicalSDKClient(host='http://127.0.0.1:8200', token=token)
secrets = client.secrets.list_secrets(
    project_id=os.environ.get("INFISICAL_PROJECT_ID"),
    environment_slug='dev',
    secret_path='/'
)
for s in secrets.secrets:
    if s.secret_key == sys.argv[1]:
        print(s.secret_value, end='')
        break
" "$1" 2>/dev/null
}

# =============================================================================
# Load secrets (env takes precedence)
# =============================================================================
TELEGRAM_BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-}"
if [ -z "$TELEGRAM_BOT_TOKEN" ]; then
    TELEGRAM_BOT_TOKEN=$(fetch_secret "TELEGRAM_BOT_TOKEN")
fi
if [ -z "$TELEGRAM_BOT_TOKEN" ]; then
    echo "ERROR: TELEGRAM_BOT_TOKEN not set" >&2
    exit 1
fi

# LITELLM_KEY — env takes precedence, else container (correct key), else Infisical
if [ -z "${LITELLM_KEY:-}" ]; then
    LITELLM_KEY=$(docker exec zappro-litellm env 2>/dev/null | grep 'LITELLM_MASTER_KEY=' | cut -d= -f2)
fi
if [ -z "${LITELLM_KEY:-}" ]; then
    LITELLM_KEY=$(fetch_secret "LITELLM_MASTER_KEY")
fi

# =============================================================================
# Helpers
# =============================================================================
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; CYAN='\033[0;36m'; NC='\033[0m'
log()  { echo -e "${BLUE}[LOOP]${NC} $(date '+%Y-%m-%d %H:%M:%S') $1"; }
pass() { echo -e "${GREEN}[PASS]${NC} $1"; }
fail() { echo -e "${RED}[FAIL]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }

mkdir -p "$LOG_DIR"

# =============================================================================
# Telegram — send message (MarkdownV2)
# =============================================================================
tg_send() {
    local text="$1"
    local payload
    # Escape special MarkdownV2 chars: _ * [ ] ( ) ~ ` > # + - = | { } . !
    local escaped
    escaped=$(python3 -c "
import sys, json
text = sys.argv[1]
# Escape special MarkdownV2 characters
for ch in '_*[]()~`>#+=|{}.!':
    text = text.replace(ch, '\\' + ch)
print(text)
" "$text" 2>/dev/null)

    curl -sf -m 15 -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
        -F "chat_id=${TEST_CHAT_ID}" \
        -F "text=${escaped}" \
        -F "parse_mode=MarkdownV2" > /dev/null 2>&1
}

# =============================================================================
# Telegram — send photo (URL)
# =============================================================================
tg_photo() {
    local photo_url="$1"; local caption="$2"
    local esc_caption
    esc_caption=$(python3 -c "
import sys
text = sys.argv[1]
for ch in '_*[]()~`>#+=|{}.!':
    text = text.replace(ch, '\\' + ch)
print(text)
" "$caption" 2>/dev/null)

    curl -sf -m 15 -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto" \
        -F "chat_id=${TEST_CHAT_ID}" \
        -F "photo=${photo_url}" \
        -F "caption=${esc_caption}" \
        -F "parse_mode=MarkdownV2" > /dev/null 2>&1
}

# =============================================================================
# Container health check
# =============================================================================
container_health() {
    local name="$1"
    docker ps --filter "name=$name" --format '{{.Status}}' | grep -q "^Up" 2>/dev/null
}

# =============================================================================
# Restart container with retry
# =============================================================================
restart_container() {
    local name="$1"; local max_attempts="${2:-3}"
    local i=1
    while [ $i -le $max_attempts ]; do
        log "Restart attempt $i/$max_attempts for $name"
        if docker restart "$name" > /dev/null 2>&1; then
            sleep 5
            if container_health "$name"; then
                log "$name restarted successfully"
                return 0
            fi
        fi
        i=$((i+1))
        sleep 10
    done
    log "$name failed to restart after $max_attempts attempts"
    return 1
}

# =============================================================================
# Start container
# =============================================================================
start_container() {
    local name="$1"
    docker start "$name" > /dev/null 2>&1
    sleep 3
    container_health "$name"
}

# =============================================================================
# Counters file (persistent across runs)
# =============================================================================
COUNTERS_FILE="${LOG_DIR}/.heal_counters.json"

read_counters() {
    if [ -f "$COUNTERS_FILE" ]; then
        cat "$COUNTERS_FILE"
    else
        echo '{"restart_attempts":{},"alert_count":{}}'
    fi
}

write_counters() {
    local json="$1"
    echo "$json" > "$COUNTERS_FILE"
}

increment_counter() {
    local key="$1"; local type="$2"
    local counters
    counters=$(read_counters)
    local current
    current=$(python3 -c "
import sys, json
d = json.load(sys.stdin)
key = sys.argv[1]
type = sys.argv[2]
if key not in d[type]:
    d[type][key] = 0
d[type][key] += 1
print(d[type][key])
" "$key" "$type" 2>/dev/null)
    python3 -c "
import sys, json
d = json.load(sys.stdin)
key = sys.argv[1]
type = sys.argv[2]
val = int(sys.argv[3])
d[type][key] = val
print(json.dumps(d))
" "$key" "$type" "$current" > "$COUNTERS_FILE" 2>/dev/null
}

get_counter() {
    local key="$1"; local type="$2"
    python3 -c "
import sys, json
d = json.load(sys.stdin)
print(d.get(sys.argv[1], {}).get(sys.argv[2], 0))
" "$key" "$type" 2>/dev/null < "$(cat "$COUNTERS_FILE" 2>/dev/null || echo '{}')"
}

reset_counters() {
    echo '{"restart_attempts":{},"alert_count":{}}' > "$COUNTERS_FILE"
}

# =============================================================================
# Run smoke test, capture output
# =============================================================================
log "Starting smoke test..."

SMOKE_OUTPUT=$(mktemp)
SMOKE_EXIT=0
bash "$SMOKE_SCRIPT" > "$SMOKE_OUTPUT" 2>&1 || SMOKE_EXIT=$?

SMOKE_STDOUT=$(cat "$SMOKE_OUTPUT")
TOTAL=$(echo "$SMOKE_STDOUT" | grep -oP "Total:\s+\K\d+" | head -1)
PASSED=$(echo "$SMOKE_STDOUT" | grep -oP "Passed:\s+\K\d+" | head -1)
FAILED=$(echo "$SMOKE_STDOUT" | grep -oP "Failed:\s+\K\d+" | head -1)

TOTAL=${TOTAL:-0}; PASSED=${PASSED:-0}; FAILED=${FAILED:-0}

log "Smoke test result: ${PASSED}/${TOTAL} passed, ${FAILED} failed"

# =============================================================================
# Parse failures — identify which endpoints failed
# =============================================================================
FAILED_ENDPOINTS=""
while IFS= read -r line; do
    # Line format: [FAIL] description
    if echo "$line" | grep -q '^\[FAIL\]'; then
        desc=$(echo "$line" | sed 's/^\[FAIL\]//' | sed 's/^\s*//' | cut -d'.' -f2- | xargs)
        if [ -n "$desc" ]; then
            FAILED_ENDPOINTS="${FAILED_ENDPOINTS}${desc}|"
        fi
    fi
done <<< "$SMOKE_STDOUT"

FAILED_ENDPOINTS=$(echo "$FAILED_ENDPOINTS" | sed 's/|$//')

# =============================================================================
# Steady state — all pass
# =============================================================================
if [ "$FAILED" -eq 0 ]; then
    log "All tests passed — steady state"
    reset_counters
    echo "$SMOKE_STDOUT" >> "${LOG_DIR}/smoke.log.$(date '+%Y%m%d')"
    rm -f "$SMOKE_OUTPUT"
    exit 0
fi

log "Detected failures: ${FAILED} — analyzing..."

# =============================================================================
# Self-heal attempt logic
# =============================================================================
ALERT_NOW=false
HEALED_SOMETHING=false

# TTS Bridge DOWN
if echo "$SMOKE_STDOUT" | grep -q "TTS Bridge.*:8013.*FAIL\|3\.0.*TTS Bridge.*FAIL"; then
    if ! container_health "$TTS_BRIDGE_CONTAINER_NAME"; then
        log "TTS Bridge container DOWN — attempting start"
        if start_container "$TTS_BRIDGE_CONTAINER_NAME"; then
            warn "TTS Bridge started"
            HEALED_SOMETHING=true
            increment_counter "tts-bridge" "restart_attempts"
        else
            log "TTS Bridge start failed"
            ALERT_NOW=true
        fi
    fi
fi

# OpenClaw container DOWN
if echo "$SMOKE_STDOUT" | grep -q "OpenClaw container.*FAIL"; then
    if ! container_health "$OPENCLAW_CONTAINER_NAME"; then
        log "OpenClaw container DOWN — attempting restart"
        if restart_container "$OPENCLAW_CONTAINER_NAME"; then
            warn "OpenClaw restarted"
            HEALED_SOMETHING=true
            increment_counter "openclaw" "restart_attempts"
        else
            log "OpenClaw restart failed"
            ALERT_NOW=true
        fi
    fi
fi

# wav2vec2 container DOWN
if echo "$SMOKE_STDOUT" | grep -q "wav2vec2.*:8201.*FAIL\|2\.1.*wav2vec2.*FAIL"; then
    if ! container_health "$WAV2VEC2_CONTAINER_NAME"; then
        log "wav2vec2 container DOWN — attempting restart"
        if restart_container "$WAV2VEC2_CONTAINER_NAME"; then
            warn "wav2vec2 restarted"
            HEALED_SOMETHING=true
            increment_counter "wav2vec2" "restart_attempts"
        else
            log "wav2vec2 restart failed"
            ALERT_NOW=true
        fi
    fi
fi

# LiteLLM DOWN
if echo "$SMOKE_STDOUT" | grep -q "LiteLLM.*FAIL\|5\." | grep -qv "vision\|llava"; then
    if ! container_health "$LITELLM_CONTAINER_NAME"; then
        log "LiteLLM container DOWN — attempting restart"
        if restart_container "$LITELLM_CONTAINER_NAME"; then
            warn "LiteLLM restarted"
            HEALED_SOMETHING=true
            increment_counter "litellm" "restart_attempts"
        else
            log "LiteLLM restart failed"
            ALERT_NOW=true
        fi
    fi
fi

# Config schema stripping — DO NOT auto-heal, alert only
if echo "$SMOKE_STDOUT" | grep -q "TTS Bridge.*health.*PASS\|3\.0.*PASS" && \
   echo "$SMOKE_STDOUT" | grep -q "pm_santa.*FAIL\|3\.1.*FAIL"; then
    log "TTS pm_santa failing despite bridge UP — likely config issue (NOT auto-healing)"
    ALERT_NOW=true
fi

# =============================================================================
# Wait + recheck after heal attempt
# =============================================================================
if [ "$HEALED_SOMETHING" = true ]; then
    log "Waiting 15s before recheck..."
    sleep 15
    log "Re-running smoke test after heal..."
    RECHECK_OUTPUT=$(mktemp)
    bash "$SMOKE_SCRIPT" > "$RECHECK_OUTPUT" 2>&1 || true
    RECHECK_FAILED=$(grep -oP "Failed:\s+\K\d+" "$RECHECK_OUTPUT" | head -1)
    RECHECK_FAILED=${RECHECK_FAILED:-99}
    rm -f "$RECHECK_OUTPUT"
    if [ "$RECHECK_FAILED" -eq 0 ]; then
        log "Self-heal SUCCESS — all tests now passing"
        reset_counters
        tg_send "$(date '+%H:%M') — Voice pipeline self-healed successfully. All tests passing." 2>/dev/null || true
        rm -f "$SMOKE_OUTPUT"
        exit 0
    else
        log "Self-heal did not resolve failures (${RECHECK_FAILED} still failing)"
        ALERT_NOW=true
    fi
fi

# =============================================================================
# Alert decision — check alert counter
# =============================================================================
ALERT_KEY="overall"
ALERT_COUNT=$(get_counter "$ALERT_KEY" "alert_count")

if [ "$ALERT_NOW" = true ]; then
    ALERT_COUNT=$((ALERT_COUNT + 1))
    increment_counter "$ALERT_KEY" "alert_count"
    python3 -c "
import sys, json
d = json.load(sys.stdin)
d['alert_count']['$ALERT_KEY'] = $ALERT_COUNT
print(json.dumps(d))
" > "$COUNTERS_FILE" 2>/dev/null
else
    # No specific failure detected but smoke test still failing
    # Might be transient — alert on 3 consecutive failures
    ALERT_COUNT=$((ALERT_COUNT + 1))
    increment_counter "$ALERT_KEY" "alert_count"
fi

if [ $ALERT_COUNT -lt $MAX_ALERT_ATTEMPTS ]; then
    log "Alert suppressed (count=$ALERT_COUNT/$MAX_ALERT_ATTEMPTS) — logging and waiting"
    echo "$SMOKE_STDOUT" >> "${LOG_DIR}/smoke.log.$(date '+%Y%m%d')"
    rm -f "$SMOKE_OUTPUT"
    exit 0
fi

# =============================================================================
# Telegram Alert — persistent failure
# =============================================================================
log "Sending Telegram alert (alert_count=$ALERT_COUNT)..."

ALERT_MSG=$(python3 << 'PYEOF'
import sys
failed = sys.argv[1]
passed = sys.argv[2]
total = sys.argv[3]
endpoints = sys.argv[4]
restart_cmd = sys.argv[5]
openclaw_cmd = sys.argv[6]
log_dir = sys.argv[7]
date_str = sys.argv[8]

msg = """🔴 Voice Pipeline ALERT
%s

❌ %s tests failed (%s/%s passed)

📋 Failed endpoints:
```
%s
```

🔧 Recovery Plan:
1. docker ps | grep -E 'openclaw|tts|wav2vec2|litellm'
2. docker logs <container-name> --tail 50
3. docker start %s
4. docker restart %s
5. Check OPENAI_TTS_BASE_URL in Coolify

📂 Logs: tail -100 %s/smoke.log.%s

⏱️ Auto-healer will retry in 5 min""" % (
    '$(date "+%Y-%m-%d %H:%M:%S")',
    failed, passed, total,
    endpoints,
    restart_cmd, openclaw_cmd,
    log_dir, date_str
)

# Escape MarkdownV2 special chars
for ch in '_*[]()~`>#+=|{}.!':
    msg = msg.replace(ch, '\\' + ch)
print(msg)
PYEOF
" "$FAILED" "$PASSED" "$TOTAL" "${FAILED_ENDPOINTS:-Unknown}" \
     "${TTS_BRIDGE_CONTAINER_NAME}" "${OPENCLAW_CONTAINER_NAME}" \
     "${LOG_DIR}" "$(date '+%Y%m%d')" 2>/dev/null)

tg_send "$ALERT_MSG" 2>/dev/null || warn "Telegram send failed"

# =============================================================================
# Append to daily log
# =============================================================================
echo "$SMOKE_STDOUT" >> "${LOG_DIR}/smoke.log.$(date '+%Y%m%d')"
rm -f "$SMOKE_OUTPUT"
exit 1
