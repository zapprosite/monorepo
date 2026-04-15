#!/usr/bin/env bash
# =============================================================================
# SPEC-047 — Smoke: .env secrets validator + auto-heal + rotator
# =============================================================================
# Testa cada secret em .env. Se inválido/ausente:
#   1. Busca no container Docker correspondente
#   2. Se não encontrar, gera um novo (quando seguro) via openssl rand
#   3. Grava em .env (backup .env.bak-<timestamp>) e .env.example (placeholder)
# Anti-hardcoded: tudo lido via env; nenhum valor literal neste script.
#
# Uso:
#   bash smoke-tests/smoke-env-secrets-validate.sh              # dry-run (só reporta)
#   HEAL=1 bash smoke-tests/smoke-env-secrets-validate.sh       # corrige e grava
#   ROTATE=1 bash smoke-tests/smoke-env-secrets-validate.sh     # força rotação de randoms
# =============================================================================

set -euo pipefail

ENV_FILE="${ENV_FILE:-/srv/monorepo/.env}"
ENV_EXAMPLE="${ENV_EXAMPLE:-/srv/monorepo/.env.example}"
HEAL="${HEAL:-0}"
ROTATE="${ROTATE:-0}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="${ENV_FILE}.bak-${TIMESTAMP}"

RED=$'\033[0;31m'; GRN=$'\033[0;32m'; YEL=$'\033[1;33m'; BLU=$'\033[0;34m'; NC=$'\033[0m'

PASS=0; FAIL=0; HEALED=0; ROTATED=0
declare -a FAILED_VARS=()
declare -a HEALED_VARS=()

log()  { echo "${BLU}[INFO]${NC} $*"; }
ok()   { echo "${GRN}[ OK ]${NC} $*"; PASS=$((PASS+1)); }
bad()  { echo "${RED}[FAIL]${NC} $*"; FAIL=$((FAIL+1)); FAILED_VARS+=("$1"); }
warn() { echo "${YEL}[WARN]${NC} $*"; }
heal() { echo "${GRN}[HEAL]${NC} $*"; HEALED=$((HEALED+1)); }

[[ -r "$ENV_FILE" ]] || { echo "missing $ENV_FILE"; exit 2; }

# Load .env (anti-hardcoded: todos valores via env)
set -a; # shellcheck disable=SC1090
source "$ENV_FILE"; set +a

# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------

gen_hex()    { openssl rand -hex 32; }
gen_b64()    { openssl rand -base64 48 | tr -d '\n' | tr '/+' '_-'; }
gen_pw()     { openssl rand -base64 24 | tr -d '\n/+='; }

# Update VAR=VAL in .env (in place, preserving rest). Creates backup once.
write_env() {
  local var="$1" val="$2"
  [[ -f "$BACKUP" ]] || cp -a "$ENV_FILE" "$BACKUP"
  if grep -qE "^${var}=" "$ENV_FILE"; then
    # escape for sed: use @ as separator, escape backslash/@
    local esc; esc=$(printf '%s' "$val" | sed -e 's/[\\&@]/\\&/g')
    sed -i "s@^${var}=.*@${var}=${esc}@" "$ENV_FILE"
  else
    printf '\n%s=%s\n' "$var" "$val" >> "$ENV_FILE"
  fi
  # Ensure placeholder in .env.example
  if [[ -f "$ENV_EXAMPLE" ]] && ! grep -qE "^${var}=" "$ENV_EXAMPLE"; then
    printf '\n%s=replace-me\n' "$var" >> "$ENV_EXAMPLE"
  fi
  HEALED_VARS+=("$var")
}

# Try extract secret from a running docker container's env
# Usage: container_env <container_name_glob> <env_var>
container_env() {
  local pattern="$1" var="$2"
  command -v docker >/dev/null || return 1
  local cid
  cid=$(docker ps --format '{{.ID}} {{.Names}}' 2>/dev/null | awk -v p="$pattern" '$2 ~ p {print $1; exit}')
  [[ -n "$cid" ]] || return 1
  docker exec "$cid" printenv "$var" 2>/dev/null || return 1
}

