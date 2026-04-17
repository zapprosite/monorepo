---
version: 1.0
author: Principal Engineer
date: 2026-04-12
---

# Approval Matrix: Decision Table

**Host:** homelab
**Effective:** 2026-04-12

This is the single source of truth for "can I do this?" decisions.

## Format

- **✅ SAFE** = Execute without asking
- **⚠️ APPROVAL** = Must ask human first
- **❌ FORBIDDEN** = Never execute (period)

---

## READ-ONLY OPERATIONS

| Operation                           | Allow | Approval | Forbidden | Notes              |
| ----------------------------------- | ----- | -------- | --------- | ------------------ |
| `docker ps`                         | ✅    | -        | -         | Safe, no changes   |
| `docker logs`                       | ✅    | -        | -         | Safe, no changes   |
| `curl http://localhost:6333/health` | ✅    | -        | -         | Health check       |
| `zpool status tank`                 | ✅    | -        | -         | Status, no changes |
| `zfs list`                          | ✅    | -        | -         | Inspection         |
| `df -h /srv`                        | ✅    | -        | -         | Disk usage         |
| `ps aux`                            | ✅    | -        | -         | Process inspection |
| `journalctl`                        | ✅    | -        | -         | System logs        |
| `cat /srv/ops/*.md`                 | ✅    | -        | -         | Read docs          |

---

## BACKUP & SNAPSHOT OPERATIONS

| Operation                                | Allow | Approval | Forbidden | Notes                       |
| ---------------------------------------- | ----- | -------- | --------- | --------------------------- |
| `/srv/ops/scripts/backup-postgres.sh`    | ✅    | -        | -         | Safe, creates backup only   |
| `/srv/ops/scripts/backup-qdrant.sh`      | ✅    | -        | -         | Safe, creates backup only   |
| `/srv/ops/scripts/backup-n8n.sh`         | ✅    | -        | -         | Safe, creates backup only   |
| `/srv/ops/scripts/snapshot-zfs.sh daily` | ✅    | -        | -         | Safe, creates snapshot      |
| `docker compose exec ... pg_dump`        | ✅    | -        | -         | Read-only dump              |
| `zfs list -t snapshot`                   | ✅    | -        | -         | Inspection                  |
| Manual backup (tar)                      | ✅    | -        | -         | As long as read-only source |

---

## DOCUMENTATION & CONFIGURATION UPDATES

| Operation                        | Allow | Approval | Forbidden | Notes                    |
| -------------------------------- | ----- | -------- | --------- | ------------------------ |
| Update `./*.md`                  | ✅    | -        | -         | Governance docs, no risk |
| Update `/srv/ops/INCIDENTS.md`   | ✅    | -        | -         | Incident logging         |
| Update `/srv/monorepo/README.md` | ✅    | -        | -         | App documentation        |
| Add comments to scripts          | ✅    | -        | -         | Non-functional           |
| Update `.env.example`            | ✅    | -        | -         | Safe (not live secrets)  |
| Add notes to CHANGE_LOG.txt      | ✅    | -        | -         | Audit trail              |

---

## APPLICATION DEVELOPMENT (Monorepo)

| Operation                | Allow | Approval | Forbidden | Notes                     |
| ------------------------ | ----- | -------- | --------- | ------------------------- |
| `pnpm install`           | ✅    | -        | -         | Safe, dependency update   |
| `pnpm dev`               | ✅    | -        | -         | Safe, local development   |
| `pnpm build`             | ✅    | -        | -         | Safe, compilation         |
| `pnpm lint`              | ✅    | -        | -         | Safe, code quality        |
| Add code to `apps/api`   | ✅    | -        | -         | Safe, development         |
| Add code to `apps/web`   | ✅    | -        | -         | Safe, development         |
| Add code to `packages/*` | ✅    | -        | -         | Safe, development         |
| Modify `.gitignore`      | ✅    | -        | -         | Safe, safe to revert      |
| Modify `package.json`    | ✅    | -        | -         | Safe, dependency tracking |
| Commit to git            | ✅    | -        | -         | Safe with message         |
| Push to GitHub           | ✅    | -        | -         | Safe, public repo         |
| Hardcode secrets in code | -     | -        | ❌        | Use .env instead          |
| Commit .env              | -     | -        | ❌        | Use .env.example          |
| Delete `apps/`           | -     | ⚠️       | -         | Approval + snapshot       |
| Delete `packages/`       | -     | ⚠️       | -         | Approval + snapshot       |

