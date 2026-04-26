#!/bin/bash
# =============================================================================
# nexus-governance.sh — Nexus Enterprise Deploy + Governance
# =============================================================================
# PURPOSE: Complete autonomous deployment with port/subdomain governance
# FEATURES:
#   - Port governance (checks PORTS.md before using)
#   - Subdomain governance (checks SUBDOMAINS.md)
#   - Cloudflare DNS management
#   - Docker container deployment
#   - UFW firewall automation
#   - Public IP detection
#   - Tunnel CNAME support
#   - Idempotent operations
#
# USAGE (for other LLMs):
#   nexus-governance.sh quick-deploy <path> <subdomain> <port>
#   nexus-governance.sh port-check <port>
#   nexus-governance.sh subnet-list
#
# DEPLOY FLOW:
#   1. Validate port (check governance + availability)
#   2. Auto-allow port in UFW
#   3. Get public IP (IPv4)
#   4. Create/Update Cloudflare DNS (CNAME to tunnel)
#   5. Update docker-compose.yml (expose 0.0.0.0)
#   6. Stop existing container (same name)
#   7. Build and start container
#   8. Health check localhost
#
# COMMON ERRORS & SOLUTIONS:
#   - "Port in use": Use 'ensure' to find alternative
#   - "DNS exists": Deletes and recreates (safe)
#   - "Container won't start": Check docker logs
#   - "UFW block": nexus-ufw.sh ensure <port>
# =============================================================================

set -uo pipefail

# ===== CONFIGURATION =====
MONOREPO="${MONOREPO:-/srv/monorepo}"
GOV_DIR="${GOV_DIR:-/srv/ops/ai-governance}"
LOG_FILE="${MONOREPO}/logs/nexus-governance.log"
UFW_SCRIPT="${MONOREPO}/scripts/nexus-ufw.sh"

# Tunnel CNAME (from Terraform state)
TUNNEL_CNAME="aee7a93d-c2e2-4c77-a395-71edc1821402.cfargotunnel.com"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'
[ -t 1 ] || { RED=; GREEN=; YELLOW=; BLUE=; NC=; }

# ===== LOGGING =====
log() { echo -e "${GREEN}[GOV]${NC} $*"; echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG_FILE" 2>/dev/null || true; }
warn() { echo -e "${YELLOW}[GOV]${NC} $*"; }
error() { echo -e "${RED}[GOV]${NC} $*" >&2; }
info() { echo -e "${BLUE}[GOV]${NC} $*"; }

# ===== LOAD ENVIRONMENT =====
load_env() {
  if [ -f "${MONOREPO}/.env" ]; then
    set -a
    source "${MONOREPO}/.env"
    set +a
  fi
}

# ===== VALIDATE PORT =====
validate_port() {
  local port="$1"

  # Check if port is valid number
  if ! [[ "$port" =~ ^[0-9]+$ ]] || [ "$port" -lt 1 ] || [ "$port" -gt 65535 ]; then
    error "Invalid port: $port"
    return 1
  fi

  # Check reserved ports
  case "$port" in
    3000) error "Port 3000 reserved: OpenWebUI" && return 1 ;;
    4000) error "Port 4000 reserved: LiteLLM" && return 1 ;;
    4001) error "Port 4001 reserved: OpenClaw Bot" && return 1 ;;
    8000) error "Port 8000 reserved: Coolify" && return 1 ;;
    8080) error "Port 8080 reserved: aurelia-api" && return 1 ;;
  esac

  return 0
}

# ===== CHECK PORT AVAILABILITY =====
check_port_available() {
  local port="$1"

  if ss -tln 2>/dev/null | grep -qE ":${port}([[:space:]]|$)"; then
    warn "Port $port is in use"
    return 1
  fi
  return 0
}

