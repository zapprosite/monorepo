# Hardware Hierarchy - Homelab Complete Map

**Classification:** INTERNAL | **Owner:** Platform Engineering
**Version:** 2.1.0 | **Updated:** 2026-04-26
**Purpose:** Single source of truth for the approved homelab hardware and runtime hierarchy.

---

## Read First

This file describes the approved target split for the homelab. Operational detail lives in:

- [Target Architecture](docs/ARCHITECTURE/HOMELAB-TARGET-ARCHITECTURE-2026-04.md)
- [Deployment Boundaries](docs/REFERENCE/DEPLOYMENT-BOUNDARIES.md)
- [Security Checklist](docs/REFERENCE/HOMELAB-SECURITY-CHECKLIST.md)
- [Ports Registry](ops/ai-governance/PORTS.md)

---

## Target Hierarchy

```
Internet
  |
  v
Cloudflare DNS + Tunnel + Access
  |
  v
Traefik/Coolify ingress
  |
  v
Public containerized apps
  - web apps
  - dashboards
  - stateless APIs
  - internal tools with Cloudflare Access or strong app auth

Bare-metal host
  - Hermes Gateway
  - Hermes MCP
  - Ollama GPU
  - Nexus scripts
  - backups/ZFS
  - observability agent
  - cloudflared connector and metrics

Private core infra
  - LiteLLM
  - Qdrant
  - Postgres
  - Redis
  - Gitea
  - Coolify
```

---

## Non-Negotiable Rules

1. Stateful and critical services stay private in Core Infra.
2. Only stateless apps should cross the public ingress boundary.
3. Internal tools require Cloudflare Access or strong application auth.
4. Hermes runs outside Coolify as a bare-metal/systemd service.
5. Ollama runs bare-metal with GPU access.
6. LiteLLM is the single model gateway for homelab services.
7. Coolify publishes apps; it does not govern the homelab.
8. The monorepo is the control plane, not an infinite app dump.

---

## Hardware Specs

| Component | Specification |
|-----------|---------------|
| Host | Ubuntu Desktop LTS, bare metal |
| CPU | See `/srv/ops/hardware/` |
| GPU | NVIDIA RTX 4090 24GB |
| RAM | See `/srv/ops/hardware/` |
| Storage | ZFS pool `tank`, documented as 3.5TB |
| Network Edge | Cloudflare DNS, Tunnel, and Access |

Unknowns must be verified in `/srv/ops/hardware/` before being treated as canonical.

---

## Runtime Boundaries

| Layer | Runs Here | Public Exposure | Notes |
|-------|-----------|-----------------|-------|
| Edge | Cloudflare DNS, Tunnel, Access | Internet-facing | Policy edge for DNS, tunnel routing, and access control. |
| Ingress | Traefik/Coolify ingress | Public or internal via Cloudflare | Publishes app routes only. |
| Public Apps | Web apps, dashboards, stateless APIs, internal tools with auth | Allowed when protected by target policy | Apps must not own critical state without explicit backup governance. |
| Bare Metal | Hermes Gateway, Hermes MCP, Ollama GPU, Nexus scripts, backups/ZFS, observability agent | Private by default | Host-level services are not Coolify workloads. |
| Core Infra | LiteLLM, Qdrant, Postgres, Redis, Gitea, Coolify | Private/internal only | Stateful and critical services require backups and access controls. |

---

## Bare-Metal Services

| Service | Target Runtime | Target Exposure | Canonical Notes |
|---------|----------------|-----------------|-----------------|
| Hermes Gateway | Bare metal/systemd | PRIVATE | Agent brain. Must stay outside Coolify. |
| Hermes MCP | Bare metal/systemd | PRIVATE | MCP bridge for Hermes/local agents. |
| Ollama GPU | Bare metal/systemd | PRIVATE | Local model runtime with RTX 4090 access. |
| Nexus scripts | Bare metal filesystem | PRIVATE | Orchestration/control-plane scripts under the monorepo. |
| Backups/ZFS | Bare metal | PRIVATE | Snapshot and restore foundation for stateful data. |
| Observability agent | Bare metal | PRIVATE | Host telemetry collection. Public dashboard exposure is a separate app decision. |
| cloudflared connector | Bare metal/systemd | INTERNAL | Tunnel connector, not an app deployment target. |

---

## Coolify-Published Workloads

Coolify is the app publication layer. It may run or publish:

- Public web apps.
- Dashboards that are explicitly approved for Cloudflare Access or app auth.
- Stateless APIs with authentication/rate limiting.
- Internal tools with Cloudflare Access or strong application auth.

Coolify must not become the owner of homelab governance. Governance remains in the monorepo and ops documentation.

---

## Private Core Infra

