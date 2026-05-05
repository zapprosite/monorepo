---
title: Versions Manifest
description: Pinned Docker images and Ollama models — SHA256 digests for deterministic deployments
created: 2026-05-03
updated: 2026-05-03
status: active
spec: SPEC-210
---

# VERSIONS.md — Manifesto de Versões

> **Regra:** Nenhuma imagem Docker com tag `:latest` ou `:nightly` em ambiente de produção.
> **Audit:** `scripts/docker-digest-audit.sh` roda diariamente e falha se detectar violação.

---

## Docker Images (31)

### Infraestrutura Core

| Service | Registry Image | Digest SHA256 | ID Local |
|---------|---------------|---------------|----------|
| Coolify | `ghcr.io/coollabsio/coolify` | `sha256:8998c6c213fafe4fea593cddd64bc30b46c67b7546a91436972a52f83d758e45` | `sha256:f3a6bb5da417...` |
| Coolify Realtime | `ghcr.io/coollabsio/coolify-realtime:1.0.13` | `sha256:0076e36116eecd4b801c0b75474a1e378794d8e2b49f2885762db5d10e4e9559` | `sha256:9c506f3b199b...` |
| PostgreSQL | `postgres:15-alpine` | `sha256:09e4f20b14ddb3dfe3a0c825b206032aaf8f28300ba2070c0b60fc1c10c6abc7` | `sha256:c1dd58d6cec8...` |
| Redis | `redis:7.2.4-alpine` | `sha256:c8bb255c3559b3e458766db810aa7b3c7af1235b204cfdb304e79ff388fe1a5a` | `sha256:a1811fcf7480...` |
| Redis (alt) | `redis:7-alpine` | `sha256:8b81dd37ff027bec4e516d41acfbe9fe2460070dc6d4a4570a2ac5b9d59df065` | `sha256:aa189b5a1954...` |
| Registry | `registry:2` | `sha256:a3d8aaa63ed8681a604f1dea0aa03f100d5895b6a58ace528858a7b332415373` | `sha256:26b2eb03618e...` |

### Monitoring

| Service | Registry Image | Digest SHA256 | ID Local |
|---------|---------------|---------------|----------|
| Prometheus | `prom/prometheus` | `sha256:5550dc63da361dc30f6fe02ac0e4dfc736ededfef3c8d12a634db04a67824d78` | `sha256:232e2ff3a14b...` |
| Alertmanager | `prom/alertmanager` | `sha256:58e117eabccebbff04e6643a3432d6315a2cc3a8c24ab5849bc628886bf08857` | `sha256:c21aff3e8667...` |
| Node Exporter | `prom/node-exporter` | `sha256:3ac34ce007accad95afed72149e0d2b927b7e42fd1c866149b945b84737c62c3` | `sha256:696e69e899e0...` |
| Grafana | `grafana/grafana:10.2.0` | `sha256:1ee0c54286b8ca09a3dd1419ff8653e7780a148a006ac088544203bb0affe550` | `sha256:2fbe6143d3ba...` |

### AI / LLM

| Service | Registry Image | Digest SHA256 | ID Local |
|---------|---------------|---------------|----------|
| LiteLLM | `ghcr.io/berriai/litellm:main-latest` | `sha256:7c311546c25e7bb6e8cafede9fcd3d0d622ac636b5c9418befaa32e85dfb0186` | `sha256:5cfceb7aa09c...` |
| Ollama | `ollama/ollama` | `sha256:05ab093b257a54318fba39293f1640d53b507d1edec8fa6ca2d3e1817c02e53b` | `sha256:70eab0b1574b...` |
| Open WebUI | `openwebui/open-webui` | `sha256:c2e4723fdbca5de8f9f0529e22b78acf5bc312a88da730bed88860063d028fe8` | `sha256:b23bb1d639ad...` |
| Qdrant | `qdrant/qdrant:v1.17.1` | `sha256:94728574965d17c6485dd361aa3c0818b325b9016dac5ea6afec7b4b2700865f` | `sha256:e0f50bf8ac92...` |

