#!/usr/bin/env bash
#
# configure-hvac-provider.sh — Idempotent headless config for OpenWebUI + HVAC RAG Pipe
# Usage: bash scripts/openwebui/configure-hvac-provider.sh [--dry-run]
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MONOREPO="$(cd "${SCRIPT_DIR}/../.." && pwd)"
COMPOSE_FILE="${MONOREPO}/docker-compose.openwebui.yml"
ENV_FILE="${MONOREPO}/.env"
BACKUP_FILE="${ENV_FILE}.backup-$(date +%Y%m%d%H%M%S)"
OPENWEBUI_CONTAINER="openwebui"
HVAC_PIPE_URL="${HVAC_PIPE_URL:-http://localhost:4017}"
HVAC_MODEL="${HVAC_MODEL:-hvac-copilot}"
ADMIN_EMAIL="${OPENWEBUI_ADMIN_EMAIL:-admin@zappro.local}"
ADMIN_PASSWORD="${OPENWEBUI_ADMIN_PASSWORD:-}"
DRY_RUN="${1:-}"

log()  { echo -e "\033[36m[NEXUS]\033[0m $*"; }
info() { echo -e "\033[34m[INFO]\033[0m  $*"; }
warn() { echo -e "\033[33m[WARN]\033[0m  $*" >&2; }
err()  { echo -e "\033[31m[ERROR]\033[0m $*" >&2; exit 1; }

# ── 1. Detect compose/env ───────────────────────────────────────
if [[ ! -f "$COMPOSE_FILE" ]]; then
    err "Compose file not found: ${COMPOSE_FILE}"
fi

if [[ ! -f "$ENV_FILE" ]]; then
    err ".env not found: ${ENV_FILE}"
fi

info "Compose: ${COMPOSE_FILE}"
info "Env:     ${ENV_FILE}"

# ── 2. Validate HVAC RAG Pipe ───────────────────────────────────
log "Validating HVAC RAG Pipe at ${HVAC_PIPE_URL}..."

PIPE_HEALTH=$(curl -sf "${HVAC_PIPE_URL}/health" 2>/dev/null || echo "FAIL")
if [[ "$PIPE_HEALTH" == "FAIL" ]]; then
    err "HVAC RAG Pipe health check failed. Is the pipe running at ${HVAC_PIPE_URL}?"
fi
info "Pipe health: ${PIPE_HEALTH}"

PIPE_MODELS=$(curl -sf "${HVAC_PIPE_URL}/v1/models" 2>/dev/null || echo "FAIL")
if [[ "$PIPE_MODELS" == "FAIL" ]]; then
    err "HVAC RAG Pipe /v1/models check failed."
fi

if ! echo "$PIPE_MODELS" | grep -q "$HVAC_MODEL"; then
    err "Model '${HVAC_MODEL}' not found in pipe response. Got: ${PIPE_MODELS}"
fi
info "Pipe models OK: ${HVAC_MODEL} found"

# ── 3. Apply envs (idempotent — only add missing vars) ───────────
log "Applying OpenWebUI envs to ${ENV_FILE}..."

declare -a NEW_ENVS=(
    "OPENAI_API_BASE_URL=${HVAC_PIPE_URL}/v1"
    "OPENAI_API_KEY=sk-hvac-local"
    "DEFAULT_MODELS=${HVAC_MODEL}"
    "DEFAULT_PINNED_MODELS=${HVAC_MODEL}"
    "TASK_MODEL_EXTERNAL=${HVAC_MODEL}"
    "ENABLE_OLLAMA_API=false"
    "ENABLE_LOGIN_FORM=true"
    "WEBUI_ADMIN_EMAIL=${ADMIN_EMAIL}"
    "WEBUI_ADMIN_NAME=Admin"
)

for env_line in "${NEW_ENVS[@]}"; do
    var_name="${env_line%%=*}"
    var_value="${env_line#*=}"

    if grep -q "^${var_name}=" "$ENV_FILE" 2>/dev/null; then
        info "  ${var_name} — already set (skip)"
    else
        if [[ -n "${DRY_RUN:-}" ]]; then
            info "  ${var_name}=${var_value} — would add (dry-run)"
        else
            echo "${env_line}" >> "$ENV_FILE"
            info "  ${var_name}=${var_value} — added"
        fi
    fi
done

# WEBUI_ADMIN_PASSWORD: set only if not already set
if ! grep -q "^WEBUI_ADMIN_PASSWORD=" "$ENV_FILE" 2>/dev/null; then
    if [[ -z "${ADMIN_PASSWORD}" ]]; then
        warn "OPENWEBUI_ADMIN_PASSWORD not set — admin login will use existing user or Google OAuth"
    else
        if [[ -n "${DRY_RUN:-}" ]]; then
            info "  WEBUI_ADMIN_PASSWORD=*** — would add (dry-run)"
        else
            echo "WEBUI_ADMIN_PASSWORD=${ADMIN_PASSWORD}" >> "$ENV_FILE"
            info "  WEBUI_ADMIN_PASSWORD=*** — added"
        fi
    fi
else
    info "  WEBUI_ADMIN_PASSWORD — already set (skip)"
fi

# ── 4. Restart OpenWebUI (only if not dry-run) ──────────────────
if [[ -z "${DRY_RUN:-}" ]]; then
    log "Restarting OpenWebUI container..."
    cd "${MONOREPO}"
    docker compose -f docker-compose.openwebui.yml down 2>/dev/null || true
    sleep 2
    docker compose -f docker-compose.openwebui.yml up -d

    # Wait for healthy
    info "Waiting for container to be healthy..."
    for i in {1..30}; do
        STATUS=$(docker inspect -f '{{.State.Health.Status}}' "${OPENWEBUI_CONTAINER}" 2>/dev/null || echo "not-found")
        if [[ "$STATUS" == "healthy" ]]; then
            info "Container is healthy"
            break
        fi
        if [[ $i -eq 30 ]]; then
            err "Container did not become healthy within 60s (status: ${STATUS})"
        fi
        sleep 2
    done

    sleep 5  # Let the app fully start
