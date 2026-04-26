# PR #9 — Security Hardening — NOT MERGED

**Status:** Closed without merge
**Date closed:** 2026-04-26
**Author:** (review required)
**PR link:** https://github.com/zapprosite/monorepo/pull/9
**PR title:** "feat: enterprise security hardening + IDOR protection"

---

## Context

PR #9 proposed a set of security hardening measures for the monorepo. It was reviewed and closed without being merged. This document records what was proposed so that none of those changes are assumed to be present in `main`.

**Assumption in main:** PR #9 changes do NOT exist on `main`. Do not assume any hardening from that PR is active.

---

## Claims from PR #9 that cannot be assumed on `main`

<!-- Populate after reviewing `gh pr view 9 --json body,title,comments` -->

- [ ] (placeholder) Firewall rules — NOT in main
- [ ] (placeholder) Non-root container user — NOT in main (contrast: Dockerfile already has non-root user added — verify if this was from PR #9 or pre-existing)
- [ ] (placeholder) Secrets rotation policy — NOT in main
- [ ] (placeholder) Dependabot configuration changes — NOT in main
- [ ] (placeholder) Any `.env.example` or `.env.template` additions — NOT in main

---

## How to revalidate

```bash
# Review what PR #9 actually contained
gh pr view 9 --json body,title,files,additions,deletions,comments
```

### Checklist before assuming any security claim from PR #9

- [ ] Run `git log --oneline main | grep -i "security\|hardening\|pr.*9"` — confirm no commit references
- [ ] Check if any files modified in PR #9 still appear in `main` history with identical content
- [ ] Run `git diff main...refs/heads/<pr9-branch>` (if branch still exists) to see the diff
- [ ] Verify Dockerfile non-root user is pre-existing (not from PR #9)

### If any PR #9 changes are needed

Re-open a new PR targeting current `main`, re-apply only the confirmed-to-be-needed changes, and run the full security checklist:

- [ ] Dependency audit: `pnpm audit`
- [ ] Dockerfile best-practice review
- [ ] Secret scanning: `git log -p | grep -E "(password|secret|token|key)"` (no commits with secrets)
- [ ] Network exposure audit (refer to PORTS.md + SUBDOMAINS.md in `/srv/ops/ai-governance/`)
- [ ] UFW rules review (requires approval to check `/etc/ufw/`)

---

## Risk note

Closing a security PR without merge may leave known attack surface unaddressed. Before the next production deployment, a security re-review of `main` should be scheduled.

---

*Document created by Enterprise Baseline Fixer after PR #10 merge. Update this document when PR #9 is re-opened or superseded.*