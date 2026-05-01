# SPEC-206: Placeholder Debt Cleanup

Classification: INTERNAL
Status: accepted
Owner: Platform Engineering
Created: 2026-05-01
Accepted: 2026-05-01

## Scope

Read-only audit of placeholder/TODO/stub/mock/deprecated style findings in `/srv/monorepo`, excluding `.env`, `.env.*`, `.git`, secrets, data, logs, Qdrant storage, and database files. This SPEC authorizes planning only; it does not authorize code cleanup, deletion, service restarts, tunnel changes, DNS changes, dependency upgrades, or snapshot operations.

## Verification Command

```bash
rg -n --hidden \
  --glob '!.git/**' \
  --glob '!.env' \
  --glob '!.env.*' \
  --glob '!**/secrets/**' \
  --glob '!**/data/**' \
  --glob '!**/logs/**' \
  --glob '!**/qdrant_storage/**' \
  --glob '!**/*.db' \
  --glob '!**/*.sqlite' \
  -i '\b(TODO|FIXME|HACK|placeholder|stub|mock|dummy|lorem|junior|obsolete|obsoleto|deprecated)\b' .
```

## Classified Findings

| File | Lines | Category | Reason | Recommended action |
|---|---:|---|---|---|
| `HARDWARE_HIERARCHY.md` | 149,150,190,197,198 | documented_debt | Infra unknowns and Qdrant exposure are intentionally tracked. | Keep until SPEC-205 infra reconciliation closes. |
| `.github/workflows/README.md` | 1 | stale_doc | Says GitHub workflows moved, but workflow YAML still exists. | Reconcile `.github/` vs `.gitea/` policy in a small docs/CI PR. |
| `.github/workflows/pr-check.yml` | 23 | actionable_debt | Deprecated GitHub workflow still contains pnpm TODO. | Either remove/archive with approval or fix if GitHub Actions remains active. |
| `.github/workflows/dependency-review.yml` | 32 | actionable_debt | Deprecated workflow still runs a manual deprecation check. | Decide whether GitHub Actions is intentionally disabled; then delete/archive or maintain. |
| `docs/CLAUDE.md` | 109,111,112,113,114,123,124,128,130,131,133,136,142,145,147,148,150,151,152,177,396 | documented_debt | Tool maturity model explicitly marks stub/mock behavior. | Convert to active SPEC tasks or archive if superseded by newer governance. |
| `docs/SPECS/SPEC-024-UNIFIED-CLAUDE-AGENT-MONOREPO.md` | 502,506,607 | documented_debt | SPEC documents `.github/workflows/` deprecation. | Use as authority when cleaning `.github/`. |
| `docs/SPECS/SPEC-028-swarm-mvp-wiring-fixes.md` | 24,71,90,108,140,239 | documented_debt | Planned wiring/circuit-breaker work. | Leave as SPEC debt until executed. |
| `docs/SPECS/SPEC-029-library-audit.md` | 74 | documented_debt | Stripe deprecated global API key pattern documented. | Track through Stripe migration work. |
| `docs/SPECS/SPEC-030-stripe-v80-v84-migration.md` | 140 | false_positive | Mocking Stripe client for tests is legitimate. | Allowlist `mock` in test-strategy docs. |
| `docs/SPECS/SPEC-202-hermes-second-brain-systemd.md` | 12 | documented_debt | Service gap is explicitly documented. | Resolve via systemd SPEC execution, not cleanup. |
| `docs/SPECS/SPEC-204.md` | 530,531,532,533 | documented_debt | TODO checklist inside an active SPEC. | Leave until SPEC tasks complete. |
| `docs/SPECS/SPEC-205-homelab-awakening-gap-audit.md` | 17,21,52 | documented_debt | Prior audit already records placeholder/Qdrant/deprecation issues. | Cross-link SPEC-206 to SPEC-205 during cleanup. |
| `docs/SPECS/INDEX.md` | 96 | false_positive | Archive index uses `deprecated specs` as taxonomy. | Allowlist docs/SPECS index text. |
| `docs/GOVERNANCE/DEPLOYMENT-BOUNDARIES.md` | 11,59,66 | documented_debt | Governance requires TODO for unknown infra state. | Keep until infra state is verified. |
| `docs/GOVERNANCE/NEXUS-VIBEKIT-ARCHITECTURE.md` | 22,56,71 | documented_debt | Placeholder labels are explicit status states. | Keep; only update after smoke evidence exists. |
| `docs/GOVERNANCE/NEXUS-AUDIT.md` | 28,49 | documented_debt | Runtime audit uses PLACEHOLDER as controlled status. | Keep as quality-gate allowlist. |
| `docs/GOVERNANCE/VIBEKIT-AUDIT.md` | 25,26 | documented_debt | Residual risks are intentionally tracked. | Keep until OpenCode and metrics are implemented. |
| `docs/GOVERNANCE/NEXUS-MONITORING.md` | 4,26 | documented_debt | Monitoring doc is explicitly placeholder pending exporter. | Convert to implementation SPEC when metrics work starts. |
| `docs/GOVERNANCE/NEXUS-STANDARDS.md` | 14,16,50 | false_positive | Defines canonical status vocabulary. | Allowlist. |
| `docs/GOVERNANCE/hvac-web-search-providers.md` | 74,75,76 | documented_debt | MiniMax provider stub is documented as not functional. | Implement or remove provider entry in a focused PR. |
| `docs/GOVERNANCE/CLOUDFLARE_SETUP.md` | 236,272 | risky_cleanup | Qdrant route cleanup affects public DNS/tunnel state. | Requires network-change approval and snapshot. |
| `docs/GOVERNANCE/SUBDOMAINS.md` | 60 | documented_debt | Deprecated Aurelia subdomain is documented. | Verify no active route before removing references. |
| `docs/GOVERNANCE/PORTS.md` | 33,73 | documented_debt | Deprecated port entries preserve history. | Remove only after registry review. |
| `docs/GOVERNANCE/NETWORK_MAP.md` | 101 | documented_debt | Deprecated public service route is recorded. | Verify against current tunnel/DNS before cleanup. |
| `docs/GOVERNANCE/backup-runbook.md` | 60,200 | stale_doc | Restore section says deprecated services need current DB architecture update. | Update runbook after DB ownership is verified. |
| `docs/GOVERNANCE/DATABASE_GOVERNANCE.md` | 98,106,131,152,199,200,213,246,270 | false_positive | Uses deprecated as lifecycle/status vocabulary. | Allowlist governance lifecycle docs. |
| `docs/GOVERNANCE/DB_HISTORY.md` | 47,48,49,61 | false_positive | Historical DB status log. | Allowlist. |
| `docs/GOVERNANCE/ANTI-FRAGILITY.md` | 42,152,218,354 | false_positive | Uses deprecated/obsoleto/Todo as policy examples and Portuguese text. | Allowlist. |
| `docs/GOVERNANCE/SECRETS_POLICY.md` | 85,161,187 | false_positive | Discusses safe placeholder/dummy patterns. | Allowlist security policy. |
| `docs/GOVERNANCE/env-management.md` | 59 | false_positive | Warns against production placeholders. | Allowlist. |
| `docs/GOVERNANCE/INFISICAL-SDK-PATTERN.md` | 201,204 | false_positive | Mock section for tests. | Allowlist test examples. |
| `docs/GOVERNANCE/ADR-TEMPLATE.md` | 28,35,288 | false_positive | ADR status template includes DEPRECATED. | Allowlist template. |
| `docs/GOVERNANCE/CODEX-RESEARCH.md` | 168 | false_positive | Documents a deprecated CLI option. | Allowlist reference docs. |
| `docs/GOVERNANCE/CANVAS-CURSOR-LOOP.md` | 27 | false_positive | `/todo` is command vocabulary. | Allowlist. |
| `docs/GOVERNANCE/WORKFLOW.md` | 95 | false_positive | Portuguese `todo` means all/every. | Allowlist Portuguese governance docs. |
| `docs/GOVERNANCE/SECRETS-MANDATE.md` | 12 | false_positive | Portuguese `Todo secret` means every secret. | Allowlist. |
| `docs/GOVERNANCE/INCIDENTS.md` | 38 | false_positive | Portuguese `todo novo serviço` means every new service. | Allowlist. |
| `docs/GOVERNANCE/TRIEVE-DR.md` | 276 | false_positive | Portuguese `Todo dia` means every day. | Allowlist. |
| `docs/GOVERNANCE/guide.md` | 561 | false_positive | Portuguese monthly instruction. | Allowlist. |
| `docs/GOVERNANCE/TEMPLATE.md` | 56 | false_positive | Template says examples must not be placeholders. | Allowlist. |
| `docs/GOVERNANCE/HOMELAB-SECURITY-CHECKLIST.md` | 29 | documented_debt | Stale DNS cleanup is an explicit checklist item. | Keep until DNS review. |
| `docs/GOVERNANCE/ARCHITECTURE-MASTER.md` | 255 | documented_debt | Deprecated section marker. | Verify whether doc is still authoritative before editing. |
| `docs/GOVERNANCE/tasks.md` | 69,70 | false_positive | Completed acceptance criteria mention no placeholders. | Allowlist. |
| `docs/GOVERNANCE/SKILLS/litellm-health-check.md` | 36 | false_positive | Mock key reference for health check docs. | Allowlist if no real value is present. |
| `docs/GOVERNANCE/SKILLS/openclaw-agents-kit/GOVERNANCE-TEMPLATE.md` | 20 | false_positive | Template placeholder column. | Allowlist. |
| `docs/GOVERNANCE/SKILLS/openclaw-agents-kit/AUDIT.md` | 73 | actionable_debt | Undocumented `{{TTS_BRIDGE_URL}}` placeholder noted. | Document or replace variable in OpenClaw config docs. |
| `docs/GOVERNANCE/SKILLS/openclaw-agents-kit/openclaw-config-template.md` | 129,131 | false_positive | Placeholder reference table in config template. | Allowlist. |
| `docs/ARCHITECTURE-OVERVIEW.md` | 1754 | stale_doc | Huge overview still carries TODO/UNKNOWN section. | Reconcile with newer governance or archive. |
| `docs/VOICE-PIPELINE.md` | 551 | false_positive | Dummy image test case. | Allowlist test docs. |
| `docs/RAG_ARCHITECTURE.md` | 832,833,837,937,968,1031,1070,1098,1120 | documented_debt | Stub workflows are planned migration work. | Convert to SPEC tasks if still active. |
| `pnpm-lock.yaml` | 798,802,2121,3857,3862,4479 | actionable_debt | Lockfile records deprecated packages and a vulnerable `next@15.1.2`. | Run dependency audit/update in a separate dependency PR. |
| `packages/email/package.json` | 20 | actionable_debt | Direct peer dependency on deprecated `@react-email/components@^0.0.19`. | Upgrade React Email package set and regenerate lockfile. |
| `packages/ui/src/rhf-form/RhfSelect.tsx` | 17,21,45,53,55 | false_positive | UI placeholder prop/rendering is correct. | Allowlist component prop name. |
| `packages/ui/CLAUDE.md` | 342 | false_positive | UI usage example. | Allowlist UI docs. |
| `services/task-queue/task_queue.py` | 8,27,34,42,53,87,117,172,174,335 | false_positive | `JUNIOR` is queue priority/mode vocabulary. | Allowlist service mode enum. |
| `services/api/supervisor_api.py` | 49,63,79 | false_positive | `JUNIOR` is supervisor mode vocabulary. | Allowlist service mode enum. |
| `services/subagents/hermes-supervisor.sh` | 40,41,68,221 | false_positive | `JUNIOR` is supervisor routing vocabulary. | Allowlist service mode token. |
| `scripts/nexus-legacy-detector.sh` | 8,41,42,44,45,148,152,159,177,178,182,187,386,497 | false_positive | Detector intentionally searches placeholder/TODO patterns. | Allowlist detector scripts. |
| `scripts/nexus-code-scanner.sh` | 9,158 | false_positive | Scanner prompt intentionally asks for placeholder analysis. | Allowlist scanner scripts. |
| `scripts/nexus-cron-legacy.sh` | 8,106,114,115 | false_positive | Cron orchestrator intentionally invokes placeholder detection. | Allowlist scanner scripts. |
| `scripts/quality-gates.sh` | 39 | false_positive | Gate intentionally validates placeholder values. | Allowlist quality gate scripts. |
| `scripts/cursor-loop-refactor.sh` | 74 | false_positive | Script checks for placeholder values. | Allowlist detector scripts. |
| `scripts/bootstrap-crm-mvp.sh` | 498,535,718 | actionable_debt | Bootstrap generator still emits placeholder tRPC/dashboard/auth scaffolding. | Archive, update, or mark as historical before reuse. |

