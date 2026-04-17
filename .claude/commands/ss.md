# /ss — Smoke tests

## Description

Run smoke tests for the monorepo stack.

## Actions

1. `bash smoke-tests/smoke-multimodal-stack.sh` — 13/13 endpoints
2. `bash smoke-tests/smoke-env-secrets-validate.sh` — env vars validation
3. Check ai-gateway :4002 health
4. Verify Hermes :8642 responding
5. Report PASS/FAIL per test

## When

- After deploy
- Before marking ship complete
- Manual health check

## Refs

- `SPEC-047/048` smoke test specs
- `smoke-tests/` directory
