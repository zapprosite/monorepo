# Skill: Monitoring Health Check

**Purpose:** Verificar salud completa da stack de monitoring (Grafana + Prometheus + Exporters)
**Complexity:** Low
**Risk:** Read-only (não modifica nada)
**When to Use:** Check regular de saúde, antes de changes, após incidentes

## Preflight Checklist

- [ ] Docker a correr: `docker ps`
- [ ] Acesso a port 3100 (Grafana), 9090 (Prometheus), 9100, 9835, 9250
- [ ] Permissão para ler logs e inspects

## Procedure

### 1. Status dos Containers

```bash
docker ps -a \
  --filter "name=grafana" \
  --filter "name=prometheus" \
  --filter "name=node-exporter" \
  --filter "name=nvidia-gpu-exporter" \
  --filter "name=cadvisor" \
  --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

**Expected:** Todos `Up` ou `Up (healthy)`

**FAIL states:**
- `Created` — container existe mas não arrancou
- `Exited` — container crashou
- `Up X seconds (health: starting)` — a inicializar, dar tempo

### 2. Health Endpoints

```bash
# Grafana
curl -s http://localhost:3100/api/health | python3 -c "import sys,json; d=json.load(sys.stdin); print('✅ Grafana OK' if d.get('status')=='OK' else '🔴 Grafana FAIL:', d)"

# Prometheus
curl -s http://localhost:9090/-/healthy | python3 -c "import sys; d=sys.stdin.read(); print('✅ Prometheus OK' if 'Healthy' in d else '🔴 Prometheus FAIL:', d[:100])"

# Node Exporter (host network)
curl -s http://localhost:9100/metrics 2>/dev/null | head -3 | python3 -c "import sys; d=sys.stdin.read(); print('✅ Node Exporter OK' if 'node_' in d else '🔴 Node Exporter FAIL')"

# nvidia-gpu-exporter
bash -c 'echo >/dev/tcp/localhost/9835' 2>/dev/null && echo "✅ nvidia-gpu-exporter:9835 OK" || echo "🔴 nvidia-gpu-exporter:9835 FAIL"

# cadvisor
curl -s http://localhost:9250/healthz 2>/dev/null | head -1 | python3 -c "import sys; d=sys.stdin.read(); print('✅ cadvisor OK' if 'ok' in d.lower() else '🔴 cadvisor FAIL')"
```

### 3. Redes Docker

```bash
# Verificar que todos os containers estão na mesma rede
for c in grafana prometheus nvidia-gpu-exporter cadvisor; do
  NET=$(docker inspect $c --format '{{range $n:=.NetworkSettings.Networks}}{{$n}}{{end}}' 2>/dev/null)
  echo "$c: $NET"
done
```

**Expected:** `grafana`, `prometheus`, `nvidia-gpu-exporter`, `cadvisor` todos partilham pelo menos uma network comum (`monitoring` ou `aurelia-net`)

**FAIL:** Se grafana está em network diferente de prometheus → datasource não resolve

### 4. Prometheus Targets

```bash
curl -s http://localhost:9090/api/v1/targets | python3 -c "
import json,sys
d=json.load(sys.stdin)
targets = d.get('data',{}).get('activeTargets',[])
print('PROMETHEUS TARGETS:')
for t in sorted(targets, key=lambda x: x['labels']['job']):
    err = t.get('lastError','')
    status = '✅' if t['health']=='up' else '🔴'
    err_txt = f' ({err[:60]})' if err else ''
    print(f'  {status} {t[\"labels\"][\"job\"]}: {t[\"health\"]}{err_txt}')
"
```

**Expected:** `nvidia-gpu`, `cadvisor` → UP; `node` → pode ser DOWN se host network tem problemas

**FAIL:** Se todos DOWN → Prometheus não está a fazer scrape

### 5. Volumes ZFS

```bash
df -h | grep -E "monitoring|grafana|prometheus" || echo "⚠️  Sem ZFS mount identificado"
ls -la /srv/data/monitoring/ 2>/dev/null
```

### 6. Cloudflare Tunnel

```bash
grep -i "monitor.zappro" /home/will/.cloudflared/config.yml 2>/dev/null && echo "✅ Tunnel configured" || echo "🔴 Tunnel não encontrado"
```

## Output Format

```
MONITORING STACK HEALTH CHECK — $(date -u '+%Y-%m-%d %H:%M UTC')
=====================================================
grafana:            ✅ Up 2h (port 3100:3000)
prometheus:         ✅ Up 3h (localhost:9090)
node-exporter:      ✅ Up 3h (host :9100)
nvidia-gpu-exporter: ⚠️ Up (port 9835)
cadvisor:           ✅ Up 3h (localhost:9250)

NETWORK ISOLATION:
  grafana:          monitoring,aurelia-net
  prometheus:       aurelia-net
  nvidia-gpu-exporter: monitoring,aurelia-net
  ← Todos OK (mesma network) ou dependências identificadas

PROMETHEUS TARGETS:
  ✅ nvidia-gpu: UP
  ✅ cadvisor: UP
  🔴 node-exporter: DOWN

VOLUMES:
  /srv/data/monitoring/grafana    ✅ (ZFS tank)
  /srv/data/monitoring/prometheus ✅ (ZFS tank)

CLOUDFLARE TUNNEL:
  ✅ monitor.zappro.site → localhost:3100

RESULTADO: 🔴 1 FALHA — node-exporter down
```

## Log

Cada execução regista em `/srv/ops/ai-governance/logs/monitoring-health-check.log`

```bash
echo "$(date -u '+%Y-%m-%d %H:%M') | monitoring-health-check | result: X failures" >> /srv/ops/ai-governance/logs/monitoring-health-check.log
```

## Retry/Escalation

Se FAIL encontrado:
1. Consultar `monitoring-diagnostic.md` para árvore de decisão
2. Se problema de container: `docker start <name>`
3. Se problema de network: `docker network connect <rede> <container>`
4. Após fix: re-executar health-check para confirmar

## See Also

- `monitoring-diagnostic.md` — árvore de decisão para falhas
- `monitoring-zfs-snapshot.md` — snapshot antes de changes
- `zfs-snapshot-and-rollback.md` — skill base de ZFS