## Top 10 Items To Fix First

1. `packages/email/package.json` plus `pnpm-lock.yaml`: upgrade deprecated `@react-email/components`.
2. `pnpm-lock.yaml`: investigate and remove or upgrade vulnerable `next@15.1.2`.
3. `.github/workflows/*`: decide whether GitHub workflows are inactive, then delete or maintain them.
4. `docs/GOVERNANCE/backup-runbook.md`: update deprecated PostgreSQL restore guidance.
5. `scripts/bootstrap-crm-mvp.sh`: archive or modernize generated placeholder CRM scaffold.
6. `docs/GOVERNANCE/SKILLS/openclaw-agents-kit/AUDIT.md`: resolve undocumented `{{TTS_BRIDGE_URL}}`.
7. `docs/ARCHITECTURE-OVERVIEW.md`: reconcile stale TODO/UNKNOWN section with current governance.
8. `docs/GOVERNANCE/hvac-web-search-providers.md`: implement or remove MiniMax web-search stub.
9. `docs/CLAUDE.md`: convert level-1/2 stubs into active SPEC tasks or archive superseded agency docs.
10. `docs/RAG_ARCHITECTURE.md`: convert stub workflow migration notes into tracked execution tasks.

## Quality Gate Allowlist Candidates

- `services/task-queue/task_queue.py`: `JUNIOR` priority/mode.
- `services/api/supervisor_api.py`: `JUNIOR` supervisor mode.
- `services/subagents/hermes-supervisor.sh`: `JUNIOR` routing mode.
- `packages/ui/src/rhf-form/RhfSelect.tsx`: UI `placeholder` prop.
- `packages/ui/CLAUDE.md`: UI placeholder usage example.
- `scripts/nexus-legacy-detector.sh`, `scripts/nexus-code-scanner.sh`, `scripts/nexus-cron-legacy.sh`, `scripts/quality-gates.sh`, `scripts/cursor-loop-refactor.sh`: detector/gate vocabulary.
- Governance lifecycle/template docs: `DATABASE_GOVERNANCE.md`, `DB_HISTORY.md`, `NEXUS-STANDARDS.md`, `ADR-TEMPLATE.md`.
- Security docs that discuss placeholder/dummy patterns: `SECRETS_POLICY.md`, `env-management.md`, `INFISICAL-SDK-PATTERN.md`.
- Portuguese governance phrases where `todo` means every/all: `WORKFLOW.md`, `SECRETS-MANDATE.md`, `INCIDENTS.md`, `TRIEVE-DR.md`, `guide.md`.

