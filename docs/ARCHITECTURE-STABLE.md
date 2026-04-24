# Arquitetura Estável — will-zappro Homelab

**Verificado:** 2026-04-24 via `ss -tlnp` + `docker ps`
**Stack:** 13 containers Docker + Hermes Gateway bare-metal + Cloudflared tunnel + Ollama bare-metal

---

## 1. Visão Geral

Sistema de homelab com arquitetura agente/mensageria baseado num único sistema:

**Hermes Gateway** (bare-metal Python/systemd, porta 8642)
- Polls @CEO_REFRIMIX_bot via Telegram polling
- Acesso público via cloudflared → hermes.zappro.site
- Voice/TTS processing via Edge TTS

LiteLLM serve como proxy LLM multi-provedor para Groq, OpenAI, MiniMax, Ollama local. Qdrant + Redis fornecem RAG e cache. Exposição pública via Cloudflare Tunnel em 3 subdomínios.

**Tecnologias:** Python, TypeScript, Fastify, LiteLLM, Qdrant, Redis, Docker, ZFS, Cloudflare Tunnel, Telegram API, Ollama (GPU local RTX 4090)

---

## 2. Diagrama de Arquitetura

```
                            ┌──────────────────────────────────┐
                            │      Cloudflare Tunnel            │
                            │  api.zappro.site   → :4000       │
                            │ hermes.zappro.site → :8642       │
                            │ qdrant.zappro.site → Qdrant (:6333)│
                            └───────────────┬────────────────────┘
                                           │

  INTERNET ←───────────────────────────────┼──────────────────────────────────────►
                      @CEO_REFRIMIX_bot   │
                      (Telegram)          │
                      │                   │
                      ▼                   │
              ┌──────────────┐            │
              │ Hermes GW     │            │
              │ :8642 (bare) │            │
              │ Python/svc    │            │
              └──────┬───────┘            │
                     │                    │
                     │     ┌─────────────┴─────────────────┤
                     │     ▼                               │
                     │ ┌──────────────────────────────────────────────┐
                     │ │           LiteLLM Proxy (:4000)              │
                     │ │    Groq / MiniMax / OpenAI / Ollama local   │
                     │ └──────────────────────────────────────────────┘
                     │
                     │     ┌────────────────┐     ┌──────────┐
                     │     │ Ollama         │     │ Qdrant   │
                     │     │ :11434 (GPU)   │     │ :6333-34 │
                     │     └────────────────┘     └──────────┘
                     │
                     │                             ┌───────────┴────────┐
                     │                             ▼                    ▼
                     │                      ┌──────────────┐    ┌──────────────┐
                     │                      │ Edge TTS     │    │ LiteLLM-DB   │
                     │                      │ (Microsoft)  │    │ :5432 (PG)   │
                     │                      └──────────────┘    └──────────────┘
          │
          │  ┌──────────────────────────────────────────────────────┐
          │  │  HOST: Ubuntu Desktop bare-metal, RTX 4090, ZFS tank  │
          │  │  grafana :3100 │ node-exp :9100 │ searxng :8080      │
          │  └──────────────────────────────────────────────────────┘
          └──────────────────────────────────────────────────────────┘
```

---

## 3. Catálogo de Serviços

### 3.1 Docker Containers (13 ativos)

| Container | Imagem | Porta | Status | Propósito |
|-----------|--------|-------|--------|-----------|
| `zappro-litellm` | litellm | 4000/tcp | running | Proxy LLM multi-provedor |
| `zappro-litellm-db` | postgres:16 | 5432/tcp | healthy | PostgreSQL (metadados LiteLLM) |
| `zappro-qdrant` | qdrant | 6333-34/tcp | healthy | DB vetorial (RAG/embeddings) |
| `zappro-redis` | redis | 6379/tcp | healthy | Cache/pubsub |
| `zappro-edge-tts` | edge-tts | 8012/tcp | healthy | TTS neural Microsoft |
| `grafana` | grafana | 3100/tcp | running | Dashboards métricas |
| `node-exporter` | node-exp | 9100/tcp | running | Métricas host |
| `searxng` | searxng | 8080/tcp | running | Motor de busca privativo |
| `coolify` | coollabsio/coolify | 8000/tcp | healthy | PaaS container management |
| `coolify-db` | postgres:15-alpine | — | healthy | PostgreSQL Coolify |
| `coolify-redis` | redis:7-alpine | — | healthy | Redis Coolify |
| `coolify-realtime` | coollabsio/coolify-realtime | 6001/tcp | healthy | Soketi realtime |
| `openwebui` | openwebui/open-webui | 3456/tcp | healthy | Chat UI (Ollama integration) |

### 3.2 Bare Metal / Systemd

