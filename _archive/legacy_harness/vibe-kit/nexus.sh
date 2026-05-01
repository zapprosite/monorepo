#!/usr/bin/env bash
#
# nexus.sh — Nexus Unified Agent Harness Entry Point
#
# Usage:
#   nexus.sh --spec SPEC-204 --phase plan
#   nexus.sh --spec SPEC-204 --phase execute --parallel 15
#   nexus.sh --resume
#   nexus.sh --snapshot
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKDIR="${SCRIPT_DIR}"
QUEUE_FILE="${WORKDIR}/queue.json"
STATE_FILE="${WORKDIR}/state.json"
LOGDIR="${WORKDIR}/logs"
SNAPSHOT_POOL="${ZFS_POOL:-tank}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log() { echo -e "${CYAN}[NEXUS]${NC} $*"; }
info() { echo -e "${BLUE}[INFO]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*" >&2; }
success() { echo -e "${GREEN}[OK]${NC} $*"; }

usage() {
    cat <<EOF
Nexus — Unified Agent Harness Framework (7 modes × 7 agents = 49 agents)

Usage:
  nexus.sh --spec <SPEC-NNN> --phase <phase> [options]
  nexus.sh --mode <mode> [--agent <name>]
  nexus.sh --resume
  nexus.sh --snapshot
  nexus.sh --status

Modes (select operational focus):
  debug      — Diagnostic and troubleshooting (7 agents)
  test       — Unit, integration, E2E testing (7 agents)
  backend    — API, services, database (7 agents)
  frontend   — UI, components, styling (7 agents)
  review     — Code review, quality gates (7 agents)
  docs       — Documentation generation (7 agents)
  deploy     — Docker, Coolify, rollback (7 agents)

Phase Workflow:
  plan     — Parse SPEC, create queue.json, await approval
  review   — Run review agents, assess risks
  execute  — Launch vibe-kit workers, process queue
  verify   — Run verification suite
  complete — Deploy, docs, finalize

Options:
  --spec <SPEC>        SPEC number (e.g., SPEC-204)
  --phase <phase>      PREVC phase to execute
  --mode <mode>        Switch to mode (debug|test|backend|frontend|review|docs|deploy)
  --agent <name>       Specific agent within mode (e.g., unit-tester)
  --parallel <N>        Number of parallel workers (default: 15)
  --force              Skip human gates (CI mode)
  --resume             Resume interrupted run
  --snapshot           Take ZFS snapshot of current state
  --task <id>          Run specific task ID
  --status             Show current workflow status

Examples:
  nexus.sh --spec SPEC-204 --phase plan
  nexus.sh --spec SPEC-204 --phase execute --parallel 15
  nexus.sh --mode debug                    # List debug agents
  nexus.sh --mode docs --agent adr-writer  # Show ADR writer agent
  nexus.sh --resume
  nexus.sh --status
EOF
}

# Ensure log directory exists
mkdir -p "${LOGDIR}"

# Load state
load_state() {
    if [[ -f "${STATE_FILE}" ]]; then
        STATE_SPEC=$(jq -r '.spec // empty' "${STATE_FILE}" 2>/dev/null || echo "")
        STATE_PHASE=$(jq -r '.phase // empty' "${STATE_FILE}" 2>/dev/null || echo "")
        STATE_TASKS_TOTAL=$(jq -r '.tasks_total // 0' "${STATE_FILE}" 2>/dev/null || echo "0")
        STATE_TASKS_DONE=$(jq -r '.tasks_done // 0' "${STATE_FILE}" 2>/dev/null || echo "0")
    else
        STATE_SPEC=""
        STATE_PHASE=""
        STATE_TASKS_TOTAL=0
        STATE_TASKS_DONE=0
    fi
}

# Save state
save_state() {
    local spec="$1"
    local phase="$2"
    local tasks_total="$3"
    local tasks_done="$4"
    local gate_plan="$5"
    local gate_review="$6"
    local gate_execute="$7"
    local gate_verify="$8"

    jq -n \
        --arg spec "$spec" \
        --arg phase "$phase" \
        --argjson tasks_total "$tasks_total" \
        --argjson tasks_done "$tasks_done" \
        --argjson gate_plan "$gate_plan" \
        --argjson gate_review "$gate_review" \
        --argjson gate_execute "$gate_execute" \
        --argjson gate_verify "$gate_verify" \
        --arg timestamp "$(date -Iseconds)" \
        '{
            spec: $spec,
            phase: $phase,
            tasks_total: $tasks_total,
            tasks_done: $tasks_done,
            gates: {
                plan_approved: $gate_plan,
                review_approved: $gate_review,
                execute_complete: $gate_execute,
                verify_approved: $gate_verify
            },
            updated_at: $timestamp
        }' > "${STATE_FILE}.tmp" && mv "${STATE_FILE}.tmp" "${STATE_FILE}"
}

