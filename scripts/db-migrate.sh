#!/bin/bash
# db-migrate.sh - Executa migrations do banco de dados
# Usage: ./db-migrate.sh [up|down|status]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_PREFIX="[db-migrate]"

# Logging functions
log_info() {
    echo "$LOG_PREFIX INFO: $1" >&2
}

log_error() {
    echo "$LOG_PREFIX ERROR: $1" >&2
}

# Error handler
error_handler() {
    local exit_code=$?
    log_error "Falha na linha $1 com exit code $exit_code"
    exit 1
}

trap 'error_handler $LINENO' ERR

# Check dependencies
check_dependencies() {
    log_info "Verificando dependencias..."

    if ! command -v drizzle-kit &> /dev/null; then
        log_error "drizzle-kit nao encontrado. Instale com: bun add drizzle-kit"
        exit 1
    fi

    if [ ! -f "$SCRIPT_DIR/../packages/db/drizzle.config.ts" ]; then
        log_error "drizzle.config.ts nao encontrado em packages/db/"
        exit 1
    fi

    log_info "Dependencias OK"
}

# Run migrations
run_migrations() {
    local direction="${1:-up}"
    log_info "Executando migrations ($direction)..."

    cd "$SCRIPT_DIR/../packages/db"

    case "$direction" in
        up)
            drizzle-kit push:dev
            ;;
        down)
            drizzle-kit pull:dev
            ;;
        status)
            drizzle-kit status
            ;;
        *)
            log_error "Direcao invalida: $direction. Use: up, down, status"
            exit 1
            ;;
    esac

    log_info "Migrations $direction concluidas com sucesso"
}

# Main
main() {
    local direction="${1:-up}"

    log_info "Iniciando db-migrate.sh"
    check_dependencies
    run_migrations "$direction"

    exit 0
}

main "$@"
