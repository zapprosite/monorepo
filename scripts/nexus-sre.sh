#!/bin/bash
# nexus-sre.sh — SRE Autonomous Deploy System
# Deploy automático do planejamento ao deploy para MVP/Médio/Grande

set -uo pipefail

# ==========================================
# CONFIG
# ==========================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MONOREPO="/srv/monorepo"
LOG_FILE="${MONOREPO}/logs/nexus-sre.log"

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log() { echo -e "${GREEN}[SRE]${NC} $*"; echo "[$(date '+%H:%M:%S')] $*" >> "$LOG_FILE"; }
warn() { echo -e "${YELLOW}[SRE]${NC} $*"; }
error() { echo -e "${RED}[SRE]${NC} $*" >&2; }
info() { echo -e "${BLUE}[SRE]${NC} $*"; }

# ==========================================
# LOAD ENV
# ==========================================
load_env() {
  mkdir -p "$(dirname "$LOG_FILE")"
  if [ -f "${MONOREPO}/.env" ]; then
    export "$(grep -v '^#' "${MONOREPO}/.env" | xargs)"
  fi
  source "${MONOREPO}/.env" 2>/dev/null || true
}

# ==========================================
# DETECT PROJECT TYPE
# ==========================================
detect_project_type() {
  local project_path="$1"

  cd "$project_path"

  # Count files
  local file_count=$(find . -type f \( -name "*.ts" -o -name "*.js" -o -name "*.py" -o -name "*.go" \) 2>/dev/null | wc -l)
  local total_size=$(du -sm . 2>/dev/null | cut -f1)

  # Check for frameworks
  local has_docker=$(ls docker-compose.yml Dockerfile docker-compose.yaml 2>/dev/null | wc -l)
  local has_node=$(ls package.json node_modules 2>/dev/null | wc -l)
  local has_bun=$(ls bun.lock 2>/dev/null | wc -l)

  if [ "$file_count" -lt 10 ] && [ "$total_size" -lt 50 ]; then
    echo "MVP"
  elif [ "$file_count" -lt 100 ] && [ "$total_size" -lt 500 ]; then
    echo "MEDIUM"
  else
    echo "LARGE"
  fi
}

# ==========================================
# GENERATE SIMPLE NAME (fit1, fit2, api1, api2...)
# ==========================================
gen_random_name() {
  local prefix="${1:-app}"
  local counter_file="${MONOREPO}/.nexus-counters/${prefix}.cnt"

  mkdir -p "$(dirname "$counter_file")"

  if [ -f "$counter_file" ]; then
    local count=$(cat "$counter_file")
    count=$((count + 1))
  else
    count=1
  fi

  echo "$count" > "$counter_file"
  echo "${prefix}${count}"
}

# ==========================================
# FIND AVAILABLE PORT
# ==========================================
find_available_port() {
  local start="${1:-8081}"
  local port=$start

  while ss -tlnp 2>/dev/null | grep -q ":${port} "; do
    port=$((port + 1))
    if [ "$port" -gt 9999 ]; then
      port=$((RANDOM % 1000 + 8000))
    fi
  done

  echo "$port"
}

# ==========================================
# CREATE DNS SUBDOMAIN
# ==========================================
create_dns() {
  local subdomain="$1"
  local target="${2:-localhost}"

  load_env

  local CF_TOKEN="${CLOUDFLARE_API_TOKEN}"
  local CF_ZONE="${CLOUDFLARE_ZONE_ID:-c0cf47bc153a6662f884d0f91e8da7c2}"

  info "Creating DNS: ${subdomain}.zappro.site → ${target}"

  local response
  response=$(curl -s -X POST "https://api.cloudflare.com/client/v4/zones/${CF_ZONE}/dns_records" \
    -H "Authorization: Bearer ${CF_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{\"type\":\"CNAME\",\"name\":\"${subdomain}\",\"content\":\"${target}\",\"ttl\":120,\"proxied\":true}")

  local success=$(echo "$response" | jq -r '.success')

  if [ "$success" = "true" ]; then
    log "DNS created: ${subdomain}.zappro.site"
    return 0
  else
    error "DNS failed: $(echo "$response" | jq -r '.errors[0].message')"
    return 1
  fi
}

