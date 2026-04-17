# ADR 20260403 — Sistema de Backup ZFS Snapshot

**Data:** 2026-04-03
**Status:** Ativo
**Autor:** will-zappro

## Contexto

Em 03/04/2026, verificou-se que:
1. O tunnel Cloudflare (`8c55fcb7`) estava obsoleto mas todos os DNS ainda apontavam para ele
2. 6 datasets críticos (infisical-db, infisical-redis, grafana, prometheus, redis, redis-opencode) NÃO estavam em ZFS — sem snapshot, sem backup
3. O cloudflared service estava inativo (dead) sem proteção watchdog
4. Não havia plano de recuperação documentado

## Decisões

### 1. ZFS como storage primário de backup
Todos os dados de serviços críticos devem residir em datasets ZFS do pool `tank`.

### 2. Sistema de snapshots automático
- **Frequência:** A cada 6 horas via `systemd timer`
- **Script:** `/srv/ops/scripts/backup-zfs-snapshot.sh`
- **Timer:** `backup-zfs-snapshot.timer`

### 3. Retenção
| Tipo | Período | Quantidade |
|------|---------|-----------|
| Diários | < 7 dias | 7 snapshots |
| Semanais | 8-30 dias | 4 snapshots |
| Mensais | > 30 dias | 6 snapshots |

### 4. Datasets cobertos
```
tank/data/n8n              → /srv/data/n8n
tank/data/n8n-postgres     → /srv/data/n8n-postgres
tank/data/qdrant           → /srv/data/qdrant
tank/data/grafana          → /srv/data/grafana
tank/data/prometheus        → /srv/data/prometheus
tank/data/infisical-db     → /srv/data/infisical-db
tank/data/infisical-redis  → /srv/data/infisical-redis
tank/data/coolify          → /srv/data/coolify

tank/data/aurelia-router   → /srv/data/aurelia-router
tank/docker-data           → /srv/docker-data
tank/monorepo             → /srv/monorepo
tank/models                → /srv/models (readonly)
tank/backups               → /srv/backups
```

## Restore Procedure
```bash
# Listar snapshots
sudo zfs list -t snapshot -r tank | grep backup

# Restaurar
sudo /srv/ops/scripts/restore-zfs-snapshot.sh <dataset> <snapshot>

# Exemplo: restaurar n8n
sudo /srv/ops/scripts/restore-zfs-snapshot.sh tank/data/n8n tank@backup-tank-data-n8n-20260403-120000
```

## Propriedades ZFS
Todos os datasets: `compression=zstd`, `atime=off`
