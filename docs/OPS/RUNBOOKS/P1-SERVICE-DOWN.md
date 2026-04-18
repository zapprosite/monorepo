# P1 — Service Down Runbook

> **Severity:** P1 — CRITICAL
> **Definition:** Service completely unavailable for >5 minutes
> **Escalation:** Immediate — wake on-call

## Symptoms

- Service returns HTTP 5xx or no response
- Health check fails: `curl -s http://localhost:{PORT}/health` returns non-200
- User reports complete outage

## Immediate Actions (First 5 Minutes)

### 1. Identify affected service

```bash
# Check health endpoints
curl -s http://localhost:8642/health   # Hermes Gateway
curl -s http://localhost:4002/health   # AI Gateway
curl -s http://localhost:6333/health   # Qdrant
curl -s http://localhost:11434/api/tags # Ollama

# Check Docker status
docker ps --format "table {{.Names}}\t{{.Status}}"
```

### 2. Attempt restart (if container is running but unhealthy)

```bash
# Restart specific container
docker compose -f apps/{app}/docker-compose.yml restart

# Or use the health-check script
bash scripts/health-check.sh {app}
```

### 3. Check logs for root cause

```bash
# Docker logs
docker logs {container_name} --tail 100 -f

# Check orchestrator DLQ
cat .claude/skills/orchestrator/dlq/*.json
```

### 4. If restart fails — escalate immediately

```bash
# Capture state for review
docker logs {container_name} > /tmp/{container_name}-$(date +%Y%m%d_%H%M%S).log
echo "Log captured to /tmp/{container_name}-*.log"
```

## Rollback (if recent deployment is the cause)

```bash
# Check recent deployments
docker images | grep {app}
git log --oneline -10

# Rollback to previous image version
docker compose -f apps/{app}/docker-compose.yml pull {previous_tag}
docker compose -f apps/{app}/docker-compose.yml up -d
```

## Escalation Path

1. **Minute 0-5:** On-call attempts restart, check logs
2. **Minute 5+:** Escalate to team lead
3. **If data corruption suspected:** Stop write operations, escalate to data team

## Recovery Verification

```bash
# Confirm service is healthy
curl -s http://localhost:{PORT}/health | jq .status

# Run smoke test
bash smoke-tests/smoke-{service}.sh
```

## Post-Incident

- Document in incident log with timeline
- Update runbook if gap found
- Review Prometheus metrics for early warning signals
