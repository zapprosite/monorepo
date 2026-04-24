---
name: coolify-sre
description: SRE unificado para infraestrutura Coolify — monitoramento de containers, resource alerts, healing automático, incident diagnostics, deploy e health check. Consolida 5 skills Coolify anteriores.
user-invocable: true
trigger: cron-5min
allowed-tools:
  - Bash
  - Read
  - Write
paths:
  - /srv/monorepo/apps/**
  - /srv/ops/logs/**
  - /srv/ops/scripts/**
  - /home/will/.claude/skills/coolify-sre/**
version: 2.0.0
---

# Coolify SRE — Site Reliability Engineering Unificado

## Objetivo

Consolidar monitoramento, healing, resource tracking, diagnostics e deploy em uma skill SRE completa, eliminando 7 duplicações de crons e unificando 5 skills Coolify anteriores.

## Skills Consolidadas

| Skill Anterior                 | Funcionalidade                   | Agora Em                |
| ------------------------------ | -------------------------------- | ----------------------- |
| `coolify-auto-healer`          | Restart containers degraded/down | `coolify-sre heal`      |
| `coolify-resource-monitor`     | CPU/memory/disk alerts           | `coolify-sre resources` |
| `coolify-incident-diagnostics` | Diagnóstico de incidentes        | `coolify-sre diagnose`  |
| `coolify-deploy-trigger`       | Deploy via API                   | `coolify-sre deploy`    |
| `coolify-health-check`         | Health endpoints                 | `coolify-sre health`    |
| `coolify-rollback`             | Rollback de deploy               | `coolify-sre rollback`  |
| `coolify-access`               | API integration                  | Config compartilhado    |

## Comandos

```bash
# Monitoramento completo (substitui 4 crons duplicados)
claude -p "/coolify-sre monitor"

# Healing automático (substitui auto-healer standalone)
claude -p "/coolify-sre heal"

# Resource monitor (substitui resource-monitor standalone)
claude -p "/coolify-sre resources"

# Diagnóstico de incidente
claude -p "/coolify-sre diagnose perplexity-agent"

# Health check pós-deploy
claude -p "/coolify-sre health"

# Deploy de app
claude -p "/coolify-sre deploy perplexity-agent"

# Rollback
claude -p "/coolify-sre rollback perplexity-agent"

# Status geral (1 comando = todo o SRE)
claude -p "/coolify-sre status"
```

## Configuração

### .env (Obrigatório)

```bash
# No diretório do projeto ou em /srv/monorepo/.env
source .env

COOLIFY_API_KEY=your-coolify-api-key
COOLIFY_URL=http://127.0.0.1:8000
```

### Thresholds Configuráveis

| Resource                   | Warning | Critical | Action         |
| -------------------------- | ------- | -------- | -------------- |
| CPU %                      | 70%     | 90%      | Log + alert    |
| Memory %                   | 75%     | 90%      | Log + alert    |
| Disk %                     | 80%     | 95%      | Log + alert    |
| Container status: degraded | -       | -        | Auto-restart   |
| Container status: down     | -       | -        | Auto-restart   |
| Container status: stopped  | -       | -        | Auto-start     |
| Health check: fail 3x      | -       | -        | Alert Telegram |

### Apps Monitoradas (Whitelist)

```python
COOLIFY_APPS = [
    "qdrant",         # Active
    "",            # IMMUTABLE — auto-restart only
    "perplexity-agent", # Active
]

DOCKER_CONTAINERS = [
    "zappro-litellm",        # PINNED
    "zappro-litellm-db",     # PINNED
    "zappro-wav2vec2",       # PINNED (KIT PROTECTED)
    "zappro-wav2vec2-proxy", # PINNED
    "zappro-tts-bridge",    # PINNED (KIT PROTECTED)
    "zappro-",        # PINNED (KIT PROTECTED)
    "zappro-redis",          # Active
    "coolify-proxy",         # IMMUTABLE — never touch
    "cloudflared",           # IMMUTABLE — never touch
]
```

### Health Endpoints

| App              | URL                                    | Expected   |
| ---------------- | -------------------------------------- | ---------- |
| LiteLLM          | `http://localhost:4000/health`         | 200 or 401 |
| wav2vec2         | `http://localhost:8201/health`         | 200        |
| TTS Bridge       | `http://localhost:8013/health`         | 200        |
| Kokoro           | `http://localhost:8012/health`         | 200        |
| perplexity-agent | `http://localhost:4004/_stcore/health` | 200        |
| Qdrant           | `http://localhost:6333/health`         | 200        |
| Coolify          | `http://localhost:8000/api/health`     | 200        |

## Fluxo: Monitor (Cron Unificado)

Substitui os seguintes crons duplicados:

| Cron Anterior        | Schedule | Problema    |
| -------------------- | -------- | ----------- |
| coolify-auto-healer  | \*/5     | OK          |
| resource-monitor     | \*/15    | Substituído |
| homelab-health-check | \*/15    | Substituído |
| tunnel-health-check  | \*/15    | Substituído |
| smoke-tunnel.sh      | \*/30    | Substituído |