# Check ZFS availability
check_zfs() {
    if command -v zfs &>/dev/null && zfs list "${SNAPSHOT_POOL}" &>/dev/null; then
        return 0
    else
        warn "ZFS not available or pool '${SNAPSHOT_POOL}' not found — snapshots disabled"
        return 1
    fi
}

# Take ZFS snapshot
take_snapshot() {
    local spec="$1"
    local phase="$2"
    local label="$3"

    if ! check_zfs; then
        warn "Skipping snapshot — ZFS unavailable"
        return 1
    fi

    local snapshot_name="nexus-${spec}-${phase}-${label}"
    local snapshot_path="${SNAPSHOT_POOL}@${snapshot_name}"

    info "Taking ZFS snapshot: ${snapshot_path}"
    if sudo zfs snapshot "${snapshot_path}"; then
        success "Snapshot created: ${snapshot_name}"
        return 0
    else
        error "Failed to create snapshot: ${snapshot_name}"
        return 1
    fi
}

# Parse SPEC and create task queue
phase_plan() {
    local spec="$1"
    local spec_path="${WORKDIR}/../../docs/SPEC-${spec#SPEC-}.md"

    if [[ ! -f "${spec_path}" ]]; then
        spec_path="${WORKDIR}/../../docs/SPECS/SPEC-${spec#SPEC-}.md"
    fi

    if [[ ! -f "${spec_path}" ]]; then
        error "SPEC file not found: ${spec_path}"
        return 1
    fi

    log "Parsing SPEC: ${spec}"
    info "Spec path: ${spec_path}"

    # Extract acceptance criteria and decompose into tasks
    local ac_section=$(grep -A 500 "^##.*Acceptance" "${spec_path}" 2>/dev/null || echo "")
    if [[ -z "$ac_section" ]]; then
        ac_section=$(grep -A 500 "^##.*Criteria" "${spec_path}" 2>/dev/null || echo "")
    fi

    # Create queue from SPEC
    local task_count=0
    local tasks_json="[]"

    # Parse task lines from implementation section if exists
    while IFS= read -r line; do
        if echo "$line" | grep -qE "^\s*[-*]\s+\[.\]\s+"; then
            local task_desc=$(echo "$line" | sed 's/^\s*[-*]\s\+\[.\]\s\+//')
            local task_id=$(printf "T%03d" $((++task_count)))
            local task_name=$(echo "$task_desc" | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | tr -cd 'a-z0-9-')

            # Determine agent role from task content
            local agent_role="backend-agent"
            if echo "$task_desc" | grep -qi "test\|spec"; then
                agent_role="test-agent"
            elif echo "$task_desc" | grep -qi "front\|ui\|component"; then
                agent_role="frontend-agent"
            elif echo "$task_desc" | grep -qi "doc\|readme\|changelog"; then
                agent_role="docs-agent"
            elif echo "$task_desc" | grep -qi "deploy\|docker\|coolify"; then
                agent_role="deploy-agent"
            elif echo "$task_desc" | grep -qi "debug\|diagnostic\|troubleshoot"; then
                agent_role="debug-agent"
            fi

            local task_json=$(jq -n \
                --arg id "$task_id" \
                --arg name "$task_name" \
                --arg desc "$task_desc" \
                --arg role "$agent_role" \
                --argjson status 0 \
                '{
                    id: $id,
                    name: $name,
                    description: $desc,
                    agent_role: $role,
                    status: "pending",
                    attempts: 0,
                    worker: null,
                    created_at: now | todate,
                    completed_at: null,
                    artifacts: [],
                    error: null
                }')

            tasks_json=$(echo "$tasks_json" | jq ". + [$task_json]")
        fi
    done < "${spec_path}"

    if [[ "$task_count" -eq 0 ]]; then
        warn "No tasks found in SPEC — creating default task list"
        task_count=1
        tasks_json=$(jq -n \
            --arg id "T001" \
            --arg name "implement-spec" \
            --arg desc "Implement requirements from SPEC" \
            --arg role "backend-agent" \
            '{
                id: $id,
                name: $name,
                description: $desc,
                agent_role: $role,
                status: "pending",
                attempts: 0,
                worker: null,
                created_at: now | todate,
                completed_at: null,
                artifacts: [],
                error: null
            }' | jq "[.]")
    fi

    # Create queue.json
    echo "$tasks_json" | jq -s '.[0]' | jq --arg spec "$spec" --arg phase "plan" '{
        spec: $spec,
        phase: $phase,
        total: (. | length),
        pending: (. | length),
        running: 0,
        done: 0,
        failed: 0,
        tasks: .
    }' > "${QUEUE_FILE}.tmp" && mv "${QUEUE_FILE}.tmp" "${QUEUE_FILE}"

    success "Created queue with ${task_count} tasks"
    info "Queue file: ${QUEUE_FILE}"

    save_state "$spec" "plan" "$task_count" 0 false false false false

    echo ""
    info "Phase PLAN complete. Next steps:"
    echo "  1. Review queue.json: ${QUEUE_FILE}"
    echo "  2. Edit tasks if needed (assign agent roles)"
    echo "  3. Approve plan: nexus.sh --spec ${spec} --phase review"
    echo ""

    return 0
}

