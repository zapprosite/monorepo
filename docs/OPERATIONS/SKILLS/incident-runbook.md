# Incident Response Runbook

**Skill:** incident-runbook
**Description:** Structured incident response for homelab — diagnose and resolve outages systematically
**Tags:** incident, triage, homelab, traefik, docker, networking
**Runtime:** Agent or human operator
**Author:** will
**Updated:** 2026-04-08

---

## 1. Initial Assessment (0-2 min)

When something is reported wrong, establish the scope immediately:

```
What is broken?
  - Site down? Slow? Returning errors (502, 504, 500)?
  - Which service/endpoint is affected?

When did it break?
  - Just now? After a deploy? Random/intermittent?
  - Did a recent commit, config change, or machine reboot happen?

What changed recently?
  - Deploy, config edit, Docker compose change?
  - Host reboot or ZFS scrub?
```

**Record your answers before touching anything.** This prevents scope creep and helps if rollback becomes necessary.

---

## 2. Quick Triage (2-5 min)

Run these in parallel to establish the current state:

```bash
# Check all critical containers
docker ps --format "table {{.Names}}\t{{.Status}}" | grep -E "Hermes Agent|litellm|wav2vec2|coolify"

# Check Traefik (coolify-proxy)
curl -sf -m 5 http://localhost:80/ping && echo "Traefik OK" || echo "Traefik FAIL"

# Check Hermes Gateway route (via Cloudflare Tunnel)
curl -sf -m 10 -o /dev/null -w "%{http_code}" https://hermes.zappro.site/health && echo " Hermes Gateway route OK"

# Run smoke test
bash tasks/smoke-tests/pipeline-Hermes Agent-voice.sh 2>&1 | tail -10

# Quick network verification
bash docs/OPERATIONS/SKILLS/verify-network.sh
```

**Expected healthy state:**

| Container                           | Status |
| ----------------------------------- | ------ |
| `coolify-proxy`                     | Up     |
| `hermes-agent` | Up     |
| `zappro-litellm`                    | Up     |
| `zappro-wav2vec2`                   | Up     |
| `zappro-litellm-db`                 | Up     |

---

## 3. Root Cause Categories

Match symptoms to the most likely cause:

| Symptom                         | Likely Root Cause                   | First Action                   |
| ------------------------------- | ----------------------------------- | ------------------------------ |
| Site returning **502**          | Container down OR network isolation | `docker ps`, check networks    |
| Site returning **504**          | Traefik cannot reach backend        | Check shared network           |
| `curl localhost:80` fails       | Traefik container down              | `docker restart coolify-proxy` |
| DNS fails / tunnel down         | Cloudflare Tunnel dead              | `ps aux \| grep cloudflared`   |
| Container "Up" but route 502    | Network isolation                   | Run `verify-network.sh`        |
| Container constantly restarting | OOM, crash loop                     | `docker logs --tail 50`        |
| LiteLLM returns **500**         | Backend service down                | Check wav2vec2, ollama         |
| wav2vec2 returns **500**        | wav2vec2 container crashed          | `docker logs zappro-wav2vec2`  |

---

## 4. Decision Tree

```
Is Traefik healthy?
  curl -sf -m 5 http://localhost:80/ping

  NO
  └── Traefik down
      docker restart coolify-proxy
      curl http://localhost:80/ping
      IF still failing → Check Docker daemon, host load

  YES
  └── Is the target container up?
      docker ps | grep <container-name>

      NO
      └── Start the container
          docker start <container-name>
          docker logs --tail 20 <container-name>

      NO
      └── Is route working?
          curl -sf -m 10 https://hermes.zappro.site/health

          502 / 504
          └── Network isolation — run verify-network.sh
              Look for "no shared network" failures
              docker restart <container>

          401 / 200
          └── OK — investigate other causes
```

---

## 5. Common Fixes

### Container down

```bash
# Identify the container
docker ps -a --format "table {{.Names}}\t{{.Status}}" | grep -E "Hermes Agent|litellm|wav2vec2|coolify"

# Start it
docker start <container-name>

# Check logs
docker logs --tail 50 <container-name>
```

### Traefik (coolify-proxy) down

```bash
docker restart coolify-proxy
sleep 3
curl -sf -m 5 http://localhost:80/ping && echo "Traefik OK"
```

### Network isolation (most common cause of 502/504)

