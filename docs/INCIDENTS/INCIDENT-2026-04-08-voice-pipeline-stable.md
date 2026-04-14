# INCIDENT-2026-04-08: Voice Pipeline Stability — Prevention Master Plan

**Data:** 2026-04-08
**Severidade:** 🔴 HIGH
**Tipo:** Multi-categoria / Stability / Network
**Status:** ✅ RESOLVIDO (parcialmente)

---

## Sumário

Ao longo de 08/04/2026 enfrentámos 3 incidentes graves no voice pipeline (OpenClaw + LiteLLM + wav2vec2 + Traefik). Este documento consolida todos os root causes, lessons learned e cria um **Plano de Prevenção** para que nunca mais aconteçam.

---

## Root Causes Identificados

### RC-1: Docker Bridge Network Isolation
**severity:** 🔴 HIGH

Container Docker **não consegue TCP para portas de processos nativos do host** em redes bridge Docker arbitrárias, mesmo quando ICMP (ping) funciona.

**Teste de conectividade:**

| Origem | Target | Protocol | Resultado |
|--------|--------|----------|-----------|
| Container (bridge) | Host service (native process) | ICMP (ping) | ✅ OK |
| Container (bridge) | Host service (native process) | TCP (specific port) | ❌ TIMEOUT |
| Container (bridge) | Container (same bridge) | TCP | ✅ OK |
| Container (bridge) | Host Docker port (docker-proxy) | TCP | ✅ OK |

**Solução:** Containerizar TODOS os serviços. Nenhum processo nativo do host para rotas Docker.

---

### RC-2: Traefik Routing — Container Network Segregated
**severity:** 🔴 HIGH

Traefik (coolify-proxy) e OpenClaw estavam em **redes Docker diferentes**, impedindo routing.

**Redes identificadas:**

```
coolify-proxy networks: coolify + qgtzrmi6771lt8l7x8rqx72f + wbmqefxhd7vdn2dme3i6s9an + ...
openclaw networks:     qgtzrmi6771lt8l7x8rqx72f  ✅ (partilham)
```

Felizmente OpenClaw e Traefik **partilham** `qgtzrmi6771lt8l7x8rqx72f`. O problema real era que:
1. `localhost:${OPENCLAW_GATEWAY_PORT:-18789}` (OpenClaw Gateway) é **loopback-only** dentro do container — nunca acessível externamente
2. Smoke test usava `localhost:18789` — rota incorrecta

**Solução:** Smoke test usa rota via Cloudflare Tunnel (`${OPENCLAW_TUNNEL_URL}`).

---

### RC-3: Cloud Provider Firewall Bloqueia 80/443
**severity:** 🟡 MEDIUM

O cloud provider (Hetzner?) bloqueia portas 80/443 externamente. Cloudflare Tunnel contorna isto.

| Acesso | Resultado |
|--------|-----------|
| `curl http://${HOST_IP}/health` (host local) | ❌ Timeout |
| `curl http://localhost:80/ping` (host) | ✅ OK |
| `curl ${OPENCLAW_TUNNEL_URL}/` (externo) | ✅ OK (via Cloudflare Tunnel) |

---

### RC-4: GitOps Gap — DNS ≠ Container
**severity:** 🔴 HIGH

Cloudflare Tunnel + Terraform DNS estar "UP" não significa que o container está a correr.

```
Terraform → DNS criado → Tunnel UP
                         ↓
                  (nenhum deploy feito)
                         ↓
              Container não existe → 502
```

---

### RC-5: OpenClaw Gateway Bind Loopback
**severity:** 🟡 MEDIUM

`OPENCLAW_GATEWAY_BIND=loopback` — o gateway do OpenClaw só escuta em `127.0.0.1:18789`. Inacessível de fora do container.

**Nunca usar** `localhost:18789` em smoke tests ou configurações externas.

---

## Anti-Patterns Catalogados

### AP-1: Host Process como Backend de Container
**NÃO FAZER:**
```
Container LiteLLM → TCP → Host:8201 (native python process)
```
**PORQUÊ:** Docker bridge não consegue TCP para portas de processos nativos.
**SEMPRE FAZER:**
```
Container LiteLLM → TCP → Container wav2vec2:8201 (same Docker network)
```

### AP-2: Testar Conectividade só do Host
**NÃO FAZER:**
```bash
curl localhost:8201  # funciona do host → "está tudo bem"
```
**PORQUÊ:** Host usa loopback, não passa pela bridge Docker.
**SEMPRE FAZER:**
```bash
docker exec liteLLM curl http://wav2vec2:8201/health  # testa rota real
```

### AP-3: Health Check sem Verificação de Rota
**NÃO FAZER:**
```bash
docker ps | grep container  # "está a correr" → "está tudo bem"
```
**PORQUÊ:** Container pode estar "Up" mas a rota para o serviço pode estar quebrada.
**SEMPRE FAZER:**
```bash
curl http://localhost:PORT/health  # verificação real end-to-end
```

