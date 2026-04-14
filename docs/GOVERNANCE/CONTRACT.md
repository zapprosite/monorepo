---
version: 1.0
author: Principal Engineer
date: 2026-03-16
---

# Operational Contract for AI Agents

**Effective:** 2026-03-16
**Scope:** All AI agents (Claude Code, Codex, Copilot, future agents)
**Authority:** Principal Engineer - Platform Governance

This document establishes the non-negotiable operational contract between human operators and AI agents on the homelab.

## 1. Core Principles

### 1.1 Data Protection

- **PLEDGE:** Data in /srv/data is sacrosanct. Zero tolerance for data loss.
- **RULE:** Never delete, truncate, or corrupt anything in:
  - /srv/data/postgres
  - /srv/data/qdrant
  - /srv/data/n8n
  - /srv/backups (backup archives must be preserved)
- **ENFORCEMENT:** Snapshot before ANY operation touching /srv/data
- **EXCEPTION:** Restore operations using RECOVERY.md are permitted with preflight

### 1.2 Host Integrity

- **PLEDGE:** The host remains stable and self-healing.
- **RULE:** Infrastructure changes follow CHANGE_POLICY.md strictly
- **RULE:** Before structural changes (ZFS, docker-compose stack, network):
  1. Snapshot the pool: `sudo zfs snapshot -r tank@pre-change-$(date +%Y%m%d-%H%M%S)`
  2. Document change intent
  3. Perform change
  4. Validate with runbook commands
  5. Update INCIDENTS.md if something breaks

### 1.3 Monorepo Autonomy

- **PLEDGE:** Application development is independent, infrastructure changes require human review.
- **RULE:** Agents can modify code in /srv/monorepo/apps/_ and /srv/monorepo/packages/_ freely
- **RULE:** Agents CANNOT modify:
  - /srv/monorepo/.github
  - /srv/monorepo/docker-compose.yml
  - /srv/monorepo/AGENTS.md
  - Infrastructure references in documentation
- **EXCEPTION:** With explicit approval + snapshot, can change above

### 1.4 Snapshot Mandate

- **RULE:** Every structural change requires a snapshot taken BEFORE the change
- **STRUCTURAL CHANGES:** ZFS operations, docker-compose modifications, /etc changes, service restarts
- **PROOF:** Document the snapshot name in change log
- **RECOVERY:** Snapshot enables 100% rollback to pre-change state

### 1.5 Destructive Operation Confirmation

- **RULE:** No operation that deletes, destroys, or unmounts anything may execute without explicit human confirmation
- **RULE:** Confirmation must be unambiguous (not "yes" or "y", but affirmative statement of what will be deleted)
- **OPERATIONS REQUIRING CONFIRMATION:**
  - `zfs destroy` (any variant)
  - `docker compose down -v`
  - `docker rm`, `docker rmi`, `docker volume rm`
  - `rm -rf` in /srv
  - `zpool` operations
  - Service restart/stop on production stacks
  - Network changes (firewall, routing, tunnel)

### 1.6 /srv Preservation

- **PLEDGE:** /srv is the zone of persistent application state. It must outlive the OS.
- **RULE:** All application data, configs, and code live in /srv (not /home, not /root, not /tmp)
- **RULE:** /srv/data is never treated as ephemeral (not Docker volumes to be pruned)
- **RULE:** System reinstall (OS upgrade, recovery) must preserve /srv intact
- **COROLLARY:** When OS fails, mount /srv from backup and recovery is near-instant

### 1.7 No Breaking Changes Without Review

- **RULE:** Changes that would break running services require:
  1. Snapshot
  2. Change proposal (see templates/)
  3. Explicit approval
  4. Parallel test (if possible)
  5. Rollback plan documented
- **EXAMPLES:** Docker image upgrades, database schema changes, API breaking changes

## 2. Policy: Host Changes

### 2.1 Safe Host Changes (Can execute after snapshot)

- Installing packages (apt, pip, npm packages in isolated spaces)
- Modifying /etc/docker/daemon.json (with validation)
- Adding firewall rules (with rollback documented)
- Creating new users or SSH keys (if not touching existing accounts)
- Updating documentation in /srv/ops

### 2.2 Risky Host Changes (Requires approval + snapshot + validation)

- ZFS dataset creation/deletion
- Docker storage driver changes
- Service restarts (Qdrant, n8n, PostgreSQL)
- Network tunnel configuration
- SSL/HTTPS setup
- Monitoring stack additions

### 2.3 Forbidden Host Changes

- Anything touching nvme0n1 or nvme1n1 raw (see GUARDRAILS.md)
- Anything that could destroy the ZFS pool
- Anything that alters /srv/docker-data (Docker runtime data)
- Anything that stops all services without recovery plan
- Any unauthorized port exposure

## 3. Policy: Monorepo Changes

### 3.1 Safe Monorepo Changes (Can execute freely)

- Adding new code in apps/api, apps/web, apps/worker-ai
- Modifying existing application logic
- Adding tests, improving CI/CD pipeline
- Documentation updates (non-infrastructure)
- Dependency version updates (with test verification)
- Build script improvements

### 3.2 Risky Monorepo Changes (Requires snapshot of /srv/monorepo dataset)

- Restructuring app architecture
- Moving packages between directories
- Changing pnpm-workspace.yaml
- Altering docker-compose in monorepo

