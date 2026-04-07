---
name: Deploy Validate
description: Pre-deploy health validation
trigger: /dv
---

# Deploy Validate Skill

Validação completa antes de deploy.

## Pre-Deploy Checklist

### Health
- [ ] All services healthy
- [ ] Database migrations applied
- [ ] No failed jobs

### Dependencies
- [ ] Docker images pulled
- [ ] Config values correct
- [ ] Secrets available

### Backup
- [ ] ZFS snapshot created
- [ ] Previous state documented

### Smoke Tests
- [ ] All smoke tests pass
- [ ] API responds correctly
- [ ] No critical errors in logs

## Output

```markdown
## Deploy Validation

**Status:** READY | NOT_READY

### Health Check
| Service | Status | Notes |
|---------|--------|-------|
| api | ✅ | HTTP 200 |
| db | ✅ | 3 migrations applied |
| redis | ✅ | Connected |

### Validation Results
- [x] Health check passed
- [x] Smoke tests passed (8/8)
- [x] Snapshot created
- [ ] Secrets rotated

### Verdict
**NOT_READY** — Secrets not rotated
```

## Como Usar

```bash
/dv              # Validação completa
/dv --health     # Só health check
/dv --snapshot   # Só snapshot
```

## Regras

1. snapshot OBRIGATÓRIO antes de deploy
2. NOT_READY = não fazer deploy
3. Log todos os resultados