## Safe Small PR Candidates

- Add a quality-gate allowlist for known false positives above.
- Cross-link SPEC-206 from SPEC-205 and relevant governance docs.
- Update `docs/GOVERNANCE/backup-runbook.md` to point at current DB governance before rewriting restore commands.
- Document `{{TTS_BRIDGE_URL}}` in the OpenClaw config template or remove the stale audit note if already resolved.
- Mark `scripts/bootstrap-crm-mvp.sh` as historical if it is no longer a supported generator.

## Requires Snapshot Or Approval

- Removing or changing `qdrant.zappro.site` DNS/tunnel routes.
- Removing active `.github/workflows/*` without confirming GitHub Actions is no longer used by the mirror.
- Dependency upgrades that affect app build/runtime, especially `next`, React Email, and lockfile-wide transitive changes.
- Any cleanup that deletes generated apps, archived specs, runtime scripts, or linked-repo content.
- Any change that touches ports, subdomains, Cloudflare, Coolify, systemd units, or database restore behavior.

## Phased Cleanup Plan

### Phase 1: Allowlist False Positives

- Encode controlled vocabulary and detector files into the quality gate.
- Re-run the audit command and confirm only actionable/documented debt remains.
- Do not suppress docs that mention real service drift.

### Phase 2: Docs Reconciliation

