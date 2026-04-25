---
name: Saude
description: Verifica status do sistema — servicos, health checks, dependencias
trigger: /saude, health check, system status, is it running, status
version: 1.0.0
deprecated: false
---

# Saude Skill

Verifica status do sistema. Health checks em servicos, APIs, e dependencias.

## Quando Usar

- Apos deploy para confirmar que tudo funciona
- Quando utilizador reporta problema
- Check pre-commit ou pre-deploy
- Monitoramento rapido ("sistema esta funcionando?")

## O que faz

1. **Health checks** — Servicos principais (API, DB, Cache)
2. **Connectivity** — Testa endpoints internos
3. **Dependencies** — Verifica terceiros (external APIs)
4. **Resources** — CPU, RAM, Disk basics
5. **Recent errors** — Logs dos ultimos minutos

## Como Executar

```bash
/saude
/saude --verbose
/saude --service api,db
```

## Output

```markdown
## System Health Check — {timestamp}

### Core Services
| Service | Status | Latency | Notes |
|---------|--------|---------|-------|
| API     | ✅ UP  | 45ms    | - |
| DB      | ✅ UP  | 12ms    | - |
| Cache   | ✅ UP  | 3ms     | - |
| Queue   | ⚠️ SLOW | 890ms   | Retry spike |

### External Dependencies
| Provider | Status | Response |
|----------|--------|----------|
| OpenAI   | ✅ UP  | 200 OK   |
| Stripe   | ✅ UP  | 200 OK   |
| S3       | ✅ UP  | 200 OK   |

### Resources
- CPU: 34% used
- RAM: 2.1GB / 8GB
- Disk: 45% used

### Recent Logs (Last 5 min)
```
[ERROR] api - Connection timeout to queue
[WARN]  db  - Slow query (>1s): SELECT * FROM events
[INFO]  cache - Cache miss rate: 23%
```

---

### Verdict: ⚠️ DEGRADED
**Issues:** 1 error, 1 slow service
**Action:** Monitor queue retry patterns
```

## Health Check Types

| Type | Command | What it tests |
|------|---------|---------------|
| HTTP | `curl -sf /health` | Endpoint returns 200 |
| DB | `pg_isready` | PostgreSQL responds |
| Redis | `redis-cli ping` | Redis responds PONG |
| Custom | `scripts/health.sh` | Script exit code |

## Bounded Context

**Faz:**
- Health checks em servicos
- Verificacao de dependencias
- Reporting de status

**Nao faz:**
- Auto-healing (use `/autopilot` ou runbooks)
- Alerting (use PagerDuty/Grafana)
- Restart de servicos (requer aprovacao)
