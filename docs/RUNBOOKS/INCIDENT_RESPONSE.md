# Incident Response Runbook

**Severity:** P1/P2 | **Estimated Time:** 15-60 minutes

---

## Severity Definition

| Level | Criteria | Response Time |
|-------|----------|---------------|
| P1 | Full outage, data loss risk | 15 min |
| P2 | Service degradation | 1 hour |

---

## P1 — Full Outage

### 1. Immediate (0-5 min)

```bash
# Check if it's a tunnel issue
nexus-tunnel.sh list

# Check container status
docker ps

# Check service directly
ss -tlnp | grep <port>
```

### 2. Assess (5-10 min)

```bash
# Deep health check
nexus-investigate.sh all 3

# Check logs
docker logs <failing-service> --tail 100

# Check system resources
df -h
free -m
```

### 3. Communicate

```bash
# Create alert
nexus-alert.sh alert crit "Service down" "<service> is not responding"

# Note start time
date
```

### 4. Mitigate

```bash
# Restart service if safe
docker restart <service>

# Or restart all
docker restart $(docker ps -q)
```

### 5. Verify

```bash
nexus-investigate.sh all 3
```

---

## P2 — Degradation

### 1. Investigate (0-15 min)

```bash
nexus-investigate.sh <service> 3
docker logs <service> --tail 50
```

### 2. Create Alert

```bash
nexus-alert.sh alert warn "Degraded" "<service> slow response"
```

### 3. Monitor

```bash
nexus-alert.sh list
watch -n5 'nexus-investigate.sh <service> 3'
```

---

## Post-Incident

1. Document in this runbook
2. Resolve alert: `nexus-alert.sh resolve <alert-id>`
3. Update CHANGELOG.md
4. Schedule retro

---

## Contacts

| Role | Contact |
|------|---------|
| Platform Lead | @will |
| SRE On-Call | NEXUS auto-escalate |
