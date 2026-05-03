#!/bin/bash
# =============================================================================
# nexus-aider-exec.sh — Core Executor: Claude CLI subprocess loop
# =============================================================================
# Ciclo riguroso: repo-map → context-bundle → claude-cli → test → commit → exit
#
# USAGE:
#   nexus-aider-exec.sh <pipeline.json>     # Processa uma task do pipeline
#   nexus-aider-exec.sh <pipeline.json> 2   # Processa task especifica pelo index
#
# PIPELINE.JSON FORMAT (minimal):
# {
#   "task": {
#     "id": "T01",
#     "description": "...",
#     "files": ["src/foo.ts"],
#     "test_cmd": "pnpm test",
#     "commit_msg": "feat: foo"
#   }
# }
# =============================================================================

set -euo pipefail

MONOREPO="${MONOREPO:-/srv/monorepo}"
HERMES_DIR="${HERMES_DIR:-/srv/hermes-second-brain}"
VENV_PY="${HERMES_DIR}/venv/bin/python3"
REPO_MAP_SCRIPT="${HERMES_DIR}/libs/nexus_repo_map.py"
CONTEXT_WRAP="${MONOREPO}/scripts/nexus-context-wrap.sh"
CLAUDE="claude"
TMP_DIR="/tmp/nexus-aider"
LOG_DIR="${MONOREPO}/logs"

mkdir -p "$TMP_DIR" "$LOG_DIR"

GREEN='\033[0;32m'; RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'
[ -t 1 ] || { GREEN=; RED=; CYAN=; NC=; }

log()  { echo -e "${GREEN}[aider-exec]${NC} $(date '+%H:%M:%S') $*" | tee -a "$LOG_DIR/nexus-aider.log"; }
fail() { echo -e "${RED}[aider-exec]${NC} $(date '+%H:%M:%S') FAIL: $*" | tee -a "$LOG_DIR/nexus-aider.log" >&2; exit 1; }

# ─── Phase 1: Generate Repo Map ────────────────────────────────────────────
generate_repo_map() {
    local task_id="$1"
    local scope="$2"
    local map_file="$TMP_DIR/repo-map-${task_id}.json"

    log "Generating repo map for scope: ${scope:-root}"
    "$VENV_PY" "$REPO_MAP_SCRIPT" "$MONOREPO" ${scope:+--scope "$scope"} > "$map_file" 2>/dev/null || {
        fail "repo-map generation failed"
    }

    local symbols
    symbols=$(jq '.total_symbols' "$map_file" 2>/dev/null || echo 0)
    log "Repo map: $symbols symbols across $(jq '.files_indexed' "$map_file") files"
    echo "$map_file"
}

# ─── Phase 2: Generate Context Bundle (Nexus prevec) ───────────────────────
generate_context_bundle() {
    local task_id="$1"
    local task_desc="$2"
    local files="$3"
    local map_file="$4"
    local bundle_file="$TMP_DIR/context-${task_id}.json"

    local file_list
    file_list=$(echo "$files" | jq -r '.[]' 2>/dev/null || echo "")

    jq -n \
        --arg desc "$task_desc" \
        --argjson files "$(echo "$files" | jq -c)" \
        --argjson repo_map "$(jq '.files | map({path, symbols, imports, exports, lines})' "$map_file" 2>/dev/null || echo [])" \
        '{
            task: $desc,
            target_files: $files,
            repo_structure: $repo_map,
            workspace: env.MONOREPO
        }' > "$bundle_file"

    log "Context bundle: $(wc -c < "$bundle_file") bytes"
    echo "$bundle_file"
}

