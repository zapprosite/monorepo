#!/usr/bin/env bash
# deploy-hermes-agency.sh — Build, push, deploy, and health-check Hermes Agency
#
# Usage:
#   ./deploy-hermes-agency.sh                  # Production
#   ./deploy-hermes-agency.sh staging          # Staging
#   ./deploy-hermes-agency.sh --dry-run         # Preview without deploying
#
# Required secrets (set in environment or CI):
#   COOLIFY_URL          e.g. https://coolify.zappro.site
#   COOLIFY_API_KEY      Coolify API key
#   REGISTRY_URL         e.g. ghcr.io
#   REGISTRY_USERNAME    e.g. willzappro
#   REGISTRY_PASSWORD    GitHub/Gitea token with repo access

set -euo pipefail

# ─── Defaults ────────────────────────────────────────────────────────────────
TARGET="${1:-production}"
DRY_RUN="${DRY_RUN:-false}"
APP_NAME="hermes-agency"
REGISTRY="${REGISTRY_URL:-ghcr.io}"
REGISTRY_USER="${REGISTRY_USERNAME:-willzappro}"
IMAGE="${REGISTRY}/${REGISTRY_USER}/${APP_NAME}"
TAG="$(git rev-parse --short HEAD 2>/dev/null || echo "latest")"
FULL_IMAGE="${IMAGE}:${TAG}"

HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-180}"
HEALTH_INTERVAL="${HEALTH_INTERVAL:-10}"
COOLIFY_URL="${COOLIFY_URL:-}"
COOLIFY_API_KEY="${COOLIFY_API_KEY:-}"

# ─── Colour output ───────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log() { echo -e "${CYAN}[deploy]${NC} $*"; }
info() { echo -e "${GREEN}[INFO]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
err() { echo -e "${RED}[ERROR]${NC} $*" >&2; }

# ─── Dry-run guard ───────────────────────────────────────────────────────────
if [[ "${DRY_RUN}" == "true" || "${1:-}" == "--dry-run" ]]; then
  warn "DRY-RUN mode — no changes will be made"
  TARGET="--dry-run"
fi

# ─── Helpers ─────────────────────────────────────────────────────────────────
require() {
  if [[ -z "${!1:-}" ]]; then
    err "Missing required environment variable: $1"
    exit 1
  fi
}

coolify_api() {
  local method="${1}"
  local path="${2}"
  local body="${3:-}"

  require "COOLIFY_URL"
  require "COOLIFY_API_KEY"

  local curl_args=(-s -w "\n%{http_code}" -X "${method}" \
    "${COOLIFY_URL}/api/v1${path}" \
    -H "Authorization: Bearer ${COOLIFY_API_KEY}" \
    -H "Content-Type: application/json")

  if [[ -n "${body}" ]]; then
    curl_args+=(-d "${body}")
  fi

  local response
  response="$(curl "${curl_args[@]}")"
  local http_code
  http_code="$(echo "${response}" | tail -n1)"
  local body
  body="$(echo "${response}" | sed '$d')"

  echo "${body}"
  echo "${http_code}"
}

# ─── Steps ──────────────────────────────────────────────────────────────────
step_config() {
  log "Target: ${TARGET}"
  log "Image:  ${FULL_IMAGE}"
  if [[ "${TARGET}" == "--dry-run" ]]; then
    warn "Dry-run — exiting before any side effects"
    exit 0
  fi
}

step_build() {
  log "Building Docker image..."
  local dockerfile="${DOCKERFILE:-Dockerfile}"
  local context="${DOCKER_CONTEXT:-/srv/monorepo/apps/hermes-agency}"

  if [[ ! -f "${context}/${dockerfile}" ]]; then
    err "Dockerfile not found at ${context}/${dockerfile}"
    exit 1
  fi

  info "Building: ${FULL_IMAGE}"
  info "Context: ${context}"
  info "Dockerfile: ${dockerfile}"

  docker build \
    --tag "${FULL_IMAGE}" \
    --file "${context}/${dockerfile}" \
    "${context}"

  info "Build complete: ${FULL_IMAGE}"
}

step_push() {
  log "Pushing image to registry..."

  require "REGISTRY_PASSWORD"

  # Log in to registry
  if [[ "${REGISTRY}" == "ghcr.io" ]]; then
    echo "${REGISTRY_PASSWORD}" | docker login ghcr.io -u "${REGISTRY_USER}" --password-stdin
  fi

  docker push "${FULL_IMAGE}"

  # Also tag as :latest for convenience
  docker tag "${FULL_IMAGE}" "${IMAGE}:latest"
  docker push "${IMAGE}:latest"

  info "Push complete"
}

step_find_app() {
  log "Finding Coolify application UUID..."

  local body
  body="$(coolify_api GET "/applications" | sed '$d')"

  local app_uuid
  app_uuid="$(echo "${body}" | python3 -c "
import sys, json
data = json.load(sys.stdin)
apps = data.get('data', [])
for a in apps:
    name = a.get('name', '')
    uuid = a.get('uuid', '')
    if '${APP_NAME}' in name:
        print(uuid)
        break
" 2>/dev/null || true)"

  if [[ -z "${app_uuid}" ]]; then
    err "Could not find Coolify app named '${APP_NAME}'"
    info "Available applications:"
    echo "${body}" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for a in data.get('data', []):
    print(f\"  - {a.get('name','')} ({a.get('uuid','')})\")
" 2>/dev/null || echo "${body}"
    exit 1
  fi

  info "Found app UUID: ${app_uuid}"
  echo "${app_uuid}"
}

step_deploy() {
  local app_uuid="${1}"

  log "Triggering Coolify deploy..."

  local env_name="${TARGET}"
  local body
  body="$(coolify_api POST "/applications/${app_uuid}/deploy" \
    "{\"pull_request_id\": \"${env_name}\", \"environment_name\": \"${env_name}\"}" \
    | sed '$d')"

  local http_code
  http_code="$(coolify_api POST "/applications/${app_uuid}/deploy" \
    "{\"pull_request_id\": \"${env_name}\", \"environment_name\": \"${env_name}\"}" \
    | tail -n1)"

  if [[ "${http_code}" != "200" && "${http_code}" != "201" ]]; then
    err "Deploy trigger failed (HTTP ${http_code}): ${body}"
    exit 1
  fi

  info "Deploy triggered successfully"
}

step_wait_health() {
  local app_uuid="${1}"
  local elapsed=0

  log "Waiting for deployment to become healthy (timeout: ${HEALTH_TIMEOUT}s)..."

  while [[ ${elapsed} -lt ${HEALTH_TIMEOUT} ]]; do
    local status
    status="$(coolify_api GET "/applications/${app_uuid}" | \
      python3 -c "import sys,json; print(json.load(sys.stdin).get('status',''))" \
      2>/dev/null || echo "unknown")"

    echo -e "[${elapsed}s] Status: ${status}"

    case "${status}" in
      running|idle)
        info "Deployment is healthy!"
        return 0
        ;;
      degraded|stopped)
        err "App is ${status} — deployment may have failed"
        return 1
        ;;
    esac

    sleep "${HEALTH_INTERVAL}"
    elapsed=$((elapsed + HEALTH_INTERVAL))
  done

  err "Health check timeout after ${HEALTH_TIMEOUT}s"
  return 1
}

