# Documentation Index

**Version:** 1.0.0 | **Updated:** 2026-04-25 | **Owner:** Platform Engineering

---

## Quick Navigation

| Category | What You Need | Doc |
|---------|---------------|-----|
| **Start Here** | Overview of the monorepo | [README.md](../README.md) |
| **Start Here** | Agent instructions | [CLAUDE.md](../CLAUDE.md) |
| **Start Here** | Full infrastructure map | [AGENTS.md](../AGENTS.md) |
| **Operations** | SRE automation | [NEXUS-SRE-GUIDE.md](./NEXUS-SRE-GUIDE.md) |
| **Operations** | Runbooks | [runbooks/README.md](./runbooks/README.md) |
| **Architecture** | System overview | [ARCHITECTURE-OVERVIEW.md](./ARCHITECTURE-OVERVIEW.md) |
| **Architecture** | Stable architecture | [ARCHITECTURE-STABLE.md](./ARCHITECTURE-STABLE.md) |
| **Features** | All specifications | [SPECS/INDEX.md](./SPECS/INDEX.md) |
| **Reference** | Scripts catalog | [SCRIPTS_CATALOG.md](./SCRIPTS_CATALOG.md) |

---

## Documentation Structure

```
docs/
├── README.md                    ← THIS FILE
├── ARCHITECTURE-OVERVIEW.md    ← System overview
├── ARCHITECTURE-STABLE.md      ← Stable architecture reference
├── NEXUS-SRE-GUIDE.md         ← SRE automation guide
├── runbooks/                   ← Operational runbooks
│   ├── README.md
│   ├── HEALTH_CHECK.md
│   ├── INCIDENT_RESPONSE.md
│   ├── BACKUP_RESTORE.md
│   └── DEPLOYMENT.md
├── SPECS/                     ← Feature specifications
│   ├── INDEX.md               ← SPEC index
│   └── SPEC-*.md             ← Individual specs
├── ADRs/                      ← Architecture Decision Records
├── GOVERNANCE/                ← Security and operational governance
├── GUIDES/                    ← How-to guides
└── ops/                       ← Infrastructure operations
```

---

## Enterprise Standards

### Header Format
```markdown
---
title: <Document Title>
description: <Short description>
version: 1.0.0
status: production|draft|review
owner: <team>
lastUpdated: YYYY-MM-DD
---
```

### Document Types

| Type | Purpose | Template |
|------|---------|----------|
| **Architecture** | System design | [ARCHITECTURE-STABLE.md](./ARCHITECTURE-STABLE.md) |
| **Runbook** | Operational procedure | [runbooks/README.md](./runbooks/README.md) |
| **SPEC** | Feature specification | [SPECS/INDEX.md](./SPECS/INDEX.md) |
| **ADR** | Decision record | [ADRs/](./ADRs/) |
| **Guide** | How-to | [GUIDES/](./GUIDES/) |

---

## Key References

### Security
- [SECRETS-CLEANUP.md](./SECRETS-CLEANUP.md) — Secrets cleanup runbook
- [SECURITY_ARCHITECTURE.md](./SECURITY_ARCHITECTURE.md) — Security overview

### Infrastructure
- [NEXUS-SRE-GUIDE.md](./NEXUS-SRE-GUIDE.md) — SRE automation
- [OBSERVABILITY.md](./OBSERVABILITY.md) — Monitoring and metrics
- [FAULT_TOLERANCE.md](./FAULT_TOLERANCE.md) — Resilience patterns

### Development
- [CICD.md](./CICD.md) — CI/CD pipeline
- [SKILL_TAXONOMY.md](./SKILL_TAXONOMY.md) — Agent skills taxonomy

---

## Maintenance

### Updating Docs
1. Follow header format above
2. Update `lastUpdated` date
3. Update version if breaking change
4. Commit with appropriate type (`docs:`, `feat:`, `fix:`)

### Doc Review Checklist
- [ ] All links valid
- [ ] Header complete (version, status, owner, date)
- [ ] No hardcoded secrets
- [ ] Commands tested
- [ ] Examples verified

---

## Contact

| Role | Contact |
|------|---------|
| Platform Lead | @will |
| SRE On-Call | NEXUS auto-escalate |
| Documentation | Docs Team |
