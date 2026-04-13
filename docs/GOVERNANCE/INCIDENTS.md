---
version: 1.0
author: will-zappro
date: 2026-03-17
---

# Incident Management & Postmortem

**Host:** will-zappro
**Last Updated:** 2026-03-17

Log of incidents and how to handle them.

## Incident Log

### INC-001 — Voice Stack + GPU Exporter Down (pós-update NVIDIA 580.126.20)
- **Date:** 2026-03-17
- **Severity:** Medium
- **Duration:** ~1 dia (detectado na auditoria pós-update)
- **Services Affected:** speaches, chatterbox-tts, voice-proxy, nvidia-gpu-exporter, monitor.zappro.site
- **Root Cause:** Driver NVIDIA atualizado para 580.126.20 não reiniciou containers com CDI GPU (nvidia.com/gpu=0) automaticamente. nvidia-gpu-exporter também não reiniciou. Entrada `monitor.zappro.site` estava ausente do `config.yml` do cloudflared.
- **Resolution:**
  1. ZFS snapshot `tank@pre-20260317-223741-repair-hardening` criado antes de qualquer mudança.
  2. `docker-compose up -d nvidia-gpu-exporter` em /srv/apps/monitoring
  3. `docker-compose up -d speaches chatterbox-tts` → aguardou health checks → `docker-compose up -d voice-proxy`
  4. Adicionado `monitor.zappro.site → localhost:3100` ao `/home/will/.cloudflared/config.yml`, restart cloudflared.
  5. Docs de governança pinnados com `chattr +i` (root:root, 644).
- **Prevention:** Containers GPU com `restart: unless-stopped` já configurados. Após updates de driver, executar `docker ps -a` para verificar containers parados.

### INC-002 — Antigravity Memory Leak → OOM → System Reboot (2026-03-25/26)
- **Date:** 2026-03-25 22:40 → 2026-03-26 03:27
- **Severity:** High
- **Duration:** ~5h entre OOM kill e reboot; reboot não-gracioso
- **Services Affected:** Sistema inteiro (reboot abrupto); antigravity morto pelo OOM killer
- **Root Cause:** Processo `antigravity` (Electron/Chromium) apresentou memory leak catastrófico: `total-vm: 1,463,774,676 kB` (~1.4 TB de memória virtual). O OOM killer matou o processo às 22:40, mas a instabilidade de memória persistiu, resultando em kernel panic/reboot às 03:27 do dia seguinte. Nenhum `MemoryMax` existia para qualquer processo do sistema.
- **Evidence:** `Out of memory: Killed process 3335206 (antigravity) total-vm:1463774676kB anon-rss:1074172kB`; crash dump em `/var/crash/_usr_share_antigravity_antigravity.1000.crash`; `last` sem `shutdown system down` antes do reboot.
- **Resolution:**
  1. Adicionado `MemoryMax=6G` via `/etc/systemd/system/antigravity-guard.service`
  2. Adicionado `MemoryMax=3G` para `aurelia.service` (drop-in)
  3. Adicionado `MemoryMax=20G` para `ollama.service` (drop-in)
  4. Adicionado `MemoryMax=512M` para todos `aurelia-memory-sync-*.service` (user drop-ins)
  5. Memory limits adicionados a todos os Docker containers sem limite
  6. Seção 11 adicionada ao GUARDRAILS.md com política obrigatória de limites
- **Prevention:** Ver GUARDRAILS.md §11 — todo novo serviço DEVE ter `MemoryMax` antes de produção.

## Current Incidents
(Nenhum aberto)

### INC-003 — Monitoring Stack Fragmentada, nvidia-gpu-exporter Created-not-Started (2026-04-04)
- **Date:** 2026-04-04
- **Severity:** Medium
- **Duration:** ~30min (encontrado durante verificação de dashboard vazio)
- **Services Affected:** monitor.zappro.site (dashboard NVIDIA GPU sem dados), Grafana não conseguia comunicar com Prometheus via DNS
- **Root Cause:**
  1. `nvidia-gpu-exporter` estava no estado `Created` (nunca arrancou após reboot)
  2. Grafana estava em Docker network `monitoring` mas Prometheus estava em `aurelia-net` — sem overlap, datasource não resolvia
  3. Grafana container foi criado manualmente com `docker run` (não via docker compose), ficando na network errada
