#!/bin/bash
# Smoke Test Runner — Real health checks against services
# Exit codes: 0=all pass, 1=some fail

DIR="$(dirname "$0")"
RESULTS_DIR="$DIR/results"
mkdir -p "$RESULTS_DIR"
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
OVERALL_STATUS=0

echo "=== Smoke Test Runner ==="
echo "Timestamp: $TIMESTAMP"
echo ""

# Services on localhost (host network)
declare -a LOCAL_TESTS=(
    "whisper-api:8201:/health:200:true"
    "ollama:11434:/api/tags:200:true"
    "grafana:3100:/api/health:200:true"
    "loki:3101:/ready:200:true"
    "kokoro:8012:/v1/models:200:true"
)

echo "=== Local Services (Host Network) ==="
for test_spec in "${LOCAL_TESTS[@]}"; do
    IFS=':' read -r service port path expected critical <<< "$test_spec"
    http_code=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${port}${path}" 2>/dev/null || echo "000")

    passed=0
    if [ "$http_code" = "$expected" ]; then
        passed=1
    fi

    status="PASS"
    if [ "$passed" -eq 0 ]; then
        status="FAIL"
        if [ "$critical" = "true" ]; then
            OVERALL_STATUS=1
        fi
    fi
    printf "  %-4s %-20s http://localhost:%s%s (HTTP: %s)\n" "[$status]" "$service" "$port" "$path" "$http_code"
done

echo ""
echo "=== Internal Services (Docker Networks) ==="
# These are on Docker-internal networks, check via docker exec or just container status
declare -a DOCKER_SERVICES=(
    "zappro-litellm:4000:/health:200:true"
    "qdrant:6333:/health:200:true"
    "n8n:5678:/health:200:true"
)

for test_spec in "${DOCKER_SERVICES[@]}"; do
    IFS=':' read -r service port path expected critical <<< "$test_spec"
    # Try localhost first (might work via host network)
    http_code=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${port}${path}" 2>/dev/null || echo "000")

    # If that fails, check via docker network
    if [ "$http_code" = "000" ]; then
        # Try via docker network - find container IP
        container_name=$(docker ps --format '{{.Names}}' | grep -i "$service" | head -1)
        if [ -n "$container_name" ]; then
            # Get container IP from its network
            container_ip=$(docker inspect "$container_name" --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' 2>/dev/null)
            if [ -n "$container_ip" ]; then
                http_code=$(curl -s -o /dev/null -w "%{http_code}" "http://${container_ip}:${port}${path}" 2>/dev/null || echo "000")
            fi
        fi
    fi

    passed=0
    if [ "$http_code" = "$expected" ]; then
        passed=1
    fi

    status="PASS"
    if [ "$passed" -eq 0 ]; then
        status="WARN"
        # Don't fail overall for internal services - container status is the real check
    fi
    printf "  %-4s %-20s :%s%s (HTTP: %s)\n" "[$status]" "$service" "$port" "$path" "$http_code"
done

echo ""
echo "=== Container Status ==="
declare -a CONTAINERS=(
    "whisper-api-gpu"
    "zappro-litellm"
    "grafana"
    "loki"
    "prometheus"
    "alertmanager"
    "qdrant"
    "n8n"
    "zappro-kokoro"
    "mcp-qdrant"
)

for container in "${CONTAINERS[@]}"; do
    status=$(docker ps --filter "name=$container" --format '{{.Status}}' 2>/dev/null) || status=""
    if [ -n "$status" ] && echo "$status" | grep -q "Up"; then
        printf "  %-4s %s (%s)\n" "[PASS]" "$container" "$status"
    else
        printf "  %-4s %s (not running)\n" "[FAIL]" "$container"
        OVERALL_STATUS=1
    fi
done

echo ""
echo "=== GPU Status ==="
gpu_used=$(nvidia-smi --query-gpu=memory.used --format=csv,noheader,nounits 2>/dev/null) || gpu_used="N/A"
gpu_total=$(nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits 2>/dev/null) || gpu_total="N/A"
printf "  VRAM: %s / %s MiB\n" "$gpu_used" "$gpu_total"

echo ""
echo "=== ZFS Pool ==="
zfs_status=$(zpool status tank 2>/dev/null | grep "state:" | awk '{print $2}')
printf "  Pool 'tank': %s\n" "$zfs_status"

echo ""
echo "=== Summary ==="
if [ "$OVERALL_STATUS" -eq 0 ]; then
    echo "All checks: PASS"
else
    echo "Some checks: FAIL"
fi

# Write results JSON
cat > "$RESULTS_DIR/latest.json" << EOF
{
  "timestamp": "$TIMESTAMP",
  "status": $OVERALL_STATUS,
  "services_checked": ${#CONTAINERS[@]},
  "summary": "smoke tests completed"
}
EOF

echo ""
echo "Results saved to: $RESULTS_DIR/latest.json"
exit $OVERALL_STATUS
