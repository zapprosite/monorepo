# CHANGELOG.md — Homelab Monorepo

**Last Updated:** 2026-04-25

---

## [v2.0.0] — 2026-04-25 — Enterprise SRE Polish

### Added
- **CHANGELOG.md** — Change tracking
- **ROADMAP.md** — 2026 planning
- **docs/runbooks/** — Operational procedures
- **SPECs/INDEX.md** — Organized SPECs directory
- Mermaid architecture diagram in README.md

### Changed
- **AGENTS.md** — Full infrastructure map (/srv + /home/will)
- **CLAUDE.md** — Complete infrastructure topology
- **README.md** — Enterprise landing page with badges
- **NEXUS-SRE-GUIDE.md** — Enhanced with escalation matrix
- **hermes-second-brain/CLAUDE.md** — Complete architecture docs

### Fixed
- `docker-compose.yml` → archived (was in root)
- 4 near-empty `.d.ts` files removed
- Architecture violations: 0
- Empty files: 0

### Archived
- `/srv/archive/apps.monitoring/` — Orphaned monitoring config
- `/srv/archive/hvac/` — Empty HVAC project

---

## [v1.0.0] — 2026-04-21 — Initial Enterprise Setup

### Added
- Nexus SRE Framework (7×7=49 agents)
- Hermes + Mem0 integration
- Qdrant Vector DB
- LiteLLM multi-provider gateway
- Gitea CI/CD

---

## [v0.0.1] — 2024 — Inception

### Added
- Monorepo structure
- Basic apps (api, web, fit-v3)
- First documentation
