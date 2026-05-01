# Commit Readiness

Classification: INTERNAL
Owner: Platform Engineering
Status: governance checklist
Updated: 2026-05-01

Use this checklist before committing the current SRE/governance cleanup. It does
not authorize a commit by itself.

## Include In Governance Commit

- `.gitea/workflows/quality-gates.yml`
- `.github/PULL_REQUEST_TEMPLATE.md`
- `.gitignore`
- `CODEOWNERS`
- `docs/README.md`
- `docs/CLAUDE.md`
- `docs/RAG_ARCHITECTURE.md`
- `docs/ARCHITECTURE-OVERVIEW.md`
- `docs/GOVERNANCE/INDEX.md`
- `docs/GOVERNANCE/SERVICE_CATALOG.md`
- `docs/GOVERNANCE/RISK_REGISTER.md`
- `docs/GOVERNANCE/OBSERVABILITY-REPORTS.md`
- `docs/GOVERNANCE/placeholder-debt-allowlist.txt`
- `docs/SPECS/SPEC-206-placeholder-debt-cleanup.md`
- `scripts/quality-gates.sh`
- `scripts/docs-stale-check.sh`
- `scripts/sre-markdown-report.sh`
- `packages/email/*` and `pnpm-lock.yaml` changes already tied to the cleanup pass

## Exclude From Governance Commit

- `.env`
- `secrets/`
- `data/`
- `logs/`
- `qdrant_storage/`
- `*.db`
- `*.sqlite`
- `.claude-events/`
- `opencode.json`
- `pipiline.json`
- `services/docker-compose.orchestrator.yml`

## Required Commands

```bash
test ! -e pipiline.json
bash scripts/quality-gates.sh
PLACEHOLDER_DEBT_ENFORCE=1 bash scripts/quality-gates.sh
pnpm --filter @repo/email check-types
pnpm --filter @repo/email build
scripts/sre-markdown-report.sh --dry-run
git status --short
git diff --stat
```

## Commit Message

```text
docs(governance): establish SRE governance baseline
```