# Phase Review — run review agents
phase_review() {
    local spec="$1"
    local force="${2:-false}"

    load_state

    if [[ "$STATE_SPEC" != "$spec" ]]; then
        error "State mismatch: expected spec ${spec}, got ${STATE_SPEC}"
        return 1
    fi

    if [[ "$STATE_PHASE" != "plan" ]] && [[ "$STATE_PHASE" != "review" ]]; then
        warn "Current phase is ${STATE_PHASE}, skipping review"
    fi

    log "Starting PHASE REVIEW for ${spec}"

    # Check plan gate
    if [[ "$force" != "true" ]]; then
        echo ""
        info "=== PREVC Gate: R → E Approval ==="
        echo "Review the following before proceeding:"
        echo "  1. Task count: ${STATE_TASKS_TOTAL}"
        echo "  2. Agent role distribution"
        echo "  3. Dependencies and risks"
        echo ""
        read -p "Approve review? (y/N): " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            warn "Review not approved — run 'nexus.sh --spec ${spec} --phase review' when ready"
            return 1
        fi
    fi

    take_snapshot "$spec" "review" "$(date +%Y%m%dT%H%M%S)"

    save_state "$spec" "review" "$STATE_TASKS_TOTAL" 0 true false false false

    echo ""
    info "Phase REVIEW complete. Execute ready."
    echo "  Run: nexus.sh --spec ${spec} --phase execute --parallel 15"
    echo ""

    return 0
}

# Phase Execute — run vibe-kit loop
phase_execute() {
    local spec="$1"
    local parallel="${2:-15}"
    local force="${3:-false}"

    load_state

    if [[ "$STATE_SPEC" != "$spec" ]]; then
        error "State mismatch: expected spec ${spec}, got ${STATE_SPEC}"
        return 1
    fi

    log "Starting PHASE EXECUTE for ${spec} with ${parallel} workers"

    # Check review gate
    if [[ "$force" != "true" ]]; then
        local gate_review=$(jq -r '.gates.review_approved' "${STATE_FILE}" 2>/dev/null || echo "false")
        if [[ "$gate_review" != "true" ]]; then
            error "Review gate not passed. Run 'nexus.sh --spec ${spec} --phase review' first."
            return 1
        fi
    fi

    take_snapshot "$spec" "execute" "$(date +%Y%m%dT%H%M%S)"

    save_state "$spec" "execute" "$STATE_TASKS_TOTAL" 0 true true false false

    # Run vibe-kit.sh with nexus context
    info "Launching vibe-kit loop..."
    info "Workers: ${parallel}"
    info "Queue: ${QUEUE_FILE}"

    # Check if vibe-kit.sh exists
    if [[ -x "${WORKDIR}/vibe-kit.sh" ]]; then
        bash "${WORKDIR}/vibe-kit.sh" --queue "${QUEUE_FILE}" --parallel "${parallel}" 2>&1 | \
            while IFS= read -r line; do
                echo -e "${CYAN}[WORKER]${NC} $line"
            done
    else
        warn "vibe-kit.sh not found at ${WORKDIR}/vibe-kit.sh"
        info "Running in standalone mode — implement queue processing here"

        # Standalone queue processor
        local pending=$(jq '.pending' "${QUEUE_FILE}" 2>/dev/null || echo "0")
        local running=0

        while [[ "$pending" -gt 0 ]] || [[ "$running" -gt 0 ]]; do
            load_state
            pending=$(jq '.pending' "${QUEUE_FILE}" 2>/dev/null || echo "0")
            local done_count=$(jq '.done' "${QUEUE_FILE}" 2>/dev/null || echo "0")

            info "Progress: ${done_count}/${STATE_TASKS_TOTAL} tasks completed"

            if [[ "$pending" -eq 0 ]]; then
                break
            fi

            sleep 5
        done
    fi

    local final_done=$(jq '.done' "${QUEUE_FILE}" 2>/dev/null || echo "0")
    local final_failed=$(jq '.failed' "${QUEUE_FILE}" 2>/dev/null || echo "0")

    success "Execute phase complete: ${final_done} done, ${final_failed} failed"

    save_state "$spec" "execute" "$STATE_TASKS_TOTAL" "$final_done" true true true false

    echo ""
    info "Phase EXECUTE complete."
    echo "  Run: nexus.sh --spec ${spec} --phase verify"
    echo ""

    return 0
}