| Service | Target Exposure | Stateful? | Backup Required? | Notes |
|---------|-----------------|-----------|------------------|-------|
| LiteLLM | INTERNAL | Yes | Yes | Single gateway for models. Public DNS, if any, must be Access-protected. |
| Qdrant | PRIVATE | Yes | Yes | Vector DB for RAG/Mem0. No public exposure in target architecture. |
| Postgres | PRIVATE | Yes | Yes | Canonical port/domain is UNKNOWN; verify per stack before documenting. |
| Redis | PRIVATE | Yes | Yes | Cache/pubsub and service internals. No public exposure. |
| Gitea | INTERNAL | Yes | Yes | Git service; requires app auth and/or Cloudflare Access. |
| Coolify | INTERNAL | Yes | Yes | PaaS/admin surface; requires admin auth and access protection. |

---

## Service Ports Summary

This summary is not a replacement for [ops/ai-governance/PORTS.md](ops/ai-governance/PORTS.md) or [ops/ai-governance/SUBDOMAINS.md](ops/ai-governance/SUBDOMAINS.md). If a binding is inconsistent across docs, `UNKNOWN` or the detailed governance registry wins until verified.

| Service | Known Port(s) | Target Tags | Domain |
|---------|---------------|-------------|--------|
| Cloudflare edge | UNKNOWN | PUBLIC, INTERNAL | `*.zappro.site` documented; exact route policy varies. |
| Traefik/Coolify ingress | 80/443 | PUBLIC, INTERNAL, COOLIFY | UNKNOWN canonical host binding. |
| Coolify panel/proxy | 8000, 8080, 6001, 6002 | INTERNAL, CORE_INFRA, COOLIFY | `coolify.zappro.site` documented. |
| LiteLLM | 4000, 3334 | INTERNAL, CORE_INFRA | `api.zappro.site` documented; `llm.zappro.site` belongs to `ai-gateway` until PORTS/SUBDOMAINS are reconciled. |
| ai-gateway | 4002 | PUBLIC, INTERNAL | `llm.zappro.site` documented as OpenAI-compatible facade; auth required. |
| Qdrant | 6333, 6334 | PRIVATE, CORE_INFRA | Any public domain is a TODO to remove or Access-protect. |
| Postgres | UNKNOWN | PRIVATE, CORE_INFRA | TODO: verify canonical core Postgres binding. |
| Redis | 6379, 6381 | PRIVATE, CORE_INFRA | No public domain. |
| Gitea | 3300, 2222 | INTERNAL, CORE_INFRA | `git.zappro.site` documented. |
| Hermes Gateway | 8642 | PRIVATE, BARE_METAL | `hermes.zappro.site` documented active via loopback tunnel; TODO protect or remove to match private target. |
| Hermes MCP | 8092 | PRIVATE, BARE_METAL | No public domain. |
| Ollama | 11434 | PRIVATE, BARE_METAL | No public domain. |
| Grafana/dashboard | 3100 | INTERNAL | `monitor.zappro.site` documented. |
| Public web apps | 4080, 4081, 4082 | PUBLIC, COOLIFY | `list.zappro.site`, `md.zappro.site`, `todo.zappro.site` documented. |

---

## Linked Repositories and Control Plane

```
monorepo/
├── ops/                    -> /srv/ops
├── hermes-second-brain/    -> /srv/hermes-second-brain
├── hermes/                 -> ~/.hermes
├── fit-tracker/            -> /srv/fit-tracker-v2
├── hvacr-swarm/            -> /srv/hvacr-swarm
├── edge-tts/               -> /srv/edge-tts
├── apps/                   # Production app source, not an infinite app dump
├── docs/                   # Operational documentation
└── .claude/vibe-kit/       # Nexus framework and orchestration scripts
```

---

## Governance

All changes must follow:

1. Read `/srv/ops/ai-governance/APPROVAL_MATRIX.md`.
2. Check `/srv/ops/ai-governance/PORTS.md` before assigning ports.
3. Check `/srv/ops/ai-governance/SUBDOMAINS.md` before adding public names.
4. Snapshot stateful data before risky operations.
5. Keep apps, infra, and runtime boundaries aligned with [Deployment Boundaries](docs/REFERENCE/DEPLOYMENT-BOUNDARIES.md).

---

## TODO / UNKNOWN

| Item | Status |
|------|--------|
| Canonical core Postgres port/domain | UNKNOWN |
| Exact active Coolify panel binding | UNKNOWN; existing docs mention both 8000 and 8080 states |
| Final Cloudflare Access policy per subdomain | TODO: reconcile with active Cloudflare config |
| Public Qdrant exposure | TODO: target is PRIVATE; any existing public route must be removed or Access-protected |
| Dashboard exposure policy | TODO: classify each dashboard as PUBLIC, INTERNAL, or PRIVATE |
