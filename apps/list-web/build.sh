#!/bin/bash
# build.sh — Build list-web with secrets from .env
#
# Usage:
#   ./build.sh
#
# Prerequisites:
#   - .env file in the project root with GOOGLE_CLIENT_ID
#   - jq installed
#
# What it does:
#   1. Loads GOOGLE_CLIENT_ID from .env
#   2. Replaces {{GOOGLE_CLIENT_ID}} placeholder in index.html
#   3. Outputs to dist/ directory

set -euo pipefail

# Configuration
SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SOURCE_DIR}/../.env"
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

  if [[ ! -f "${ENV_FILE}" ]]; then
    log_error ".env file not found at ${ENV_FILE}"
    exit 1
  fi

  log_info "Loading secrets from .env"
}

# Load a single secret from .env
# Usage: load_secret "SECRET_NAME"
load_secret() {
  local secret_name="$1"
  local secret_value

  secret_value=$(grep "^${secret_name}=" "${ENV_FILE}" | cut -d'=' -f2- | tr -d '"')

  if [[ -z "$secret_value" ]]; then
    log_error "Secret ${secret_name} not found in .env"
    return 1
  fi

  echo "$secret_value"
}

# Build the project
build() {
  log_info "Building list-web..."

  # Create dist directory
  mkdir -p "${DIST_DIR}"

  # Load secrets
  declare -A secret_values
  for secret in "${SECRETS[@]}"; do
    log_info "Loading ${secret} from .env..."
    secret_values[$secret]=$(load_secret "$secret")
    log_info "${secret} loaded successfully"
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