- **Resolution:**
  1. `docker start nvidia-gpu-exporter` — exporter passou a `Up`
  2. `docker network connect aurelia-net grafana` — Grafana ganhou acesso à network do Prometheus
  3. Prometheus restartado para apanhar config com job `nvidia-gpu` no prometheus.yml
  4. `docker network connect aurelia-net prometheus` — Prometheus na network correcta
  5. Verificado: Prometheus targets `nvidia-gpu` → UP, Grafana → Prometheus query retorna dados
- **Prevention:**
  - Criar skill `monitoring-health-check.md` para verificar estados de containers regularmente
  - Criar skill `monitoring-diagnostic.md` com árvore de decisão para problemas de network
  - Criar skill `monitoring-zfs-snapshot.md` para snapshot antes de changes na stack
  - Documentar que containers devem ser criados via `docker compose` para manter network consistente
- **Skills criadas:**
  - `./skills/monitoring-health-check.md`
  - `./skills/monitoring-diagnostic.md`
  - `./skills/monitoring-zfs-snapshot.md`

---

## Incident Template

Use this format when something breaks.

```markdown
# Incident Report: [TITLE]

## Summary
- **Date/Time:** YYYY-MM-DD HH:MM UTC
- **Duration:** XX minutes
- **Severity:** Critical / High / Medium / Low
- **Services Affected:** Qdrant, n8n, PostgreSQL, etc.
- **User Impact:** [What couldn't users do?]

## Timeline
- HH:MM - Event started (what happened)
- HH:MM - Detection (how did we notice)
- HH:MM - Initial response (what did we try)
- HH:MM - Root cause identified
- HH:MM - Recovery started
- HH:MM - Services restored
- HH:MM - Incident closed

## Root Cause
[Why did this happen? What was the underlying issue?]

Example: "Docker image tag 'latest' pulled unexpected version upgrade that broke API compatibility."

## Impact
- **Downtime:** XX minutes
- **Data Lost:** Yes/No, [if yes, what]
- **Blast Radius:** Single service / Multiple services / All services

## Recovery Steps Taken
1. [Step 1 - did this work?]
2. [Step 2 - did this work?]
3. [Step 3 - final resolution]

## Resolution
[How was it fixed? Was rollback used?]

Example: "Rolled back docker-compose to previous Qdrant image version. Service restored."

## Prevention
[What changes prevent this in future?]

- [ ] Add automated test for [issue]
- [ ] Update GUARDRAILS.md to block [dangerous action]
- [ ] Update CHANGE_POLICY.md to require [extra approval]
- [ ] Add monitoring for [condition]
- [ ] Update documentation

## Lessons Learned
1. [What did we learn?]
2. [What should we do differently?]

## Postmortem Owner
- Reported by: [Name]
- Investigation lead: [Name]
- Date: YYYY-MM-DD
```

---

## Severity Levels

### CRITICAL (RTO: 15 minutes, RPO: 0)
- All services down
- Data loss occurring
- Security breach active
- Cannot be worked around

**Examples:**
- ZFS pool corrupted
- Docker daemon won't start
- All disks full

**Response:** Immediate (call if needed)

### HIGH (RTO: 1 hour, RPO: 1 hour)
- One major service down (breaks workflows)
- Data loss possible but not yet occurred
- Requires manual intervention

**Examples:**
- n8n won't start (workflows blocked)
- PostgreSQL corrupted (n8n non-functional)
- Qdrant crashed (AI features unavailable)

**Response:** Within 30 minutes

### MEDIUM (RTO: 4 hours, RPO: 24 hours)
- Service degraded but usable
- Feature unavailable
- Workaround exists

**Examples:**
- Service slow (memory leak)
- Minor API failure
- Backup script failed

**Response:** Within business hours

### LOW (RTO: Next business day, RPO: None)
- Documentation issue
- Non-critical feature broken
- Can wait for next maintenance window

