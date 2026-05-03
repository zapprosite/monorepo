# VERSIONS.md — Enterprise Image Manifest

> Source of truth for all running images in the homelab.
> Generated: 2026-05-03
> Policy: `:latest` tags are FORBIDDEN. All images MUST be pinned by digest (`@sha256:...`).
> Local builds MUST document their build context (Dockerfile path).
> Audit: `bash docker-digest-audit.sh` runs daily at 07:00 via cron.

---

## Critical Infrastructure

| Service | Pinned Reference | Image | Status |
|---------|-----------------|-------|--------|
| Coolify | `ghcr.io/coollabsio/coolify@sha256:8998c6c213fafe4fea593cddd64bc30b46c67b7546a91436972a52f83d758e45` | coolify:latest | ⚠️ Needs digest pin |
| Coolify Realtime | `ghcr.io/coollabsio/coolify-realtime:1.0.13@sha256:0076e36116eecd4b801c0b75474a1e378794d8e2b49f2885762db5d10e4e9559` | coolify-realtime:1.0.13 | ✅ Pinned |
| Coolify DB | `postgres:15-alpine@sha256:09e4f20b14ddb3dfe3a0c825b206032aaf8f28300ba2070c0b60fc1c10c6abc7` | postgres:15-alpine | ✅ Pinned |
| Coolify Redis | `redis:7-alpine@sha256:8b81dd37ff027bec4e516d41acfbe9fe2460070dc6d4a4570a2ac5b9d59df065` | redis:7-alpine | ✅ Pinned |

## Git & CI/CD

| Service | Pinned Reference | Image | Status |
|---------|-----------------|-------|--------|
| Gitea | `gitea/gitea@sha256:af07b88edbb2173d20932f9c75ebcf4e61d7d5c2d6a7ab5cc6b97cba28aea352` | gitea/gitea:latest | ⚠️ Needs digest pin |
| Gitea Runner | `gitea/act_runner:nightly-dind@sha256:accb1577c1d84141faa3719571d5df8cb17d378c7e347745734d1dddd74961cf` | gitea/act_runner:nightly-dind | ✅ Pinned |
| Docker Registry | `registry:2@sha256:a3d8aaa63ed8681a604f1dea0aa03f100d5895b6a58ace528858a7b332415373` | registry:2 | ✅ Pinned |

## Auth

| Service | Pinned Reference | Image | Status |
|---------|-----------------|-------|--------|
| Keycloak | `keycloak/keycloak@sha256:26ae26445475f7fac5f90ee138b1bdb64324f5815fb16133ffdbdb122d97c4d8` | keycloak/keycloak:latest | ⚠️ Needs digest pin |

## LLM Stack

| Service | Pinned Reference | Image | Status |
|---------|-----------------|-------|--------|
| LiteLLM Proxy | `ghcr.io/berriai/litellm:main-latest@sha256:7c311546c25e7bb6e8cafede9fcd3d0d622ac636b5c9418befaa32e85dfb0186` | litellm:main-latest | ✅ Pinned |
| Ollama | `ollama/ollama@sha256:05ab093b257a54318fba39293f1640d53b507d1edec8fa6ca2d3e1817c02e53b` | ollama/ollama:latest | ⚠️ Needs digest pin |
| OpenWebUI HVAC | `openwebui/open-webui@sha256:c2e4723fdbca5de8f9f0529e22b78acf5bc312a88da730bed88860063d028fe8` | openwebui/open-webui:latest | ⚠️ Needs digest pin |
| Hermes Orchestrator | `python:3.11-slim@sha256:6d85378d88a19cd4d76079817532d62232be95757cb45945a99fec8e8084b9c2` | python:3.11-slim | ✅ Pinned |

## Vector DB

| Service | Pinned Reference | Image | Status |
|---------|-----------------|-------|--------|
| Qdrant | `qdrant/qdrant:v1.17.1@sha256:94728574965d17c6485dd361aa3c0818b325b9016dac5ea6afec7b4b2700865f` | qdrant/qdrant:v1.17.1 | ✅ Pinned |