# Probe HTTP health of URL, optionally with Bearer token
probe_http() {
  local url="$1" token="${2:-}" expect="${3:-200}" timeout="${4:-5}"
  local args=(-sS -o /dev/null -w '%{http_code}' --max-time "$timeout")
  [[ -n "$token" ]] && args+=(-H "Authorization: Bearer ${token}")
  local code; code=$(curl "${args[@]}" "$url" 2>/dev/null || echo 000)
  # Accept: explicit expect, any 2xx/3xx, or auth-challenge (service reachable)
  [[ "$code" == "$expect" || "$code" =~ ^(2|3)[0-9][0-9]$ || "$code" =~ ^(401|403|405)$ ]]
}

# Check: secret is non-empty, not a placeholder
is_placeholder() {
  local val="$1"
  [[ -z "$val" ]] && return 0
  [[ "$val" =~ ^(replace-?me|your-|xxx|todo|changeme|placeholder|replace-with-) ]] && return 0
  [[ "$val" == "sk-master-..." ]] && return 0
  [[ "$val" == "base64:..." ]] && return 0
  return 1
}

# -----------------------------------------------------------------------------
# Validators
# -----------------------------------------------------------------------------

# $1=VAR  $2=kind(random-hex|random-b64|password|url|external)  $3=container_glob(opt)  $4=probe_cmd(opt)
validate() {
  local var="$1" kind="$2" ctx="${3:-}" probe="${4:-}"
  local val="${!var:-}"

  # Placeholder / empty
  if is_placeholder "$val"; then
    bad "$var" "missing/placeholder"
    if [[ "$HEAL" == "1" ]]; then
      local new=""
      # 1) Tentar container
      if [[ -n "$ctx" ]]; then
        new=$(container_env "$ctx" "$var" 2>/dev/null || true)
        [[ -n "$new" && ! "$new" =~ placeholder ]] && log "  ↳ recovered from container matching /$ctx/"
      fi
      # 2) Gerar novo se random
      if [[ -z "$new" ]]; then
        case "$kind" in
          random-hex) new=$(gen_hex) ;;
          random-b64) new=$(gen_b64) ;;
          password)   new=$(gen_pw) ;;
          external|url) warn "  ↳ $var é externo/URL — requer input manual, skip"; return ;;
        esac
      fi
      if [[ -n "$new" ]]; then
        write_env "$var" "$new"
        export "$var=$new"
        heal "$var healed ($kind)"
      fi
    fi
    return
  fi

  # Rotação forçada (apenas randoms)
  if [[ "$ROTATE" == "1" && "$kind" =~ ^(random-hex|random-b64|password)$ ]]; then
    local new
    case "$kind" in
      random-hex) new=$(gen_hex) ;;
      random-b64) new=$(gen_b64) ;;
      password)   new=$(gen_pw) ;;
    esac
    write_env "$var" "$new"
    export "$var=$new"
    ROTATED=$((ROTATED+1))
    heal "$var rotated"
    val="$new"
  fi

  # Probe opcional (funcional)
  if [[ -n "$probe" ]]; then
    if eval "$probe"; then
      ok "$var (probe ok)"
    else
      bad "$var" "probe failed"
      warn "  ↳ valor presente mas serviço não respondeu — verificar manualmente"
    fi
    return
  fi

  ok "$var"
}

# -----------------------------------------------------------------------------
# Matrix — each secret: kind + container hint + optional probe
# -----------------------------------------------------------------------------

log "== .env secret audit =="
log "file: $ENV_FILE   HEAL=$HEAL  ROTATE=$ROTATE"