### Git / CI

| Service | Registry Image | Digest SHA256 | ID Local |
|---------|---------------|---------------|----------|
| Gitea | `gitea/gitea` | `sha256:af07b88edbb2173d20932f9c75ebcf4e61d7d5c2d6a7ab5cc6b97cba28aea352` | `sha256:8922dda65e90...` |
| Gitea Runner | `gitea/act_runner:nightly` | `sha256:7940221bcfc9df16f3401ddafb2231bf98bba5517bc381224c7a2c504b558974` | `sha256:9945d90b2601...` |
| Gitea Runner (dind) | `gitea/act_runner:nightly-dind` | `sha256:accb1577c1d84141faa3719571d5df8cb17d378c7e347745734d1dddd74961cf` | `sha256:2d1cf50cfccd...` |
| Gitea Runner Node | `localhost:5000/gitea-runner-ubuntu-node:22` | `sha256:0c65e4c1865402714d1d27d5d9c2c9cf74eee2e4391cbcde342126102cad9a13` | `sha256:0905ac15f396...` |

### Auth / Tools

| Service | Registry Image | Digest SHA256 | ID Local |
|---------|---------------|---------------|----------|
| Keycloak | `keycloak/keycloak` | `sha256:26ae26445475f7fac5f90ee138b1bdb64324f5815fb16133ffdbdb122d97c4d8` | `sha256:24b12adc35d7...` |
| pgAdmin4 | `dpage/pgadmin4` | `sha256:ff557f69d9808085dc3554f56c1b06a36ac8cddabe4485212920b9604261abdb` | `sha256:76ed3f2f4a1c...` |
| SearXNG | `searxng/searxng` | `sha256:90ea6250fe543ccad61fddeb389032073c8362ce7e1a863d9ea6e2d36dc8e1da` | `sha256:0e6312cd8256...` |
| cURL | `curlimages/curl` | `sha256:b3f1fb2a51d923260350d21b8654bbc607164a987e2f7c84a0ac199a67df812a` | `sha256:c61d1c706c7f...` |

### Locally Built Images (ID-based pinning)

| Service | Local Image | Image ID |
|---------|------------|----------|
| CRM API | `crm-api:latest` | `sha256:f775d6d36d2c9c3ac6fddc16e29aaef53219907c4a8757351566a8cd8ac2e927` |
| CRM MVP API | `crm-mvp-api:latest` | `sha256:f246aa8d95d09d70dbc3e13c4ddedbe914eb935e0f14dd99c7a4e116122c46da` |
| CRM MVP Web | `crm-mvp-web:latest` | `sha256:d7409e83eb7ac20de262d21fc647a923474564b7cb4562c212e06e56ad8ddd4a` |
| Zappro API (builder) | `zappro/api:builder-debug` | `sha256:1ea56cbc9851d88eb3377b54c679156cd5da61199919c1024570538e1a3e71d9` |
| Zappro API (test) | `zappro/api:test` | `sha256:21e0e589906db9d1d6e81fa04be1092a57b0528e70db89e3f802d507788f866a` |
| Zappro Web (test) | `zappro/web:test` | `sha256:9fd069e33b6b72d78baf4a9fbc7eb5281b35b66ed827ec1506020c3026faa598` |
| Hermes Orchestrator | `task-orchestrator-snapshot:latest` | `sha256:e509afadb576ee4fcfc4900e3d72017d0dc1f67c86536239d5059407472750f1` |
| AI Gateway | `ai-gateway:latest` | `sha256:c4cb11e556e0f87f35d223318e0c62ef687594c7785fbcbed55f40152ac710df` |
| Edge TTS | `edge-tts-edge-tts:latest` | `sha256:5e65be60146b9a7bf35520697199be69b1e0b46fb64b374796b8af21a08cbb8f` |
| Python 3.11 | `python:3.11-slim` | `sha256:1eee6fcc4d866c86dd8e32a4a1a583767ddac0d640b0fe571b2c22d233b60eee` |

