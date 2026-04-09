#!/bin/bash
# db-seed.sh - Executa seeds do banco de dados
# Usage: ./db-seed.sh [--dry-run]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_PREFIX="[db-seed]"

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

    if [ ! -d "$SCRIPT_DIR/../packages/db" ]; then
        log_error "packages/db nao encontrado"
        exit 1
    fi

    if [ ! -f "$SCRIPT_DIR/../packages/db/seeds" ]; then
        log_error "Diretorio de seeds nao encontrado em packages/db/seeds"
        exit 1
    fi

    log_info "Dependencias OK"
}

# Check environment
check_env() {
    log_info "Verificando environment..."

    if [ -z "${DATABASE_URL:-}" ]; then
        log_error "DATABASE_URL nao definida"
        exit 1
    fi

    log_info "Environment OK (DATABASE_URL configurada)"
}

# Run seeds
run_seeds() {
    local dry_run=false

    if [ "${1:-}" == "--dry-run" ]; then
        dry_run=true
        log_info "Modo dry-run ativo"
    fi

    log_info "Executando seeds..."

    cd "$SCRIPT_DIR/../packages/db"

    if [ "$dry_run" == true ]; then
        log_info "[dry-run].bun run seeds/index.ts"
    else
        bun run seeds/index.ts
    fi

    log_info "Seeds executados com sucesso"
}

# Main
main() {
    log_info "Iniciando db-seed.sh"

    check_dependencies
    check_env
    run_seeds "$@"

    exit 0
}

main "$@"
