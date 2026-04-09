# Skill: verify-network

> **Versão:** 1.0.0
> **Data:** 2026-04-08
> **Autor:** will + Claude Code
> **Tags:** `network`, `docker`, `traefik`, `litellm`, `diagnostic`, `pipeline`

## Descrição

Script de verificação de rede para containers Docker do homelab. Executa checks de conectividade seguindo as regras do HOMELAB-SURVIVAL-GUIDE — especialmente:

- **Regra 2:** Docker bridge != host native services (nunca use processo nativo do host como backend)
- **Regra 3:** Testar a rota real, não a local (sempre de dentro do container)
- **Regra 6:** Network shared = Traefik consegue atingir
- **Regra 7:** Health check != rota funcional

## Uso

```bash
# Modo humano (default)
./verify-network.sh

# Modo JSON (para pipelines)
./verify-network.sh --json
```

## Prerequisites

```bash
# Ferramentas necessárias
docker       # Containers e networks
curl         # HTTP checks de dentro dos containers
python3      # Parsing JSON e escapes
md5sum       # Hashing para nomes de checks
```

## Container Names e Networks (Homelab Reality)

### Containers
| Variável | Valor |
|----------|-------|
| `TRAEFIK_CONTAINER` | `coolify-proxy` (Traefik) |
| `OPENCLAW_CONTAINER` | `openclaw-qgtzrmi6771lt8l7x8rqx72f` |
| `LITELLM_CONTAINER` | `zappro-litellm` |
| `WAV2VEC2_CONTAINER` | `zappro-wav2vec2` |

### Networks
| Variável | Valor |
|----------|-------|
| `NETWORK_QGTZRMI` | `qgtzrmi6771lt8l7x8rqx72f` |
| `NETWORK_ZAPPRO_LITE` | `zappro-lite_default` |
| `NETWORK_COOLIFY` | `coolify` |

### Endpoints Internos
| Rota | Destino |
|------|---------|
| `http://wav2vec2:8201` | wav2vec2 STT service |
| `http://10.0.1.1:11434` | Ollama LLM (host native — **AP-1 anti-pattern**) |

---

## Output Format

### Human Mode

```
NETWORK VERIFICATION — 2026-04-08 12:00 UTC
============================================================
✅ shared_network_coolify-proxy_openclaw-qgtzrmi6771lt8l7x8rqx72f shared: qgtzrmi6771lt8l7x8rqx72f
✅ tcp_zappro-litellm_wav2vec2_8201 connected to wav2vec2:8201
❌ shared_network_traefik_openclaw FAIL: no shared network
============================================================
OVERALL: FAIL
```

### JSON Mode (Pipeline Integration)

```json
{
  "timestamp": "2026-04-08T12:00:00Z",
  "overall_status": "FAIL",
  "checks": [
    {
      "name": "shared_network_coolify-proxy_openclaw-qgtzrmi6771lt8l7x8rqx72f",
      "status": "PASS",
      "detail": "shared: qgtzrmi6771lt8l7x8rqx72f"
    },
    {
      "name": "http_zappro-litellm_a1b2c3d4e5f6",
      "status": "FAIL",
      "detail": "expected [200] got 502 from http://wav2vec2:8201/health"
    }
  ]
}
```

**Exit code:** `0` = all checks pass, `1` = any check fails

---

## Check Functions

### `check_shared_network(container_a, container_b)`

Verifica se dois containers partilham alguma rede Docker.

**Regra aplicada:** HOMELAB-SURVIVAL-GUIDE Regra 6

```bash
check_shared_network "coolify-proxy" "openclaw-qgtzrmi6771lt8l7x8rqx72f"
# PASS: shared: qgtzrmi6771lt8l7x8rqx72f
# FAIL: no shared network
```

**Causa raiz comum quando falha:**
- Container não está na mesma network que Traefik
- Solução: Coolify UI → adicionar domain ao serviço (partilha a network)

---

### `check_tcp_connectivity(container, host, port)`

Testa conectividade TCP de um container para um host:porta.

**Regra aplicada:** HOMELAB-SURVIVAL-GUIDE Regra 2 (no host native services)

```bash
check_tcp_connectivity "zappro-litellm" "wav2vec2" "8201"
# PASS: connected to wav2vec2:8201
# FAIL: connection refused on 10.0.1.1:11434
```

**Nota:** Usa `curl --connect-timeout` de dentro do container para testar TCP.

---

### `check_http_from_container(container, url, expected_codes)`

Testa HTTP de dentro de um container — a rota real.

**Regra aplicada:** HOMELAB-SURVIVAL-GUIDE Regra 3 (testar rota real, não local)

```bash
check_http_from_container "zappro-litellm" "http://wav2vec2:8201/health" "200"
# PASS: 200 from http://wav2vec2:8201/health
# FAIL: expected [200] got 502 from http://wav2vec2:8201/health
```