**Examples:**
- README outdated
- Health check false positive
- Non-essential metric broken

**Response:** Next change window

---

## Incident Response Checklist

### Immediate (First 5 minutes)
- [ ] Assess severity
- [ ] Stop making changes (don't make it worse)
- [ ] Take snapshot of current state: `sudo zfs snapshot -r tank@incident-TIMESTAMP`
- [ ] Check SERVICE_MAP.md to understand dependencies
- [ ] Check RECOVERY.md for applicable procedure

### Short-term (Next 30 minutes)
- [ ] Execute recovery procedure (or rollback)
- [ ] Verify services restored
- [ ] Check data integrity
- [ ] Notify stakeholders if needed

### Medium-term (Next 24 hours)
- [ ] Document incident using template above
- [ ] Identify root cause
- [ ] Plan prevention steps
- [ ] Update relevant procedure docs

### Long-term (Next week)
- [ ] Implement prevention measures
- [ ] Test procedures to ensure they work
- [ ] Update this file with lessons learned

---

## Common Incidents & Quick Recovery

### "Qdrant won't start"
```bash
# Check logs
docker logs qdrant | tail -50

# Try restart
docker compose -f /srv/apps/platform/docker-compose.yml restart qdrant

# If still broken, rollback
sudo zfs rollback tank/qdrant@pre-timestamp
docker compose -f /srv/apps/platform/docker-compose.yml up -d qdrant
```
**Severity:** High (AI features unavailable)

### "n8n giving errors"
```bash
# Check PostgreSQL first
docker compose -f /srv/apps/platform/docker-compose.yml ps n8n-postgres

# Check logs
docker logs n8n | tail -50

# Restart
docker compose -f /srv/apps/platform/docker-compose.yml restart n8n
```
**Severity:** High (workflows blocked)

### "Disk full"
```bash
# Find what's using space
du -sh /srv/*

# Clean old backups
ls -t /srv/backups/postgres/*.sql.gz | tail -n +8 | xargs rm

# Clean Docker
docker image prune -a -f

# Verify
df -h /srv
```
**Severity:** High (new backups/logs might fail)

### "Service keeps restarting"
```bash
# Check logs for repeating error
docker logs service-name | tail -100

# Check health check configuration
docker inspect service-name | grep -A 10 "HealthCheck"

# Disable health check temporarily if false-positive
# Edit docker-compose.yml and rebuild
```
**Severity:** Medium (service eventually starts, but cycling)

### "Data corruption suspected"
```bash
# Take snapshot immediately
sudo zfs snapshot -r tank@pre-incident-TIMESTAMP

# Check filesystem consistency
sudo zfs status tank

# Restore from backup if data is gone
# See RECOVERY.md
```
**Severity:** Critical (potential data loss)

---

## Post-Incident Cleanup

After incident resolved:

1. **Clean up snapshots:** Keep only incident snapshot (for investigation) and pre-change snapshots
   ```bash
   zfs list -t snapshot
   sudo zfs destroy tank@old-incident-snapshot
   ```

2. **Update logs:** Add incident summary to this file

3. **Update procedures:** If recovery steps weren't clear, update RECOVERY.md

4. **Update guardrails:** If something preventable, add to GUARDRAILS.md

5. **Schedule postmortem:** If critical, schedule team review

---

## When to File an Incident

- ✅ Service was unavailable (even briefly)
- ✅ Data loss or corruption occurred
- ✅ Change caused unexpected behavior
- ✅ Recovery required manual intervention
- ✅ Automation failed (backup script error, health check failed)

## When NOT to File an Incident

- ❌ Normal development errors (code bug in new app)
- ❌ Expected maintenance (planned downtime)
- ❌ Security advisory (no actual compromise)
- ❌ Single query failed (transient)

---

## Review & Learning

Review this file:
- After every incident
- Monthly (even if no incidents)
- When procedure changes
- When adding new services

**Questions to ask:**
1. Could this have been prevented?
2. How could we detect this faster?
3. How could we recover faster?
4. What guardrail prevents repeat?

---

**Last Updated:** 2026-03-16
**Next Review:** Monthly (or after incident)
