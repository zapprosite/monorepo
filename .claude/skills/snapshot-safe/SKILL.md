---
name: Snapshot Safe
description: ZFS snapshot com checklist pré-destruição
trigger: /ss
---

# Snapshot Safe Skill

Cria snapshot ZFS antes de operações destrutivas.

## Pre-Flight Checklist

Antes de qualquer operação destrutiva:

- [ ] Backup de dados críticos
- [ ] snapshot ZFS criado
- [ ]Previous snapshot documentado
- [ ] Rollback procedure documentada
- [ ] Team notificado

## Snapshot Commands

```bash
# Criar snapshot
zfs snapshot tank/data@pre-deploy-$(date +%Y%m%d-%H%M%S)

# Listar snapshots
zfs list -t snapshot -r tank

# Rollback
zfs rollback tank/data@PREVIOUS-SNAPSHOT
```

## Output

```markdown
## Snapshot Safe Report

**Action:** Deploy
**Timestamp:** YYYY-MM-DD HH:mm

### Pre-Flight
- [x] Backup: Completed
- [x] snapshot: Created (tank/data@pre-deploy-20260407-120000)
- [x] Rollback: tank/data@pre-deploy-20260407-115959

### Snapshot
```
tank/data@pre-deploy-20260407-120000
Created: 2026-04-07 12:00:00
Used: 1.2GB
```

### Rollback Command
```bash
zfs rollback tank/data@pre-deploy-20260407-120000
```

### Team Notified
- [x] Slack: #deployments
```

## Como Usar

```bash
/ss deploy         # Pre-deploy snapshot
/ss backup         # Backup snapshot
/ss list           # List snapshots
/ss rollback SNAPSHOT # Rollback to snapshot
```

## Cron

Executa automaticamente antes de operações críticas.

## Regras

1. snapshot OBRIGATÓRIO antes de destruir dados
2. Sempre documentar rollback command
3. snapshots são automaticamente deletados após 30 dias
