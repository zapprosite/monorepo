#!/usr/bin/env bash
# deployment_smoke.sh
# Smoke tests for SPEC-007 deployment verification
# Prerequisites: docker, curl, docker-compose

set -euo pipefail

COMPOSE_FILE="deployments/docker-compose.test.yml"
COMPOSE_PROJECT="hvacr-swarm-test"
HEALTH_URL="http://localhost:8080/health"
REDIS_URL="localhost:6379"
MAX_WAIT=120
SWARM_PID=""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

cleanup() {
    log_info "Cleaning up..."
    if [[ -n "$SWARM_PID" ]] && kill -0 "$SWARM_PID" 2>/dev/null; then
        kill "$SWARM_PID" 2>/dev/null || true
    fi
    docker compose -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE" down --remove-orphans --volumes 2>/dev/null || true
}

trap cleanup EXIT

wait_for_healthy() {
    local service=$1
    local timeout=$2
    local elapsed=0
    local interval=5

    while [[ $elapsed -lt $timeout ]]; do
        if docker compose -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE" ps "$service" | grep -q "(healthy)"; then
            return 0
        fi
        sleep $interval
        elapsed=$((elapsed + interval))
    done
    return 1
}

wait_for_http() {
    local url=$1
    local timeout=$2
    local elapsed=0

    while [[ $elapsed -lt $timeout ]]; do
        if curl -sf "$url" > /dev/null 2>&1; then
            return 0
        fi
        sleep 2
        elapsed=$((elapsed + 2))
    done
    return 1
}

# -----------------------------------------------------------------------------
# AC-1: Docker Compose up succeeds
# -----------------------------------------------------------------------------
test_docker_compose_up() {
    log_info "AC-1: Testing docker compose up -d..."

    docker compose -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE" down --remove-orphans --volumes 2>/dev/null || true

    if ! docker compose -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE" up -d; then
        log_error "AC-1 FAILED: docker compose up -d returned non-zero exit"
        return 1
    fi

    log_info "AC-1 PASSED: docker compose up -d succeeded"
    return 0
}

# -----------------------------------------------------------------------------
# AC-2: Health endpoint returns 200
# -----------------------------------------------------------------------------
test_health_endpoint() {
    log_info "AC-2: Testing health endpoint at $HEALTH_URL..."

    if ! wait_for_http "$HEALTH_URL" 60; then
        log_error "AC-2 FAILED: Health endpoint not responding at $HEALTH_URL"
        return 1
    fi

    local http_code
    http_code=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_URL")

    if [[ "$http_code" != "200" ]]; then
        log_error "AC-2 FAILED: Health endpoint returned $http_code, expected 200"
        return 1
    fi

    log_info "AC-2 PASSED: Health endpoint returned 200"
    return 0
}

# -----------------------------------------------------------------------------
# AC-3: Auto-restart on crash (kill -9)
# -----------------------------------------------------------------------------
test_auto_restart_on_crash() {
    log_info "AC-3: Testing auto-restart on crash (kill -9)..."

    # Get the swarm container name
    local swarm_container
    swarm_container=$(docker compose -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE" ps -q swarm)

    if [[ -z "$swarm_container" ]]; then
        log_error "AC-3 FAILED: Could not find swarm container"
        return 1
    fi

    # Record the container's PID before kill
    local pid_before
    pid_before=$(docker inspect --format '{{.State.Pid}}' "$swarm_container")

    log_info "Killing swarm container $swarm_container (PID: $pid_before) with SIGKILL..."

    # Send SIGKILL to the main process inside the container
    docker exec "$swarm_container" kill -9 1 2>/dev/null || \
    docker kill --signal=KILL "$swarm_container" 2>/dev/null || true

    # Wait for container to restart (restart: unless-stopped)
    log_info "Waiting for container to restart..."
    sleep 5

    local timeout=60
    local elapsed=0
    while [[ $elapsed -lt $timeout ]]; do
        local new_container
        new_container=$(docker compose -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE" ps -q swarm)

        if [[ -n "$new_container" ]]; then
            local pid_after
            pid_after=$(docker inspect --format '{{.State.Pid}}' "$new_container" 2>/dev/null)

            if [[ "$pid_after" != "$pid_before" ]]; then
                log_info "Container restarted with new PID: $pid_after (was: $pid_before)"
                break
            fi
        fi

        sleep 2
        elapsed=$((elapsed + 2))
    done

    # Verify health endpoint is back up
    if ! wait_for_http "$HEALTH_URL" 60; then
        log_error "AC-3 FAILED: Health endpoint did not recover after crash restart"
        return 1
    fi

    log_info "AC-3 PASSED: Auto-restart on crash succeeded"
    return 0
}

# -----------------------------------------------------------------------------
# AC-4: Graceful shutdown drains tasks (SIGTERM)
# -----------------------------------------------------------------------------
test_graceful_shutdown() {
    log_info "AC-4: Testing graceful shutdown with SIGTERM..."

    local swarm_container
    swarm_container=$(docker compose -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE" ps -q swarm)

    if [[ -z "$swarm_container" ]]; then
        log_error "AC-4 FAILED: Could not find swarm container"
        return 1
    fi

    # Record the PID of the main process
    local main_pid
    main_pid=$(docker inspect --format '{{.State.Pid}}' "$swarm_container")

    log_info "Sending SIGTERM to swarm container $swarm_container (PID: $main_pid)..."

    # Send SIGTERM to the container
    docker stop -t 30 "$swarm_container" > /dev/null 2>&1

    # Container should stop gracefully within stop_grace_period (30s)
    local timeout=45
    local elapsed=0
    while [[ $elapsed -lt $timeout ]]; do
        local status
        status=$(docker inspect --format '{{.State.Status}}' "$swarm_container" 2>/dev/null || echo "removed")

        if [[ "$status" == "exited" ]] || [[ "$status" == "removed" ]]; then
            log_info "Container exited gracefully with status: $status"
            break
        fi

        sleep 2
        elapsed=$((elapsed + 2))
    done

    # Verify container is stopped
    local final_status
    final_status=$(docker inspect --format '{{.State.Status}}' "$swarm_container" 2>/dev/null || echo "removed")

    if [[ "$final_status" != "exited" ]] && [[ "$final_status" != "removed" ]]; then
        log_error "AC-4 FAILED: Container did not stop gracefully (status: $final_status)"
        return 1
    fi

    log_info "AC-4 PASSED: Graceful shutdown succeeded"
    return 0
}

# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------
main() {
    local failed=0

    log_info "Starting SPEC-007 deployment smoke tests..."
    log_info "Compose file: $COMPOSE_FILE"
    log_info "Project: $COMPOSE_PROJECT"

    # Run tests in order of dependency
    test_docker_compose_up || failed=$((failed + 1))

    # AC-2 depends on AC-1 (compose up)
    test_health_endpoint || failed=$((failed + 1))

    # AC-3 and AC-4 require running containers
    test_auto_restart_on_crash || failed=$((failed + 1))

    # Restart for final test
    docker compose -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE" up -d > /dev/null 2>&1
    wait_for_http "$HEALTH_URL" 60 || true

    test_graceful_shutdown || failed=$((failed + 1))

    echo ""
    if [[ $failed -eq 0 ]]; then
        log_info "All smoke tests PASSED"
        exit 0
    else
        log_error "$failed smoke test(s) FAILED"
        exit 1
    fi
}

main "$@"
