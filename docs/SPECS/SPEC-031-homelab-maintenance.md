# SPEC-031 — Homelab State-of-Art Maintenance

**Date:** 2026-04-12
**Status:** IN_PROGRESS
**Priority:** 🟡 LOW (non-urgent)
**Slice:** 3 — Infrastructure Polish

---

## Objective

Apply 7 low-priority maintenance improvements identified in the 12-agent audit. Each improvement has clear acceptance criteria and can be verified independently. Target: all 7 complete in minimum time using parallel execution.

---

## Tech Stack

- Docker (container HEALTHCHECK)
- ZFS (snapshot cron)
- Prometheus (scrape config)
- Kokoro FastAPI (version bump)
- Claude Code CLI + 10 parallel agents

---

## Commands

```bash
# Health checks
docker inspect --format='{{.Config.Healthcheck}}' node-exporter
docker inspect --format='{{.Config.Healthcheck}}' loki

# Kokoro version check
curl -s http://localhost:8880/v1/models | jq '.'

# ZFS snapshot list
zfs list -t snapshot -r tank | tail -10

# Prometheus scrape config
cat /srv/monorepo/docker/prometheus.yml 2>/dev/null || cat /etc/prometheus/prometheus.yml
```

---

## 7 Improvements — Tasks

### Task 1: Kokoro v0.2.2 → v0.2.4-master

**Pre-approval required:** YES (Context7 research + owner approval)

| Step | Action                                                          |
| ---- | --------------------------------------------------------------- |
| 1    | Research v0.2.4 changes via Context7 (`/remsky/kokoro-fastapi`) |
| 2    | Compare audio quality improvements (if any)                     |
| 3    | Get owner explicit approval                                     |
| 4    | If approved: update VERSION-LOCK.md + docker-compose            |
| 5    | Restart container + smoke test                                  |

**Acceptance Criteria:**

- [ ] Context7 research done (v0.2.4 changelog)
- [ ] owner approval obtained (Slack/chat)
- [ ] VERSION-LOCK.md updated with new version
- [ ] `docker ps` shows new image running
- [ ] TTS Bridge smoke test PASS (pm_santa + pf_dora)

**Verification:**

```bash
curl -s http://localhost:8880/v1/models | jq '.model_version'
```

---

### Task 2: node-exporter HEALTHCHECK

**Pre-approval required:** NO (config-only, no service restart)

| Step | Action                                                                                        |
| ---- | --------------------------------------------------------------------------------------------- |
| 1    | Find node-exporter container docker-compose or run command                                    |
| 2    | Add `HEALTHCHECK --interval=30s --timeout=10s --retries=3 CMD curl -f http://localhost:9100/` |
| 3    | Restart container or recreate with healthcheck                                                |
| 4    | Verify `docker inspect` shows Healthcheck config                                              |
| 5    | Prometheus target shows node-exporter UP                                                      |

**Acceptance Criteria:**

- [ ] `docker inspect` shows Healthcheck defined
- [ ] `docker health` shows healthy status
- [ ] Prometheus target node-exporter health = UP

**Verification:**

```bash
docker inspect --format='{{.Config.Healthcheck}}' $(docker ps --filter name=node-exporter --format '{{.Names}}')
```

---

### Task 3: loki HEALTHCHECK

| Step | Action                                                                                             |
| ---- | -------------------------------------------------------------------------------------------------- |
| 1    | Find loki container configuration                                                                  |
| 2    | Add `HEALTHCHECK --interval=30s --timeout=10s --retries=3 CMD curl -f http://localhost:3100/ready` |
| 3    | Restart container                                                                                  |
| 4    | Verify health status                                                                               |

**Acceptance Criteria:**

- [ ] `docker inspect` shows Healthcheck for loki
- [ ] `curl -f http://localhost:3100/ready` returns 200
- [ ] docker-autoheal treats loki as monitored

---

### Task 4: cadvisor scrape timeout 30s

| Step | Action                                                                          |
| ---- | ------------------------------------------------------------------------------- |
| 1    | Find Prometheus scrape config                                                   |
| 2    | Change `scrape_timeout: 10s` → `scrape_timeout: 30s` for cadvisor job           |
| 3    | Reload Prometheus (`docker exec prometheus prometheus --reload` or `kill -HUP`) |
| 4    | Verify no scrape timeouts in Prometheus UI                                      |

**Acceptance Criteria:**

- [ ] prometheus.yml updated (or prometheus container env updated)
- [ ] Prometheus reloads config without restart
- [ ] cadvisor scrape interval shows 30s timeout

**Verification:**

```bash
curl -s http://localhost:9090/api/v1/targets | jq '.data.activeTargets[] | select(.labels.job=="cadvisor") | .lastError'
```

---

### Task 5: ZFS snapshot retention cron

| Step | Action                                                                 |
| ---- | ---------------------------------------------------------------------- |
| 1    | Create `/srv/ops/scripts/zfs-snapshot-prune.sh`                        |
| 2    | Script: `zfs list -t snapshot -r tank` + prune snaps older than 7 days |
| 3    | Add to crontab: `0 */3 * * *` (every 3 hours)                          |
| 4    | Verify snapshots created                                               |
| 5    | Test prune (dry-run first)                                             |

**Acceptance Criteria:**

