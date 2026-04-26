# Runbooks — Operational Procedures

**Version:** 1.0.0 | **Updated:** 2026-04-25

---

## Index

| Runbook | Purpose | Frequency |
|---------|---------|-----------|
| [HEALTH_CHECK.md](HEALTH_CHECK.md) | Service health verification | Daily |
| [INCIDENT_RESPONSE.md](INCIDENT_RESPONSE.md) | P1/P2 incident handling | As needed |
| [BACKUP_RESTORE.md](BACKUP_RESTORE.md) | Backup and restore procedures | Monthly test |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Service deployment guide | As needed |

---

## Quick Commands

```bash
# Health check
nexus-investigate.sh all 3

# Alert list
nexus-alert.sh list

# Context status
nexus-context-window-manager.sh status

# Legacy scan
nexus-legacy-detector.sh full /srv/monorepo
```

---

## Severity Levels

| Level | Response | Escalation |
|-------|----------|------------|
| P1 | 15 min | Immediate |
| P2 | 1 hour | Team lead |
| P3 | 4 hours | On-duty |
| P4 | 24 hours | Next day |

---

**Owner:** Platform Engineering
**Nexus Framework:** docs/NEXUS-SRE-GUIDE.md