### AP-4: DNS/Tunnel UP = Service UP
**NÃO ASSUMIR:**
```
nslookup ${OPENCLAW_TUNNEL_URL} → OK
curl ${OPENCLAW_TUNNEL_URL}/ → 502 Bad Gateway
```
**PORQUÊ:** Tunnel pode estar UP mas backend não estar a correr.

---

## Prevention Master Plan

### FASE 1: Snapshot ZFS (SEMPRE antes de mudanças)

**OBRIGATÓRIO** antes de qualquer mudança em:
- Docker compose / network
- Configuração Traefik/Coolify
- Deploy de novos containers
- Changes a containers existentes

```bash
sudo zfs snapshot -r tank@pre-$(date +%Y%m%d-%H%M%S)-$(whoami)
```

**Quando fazer snapshot:**
- [ ] Antes de deploy de novo serviço
- [ ] Antes de update de container existente
- [ ] Antes de mudança de network Docker
- [ ] Antes de mudança de configuração Traefik

---

### FASE 2: Network Verification (para novos serviços)

**Template** — aplicar a TODO novo serviço que se integrar com LiteLLM ou Traefik:

```bash
#!/bin/bash
# verify-network.sh — VERIFICAR CONECTIVIDADE DE REDE

set -e

CONTAINER_NAME="${1:?Usage: $0 <container-name> <target-host> <target-port>}"
TARGET_HOST="$2"
TARGET_PORT="$3"

echo "=== Network Verification ==="
echo "Container: $CONTAINER_NAME"
echo "Target: $TARGET_HOST:$TARGET_PORT"

# 1. Container existe e está a correr
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "ERROR: Container $CONTAINER_NAME not running"
    exit 1
fi

# 2. Teste TCP directo (o que realmente importa)
echo "Testing TCP connectivity..."
if timeout 5 bash -c "docker exec $CONTAINER_NAME sh -c 'echo >/dev/tcp/$TARGET_HOST/$TARGET_PORT'" 2>/dev/null; then
    echo "✅ TCP connection successful"
else
    echo "❌ TCP connection FAILED"
    echo "Possible causes:"
    echo "  - Target service not running on $TARGET_HOST:$TARGET_PORT"
    echo "  - Firewall blocking"
    echo "  - Docker network isolation (container on different network)"
    exit 1
fi

# 3. Teste HTTP (se aplicável)
echo "Testing HTTP connectivity..."
HTTP_CODE=$(docker exec "$CONTAINER_NAME" curl -sf -m 5 -o /dev/null -w "%{http_code}" "http://$TARGET_HOST:$TARGET_PORT/health" 2>/dev/null || echo "000")
echo "HTTP code: $HTTP_CODE"
if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ HTTP health check OK"
else
    echo "⚠️ HTTP health check returned $HTTP_CODE (may be normal if no /health endpoint)"
fi

echo "=== Verification Complete ==="
```

**Uso:**
```bash
# Verificar LiteLLM → wav2vec2
./verify-network.sh zappro-litellm wav2vec2 8201

# Verificar Traefik → OpenClaw
./verify-network.sh coolify-proxy openclaw 8080
```

---

### FASE 3: Smoke Test Templates

#### 3.1 Network Isolation Check (para todos os containers)

```bash
# Verificar se container X e Y partilham rede
check_shared_network() {
    local container_a="$1"
    local container_b="$2"

    local nets_a nets_b shared
    nets_a=$(docker inspect "$container_a" --format '{{json .NetworkSettings.Networks}}' 2>/dev/null | \
        python3 -c "import sys,json; nets=json.load(sys.stdin); print('\n'.join(nets.keys()))" || echo "")
    nets_b=$(docker inspect "$container_b" --format '{{json .NetworkSettings.Networks}}' 2>/dev/null | \
        python3 -c "import sys,json; nets=json.load(sys.stdin); print('\n'.join(nets.keys()))" || echo "")

    shared=""
    for net in $nets_a; do
        if echo "$nets_b" | grep -q "$net"; then
            shared="$net"; break
        fi
    done

    if [ -n "$shared" ]; then
        echo "✅ $container_a ↔ $container_b share network: $shared"
        return 0
    else
        echo "❌ $container_a ↔ $container_b NETWORK ISOLATED!"
        echo "   $container_a networks: $nets_a"
        echo "   $container_b networks: $nets_b"
        return 1
    fi
}
```

#### 3.2 Container → Host Service Check (para detectar AP-1)

```bash
# Testar se container consegue alcançar serviço nativo do host
check_host_service_reachable() {
    local container="$1"
    local host_port="$2"
    local description="${3:-host service}"

    # Este teste DEVERIA falhar se o serviço for nativo do host
    result=$(docker exec "$container" curl -sf -m 3 -o /dev/null -w "%{http_code}" "http://host.docker.internal:$host_port" 2>/dev/null || echo "000")

    if [ "$result" = "000" ]; then
        echo "✅ $description NOT reachable from container (expected for native host services)"
        return 0
    else
        echo "⚠️ $description reachable (http_code=$result) — ensure it's containerized!"
        return 1
    fi
}
```

