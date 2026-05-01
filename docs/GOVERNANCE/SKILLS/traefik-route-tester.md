# Skill: traefik-route-tester

> **Versão:** 1.0.0
> **Data:** 2026-04-08
> **Autor:** will + Claude Code
> **Tags:** `traefik`, `route`, `testing`, `curl`, `json`

## Descrição

Testa todas as rotas Traefik activas e detecta exactamente onde o routing falha. Output em JSON estruturado para integração com pipelines.

## Uso

```bash
# Testar todas as rotas definidas
bash docs/OPERATIONS/SKILLS/traefik-route-tester.sh

# Testar rota específica
DOMAIN=openclaw.191.17.50.123.sslip.io bash docs/OPERATIONS/SKILLS/traefik-route-tester.sh
```

## Output

```json
{
  "timestamp": "2026-04-08T14:00:00Z",
  "traefik_healthy": true,
  "routes_tested": 3,
  "results": [
    {
      "domain": "openclaw.191.17.50.123.sslip.io",
      "traefik_route": false,
      "backend_reachable": false,
      "http_code": 0,
      "error": "connection_timeout",
      "dns_resolves": true,
      "network_isolation": true
    }
  ]
}
```

## Script Completo

```bash
#!/bin/bash
# traefik-route-tester.sh
# Testa rotas Traefik e retorna JSON estruturado

set -euo pipefail

OUTPUT_FILE="${OUTPUT_FILE:-/tmp/traefik-routes-$(date +%Y%m%d-%H%M%S).json}"
TIMEOUT="${TIMEOUT:-10}"

# Cores
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

log()  { echo -e "${YELLOW}[TEST]${NC} $1"; }
pass() { echo -e "${GREEN}[PASS]${NC} $1"; }
fail() { echo -e "${RED}[FAIL]${NC} $1"; }

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
http_code() {
    local code; code=$(curl -s -m "$TIMEOUT" -o /dev/null -w "%{http_code}" "$1" 2>/dev/null)
    echo "${code:-000}"
}

dns_resolves() {
    nslookup "$1" >/dev/null 2>&1 && echo "true" || echo "false"
}

container_networks() {
    docker inspect "$1" --format '{{json .NetworkSettings.Networks}}' 2>/dev/null | \
        python3 -c "import sys,json; nets=json.load(sys.stdin); print('\n'.join(nets.keys()))" || echo ""
}

traefik_health() {
    curl -sf -m 5 "http://localhost:80/ping" >/dev/null 2>&1 && echo "true" || echo "false"
}

# ---------------------------------------------------------------------------
# Teste de rota
# ---------------------------------------------------------------------------
test_route() {
    local domain="$1"
    local health_path="${2:-/health}"
    local proto="${3:-https}"

    local url="${proto}://${domain}${health_path}"
    local dns_ok http_code_result

    dns_ok=$(dns_resolves "$domain")

    if [ "$dns_ok" = "false" ]; then
        echo "{ \"domain\": \"$domain\", \"traefik_route\": false, \"backend_reachable\": false, \"http_code\": 0, \"error\": \"dns_fail\", \"dns_resolves\": false, \"network_isolation\": null }"
        return
    fi

    # Tentar HTTP primeiro (sem SSL)
    http_code_result=$(http_code "http://${domain}${health_path}")

    if [ "$http_code_result" = "000" ]; then
        # Falhou HTTP, tentar HTTPS
        http_code_result=$(http_code "https://${domain}${health_path}")
        if [ "$http_code_result" = "000" ]; then
            echo "{ \"domain\": \"$domain\", \"traefik_route\": false, \"backend_reachable\": false, \"http_code\": 0, \"error\": \"connection_timeout\", \"dns_resolves\": true, \"network_isolation\": null }"
            return
        fi
    fi

    # Analisar código HTTP
    local traefik_route backend_reachable error_type
    traefik_route="true"
    backend_reachable="true"

    case "$http_code_result" in
        200|201|204) error_type="none";;
        502) error_type="bad_gateway"; traefik_route="true"; backend_reachable="false";;
        503) error_type="service_unavailable"; traefik_route="true"; backend_reachable="false";;
        504) error_type="gateway_timeout"; traefik_route="true"; backend_reachable="false";;
        301|302|307|308) error_type="redirect";;
        404) error_type="not_found"; traefik_route="false"; backend_reachable="false";;
        *) error_type="unknown";;
    esac

    echo "{ \"domain\": \"$domain\", \"traefik_route\": $traefik_route, \"backend_reachable\": $backend_reachable, \"http_code\": $http_code_result, \"error\": \"$error_type\", \"dns_resolves\": true, \"network_isolation\": null }"
}

# ---------------------------------------------------------------------------
# Diagnostic adicional — network isolation
# ---------------------------------------------------------------------------
check_network_isolation() {
    local container_a="$1"
    local container_b="$2"

    local nets_a nets_b
    nets_a=$(container_networks "$container_a" | sort)
    nets_b=$(container_networks "$container_b" | sort)

    if [ -z "$nets_a" ] || [ -z "$nets_b" ]; then
        echo "null"
        return
    fi

    # Encontrar networks partilhadas
    shared=$(comm -12 <(echo "$nets_a") <(echo "$nets_b") | grep -v "^$" | head -1)
    if [ -n "$shared" ]; then
        echo "false (shared: $shared)"
    else
        echo "true (no shared network)"
    fi
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
main() {
    local timestamp
    timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)

    echo "=== Traefik Route Tester ==="
    echo "Timestamp: $timestamp"
    echo ""

    # 1. Traefik health
    local traefik_ok
    traefik_ok=$(traefik_health)
    if [ "$traefik_ok" = "true" ]; then
        pass "Traefik healthy (localhost:80/ping)"
    else
        fail "Traefik UNHEALTHY"
    fi

    # 2. Listar domains a testar (variável ou default)
    local domains
    domains="${DOMAINS:-openclaw.191.17.50.123.sslip.io open-webui.191.17.50.123.sslip.io}"

    local results_json="["
    local first=true

    for domain in $domains; do
        log "Testing: $domain"
        local result
        result=$(test_route "$domain" "/health")

        local http_code
        http_code=$(echo "$result" | python3 -c "import sys,json; print(json.load(sys.stdin).get('http_code',''))" 2>/dev/null || echo "0")

        if [ "$http_code" = "200" ]; then
            pass "  $domain → HTTP $http_code"
        else
            fail "  $domain → HTTP $http_code (${result##*error\": \"})"
        fi

        if [ "$first" = "true" ]; then
            first=false
        else
            results_json+=","
        fi
        results_json+=$"\n  $result"
    done

    results_json+="]"
    traefik_ok=$(traefik_health)

    # JSON final
    local final_json
    final_json=$(cat <<EOF
{
  "timestamp": "$timestamp",
  "traefik_healthy": $traefik_ok,
  "routes_tested": $(echo "$domains" | wc -w),
  "results": $results_json
}
EOF
)

    echo ""
    echo "=== JSON Output ==="
    echo "$final_json" | python3 -m json.tool 2>/dev/null || echo "$final_json"

    # Guardar
    echo "$final_json" > "$OUTPUT_FILE"
    echo ""
    echo "Saved: $OUTPUT_FILE"

    # Diagnóstico de network isolation (se openclaw)
    if docker inspect "openclaw-qgtzrmi6771lt8l7x8rqx72f" >/dev/null 2>&1; then
        echo ""
        echo "=== Network Isolation Diagnostic ==="
        local iso
        iso=$(check_network_isolation "coolify-proxy" "openclaw-qgtzrmi6771lt8l7x8rqx72f")
        log "coolify-proxy ↔ openclaw: $iso"

        local traefik_nets openclaw_nets
        traefik_nets=$(container_networks "coolify-proxy")
        openclaw_nets=$(container_networks "openclaw-qgtzrmi6771lt8l7x8rqx72f")
        echo "  coolify-proxy networks: $(echo "$traefik_nets" | tr '\n' ' ')"
        echo "  openclaw networks:      $(echo "$openclaw_nets" | tr '\n' ' ')"
    fi
}

main "$@"
```

## Caz de Uso

### Quando Usar

- After deploying a new Coolify service with a domain
- When Traefik routing is not working (502/504/gateway timeout)
- As part of smoke test after infrastructure changes
- To confirm network isolation between containers

### Output Codes Interpretados

| http_code | Significado | Acção |
|-----------|------------|-------|
| 200 | Rota OK, backend reachable | ✅ |
| 301/302 | Redirect (HTTP→HTTPS) | ⚠️ Verificar HTTPS |
| 404 | Traefik não conhece esta rota | ❌ Domain não adicionado ao Traefik |
| 502 | Traefik conhece rota, backend unreachable | ❌ Container down ou network isolation |
| 503 | Backend overwhelmed/down | ⚠️ Container a reiniciar? |
| 504 | Gateway timeout | ❌ Backend não responde a tempo |
| 000 | Connection fail (timeout/refused) | ❌ DNS, firewall ou porta bloqueada |

## tickets Relacionados

- tasks/plan-traefik-coolify-research.md
- docs/OPERATIONS/SKILLS/traefik-health-check.md
