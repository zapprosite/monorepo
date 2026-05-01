#!/bin/bash
# Hook: check-spec-exists.sh
# PreToolUse: Write|Edit
# Warns when editing Go files without an existing spec

FILES="$CLAUDE_TOOL_INPUTS"
EXTENSION="${FILES##*.}"

if [[ "$EXTENSION" != "go" ]]; then
    exit 0
fi

# Check if a spec file exists for this module
SPECTAG=$(echo "$FILES" | sed 's|\(internal\|cmd\)/||' | cut -d'/' -f1-2)
SPECFILE=$(find . -name "SPEC-*.md" -path "*/specflow/*" 2>/dev/null | head -1)

if [[ -z "$SPECFILE" ]]; then
    echo "⚠️  Warning: Editing Go file without spec found. Run /write-api-spec or /write-design-doc first."
fi