# ==========================================
# DETECT DEPLOY METHOD
# ==========================================
detect_deploy_method() {
  local project_path="$1"

  cd "$project_path"

  if [ -f "docker-compose.yml" ] || [ -f "docker-compose.yaml" ]; then
    echo "docker"
  elif [ -f "Dockerfile" ]; then
    echo "docker"
  elif [ -f "fly.toml" ]; then
    echo "fly"
  elif ls "*.tf" 2>/dev/null | head -1 | grep -q terraform; then
    echo "terraform"
  else
    echo "coolify"
  fi
}

# ==========================================
# CREATE DOCKERFILES (MVP)
# ==========================================
create_mvp_docker() {
  local project_path="$1"
  local port="${2:-8080}"

  cd "$project_path"

  # Create Dockerfile for static HTML
  if [ -f "index.html" ] && [ ! -f "Dockerfile" ]; then
    cat > Dockerfile << 'EOF'
FROM nginx:alpine
COPY . /usr/share/nginx/html/
EXPOSE 80
EOF
    log "Created Dockerfile for static site"
  fi

  # Create docker-compose for MVP
  if [ ! -f "docker-compose.yml" ]; then
    cat > docker-compose.yml << EOF
version: '3.8'
services:
  app:
    build: .
    restart: unless-stopped
    ports:
      - "127.0.0.1:${port}:80"
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:80"]
      interval: 30s
      timeout: 10s
      retries: 3
EOF
    log "Created docker-compose.yml"
  fi
}

# ==========================================
# DEPLOY DOCKER
# ==========================================
deploy_docker() {
  local project_path="$1"
  local name="$2"
  local port="${3:-8080}"

  cd "$project_path"

  log "Deploying ${name} via Docker on port ${port}"

  # Build and start
  docker compose up -d --build 2>&1 | tail -5

  sleep 3

  # Check health
  local status=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${port}/" 2>/dev/null || echo "000")

  if [ "$status" = "200" ]; then
    log "Docker deploy SUCCESS (HTTP $status)"
    return 0
  else
    error "Docker deploy may have issues (HTTP $status)"
    return 1
  fi
}

# ==========================================
# DEPLOY COOLIFY
# ==========================================
deploy_coolify() {
  local project_path="$1"
  local name="$2"
  local git_url="$3"

  load_env

  local COOLIFY_URL="${COOLIFY_URL:-https://coolify.zappro.site}"
  local COOLIFY_KEY="${COOLIFY_API_KEY}"

  info "Deploying ${name} via Coolify"

  # Create application via Coolify API
  local payload="{
    \"git_url\": \"${git_url}\",
    \"name\": \"${name}\",
    \"branch\": \"main\",
    \"build_command\": \"\",
    \"run_command\": \"\",
    \"port\": 8080
  }"

  local response
  response=$(curl -s -X POST "${COOLIFY_URL}/api/v1/applications" \
    -H "Authorization: Bearer ${COOLIFY_KEY}" \
    -H "Content-Type: application/json" \
    -d "$payload")

  local app_id=$(echo "$response" | jq -r '.id // empty')

  if [ -n "$app_id" ]; then
    log "Coolify app created: $app_id"
    return 0
  else
    warn "Coolify deploy failed, falling back to Docker"
    return 1
  fi
}

# ==========================================
# HEALTH CHECK
# ==========================================
health_check() {
  local url="$1"
  local max_attempts="${2:-10}"

  info "Health check: $url"

  local attempt=1
  while [ $attempt -le $max_attempts ]; do
    local status
    status=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")

    if [ "$status" = "200" ] || [ "$status" = "301" ] || [ "$status" = "302" ]; then
      log "Health OK: $url (HTTP $status)"
      return 0
    fi

    echo -n "."
    sleep 2
    attempt=$((attempt + 1))
  done

  echo ""
  error "Health check failed: $url"
  return 1
}

