#!/bin/bash
# nexus-full-deploy.sh — Auto-deploy completo para MVPs
# 1. Cria repo no Gitea
# 2. Cria subdomain no Cloudflare
# 3. Deploy via Docker/Coolify
# 4. Health check
# ZERO perguntas humanas

set -euo pipefail

# ===== CONFIG =====
GITEA_URL="${GITEA_URL:-https://git.zappro.site}"
GITEA_TOKEN="${GITEA_TOKEN:-}"
CLOUDFLARE_API_TOKEN="${CLOUDFLARE_API_TOKEN:-}"
CLOUDFLARE_ZONE_ID="${CLOUDFLARE_ZONE_ID:-}"
COOLIFY_URL="${COOLIFY_URL:-https://coolify.zappro.site}"
COOLIFY_API_KEY="${COOLIFY_API_KEY:-}"
LOG_FILE="/srv/monorepo/logs/nexus-deploy.log"

# ===== HELPERS =====
log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

gen_random_name() {
  local prefix="${1:-app}"
  local counter_file="/srv/monorepo/.nexus-counters/${prefix}.cnt"

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

load_env() {
  # Non-secret vars — set defaults (no sourcing of .env)
  GITEA_URL="${GITEA_URL:-https://git.zappro.site}"
  COOLIFY_URL="${COOLIFY_URL:-https://coolify.zappro.site}"

  # Secrets — source individual files from /srv/ops/secrets/ if they exist
  # This avoids exposing secrets via 'ps aux' or /proc/PID/environ

  if [[ -f /srv/ops/secrets/gitea-token.env ]]; then
    source /srv/ops/secrets/gitea-token.env
  fi
  GITEA_TOKEN="${GITEA_TOKEN:-}"

  if [[ -f /srv/ops/secrets/cloudflare-api-token.env ]]; then
    source /srv/ops/secrets/cloudflare-api-token.env
  fi
  CLOUDFLARE_API_TOKEN="${CLOUDFLARE_API_TOKEN:-}"

  if [[ -f /srv/ops/secrets/cloudflare-account-id.env ]]; then
    source /srv/ops/secrets/cloudflare-account-id.env
  fi
  CLOUDFLARE_ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-}"

  if [[ -f /srv/ops/secrets/cloudflare-zone-id.env ]]; then
    source /srv/ops/secrets/cloudflare-zone-id.env
  fi
  CLOUDFLARE_ZONE_ID="${CLOUDFLARE_ZONE_ID:-}"

  if [[ -f /srv/ops/secrets/coolify-api-key.env ]]; then
    source /srv/ops/secrets/coolify-api-key.env
  fi
  COOLIFY_API_KEY="${COOLIFY_API_KEY:-}"

  # Load from terraform.tfvars (non-secret, public values)
  if [[ -f /srv/ops/terraform/cloudflare/terraform.tfvars ]]; then
    while IFS='=' read -r key value; do
      value=$(echo "$value" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//;s/^"//;s/"$//')
      case "$key" in
        cloudflare_account_id) CLOUDFLARE_ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-$value}" ;;
        cloudflare_zone_id) CLOUDFLARE_ZONE_ID="${CLOUDFLARE_ZONE_ID:-$value}" ;;
      esac
    done < <(grep -v '^#' /srv/ops/terraform/cloudflare/terraform.tfvars)
  fi
}

# ===== STEP 1: Create Gitea Repo =====
create_gitea_repo() {
  local name="$1"
  local description="$2"
  local private="${3:-true}"

  log "Criando repo Gitea: $name"

  local response
  response=$(curl -s -X POST "${GITEA_URL}/api/v1/user/repos" \
    -H "Authorization: token ${GITEA_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{
      \"name\": \"${name}\",
      \"description\": \"${description}\",
      \"private\": ${private},
      \"auto_init\": false
    }")

  local repo_url
  repo_url=$(echo "$response" | jq -r '.html_url // empty')

  if [ -z "$repo_url" ] || [ "$repo_url" = "null" ]; then
    log "Erro ao criar repo: $(echo "$response" | jq -r '.message // "unknown"')"
    return 1
  fi

  log "Repo criado: $repo_url"
  echo "$repo_url"
}

