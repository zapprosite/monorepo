---
title: Disaster Recovery
description: Guia completo de restore from scratch para o homelab
created: 2026-05-03
spec: SPEC-210
rto: 30 minutes
rpo: 6 hours
---

# Disaster Recovery — Homelab zappro.site

## DR Scenario Matrix

| Scenario | Impact | RTO | Procedure |
|----------|--------|-----|-----------|
| A: Single container down | Service unavailable | 2min | Docker restart |
| B: Docker daemon crash | All containers down | 10min | Docker restart + compose up |
| C: Corrupted docker volume | Data loss (single service) | 15min | ZFS snapshot restore + container restart |
| D: Full NVMe failure | Complete data loss | 30min | ZFS restore from backup + redeploy |
| E: OS kernel panic | Server unreachable | 45min | Reboot + fsck + ZFS import |

---

## DR Procedure (Scenario D: Full NVMe Failure)

### 1. Hardware Assessment

```bash
# Verificar se NVMe está reconhecido
lsblk | grep nvme
dmesg | grep -i nvme | tail -20

# Se não reconhecido: reseat físico, verificar BIOS
# Se reconhecido mas com erros: tentar smartctl
sudo smartctl -a /dev/nvme0n1
```

### 2. ZFS Recovery

```bash
# Tentar importar pool ZFS
sudo zpool import

# Se pool visível mas não importado:
sudo zpool import -f tank

# Verificar integridade
sudo zpool status -v tank
sudo zfs list -t snapshot -r tank | tail -20
```

### 3. Restore from Last Snapshot

```bash
# Se pool está OK — rollback para snapshot mais recente completo
SNAPSHOT=$(zfs list -t snapshot -o name -s creation tank@backup-tank-backups 2>/dev/null | tail -1)

if [[ -n "$SNAPSHOT" ]]; then
  sudo zfs rollback -r "$SNAPSHOT"
else
  echo "No snapshots found — restoring from file backup"
fi
```

### 4. Restore Docker containers

```bash
# Reiniciar todos os containers via compose files
cd /srv/monorepo

# Containers via compose
docker compose -f /srv/ops/gitea/docker-compose.yml up -d
docker compose -f /srv/edge-tts/docker-compose.yml up -d
docker compose -f /srv/monorepo/services/docker-compose.yml up -d

# Monorepo compose files
for f in deployments/docker-compose.*.yml; do
  [[ "$f" =~ .prod.yml$ ]] && continue  # Skip prod — deploy separately
  docker compose -f "$f" up -d 2>/dev/null || true
done

# Production deploy (last)
docker compose -f deployments/docker-compose.prod.yml up -d
```

### 5. Verify All Services

```bash
# Run synthetic prober
bash /srv/monorepo/scripts/synthetic-prober.sh

# Check results
grep 'success.*1' /tmp/synthetic-prober.prom | wc -l
# Should return >= 10

# Check individual services
for svc in localhost:3300 localhost:8000 localhost:3000 localhost:11434 localhost:6333 localhost:8642; do
  timeout 2 bash -c "echo >/dev/tcp/${svc%:*}/${svc#*:}" 2>/dev/null && echo "UP: $svc" || echo "DOWN: $svc"
done
```

---

## DR Simulation

```bash
# Run dry-run DR without actually shutting down
bash /srv/monorepo/scripts/backup-verify.sh --report

# Verify ZFS snapshot integrity
zfs list -t snapshot -o name,creation -s creation tank/monorepo | tail -5

# Test restore to temp clone (non-destructive)
SNAPSHOT=$(zfs list -t snapshot -o name -s creation tank/monorepo | tail -1)
sudo zfs clone "$SNAPSHOT" tank/dr-test-temp
echo "Clone ready at /tank/dr-test-temp"
ls /tank/dr-test-temp/ | head -5
sudo zfs destroy tank/dr-test-temp
echo "DR simulation: PASS"
```

---

## Recovery Tools

| Tool | Location | Purpose |
|------|----------|---------|
| ZFS snapshots | `tank@backup-tank-backups-*` | Full system restore |
| File backups | `/srv/backups/` | tar.gz archives |
| compose files | `/srv/ops/docker/` | Unified compose definitions |
| Health checker | `scripts/auto-rollback.sh --check` | Service health verification |
| Rollback tool | `scripts/auto-rollback.sh` | Automated restore |
| Prober | `scripts/synthetic-prober.sh` | Service uptime validation |

---

## Emergency Contacts

| Role | Channel | Response |
|------|---------|----------|
| Hermes bot | Telegram `/incident` | Auto-diagnosis Tier 1 |
| System logs | `/var/log/syslog` | Root cause analysis |
| Docker logs | `docker logs <container>` | Application-level debugging |
| Prometheus | `http://localhost:9090/alerts` | Active alert state |