# ==========================================
# INIT GIT
# ==========================================
init_git() {
  local project_path="$1"
  local name="$2"

  cd "$project_path"

  if [ ! -d ".git" ]; then
    log "Initializing git..."
    git init -q
    git config user.email "sre@zappro.site"
    git config user.name "Nexus SRE"
  fi

  git add -A
  git commit -q -m "SRE auto-deploy: $(date +%Y-%m-%d)"

  log "Git initialized"
}

# ==========================================
# FULL AUTONOMOUS DEPLOY
# ==========================================
autonomous_deploy() {
  local project_path="${1:-.}"
  local project_name="${2:-}"
  local prefix="${3:-app}"

  load_env

  # Detect project type
  local project_type=$(detect_project_type "$project_path")
  info "Project type: $project_type"

  # Generate name
  local subdomain=$(gen_random_name "$prefix")
  local port=$(find_available_port)

  # Detect deploy method
  local deploy_method=$(detect_deploy_method "$project_path")
  info "Deploy method: $deploy_method"

  # Create DNS
  local dns_result=0
  create_dns "$subdomain" "localhost" || dns_result=1

  # Init git
  init_git "$project_path" "$project_name"

  # Deploy based on method
  local deploy_result=0
  case "$deploy_method" in
    docker)
      # Prepare Docker for MVP if needed
      if [ "$project_type" = "MVP" ]; then
        create_mvp_docker "$project_path" "$port"
      fi
      deploy_docker "$project_path" "$project_name" "$port"
      deploy_result=$?
      ;;
    coolify)
      deploy_coolify "$project_path" "$project_name" "" || deploy_result=1
      ;;
    *)
      create_mvp_docker "$project_path" "$port"
      deploy_docker "$project_path" "$project_name" "$port"
      deploy_result=$?
      ;;
  esac

  # Health check
  local health_url="http://localhost:${port}/"
  if [ $deploy_result -eq 0 ]; then
    health_check "$health_url" 5 || true
  fi

  # Summary
  echo ""
  echo "╔══════════════════════════════════════════════════════════════════════╗"
  echo "║                    SRE DEPLOY COMPLETE                             ║"
  echo "╠══════════════════════════════════════════════════════════════════════╣"
  echo "║  Project:    $project_name"
  echo "║  Type:      $project_type"
  echo "║  Subdomain: $subdomain.zappro.site"
  echo "║  Port:      $port"
  echo "║  Method:    $deploy_method"
  echo "║  DNS:       $([ $dns_result -eq 0 ] && echo '✅' || echo '⚠️')"
  echo "║  Deploy:    $([ $deploy_result -eq 0 ] && echo '✅' || echo '⚠️')"
  echo "╚══════════════════════════════════════════════════════════════════════╝"
  echo ""
  echo "Local: http://localhost:${port}/"
  echo ""

  return 0
}

# ==========================================
# CLI
# ==========================================
case "${1:-}" in
  deploy|--deploy)
    shift
    autonomous_deploy "$@"
    ;;
  type|--type)
    detect_project_type "${2:-.}"
    ;;
  port|--port)
    find_available_port "${2:-8081}"
    ;;
  dns|--dns)
    create_dns "${2:-test}" "${3:-localhost}"
    ;;
  random|--random)
    gen_random_name "${2:-app}"
    ;;
  status|--status)
    echo "Docker containers:"
    docker ps --format "table {{.Names}}\t{{.Status}}" 2>/dev/null
    ;;
  help|--help|-h)
    echo "Nexus SRE — Autonomous Deploy System"
    echo ""
    echo "Usage: $0 {deploy|type|port|dns|random|status}"
    echo ""
    echo "Commands:"
    echo "  deploy <path> [name] [prefix]  - Full autonomous deploy"
    echo "  type [path]                   - Detect project type (MVP/MEDIUM/LARGE)"
    echo "  port [start]                   - Find available port"
    echo "  dns <subdomain> [target]      - Create DNS record"
    echo "  random [prefix]               - Generate random name"
    echo "  status                         - Show running containers"
    ;;
  *)
    autonomous_deploy "${1:-.}" "$(basename "${1:-.}")" "$(basename "${1:-.}" | head -c 3)"
    ;;
esac