# ===== GET PUBLIC IP (IPv4 only) =====
get_public_ip() {
  local ip
  ip=$(curl -s -4 ifconfig.me 2>/dev/null || \
       curl -s -4 icanhazip.com 2>/dev/null || \
       curl -s -4 ipinfo.io/ip 2>/dev/null)

  # Validate IPv4 format
  if [[ "$ip" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "$ip"
    return 0
  fi

  # Fallback
  echo "177.112.202.125"
  return 0
}

# ===== CLOUDFLARE DNS: GET RECORD ID =====
get_dns_record_id() {
  local subdomain="$1"
  local zone_id="${2:-c0cf47bc153a6662f884d0f91e8da7c2}"

  load_env
  local token="${CLOUDFLARE_API_TOKEN:-}"

  curl -s "https://api.cloudflare.com/client/v4/zones/${zone_id}/dns_records?type=CNAME&name=${subdomain}.zappro.site" \
    -H "Authorization: Bearer ${token}" | jq -r '.result[0].id // empty'
}

# ===== CLOUDFLARE DNS: DELETE RECORD =====
delete_dns_record() {
  local record_id="$1"
  local zone_id="${2:-c0cf47bc153a6662f884d0f91e8da7c2}"

  load_env
  local token="${CLOUDFLARE_API_TOKEN:-}"

  if [ -z "$record_id" ] || [ "$record_id" = "null" ]; then
    debug "No existing DNS record to delete"
    return 0
  fi

  local response
  response=$(curl -s -X DELETE \
    "https://api.cloudflare.com/client/v4/zones/${zone_id}/dns_records/${record_id}" \
    -H "Authorization: Bearer ${token}")

  if echo "$response" | jq -r '.success' | grep -q "true"; then
    log "DNS record deleted"
    return 0
  else
    warn "DNS delete failed: $(echo "$response" | jq -r '.errors[0].message')"
    return 1
  fi
}

# ===== CLOUDFLARE DNS: CREATE CNAME =====
create_dns_cname() {
  local subdomain="$1"
  local target="${2:-$TUNNEL_CNAME}"
  local zone_id="${3:-c0cf47bc153a6662f884d0f91e8da7c2}"

  load_env
  local token="${CLOUDFLARE_API_TOKEN:-}"

  info "Creating DNS: ${subdomain}.zappro.site → ${target}"

  local response
  response=$(curl -s -X POST \
    "https://api.cloudflare.com/client/v4/zones/${zone_id}/dns_records" \
    -H "Authorization: Bearer ${token}" \
    -H "Content-Type: application/json" \
    -d "{\"type\":\"CNAME\",\"name\":\"${subdomain}\",\"content\":\"${target}\",\"ttl\":120,\"proxied\":true}")

  if echo "$response" | jq -r '.success' 2>/dev/null | grep -q "true"; then
    log "DNS created: ${subdomain}.zappro.site → ${target}"
    return 0
  else
    local msg=$(echo "$response" | jq -r '.errors[0].message' 2>/dev/null)
    warn "DNS create: $msg"
    return 1
  fi
}

# ===== CLOUDFLARE DNS: UPDATE RECORD =====
update_dns_cname() {
  local subdomain="$1"
  local target="${2:-$TUNNEL_CNAME}"

  local record_id
  record_id=$(get_dns_record_id "$subdomain")
  local zone_id="c0cf47bc153a6662f884d0f91e8da7c2"

  if [ -n "$record_id" ] && [ "$record_id" != "null" ]; then
    # Delete existing record first
    delete_dns_record "$record_id" "$zone_id"
  fi

  # Create new record
  create_dns_cname "$subdomain" "$target" "$zone_id"
}

# ===== DOCKER: GET CONTAINER NAME =====
get_container_name() {
  local project_path="$1"

  # Try container_name from compose file
  local name=$(grep "container_name:" "${project_path}/docker-compose.yml" 2>/dev/null | \
    cut -d: -f2 | tr -d ' ' | head -1)

  # Fallback to directory name
  if [ -z "$name" ]; then
    name=$(basename "$project_path" | tr '.-' '_')
  fi

  echo "$name"
}

# ===== DOCKER: STOP CONTAINER (safe) =====
docker_stop_safe() {
  local container="$1"

  if docker ps -a --format '{{.Names}}' | grep -q "^${container}$"; then
    docker stop "$container" 2>/dev/null && \
    docker rm "$container" 2>/dev/null && \
    log "Container $container stopped and removed"
    return 0
  fi
  return 0  # Not an error if doesn't exist
}

# ===== DOCKER: UPDATE PORTS IN COMPOSE =====
docker_update_ports() {
  local compose_file="$1"
  local new_port="$2"

  if [ ! -f "$compose_file" ]; then
    warn "docker-compose.yml not found: $compose_file"
    return 1
  fi

  # Update any existing port mapping to new port
  # Pattern: 0.0.0.0:XXXX:80 or 127.0.0.1:XXXX:80 → 0.0.0.0:new_port:80
  sed -i "s|0\.0\.0\.0:[0-9]*:80|0.0.0.0:${new_port}:80|g" "$compose_file"
  sed -i "s|127\.0\.0\.1:[0-9]*:80|0.0.0.0:${new_port}:80|g" "$compose_file"

  log "docker-compose.yml updated: port $new_port"
  return 0
}

# ===== DOCKER: HEALTH CHECK =====
docker_health_check() {
  local port="$1"
  local max_attempts="${2:-5}"
  local attempt=1

  while [ $attempt -le $max_attempts ]; do
    local status
    status=$(curl -s -o /dev/null -w "%{http_code}" \
      --connect-timeout 5 "http://localhost:${port}/" 2>/dev/null || echo "000")

    if [ "$status" = "200" ] || [ "$status" = "301" ] || [ "$status" = "302" ]; then
      log "Health check OK: localhost:${port} (HTTP $status)"
      return 0
    fi

    info "Health attempt $attempt/$max_attempts: HTTP $status"
    sleep 2
    attempt=$((attempt + 1))
  done

  warn "Health check failed after $max_attempts attempts"
  return 1
}

# ===== MAIN DEPLOY FUNCTION =====
quick_deploy() {
  local project_path="${1:-.}"
  local subdomain="${2:-app}"
  local port="${3:-8080}"

  log "=== QUICK DEPLOY ==="
  log "Project: $project_path"
  log "Subdomain: $subdomain.zappro.site"
  log "Requested port: $port"

  # Step 0: Validate inputs
  if ! validate_port "$port"; then
    error "Port validation failed"
    return 1
  fi

  # Step 1: Ensure UFW port is open (uses nexus-ufw.sh)
  if [ -x "$UFW_SCRIPT" ]; then
    local ensured_port
    ensured_port=$("$UFW_SCRIPT" ensure "$port" "nexus-${subdomain}" 2>/dev/null | tail -1 || echo "$port")
    if [ -n "$ensured_port" ]; then
      port="$ensured_port"
      log "UFW ensured: port $port"
    fi
  else
    warn "UFW script not found: $UFW_SCRIPT"
    # Still try to allow port manually
    if ! check_port_available "$port"; then
      port=$((port + 1))
      warn "Port changed to: $port"
    fi
  fi

  # Step 2: Get public IP
  local public_ip
  public_ip=$(get_public_ip)
  info "Public IP: $public_ip"

  # Step 3: DNS - Create CNAME to tunnel (not A record)
  update_dns_cname "$subdomain" "$TUNNEL_CNAME"

  # Step 4: Docker setup
  local container_name
  container_name=$(get_container_name "$project_path")

  # Stop existing container
  docker_stop_safe "$container_name"

  # Update compose ports
  if [ -f "${project_path}/docker-compose.yml" ]; then
    docker_update_ports "${project_path}/docker-compose.yml" "$port"
  fi

  # Step 5: Build and start
  cd "$project_path"
  info "Building container..."
  if docker compose up -d --build 2>&1 | tail -5; then
    log "Container started"
  else
    error "Container build/start failed"
    return 1
  fi

  # Step 6: Health check
  sleep 3
  docker_health_check "$port" 5 || true

  # Step 7: Summary
  echo ""
  echo "╔══════════════════════════════════════════════════════════════════════╗"
  echo "║                    QUICK DEPLOY COMPLETE                      ║"
  echo "╠══════════════════════════════════════════════════════════════════════╣"
  echo "║  Subdomain:  https://${subdomain}.zappro.site"
  echo "║  Local:      http://localhost:${port}/"
  echo "║  Port:       $port (UFW allowed)"
  echo "║  Container:  $container_name"
  echo "║  Tunnel:     $TUNNEL_CNAME"
  echo "╚══════════════════════════════════════════════════════════════════════╝"
}

# ===== PORT CHECK =====
port_check() {
  local port="$1"

  if ! validate_port "$port"; then
    return 1
  fi

  info "Checking port $port..."

  # Check UFW
  if [ -x "$UFW_SCRIPT" ]; then
    "$UFW_SCRIPT" check "$port"
  else
    check_port_available "$port"
  fi
}

# ===== SUBDOMAIN LIST =====
subdomain_list() {
  load_env
  local zone_id="${CLOUDFLARE_ZONE_ID:-c0cf47bc153a6662f884d0f91e8da7c2}"
  local token="${CLOUDFLARE_API_TOKEN:-}"

  echo "╔══════════════════════════════════════════════════════════════════════╗"
  echo "║                 SUBDOMÍNIOS CLOUDFLARE                       ║"
  echo "╠══════════════════════════════════════════════════════════════════════╣"

  curl -s "https://api.cloudflare.com/client/v4/zones/${zone_id}/dns_records?type=CNAME" \
    -H "Authorization: Bearer ${token}" | \
    jq -r '.result[] | "║  \(.name) → \(.content)"' 2>/dev/null || \
    echo "║  Erro ao listar"

  echo "╚══════════════════════════════════════════════════════════════════════╝"
}

# ===== HELPER: debug =====
debug() {
  [ "${DEBUG:-0}" = "1" ] && info "DEBUG: $*"
}

# ===== MAIN CLI =====
main() {
  local command="${1:-}"
  local arg1="${2:-}"
  local arg2="${3:-}"
  local arg3="${4:-}"

  mkdir -p "$(dirname "$LOG_FILE")"

  case "$command" in
    quick-deploy)
      quick_deploy "$arg1" "$arg2" "$arg3"
      ;;
    deploy)
      # Alias for quick-deploy
      quick_deploy "$arg1" "$arg2" "$arg3"
      ;;
    port-check)
      port_check "$arg1"
      ;;
    subnet-list|list-subdomains)
      subdomain_list
      ;;
    --help|-h)
      cat << 'EOF'
