---
**Last reviewed:** 2026-05-04
**Owner:** Security/Backend
spec: SPEC-211-crm-security-audit-refactor
title: CRM Security Audit — Refactor P0/P1 Findings
status: active
date: 2026-05-04
author: Audit Agent
---

# SPEC-211 — CRM Security Audit Refactor

## Overview

Security audit identified **5 P0 (Critical), 6 P1 (High), 8 P2 (Medium)** findings across authentication, authorization, data isolation, and credential handling. This SPEC addresses all P0 and P1 findings with minimal, surgical changes.

## Findings Summary

### P0 — Critical

| ID | Finding | File | Fix |
|----|---------|------|-----|
| P0-1 | Prompts router entirely PUBLIC — no auth, no teamId | `prompts.trpc.ts` | Change to `protectedProcedure`, add teamId scoping |
| P0-2 | Email campaigns not scoped by teamId | `email.trpc.ts:10-25` | Add teamId filter, inject on create |
| P0-3 | Journal entries `getByUser` allows reading any user's entries | `journal_entries.trpc.ts:61-69` | Add teamId filter, scope to ctx.user |
| P0-4 | MCP connectors expose `apiKey` in responses | `mcp-conectores.trpc.ts:48,57` | Exclude apiKey from select |
| P0-5 | `registerWithPassword` accepts arbitrary teamId | `auth.trpc.ts:77-106` | Remove teamId from input, assign server-side |

### P1 — High

| ID | Finding | File | Fix |
|----|---------|------|-----|
| P1-1 | Session fixation: no regeneration on login | `session.auth.utils.ts:54`, `auth.trpc.ts:65` | Add `regenerate()` before `setSession` |
| P1-2 | Google `id_token` not validated | `google-oauth2.auth.plugin.ts:78-81` | Add `state: true` to OAuth2 config |
| P1-3 | Dev bypass: no second guard, placeholder userId | `dev-auth-bypass.ts:46-73` | Add `DEV_AUTH_ENABLED` env var, remove placeholder |
| P1-4 | Auth login leaks account type ("uses Google OAuth") | `auth.trpc.ts:53-56` | Generic error message |
| P1-5 | TOCTOU in ownership checks (fetch then check) | Multiple files | Add teamId to WHERE clause directly |
| P1-6 | `Math.random()` for subdomain generation | `equipment.trpc.ts:138` | Use `crypto.randomUUID()` |

## Acceptance Criteria

- [ ] AC-01: Prompts router uses `protectedProcedure` with teamId scoping
- [ ] AC-02: Email campaigns scoped by teamId (list + create)
- [ ] AC-03: Journal entries scoped by teamId, `getByUser` validates ctx.user
- [ ] AC-04: MCP connectors omit `apiKey` from list/getById responses
- [ ] AC-05: `registerWithPassword` ignores client-provided teamId, uses server logic
- [ ] AC-06: Session regenerated on login (OAuth + password)
- [ ] AC-07: OAuth2 config has `state: true` for CSRF protection
- [ ] AC-08: Dev bypass requires explicit `DEV_AUTH_ENABLED=true` env var
- [ ] AC-09: Auth login returns generic "Invalid credentials" error (no leak)
- [ ] AC-10: Ownership checks use teamId in WHERE clause (no TOCTOU)
- [ ] AC-11: Equipment subdomain uses `crypto.randomUUID()` not `Math.random()`
- [ ] AC-12: All changes pass `pnpm typecheck` and `pnpm lint`
- [ ] AC-13: CRM API container restarts successfully after changes

## Non-Goals

- P2 findings (session cleanup, PKCE, sameSite strict) — separate SPEC
- Loyalty hardcoded data cleanup — separate SPEC
- Rate limiter persistence (Redis) — separate SPEC