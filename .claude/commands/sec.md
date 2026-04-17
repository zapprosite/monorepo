# /sec — Secrets audit

## Description

Scan code for exposed secrets before git push.

## Actions

1. `git diff --cached` — staged changes
2. Pattern scan: `sk-`, `ghp_`, `cfut_`, `glpat-`, `eyJ`, `xoxb-`, `AKIA`
3. Check for `INFISICAL_TOKEN`, `api_key=`, `API_SECRET=`
4. Verify all env vars use `process.env` / `os.getenv()`
5. Block push if secrets detected

## When

- Pre-commit hook (automatic)
- Before any `git push`

## Refs

- `.claude/rules/anti-hardcoded-secrets.md`
- `docs/GOVERNANCE/SECRETS-MANDATE.md`
