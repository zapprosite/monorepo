# Code Review: 433c76c4 — fix(todo-web): correct S256 PKCE code_challenge generation

**Commit:** `433c76c4` | **Author:** CI Bot | **Date:** 2026-04-13

## Summary
PKCE implementation fixed from broken (raw verifier as code_challenge) to RFC 7636-compliant (SHA256 + base64url). The fix uses `crypto.subtle.digest('SHA-256', ...)` correctly. OAuth redirect_uri_mismatch errors are resolved.

---

## Summary
PKCE fix properly implements S256: `BASE64URL(SHA256(verifier))` via `crypto.subtle.digest`. Skills structure (98e9bd86) correctly references Infisical for secrets. Docker-in-docker in entrypoint.sh (`exec dockerd &`) is unusual and worth monitoring. Secrets are NOT hardcoded — pattern is correct (env vars + Infisical).

---

## Files Changed
- `apps/todo-web/index.html` (1 file, -8/+6 lines)
- Skills: `.claude/skills/new-subdomain/SKILL.md`, `.claude/skills/new-subdomain/references/api-flow.md`, `.claude/skills/list-web-from-zero-to-deploy/SKILL.md`

---

## Verdict
- **Approved** — PKCE fix is correct; secrets pattern is compliant.
