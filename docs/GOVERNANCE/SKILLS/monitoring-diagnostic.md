# Skill: Monitoring Diagnostic

**Purpose:** Diagnóstico step-by-step quando Grafana ou Prometheus falham
**Complexity:** Medium
**Risk:** Read-only (não modifica — sugere commands)
**When to Use:** `codex-host "diagnosticar monitoring"`, health-check reportou falhas, monitor.zappro.site não carrega

## Decision Tree

```
PROBLEMA: monitor.zappro.site não funciona
│
├─ SINTOMA: Dashboard vazio ou "No data"
│  │
│  ├─ 1. Grafana a correr?
│  │     docker ps | grep grafana
│  │     Se Created/Exited → IR PARA A
│  │     Se Up → CONTINUAR
│  │
│  ├─ 2. Datasource Prometheus a responder?
│  │     curl -s http://localhost:3100/api/ds/query \
│  │       -u admin:$GRAFANA_PASS \
│  │       -H "Content-Type: application/json" \
│  │       -d '{"queries":[{"expr":"up","refId":"A"}],"from":"now-1h","to":"now"}'
│  │     Se frames=0 ou error → datasource não resolve → IR PARA D
│  │
│  ├─ 3. Prometheus a fazer scrape?
│  │     curl -s http://localhost:9090/api/v1/query?query=up
│  │     Se empty → Prometheus não scrapeia → IR PARA B
│  │
│  ├─ 4. Cloudflare Access a bloquear?
│  │     curl -sI https://monitor.zappro.site
│  │     Se 302 para cloudflareaccess.com → Access bloqueia
│  │     → Fazer login em https://zappro.cloudflareaccess.com
│  │
│  └─ 5. Logs Grafana
│        docker logs grafana --tail=50 | grep -iE "error|warn|fail"
│
├─ SINTOMA: Prometheus targets todos DOWN
│  │
│  ├─ 1. Prometheus a correr?
│  │     docker ps | grep prometheus
│  │
│  ├─ 2. Rede do Prometheus?
│  │     docker inspect prometheus --format '{{range $n:=.NetworkSettings.Networks}}{{$n}} {{end}}'
│  │     Esperado: `monitoring` (mesma rede dos exporters)
│  │     Se `aurelia-net` ou outra → network mismatch
│  │
│  ├─ 3. Exporters a responder diretamente?
│  │     curl http://localhost:9100/metrics 2>/dev/null | head -3  # node-exporter
│  │     curl http://localhost:9835/metrics 2>/dev/null | grep nvidia  # nvidia-gpu-exporter
│  │     curl http://localhost:9250/metrics 2>/dev/null | head -3  # cadvisor
│  │
│  ├─ 4. Config prometheus.yml correto?
│  │     docker exec prometheus cat /etc/prometheus/prometheus.yml
│  │     Jobs devem ter: nvidia-gpu, cadvisor, node (host.docker.internal)
│  │
│  └─ 5. Verificar nvidia-gpu-exporter started
│        docker ps -a | grep nvidia-gpu
│        Se Created → docker start nvidia-gpu-exporter
│
└─ SINTOMA: Login Google OAuth erro 400
   │
   ├─ 1. Redirect URI no Google Console
   │     Deve ser: https://monitor.zappro.site/login/google
   │     Sem barra final
   │
   ├─ 2. GF_SERVER_ROOT_URL
   │     docker exec grafana env | grep GF_SERVER_ROOT_URL
   │     Esperado: https://monitor.zappro.site
   │
   └─ 3. OAuth vars todas definidas?
         docker exec grafana env | grep GF_AUTH_GOOGLE
```

---

## A. Container Created-not-Started

**Causa comum:** `docker compose up` criou container mas não iniciou, ou `docker create` sem `docker start`

```bash
# Identificar
docker ps -a | grep -E "Created|Exit"

# Para cada container Created:
docker start <nome>

# Verificar
docker ps | grep <nome>

# Se nvidia-gpu-exporter:
docker start nvidia-gpu-exporter
curl http://localhost:9835/metrics | head -5

# Verificar CDI GPU
nvidia-smi --query-gpu=memory.used,memory.free --format=csv
```

---

## B. Container Exited (Crashed)

```bash
# Identificar
docker ps -a | grep Exited

# Ver logs
docker logs <container> --tail=50

# Causas comuns:
# - nvidia-gpu-exporter: GPU CDI não disponível
# - cadvisor: privileged ou /dev/kmsg
# - prometheus: config volume mount quebrado

# Recriar (último recurso):
docker rm <container>
cd /srv/apps/monitoring
docker compose up -d <service>
```

---

## C. Network Mismatch

**Causa mais comum:** container criado com `docker run` manual ficou em network diferente

```bash
# Identificar redes de cada container
for c in grafana prometheus nvidia-gpu-exporter cadvisor; do
  docker inspect $c --format "{{.Name}}: {{range $n:=.NetworkSettings.Networks}}{{$n}} {{end}}\n"
done
```

**Solução:**
```bash
# Se grafana está em 'monitoring' mas prometheus em 'aurelia-net':
docker network connect aurelia-net grafana

# Ou: mover todos para a mesma network
docker network connect monitoring prometheus
```

**Se nada funciona:**
```bash
# Reset completo da stack
cd /srv/apps/monitoring
docker compose down
docker compose up -d
```

---

## D. Datasource Prometheus Não Resolve

```bash
# Testar resolução DNS do Prometheus dentro do container Grafana
docker exec grafana getent hosts prometheus

# Testar conectividade
docker exec grafana wget -qO- http://prometheus:9090/-/healthy

# Se "bad address" → DNS não resolve
# Solução: garantir que estão na mesma Docker network
docker network connect monitoring prometheus
docker restart grafana
```

---

## E. Grafana OAuth Google 400

```bash
# Verificar variáveis OAuth no container
docker exec grafana env | grep GF_AUTH_GOOGLE

# GF_AUTH_GOOGLE_ENABLED deve ser true
# GF_SERVER_ROOT_URL deve ser https://monitor.zappro.site

# Verificar root_url
docker exec grafana grafana cli general --homepath 2>/dev/null || true
docker exec grafana cat /etc/grafana/grafana.ini | grep root_url || true
```

---

## Quick Fix Reference

| Problema | Fix |
|----------|-----|
| nvidia-gpu-exporter Created | `docker start nvidia-gpu-exporter` |
| prometheus não comunica com exporter | `docker network connect monitoring prometheus` |
| Grafana não resolve Prometheus | `docker network connect aurelia-net grafana` |
| Cloudflare Access bloqueia | Login em `zappro.cloudflareaccess.com` |
| Dashboard sem dados | `docker restart grafana` após fix de rede |
| Prometheus targets DOWN | `docker restart prometheus` + verificar exporters |

## Log

Cada sessão regista em `/srv/ops/ai-governance/logs/monitoring-diagnostic.log`

## See Also

- `monitoring-health-check.md` — verificação regular
- `monitoring-zfs-snapshot.md` — snapshot antes de changes