### 3.3 Forbidden Monorepo Changes

- Hardcoding secrets
- Pushing secrets in any branch
- Breaking existing public APIs without deprecation
- Removing backup/restore documentation
- Removing health check mechanisms

## 4. Source of Truth

| Component            | Source                             | Backup                   | Owner                 |
| -------------------- | ---------------------------------- | ------------------------ | --------------------- |
| Host governance      | ./                                 | ZFS snapshots            | Principal Engineer    |
| Application code     | /srv/monorepo                      | Git + ZFS                | Development team      |
| Service data         | /srv/data/\*                       | /srv/backups + snapshots | PostgreSQL/Qdrant/n8n |
| Docker config        | /etc/docker/daemon.json            | /srv/ops/setup.log       | Infrastructure        |
| Secrets (live)       | /root/.env or k8s secrets (future) | Never in Git             | DevOps                |
| Secrets (documented) | /srv/monorepo/.env.example         | Public repo              | Development           |

## 5. Snapshot Before Change

### 5.1 Snapshot Policy

Before ANY structural change, execute:

```bash
sudo zfs snapshot -r tank@pre-$(date +%Y%m%d-%H%M%S)-description
```

Example:

```bash
sudo zfs snapshot -r tank@pre-20260316-110532-docker-upgrade
```

### 5.2 Rollback Policy

If change fails or breaks services:

```bash
sudo zfs rollback -r tank@pre-20260316-110532-docker-upgrade
```

**WARNING:** Rollback destroys all changes since snapshot. Use RECOVERY.md for partial recovery.

## 6. Confirmation Before Destructive Ops

### 6.1 What Requires Confirmation

- Deleting anything in /srv/data, /srv/backups, /srv/docker-data
- Destroying ZFS datasets
- Removing Docker images/containers/volumes
- Stopping services
- Dropping databases
- Modifying or deleting backups

### 6.2 How to Confirm

**Bad:** "Can I delete this? Yes/No"
**Bad:** "Should I proceed? y"
**Good:** "I understand this will DELETE /srv/data/postgres and I have backups. Proceed."

Agent must see explicit acknowledgment of consequence before executing.

## 7. Incident Reporting

If something goes wrong:

1. **STOP.** Do not attempt recovery without understanding root cause.
2. **ASSESS.** Check RECOVERY.md for the specific failure mode.
3. **SNAPSHOT.** If no snapshot was taken, take one now (if pool is accessible).
4. **DOCUMENT.** File incident using templates/incident-report.md
5. **ROLLBACK.** Execute recovery procedure with caution.
6. **POSTMORTEM.** Update templates/postmortem.md with root cause and prevention.
7. **PREVENT.** Update GUARDRAILS.md or CHANGE_POLICY.md if needed.

## 8. Compliance

### 8.1 Self-Check Questions

Before executing any change, agent should ask:

- [ ] Have I read CONTRACT.md?
- [ ] Have I checked GUARDRAILS.md?
- [ ] Is this change in APPROVAL_MATRIX.md "safe" or "requires approval"?
- [ ] If structural, have I taken a snapshot?
- [ ] If destructive, have I confirmed explicitly with human?
- [ ] Have I documented the change in CHANGE_POLICY.md?
- [ ] Have I tested the change on non-production data first (if possible)?

### 8.2 Violation Response

If agent violates contract:

1. Stop agent immediately
2. Assess damage
3. Recover using RECOVERY.md
4. File incident
5. Update GUARDRAILS.md to prevent recurrence
6. Re-prompt agent with updated context

## 9. Review and Update

This contract should be reviewed:

- Monthly (or after every significant change)
- When new infrastructure added
- When new agent integrated
- When incident occurs

Updates must:

- Be documented in INCIDENTS.md
- Be reflected in CHANGE_POLICY.md
- Be tested before applying to agents

## 10. Network Governance

### 10.1 Mandatory Network Awareness

Before any action involving services, ports, containers, or subdomains, agents MUST read:

- **[NETWORK_MAP.md](./NETWORK_MAP.md)** — estado atual completo (portas, subdomínios, GPU, serviços DOWN)
- **[PORTS.md](./PORTS.md)** — tabela de alocação de portas
- **[SUBDOMAINS.md](./SUBDOMAINS.md)** — subdomínios públicos e Cloudflare Tunnel

### 10.2 Rules

- **NEVER assume a port is free** without `ss -tlnp | grep :PORT`
- **NEVER add a subdomain** without updating SUBDOMAINS.md + `/home/will/.cloudflared/config.yml`
- **NEVER expose a service publicly** without auth evaluation (see SUBDOMAINS.md § Segurança)
- **ALWAYS update NETWORK_MAP.md** after any service addition or removal
- **Voice stack requires CDI GPU** — speaches + chatterbox-tts must start before voice-proxy resolves

### 10.3 Known State (2026-03-27)

- **cap.zappro.site** — ativo via `localhost:3000`
- **supabase.zappro.site** — PRUNED (discontinued 2026-04-14 — DNS removido, serviço removido)
- **monitor.zappro.site** — ativo via `localhost:3100` (Grafana responde `302` para `/login`)

---

**Signature (virtual):** This contract is binding on all AI agents accessing this host.
**Review Date:** 2026-04-16 (30 days)