## Observability

| Service | Pinned Reference | Image | Status |
|---------|-----------------|-------|--------|
| Prometheus | `prom/prometheus@sha256:5550dc63da361dc30f6fe02ac0e4dfc736ededfef3c8d12a634db04a67824d78` | prom/prometheus:latest | ⚠️ Needs digest pin |
| Grafana | `grafana/grafana:10.2.0@sha256:1ee0c54286b8ca09a3dd1419ff8653e7780a148a006ac088544203bb0affe550` | grafana/grafana:10.2.0 | ✅ Pinned |
| Alertmanager | `prom/alertmanager@sha256:58e117eabccebbff04e6643a3432d6315a2cc3a8c24ab5849bc628886bf08857` | prom/alertmanager:latest | ⚠️ Needs digest pin |
| Node Exporter | `prom/node-exporter@sha256:3ac34ce007accad95afed72149e0d2b927b7e42fd1c866149b945b84737c62c3` | node-exporter:latest | ⚠️ Needs digest pin |

## Data & Caching

| Service | Pinned Reference | Image | Status |
|---------|-----------------|-------|--------|
| zappro-redis | `redis:7.2.4-alpine@sha256:c8bb255c3559b3e458766db810aa7b3c7af1235b204cfdb304e79ff388fe1a5a` | redis:7.2.4-alpine | ✅ Pinned |
| Litellm DB | `postgres:15-alpine@sha256:09e4f20b14ddb3dfe3a0c825b206032aaf8f28300ba2070c0b60fc1c10c6abc7` | postgres:15-alpine | ✅ Pinned |
| pgAdmin | `dpage/pgadmin4@sha256:ff557f69d9808085dc3554f56c1b06a36ac8cddabe4485212920b9604261abdb` | pgadmin4:latest | ⚠️ Needs digest pin |

## Local Builds (no public digest)

These images are built locally. Their stability depends on source code, not a pinned remote digest.
Each local build MUST have a ZFS snapshot before and after build for rollback.

| Service | Build Context | Dockerfile | Snapshot Before Build |
|---------|--------------|------------|----------------------|
| ai-gateway | `/srv/monorepo/apps/ai-gateway/` | Dockerfile | `tank/monorepo@pre-build-ai-gateway-*` |
| edge-tts-edge-tts | Local edge-tts build | Dockerfile | Manual |
| hermes-orchestrator-snapshot | `~/.hermes/` | Dockerfile | `tank/monorepo@pre-build-hermes-*` |
| act-node22 | Gitea runner custom | Dockerfile | `tank/docker-data@pre-build-act-*` |

## Ollama Models

| Model | ID (Blob Hash) | Size | Status |
|-------|---------------|------|--------|
| qwen2.5-coder:14b-q6k | `d36aa1bfdfb0` | 12 GB | ✅ Locked |
| qwen2.5vl:3b | `fb90415cde1e` | 3.2 GB | ✅ Locked |
| nomic-embed-text:latest | `0a109f422b47` | 274 MB | ✅ Locked |

## Postgres Versions

| Database | Image | Version |
|----------|-------|---------|
| coolify-db | postgres:15-alpine | 15.x |
| zappro-litellm-db | postgres:15-alpine | 15.x |

---

## Upgrade Policy

1. **NO automatic upgrades** — all `:latest` tags must be converted to `@sha256:...`
2. **Manual upgrade process:**
   ```bash
   # 1. Create ZFS snapshot
   zfs snapshot tank/monorepo@pre-upgrade-$(date +%Y%m%d-%H%M%S)
   # 2. Pull new digest
   docker pull image@sha256:NEW_DIGEST
   # 3. Verify (smoke test)
   bash ~/.hermes/scripts/smoke.sh
   # 4. Update VERSIONS.md with new digest
   # 5. If smoke fails → rollback to old digest immediately
   ```
3. **Monthly audit:** Hermes checks for available image updates and reports via Telegram `/versions`
4. **Never upgrade more than 1 service per day** (blast radius minimization)
