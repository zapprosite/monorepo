#!/bin/bash
# sync-second-brain.sh — Generates TREE.md and pushes to hermes-second-brain
# Called by Gitea Actions on push to main (after PR merge)
# Also callable manually from pre-push hooks

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SECOND_BRAIN_DIR="/tmp/hermes-second-brain-sync"
SECOND_BRAIN_REMOTE="ssh://git@127.0.0.1:2222/will-zappro/hermes-second-brain.git"

# Paths to exclude from tree
EXCLUDE_PATTERNS=(
    ".git"
    ".gitignore"
    "node_modules"
    ".turbo"
    ".vercel"
    ".env"
    ".env.*"
    "*.lock"
    "pnpm-lock.yaml"
    "package-lock.json"
    "yarn.lock"
    "dist"
    "build"
    ".next"
    ".output"
    "__pycache__"
    ".pytest_cache"
    ".venv"
    "venv"
    ".claude/cache"
    ".claude/tmp"
)

# ─── Generate TREE.md ─────────────────────────────────────────────────────────
generate_tree() {
    local source_dir="$1"
    local output_file="$2"
    local repo_name="$3"

    echo "# $repo_name — TREE" > "$output_file"
    echo "" >> "$output_file"
    echo "Generated: $(date -u '+%Y-%m-%dT%H:%M:%SZ')" >> "$output_file"
    echo "" >> "$output_file"
    echo "## Structure" >> "$output_file"
    echo "" >> "$output_file"

    # Build find command with exclusions
    local find_args=()
    for pattern in "${EXCLUDE_PATTERNS[@]}"; do
        find_args+=("-not" "-path" "*/$pattern/*")
    done

    # Generate tree using find + sed for visual hierarchy
    (cd "$source_dir" && find . -type f "${find_args[@]}" -not -name 'TREE.md' | \
        sed 's|^\./||' | \
        sort | \
        while read -r line; do
            # Calculate depth
            depth=$(echo "$line" | tr -cd '/' | wc -c)
            prefix=""
            for ((i=0; i<depth; i++)); do
                prefix+="  "
            done
            echo "${prefix}- \`$line\`"
        done >> "$output_file"
    )

    # Add summary
    local file_count
    file_count=$(cd "$source_dir" && find . -type f "${find_args[@]}" -not -name 'TREE.md' | wc -l)
    echo "" >> "$output_file"
    echo "---" >> "$output_file"
    echo "*$file_count files tracked*" >> "$output_file"
}

# ─── Main ─────────────────────────────────────────────────────────────────────
main() {
    echo "=== Sync Second Brain ==="
    echo "Repo: $REPO_ROOT"

    # Clone or update second-brain
    if [[ -d "$SECOND_BRAIN_DIR/.git" ]]; then
        echo "Updating existing clone..."
        (cd "$SECOND_BRAIN_DIR" && git pull --ff origin main)
    else
        echo "Cloning second-brain..."
        rm -rf "$SECOND_BRAIN_DIR"
        git clone --depth 1 "$SECOND_BRAIN_REMOTE" "$SECOND_BRAIN_DIR"
    fi

    # Generate TREE.md for monorepo
    echo "Generating TREE.md..."
    generate_tree "$REPO_ROOT" "$SECOND_BRAIN_DIR/monorepo-TREE.md" "Monorepo"

    # If monorepo-TREE.md already exists with same content, skip push
    if git -C "$SECOND_BRAIN_DIR" diff --quiet monorepo-TREE.md 2>/dev/null; then
        echo "No changes to TREE.md — skipping push."
        exit 0
    fi

    # Commit and push
    echo "Committing and pushing..."
    (cd "$SECOND_BRAIN_DIR" && \
        git config user.email "hermes@zappro.ia" && \
        git config user.name "Hermes Agent" && \
        git add monorepo-TREE.md && \
        git commit -m "chore: update monorepo TREE [skip ci]" && \
        git push origin main)

    echo "=== Done ==="
}

main "$@"
