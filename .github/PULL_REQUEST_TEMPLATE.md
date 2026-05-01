## Summary

What changed and why?

## Change Class

- [ ] Docs/governance
- [ ] Application/package
- [ ] Dependency
- [ ] Infra config
- [ ] Runtime behavior
- [ ] Security/secrets

## SRE Review

- Blast radius:
- Rollback plan:
- Services touched:
- State touched:
- Public exposure touched:

## Required Checks

- [ ] `bash scripts/quality-gates.sh`
- [ ] `PLACEHOLDER_DEBT_ENFORCE=1 bash scripts/quality-gates.sh`
- [ ] Focused typecheck/build for affected workspace
- [ ] `scripts/sre-markdown-report.sh --dry-run` when SRE docs/reporting changed

## Safety Checklist

- [ ] No `.env`, secrets, data, logs, Qdrant storage, or database files included.
- [ ] No hardcoded secrets or secret values in logs/docs.
- [ ] Ports/domains/tunnels/runtime changes are either not touched or explicitly approved.
- [ ] Service catalog and risk register are updated when operational ownership or risk changes.
- [ ] Rollback is documented for non-doc changes.