# Phase Verify — run verification suite
phase_verify() {
    local spec="$1"
    local force="${2:-false}"

    load_state

    log "Starting PHASE VERIFY for ${spec}"

    if [[ "$force" != "true" ]]; then
        echo ""
        info "=== PREVC Gate: V → C Approval ==="
        echo "Verify the following before completing:"
        echo "  1. All tests pass: pnpm test"
        echo "  2. Type check passes: pnpm tsc --noEmit"
        echo "  3. Lint passes: pnpm lint"
        echo "  4. Build succeeds: pnpm build"
        echo ""

        read -p "Approve verification? (y/N): " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            warn "Verification not approved — fix issues and run again"
            return 1
        fi
    fi

    take_snapshot "$spec" "verify" "$(date +%Y%m%dT%H%M%S)"

    save_state "$spec" "verify" "$STATE_TASKS_TOTAL" "$STATE_TASKS_DONE" true true true true

    echo ""
    info "Phase VERIFY complete."
    echo "  Run: nexus.sh --spec ${spec} --phase complete"
    echo ""

    return 0
}

# Phase Complete — finalize and ship
phase_complete() {
    local spec="$1"

    load_state

    log "Starting PHASE COMPLETE for ${spec}"

    take_snapshot "$spec" "complete" "$(date +%Y%m%dT%H%M%S)"

    save_state "$spec" "complete" "$STATE_TASKS_TOTAL" "$STATE_TASKS_DONE" true true true true

    success "Nexus workflow ${spec} COMPLETE"
    info "Total tasks: ${STATE_TASKS_TOTAL}"
    info "Completed: ${STATE_TASKS_DONE}"

    echo ""
    info "Next: Create PR, merge to main, deploy via CI/CD"
    echo ""

    return 0
}

# Show status
show_status() {
    load_state

    echo ""
    echo -e "${CYAN}═══════════════════════════════════════${NC}"
    echo -e "${CYAN}         NEXUS WORKFLOW STATUS        ${NC}"
    echo -e "${CYAN}═══════════════════════════════════════${NC}"
    echo ""

    if [[ -z "$STATE_SPEC" ]]; then
        echo "  No active workflow"
        echo ""
        return 0
    fi

    printf "  ${BLUE}Spec:${NC}     %s\n" "$STATE_SPEC"
    printf "  ${BLUE}Phase:${NC}     %s\n" "$STATE_PHASE"
    printf "  ${BLUE}Tasks:${NC}    %d / %d\n" "$STATE_TASKS_DONE" "$STATE_TASKS_TOTAL"

    if [[ -f "${QUEUE_FILE}" ]]; then
        local pending=$(jq '.pending' "${QUEUE_FILE}" 2>/dev/null || echo "-")
        local running=$(jq '.running' "${QUEUE_FILE}" 2>/dev/null || echo "-")
        local failed=$(jq '.failed' "${QUEUE_FILE}" 2>/dev/null || echo "-")
        printf "  ${BLUE}Queue:${NC}    pending=%s running=%s failed=%s\n" "$pending" "$running" "$failed"
    fi

    echo ""
    echo -e "  ${BLUE}Gates:${NC}"
    printf "    %-20s %s\n" "Plan approved" "$([[ "$STATE_PHASE" != "plan" ]] && echo -e "${GREEN}✓${NC}" || echo -e "${YELLOW}○${NC}")"
    printf "    %-20s %s\n" "Review approved" "$(jq -r '.gates.review_approved' "${STATE_FILE}" 2>/dev/null && echo -e "${GREEN}✓${NC}" || echo -e "${YELLOW}○${NC}")"
    printf "    %-20s %s\n" "Execute complete" "$(jq -r '.gates.execute_complete' "${STATE_FILE}" 2>/dev/null && echo -e "${GREEN}✓${NC}" || echo -e "${YELLOW}○${NC}")"
    printf "    %-20s %s\n" "Verify approved" "$(jq -r '.gates.verify_approved' "${STATE_FILE}" 2>/dev/null && echo -e "${GREEN}✓${NC}" || echo -e "${YELLOW}○${NC}")"

    echo ""
    echo -e "${CYAN}═══════════════════════════════════════${NC}"
    echo ""

    return 0
}