---

## Ollama Models (3)

| Model | ID | Size | Modified |
|-------|-----|------|----------|
| `qwen2.5-coder:14b-q6k` | `d36aa1bfdfb0` | 12 GB | 2026-05-01 |
| `qwen2.5vl:3b` | `fb90415cde1e` | 3.2 GB | 2026-05-01 |
| `nomic-embed-text:latest` | `0a109f422b47` | 274 MB | 2026-04-10 |

### Model Blob Verification

```bash
# Para verificar hashes dos blobs:
ls -la ~/.ollama/models/blobs/
```

---

## :latest / :nightly Violations (a corrigir)

| File | Line | Image |
|------|------|-------|
| `apps/perplexity-agent/docker-compose.yml` | 4 | `perplexity-agent:latest` |
| `apps/ai-gateway/docker-compose.yml` | 10 | `ai-gateway:latest` |
| `docker-compose.edge-tts.yml` | 3 | `sedett/openai-edge-tts:latest` |
| `docker-compose.openwebui.yml` | 3 | `openwebui/open-webui:latest` |
| `deployments/docker-compose.prod.yml` | 58 | `zappro/api:latest` |
| `deployments/docker-compose.prod.yml` | 109 | `zappro/web:latest` |
| `deployments/docker-compose.edge-tts.yml` | 3 | `sedett/openai-edge-tts:latest` |
| `deployments/docker-compose.openwebui.yml` | 3 | `openwebui/open-webui:latest` |
| `services/docker-compose.openwebui.yml` | 3 | `openwebui/open-webui:latest` |
| `ops/gitea/docker-compose.yml` | 3 | `gitea/gitea:latest` |
| `ops/stacks/autoheal/docker-compose.yml` | 3 | `willfarrell/autoheal:latest` |
| `data/coolify/services/*/docker-compose.yml` | 3 | `dpage/pgadmin4:latest` |
| `data/hvac-rag/docker-compose.rag-pipe.yml` | 19 | `nomic-embed-text:latest` |

**Total: 13 violações ativas.**

---

## Offsite Backup Evaluation (OQ-1)

| Option | Monthly Cost | Storage | Egress | Veredict |
|--------|-------------|---------|--------|----------|
| **Backblaze B2** | ~$6/mês (250GB) | $0.006/GB/mês | $0.01/GB | ✅ Recomendado — rclone nativo |
| **AWS S3 Standard** | ~$5.75/mês (250GB) | $0.023/GB/mês | $0.09/GB | Sizing semelhante, egress mais caro |
| **Cloudflare R2** | ~$3.75/mês (250GB) | $0.015/GB/mês | Zero | ✅ Melhor custo-benefício, zero egress |
| **Wasabi** | ~$6.99/mês (1TB min) | $6.99/TB/mês | Zero | Overkill para 250GB |

**Recomendação:** Cloudflare R2 — já usamos Cloudflare Tunnel, zero egress fees, S3-compatible API.

**rclone config (exemplo):**
```bash
rclone config create zappro-r2 s3 \
  provider=Cloudflare \
  access_key_id=... \
  secret_access_key=... \
  endpoint=https://...r2.cloudflarestorage.com

# Sincronizar backups
rclone sync /srv/backups zappro-r2:zappro-backups --progress
```

1. **Imagens de registry**: Pin por `image@sha256:...` — nunca usar tags mutáveis
2. **Imagens locais**: Pin por `image_id: sha256:...` via compose `image:` + `docker pull --platform` quando disponível
3. **Modelos Ollama**: Congelar versão específica (ex: `qwen2.5-coder:14b-q6k`, não `:latest`)
4. **Atualizações**: Somente via PR com novo digest + justificativa no changelog
5. **Audit**: `scripts/docker-digest-audit.sh` CI + cron diário → Telegram via Hermes
