# SPEC-205: Homelab Awakening Gap Audit

**Status:** active
**Owner:** Platform Engineering
**Created:** 2026-05-01
**Snapshot:** `tank/monorepo@pre-20260501-141210-homelab-awakening-governance`

## Objective

Capture the read-only diagnosis from the Enterprise Homelab Awakening pass and turn the findings into governed remediation work. This SPEC does not authorize destructive cleanup, service restarts, tunnel changes, DNS changes, or state deletion.

## Findings

| Gap | Evidence | Required action | Approval |
|---|---|---|---|
| Trieve compose had hardcoded secret material | `services/docker-compose.trieve.yml` used literal database, Redis, OIDC, and service secret values | Replace with `.env` interpolation and document all variables in `.env.example` | Done for config text only; runtime redeploy requires normal deploy approval |
| `.env.example` included a concrete `DATABASE_URL` | `.env.example` had a non-placeholder database URL | Use `${DATABASE_URL}` only | Done |
| Bridge compose carried credential fallbacks | `docs/GOVERNANCE/SKILLS/docker-compose.bridge.yml` used non-empty `${VAR:-...}` fallbacks for OpenClaw credentials | Use empty defaults only and require real values through environment/Infisical | Done for config text only |
| Governance docs are referenced from stale paths | Requested `ops/ai-governance/CONTRACT.md`, `GUARDRAILS.md`, `PARTITIONS.md`; actual files live in `docs/GOVERNANCE/` | Update agent/docs references or add explicit forwarding docs | Partially done for top-level agent docs |
| Deployment boundaries path drift | Requested `docs/REFERENCE/DEPLOYMENT-BOUNDARIES.md`; actual file is `docs/GOVERNANCE/DEPLOYMENT-BOUNDARIES.md` | Reconcile path in indexes and AGENTS references | Partially done for top-level agent docs |
| Qdrant public route drift | `SUBDOMAINS.md` marks `qdrant.zappro.site` deprecated, but local cloudflared config still routes it | Remove from tunnel config and verify DNS/Terraform state | Requires network-change approval and snapshot |
| Port registry drift | Runtime `ss -tlnp` differs from `ops/ai-governance/PORTS.md` for Coolify, Mem0, orchestrator, pgAdmin, exporters, and dev/runtime ports | Update PORTS.md from measured state | Requires infra-doc review |
| Docker healthcheck gaps | Several running containers have `NO_HEALTHCHECK` | Add healthchecks or document waivers per service | Pending |
| Service SPEC coverage is incomplete | Runtime services do not all map cleanly to one active SPEC per service/domain | Create or merge service/domain SPECs | Pending |

## Runtime Health Snapshot

Local smoke probes returned HTTP 200 for Hermes Gateway, Hermes Orchestrator, Mem0, Qdrant, Trieve proxy, Trieve server, OpenWebUI, pgAdmin, Grafana, Prometheus, Alertmanager, Gitea, Coolify, Edge TTS, and Ollama. LiteLLM `/health` returned HTTP 401, which indicates the endpoint is reachable but auth-gated.

## Quality Gates

The first gate is intentionally narrow and non-destructive:

- fail on hardcoded secret-like values in `.env.example`
- fail on hardcoded secret-like values in docker-compose files
- fail when compose services lack a healthcheck unless explicitly waived

The gate does not inspect `.env`, secret directories, data directories, logs, databases, or Qdrant storage.

## Out of Scope

- Removing `qdrant.zappro.site` from active tunnel config
- Deleting orphaned files or services
- Restarting, redeploying, or recreating containers
- Reading real secret values
- Moving root docs into `docs/`

## Acceptance Criteria

- [x] Hardcoded Trieve compose secrets are replaced with environment interpolation.
- [x] New Trieve variables are documented in `.env.example`.
- [x] CI quality gate exists for secret placeholder and compose healthcheck regressions.
- [ ] Qdrant public route removal has an approved change proposal.
- [ ] PORTS.md is reconciled with current `ss -tlnp`.
- [ ] Every runtime service maps to a SPEC, smoke test, and runbook or has an explicit waiver.
