# Service Catalog

Classification: INTERNAL
Owner: Platform Engineering
Status: canonical seed
Updated: 2026-05-01

This catalog is the SRE routing table for service ownership and operational
classification. It does not authorize runtime, port, DNS, tunnel, Coolify, or
systemd changes. Verify against `PORTS.md`, `SUBDOMAINS.md`, and
`DEPLOYMENT-BOUNDARIES.md` before changing exposure.

## Required Fields

Every production service entry should declare:

- Service name
- Owner
- Runtime boundary
- Exposure class: private, internal, protected-public, or public
- State class: stateless or stateful
- Port or domain reference
- Health signal
- Backup owner
- Runbook

## Core Services

| Service | Owner | Runtime boundary | Exposure | State | Port/domain reference | Health signal | Backup owner | Runbook |
|---|---|---|---|---|---|---|---|---|
| Nexus | Platform Engineering | bare metal / scripts | internal | stateful | `AGENTS.md`, `NEXUS-VIBEKIT-ARCHITECTURE.md` | `nexus.sh --status` | Platform Engineering | `NEXUS-ERROR-PLAYBOOK.md` |
| Hermes | Platform Engineering | bare metal | internal | stateful | `AGENTS.md`, `SERVICE_MAP.md` | Hermes health/report scripts | Platform Engineering | `NEXUS-SECOND-BRAIN-FLOW.md` |
| LiteLLM | Platform Engineering | core infra | internal | stateful | `PORTS.md`, `SUBDOMAINS.md` | API health check | Platform Engineering | `SERVICE_MAP.md` |
| Qdrant | Platform Engineering | core infra | private | stateful | `PORTS.md`, `SUBDOMAINS.md` | collection/API check | Platform Engineering | `DATABASE_GOVERNANCE.md` |
| Postgres | Platform Engineering | core infra | private | stateful | `PORTS.md` | DB connectivity check | Platform Engineering | `backup-runbook.md` |
| Redis | Platform Engineering | core infra | private | stateful | `PORTS.md` | ping/check script | Platform Engineering | `REDIS.md` |
| Gitea | Platform Engineering | core infra | protected-public | stateful | `SUBDOMAINS.md` | web/API health | Platform Engineering | `SERVICE_MAP.md` |
| Coolify | Platform Engineering | app publisher | protected-public | stateful | `SUBDOMAINS.md` | dashboard/API health | Platform Engineering | `DEPLOYMENT-BOUNDARIES.md` |
| Ollama | Platform Engineering | bare metal systemd | internal | stateless cache | `PORTS.md` `:11434` | API/model process check | n/a | `SERVICE_MAP.md` |
| OpenClaw Bot | Platform Engineering | Coolify managed | public | stateful config | `SUBDOMAINS.md`, `SERVICE_MAP.md` | container log/health evidence | Platform Engineering | `WORKFLOW.md` |
| n8n | Platform Engineering | legacy Docker stack | legacy | stateful | `SUBDOMAINS.md`, `SERVICE_MAP.md` | documented `/api/v1/health` | Platform Engineering | `SERVICE_MAP.md` |
| Infisical | Platform Engineering | legacy core infra | legacy | stateful | `SUBDOMAINS.md`, `PORTS.md` | service health check | Platform Engineering | `SECRETS-MANDATE.md` |
| Monitoring stack | Platform Engineering | Docker stack | protected-public | stateful metrics | `SERVICE_MAP.md`, `SUBDOMAINS.md` | Prometheus/Grafana exporter checks | Platform Engineering | `MONITORING.md` |
| Edge TTS bridge | Platform Engineering | Docker service | internal | stateless | `PORTS.md`, `SERVICE_MAP.md` | HTTP service check | n/a | `SERVICE_MAP.md` |
| Open WebUI | Platform Engineering | Coolify managed | protected-public | stateful | `SUBDOMAINS.md` | app health check | Platform Engineering | `OPENWEBUI-HVAC-MULTIMODAL-ARCHITECTURE.md` |
| Claude Code Panel | Platform Engineering | static/nginx | protected-public | stateless | `SUBDOMAINS.md`, `PORTS.md` | HTTP status check | n/a | `SERVICE_MAP.md` |

## Application Services

| Service | Owner | Runtime boundary | Exposure | State | Port/domain reference | Health signal | Backup owner | Runbook |
|---|---|---|---|---|---|---|---|---|
| `apps/api` | Platform Engineering | app workspace | internal | stateless | app docs / `PORTS.md` | typecheck/build plus service health | Platform Engineering | app README |
| `apps/ai-gateway` | Platform Engineering | app workspace | internal | stateless | app docs / `PORTS.md` | API health check | Platform Engineering | app README |
| `apps/monitoring` | Platform Engineering | app workspace | internal | stateless | app docs / `SERVICE_MAP.md` | build/service health | Platform Engineering | app README |
| `packages/email` | Platform Engineering | package workspace | n/a | stateless | n/a | `pnpm --filter @repo/email check-types` | n/a | package README |

## Known Drift To Reconcile

| Topic | Evidence | Risk | Next action |
|---|---|---|---|
| Qdrant exposure | `SUBDOMAINS.md` lists `qdrant.zappro.site`; core policy says stateful services stay private | Critical data exposure if public route remains unprotected | Require approved network-change SPEC before tunnel/DNS edits |
| `monitor.zappro.site` classification | `SUBDOMAINS.md` says active and LAN only in description | Ambiguous public/LAN boundary | Reconcile Cloudflare Access and tunnel evidence in separate review |
| Open WebUI `chat.zappro.site` history | `SUBDOMAINS.md` has conflicting recent-change notes | Operator may follow stale route state | Reconcile in docs-only pass before runtime changes |
| Legacy CapRover entries | `SERVICE_MAP.md` includes CapRover while `PORTS.md` says ports removed/substituted by Coolify | Confusing deployment authority | Keep Coolify as current publisher unless approved otherwise |
| Legacy n8n and Infisical entries | User correction on 2026-05-01 marks both as legacy | Catalog may imply active ownership if not labeled | Keep legacy classification until verified in a separate runtime audit |

## Evidence Sources

- `docs/GOVERNANCE/SERVICE_MAP.md`
- `docs/GOVERNANCE/PORTS.md`
- `docs/GOVERNANCE/SUBDOMAINS.md`
- `docs/GOVERNANCE/DEPLOYMENT-BOUNDARIES.md`
- `docs/GOVERNANCE/DATABASE_GOVERNANCE.md`
- `docs/GOVERNANCE/RISK_REGISTER.md`

## Catalog Rules

- A service with public or protected-public exposure must have a subdomain entry.
- A service with an exposed port must have a port registry entry.
- A stateful service must have backup ownership and restore guidance.
- A compose service under `services/` must have a healthcheck unless explicitly waived.
- Local agent artifacts, local compose experiments, and unapproved runtime files do not belong in this catalog.
- `legacy` means retained for historical/operational reference only; do not use it
  as proof of active runtime without a separate approved verification.
