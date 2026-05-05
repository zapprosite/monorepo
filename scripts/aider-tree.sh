#!/usr/bin/env bash
#
# aider-tree.sh — Gera árvore tree-like de arquivos modificados no estilo Aider
# Uso obrigatório antes de TODO commit (ver AGENTS.md § Regras Absolutas)
#
# Exemplo:
#   bash scripts/aider-tree.sh >> COMMIT_MSG.txt
#   git commit -m "feat: ..." -m "$(cat COMMIT_MSG.txt)"
#

set -euo pipefail

# Verifica se estamos num repo git
if ! git rev-parse --git-dir >/dev/null 2>&1; then
    echo "Erro: não é um repositório git." >&2
    exit 1
fi

# Coleta arquivos staged
added=$(git diff --cached --name-only --diff-filter=A 2>/dev/null || true)
modified=$(git diff --cached --name-only --diff-filter=M 2>/dev/null || true)
deleted=$(git diff --cached --name-only --diff-filter=D 2>/dev/null || true)
renamed=$(git diff --cached --name-only --diff-filter=R 2>/dev/null || true)

# Se nada staged, tenta working tree (para uso manual)
if [ -z "$added" ] && [ -z "$modified" ] && [ -z "$deleted" ] && [ -z "$renamed" ]; then
    added=$(git ls-files --others --exclude-standard 2>/dev/null || true)
    modified=$(git diff --name-only 2>/dev/null || true)
    deleted=$(git ls-files --deleted 2>/dev/null || true)
fi

# Se ainda vazio
if [ -z "$added" ] && [ -z "$modified" ] && [ -z "$deleted" ] && [ -z "$renamed" ]; then
    echo "Nenhuma alteração detectada."
    exit 0
fi

# Header
echo ""
echo "## 📁 Arquivos Alterados"
echo ""
echo "\`\`\`"

# Função para contar linhas
line_stats() {
    local f="$1"
    local stats
    stats=$(git diff --cached --numstat -- "$f" 2>/dev/null | awk '{print "+"$1" -"$2}')
    if [ -n "$stats" ] && [ "$stats" != "+ -" ]; then
        echo " ($stats)"
    fi
}

# Printa lista com prefixo e status
print_files() {
    local status="$1"
    shift
    local files=("$@")
    for f in "${files[@]}"; do
        [ -z "$f" ] && continue
        local dir
        dir=$(dirname "$f")
        local base
        base=$(basename "$f")
        local stats=""
        stats=$(line_stats "$f")

        if [ "$dir" = "." ]; then
            echo "[$status] $base$stats"
        else
            echo "[$status] $dir/"
            echo "    └── $base$stats"
        fi
    done
}

# Converte strings em arrays
IFS=$'\n' read -r -d '' -a added_arr <<< "$added" || true
IFS=$'\n' read -r -d '' -a modified_arr <<< "$modified" || true
IFS=$'\n' read -r -d '' -a deleted_arr <<< "$deleted" || true
IFS=$'\n' read -r -d '' -a renamed_arr <<< "$renamed" || true

if [ ${#added_arr[@]} -gt 0 ] && [ -n "${added_arr[0]}" ]; then
    echo "N) Novos:"
    print_files "N" "${added_arr[@]}"
    echo ""
fi

if [ ${#modified_arr[@]} -gt 0 ] && [ -n "${modified_arr[0]}" ]; then
    echo "M) Modificados:"
    print_files "M" "${modified_arr[@]}"
    echo ""
fi

if [ ${#deleted_arr[@]} -gt 0 ] && [ -n "${deleted_arr[0]}" ]; then
    echo "D) Deletados:"
    print_files "D" "${deleted_arr[@]}"
    echo ""
fi

if [ ${#renamed_arr[@]} -gt 0 ] && [ -n "${renamed_arr[0]}" ]; then
    echo "R) Renomeados:"
    print_files "R" "${renamed_arr[@]}"
    echo ""
fi

echo "\`\`\`"
echo ""
echo "---"
echo "*Gerado por scripts/aider-tree.sh*"