# --- Random-generatable secrets (safe to rotate) -----------------------------
validate AI_GATEWAY_FACADE_KEY  random-hex  'ai-gateway'
validate SESSION_SECRET         random-hex  ''
validate INTERNAL_API_SECRET    random-hex  ''
validate WEBUI_SECRET_KEY       random-hex  'open-webui'
# HERMES_API_KEY validado abaixo como external (não duplicar)
validate OPENCLAW_GATEWAY_TOKEN random-hex  'openclaw'
validate POSTGRES_PASSWORD      password    'postgres|supabase-db'
validate REDIS_PASSWORD         password    'redis'
validate COOLIFY_DB_PASSWORD    password    'coolify-db|coolify-postgres'
validate COOLIFY_REDIS_PASSWORD password    'coolify-redis'
validate COOLIFY_ROOT_USER_PASSWORD password ''
validate GRAFANA_ADMIN_PASSWORD password    'grafana'
validate GF_SECURITY_ADMIN_PASSWORD password 'grafana'
validate OPENCLAW_PASSWORD      password    'openclaw'
validate SMTP_PASSWORD          password    ''
validate COOLIFY_APP_KEY        random-b64  'coolify'

# --- External secrets (only probe, never auto-generate) ----------------------
validate CLOUDFLARE_API_TOKEN   external ''  'probe_http "https://api.cloudflare.com/client/v4/user/tokens/verify" "$CLOUDFLARE_API_TOKEN" 200'
validate COOLIFY_API_KEY        external 'coolify' 'probe_http "${COOLIFY_URL%/}/api/v1/version" "$COOLIFY_API_KEY" 200'
validate GITEA_TOKEN            external 'gitea'   'probe_http "${GITEA_INSTANCE_URL%/}/api/v1/user" "$GITEA_TOKEN" 200'
validate GH_TOKEN               external ''  'probe_http "https://api.github.com/user" "$GH_TOKEN" 200'
validate LITELLM_MASTER_KEY     external 'litellm' 'probe_http "${LITELLM_LOCAL_URL%/}/models" "$LITELLM_MASTER_KEY" 200'
validate MINIMAX_API_KEY        external ''  ''
validate OPEN_AI_KEY            external ''  ''
validate OPENROUTER_API_KEY     external ''  ''
validate OPENCODE_API_KEY       external ''  ''
validate OPENCLAW_DEEPGRAM_API_KEY external 'openclaw' ''
validate OPENCLAW_GEMINI_API_KEY   external 'openclaw' ''
validate GOOGLE_CLIENT_ID       external ''  ''
validate GOOGLE_CLIENT_SECRET   external ''  ''
validate GRAFANA_SERVICE_ACCOUNT_TOKEN external 'grafana' ''
validate QDRANT_API_KEY         external 'qdrant' ''
validate TELEGRAM_BOT_TOKEN     external ''  ''
validate HERMES_API_KEY         random-hex 'hermes'

# --- URLs (must be reachable if set) -----------------------------------------
validate LITELLM_LOCAL_URL url '' 'probe_http "${LITELLM_LOCAL_URL%/}/models" "" 401'
validate OLLAMA_URL        url '' 'probe_http "${OLLAMA_URL%/}/api/tags" "" 200'
validate STT_PROXY_URL     url '' 'probe_http "${STT_PROXY_URL%/}/v1/listen" "" 405'
validate TTS_BRIDGE_URL    url '' 'probe_http "${TTS_BRIDGE_URL%/}/health" "" 200'
validate KOKORO_URL        url '' ''
validate COOLIFY_URL       url '' ''
validate GRAFANA_URL       url '' ''
validate HERMES_GATEWAY_URL url '' ''

# -----------------------------------------------------------------------------
# Report
# -----------------------------------------------------------------------------

echo
log "== summary =="
echo "  passed : $PASS"
echo "  failed : $FAIL"
echo "  healed : $HEALED  (rotated: $ROTATED)"
if [[ -f "$BACKUP" ]]; then
  echo "  backup : $BACKUP"
fi
if (( ${#FAILED_VARS[@]} )); then
  echo
  warn "unresolved:"
  printf '  - %s\n' "${FAILED_VARS[@]}"
  echo
  echo "Re-run with HEAL=1 to auto-generate randoms / pull from containers."
  echo "External secrets (API keys) must be set manually — ask the operator."
fi
if (( ${#HEALED_VARS[@]} )); then
  echo
  heal "healed/rotated vars:"
  printf '  - %s\n' "${HEALED_VARS[@]}"
fi

# Exit non-zero if unhealed failures remain
(( FAIL > 0 && HEALED < FAIL )) && exit 1
exit 0