**Novo cron unificado:**

```
*/5 * * * *  /srv/monorepo/.claude/skills/coolify-sre/scripts/sre-monitor.sh
```

### Fluxo do Script

```
1. Load COOLIFY_API_KEY from .env
2. Check Coolify apps status via API
3. Check Docker containers status
4. Check HTTP health endpoints
5. Check resource usage (CPU, memory, disk)
6. Auto-heal degraded/down containers (whitelist only)
7. Log results to /srv/ops/logs/sre-monitor.log
8. Alert via Telegram if critical
```

## Governance (CRÍTICO)

### Serviços IMMUTABLE — NUNCA Reiniciar

| Container     | Ação Permitida        | Ação Proibida               |
| ------------- | --------------------- | --------------------------- |
| coolify-proxy | Verificar status only | Reiniciar, parar, modificar |
| cloudflared   | Verificar status only | Reiniciar, parar, modificar |
| coolify-db    | Verificar status only | Reiniciar, parar, modificar |
| prometheus    | Verificar status only | Reiniciar, parar, modificar |
| grafana       | Verificar status only | Reiniciar, parar, modificar |
| loki          | Verificar status only | Reiniciar, parar, modificar |
| alertmanager  | Verificar status only | Reiniciar, parar, modificar |
|            | Auto-restart only     | Modificar config, remover   |

### Serviços PINNED — Auto-restart Only (requer MASTER_PASSWORD para config change)

| Container         | Auto-restart? | Config Change?        |
| ----------------- | ------------- | --------------------- |
| zappro-     | YES           | NEVER (KIT PROTECTED) |
| zappro-wav2vec2   | YES           | NEVER (KIT PROTECTED) |
| zappro-tts-bridge | YES           | NEVER (KIT PROTECTED) |
| zappro-litellm    | YES           | NEVER (LOCKED)        |

## Logs

| Log              | Local                               | Rotação |
| ---------------- | ----------------------------------- | ------- |
| SRE Monitor      | `/srv/ops/logs/sre-monitor.log`     | 7 dias  |
| Healing Actions  | `/srv/ops/logs/healing.log`         | 30 dias |
| Resource Alerts  | `/srv/ops/logs/resource-alerts.log` | 7 dias  |
| Incident Reports | `/srv/ops/logs/incidents/`          | 90 dias |

## Alerting

Se auto-heal falhar após 2 tentativas:

1. Log em `healing.log` com detalhe
2. Telegram notification (se GOTIFY_WEBHOOK_URL configurado)
3. Gotify push (se GOTIFY_URL configurado)
4. Marcar container como `NEEDS_MANUAL_INTERVENTION` no log

## Referências

- Coolify API v1: https://coolify.io/docs/api
- SPEC-009: Voice Pipeline Governance (IMMUTABLE)
- PINNED-SERVICES.md: Service classification
- GUARDRAILS.md: Forbidden operations
- APPROVAL_MATRIX.md: Operation approvals