else
    log "[dry-run] Skipping restart"
fi

# ── 5. Ensure admin user exists ──────────────────────────────────
log "Ensuring admin user exists in DB..."

ADMIN_USER_ID=$(docker exec "${OPENWEBUI_CONTAINER}" python3 -c "
import sqlite3, os
conn = sqlite3.connect('/app/backend/data/webui.db')
cur = conn.cursor()
cur.execute('SELECT id FROM user WHERE email=?', ('${ADMIN_EMAIL}',))
row = cur.fetchone()
print(row[0] if row else '')
" 2>/dev/null)

if [[ -z "$ADMIN_USER_ID" ]]; then
    info "Admin user not found — will be created on next startup with WEBUI_ADMIN_* envs"
else
    info "Admin user exists: ${ADMIN_USER_ID}"
fi

# ── 6. Insert model + access grant (idempotent) ─────────────────
log "Ensuring ${HVAC_MODEL} exists in models table..."

docker exec "${OPENWEBUI_CONTAINER}" python3 -c "
import sqlite3, uuid, time, json, os, sys

ADMIN_EMAIL = '${ADMIN_EMAIL}'
MODEL_ID = '${HVAC_MODEL}'
PIPE_URL = '${HVAC_PIPE_URL}'

conn = sqlite3.connect('/app/backend/data/webui.db')
cur = conn.cursor()

# Get admin user
cur.execute('SELECT id FROM user WHERE email=?', (ADMIN_EMAIL,))
row = cur.fetchone()
if not row:
    print('No admin user found — cannot insert model')
    sys.exit(0)

admin_id = row[0]
now = int(time.time())

# Check if model exists
cur.execute('SELECT id FROM model WHERE id=?', (MODEL_ID,))
if cur.fetchone():
    print(f'Model {MODEL_ID} already exists')
else:
    cur.execute('''
        INSERT INTO model (id, user_id, base_model_id, name, meta, params, created_at, updated_at, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (MODEL_ID, admin_id, '', MODEL_ID, '{}', '{}', now, now, 1))
    print(f'Model {MODEL_ID} inserted')

# Check if wildcard access grant exists
cur.execute('SELECT id FROM access_grant WHERE resource_type=\"model\" AND resource_id=? AND principal_type=\"user\" AND principal_id=\"*\"', (MODEL_ID,))
if cur.fetchone():
    print(f'Wildcard access grant for {MODEL_ID} already exists')
else:
    cur.execute('''
        INSERT INTO access_grant (id, resource_type, resource_id, principal_type, principal_id, permission, created_at)
        VALUES (?, \"model\", ?, \"user\", \"*\", \"read\", ?)
    ''', (str(uuid.uuid4()), MODEL_ID, now))
    print(f'Wildcard access grant for {MODEL_ID} inserted')

conn.commit()
print('Model and access grant configured')
" 2>/dev/null

# ── 7. Verify ───────────────────────────────────────────────────
log "Verifying configuration..."

# Test pipe
PIPE_CHECK=$(curl -sf "${HVAC_PIPE_URL}/v1/models" 2>/dev/null | grep -c "$HVAC_MODEL" || echo "0")
if [[ "$PIPE_CHECK" -gt 0 ]]; then
    info "HVAC Pipe /v1/models — OK (${HVAC_MODEL} present)"
else
    err "HVAC Pipe verification failed"
fi

# Test OpenWebUI API (requires auth — get token first)
TOKEN_RESPONSE=$(docker exec "${OPENWEBUI_CONTAINER}" sh -lc "curl -s -X POST http://localhost:3456/api/v1/auths/signin -H 'Content-Type: application/json' -d '{\\"email\\":\\"${ADMIN_EMAIL}\\",\\"password\\":\\"${ADMIN_PASSWORD}\\"}'" 2>/dev/null || echo "FAIL")
if echo "$TOKEN_RESPONSE" | grep -q "token"; then
    TOKEN=$(echo "$TOKEN_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))" 2>/dev/null || echo "")
    if [[ -n "$TOKEN" ]]; then
        MODELS_RESPONSE=$(docker exec "${OPENWEBUI_CONTAINER}" sh -lc "curl -s -H 'Authorization: Bearer ${TOKEN}' http://localhost:3456/api/v1/models" 2>/dev/null || echo "FAIL")
        if echo "$MODELS_RESPONSE" | grep -q "$HVAC_MODEL"; then
            info "OpenWebUI API — OK (${HVAC_MODEL} visible)"
        else
            warn "OpenWebUI API — ${HVAC_MODEL} NOT found in response (may need login)"
        fi
    else
        info "Admin login via API — skipped (no token, using Google OAuth)"
    fi
else
    info "Admin login via API — skipped (password not set, using Google OAuth)"
fi

info ""
info "=========================================="
info "  HVAC Provider Configured Successfully"
info "  Model: ${HVAC_MODEL}"
info "  Pipe:  ${HVAC_PIPE_URL}"
info "  Admin: ${ADMIN_EMAIL}"
info "=========================================="
info ""
info "Next: Visit http://localhost:3456"
info "Login with Google OAuth or admin credentials."
info "The ${HVAC_MODEL} model should appear in the selector."
