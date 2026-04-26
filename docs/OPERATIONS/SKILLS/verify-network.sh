#!/usr/bin/env bash
# =============================================================================
# verify-network.sh — Homelab Network Verification Script
# =============================================================================
# Purpose: Verify Docker container network connectivity in the homelab
#          following HOMELAB-SURVIVAL-GUIDE rules (snapshot-first, test
#          from inside containers, verify shared networks)
# Usage:   ./verify-network.sh [--json]
# Exit:    0 = all checks pass, non-zero = any check fails
# Requires: docker, curl, python3
# =============================================================================

set -euo pipefail

# =============================================================================
# CONFIGURATION — Homelab real container names and networks
# =============================================================================

# Container names (from homelab reality)
readonly TRAEFIK_CONTAINER="coolify-proxy"
readonly OPENCLAW_CONTAINER="openclaw-qgtzrmi6771lt8l7x8rqx72f"
readonly LITELLM_CONTAINER="zappro-litellm"
readonly WAV2VEC2_CONTAINER="zappro-wav2vec2"

# Networks (from homelab reality)
readonly NETWORK_QGTZRMI="qgtzrmi6771lt8l7x8rqx72f"
readonly NETWORK_ZAPPRO_LITE="zappro-lite_default"
readonly NETWORK_COOLIFY="coolify"

# Internal service endpoints (from homelab reality)
readonly WAV2VEC2_ENDPOINT="http://wav2vec2:8201"
readonly OLLAMA_ENDPOINT="http://10.0.1.1:11434"

# =============================================================================
# OUTPUT MODE — JSON or human-readable
# =============================================================================

OUTPUT_JSON="${1:-}"  # --json flag enables JSON output

# =============================================================================
# STATE — JSON accumulation
# =============================================================================

# Global arrays for JSON output
declare -a CHECK_NAMES=()
declare -a CHECK_STATUSES=()
declare -a CHECK_DETAILS=()
OVERALL_STATUS="PASS"

# Timestamp for JSON output
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# =============================================================================
# UTILITY FUNCTIONS
# =============================================================================

# record_check(name, status, detail)
# Records a check result for JSON output.
#   name   — unique identifier for the check
#   status — "PASS" or "FAIL"
#   detail — human-readable explanation
record_check() {
    local name="$1"
    local status="$2"
    local detail="$3"

    CHECK_NAMES+=("$name")
    CHECK_STATUSES+=("$status")
    CHECK_DETAILS+=("$detail")

    if [ "$status" != "PASS" ]; then
        OVERALL_STATUS="FAIL"
    fi
}

# json_escape(string)
# Escapes a string for safe JSON embedding.
json_escape() {
    local str="$1"
    # Escape backslashes, quotes, newlines, tabs
    printf '%s' "$str" | python3 -c \
        'import sys,json; print(json.dumps(sys.stdin.read()))' | sed 's/^"//; s/"$//'
}

