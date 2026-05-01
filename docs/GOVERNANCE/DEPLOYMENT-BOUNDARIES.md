# Deployment Boundaries

**Purpose:** Define where approved homelab services run, how they are deployed, and what exposure/auth/backup rules apply.
**Location:** `/srv/monorepo/docs/REFERENCE/DEPLOYMENT-BOUNDARIES.md`
**Audience:** Platform engineering, SRE agents, deployment agents, and reviewers.

---

## Overview

This reference turns the approved homelab architecture into operational boundaries. When a service has unknown runtime, port, domain, or health status, this document uses `UNKNOWN` and requires a TODO instead of guessing.

---

## Boundary Table

| Service | Where Runs | Deploy Target | Public Exposure | Auth Required | Stateful Data? | Backup Required? | Notes |
|---------|------------|---------------|-----------------|---------------|----------------|------------------|-------|
| Cloudflare DNS | Cloudflare edge | Cloudflare | PUBLIC names allowed | Cloudflare account controls | No | No | DNS is edge policy, not app state. |
| Cloudflare Tunnel | Cloudflare edge + host connector | Cloudflare + bare-metal connector | PUBLIC/INTERNAL route entry | Cloudflare controls | No | Config backup required | Must route to approved ingress/app targets only. |
| Cloudflare Access | Cloudflare edge | Cloudflare | INTERNAL gates | Yes | No | Policy backup required | Required for internal tools/admin routes unless app auth is explicitly strong. |
| Traefik/Coolify ingress | Host/container ingress | Coolify/ingress | PUBLIC or INTERNAL | Per route | No | Config backup required | Publishes app routes only. |
| Public web apps | Containers | COOLIFY | PUBLIC allowed | App auth when user data exists | App-dependent | App-dependent | Must stay stateless unless explicit state/backup ownership exists. |
| Dashboards | Containers or UNKNOWN | COOLIFY or UNKNOWN | INTERNAL by default | Cloudflare Access or app auth | Usually no; UNKNOWN per dashboard | Config/data dependent | Public dashboards require explicit approval and sanitization. |
| Stateless APIs | Containers | COOLIFY | PUBLIC allowed | Yes | No direct state ownership | No for app container; yes for dependencies | May call private Postgres/Redis when applicable. |
| Internal tools with auth | Containers | COOLIFY | INTERNAL | Cloudflare Access or strong app auth | App-dependent | App-dependent | Tools are not public by default. |
| Hermes Gateway | Bare-metal host | systemd/bare metal | PRIVATE | Local/service auth | Yes, via memory/config dependencies | Yes | Must stay outside Coolify. |
| Hermes MCP | Bare-metal host | systemd/bare metal | PRIVATE | Local/service auth | No direct app state | Config backup required | Local MCP bridge; do not expose publicly. |
| Ollama GPU | Bare-metal host | systemd/bare metal | PRIVATE | Internal only | Model files/cache | Yes for model/config inventory | GPU-backed local model runtime. |
| Nexus scripts | Bare-metal filesystem | Monorepo/control plane | PRIVATE | Repo/agent permissions | No | Repo backup via Git | Control-plane scripts, not a public service. |
| Backups/ZFS | Bare-metal host | Host/ZFS | PRIVATE | Host admin only | Yes | Yes | Foundation for stateful rollback. |
| Observability agent | Bare-metal host | Host/system agent | PRIVATE | Internal only | Metrics/logs depending config | Yes when retained | Dashboard exposure is separate from agent exposure. |
| LiteLLM | Core Infra | CORE_INFRA | INTERNAL | API keys/Cloudflare Access when routed | Yes | Yes | Single model gateway for Hermes and apps. |
| Qdrant | Core Infra | CORE_INFRA | PRIVATE | Internal service auth | Yes | Yes | Target architecture forbids public exposure. |
| Mem0 / Hermes second brain | Core Infra + linked repo | CORE_INFRA | PRIVATE | Internal service auth | Yes | Yes | Uses Qdrant-backed memory. |
| Postgres | Core Infra | CORE_INFRA | PRIVATE | DB credentials | Yes | Yes | Canonical target port/domain UNKNOWN; verify per stack. |
| Redis | Core Infra | CORE_INFRA | PRIVATE | Internal credentials/network controls | Yes, if persistence enabled | Yes when non-disposable | No public exposure. |
| Gitea | Core Infra | CORE_INFRA | INTERNAL | App auth and/or Cloudflare Access | Yes | Yes | Git state is critical. |
| Coolify | Core Infra | CORE_INFRA/COOLIFY | INTERNAL | Coolify auth and Cloudflare Access | Yes | Yes | Publishes apps; does not govern homelab. |
| External model providers | External cloud | Provider-managed | Outbound only | Provider API auth | No local state | No local backup | Access should normally flow through LiteLLM. |

---

## Deployment Rules

| Rule | Applies To |
|------|------------|
| Do not deploy Hermes in Coolify | Hermes Gateway, Hermes MCP |
| Do not deploy Ollama as an app workload | Ollama GPU |
| Do not expose raw Core Infra ports | Qdrant, Postgres, Redis, Ollama, Hermes |
| Require Access or strong app auth for internal tools | Coolify, Gitea, dashboards, admin tools |
| Keep stateful services private | Qdrant, Postgres, Redis, Gitea, Coolify, LiteLLM state |
| Keep public apps stateless by default | Web apps, dashboards, APIs |
| Use LiteLLM as model gateway | Hermes, apps, agents |
| Treat monorepo as control plane | Nexus, docs, governance, specs |

---

## TODO / UNKNOWN

| Item | Status |
|------|--------|
| Canonical Core Infra Postgres instance | UNKNOWN; verify active target before adding port/domain. |
| Dashboard-by-dashboard exposure | UNKNOWN; classify each dashboard before public route changes. |
| Coolify admin route current binding | UNKNOWN; reconcile 8000/8080 references in ports registry. |
| Public Qdrant route status | TODO; target is PRIVATE, so remove or Access-protect any public route. |
| App-specific backup ownership | UNKNOWN per app until each app declares state ownership. |

---

## Related Documents

- [Target Architecture](../ARCHITECTURE/HOMELAB-TARGET-ARCHITECTURE-2026-04.md)
- [Security Checklist](./HOMELAB-SECURITY-CHECKLIST.md)
- [Hardware Hierarchy](../../HARDWARE_HIERARCHY.md)
- [Ports Registry](../../ops/ai-governance/PORTS.md)