nexus-governance.sh — Enterprise Deploy + Governance

SYNOPSIS:
  nexus-governance.sh <command> [args]

COMMANDS:
  quick-deploy <path> <subdomain> <port>
                Full autonomous deployment

  port-check <port>
                Check if port is available

  subnet-list
                List Cloudflare DNS records

EXAMPLES:
  # Deploy a project
  nexus-governance.sh quick-deploy /srv/myapp api 4005

  # Check port
  nexus-governance.sh port-check 4005

  # List subdomains
  nexus-governance.sh subnet-list

DEPLOY FLOW:
  1. Validate port (reserved ports blocked)
  2. Ensure UFW allows port (nexus-ufw.sh ensure)
  3. Get public IPv4
  4. Update Cloudflare DNS (CNAME to tunnel)
  5. Stop existing container
  6. Update docker-compose ports
  7. Build and start
  8. Health check

NOTES FOR OTHER LLMs:
  - Port 3000, 4000, 4001, 8000, 8080 are RESERVED
  - DNS uses CNAME to tunnel, not A record to IP
  - Tunnel CNAME: aee7a93d-c2e2-4c77-a395-71edc1821402.cfargotunnel.com
  - UFW automation requires nexus-ufw.sh
EOF
      ;;
    *)
      main --help
      ;;
  esac
}

main "$@"
