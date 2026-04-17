#!/bin/bash
# voice-pipeline-loop.sh — Voice pipeline smoke test + self-heal + alert
# Runs every 5 minutes via Hermes cron scheduler
# Exit codes: 0=healthy, 1=degraded/down (alert triggered)

DIR="$(dirname "$0")"
RESULTS_DIR="$DIR/results"
LOGFILE="$DIR/voice-pipeline-loop.log"
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
mkdir -p "$RESULTS_DIR"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOGFILE" 2>/dev/null
}

ALERT=0

# ── STT: Whisper GPU ──────────────────────────────────────────────────────────
log "=== STT: Whisper GPU ==="
STT_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8201/health 2>/dev/null || echo "000")
if [ "$STT_HEALTH" = "200" ]; then
    log "  PASS whisper-api-gpu :8201/health → HTTP $STT_HEALTH"
else
    log "  FAIL whisper-api-gpu :8201/health → HTTP $STT_HEALTH"
    ALERT=1
fi

# ── TTS: Kokoro ──────────────────────────────────────────────────────────────
log "=== TTS: Kokoro ==="
TTS_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8012/v1/models 2>/dev/null || echo "000")
if [ "$TTS_HEALTH" = "200" ]; then
    log "  PASS kokoro :8012/v1/models → HTTP $TTS_HEALTH"
else
    log "  FAIL kokoro :8012/v1/models → HTTP $TTS_HEALTH"
    ALERT=1
fi

# ── AI Gateway ───────────────────────────────────────────────────────────────
log "=== AI Gateway ==="
GW_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4002/health 2>/dev/null || echo "000")
if [ "$GW_HEALTH" = "200" ]; then
    log "  PASS ai-gateway :4002/health → HTTP $GW_HEALTH"
else
    log "  FAIL ai-gateway :4002/health → HTTP $GW_HEALTH"
    ALERT=1
fi

# ── Hermes Gateway ───────────────────────────────────────────────────────────
log "=== Hermes Gateway ==="
HM_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8642/health 2>/dev/null || echo "000")
if [ "$HM_HEALTH" = "200" ]; then
    log "  PASS hermes-gateway :8642/health → HTTP $HM_HEALTH"
else
    log "  FAIL hermes-gateway :8642/health → HTTP $HM_HEALTH"
    ALERT=1
fi

# ── Self-Heal: Whisper GPU ────────────────────────────────────────────────────
if [ "$STT_HEALTH" != "200" ]; then
    log "SELF-HEAL: Restarting whisper-api-gpu..."
    docker restart whisper-api-gpu 2>/dev/null
    sleep 5
    STT_RETRY=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8201/health 2>/dev/null || echo "000")
    if [ "$STT_RETRY" = "200" ]; then
        log "  HEALED whisper-api-gpu after restart"
    else
        log "  HEAL FAILED whisper-api-gpu still down (HTTP $STT_RETRY)"
    fi
fi

# ── Self-Heal: Kokoro ────────────────────────────────────────────────────────
if [ "$TTS_HEALTH" != "200" ]; then
    log "SELF-HEAL: Restarting zappro-kokoro..."
    docker restart zappro-kokoro 2>/dev/null
    sleep 5
    TTS_RETRY=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8012/v1/models 2>/dev/null || echo "000")
    if [ "$TTS_RETRY" = "200" ]; then
        log "  HEALED zappro-kokoro after restart"
    else
        log "  HEAL FAILED zappro-kokoro still down (HTTP $TTS_RETRY)"
    fi
fi

# ── Write results JSON ───────────────────────────────────────────────────────
cat > "$RESULTS_DIR/voice-pipeline.json" << EOF
{
  "timestamp": "$TIMESTAMP",
  "status": $ALERT,
  "services": {
    "whisper-api-gpu": "$STT_HEALTH",
    "kokoro": "$TTS_HEALTH",
    "ai-gateway": "$GW_HEALTH",
    "hermes-gateway": "$HM_HEALTH"
  },
  "summary": "$( [ $ALERT -eq 0 ] && echo 'all healthy' || echo 'degraded' )"
}
EOF

log "=== Result: $([ $ALERT -eq 0 ] && echo 'HEALTHY' || echo 'DEGRADED/ALERT') ==="
log "Results saved to: $RESULTS_DIR/voice-pipeline.json"

exit $ALERT