# ─── Phase 3: System Prompt Injection ──────────────────────────────────────
build_system_prompt() {
    local task_id="$1"
    local task_desc="$2"
    local files="$3"
    local test_cmd="$4"
    local commit_msg="$5"
    local bundle_file="$6"
    local prompt_file="$TMP_DIR/system-prompt-${task_id}.md"

    local files_str
    files_str=$(echo "$files" | jq -r '.[]' 2>/dev/null | tr '\n' ' ')

    cat > "$prompt_file" << 'PROMPT_EOF'
# SYSTEM PROMPT — Nexus Aider Executor

You are an autonomous code executor. Your job: implement ONE task, then exit.

## RULES (immutable)
1. READ the context bundle at CONTEXT_BUNDLE_PATH — it contains the repo map and task details
2. EDIT ONLY files listed in TARGET_FILES (below). NEVER modify other files.
3. DO NOT use `find`, `ls`, or file discovery tools. The repo map is in the context bundle.
4. Write minimal, correct code. NO comments unless the user asked for them.
5. After editing: run TEST_CMD. If tests fail, fix and re-run (max 3 attempts).
6. If tests pass: run `git add TARGET_FILES && git commit -m "COMMIT_MSG"`
7. Output [DONE] task=TASK_ID status=ok and exit immediately.
8. If you cannot complete after 3 retries: output [DONE] task=TASK_ID status=failed reason=...

## TASK
PROMPT_EOF

cat >> "$prompt_file" << EOF
TASK_ID: ${task_id}
TARGET_FILES: ${files_str}
TEST_CMD: ${test_cmd}
COMMIT_MSG: ${commit_msg}
CONTEXT_BUNDLE_PATH: ${bundle_file}
DESCRIPTION: ${task_desc}

Now execute the task. Do NOT ask questions. Just execute and exit.
EOF

    echo "$prompt_file"
}

# ─── Phase 4: Execute Claude CLI (RARV Cycle) ─────────────────────────────
# RARV = Reason → Act → Reflect → Verify (inspired by loki-mode)
# Reason:  Claude reads context bundle, plans edits
# Act:     Claude edits files
# Reflect: Claude runs tests, analyzes results
# Verify:  Tests pass → commit; Fail → retry (max iterations)
execute_claude() {
    local task_id="$1"
    local system_prompt="$2"
    local context_bundle="$3"
    local max_iter="$4"
    local agent="${5:-implementer}"
    local exit_code=0

    log "Launching Claude CLI for task: $task_id (agent: $agent)"

    # Build the prompt — include task description inline for lean context
    local task_desc
    task_desc=$(jq -r '.task' "$context_bundle" 2>/dev/null || echo "execute task $task_id")

    local start_time
    start_time=$(date +%s)

    # Execute Claude CLI with system prompt and context bundle
    # --print: non-interactive mode, prints response to stdout
    # --output-format json: structured output
    # --max-turns: strict iteration limit
    # --bare: skip hooks, CLAUDE.md auto-discovery for clean context
    local sys_prompt_content
    sys_prompt_content=$(cat "$system_prompt")

    # Use higher max-turns than pipeline limit (overhead: read ctx + read files + edit + test + commit)
    local exec_turns=$((max_iter * 3))
    [ "$exec_turns" -lt 10 ] && exec_turns=10

    "$CLAUDE" \
        -p \
        --output-format text \
        --max-turns "$exec_turns" \
        --allowedTools "Edit,Write,Bash,Read,Grep,Glob,Task,Agent" \
        --dangerously-skip-permissions \
        --add-dir "$MONOREPO" \
        --agent "$agent" \
        --system-prompt "$sys_prompt_content" \
        "Execute this task: $task_desc. Read context bundle at file://${context_bundle}. Then edit files, run tests, and commit." \
        2>&1 | tee "$TMP_DIR/claude-output-${task_id}.log" || exit_code=$?

    local end_time
    end_time=$(date +%s)
    local duration=$((end_time - start_time))

    log "Claude CLI exited with code $exit_code after ${duration}s"

    # Check if task completed successfully
    if [ $exit_code -eq 0 ]; then
        log "Task $task_id COMPLETED successfully"
        return 0
    else
        log "Task $task_id FAILED (exit code: $exit_code)"
        return 1
    fi
}