# Resume interrupted run
do_resume() {
    load_state

    if [[ -z "$STATE_SPEC" ]]; then
        error "No interrupted run found"
        return 1
    fi

    local spec="$STATE_SPEC"
    local phase="$STATE_PHASE"

    info "Resuming ${spec} from phase ${phase}"

    case "$phase" in
        plan)
            phase_plan "$spec"
            ;;
        review)
            phase_review "$spec" "false"
            ;;
        execute)
            phase_execute "$spec" "15" "true"
            ;;
        verify)
            phase_verify "$spec" "false"
            ;;
        complete)
            phase_complete "$spec"
            ;;
        *)
            error "Unknown phase: $phase"
            return 1
            ;;
    esac
}

# Take manual snapshot
do_snapshot() {
    load_state

    if [[ -z "$STATE_SPEC" ]]; then
        error "No active workflow for snapshot"
        return 1
    fi

    take_snapshot "$STATE_SPEC" "$STATE_PHASE" "$(date +%Y%m%dT%H%M%S)"
}

# Mode selector — list agents for a mode
do_mode() {
    local mode="$1"

    case "$mode" in
        debug)
            echo ""
            info "DEBUG mode agents:"
            echo "  log-diagnostic      — Log analysis and pattern detection"
            echo "  stack-trace        — Stack trace parsing and root cause"
            echo "  perf-profiler       — CPU, memory, I/O profiling"
            echo "  network-tracer      — HTTP/DNS/TLS tracing"
            echo "  security-scanner    — Vulnerability detection"
            echo "  sre-monitor        — SLO/SLA monitoring"
            echo "  incident-response   — Incident handling"
            ;;
        test)
            echo ""
            info "TEST mode agents:"
            echo "  unit-tester         — Unit test generation"
            echo "  integration-tester   — Service boundary testing"
            echo "  e2e-tester          — End-to-end user flows"
            echo "  coverage-analyzer    — Coverage metrics"
            echo "  boundary-tester      — Edge case testing"
            echo "  flaky-detector      — Test reliability"
            echo "  property-tester     — Property-based testing"
            ;;
        backend)
            echo ""
            info "BACKEND mode agents:"
            echo "  api-developer       — REST/GraphQL APIs"
            echo "  service-architect   — Dependency injection"
            echo "  db-migrator         — Schema migrations"
            echo "  cache-specialist     — Redis caching"
            echo "  auth-engineer       — Authentication/authorization"
            echo "  event-developer      — Event-driven architecture"
            echo "  file-pipeline       — File processing"
            ;;
        frontend)
            echo ""
            info "FRONTEND mode agents:"
            echo "  component-dev       — React/Vue components"
            echo "  responsive-dev      — Mobile-first CSS"
            echo "  state-manager       — Zustand/Redux/Query"
            echo "  animation-dev       — Framer Motion/CSS"
            echo "  a11y-auditor       — WCAG 2.1 AA"
            echo "  perf-optimizer      — Core Web Vitals"
            echo "  design-system       — Design tokens"
            ;;
        review)
            echo ""
            info "REVIEW mode agents:"
            echo "  correctness-reviewer — Logic errors, edge cases"
            echo "  readability-reviewer  — Naming, complexity"
            echo "  architecture-reviewer — Dependencies, layers"
            echo "  security-reviewer    — OWASP, secrets"
            echo "  perf-reviewer        — N+1, pagination"
            echo "  dependency-auditor   — Outdated packages"
            echo "  quality-scorer       — Aggregate scoring"
            ;;
        docs)
            echo ""
            info "DOCS mode agents:"
            echo "  api-doc-writer       — OpenAPI specs"
            echo "  readme-writer        — README, guides"
            echo "  changelog-writer     — Release notes"
            echo "  inline-doc-writer    — JSDoc, comments"
            echo "  diagram-generator     — Mermaid diagrams"
            echo "  adr-writer           — Architecture decisions"
            echo "  doc-coverage-auditor — Docs completeness"
            ;;
        deploy)
            echo ""
            info "DEPLOY mode agents:"
            echo "  docker-builder       — Multi-stage Dockerfile"
            echo "  compose-orchestrator — Docker Compose"
            echo "  coolify-deployer     — Coolify API"
            echo "  secret-rotator       — Vault, env rotation"
            echo "  rollback-executor    — Rollback procedures"
            echo "  zfs-snapshotter      — ZFS snapshots"
            echo "  health-checker      — Health endpoints"
            ;;
        list)
            echo ""
            info "Available modes (7 modes × 7 agents = 49 agents):"
            echo ""
            echo "  debug      — Diagnostic and troubleshooting"
            echo "  test       — Unit, integration, E2E testing"
            echo "  backend    — API, services, database"
            echo "  frontend   — UI, components, styling"
            echo "  review     — Code review, quality gates"
            echo "  docs       — Documentation generation"
            echo "  deploy     — Docker, Coolify, rollback"
            echo ""
            echo "Usage: nexus.sh --mode <mode> [--agent <name>]"
            echo ""
            ;;
        *)
            error "Unknown mode: $mode"
            echo "Valid modes: debug, test, backend, frontend, review, docs, deploy"
            echo "Use --mode list to see all agents"
            return 1
            ;;
    esac

    if [[ -n "${agent_role:-}" ]]; then
        local agent_path="${WORKDIR}/agents/${mode}/${agent_role}/system-prompt.md"
        if [[ -f "$agent_path" ]]; then
            echo ""
            info "Agent: ${mode}/${agent_role}"
            info "Path: ${agent_path}"
            echo ""
            head -30 "$agent_path"
        else
            error "Agent not found: ${mode}/${agent_role}"
            echo "Available agents in ${mode}:"
            ls "${WORKDIR}/agents/${mode}/" 2>/dev/null || echo "  (none)"
            return 1
        fi
    fi

    return 0
}

