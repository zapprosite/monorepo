#!/bin/bash
# validate-env.sh - Valida environment variables com Zod
# Usage: ./validate-env.sh [--schema <path>]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_PREFIX="[validate-env]"

# Logging functions
log_info() {
    echo "$LOG_PREFIX INFO: $1" >&2
}

log_error() {
    echo "$LOG_PREFIX ERROR: $1" >&2
}

log_success() {
    echo "$LOG_PREFIX SUCCESS: $1" >&2
}

# Error handler
error_handler() {
    local exit_code=$?
    log_error "Falha na linha $1 com exit code $exit_code"
    exit 1
}

trap 'error_handler $LINENO' ERR

# Default schema path
DEFAULT_SCHEMA="$SCRIPT_DIR/../packages/env/schema.ts"
SCHEMA_PATH="${DEFAULT_SCHEMA}"

# Parse arguments
parse_args() {
    while [ $# -gt 0 ]; do
        case "$1" in
            --schema)
                SCHEMA_PATH="$2"
                shift 2
                ;;
            --help)
                echo "Usage: $0 [--schema <path>]"
                echo "  --schema <path>  Path para schema Zod (default: packages/env/schema.ts)"
                exit 0
                ;;
            *)
                shift
                ;;
        esac
    done
}

# Check dependencies
check_dependencies() {
    log_info "Verificando dependencias..."

    if ! command -v bun &> /dev/null; then
        log_error "bun nao encontrado"
        exit 1
    fi

    if [ ! -f "$SCHEMA_PATH" ]; then
        log_error "Schema nao encontrado: $SCHEMA_PATH"
        exit 1
    fi

    log_info "Dependencias OK"
}

# Check required env vars exist (before Zod validation)
check_required_env_files() {
    log_info "Verificando arquivos de env..."

    local env_example="$SCRIPT_DIR/../.env.example"
    local env_local="$SCRIPT_DIR/../.env"

    if [ ! -f "$env_example" ]; then
        log_error ".env.example nao encontrado"
        exit 1
    fi

    if [ ! -f "$env_local" ]; then
        log_error ".env nao encontrado. Copie .env.example para .env e preencha os valores"
        exit 1
    fi

    log_info "Arquivos de env OK"
}

# Run Zod validation
run_validation() {
    log_info "Executando validacao Zod..."

    cd "$SCRIPT_DIR/../packages/env"

    # Source .env for validation
    set -a
    source "$SCRIPT_DIR/../.env"
    set +a

    # Run validation script
    if bun run validate.ts; then
        log_success "Environment valido"
        return 0
    else
        log_error "Environment invalido"
        return 1
    fi
}

# Main
main() {
    parse_args "$@"

    log_info "Iniciando validate-env.sh"

    check_dependencies
    check_required_env_files

    if run_validation; then
        exit 0
    else
        exit 1
    fi
}

main "$@"
