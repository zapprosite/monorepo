# /dv — Deploy validation

## Description

Pre-deploy health validation checklist.

## Actions

1. Run `/ss` smoke tests
2. Verify all env vars in `.env` are set
3. Check port availability: `ss -tlnp | grep :PORT`
4. Verify Terraform plan is clean: `cd /srv/ops/terraform && terraform plan`
5. Run `/sec` secrets audit
6. Confirm git branch name follows `feature/xxx-yyy` format

## Pre-Deploy Checklist

- [ ] Smoke tests PASS (13/13)
- [ ] Secrets audit PASS
- [ ] No hardcoded values in code
- [ ] Branch name valid
- [ ] Terraform plan clean
- [ ] `/hg` shows no blockers

## When

- Before any deploy
- After `/ship` and before push to production

## Refs

- `SPEC-050` network governance
- `docs/GOVERNANCE/IMMUTABLE-SERVICES.md`
