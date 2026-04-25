#!/bin/bash
# nexus-deploy.sh — Auto-deploy com subdomain random para MVPs

set -euo pipefail

MONOREPO="/srv/monorepo"
SCRIPTS="$MONOREPO/scripts"
LOG="$MONOREPO/logs/nexus-deploy.log"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG"
}

# Gera subdomain random
generate_random_subdomain() {
  local prefix="${1:-saas}"
  local random=$(openssl rand -hex 3 2>/dev/null | cut -c1-6)
  echo "${prefix}-${random}"
}

# Verifica se subdomain existe
subdomain_exists() {
  local sub="$1"
  curl -s -o /dev/null -w "%{http_code}" "https://${sub}.zappro.site" | grep -q "200\|301\|302"
}

# Cria subdomain via Cloudflare API
create_subdomain() {
  local name="$1"
  local target="${2:-localhost:8080}"

  log "Criando subdomain: ${name}.zappro.site → ${target}"

  # Cloudflare API
  local CF_API_TOKEN=$(grep CF_API_TOKEN "$HOME/.env" | cut -d'=' -f2)
  local CF_ZONE=$(grep CF_ZONE_ID "$HOME/.env" | cut -d'=' -f2)

  curl -s -X POST "https://api.cloudflare.com/client/v4/zones/${CF_ZONE}/dns_records" \
    -H "Authorization: Bearer ${CF_API_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{\"type\":\"CNAME\",\"name\":\"${name}\",\"content\":\"${target}\",\"ttl\":120,\"proxied\":true}" \
    | jq -r '.success'
}

# Deploy MVP (localStorage = sem porta)
deploy_mvp_localstorage() {
  local name="$1"
  local project_path="$2"

  log "Deploy MVP localStorage: $name"

  # Gera subdomain random se necessario
  local subdomain
  subdomain=$(generate_random_subdomain "$name")

  # Verifica se ja existe
  if subdomain_exists "$subdomain"; then
    log "Subdomain ja existe, gerando novo..."
    subdomain=$(generate_random_subdomain "$name")
  fi

  # Cria subdomain
  if create_subdomain "$subdomain" "localhost:8080"; then
    log "✅ Subdomain criado: ${subdomain}.zappro.site"
    echo "${subdomain}"
  else
    log "❌ Falha ao criar subdomain"
    return 1
  fi
}

# Deploy com Docker
deploy_mvp_docker() {
  local name="$1"
  local project_path="$2"
  local port="${3:-8080}"

  log "Deploy MVP Docker: $name na porta $port"

  # Gera subdomain
  local subdomain
  subdomain=$(generate_random_subdomain "$name")

  # Docker compose up
  if [ -f "$project_path/docker-compose.yml" ]; then
    cd "$project_path"
    docker compose up -d
    log "✅ Docker deployed"
  fi

  # Cria subdomain
  create_subdomain "$subdomain" "localhost:$port"

  echo "$subdomain"
}

# Main
main() {
  local cmd="${1:-}"
  shift || true

  mkdir -p "$(dirname "$LOG")"

  case "$cmd" in
    random)
      local prefix="${1:-saas}"
      generate_random_subdomain "$prefix"
      ;;

    check)
      local sub="${1:-}"
      if subdomain_exists "$sub"; then
        echo "EXISTS"
      else
        echo "AVAILABLE"
      fi
      ;;

    deploy-local)
      local name="${1:-}"
      local path="${2:-.}"
      if [ -z "$name" ]; then
        echo "Usage: $0 deploy-local <name> <path>"
        exit 1
      fi
      deploy_mvp_localstorage "$name" "$path"
      ;;

    deploy-docker)
      local name="${1:-}"
      local path="${2:-.}"
      local port="${3:-8080}"
      if [ -z "$name" ]; then
        echo "Usage: $0 deploy-docker <name> <path> <port>"
        exit 1
      fi
      deploy_mvp_docker "$name" "$path" "$port"
      ;;

    *)
      echo "Usage: $0 {random|check|deploy-local|deploy-docker}"
      echo ""
      echo "Examples:"
      echo "  $0 random saas           # Gera: saas-abc123"
      echo "  $0 check saas-abc123     # Verifica se existe"
      echo "  $0 deploy-local fit /srv/fit-tracker"
      ;;
  esac
}

main "$@"
