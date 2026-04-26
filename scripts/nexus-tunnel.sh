#!/bin/bash
# =============================================================================
# nexus-tunnel.sh — Cloudflare Tunnel Ingress Automation
# =============================================================================
# PURPOSE: Add ingress rules to Cloudflare Tunnel programmatically
# METHOD: Cloudflare API v4 - PUT /accounts/{id}/cfd_tunnel/{id}/configurations
#
# RESEARCH FINDINGS (from 20 agents):
#   - Tunnel Config API: PUT /accounts/{account_id}/cfd_tunnel/{tunnel_id}/configurations
#   - Uses Global Key (cfk_...) with X-Auth-Key and X-Auth-Email headers
#   - Ingress rules matched by hostname (first match wins)
#   - Can use wildcard hostname (*.domain.com) for catch-all
#   - REMEMBER: gym.zappro.site was fixed using this exact endpoint!
#
# USAGE:
#   nexus-tunnel.sh add <subdomain> <service_url> [description]
#   nexus-tunnel.sh list
#   nexus-tunnel.sh remove <subdomain>
#   nexus-tunnel.sh reload
#
# EXAMPLES:
#   nexus-tunnel.sh add gym http://localhost:4010 "Gym MVP"
#   nexus-tunnel.sh add api http://localhost:4000 "API Gateway"
#
# ERROR CODES:
#   0 = Success
#   1 = API call failed
#   2 = Invalid arguments
#   3 = Tunnel not found
#   4 = Auth failed
# =============================================================================

set -uo pipefail

# ===== CONFIGURATION =====
MONOREPO="${MONOREPO:-/srv/monorepo}"
LOG_FILE="${MONOREPO}/logs/nexus-tunnel.log"
TUNNEL_ID="aee7a93d-c2e2-4c77-a395-71edc1821402"
TUNNEL_CNAME="aee7a93d-c2e2-4c77-a395-71edc1821402.cfargotunnel.com"
DOMAIN="zappro.site"

# API Endpoints
CF_API="https://api.cloudflare.com/client/v4"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'
[ -t 1 ] || { RED=; GREEN=; YELLOW=; BLUE=; NC=; }

# ===== LOGGING =====
log() { echo -e "${GREEN}[TUNNEL]${NC} $*"; echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG_FILE" 2>/dev/null || true; }
warn() { echo -e "${YELLOW}[TUNNEL]${NC} $*"; }
error() { echo -e "${RED}[TUNNEL]${NC} $*" >&2; }
info() { echo -e "${BLUE}[TUNNEL]${NC} $*"; }

# ===== LOAD ENV =====
load_env() {
  if [ -f "${MONOREPO}/.env" ]; then
    set -a
    source "${MONOREPO}/.env"
    set +a
  fi

  # Load from terraform.tfvars
  if [ -f "/srv/ops/terraform/cloudflare/terraform.tfvars" ]; then
    while IFS='=' read -r key value; do
      value=$(echo "$value" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//;s/^"//;s/"$//')
      case "$key" in
        cloudflare_account_id) CF_ACCOUNT_ID="$value" ;;
        cloudflare_api_token) CLOUDFLARE_API_TOKEN="$value" ;;
      esac
    done < /srv/ops/terraform/cloudflare/terraform.tfvars
  fi

  # Fallbacks
  : "${CF_ACCOUNT_ID:=1a41f45591a50585050f664fa015d01b}"
  : "${CLOUDFLARE_API_TOKEN:=${CF_TOKEN:-}}"
  : "${CF_GLOBAL_KEY:=${CF_GLOBAL_KEY:-}}"
  : "${CF_EMAIL:=zappro.ia@gmail.com}"
}

# ===== GET AUTH HEADERS =====
get_auth_headers() {
  # Prefer Global Key over User Token (Global Key has more permissions)
  if [ -n "${CF_GLOBAL_KEY}" ]; then
    echo "-H \"X-Auth-Key: ${CF_GLOBAL_KEY}\" -H \"X-Auth-Email: ${CF_EMAIL}\""
  else
    echo "-H \"Authorization: Bearer ${CLOUDFLARE_API_TOKEN}\""
  fi
}

# ===== GET CURRENT TUNNEL CONFIG =====
get_tunnel_config() {
  load_env

  # Use cfd_tunnel endpoint (not tunnels)
  local auth_headers
  auth_headers=$(get_auth_headers)

  local config
  config=$(curl -s -X GET \
    "${CF_API}/accounts/${CF_ACCOUNT_ID}/cfd_tunnel/${TUNNEL_ID}/configurations" \
    -H "X-Auth-Key: ${CF_GLOBAL_KEY}" \
    -H "X-Auth-Email: ${CF_EMAIL}" \
    -H "Content-Type: application/json")

  echo "$config"
}