- Resolve `.github/` workflow policy inconsistency.
- Reconcile stale overview/runbook docs with `DEPLOYMENT-BOUNDARIES.md`, `PORTS.md`, `SUBDOMAINS.md`, and SPEC-205.
- Convert agency/RAG stub lists into either active SPEC tasks or archived historical docs.

### Phase 3: Dependency Cleanup

- Upgrade or remove deprecated direct dependencies.
- Regenerate lockfile in a focused dependency branch.
- Run typecheck/build/lint for affected workspaces.

### Phase 4: Risky Infra Cleanup

- Prepare explicit approval for Qdrant public route cleanup and any deprecated domain/port removal.
- Take required ZFS/config snapshots before changing tunnel, DNS, or stateful-service restore paths.
- Verify DNS, tunnel routes, and smoke checks after changes.

## Acceptance Criteria

- [x] All known false positives are documented in the quality-gate allowlist.
- [x] Audit command returns no unclassified findings when the allowlist is applied.
- [x] `.github/` workflow policy is reconciled with SPEC-024 and current mirror usage.
- [x] Deprecated direct dependency findings have an upgrade/removal plan.
- [x] Stale runbook/architecture docs either point to current governance or are archived.
- [ ] Risky infra cleanup has explicit approval and snapshot references before execution.

## Execution Notes

- `.gitea/workflows/quality-gates.yml` runs `PLACEHOLDER_DEBT_ENFORCE=1 bash scripts/quality-gates.sh`.
- `docs/GOVERNANCE/placeholder-debt-allowlist.txt` is the enforced allowlist for controlled vocabulary and known false positives.
- `docs/GOVERNANCE/INDEX.md` is the current routing table for canonical governance docs.
- `docs/CLAUDE.md`, `docs/RAG_ARCHITECTURE.md`, and `docs/ARCHITECTURE-OVERVIEW.md` are historical redirects, not sources of truth.
- Dependency cleanup beyond the email package remains a separate follow-up because broad lockfile changes can affect runtime.

## Out Of Scope

- Reading `.env`, secrets, data, logs, Qdrant storage, or database files.
- Deleting, moving, or editing code during this audit.
- Restarting services or changing runtime state.
- Changing DNS, Cloudflare tunnel config, Coolify config, ports, or subdomains.
- Performing dependency upgrades in this SPEC creation pass.
