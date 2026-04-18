# P2 — Service Degraded Runbook

> **Severity:** P2 — WARNING
> **Definition:** Service available but performance/reliability degraded
> **Escalation:** Within 1 hour

## Symptoms

- High latency (>2x normal p95)
- Elevated error rate (HTTP 4xx > 5%)
- Intermittent failures
- Resource exhaustion (RAM/CPU > 80%)

## Diagnosis

```bash
# Check resource usage
docker stats --no-stream

# Check latency
curl -s -w "%{time_total}s" http://localhost:{PORT}/health -o /dev/null

# Check error rates
grep -c "ERROR" /var/log/{service}.log | tail -5
```

## Actions

### High Latency

```bash
# Restart the service (clears in-memory state)
docker compose -f apps/{app}/docker-compose.yml restart

# Check downstream dependencies
curl -s http://localhost:6333/health   # Qdrant
curl -s http://localhost:11434/api/tags # Ollama
```

### Resource Exhaustion

```bash
# If memory pressure: restart service
docker compose -f apps/{app}/docker-compose.yml restart

# If disk pressure: clean up
docker system prune -f --volumes
```

### Elevated Errors

```bash
# Check logs
docker logs {container} --tail 50 | grep -i error

# Check DLQ (orchestrator)
ls -la .claude/skills/orchestrator/dlq/
cat .claude/skills/orchestrator/dlq/*.json
```

## Escalation

If not resolved within 1 hour → escalate to P1

## Post-Incident

- Log incident with metrics snapshot
- Identify root cause (often: downstream dependency, memory leak, config drift)
