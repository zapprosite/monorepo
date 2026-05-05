---
title: Restore Procedures
description: Passo-a-passo para restore de cada tipo de backup
created: 2026-05-03
spec: SPEC-210
---

# Restore Procedures

## 1. ZFS Snapshot Restore

### 1.1 Restore monorepo de snapshot

```bash
# Listar snapshots disponíveis
zfs list -t snapshot -o name,creation -s creation tank/monorepo

# Restore para estado anterior (ROLLBACK — DESTRUTIVO, perde mudanças desde o snapshot)
sudo zfs rollback tank/monorepo@backup-tank-backups-20260503-030003

# OU restore para um clone temporário (NÃO-destrutivo)
sudo zfs clone tank/monorepo@backup-tank-backups-20260503-030003 tank/monorepo-restored
# Verificar conteúdo: ls /tank/monorepo-restored/
# Copiar arquivos necessários manualmente
# Limpar: sudo zfs destroy tank/monorepo-restored
```

### 1.2 Restore docker-data de snapshot

```bash
# Listar snapshots
zfs list -t snapshot -o name,creation -s creation tank/docker-data

# Clone para diretório temporário
sudo zfs clone tank/docker-data@backup-tank-backups-20260503-030003 tank/docker-data-restored
ls /tank/docker-data-restored/
```

### 1.3 Restore Qdrant de snapshot

```bash
zfs list -t snapshot -o name,creation -s creation tank/qdrant
sudo zfs clone tank/qdrant@backup-qdrant-20260503-030002 tank/qdrant-restored
```

---

## 2. Qdrant Vector Database Restore

```bash
# Snapshot ZFS + restore do diretório de dados
SNAPSHOT=$(zfs list -t snapshot -o name -s creation tank/qdrant | tail -1)
echo "Latest Qdrant snapshot: $SNAPSHOT"

# Restore via clone
sudo zfs clone "$SNAPSHOT" tank/qdrant-restore-temp

# Parar Qdrant
docker stop zappro-qdrant

# Copiar dados do snapshot para diretório ativo
sudo rsync -av /tank/qdrant-restore-temp/ /srv/data/qdrant/

# Reiniciar Qdrant
docker start zappro-qdrant

# Verificar
curl -s http://localhost:6333/collections | python3 -m json.tool | head -10

# Limpar clone
sudo zfs destroy tank/qdrant-restore-temp
```

---

## 3. File Backup Restore (tar.gz)

```bash
# Listar backups disponíveis
ls -la /srv/backups/*.tar.gz

# Restore de backup específico
BACKUP_FILE="/srv/backups/monorepo-backup-20260503.tar.gz"

# Verificar conteúdo antes de extrair
tar -tzf "$BACKUP_FILE" | head -20

# Extrair para diretório temporário
mkdir -p /tmp/restore-test
tar -xzf "$BACKUP_FILE" -C /tmp/restore-test

# Verificar integridade
ls -la /tmp/restore-test/

# Cleanup
rm -rf /tmp/restore-test
```

---

## 4. Gitea Restore

```bash
# Backup está em /srv/backups/
ls -la /srv/backups/gitea-*

# Restore:
# 1. Parar Gitea: docker stop gitea
# 2. Restore /srv/data/gitea do backup
# 3. Iniciar Gitea: docker start gitea
# 4. Verificar: curl -s http://localhost:3300/api/v1/version
```

---

## 5. Full Disaster Recovery (from Docker state)

### 5.1 Restore completo de containers

```bash
# 1. Listar todos os snapshots disponíveis
zfs list -t snapshot -o name,creation -s creation tank

# 2. Escolher o snapshot mais recente completo
# Formato: tank@backup-tank-backups-YYYYMMDD-HHMMSS

# 3. Restore completo (DESTRUTIVO):
sudo zfs rollback -r tank@backup-tank-backups-20260503-030003

# 4. Reiniciar todos os containers
# Monorepo deploy stack:
docker compose -f /srv/monorepo/docker-compose.yml up -d
# (adicionar outros compose files conforme necessário)

# 5. Verificar serviços
bash /srv/monorepo/scripts/synthetic-prober.sh 2>/dev/null || \
  for svc in localhost:3300 localhost:8000 localhost:3000 localhost:11434 localhost:6333 localhost:8642; do
    timeout 2 bash -c "echo >/dev/tcp/${svc%:*}/${svc#*:}" 2>/dev/null && echo "UP: $svc" || echo "DOWN: $svc"
  done
```

---

## 6. Verify Script (Automated)

```bash
# Rodar verificação completa de restore
bash /srv/monorepo/scripts/backup-verify.sh --report
```

Agendado via cron: domingo 10:00 (Hermes crontab)

---

## Recovery Objectives

| Metric | Value |
|--------|-------|
| **RTO** (Recovery Time Objective) | 30 minutos |
| **RPO** (Recovery Point Objective) | 6 horas |
| **Snapshot frequency** | Diário 03:00 |
| **Backup retention** | ZFS snapshots — por política de retenção ZFS |
| **Offsite backup** | Não implementado (ver SPEC-210 avaliação) |
