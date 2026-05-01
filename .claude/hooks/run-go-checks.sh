#!/bin/bash
# Hook: run-go-checks.sh
# PostToolUse: Write|Edit
# Runs go vet and go build after editing Go files

FILES="$CLAUDE_TOOL_INPUTS"
GO_FILES=$(echo "$FILES" | tr ' ' '\n' | grep '\.go$' | tr '\n' ' ')

if [[ -z "$GO_FILES" ]]; then
    exit 0
fi

echo "Running Go checks..."

for file in $GO_FILES; do
    PACKAGE=$(dirname "$file")
    if go vet "$PACKAGE" 2>&1; then
        echo "✅ go vet passed: $file"
    else
        echo "❌ go vet failed: $file"
    fi
done