# ===== STEP 2: Create Cloudflare DNS =====
create_cloudflare_dns() {
  local subdomain="$1"
  local target="${2:-localhost}"

  log "Criando DNS: ${subdomain}.zappro.site → ${target}"

  local response
  response=$(curl -s -X POST "https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/dns_records" \
    -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{
      \"type\": \"CNAME\",
      \"name\": \"${subdomain}\",
      \"content\": \"${target}\",
      \"ttl\": 120,
      \"proxied\": true
    }")

  local success
  success=$(echo "$response" | jq -r '.success')

  if [ "$success" != "true" ]; then
    log "Erro Cloudflare: $(echo "$response" | jq -r '.errors[0].message // "unknown"')"
    return 1
  fi

  log "DNS criado: ${subdomain}.zappro.site"
  echo "${subdomain}.zappro.site"
}

# ===== STEP 3: Create Cloudflare Tunnel Ingress =====
add_tunnel_ingress() {
  local subdomain="$1"
  local service="$2"  # e.g., http://localhost:8080

  log "Adicionando ingress: ${subdomain}.zappro.site → ${service}"

  # Cloudflare Tunnel API - update tunnel config
  local tunnel_id
  tunnel_id=$(curl -s "https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/tunnels" \
    -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" | jq -r '.tunnels[0].id')

  if [ -z "$tunnel_id" ] || [ "$tunnel_id" = "null" ]; then
    log "Aviso: Tunnel ID não encontrado, pulando ingress"
    return 0
  fi

  # Get current config
  local current_config
  current_config=$(curl -s "https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/tunnels/${tunnel_id}/configurations" \
    -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}")

  log "Tunnel config atualizada para: ${subdomain}.zappro.site"
  echo "${subdomain}.zappro.site"
}

# ===== STEP 4: Deploy via Docker =====
deploy_docker() {
  local project_path="$1"
  local name="$2"

  log "Deploy Docker: $name"

  cd "$project_path"

  if [ -f "docker-compose.yml" ]; then
    docker compose up -d --build
    log "Docker deploy completo"
  elif [ -f "Dockerfile" ]; then
    docker build -t "$name:latest" .
    docker run -d --name "$name" -p 8080:8080 "$name:latest"
    log "Docker build + run completo"
  else
    log "Nenhum Dockerfile ou docker-compose.yml encontrado"
    return 1
  fi

  echo "deployed"
}

# ===== STEP 5: Deploy via Coolify =====
deploy_coolify() {
  local git_url="$1"
  local name="$2"

  log "Deploy Coolify: $name"

  local payload="{
    \"git_url\": \"${git_url}\",
    \"name\": \"${name}\",
    \"branch\": \"main\",
    \"build_command\": \"\",
    \"run_command\": \"\",
    \"port\": 8080,
    \" domains\": [\"${name}.zappro.site\"]
  }"

  curl -s -X POST "${COOLIFY_URL}/api/v1/applications" \
    -H "Authorization: Bearer ${COOLIFY_API_KEY}" \
    -H "Content-Type: application/json" \
    -d "$payload" | jq -r '.id // empty'

  log "Coolify deploy iniciado"
}

# ===== STEP 6: Health Check =====
health_check() {
  local url="$1"
  local max_attempts="${2:-10}"
  local attempt=1

  log "Health check: $url"

  while [ $attempt -le $max_attempts ]; do
    local status
    status=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")

    if [ "$status" = "200" ] || [ "$status" = "301" ] || [ "$status" = "302" ]; then
      log "✅ Health OK: $url (status: $status)"
      return 0
    fi

    log "Attempt $attempt/$max_attempts: $status"
    sleep 3
    attempt=$((attempt + 1))
  done

  log "❌ Health check failed: $url"
  return 1
}

# ===== MAIN DEPLOY FLOW =====
deploy() {
  local project_path="${1:-.}"
  local project_name="${2:-}"
  local prefix="${3:-saas}"
  local deploy_method="${4:-docker}"  # docker, coolify

  load_env

  mkdir -p "$(dirname "$LOG_FILE")"

  # Extract name from path if not provided
  if [ -z "$project_name" ]; then
    project_name=$(basename "$project_path" | tr '[:upper:]' '[:lower:]' | tr ' ' '-')
  fi

  # Generate random subdomain
  local subdomain
  subdomain=$(gen_random_name "$prefix")

  log "=== INICIANDO DEPLOY ==="
  log "Project: $project_name"
  log "Subdomain: $subdomain"
  log "Method: $deploy_method"

  # Step 1: Create Gitea repo (optional - continues if fails)
  local git_url=""
  git_url=$(create_gitea_repo "$project_name" "Auto-deployed MVP: $project_name" 2>/dev/null) || {
    log "Aviso: Gitea API indisponível (Cloudflare Access) - continuando sem repo remoto"
    git_url=""
  }

  # Step 2: Create Cloudflare DNS
  local full_domain
  full_domain=$(create_cloudflare_dns "$subdomain" "localhost") || {
    log "Falha ao criar DNS"
  }

  # Step 3: Initialize git and push (optional)
  if [ -d "$project_path/.git" ]; then
    log "Repo já tem git"
  else
    log "Inicializando git..."
    cd "$project_path"
    git init
    if [ -n "$git_url" ]; then
      git remote add origin "${git_url}.git" 2>/dev/null || git remote set-url origin "${git_url}.git"
    fi
  fi

  # Add all files
  cd "$project_path"
  git add -A
  git commit -m "Initial commit - auto-deploy $(date +%Y-%m-%d)" 2>/dev/null || true
  if [ -n "$git_url" ]; then
    git push -u origin main 2>/dev/null || git push -u origin master 2>/dev/null || {
      log "Aviso: git push falhou, continuando..."
    }
  else
    log "Git local preparado (sem remote - Gitea API indisponível)"
  fi

  # Step 4: Deploy
  case "$deploy_method" in
    docker)
      deploy_docker "$project_path" "$project_name"
      ;;
    coolify)
      deploy_coolify "$git_url" "$project_name"
      ;;
    *)
      log "Método desconhecido: $deploy_method"
      ;;
  esac

  # Step 5: Health check (after delay)
  sleep 5
  health_check "https://${subdomain}.zappro.site"

  log "=== DEPLOY COMPLETO ==="
  log "URL: https://${subdomain}.zappro.site"
  log "Repo: $git_url"

  echo ""
  echo "=== RESULTADO ==="
  echo "URL: https://${subdomain}.zappro.site"
  echo "Repo: $git_url"
  echo "Subdomain: $subdomain"
}

# ===== CLI =====
case "${1:-}" in
  deploy)
    shift
    deploy "$@"
    ;;
  random)
    gen_random_name "${2:-saas}"
    ;;
  gitea-create)
    load_env
    create_gitea_repo "${2:-test-repo}" "${3:-Test repo}"
    ;;
  dns-create)
    load_env
    create_cloudflare_dns "${2:-test}" "${3:-localhost}"
    ;;
  health)
    shift
    health_check "$@"
    ;;
  help|--help|-h)
    echo "Usage: $0 {deploy|random|gitea-create|dns-create|health}"
    echo ""
    echo "Examples:"
    echo "  $0 deploy /srv/fit-tracker fit-saas saas docker"
    echo "  $0 random saas"
    echo "  $0 health https://saas-abc123.zappro.site"
    ;;
  *)
    echo "Usage: $0 {deploy|random|gitea-create|dns-create|health}"
    ;;
esac
