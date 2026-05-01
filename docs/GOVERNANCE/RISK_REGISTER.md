# Risk Register

Classification: INTERNAL
Owner: Platform Engineering
Status: canonical seed
Updated: 2026-05-01

This register tracks SRE risks that need ownership, mitigation, and review. It
does not authorize runtime, DNS, tunnel, systemd, Coolify, or dependency changes.

## Severity

- Critical: service loss, data loss, secret exposure, or unsafe public exposure.
- High: likely production incident or broad operational drift.
- Medium: contained operational risk or quality drift.
- Low: housekeeping risk with low blast radius.

## Open Risks

| ID | Risk | Severity | Probability | Blast radius | Mitigation | Owner | Status |
|---|---|---|---|---|---|---|---|
| RISK-001 | Public route drift for stateful services | Critical | Medium | Qdrant/core data exposure | Keep stateful services private; require approval before route changes | Platform Engineering | Open |
| RISK-002 | Governance docs conflict or stale source of truth | High | High | Operators follow wrong runbook or registry | Use `INDEX.md`, redirects, and docs freshness review | Platform Engineering | Open |
| RISK-003 | Local runtime artifacts entering commits | Medium | Medium | Dirty source tree, config leakage, broken gates | Ignore local artifacts and enforce with quality gates | Platform Engineering | Mitigated |
| RISK-004 | Compose files without healthchecks | High | Medium | Failed services are not detected | Enforce compose healthcheck gate or explicit waiver | Platform Engineering | Mitigated |
| RISK-005 | Dependency drift in lockfile | Medium | Medium | Build/runtime instability or known vulnerable package | Track dependency cleanup in separate PR | Platform Engineering | Open |
| RISK-006 | Backup restore guidance not recently validated | Critical | Medium | Data recovery failure | Add restore test date and verification command to runbooks | Platform Engineering | Open |
| RISK-007 | Telegram report delivery depends on env and bot health | Medium | Low | Missed operational summary | Generate Markdown locally first; send only with env presence checks | Platform Engineering | Open |
| RISK-008 | Legacy services still appear in active registries | Medium | High | Operators may treat n8n or Infisical as active without verification | Mark legacy in catalog and reconcile registries in a docs-only pass before runtime changes | Platform Engineering | Open |

## Review Rules

- Review this file before approving infra, runtime, network, or stateful-service changes.
- Add a risk entry when a finding cannot be fixed in the same PR.
- Close a risk only when mitigation is verified by command output, test, or reviewed documentation.
