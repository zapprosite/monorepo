# Health Check Runbook

**Severity:** P3 | **Estimated Time:** 5 minutes

---

## Pre-Check

```bash
# Context window
nexus-context-window-manager.sh status
```

---

## Service Health

```bash
# All services (depth 3 = deep)
nexus-investigate.sh all 3

# Expected output:
# Healthy: 9
# Unhealthy: 0
```

---

## Individual Checks

| Service | Command | Expected |
|---------|---------|----------|
| Gym | `nexus-investigate.sh gym 3` | ✅ HEALTHY |
| Hermes | `nexus-investigate.sh hermes 3` | ✅ HEALTHY |
| API | `nexus-investigate.sh api 3` | ✅ HEALTHY |
| Chat | `nexus-investigate.sh chat 3` | ✅ HEALTHY |
| LLM | `nexus-investigate.sh llm 3` | ✅ HEALTHY |
| Qdrant | `nexus-investigate.sh qdrant 3` | ✅ HEALTHY |
| Coolify | `nexus-investigate.sh coolify 3` | ✅ HEALTHY |
| Gitea | `nexus-investigate.sh git 3` | ✅ HEALTHY |
| PGAdmin | `nexus-investigate.sh pgadmin 3` | ✅ HEALTHY |

---

## Container Status

```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

---

## Tunnel Status

```bash
nexus-tunnel.sh list
```

---

## Alert Check

```bash
nexus-alert.sh list
```

---

## If Unhealthy

1. Note the service name
2. Check logs: `docker logs <service> --tail 50`
3. Check port: `ss -tlnp | grep <port>`
4. Escalate if P1/P2

---

## Sign-Off

```bash
# Log completion
echo "$(date) - Health check OK" >> /srv/logs/health-check.log
```