---

### FASE 4: Containerization Standards

**REGRA DE OURO:** Todos os serviços que são consumidos por containers Docker **DEVEM** estar containerizados.

| Serviço | Consumido por | Containerizado? | Status |
|---------|-------------|----------------|--------|
| wav2vec2 STT | LiteLLM (container) | ✅ Sim | `zappro-wav2vec2` |
| Kokoro TTS | LiteLLM (container) | ✅ Sim | via LiteLLM container |
| Ollama (VL/LLM) | LiteLLM (container) | ✅ Sim | `10.0.1.1:11434` |
| LiteLLM | OpenClaw (container) | ✅ Sim | `zappro-litellm` |
| OpenClaw | Traefik (container) | ✅ Sim | `openclaw-qgtzrmi...` |
| Traefik | Cloudflare Tunnel | ✅ Sim | `coolify-proxy` |

**Checklist de containerização para novo serviço:**

- [ ] Serviço é consumido por outro container? → **DEVE** estar containerizado
- [ ] Serviço é nativo do host (Python/Node/etc)? → **MOVER** para container
- [ ] O container do consumidor está na mesma network que o target? → **VERIFICAR**
- [ ] Health check existe no container? → **ADICIONAR**
- [ ] `depends_on` com `condition: service_healthy` configurado? → **GARANTIR**

---

### FASE 5: Traefik Routing Checklist

**OBRIGATÓRIO** para qualquer novo serviço exposto via Traefik/Coolify:

- [ ] Container está a correr com labels Traefik (`traefik.enable=true`)
- [ ] Container está na **mesma network** que `coolify-proxy`
- [ ] Domain adicionado via Coolify UI (não manualmente)
- [ ] Health endpoint retorna 200
- [ ] Testado via Cloudflare Tunnel (não só localhost)
- [ ] DNS resolve para IP correcto

**Teste de routing completo:**
```bash
# 1. DNS resolve
nslookup openclaw.${HOST_IP}.sslip.io

# 2. Cloudflare Tunnel routing
curl -sf -m 10 -o /dev/null -w "%{http_code}" "${OPENCLAW_TUNNEL_URL}/"

# 3. Traefik → Backend
curl -sf -m 10 "http://localhost:80/ping"  # Traefik OK

# 4. Container network partilhada
docker inspect coolify-proxy --format '{{json .NetworkSettings.Networks}}' | python3 -c "import sys,json; print('Traefik networks:', list(json.load(sys.stdin).keys()))"
docker inspect openclaw-... --format '{{json .NetworkSettings.Networks}}' | python3 -c "import sys,json; print('OpenClaw networks:', list(json.load(sys.stdin).keys()))"
```

---

### FASE 6: GitOps Deployment Checklist

**OBRIGATÓRIO** antes de marcar deploy como "pronto":

```
ANTES DE ANUNCIAR "DEPLOY PRONTO"
├── [ ] Container está "Up (healthy)" no Coolify
├── [ ] curl https://<domain>/health → HTTP 200
├── [ ] curl https://<domain>/ → HTTP 200 ou 401 (não 502/504)
├── [ ] Smoke test passa
├── [ ] Gitea Action foi testado com push real
├── [ ] Cron jobs de auto-healer activos (se aplicável)
└── [ ] ZFS snapshot foi feito antes do deploy
```

---

## Ficheiros de Referência

| Incident | Ficheiro |
|----------|----------|
| wav2vec2 network isolation | `INCIDENT-2026-04-08-wav2vec2-network-isolation.md` |
| Perplexity GitOps gap | `INCIDENT-2026-04-08-perplexity-gitops-gap.md` |
| Traefik routing (08/04/2026) | `tasks/plan-traefik-coolify-research.md` |
| Voice pipeline smoke test | `tasks/smoke-tests/pipeline-openclaw-voice.sh` |

---

## Skills Relacionadas

| Skill | Ficheiro | Uso |
|-------|----------|-----|
| traefik-health-check | `docs/OPERATIONS/SKILLS/traefik-health-check.md` | Diagnóstico Traefik |
| traefik-route-tester | `docs/OPERATIONS/SKILLS/traefik-route-tester.md` | Teste de rotas |
| wav2vec2-health-check | `docs/OPERATIONS/SKILLS/wav2vec2-health-check.md` | STT health |
| liteLLM-health-check | `docs/OPERATIONS/SKILLS/liteLLM-health-check.md` | Proxy health |

---

## Registrado

**Data:** 2026-04-08
**Autor:** will + Claude Code
**Proxima revisão:** 2026-05-08 (+30 dias)