```bash
# Find what networks a container is on
docker inspect <container> --format '{{json .NetworkSettings.Networks}}'

# Example: check Hermes Agent
docker inspect hermes-agent --format '{{json .NetworkSettings.Networks}}'

# Compare with Traefik's networks
docker inspect coolify-proxy --format '{{json .NetworkSettings.Networks}}'

# Solution: restart the affected container to reconnect networks
docker restart <container-name>

# Verify
bash docs/OPERATIONS/SKILLS/verify-network.sh
```

### Route 502 — backend unreachable from Traefik

```bash
# Get the container's internal IP
docker inspect <container> --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}'

# From Traefik, try to reach the backend
docker exec coolify-proxy curl -sf -m 5 http://<container-ip>:8080/health

# Or by container name (if on same network)
docker exec coolify-proxy curl -sf -m 5 http://hermes-agent:8080/health
```

### Container crash loop (OOM or config error)

```bash
# Watch restart count
docker ps -a --format "table {{.Names}}\t{{.Status}}" | grep <container>

# Get last 50 lines of logs
docker logs --tail 50 <container-name>

# Check exit code
docker inspect <container> --format '{{.State.ExitCode}}'

# If OOM: increase memory limit or reduce container load
# If config error: check env vars and compose file
```

### LiteLLM returning 500

```bash
# Check if wav2vec2 is reachable from LiteLLM
docker exec zappro-litellm curl -sf -m 5 http://wav2vec2:8201/health

# Check if Ollama is reachable (host IP from inside Docker)
docker exec zappro-litellm curl -sf -m 5 http://10.0.1.1:11434/api/tags

# Check LiteLLM logs
docker logs --tail 50 zappro-litellm
```

### Cloudflare Tunnel down (DNS failure)

```bash
# Check if cloudflared process is running
ps aux | grep cloudflared

# Restart the tunnel (Coolify UI or cloudflared command)
# Coolify → Traefik proxy → Cloudflare Tunnel settings
```

---

## 6. Rollback Procedure

**Snapshot-first rule:** Before any structural change to containers, networks, or ZFS pools — snapshot.

### Find latest pre-deploy snapshot

```bash
sudo zfs list -t snapshot | grep pre-deploy | tail -5
```

### Rollback

```bash
# Dry run first (optional but recommended)
sudo zfs rollback -n -r tank@<snapshot-name>

# Actual rollback
sudo zfs rollback -r tank@<snapshot-name>

# Restart all containers to pick up restored state
docker restart $(docker ps -q)
```

---

## 7. Escalation Triggers

**Call a human (or open an issue) when:**

- Network isolation between Traefik and a container persists after container restart
- ZFS rollback does not fix the problem
- Container keeps crashing after multiple restarts (possible hardware OOM issue)
- Cloudflare Tunnel process is dead and Coolify UI cannot restart it
- Data corruption suspected (ZFS scrub needed — `sudo zfs scrub tank`)
- Disk I/O errors in `dmesg` or ZFS status

---

## Quick Reference Card

```bash
# One-liner health check (paste into terminal)
docker ps --format "table {{.Names}}\t{{.Status}}" | grep -E "Hermes Agent|litellm|wav2vec2|coolify" && \
curl -sf -m 5 http://localhost:80/ping && echo " Traefik OK" || echo " Traefik FAIL" && \
curl -sf -m 10 -o /dev/null -w "%{http_code}" https://hermes.zappro.site/ && echo " Hermes Agent route OK"

# Network verify
bash docs/OPERATIONS/SKILLS/verify-network.sh

# Smoke test
bash tasks/smoke-tests/pipeline-Hermes Agent-voice.sh 2>&1 | tail -10

# Restart a misbehaving container
docker restart <container-name> && sleep 3 && docker logs --tail 20 <container-name>

# Restart Traefik
docker restart coolify-proxy
```

### Container Names Reference

| Service      | Container Name                      |
| ------------ | ----------------------------------- |
| Traefik      | `coolify-proxy`                     |
| Hermes Agent | `hermes-agent` |
| LiteLLM      | `zappro-litellm`                    |
| LiteLLM DB   | `zappro-litellm-db`                 |
| wav2vec2 STT | `zappro-wav2vec2`                   |

### Network Names Reference

| Network                    | Purpose                    |
| -------------------------- | -------------------------- |
| `hermes-agent` | Hermes Agent container network |
| `zappro-lite_default`      | LiteLLM + wav2vec2 network |
| `coolify`                  | Traefik external network   |

---

**Remember:** Document what you found and what you did. After the incident is resolved, update this runbook if a new failure mode was discovered.