step_smoke_test() {
  log "Running smoke test..."

  local health_url="${HEALTH_URL:-http://localhost:3001/health}"
  local elapsed=0

  while [[ ${elapsed} -lt ${HEALTH_TIMEOUT} ]]; do
    local http_code
    http_code="$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
      "${health_url}" 2>/dev/null || echo "000")"

    if [[ "${http_code}" == "200" ]]; then
      info "Smoke test PASSED (HTTP 200 after ${elapsed}s)"
      return 0
    fi

    echo -e "[${elapsed}s] Smoke test: HTTP ${http_code}"
    sleep "${HEALTH_INTERVAL}"
    elapsed=$((elapsed + HEALTH_INTERVAL))
  done

  err "Smoke test FAILED — app did not respond with 200"
  return 1
}

step_summary() {
  local status="${1:-unknown}"
  local app_uuid="${2:-}"

  echo ""
  echo "══════════════════════════════════════"
  echo -e "  ${CYAN}Deployment Summary${NC}"
  echo "══════════════════════════════════════"
  echo -e "  Image:     ${FULL_IMAGE}"
  echo -e "  Target:    ${TARGET}"
  echo -e "  Status:    ${status}"
  echo -e "  App UUID:  ${app_uuid}"
  echo "══════════════════════════════════════"
  echo ""

  if [[ "${status}" == "SUCCESS" ]]; then
    info "Deployment completed successfully!"
  else
    err "Deployment failed — check logs above"
    exit 1
  fi
}

step_rollback() {
  local app_uuid="${1}"
  warn "Deployment failed — initiating rollback..."

  local deployments
  deployments="$(coolify_api GET "/applications/${app_uuid}/deployments" | sed '$d')"

  local prev_commit
  prev_commit="$(echo "${deployments}" | python3 -c "
import sys, json
data = json.load(sys.stdin)
deploys = data.get('data', [])
if len(deploys) > 1:
    print(deploys[1].get('commit','')[:8])
" 2>/dev/null || echo "")"

  if [[ -n "${prev_commit}" ]]; then
    info "Rolling back to previous commit: ${prev_commit}"
    coolify_api POST "/applications/${app_uuid}/deploy" \
      "{\"commit\": \"${prev_commit}\"}" \
      | sed '$d'
    info "Rollback triggered"
  else
    err "No previous deployment found — manual intervention required"
    exit 1
  fi
}

# ─── Main ───────────────────────────────────────────────────────────────────
main() {
  step_config

  if [[ "${TARGET}" != "--dry-run" ]]; then
    require "COOLIFY_URL"
    require "COOLIFY_API_KEY"

    # Build and push
    step_build
    step_push

    # Deploy
    local app_uuid
    app_uuid="$(step_find_app)"

    if step_deploy "${app_uuid}"; then
      if step_wait_health "${app_uuid}"; then
        step_smoke_test && step_summary "SUCCESS" "${app_uuid}" || {
          step_rollback "${app_uuid}"
          step_summary "FAILED (rolled back)" "${app_uuid}"
        }
      else
        step_rollback "${app_uuid}"
        step_summary "FAILED (health timeout, rolled back)" "${app_uuid}"
      fi
    else
      step_summary "FAILED (deploy trigger)" "${app_uuid}"
    fi
  fi
}

main "$@"
