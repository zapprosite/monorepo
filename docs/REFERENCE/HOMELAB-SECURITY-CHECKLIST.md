# Homelab Security Checklist

**Purpose:** Operational checklist for the approved homelab target architecture.
**Location:** `/srv/monorepo/docs/REFERENCE/HOMELAB-SECURITY-CHECKLIST.md`
**Audience:** Operators, SRE agents, deployment agents, and reviewers.

---

## Overview

Use this checklist before publishing apps, changing ingress, touching stateful services, rotating secrets, or approving deployment PRs. Unknown items must remain blocked or explicitly marked `UNKNOWN` until verified.

---

## Edge

- [ ] Cloudflare is the only approved public edge for homelab routes.
- [ ] Public DNS records map only to approved Cloudflare Tunnel routes.
- [ ] No direct public inbound host ports are required for app exposure.
- [ ] Edge changes are reviewed against `ops/ai-governance/SUBDOMAINS.md` and `ops/ai-governance/PORTS.md`.
- [ ] `UNKNOWN` routes are not treated as healthy or approved.

---

## DNS

- [ ] Every public hostname has an owner, purpose, target service, and exposure class.
- [ ] DNS records for Core Infra services are INTERNAL or PRIVATE by target policy.
- [ ] Stale DNS records are marked TODO for removal or protection.
- [ ] New subdomains update the canonical subdomain registry before deployment.
- [ ] No wildcard route is used to bypass per-app review.

---

## Cloudflare Access

- [ ] Coolify admin routes require Cloudflare Access or equivalent strong app auth.
- [ ] Gitea admin routes require Cloudflare Access and/or strong app auth.
- [ ] Dashboard routes require Cloudflare Access unless explicitly public and sanitized.
- [ ] Internal tools require Cloudflare Access or strong app auth.
- [ ] Access policy ownership and allowed identities are documented.
- [ ] Temporary bypasses have expiration and rollback notes.

---

## Tunnel

- [ ] Tunnel routes point only to approved ingress or app endpoints.
- [ ] Tunnel config does not expose Postgres, Redis, Qdrant, Ollama, Hermes, or raw system ports.
- [ ] cloudflared metrics endpoints remain local/private.
- [ ] Tunnel changes are reviewed with DNS and ingress changes together.
- [ ] Rollback path for tunnel route changes is documented before change.

---

## Traefik/Coolify

- [ ] Coolify publishes apps; it does not own homelab governance.
- [ ] Ingress routes are limited to public apps, dashboards, stateless APIs, and protected internal tools.
- [ ] Ingress does not expose raw database, vector DB, model runtime, agent, or host admin ports.
- [ ] Each route has an exposure class: PUBLIC, INTERNAL, or PRIVATE.
- [ ] TLS/auth/rate-limit expectations are documented per route.
- [ ] Conflicting ports are checked in `ops/ai-governance/PORTS.md`.

---

## Auth by App

- [ ] Public web apps with user data have app auth.
- [ ] Stateless APIs have auth, rate limiting, and input validation.
- [ ] Dashboards have Cloudflare Access or app auth.
- [ ] Internal tools have Cloudflare Access or strong app auth.
- [ ] Service-to-service calls use internal URLs and scoped credentials.
- [ ] Anonymous access is documented as an explicit exception.

---

## Secrets

- [ ] No real `.env` values are committed.
- [ ] Secrets are stored in the approved secret manager or deployment secret store.
- [ ] PRs that touch config are scanned for tokens, private keys, passwords, and API keys.
- [ ] Service credentials are scoped per app, not shared globally.
- [ ] Rotation owner and rollback path are documented for each critical secret.
- [ ] Example files use placeholders only.

---

## Backups

- [ ] Stateful Core Infra has a documented backup method.
- [ ] Qdrant backups are documented and restorable.
- [ ] Postgres backups are documented and restorable.
- [ ] Redis persistence policy is documented when data is non-disposable.
- [ ] Gitea repositories and database state are backed up.
- [ ] Coolify configuration/state is backed up.
- [ ] Backup logs do not expose secrets.

---

## ZFS Snapshots

- [ ] Critical datasets are covered by ZFS snapshot policy.
- [ ] Snapshot schedule, retention, and owner are documented.
- [ ] Manual snapshot is taken before risky stateful changes.
- [ ] Restore test evidence exists for critical datasets.
- [ ] Snapshot rollback procedure is documented before destructive operations.

---

## Healthchecks

- [ ] Each public app has a healthcheck appropriate for its stack.
- [ ] Core Infra healthchecks are private and do not leak details.
- [ ] Healthchecks verify dependencies without exposing credentials.
- [ ] Dashboard health is separate from backend service health.
- [ ] `UNKNOWN` health status is not promoted to healthy.

---

## Rollback

- [ ] Every deployment PR has a rollback note.
- [ ] Stateful changes include backup/snapshot references.
- [ ] Route changes include DNS/tunnel/ingress rollback steps.
- [ ] App rollback does not require database rollback unless explicitly planned.
- [ ] Emergency rollback authority is documented.

---

## PR Gates

- [ ] Docs-only PRs modify only documentation paths and approved governance Markdown.
- [ ] App changes do not modify infra without review.
- [ ] Infra changes do not modify apps without review.
- [ ] Port/domain changes update canonical registries.
- [ ] Security-sensitive changes require review before deploy.
- [ ] CI/test expectations are listed even when not run.
- [ ] No batch merge is performed without explicit approval.

---

## Agent Permissions

- [ ] Agents must not deploy without explicit deployment mode/request.
- [ ] Agents must not run Docker, Coolify, Terraform, systemctl, or Cloudflare commands in docs-only mode.
- [ ] Agents must not edit `.env` real files.
- [ ] Agents must not invent ports, domains, health status, or service ownership.
- [ ] Agents must mark missing information as `UNKNOWN` and add TODOs.
- [ ] Agents must preserve user changes outside the current task.
- [ ] Agents must validate changed files before final response.

---

## Related Documents

- [Target Architecture](../ARCHITECTURE/HOMELAB-TARGET-ARCHITECTURE-2026-04.md)
- [Deployment Boundaries](./DEPLOYMENT-BOUNDARIES.md)
- [Hardware Hierarchy](../../HARDWARE_HIERARCHY.md)
- [Ports Registry](../../ops/ai-governance/PORTS.md)