# ─── Phase 5: Verification (optional, run tests again) ─────────────────────
verify_task() {
    local test_cmd="$1"
    log "Verification: $test_cmd"

    # Run test command from the monorepo root
    (
        cd "$MONOREPO"
        eval "$test_cmd" 2>&1 || {
            log "Verification FAILED"
            return 1
        }
    )
    log "Verification PASSED"
    return 0
}

# ─── Main: Execute pipeline task ───────────────────────────────────────────
main() {
    local pipeline_json="${1:-}"
    local task_index="${2:-0}"

    if [ -z "$pipeline_json" ]; then
        echo "Usage: $0 <pipeline.json> [task_index]" >&2
        echo "  pipeline.json must contain: task.id, task.description, task.files[], task.test_cmd, task.commit_msg" >&2
        exit 2
    fi

    if [ ! -f "$pipeline_json" ]; then
        fail "pipeline file not found: $pipeline_json"
    fi

    # Extract task
    local task
    task=$(jq -c --argjson idx "$task_index" \
        'if .tasks then .tasks[$idx] else .task end' "$pipeline_json" 2>/dev/null) || {
        fail "failed to parse pipeline.json — invalid JSON"
    }

    local task_id task_desc task_files test_cmd commit_msg scope max_iter agent
    task_id=$(echo "$task" | jq -r '.id // "T00"')
    task_desc=$(echo "$task" | jq -r '.description // ""')
    task_files=$(echo "$task" | jq -c '.files // []')
    test_cmd=$(echo "$task" | jq -r '.test_cmd // "echo no-tests"')
    commit_msg=$(echo "$task" | jq -r '.commit_msg // "chore: automated task"')
    scope=$(jq -r '.hermes.scope // ""' "$pipeline_json" 2>/dev/null || echo "")
    max_iter=$(jq -r '.limits.max_iterations // "5"' "$pipeline_json" 2>/dev/null || echo "5")
    agent=$(jq -r '.hermes.agent // "implementer"' "$pipeline_json" 2>/dev/null || echo "implementer")

    echo -e "${CYAN}━━━ Nexus Aider Executor ━━━${NC}"
    echo -e "  Task:     ${CYAN}$task_id${NC} — ${task_desc:0:80}..."
    echo -e "  Scope:    ${scope:-root}"
    echo -e "  Agent:    $agent"
    echo -e "  Files:    $(echo "$task_files" | jq -r 'join(", ")' 2>/dev/null || echo "none")"
    echo -e "  Test:     $test_cmd"
    echo -e "  Max Iter: $max_iter"
    echo ""

    # Phase 1: Repo Map
    local map_file
    map_file=$(generate_repo_map "$task_id" "$scope")

    # Phase 2: Context Bundle
    local bundle_file
    bundle_file=$(generate_context_bundle "$task_id" "$task_desc" "$task_files" "$map_file")

    # Phase 3: System Prompt
    local prompt_file
    prompt_file=$(build_system_prompt "$task_id" "$task_desc" "$task_files" "$test_cmd" "$commit_msg" "$bundle_file")

    # Phase 4: Execute
    if execute_claude "$task_id" "$prompt_file" "$bundle_file" "$max_iter" "$agent"; then
        # Phase 5: Verify
        verify_task "$test_cmd" || fail "post-execution verification failed"

        # Cleanup context artifacts
        rm -f "$map_file" "$bundle_file" "$prompt_file" "$TMP_DIR/claude-output-${task_id}.log"

        echo ""
        echo -e "${GREEN}✅ TASK $task_id COMPLETE${NC}"
        echo "   $(git -C "$MONOREPO" log --oneline -1 2>/dev/null || echo 'no commit')"
        exit 0
    else
        echo -e "${RED}❌ TASK $task_id FAILED${NC}"
        echo "   Output: $TMP_DIR/claude-output-${task_id}.log"
        exit 1
    fi
}

main "$@"