# ===== UPDATE TUNNEL CONFIG =====
update_tunnel_config() {
  local config_json="$1"

  load_env

  # CRITICAL: Use cfd_tunnel endpoint with Global Key authentication
  # Endpoint: /accounts/{id}/cfd_tunnel/{id}/configurations (NOT /tunnels/)
  local response
  response=$(curl -s -X PUT \
    "${CF_API}/accounts/${CF_ACCOUNT_ID}/cfd_tunnel/${TUNNEL_ID}/configurations" \
    -H "X-Auth-Key: ${CF_GLOBAL_KEY}" \
    -H "X-Auth-Email: ${CF_EMAIL}" \
    -H "Content-Type: application/json" \
    -d "$config_json")

  local success
  success=$(echo "$response" | jq -r '.success')

  if [ "$success" = "true" ]; then
    log "Tunnel config updated successfully"
    return 0
  else
    local err_msg
    err_msg=$(echo "$response" | jq -r '.errors[0].message // "unknown error"')
    error "Tunnel config update failed: $err_msg"
    return 1
  fi
}

# ===== ADD INGRESS RULE =====
add_ingress() {
  local subdomain="$1"
  local service="$2"  # e.g., http://localhost:4010
  local description="${3:-nexus-auto}"

  log "Adding ingress: ${subdomain}.${DOMAIN} → ${service}"

  # Validate inputs
  if [ -z "$subdomain" ] || [ -z "$service" ]; then
    error "Usage: add_ingress <subdomain> <service_url>"
    return 2
  fi

  # Get current config
  local current_config
  current_config=$(get_tunnel_config)

  if [ -z "$current_config" ] || echo "$current_config" | jq -r '.success' 2>/dev/null | grep -q "null"; then
    error "Failed to get tunnel config"
    return 1
  fi

  # Check if ingress already exists for this hostname
  local existing
  existing=$(echo "$current_config" | jq -r ".config.ingress_rule[] | select(.hostname == \"${subdomain}.${DOMAIN}\") | .hostname" 2>/dev/null)

  if [ -n "$existing" ]; then
    warn "Ingress already exists for ${subdomain}.${DOMAIN}, updating..."
  fi

  # Build new ingress rule
  local new_ingress
  new_ingress=$(jq -n \
    --arg hostname "${subdomain}.${DOMAIN}" \
    --arg service "$service" \
    --arg desc "$description" \
    '{
      hostname: $hostname,
      service: $service,
      origin_request: {
        http_host_header: $hostname
      },
      comment: $desc
    }')

  # Add to ingress rules (prepend for priority)
  local updated_config
  updated_config=$(echo "$current_config" | jq \
    --argjson new_rule "$new_ingress" \
    '.config.ingress_rule = [$new_rule] + .config.ingress_rule')

  # Update tunnel config
  if update_tunnel_config "$(echo "$updated_config" | jq '.config')"; then
    log "Ingress added: ${subdomain}.${DOMAIN} → ${service}"
    return 0
  else
    return 1
  fi
}

# ===== REMOVE INGRESS RULE =====
remove_ingress() {
  local subdomain="$1"

  log "Removing ingress: ${subdomain}.${DOMAIN}"

  local current_config
  current_config=$(get_tunnel_config)

  # Count current ingress rules
  local count
  count=$(echo "$current_config" | jq '.config.ingress | length')

  if [ "$count" -le 1 ]; then
    warn "Cannot remove last ingress rule"
    return 1
  fi

  # Remove ingress with this hostname
  local updated_config
  updated_config=$(echo "$current_config" | jq \
    --arg hostname "${subdomain}.${DOMAIN}" \
    '.config.ingress = [.config.ingress[] | select(.hostname != $hostname)]')

  update_tunnel_config "$(echo "$updated_config" | jq '.config')"
}