---

## SERVICE OPERATIONS (Docker)

| Operation                          | Allow | Approval | Forbidden | Notes                   |
| ---------------------------------- | ----- | -------- | --------- | ----------------------- |
| `docker compose ps`                | ✅    | -        | -         | Status check            |
| `docker compose logs`              | ✅    | -        | -         | Log inspection          |
| `docker compose restart [service]` | -     | ⚠️       | -         | Brief downtime          |
| `docker compose stop [service]`    | -     | ⚠️       | -         | Service unavailable     |
| `docker compose down`              | -     | ⚠️       | -         | All services down       |
| `docker compose up -d`             | -     | ⚠️       | -         | After down, restart all |
| Modify `docker-compose.yml`        | -     | ⚠️       | -         | Must snapshot first     |
| `docker image prune -a`            | -     | ⚠️       | -         | May break containers    |
| `docker volume rm`                 | -     | ⚠️       | -         | Data deletion           |
| `docker rm [container]`            | -     | ⚠️       | -         | Container deletion      |
| `docker system prune`              | -     | ⚠️       | -         | Broad cleanup           |
| `docker pull [image]`              | ✅    | -        | -         | Safe, only downloads    |
| `docker rmi [image]` (unused)      | -     | ⚠️       | -         | Image deletion          |
| `docker compose down -v`           | -     | -        | ❌        | Deletes volumes         |

---

## PACKAGE MANAGEMENT

| Operation                        | Allow | Approval | Forbidden | Notes                               |
| -------------------------------- | ----- | -------- | --------- | ----------------------------------- |
| `apt update`                     | ✅    | -        | -         | Safe, refresh only                  |
| `apt list --upgradable`          | ✅    | -        | -         | Inspection                          |
| `apt install [package]`          | -     | ⚠️       | -         | First time install OK, but approval |
| `apt upgrade`                    | -     | ⚠️       | -         | May break services                  |
| `apt full-upgrade`               | -     | ⚠️       | -         | Major updates                       |
| `apt autoremove`                 | -     | ⚠️       | -         | May remove dependencies             |
| `pip install [package]`          | ✅    | -        | -         | If in isolated venv                 |
| `pip install [package]` (system) | -     | ⚠️       | -         | May conflict                        |
| `apt remove [package]`           | -     | ⚠️       | -         | Removal risk                        |

---

## ZFS OPERATIONS

| Operation                       | Allow | Approval | Forbidden | Notes               |
| ------------------------------- | ----- | -------- | --------- | ------------------- |
| `zfs list`                      | ✅    | -        | -         | Inspection          |
| `zfs list -t snapshot`          | ✅    | -        | -         | Inspection          |
| `zpool status tank`             | ✅    | -        | -         | Health check        |
| `zfs snapshot -r tank@name`     | -     | ⚠️       | -         | Planning checkpoint |
| `zfs rollback -r tank@name`     | -     | ⚠️       | -         | Data recovery       |
| `zfs set [property] tank`       | -     | ⚠️       | -         | Pool settings       |
| `zfs create tank/dataset`       | -     | ⚠️       | -         | New dataset         |
| `zfs destroy tank/dataset`      | -     | ⚠️       | -         | Deletion risk       |
| `zfs destroy -r tank/*`         | -     | -        | ❌        | All data deletion   |
| `zpool destroy tank`            | -     | -        | ❌        | Total data loss     |
| `zpool import`                  | -     | ⚠️       | -         | Pool recovery       |
| `zpool export`                  | -     | ⚠️       | -         | Export pool         |
| `wipefs -af /dev/nvme*`         | -     | -        | ❌        | Disk wipe           |
| `dd if=/dev/zero of=/dev/nvme*` | -     | -        | ❌        | Raw wipe            |

---

## NETWORK & FIREWALL

| Operation                           | Allow | Approval | Forbidden | Notes                         |
| ----------------------------------- | ----- | -------- | --------- | ----------------------------- |
| `ip addr show`                      | ✅    | -        | -         | Inspection                    |
| `ip route show`                     | ✅    | -        | -         | Inspection                    |
| `netstat -tlnp`                     | ✅    | -        | -         | Inspection                    |
| `ufw status`                        | ✅    | -        | -         | Status check                  |
| `ufw allow [port]`                  | -     | ⚠️       | -         | Firewall rule                 |
| `ufw deny [port]`                   | -     | ⚠️       | -         | Firewall rule                 |
| `ufw enable`                        | -     | -        | ❌        | Lockout risk (needs ssh rule) |
| `ufw reset`                         | -     | -        | ❌        | Lockout risk                  |
| `ip route add`                      | -     | ⚠️       | -         | Routing change                |
| `systemctl start cloudflare-tunnel` | -     | ⚠️       | -         | Remote access activation      |

