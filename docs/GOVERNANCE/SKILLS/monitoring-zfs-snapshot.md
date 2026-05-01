# Skill: Monitoring ZFS Snapshot

**Purpose:** Safe snapshot creation before Grafana/Prometheus/exporter changes
**Complexity:** Medium
**Risk:** Medium (snapshot não perde dados, mas restore destrói changes)
**When to Use:** Antes de upgrade, antes de config changes, antes de restart massivo

## When to Use

- Antes de upgrade do Grafana ou Prometheus
- Antes de modificar `prometheus.yml` ou docker-compose.yml
- Antes de adicionar/remover exporters
- Antes de restartar múltiplos containers da stack

## Preflight Checklist

- [ ] Pool ZFS OK: `zpool status tank`
- [ ] Espaço livre >10%: `df -h /srv`
- [ ] Services OK: `docker ps` (saber estado antes)
- [ ] Plano de rollback se change falhar

## Procedure: Create Snapshot

### 1. Criar Snapshot

```bash
# Formato: tank@pre-monitoring-YYYYMMDD-HHMMSS-description
SNAPSHOT="tank@pre-monitoring-$(date +%Y%m%d-%H%M%S)-config-change"
sudo zfs snapshot -r "$SNAPSHOT"
echo "Snapshot created: $SNAPSHOT"
```

### 2. Verificar

```bash
zfs list -t snapshot | grep pre-monitoring
```

### 3. Documentar

```bash
echo "$(date '+%Y-%m-%d %H:%M') | Snapshot: $SNAPSHOT | Motivo: $MOTIVO" >> /srv/ops/ai-governance/logs/monitoring-snapshots.log
```

## Datasets da Monitoring Stack

```bash
# Identificar datasets
zfs list -r tank | grep monitoring

# datasets típicos:
# tank/data/monitoring/grafana
# tank/data/monitoring/prometheus
# (snapshots -r inclui todos os descendentes)
```

## Procedure: Rollback

**WARNING:** Rollback destrói TODAS as mudanças desde o snapshot.

### 1. Parar services

```bash
docker stop grafana prometheus nvidia-gpu-exporter 2>/dev/null
docker stop cadvisor node-exporter 2>/dev/null
```

### 2. Rollback

```bash
# Sem -r: apenas o dataset específico
sudo zfs rollback -r "$SNAPSHOT"

# Verificar
zfs list -t snapshot | grep pre-monitoring
```

### 3. Reiniciar

```bash
cd /srv/apps/monitoring
docker compose up -d
docker ps
```

### 4. Validar

```bash
# Health check rápido
curl -s http://localhost:3100/api/health
curl -s http://localhost:9090/-/healthy

# Prometheus targets
curl -s http://localhost:9090/api/v1/targets | python3 -c "
import json,sys
d=json.load(sys.stdin)
for t in d.get('data',{}).get('activeTargets',[]):
    print(f'{t[\"labels\"][\"job\"]}: {t[\"health\"]}')"
```

## Cleanup

Após mudança bem-sucedida:

```bash
# Listar snapshots antigos
zfs list -t snapshot | grep pre-monitoring

# Destruir snapshot antigo (opcional — não ocupa muito espaço)
sudo zfs destroy tank@pre-monitoring-20260316-140000-config-change
```

## Validation Checklist

- [ ] docker ps mostra todos containers Up
- [ ] Grafana responde em localhost:3100
- [ ] Prometheus targets UP (exceto node se host network)
- [ ] Dashboard Grafana carrega dados
- [ ] Cloudflare tunnel OK

## Risk Assessment

| Quando | Risco |
|--------|-------|
| Upgrade simples (docker pull) | Baixo |
| Config change (prometheus.yml) | Baixo |
| Stack recreate (docker compose down/up) | Médio |
| Restartall containers | Médio |

**Alto Risco:** Se fizeres rollback durante escrita ao disco do Prometheus — podes perder métricas recentes.

## See Also

- `monitoring-health-check.md` — verificar saúde após change
- `monitoring-diagnostic.md` — se algo falhar após change
- `zfs-snapshot-and-rollback.md` — skill base ZFS para contexto completo
