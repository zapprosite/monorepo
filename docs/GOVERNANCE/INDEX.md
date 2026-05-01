# Governance Index

Classification: INTERNAL
Owner: Platform Engineering
Status: canonical index
Updated: 2026-05-01

This index is the minimum routing table for current governance documentation in
`/srv/monorepo`. When a broad or historical document conflicts with a canonical
governance document, use the canonical document listed here until the conflict is
explicitly reconciled.

## Operating Rules

- Agent instructions: `AGENTS.md`
- Primary Claude instructions: `CLAUDE.md`
- Hardware and service ownership: `HARDWARE_HIERARCHY.md`
- Deployment boundaries: `docs/GOVERNANCE/DEPLOYMENT-BOUNDARIES.md`
- Change approvals: `docs/GOVERNANCE/APPROVAL_MATRIX.md`
- Locked configuration: `docs/GOVERNANCE/LOCKED-CONFIG.md`
- Immutable services: `docs/GOVERNANCE/IMMUTABLE-SERVICES.md`
- Duplicate service policy: `docs/GOVERNANCE/DUPLICATE-SERVICES-RULE.md`

## Security And Secrets

- Security baseline: `docs/GOVERNANCE/SECURITY.md`
- Guardrails: `docs/GOVERNANCE/GUARDRAILS.md`
- Governance contract: `docs/GOVERNANCE/CONTRACT.md`
- Secrets policy: `docs/GOVERNANCE/SECRETS_POLICY.md`
- Secrets patterns: `docs/GOVERNANCE/SECRETS-PATTERNS.md`
- Environment management: `docs/GOVERNANCE/env-management.md`
- Infisical pattern: `docs/GOVERNANCE/INFISICAL-SDK-PATTERN.md`
- Cloudflare credentials architecture: `docs/CLOUDFLARE_SETUP.md`

## Infrastructure Registry

- Service catalog: `docs/GOVERNANCE/SERVICE_CATALOG.md`
- Ports: `docs/GOVERNANCE/PORTS.md`
- Subdomains: `docs/GOVERNANCE/SUBDOMAINS.md`
- Network map: `docs/GOVERNANCE/NETWORK_MAP.md`
- Service map: `docs/GOVERNANCE/SERVICE_MAP.md`
- Docker network topology: `docs/GOVERNANCE/DOCKER-NETWORK-TOPOLOGY.md`
- Cloudflared status: `docs/GOVERNANCE/CLOUDFLARED-STATUS.md`
- Pinned services: `docs/GOVERNANCE/PINNED-SERVICES.md`

## Data, Backup, And Recovery

- Database governance: `docs/GOVERNANCE/DATABASE_GOVERNANCE.md`
- Database history: `docs/GOVERNANCE/DB_HISTORY.md`
- Backup and recovery: `docs/GOVERNANCE/BACKUP-RECOVERY.md`
- Backup status: `docs/GOVERNANCE/BACKUP-STATUS.md`
- Backup runbook: `docs/GOVERNANCE/backup-runbook.md`
- Disaster recovery: `docs/GOVERNANCE/DISASTER-RECOVERY.md`
- Recovery: `docs/GOVERNANCE/RECOVERY.md`
- Rollback: `docs/GOVERNANCE/ROLLBACK.md`

## Nexus And AI Context

- Nexus architecture: `docs/GOVERNANCE/NEXUS-VIBEKIT-ARCHITECTURE.md`
- Nexus standards: `docs/GOVERNANCE/NEXUS-STANDARDS.md`
- Nexus audit: `docs/GOVERNANCE/NEXUS-AUDIT.md`
- Nexus monitoring: `docs/GOVERNANCE/NEXUS-MONITORING.md`
- Nexus second-brain flow: `docs/GOVERNANCE/NEXUS-SECOND-BRAIN-FLOW.md`
- AI context sync: `docs/GOVERNANCE/AI-CONTEXT.md`
- Context sync workflow: `docs/GOVERNANCE/CONTEXT-SYNC-WORKFLOW.md`
- Memory writeback workflow: `docs/GOVERNANCE/MEMORY-WRITEBACK-WORKFLOW.md`

## Specs And Debt Tracking

- Risk register: `docs/GOVERNANCE/RISK_REGISTER.md`
- Commit readiness checklist: `docs/GOVERNANCE/COMMIT-READINESS.md`
- Legacy prune manifest: `docs/GOVERNANCE/LEGACY-PRUNE-MANIFEST.md`
- Specs index: `docs/SPECS/INDEX.md`
- Active specs: `docs/SPECS/ACTIVE.md`
- Placeholder debt cleanup: `docs/SPECS/SPEC-206-placeholder-debt-cleanup.md`
- Placeholder debt allowlist: `docs/GOVERNANCE/placeholder-debt-allowlist.txt`
- Quality gate waivers: `docs/GOVERNANCE/quality-gate-waivers.txt`
- Documentation freshness check: `scripts/docs-stale-check.sh`

## Observability Reports

- Markdown report policy: `docs/GOVERNANCE/OBSERVABILITY-REPORTS.md`
- SRE report generator: `scripts/sre-markdown-report.sh`
- Delivery target when enabled: Hermes to Telegram `CEO_REFRIMIX_bot`

## Review Queue

These documents still need focused reconciliation before they can be considered
canonical or historical redirects:

- `docs/GOVERNANCE/ARCHITECTURE-MASTER.md`
- `docs/GOVERNANCE/backup-runbook.md`
- `docs/GOVERNANCE/hvac-web-search-providers.md`

## Historical Redirects

These files are historical redirects, not sources of truth:

- `docs/CLAUDE.md`
- `docs/RAG_ARCHITECTURE.md`
- `docs/ARCHITECTURE-OVERVIEW.md`

Do not use historical redirects to justify runtime, security, network, or
architecture changes. Follow the canonical documents above, or open a SPEC/ADR
when the current source of truth is missing or contradictory.