---

## SYSTEM CRITICAL

| Operation                     | Allow | Approval | Forbidden | Notes                              |
| ----------------------------- | ----- | -------- | --------- | ---------------------------------- |
| `systemctl status docker`     | ✅    | -        | -         | Status check                       |
| `systemctl restart docker`    | -     | ⚠️       | -         | Brief outage                       |
| `systemctl stop docker`       | -     | ⚠️       | -         | All services down                  |
| `systemctl enable [service]`  | -     | ⚠️       | -         | Auto-start config                  |
| `systemctl disable [service]` | -     | ⚠️       | -         | Auto-start removal                 |
| `reboot`                      | -     | -        | ❌        | Only with explicit approval + plan |
| `poweroff`                    | -     | -        | ❌        | Only with explicit approval        |
| `sudo visudo`                 | -     | ⚠️       | -         | Sudo config, high risk             |
| `deluser $(whoami) sudo`      | -     | -        | ❌        | Removes all access                 |
| `grub-mkconfig`               | -     | -        | ❌        | Boot config, risky                 |

---

## FILE OPERATIONS (Destructive)

| Operation                       | Allow | Approval | Forbidden | Notes                 |
| ------------------------------- | ----- | -------- | --------- | --------------------- |
| `mkdir /srv/newdir`             | ✅    | -        | -         | Safe, non-destructive |
| `touch /srv/file.txt`           | ✅    | -        | -         | Safe, non-destructive |
| `cp /src /dst`                  | ✅    | -        | -         | Safe, non-destructive |
| `rm /srv/ops/old-doc.md`        | -     | ⚠️       | -         | Document deletion     |
| `rm -rf /srv/monorepo/apps/old` | -     | ⚠️       | -         | Code deletion         |
| `rm -rf /srv/data/postgres/*`   | -     | -        | ❌        | Data deletion         |
| `rm -rf /srv/backups/*`         | -     | -        | ❌        | Backup deletion       |
| `rm -rf /srv/docker-data/*`     | -     | -        | ❌        | Docker state deletion |
| `rm -rf /srv/*`                 | -     | -        | ❌        | Complete /srv wipe    |

---

## VOICE PIPELINE SERVICES

### Voice Pipeline Services

| Operation             | Service            | Can Execute          | Requires Approval  |
| --------------------- | ------------------ | -------------------- | ------------------ |
| TTS Bridge restart    | zappro-tts-bridge  | Autoheal (3/h limit) | Principal Engineer |
| Voice change          | pm_santa / pf_dora | NEVER                | Principal Engineer |
| Hermes Agent config edit  | Hermes Agent-qgtzrmi   | NEVER                | Principal Engineer |
| Kokoro container stop | zappro-kokoro      | NEVER                | Principal Engineer |
| wav2vec2 STT change   | zappro-wav2vec2    | NEVER                | Principal Engineer |

---

## SUMMARY TABLE (By Risk Level)

### SAFE (No approval needed)

✅ All read-only operations
✅ Backups and snapshots
✅ Documentation updates
✅ Application development (monorepo)
✅ Package list/update check
✅ Status inspections

### APPROVAL REQUIRED (⚠️)

⚠️ Service restart/stop/down
⚠️ Docker image/volume management
⚠️ Package install/upgrade/remove
⚠️ ZFS property changes
⚠️ ZFS snapshot/rollback
⚠️ File deletion (non-data)
⚠️ Network/firewall changes
⚠️ Config file edits (/etc)
⚠️ Systemd service management

### FORBIDDEN (❌)

❌ Disk wipe operations (wipefs, dd)
❌ ZFS pool destruction
❌ Delete /srv/data (any variant)
❌ Delete /srv/backups
❌ Delete /srv/docker-data
❌ Reboot/poweroff without plan
❌ Enable firewall without ssh rule
❌ Delete-without-backup operations

---

**Last Updated:** 2026-04-12
**Enforcement:** Check before every action
**Questions:** Consult CONTRACT.md, GUARDRAILS.md, or ask human
