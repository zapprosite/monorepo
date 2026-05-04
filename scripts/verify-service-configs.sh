#!/bin/bash
# verify-service-config.sh - Verify locked service configurations
# Usage: ./scripts/verify-service-configs.sh [service]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MONOREPO_DIR="$(dirname "$SCRIPT_DIR")"
LOCKED_DIR="$MONOREPO_DIR/docs/GOVERNANCE/LOCKED"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "============================================"
echo "Locked Service Configuration Verification"
echo "============================================"

check_docker_network() {
    local network=$1
    echo -n "Checking network $network... "
    if docker network ls | grep -q "$network"; then
        echo -e "${GREEN}OK${NC}"
        return 0
    else
        echo -e "${RED}MISSING${NC}"
        return 1
    fi
}

check_redis_connectivity() {
    echo -n "Checking Redis (zappro-redis)... "
    if docker exec openwebui-hvac sh -c "python3 -c 'import redis; r=redis.Redis(host=\"zappro-redis\",port=6379,socket_connect_timeout=3);print(r.ping())'" 2>/dev/null | grep -q True; then
        echo -e "${GREEN}OK${NC}"
        return 0
    else
        echo -e "${RED}FAIL${NC}"
        return 1
    fi
}

check_hvac_pipeline() {
    echo -n "Checking HVAC RAG Pipeline (host :4017)... "
    if curl -s --max-time 5 http://172.17.0.1:4017/ 2>/dev/null | grep -q "HVAC RAG"; then
        echo -e "${GREEN}OK${NC}"
        return 0
    else
        echo -e "${RED}FAIL${NC}"
        return 1
    fi
}

check_litellm() {
    echo -n "Checking LiteLLM (:4018)... "
    if curl -s --max-time 5 http://localhost:4018/v1/models -H "Authorization: Bearer ${LITELLM_MASTER_KEY:-}" 2>/dev/null | grep -q "hermes-auto"; then
        echo -e "${GREEN}OK${NC}"
        return 0
    else
        echo -e "${RED}FAIL${NC}"
        return 1
    fi
}

check_openwebui() {
    echo -n "Checking OpenWebUI (:3456)... "
    if curl -s --max-time 5 http://localhost:3456/ 2>/dev/null | grep -q "html"; then
        echo -e "${GREEN}OK${NC}"
        return 0
    else
        echo -e "${RED}FAIL${NC}"
        return 1
    fi
}

verify_network_config() {
    echo ""
    echo "Network Configuration:"
    echo "---------------------"

    # Check that openwebui-hvac is on zappro-lite_default
    echo -n "openwebui-hvac on zappro-lite_default... "
    if docker inspect openwebui-hvac --format '{{json .NetworkSettings.Networks}}' 2>/dev/null | grep -q "zappro-lite_default"; then
        echo -e "${GREEN}OK${NC}"
    else
        echo -e "${RED}FAIL - Wrong network${NC}"
    fi

    # Check that zappro-redis is accessible
    echo -n "zappro-redis accessible from openwebui-hvac... "
    if docker exec openwebui-hvac sh -c "getent hosts zappro-redis" &>/dev/null; then
        echo -e "${GREEN}OK${NC}"
    else
        echo -e "${RED}FAIL${NC}"
    fi
}

verify_env_config() {
    echo ""
    echo "Environment Configuration:"
    echo "--------------------------"

    # Check OPENAI_API_BASE_URL
    echo -n "OPENAI_API_BASE_URL points to HVAC pipeline... "
    local api_base=$(docker exec openwebui-hvac printenv OPENAI_API_BASE_URL 2>/dev/null || echo "")
    if [[ "$api_base" == *"host.docker.internal:4017"* ]]; then
        echo -e "${GREEN}OK ($api_base)${NC}"
    else
        echo -e "${RED}FAIL ($api_base)${NC}"
    fi

    # Check REDIS_HOST
    echo -n "REDIS_HOST is zappro-redis (not localhost)... "
    local redis_host=$(docker exec openwebui-hvac printenv REDIS_HOST 2>/dev/null || echo "")
    if [[ "$redis_host" == "zappro-redis" ]]; then
        echo -e "${GREEN}OK ($redis_host)${NC}"
    else
        echo -e "${RED}FAIL ($redis_host)${NC}"
    fi
}

echo ""
echo "Service Health:"
echo "---------------"
check_openwebui
check_litellm
check_hvac_pipeline
check_redis_connectivity

verify_network_config
verify_env_config

echo ""
echo "============================================"
echo "Verification Complete"
echo "============================================"