# Main
main() {
    local spec=""
    local phase=""
    local parallel="15"
    local force="false"
    local resume="false"
    local snapshot="false"
    local status_mode="false"
    local agent_role=""
    local task_id=""
    local mode=""

    # Parse args
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --spec)
                spec="$2"
                shift 2
                ;;
            --phase)
                phase="$2"
                shift 2
                ;;
            --parallel)
                parallel="$2"
                shift 2
                ;;
            --force)
                force="true"
                shift
                ;;
            --resume)
                resume="true"
                shift
                ;;
            --snapshot)
                snapshot="true"
                shift
                ;;
            --status)
                status_mode="true"
                shift
                ;;
            --agent)
                agent_role="$2"
                shift 2
                ;;
            --task)
                task_id="$2"
                shift 2
                ;;
            --mode)
                mode="$2"
                shift 2
                ;;
            --help|-h)
                usage
                exit 0
                ;;
            *)
                error "Unknown option: $1"
                usage
                exit 1
                ;;
        esac
    done

    # Mode selector
    if [[ -n "$mode" ]]; then
        do_mode "$mode"
        exit $?
    fi

    # Status mode
    if [[ "$status_mode" == "true" ]]; then
        show_status
        exit $?
    fi

    # Resume mode
    if [[ "$resume" == "true" ]]; then
        do_resume
        exit $?
    fi

    # Snapshot mode
    if [[ "$snapshot" == "true" ]]; then
        do_snapshot
        exit $?
    fi

    # Spec and phase required
    if [[ -z "$spec" ]]; then
        error "--spec is required"
        usage
        exit 1
    fi

    if [[ -z "$phase" ]]; then
        error "--phase is required"
        usage
        exit 1
    fi

    # Dispatch phase
    case "$phase" in
        plan)
            phase_plan "$spec"
            ;;
        review)
            phase_review "$spec" "$force"
            ;;
        execute)
            phase_execute "$spec" "$parallel" "$force"
            ;;
        verify)
            phase_verify "$spec" "$force"
            ;;
        complete)
            phase_complete "$spec"
            ;;
        *)
            error "Unknown phase: $phase"
            usage
            exit 1
            ;;
    esac
}

main "$@"