| Serviço | Porta | Bind | Propósito |
|---------|-------|------|-----------|
| `hermes-gateway.service` | 8642 | 127.0.0.1 | Polling Telegram (brain) |
| `hermes-mcp.service` | 8092 | 127.0.0.1 | Bridge MCPO → Claude Code |
| `ollama.service` | 11434 | 0.0.0.0 | Local LLM inference (RTX 4090) |
| `faster-whisper` | 8204 | 0.0.0.0 | STT Whisper local |
| `cloudflared` | 20241/20242 | 127.0.0.1 | Tunnel + métricas |
| `sshd` | 22 | 0.0.0.0 | SSH |
| `postfix` | 25 | 0.0.0.0 | Relay SMTP |

### 3.3 Serviços Presentes mas Inativos (PARADO)

| Serviço | Porta | Status | Observação |
|---------|-------|--------|------------|
| `Mem0` | — | PARADO | Memory service |
| `Trieve` | 6435 | PARADO | RAG system (SPEC-092) |

---

## 4. Portas & Endpoints Ativas

| Porta | Serviço | Bind | Health Check |
|-------|---------|------|-------------|
| 4000 | litellm | 127.0.0.1 | `curl localhost:4000/health` (401 sem key = normal) |
| 5432 | liteLLM-DB | container | `pg_isready` |
| 6333 | qdrant REST | 127.0.0.1 | `curl localhost:6333/readyz` |
| 6334 | qdrant gRPC | 127.0.0.1 | — |
| 6379 | redis | 127.0.0.1 | `docker exec zappro-redis redis-cli ping` |
| 8012 | edge-tts | 127.0.0.1 | `curl localhost:8012/health` |
| 8080 | searxng | * | `curl localhost:8080` |
| 3100 | grafana | * | `curl localhost:3100/api/health` |
| 8642 | hermes-gateway | 127.0.0.1 | `curl localhost:8642/health` |
| 9100 | node-exporter | * | `curl localhost:9100/metrics` |
| 8204 | faster-whisper | 0.0.0.0 | — |
| 8092 | hermes-mcp | 127.0.0.1 | — |

---

## 5. Fluxo de Dados

### 5.1 Hermes Gateway — Polling (@CEO_REFRIMIX_bot)

```
@CEO_REFRIMIX_bot (Telegram) → Hermes Gateway (:8642 bare-metal)
                                              ↓
                                    LiteLLM (:4000) → Groq/MiniMax/OpenAI
                                              ↓
                                    Redis (:6379) — cache de sessão
                                              ↓
                                    Edge TTS (8012) — resposta de voz (Kokoro)
```

### 5.2 RAG Query

```
Client → LiteLLM (:4000) → Qdrant (:6333) — busca vetorial
```

### 5.3 Busca Privativa

```
User → SearXNG (:8080) — motor de busca local, ad-free
```

---

## 6. Stack de Tecnologias

| Camada | Tecnologia |
|--------|-----------|
| **OS** | Ubuntu 24.04 Desktop bare-metal |
| **GPU** | NVIDIA RTX 4090 (CUDA) |
| **Storage** | ZFS tank (nvme0n1 3.6TB Gen5) |
| **Container** | Docker + Docker Compose |
| **LLM Proxy** | LiteLLM (Groq, OpenAI, MiniMax, Ollama) |
| **Vector DB** | Qdrant (RAG/embeddings) |
| **Cache** | Redis (sessão, pub/sub) |
| **DB** | PostgreSQL (metadados LiteLLM) |
| **STT** | Groq Whisper Turbo (cloud) + faster-whisper (local :8204) |
| **TTS** | Edge TTS (Microsoft neural) |
| **Agent** | Hermes Gateway (Python, Telegram bot) |
| **Tunnel** | Cloudflared (3 subdomínios) |
| **Monitoring** | Grafana + node-exporter |
| **Search** | SearXNG (privativa) |

---

## 7. Segurança

| Regra | Detalhe |
|-------|---------|
| Bind localhost | Todos Docker em `127.0.0.1` |
| Cloudflare Tunnel | Apenas 3 subdomínios expostos |
| ZFS immutable | Snapshot antes de mudanças estruturais |
| Secrets | `.env` local, nunca em git |
| Port 8204 | `0.0.0.0` (faster-whisper STT, única porta pública além do tunnel) |
| Bot Telegram | `@CEO_REFRIMIX_bot` |

---

## 8. Comandos de Verificação

```bash
# Saúde
curl localhost:8642/health   # Hermes Gateway
curl localhost:4000/health   # LiteLLM (401 sem key = normal)
curl localhost:6333/readyz   # Qdrant
docker exec zappro-redis redis-cli ping  # Redis
curl localhost:8012/health   # Edge TTS

# Containers
docker ps --format '{{.Names}} ⇒ {{.Status}}'

# ZFS
zpool status tank

# Portas ativas
ss -tlnp | grep '127.0.0.1'
```