- [ ] Script exists at `/srv/ops/scripts/zfs-snapshot-prune.sh`
- [ ] `crontab -l | grep zfs-snapshot` shows schedule
- [ ] Manual run creates snapshot of `/srv/data` + `/srv/docker-data`
- [ ] Old snapshots (30+ days) are pruned

**Verification:**

```bash
zfs list -t snapshot -r tank | grep "pre-"
# Should show pre-*-* snapshots with timestamps
```

---

### Task 6: APPROVAL_MATRIX.md update — voice services

| Step | Action                               |
| ---- | ------------------------------------ |
| 1    | Read current APPROVAL_MATRIX.md      |
| 2    | Add voice pipeline services to table |
| 3    | Update date to 2026-04-12            |
| 4    | Commit + sync                        |

**Add to table:**
| Operation | TTS Bridge restart | Voice change | OpenClaw config edit |
| Service | zappro-tts-bridge | pm_santa/pf_dora | openclaw-qgtzrmi |
| Can Execute | Autoheal (3/h limit) | NEVER | NEVER |
| Requires Approval | owner | owner | owner |

**Acceptance Criteria:**

- [ ] APPROVAL_MATRIX.md includes TTS Bridge, OpenClaw, Kokoro rows
- [ ] Date updated to 2026-04-12
- [ ] `git log` shows update

---

### Task 7: Sync.sh verification + MEMORY.md index

| Step | Action                                                     |
| ---- | ---------------------------------------------------------- |
| 1    | Run `bash /home/will/.claude/mcps/ai-context-sync/sync.sh` |
| 2    | Verify SPECs, ADRs, GUIDEs, REFERENCE all synced           |
| 3    | Check memory dirs exist with files                         |
| 4    | Update MEMORY.md index (if needed)                         |
| 5    | Verify manifest `last_sync` updated                        |

**Acceptance Criteria:**

- [ ] sync.sh runs without errors
- [ ] `ls memory/specs/` shows 10+ SPEC files
- [ ] `ls memory/adrs/` shows ADR files
- [ ] `ls memory/guides/` shows GUIDE files
- [ ] `ls memory/reference/` shows REFERENCE files
- [ ] `manifest.json last_sync` = today

---

## Project Structure

```
/srv/monorepo/
├── SPECS/SPEC-031-homelab-maintenance.md  ← this file
├── VERSION-LOCK.md                        ← Task 1 updates (if approved)
├── docs/
│   ├── GOVERNANCE/APPROVAL_MATRIX.md    ← Task 6 updates
│   └── OPERATIONS/SKILLS/               ← Skills updated
├── tasks/
│   └── pipeline.json                      ← /pg generates from this SPEC
└── docker-compose.override.yml           ← HEALTHCHECK configs (Tasks 2-3)
```

---

## Files Affected

| Task | Files                                             |
| ---- | ------------------------------------------------- |
| 1    | VERSION-LOCK.md, docker-compose.yml               |
| 2    | docker-compose.yml or docker-compose.override.yml |
| 3    | docker-compose.yml or docker-compose.override.yml |
| 4    | prometheus.yml or prometheus container env        |
| 5    | /srv/ops/scripts/zfs-snapshot-prune.sh, crontab   |
| 6    | docs/GOVERNANCE/APPROVAL_MATRIX.md                |
| 7    | sync.sh, manifest.json                            |

---

## Dependencies

- Task 2, 3: require docker-compose edit + container restart
- Task 5: requires /srv/ops/scripts/ directory write
- Task 1: requires owner approval (BLOCKED until approved)

---

## Test Strategy

```bash
# All smoke tests
bash /srv/monorepo/tasks/smoke-tests/pipeline-openclaw-voice.sh
# Should PASS 14/14

# Prometheus targets
curl -s http://localhost:9090/api/v1/targets | jq '.data.activeTargets[].health'

# ZFS snapshot
zfs list -t snapshot -r tank | wc -l  # should be > 0 after Task 5
```

---

## Success Criteria

All 7 tasks complete with verification steps logged. Final state:

| Metric             | Target                            |
| ------------------ | --------------------------------- |
| Tasks completed    | 7/7                               |
| Smoke tests        | 14/14 PASS                        |
| Prometheus targets | All UP                            |
| ZFS snapshots      | > 0 (automated)                   |
| MEMORY synced      | SPECs + ADRs + GUIDEs + REFERENCE |
| APPROVAL_MATRIX    | Updated + dated 2026-04-12        |

---

## Open Questions

1. **Kokoro v0.2.4** — Is there audio quality improvement worth the risk? Need Context7 research first.
2. **cadvisor timeout** — Does 30s actually help? Current 10s may be intentional to fail-fast.
3. **ZFS snapshot retention** — 7 days retention OK? Or need longer (30 days)?

**Recommendation:** Execute Tasks 2-7 in parallel (no approval needed). Keep Task 1 (Kokoro) as separate approval track.

---

## Goals

| Priority | Goal                                                              |
| -------- | ----------------------------------------------------------------- |
| MUST     | Tasks 2, 3, 5, 6, 7 complete (5 tasks)                            |
| SHOULD   | Task 4 (cadvisor timeout) — verify if actually needed             |
| COULD    | Task 1 (Kokoro v0.2.4) — only if Context7 shows clear improvement |