# ===== LIST INGRESS RULES =====
list_ingress() {
  load_env

  echo "╔══════════════════════════════════════════════════════════════════════╗"
  echo "║                    TUNNEL INGRESS RULES                    ║"
  echo "╠══════════════════════════════════════════════════════════════════════╣"
  echo "║  Tunnel ID: $TUNNEL_ID"
  echo "║  Tunnel CNAME: $TUNNEL_CNAME"
  echo "╠══════════════════════════════════════════════════════════════════════╣"

  local config
  config=$(get_tunnel_config)

  echo "$config" | jq -r '.result.config.ingress[] | "║  \(.hostname // "catch-all") → \(.service)"' 2>/dev/null || \
    echo "║  Erro ao carregar config"

  echo "╚══════════════════════════════════════════════════════════════════════╝"
}

# ===== RELOAD TUNNEL =====
reload_tunnel() {
  info "Reloading tunnel connection..."

  # Restart cloudflared service
  if sudo systemctl restart cloudflared 2>/dev/null; then
    log "Cloudflared restarted"
    return 0
  else
    warn "Failed to restart cloudflared, try: sudo systemctl restart cloudflared"
    return 1
  fi
}

# ===== TEST INGRESS (DEEP - uses nexus-investigate.sh) =====
test_ingress() {
  local subdomain="$1"

  info "Testing: https://${subdomain}.${DOMAIN}"

  # Use the deep investigation for accurate results (no false positives)
  if command -v nexus-investigate.sh &>/dev/null; then
    bash "${MONOREPO}/scripts/nexus-investigate.sh" "$subdomain" 2 2>&1 | tail -3
    return $?
  fi

  # Fallback to simple HTTP check
  local status
  status=$(curl -s -o /dev/null -w "%{http_code}" \
    --connect-timeout 10 \
    "https://${subdomain}.${DOMAIN}" 2>/dev/null || echo "000")

  case "$status" in
    200|301|302)
      log "✅ ${subdomain}.${DOMAIN} accessible (HTTP $status)"
      return 0
      ;;
    404)
      # Try /health endpoint before declaring unhealthy
      local health_status
      health_status=$(curl -s -o /dev/null -w "%{http_code}" \
        --connect-timeout 5 \
        "https://${subdomain}.${DOMAIN}/health" 2>/dev/null || echo "000")
      if [ "$health_status" = "200" ]; then
        log "✅ ${subdomain}.${DOMAIN} /health OK (HTTP 200)"
        return 0
      fi
      warn "⚠️  ${subdomain}.${DOMAIN} not routed (404 - no ingress rule)"
      return 1
      ;;
    502|503)
      warn "⚠️  ${subdomain}.${DOMAIN} bad gateway (service unreachable)"
      return 1
      ;;
    *)
      error "❌ ${subdomain}.${DOMAIN} failed (HTTP $status)"
      return 1
      ;;
  esac
}

# ===== MAIN CLI =====
main() {
  local command="${1:-}"
  local arg1="${2:-}"
  local arg2="${3:-}"
  local arg3="${4:-}"

  mkdir -p "$(dirname "$LOG_FILE")"

  case "$command" in
    add)
      add_ingress "$arg1" "$arg2" "${arg3:-nexus-auto}"
      ;;
    remove|rm|delete)
      remove_ingress "$arg1"
      ;;
    list|ls)
      list_ingress
      ;;
    reload|restart)
      reload_tunnel
      ;;
    test)
      test_ingress "$arg1"
      ;;
    --help|-h)
      cat << 'EOF'
nexus-tunnel.sh — Cloudflare Tunnel Ingress Automation

SYNOPSIS:
  nexus-tunnel.sh <command> [args]

COMMANDS:
  add <subdomain> <service_url> [desc]
        Add ingress rule (subdomain.zappro.site → service)

  remove <subdomain>
        Remove ingress rule

  list
        List all ingress rules

  reload
        Restart cloudflared to pick up config changes

  test <subdomain>
        Test if subdomain is accessible via tunnel

EXAMPLES:
  # Add ingress for gym app
  nexus-tunnel.sh add gym http://localhost:4010 "Gym MVP"

  # Add ingress for API
  nexus-tunnel.sh add api http://localhost:4000 "API Gateway"

  # List all rules
  nexus-tunnel.sh list

  # Reload after config change
  nexus-tunnel.sh reload

  # Test if working
  nexus-tunnel.sh test gym

TROUBLESHOOTING:
  - 404 error: Ingress rule not created or tunnel not reloaded
  - Auth error: API token needs Tunnel:Edit permission
  - Service unreachable: Local service not running

PERMISSIONS NEEDED:
  Cloudflare API token requires:
  - Account: Tunnel:Edit
  - Account: Tunnel:Read
EOF
      ;;
    *)
      main --help
      ;;
  esac
}

main "$@"