# print_json_output()
# Emits the final JSON report to stdout.
print_json_output() {
    local num_checks=${#CHECK_NAMES[@]}
    local i

    echo "{"
    echo "  \"timestamp\": \"$TIMESTAMP\","
    echo "  \"overall_status\": \"$OVERALL_STATUS\","
    echo "  \"checks\": ["

    for ((i=0; i<num_checks; i++)); do
        local name_json
        local detail_json
        name_json=$(json_escape "${CHECK_NAMES[$i]}")
        detail_json=$(json_escape "${CHECK_DETAILS[$i]}")

        echo "    {"
        echo "      \"name\": \"$name_json\","
        echo "      \"status\": \"${CHECK_STATUSES[$i]}\","
        echo "      \"detail\": \"$detail_json\""
        echo -n "    }"

        if ((i < num_checks - 1)); then
            echo ","
        else
            echo
        fi
    done

    echo "  ]"
    echo "}"
}

# print_human_output()
# Emits a human-readable report to stdout.
print_human_output() {
    local num_checks=${#CHECK_NAMES[@]}
    local i

    echo "NETWORK VERIFICATION — $(date -u '+%Y-%m-%d %H:%M UTC')"
    echo "============================================================"

    for ((i=0; i<num_checks; i++)); do
        local icon="✅"
        if [ "${CHECK_STATUSES[$i]}" != "PASS" ]; then
            icon="❌"
        fi
        printf "%s %-45s %s\n" "$icon" "${CHECK_NAMES[$i]}" "${CHECK_DETAILS[$i]}"
    done

    echo "============================================================"
    echo "OVERALL: $OVERALL_STATUS"
}

# =============================================================================
# CORE CHECK FUNCTIONS
# =============================================================================

# check_shared_network(container_a, container_b)
# Lists the Docker networks of both containers and finds any shared network.
# This is critical — Traefik can only reach containers on networks it shares.
#
# Arguments:
#   container_a  — first container name
#   container_b  — second container name
#
# Output (via record_check):
#   name:   "shared_network_{a}_{b}"
#   status: PASS if shared network found, FAIL otherwise
#   detail: "shared: <network_name>" or "no shared network"
#
# Example:
#   check_shared_network "coolify-proxy" "openclaw-qgtzrmi6771lt8l7x8rqx72f"
check_shared_network() {
    local container_a="$1"
    local container_b="$2"
    local check_name="shared_network_${container_a}_${container_b}"

    # Get networks for container_a
    local nets_a
    nets_a=$(docker inspect "$container_a" --format '{{json .NetworkSettings.Networks}}' 2>/dev/null | \
        python3 -c "import sys,json; print(' '.join(json.load(sys.stdin).keys()))") || {
        record_check "$check_name" "FAIL" "container '$container_a' not found"
        return
    }

    # Get networks for container_b
    local nets_b
    nets_b=$(docker inspect "$container_b" --format '{{json .NetworkSettings.Networks}}' 2>/dev/null | \
        python3 -c "import sys,json; print(' '.join(json.load(sys.stdin).keys()))") || {
        record_check "$check_name" "FAIL" "container '$container_b' not found"
        return
    }

    # Find shared networks
    local shared_net=""
    for net_a in $nets_a; do
        for net_b in $nets_b; do
            if [ "$net_a" = "$net_b" ]; then
                shared_net="$net_a"
                break 2
            fi
        done
    done

    if [ -n "$shared_net" ]; then
        record_check "$check_name" "PASS" "shared: $shared_net"
    else
        record_check "$check_name" "FAIL" "no shared network — A: [$nets_a] B: [$nets_b]"
    fi
}

# check_tcp_connectivity(container, host, port)
# Tests TCP connectivity FROM a container TO a host:port target.
# Uses docker exec + /dev/tcp or timeout-aware curl.
#
# Arguments:
#   container — source container name
#   host      — target hostname or IP
#   port      — target TCP port
#
# Output (via record_check):
#   name:   "tcp_{container}_{host}_{port}"
#   status: PASS if connection succeeds, FAIL otherwise
#   detail: "connected" or "connection refused/timeout"
#
# Example:
#   check_tcp_connectivity "zappro-litellm" "wav2vec2" "8201"
check_tcp_connectivity() {
    local container="$1"
    local host="$2"
    local port="$3"
    local check_name="tcp_${container}_${host}_${port}"

    # Use timeout curl from inside container — works for any TCP endpoint
    local output
    local exit_code

    output=$(docker exec "$container" curl -sf -m 5 \
        --connect-timeout 3 \
        "http://${host}:${port}/" \
        2>&1) || exit_code=$?

    if [ -z "$exit_code" ] || [ "$exit_code" -eq 0 ]; then
        record_check "$check_name" "PASS" "connected to ${host}:${port}"
    elif echo "$output" | grep -qi "connection refused"; then
        record_check "$check_name" "FAIL" "connection refused on ${host}:${port}"
    elif echo "$output" | grep -qi "timeout"; then
        record_check "$check_name" "FAIL" "timeout connecting to ${host}:${port}"
    else
        # HTTP error (like 404/503) still means TCP connection succeeded
        # Only true failures are connection refused/timeout/no route
        if echo "$output" | grep -qE "(HTTP/|curl:)" 2>/dev/null; then
            record_check "$check_name" "PASS" "connected to ${host}:${port} (HTTP response received)"
        else
            record_check "$check_name" "FAIL" "failed ${host}:${port} — $output"
        fi
    fi
}

# check_http_from_container(container, url, expected_codes)
# Tests HTTP from INSIDE a container — the REAL route per HOMELAB-SURVIVAL-GUIDE Rule 3.
# Never test localhost:port from host — that's the anti-pattern.
#
# Arguments:
#   container       — container to run curl from
#   url             — full URL to request
#   expected_codes  — space-separated list of acceptable HTTP codes (e.g., "200 401")
#
# Output (via record_check):
#   name:   "http_{container}_{url_hash}"
#   status: PASS if response code in expected_codes, FAIL otherwise
#   detail: "200 OK" or "expected [200 401] got 502"
#
# Example:
#   check_http_from_container "zappro-litellm" "http://wav2vec2:8201/health" "200"
check_http_from_container() {
    local container="$1"
    local url="$2"
    local expected_codes="$3"

    # Create a URL-safe hash for the check name
    local url_hash
    url_hash=$(printf '%s' "$url" | md5sum | cut -c1-12)

    local check_name="http_${container}_${url_hash}"
    local http_code
    local curl_output
    local curl_exit

    # Execute curl inside the container with proper timeouts
    curl_output=$(docker exec "$container" curl -sf -m 10 \
        -o /dev/null \
        -w "%{http_code}" \
        --connect-timeout 5 \
        "$url" 2>&1) || curl_exit=$?

    http_code="$curl_output"

    # Validate exit code
    if [ -n "$curl_exit" ] && [ "$curl_exit" -ne 0 ]; then
        # Connection failures
        if echo "$curl_output" | grep -qi "connection refused"; then
            record_check "$check_name" "FAIL" "connection refused for $url"
        elif echo "$curl_output" | grep -qi "timeout"; then
            record_check "$check_name" "FAIL" "timeout for $url"
        elif echo "$curl_output" | grep -qi "no route"; then
            record_check "$check_name" "FAIL" "no route to host for $url"
        else
            record_check "$check_name" "FAIL" "curl failed for $url: $curl_output"
        fi
        return
    fi

    # Check if response code is in expected list
    local expected
    local found=0
    for expected in $expected_codes; do
        if [ "$http_code" = "$expected" ]; then
            found=1
            break
        fi
    done

    if [ "$found" -eq 1 ]; then
        record_check "$check_name" "PASS" "${http_code} from $url"
    else
        record_check "$check_name" "FAIL" "expected [$expected_codes] got ${http_code} from $url"
    fi
}

# =============================================================================
# DOMAIN-SPECIFIC VERIFICATION FUNCTIONS
# =============================================================================

# verify_litellm_routes()
# Verifies all LiteLLM → backend routes per homelab reality:
#   - LiteLLM → wav2vec2: http://wav2vec2:8201
#   - LiteLLM → Ollama:   http://10.0.1.1:11434
#   - LiteLLM → Kokoro:   via traefik (http://kokoro:5000)
#
# Per HOMELAB-SURVIVAL-GUIDE Rule 2: Docker bridge ≠ host native services.
# LiteLLM must connect to containerized backends, not host processes.
verify_litellm_routes() {
    echo "=== Verifying LiteLLM Routes ===" >&2

    # LiteLLM → wav2vec2 (containerized STT)
    check_http_from_container "$LITELLM_CONTAINER" "${WAV2VEC2_ENDPOINT}/health" "200"

    # LiteLLM → Ollama (containerized LLM at 10.0.1.1:11434)
    # Note: 10.0.1.1 is the host IP seen from inside Docker network
    # This is the AP-1 anti-pattern per Rule 2 — Ollama should be containerized
    # But in current setup, Ollama runs on host at 10.0.1.1
    check_tcp_connectivity "$LITELLM_CONTAINER" "10.0.1.1" "11434"
}

# verify_traefik_routes()
# Verifies Traefik (coolify-proxy) → OpenClaw routing.
# Per HOMELAB-SURVIVAL-GUIDE Rule 6: Network shared = Traefik consegue atingir.
# Per HOMELAB-SURVIVAL-GUIDE Rule 7: Health check ≠ routing working.
#
# Checks:
#   1. Shared network exists between Traefik and OpenClaw
#   2. OpenClaw is reachable via Traefik's localhost:80 from inside the container
verify_traefik_routes() {
    echo "=== Verifying Traefik Routes ===" >&2

    # Step 1: Verify shared network (Rule 6)
    check_shared_network "$TRAEFIK_CONTAINER" "$OPENCLAW_CONTAINER"

    # Step 2: Test Traefik → OpenClaw via internal network
    # From inside coolify-proxy, OpenClaw should be reachable at its container name
    check_tcp_connectivity "$TRAEFIK_CONTAINER" "$OPENCLAW_CONTAINER" "8080"

    # Step 3: Test Traefik can route to OpenClaw via its public-ish endpoint
    # We test from a container on the same network as Traefik
    check_http_from_container "$TRAEFIK_CONTAINER" "http://${OPENCLAW_CONTAINER}:8080/health" "200 401"
}

# verify_wav2vec2_network()
# Verifies wav2vec2 container networking and its route to LiteLLM.
verify_wav2vec2_network() {
    echo "=== Verifying wav2vec2 Network ===" >&2

    # Check wav2vec2 has network connectivity
    check_shared_network "$LITELLM_CONTAINER" "$WAV2VEC2_CONTAINER"

    # wav2vec2 should be reachable from LiteLLM's network
    check_tcp_connectivity "$LITELLM_CONTAINER" "$WAV2VEC2_CONTAINER" "8201"
}

# =============================================================================
# MAIN EXECUTION
# =============================================================================

main() {
    echo "Starting network verification at $(date)" >&2

    # -------------------------------------------------------------------------
    # PHASE 1: Shared Network Verification
    # Per HOMELAB-SURVIVAL-GUIDE Rule 6
    # -------------------------------------------------------------------------
    echo "=== Phase 1: Shared Network Checks ===" >&2

    check_shared_network "$TRAEFIK_CONTAINER" "$OPENCLAW_CONTAINER"
    check_shared_network "$TRAEFIK_CONTAINER" "$LITELLM_CONTAINER"
    check_shared_network "$LITELLM_CONTAINER" "$WAV2VEC2_CONTAINER"

    # -------------------------------------------------------------------------
    # PHASE 2: LiteLLM Routes
    # Per HOMELAB-SURVIVAL-GUIDE Rule 2 (no host native services as backends)
    # -------------------------------------------------------------------------
    verify_litellm_routes

    # -------------------------------------------------------------------------
    # PHASE 3: Traefik Routes
    # Per HOMELAB-SURVIVAL-GUIDE Rule 6 (shared network) + Rule 7 (health ≠ routing)
    # -------------------------------------------------------------------------
    verify_traefik_routes

    # -------------------------------------------------------------------------
    # PHASE 4: wav2vec2 Network
    # -------------------------------------------------------------------------
    verify_wav2vec2_network

    # -------------------------------------------------------------------------
    # PHASE 5: End-to-End HTTP Tests
    # Per HOMELAB-SURVIVAL-GUIDE Rule 3 (test the real route, not local)
    # -------------------------------------------------------------------------
    echo "=== Phase 5: End-to-End HTTP Tests ===" >&2

    # Test LiteLLM → wav2vec2 health (from inside LiteLLM container)
    check_http_from_container "$LITELLM_CONTAINER" "${WAV2VEC2_ENDPOINT}/health" "200"

    # Test Traefik health (from host for local validation)
    local traefik_ping_code
    traefik_ping_code=$(curl -sf -m 5 -o /dev/null -w "%{http_code}" "http://localhost:80/ping" 2>/dev/null || echo "FAIL")
    if [ "$traefik_ping_code" = "200" ]; then
        record_check "traefik_local_ping" "PASS" "localhost:80/ping → 200"
    else
        record_check "traefik_local_ping" "FAIL" "localhost:80/ping → ${traefik_ping_code}"
    fi

    # -------------------------------------------------------------------------
    # OUTPUT
    # -------------------------------------------------------------------------
    echo "" >&2
    echo "Verification complete. Overall: $OVERALL_STATUS" >&2

    if [ "$OUTPUT_JSON" = "--json" ] || [ "$OUTPUT_JSON" = "json" ]; then
        print_json_output
    else
        print_human_output
    fi

    # Exit code: 0 = all pass, non-zero = any fail
    if [ "$OVERALL_STATUS" = "PASS" ]; then
        exit 0
    else
        exit 1
    fi
}

# Trap unexpected errors
trap 'echo "Unexpected error at line $LINENO" >&2; exit 1' ERR

main "$@"
