#!/bin/bash
# build.sh — Build list-web with Infisical secrets injection
#
# Usage:
#   INFISICAL_TOKEN=st.xxx ./build.sh
#
# Prerequisites:
#   - jq installed
#   - INFISICAL_TOKEN environment variable or .env file
#
# What it does:
#   1. Fetches GOOGLE_CLIENT_ID from Infisical vault
#   2. Replaces {{GOOGLE_CLIENT_ID}} placeholder in index.html
#   3. Outputs to dist/ directory

set -euo pipefail

# Configuration
INFISICAL_BASE_URL="${INFISICAL_BASE_URL:-https://infisical.zappro.site/api/v1}"
SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DIST_DIR="${SOURCE_DIR}/dist"
SECRETS=("GOOGLE_CLIENT_ID")

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check prerequisites
check_prereqs() {
  if ! command -v jq &> /dev/null; then
    log_error "jq is required but not installed. Install with: brew install jq (macOS) or apt install jq (Linux)"
    exit 1
  fi

  if [[ -z "${INFISICAL_TOKEN:-}" ]]; then
    if [[ -f "${SOURCE_DIR}/.env" ]]; then
      log_info "Loading INFISICAL_TOKEN from .env file"
      source "${SOURCE_DIR}/.env"
    else
      log_error "INFISICAL_TOKEN environment variable not set and no .env file found"
      log_error "Set it with: export INFISICAL_TOKEN=st.your-token"
      exit 1
    fi
  fi

  if [[ -z "${INFISICAL_TOKEN}" ]]; then
    log_error "INFISICAL_TOKEN is empty"
    exit 1
  fi
}

# Fetch a single secret from Infisical
# Usage: fetch_secret "SECRET_NAME"
fetch_secret() {
  local secret_name="$1"
  local response
  local secret_value

  response=$(curl -s -X GET \
    "${INFISICAL_BASE_URL}/secrets/${secret_name}" \
    -H "Authorization: Bearer ${INFISICAL_TOKEN}" \
    -H "Content-Type: application/json" \
    -w "\n%{http_code}")

  local http_code
  http_code=$(echo "$response" | tail -n1)
  local body
  body=$(echo "$response" | sed '$d')

  if [[ "$http_code" != "200" ]]; then
    log_error "Failed to fetch ${secret_name}: HTTP ${http_code}"
    log_error "Response: $body"
    return 1
  fi

  secret_value=$(echo "$body" | jq -r '.secret.secretValue // empty')

  if [[ -z "$secret_value" ]]; then
    log_error "Secret ${secret_name} not found or has no value"
    return 1
  fi

  echo "$secret_value"
}

# Build the project
build() {
  log_info "Building list-web with Infisical secrets..."

  # Create dist directory
  mkdir -p "${DIST_DIR}"

  # Fetch secrets
  declare -A secret_values
  for secret in "${SECRETS[@]}"; do
    log_info "Fetching ${secret} from Infisical..."
    secret_values[$secret]=$(fetch_secret "$secret")
    log_info "${secret} fetched successfully"
  done

  # Copy and replace secrets in HTML
  if [[ -f "${SOURCE_DIR}/index.html" ]]; then
    local html_content
    html_content=$(cat "${SOURCE_DIR}/index.html")

    for secret in "${SECRETS[@]}"; do
      html_content="${html_content//\{\{${secret}\}\}/${secret_values[$secret]}}"
    done

    echo "$html_content" > "${DIST_DIR}/index.html"
    log_info "Built index.html with secrets injected"
  else
    log_error "index.html not found in ${SOURCE_DIR}"
    exit 1
  fi

  # Copy static assets
  if [[ -d "${SOURCE_DIR}/assets" ]]; then
    cp -r "${SOURCE_DIR}/assets" "${DIST_DIR}/"
    log_info "Copied assets to dist/"
  fi

  log_info "Build complete! Output in ${DIST_DIR}/"
  log_info "Secrets injected:"
  for secret in "${SECRETS[@]}"; do
    local masked
    masked="${secret_values[$secret]:0:8}..."
    log_info "  ${secret}: ${masked}"
  done
}

# Main
main() {
  check_prereqs
  build
}

main "$@"