**Anti-pattern que este check detecta:**

```bash
# ERRADO — testa do host, não da rota real
curl localhost:8201

# CERTO — testa de dentro do container (rota real)
docker exec zappro-litellm curl http://wav2vec2:8201/health
```

---

### `verify_litellm_routes()`

Verifica todas as rotas LiteLLM → backends:

1. LiteLLM → wav2vec2 (`http://wav2vec2:8201`)
2. LiteLLM → Ollama (`http://10.0.1.1:11434` — host native, **AP-1 anti-pattern**)

**Regra aplicada:** HOMELAB-SURVIVAL-GUIDE Regra 2

---

### `verify_traefik_routes()`

Verifica rotas Traefik → OpenClaw:

1. Shared network coolify-proxy ↔ openclaw
2. TCP connectivity Traefik → OpenClaw
3. HTTP health from Traefik to OpenClaw

**Regra aplicada:** HOMELAB-SURVIVAL-GUIDE Regras 6 e 7

---

## Phases of Verification

| Phase | Checks | Rules |
|-------|--------|-------|
| 1 | Shared networks | Rule 6 |
| 2 | LiteLLM routes | Rules 2, 3 |
| 3 | Traefik routes | Rules 6, 7 |
| 4 | wav2vec2 network | Rules 2, 6 |
| 5 | End-to-end HTTP | Rules 3, 7 |

---

## Interpreting Results

### All PASS

Sistema saudável — todos os containers conseguem comunicar.

### `shared_network_* FAIL`

**Problema:** Traefik não consegue atingir o container (redes diferentes).

**Solução:**
1. Verificar networks dos dois containers:
   ```bash
   docker inspect coolify-proxy --format '{{json .NetworkSettings.Networks}}'
   docker inspect openclaw-qgtzrmi6771lt8l7x8rqx72f --format '{{json .NetworkSettings.Networks}}'
   ```
2. Adicionar o container à network do Traefik via Coolify UI
3. Ou adicionar Traefik à network do container

### `tcp_*_10.0.1.1_* FAIL`

**Problema:** LiteLLM não consegue alcançar Ollama no host (AP-1 anti-pattern).

**Solução:** Containerizar o Ollama em vez de usar processo nativo do host.

### `http_*_wav2vec2_* FAIL`

**Problema:** wav2vec2 não responde ao LiteLLM.

**Checks em cadeia:**
1. wav2vec2 está a correr? `docker ps | grep wav2vec2`
2. LiteLLM e wav2vec2 partilham rede? `check_shared_network`
3. wav2vec2 health está OK? `docker exec zappro-wav2vec2 curl localhost:8201/health`
4. LiteLLM consegue ver wav2vec2? `docker exec zappro-litellm curl http://wav2vec2:8201/health`

### `traefik_local_ping FAIL`

**Problema:** Traefik não está a escutar em localhost:80.

**Solução:**
```bash
docker restart coolify-proxy
docker logs coolify-proxy --tail 50
```

---

## Integration with Pipelines

### Gitea Actions

```yaml
- name: Network Verification
  run: |
    docker run --rm \
      -v /var/run/docker.sock:/var/run/docker.sock \
      -v $(pwd)/docs/OPERATIONS/SKILLS/verify-network.sh:/verify-network.sh \
      alpine:latest \
      sh /verify-network.sh --json | tee network-report.json

- name: Fail on Network Errors
  if: runner.os == 'linux'
  run: |
    # Extract overall status
    STATUS=$(cat network-report.json | python3 -c "import sys,json; print(json.load(sys.stdin)['overall_status'])")
    if [ "$STATUS" != "PASS" ]; then echo "Network verification failed"; exit 1; fi
```

### Cron Smoke Test

```bash
# ~/.claude/scheduled_tasks.json entry
{
  "cron": "*/30 * * * *",
  "prompt": "Run /srv/monorepo/docs/OPERATIONS/SKILLS/verify-network.sh --json and alert if FAIL"
}
```

---

## Anti-Patterns Detected

| Anti-Pattern | Symptom | Detection |
|--------------|---------|-----------|
| Host process as backend | `tcp_*_10.0.1.1_* FAIL` | Ollama on host, not containerized |
| Test from host only | `http_* FAIL` but `curl localhost` works | Not testing real route |
| Health OK ≠ routing OK | container healthy but 502 from Traefik | End-to-end check fails |
| DNS OK ≠ service OK | Tunnel up but container missing | Container existence check |

---

## See Also

- `HOMELAB-SURVIVAL-GUIDE.md` — Regras de ouro para o homelab
- `traefik-health-check.md` — Diagnóstico completo do Traefik
- `litellm-health-check.md` — LiteLLM e rotas para backends
- `wav2vec2-health-check.md` — wav2vec2 STT service
- `docs/INCIDENTS/INCIDENT-2026-04-08-wav2vec2-network-isolation.md` — Incidente real
