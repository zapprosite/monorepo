# NETWORK_MAP — Mapa de Rede do Homelab

> **LEITURA OBRIGATÓRIA** para qualquer agente que vá:
>
> - Adicionar ou modificar serviços
> - Abrir portas ou subdomínios
> - Restartar containers ou stacks
> - Diagnosticar falhas de conectividade

**Host:** homelab | **GPU:** RTX 4090 (24 GB VRAM) | **Driver:** NVIDIA 580.126.20
**Kernel:** 6.17.0-20-generic | **Última atualização:** 2026-04-15 (SPEC-050: UFW+Traefik added, :8202 wav2vec2 fixed)

---

## 1. Arquitetura de Topologia (ASCII)

```
╔══════════════════════════════════════════════════════════════════╗
║                         INTERNET                                ║
╚════════════════════════════════╤══════════════════════════════╝
                                 │
                    Cloudflare Edge (GRU — Brazil)
                                 │
        ┌────────────────────────┴────────────────────────┐
        │         Cloudflare Zero Trust Tunnel              │
        │  ID: aee7a93d-c2e2-4c77-a395-71edc1821402       │
        │  Nome: homelab-tunnel                        │
        │  CNAME: aee7a93d-...cfargotunnel.com             │
        └────────────────────────┬────────────────────────┘
                                 │
                    cloudflared daemon (systemd, host network)
                    Credenciais: ~/.cloudflared/{tunnel-id}.json
                    Config runtime: Cloudflare API (Terraform authoritative)
                    Config local (ref): ~/.cloudflared/config.yml
                                 │
        ┌────────────────────────┴────────────────────────┐
        │              Ingress Rules (cloudflared)           │
        ├──────────────────────────────────────────────────┤
        │  hermes.zappro.site → http://localhost:8642      │
        │  chat.zappro.site   → http://localhost:8080      │
        │  coolify.zappro.site → http://localhost:8000     │
        │  git.zappro.site    → http://localhost:3300      │
        │  painel.zappro.site → http://localhost:4003     │
        │  qdrant.zappro.site → http://localhost:6333     │
        │  monitor.zappro.site → http://localhost:3100    │
        │  llm.zappro.site   → http://localhost:4000      │
        │  api.zappro.site   → http://localhost:4000      │
        │  list.zappro.site  → http://localhost:4080      │
        │  md.zappro.site    → http://localhost:4081      │
        │  todo.zappro.site  → http://localhost:4082      │
        └──────────────────────────────────────────────────┘
                                 │
                                 ▼
                 ┌──────────────────────────────┐
                 │       HOST: homelab        │
                 │  127.0.0.1 + 192.168.15.83   │
                 └──────────────────────────────┘
                          │            │
           ┌──────────────┘            └──────────────┐
           ▼                                           ▼
  ┌─────────────────┐                     ┌─────────────────────┐
  │  DOCKER HOST    │                     │  Docker Networks    │
  │  NETWORK        │                     │  (isolated bridges) │
  │  ─────────────  │                     │  ─────────────────  │
  │ :3300  Gitea    │                     │  coolify (10.0.6.x) │
  │ :4000  LiteLLM  │                     │    → n8n :5678     │
  │ :4001  OpenClaw │                     │  qgtzrmi (10.0.19.x)│
  │ :4003  Panel    │                     │    → openclaw :8080 │
  │ :6333  Qdrant   │                     │    → browser :9222  │
  │ :8000  Coolify  │                     │  coolify            │
  │ :8080  Traefik  │                     │    → traefik public │
  │ :3100  Grafana  │                     │    → litellm :4000  │
  │ :2222  GiteaSSH │                     │    → litellm-db:5432│
  └─────────────────┘                     └─────────────────────┘

    Tailscale VPN: 100.83.45.79 (homelab.tailnet)
    └─ Acesso direto a todos os serviços acima (mesmo sem Cloudflare)
```

---

## 2. Subdomínios Públicos (Cloudflare Zero Trust Tunnel)

> **Arquitetura:** Terraform (`cloudflare_zero_trust_tunnel_cloudflared_config`) é **authoritative** para a Cloudflare API.
> O cloudflared daemon sincroniza ingress rules da API. `~/.cloudflared/config.yml` é apenas referência local.
> **Para mudar porta de serviço:** editar `variables.tf` → `terraform apply` → cloudflared restart.

| Subdomínio            | Target (localhost) | Access Policy             | Status             | VRAM |
| --------------------- | ------------------ | ------------------------- | ------------------ | ---- |
| `api.zappro.site`     | `:4000`            | —                         | ✅ UP              | —    |
| `chat.zappro.site`    | `:8080` (Coolify)  | —                         | ✅ UP (Open WebUI) | —    |
| `coolify.zappro.site` | `:8000`            | —                         | ✅ UP              | —    |
| `git.zappro.site`     | `:3300`            | —                         | ✅ UP              | —    |
| `hermes.zappro.site`  | `:8642`            | —                         | ✅ UP              | —    |
| `llm.zappro.site`     | `:4000`            | —                         | ✅ UP              | —    |
| `list.zappro.site`    | `:4080`            | LAN only                  | ✅ UP              | —    |
| `md.zappro.site`      | `:4081`            | LAN only                  | ✅ UP              | —    |
| `monitor.zappro.site` | `:3100`            | LAN only (192.168.0.0/16) | ✅ UP              | —    |
| `painel.zappro.site`  | `:4003`            | —                         | ✅ UP              | —    |
| `qdrant.zappro.site`  | `:6333`            | —                         | ✅ UP              | —    |
| `todo.zappro.site`    | `:4082`            | LAN only                  | ✅ UP              | —    |
| `aurelia.zappro.site` | `:3334`            | —                         | ⚠️ DEPRECATED      | —    |

### Google OAuth (Zero Trust)

- **Status:** Configurado manualmente via Cloudflare Dashboard (API token não tem permissão `Access: Identity Providers`)
- **Credenciais:** NUNCA em código fonte — armazenadas manualmente no Dashboard

---

## 3. Portas do Host — Escopo Completo

| Porta | Serviço                       | Acesso                  | Notas                                        |
| ----- | ----------------------------- | ----------------------- | -------------------------------------------- |
| 22    | SSH                           | Anywhere (UFW)          | Aceso direto                                 |
| 80    | cloudflared/Traefik           | Anywhere (UFW)          | HTTP → redirect HTTPS                        |
| 443   | cloudflared/Traefik           | Anywhere (UFW)          | HTTPS terminator                             |
| 8080  | cloudflared/Traefik           | Anywhere (UFW)          | cloudflared proxy                            |
| 2222  | Gitea SSH                     | Anywhere (UFW)          | ⚠️ Exposto — risco                           |
| 3000  | —                             | —                       | Reservado (Open WebUI)                       |
| 3100  | Grafana                       | LAN only (UFW)          | ⚠️ Sem auth detectada                        |
| 3101  | Loki                          | LAN only                | Log aggregation (Promtail)                   |
| 3300  | Gitea HTTP                    | LAN only (UFW)          | Autenticado via Cloudflare                   |
| 4000  | LiteLLM                       | localhost+LAN           | ✅ Auth requerida                            |
| 4001  | ~~OpenClaw Bot~~ (deprecated) | localhost               | Reservado                                    |
| 4003  | Claude Code Panel             | localhost               | ✅ Auth requerida                            |
| 4004  | perplexity-agent              | localhost               | ✅ Auth requerida                            |
| 3456  | openwebui-bridge-agent        | localhost               | ✅ Auth requerida                            |
| 3457  | openclaw-mcp-wrapper          | localhost               | ✅ Auth requerida                            |
| 5432  | PostgreSQL                    | 127.0.0.1 (UFW)         | 2 instâncias: coolify-db, connected_repo_db  |
| 5678  | n8n                           | Via tunnel (10.0.6.3)   | Via Docker network, não localhost            |
| 4080  | list-web                      | LAN only                | ⚠️ Sem auth                                  |
| 4081  | obsidian-web                  | LAN only                | ⚠️ Sem auth                                  |
| 5433  | supabase-health-proxy         | 127.0.0.1 (UFW)         | ⚠️ Sem auth (proxy to :3000)                 |
| 5680  | n8n task runners              | localhost               | n8n workers                                  |
| 6333  | Qdrant                        | 127.0.0.1 (UFW)         | ⚠️ Sem auth API                              |
| 6379  | Redis                         | 127.0.0.1 (UFW)         | 3 instâncias                                 |
| 6381  | Redis opencode                | 127.0.0.1 (UFW)         | —                                            |
| 8000  | Coolify                       | Via tunnel (Cloudflare) | Via tunnel, exposto em LAN via UFW           |
| 8012  | Kokoro TTS                    | 127.0.0.1 (UFW)         | GPU TTS (host bridge)                        |
| 8050  | gotify                        | LAN only                | ⚠️ Sem auth                                  |
| 8051  | alert-sender                  | LAN only                | ⚠️ Sem auth                                  |
| 8888  | SearXNG                       | 127.0.0.1 (UFW)         | —                                            |
| 9090  | Prometheus                    | 127.0.0.1 (UFW)         | ⚠️ Sem auth                                  |
| 9100  | Node Exporter                 | host network            | —                                            |
| 9250  | Cadvisor                      | 127.0.0.1 (UFW)         | —                                            |
| 9835  | nvidia-gpu-exporter           | 0.0.0.0 (UFW)           | ⚠️ Exposto LAN — métricas GPU                |
| 11434 | Ollama                        | 127.0.0.1 (UFW)         | GPU models (gemma3, qwen2.5-vl, nomic-embed) |

**Docker Bridge Networks (Coolify):**
| Rede | Subnet | Serviços |
|------|--------|----------|
| `wbmqefxhd7vdn2dme3i6s9an` | 10.0.5.0/24 | OpenWebUI (:8080, IP 10.0.5.3) |
| `qgtzrmi6771lt8l7x8rqx72f` | 10.0.19.0/24 | OpenClaw (:8080), Browser (:9222), wav2vec2 (:8201), wav2vec2-proxy (:8203), TTS Bridge (:8013) |
| `bridge` | host | Kokoro (:8880), Qdrant (:6333) |
| `zappro-lite` | docker0 (10.0.1.x) | LiteLLM Proxy (:4000) |
| `list-web_default` | 10.0.12.0/24 | list-web (:80→4080) |
| `obsidian-web_default` | 10.0.14.0/24 | obsidian-web (:80→4081) |
| `monitoring_monitoring` | 10.0.16.0/24 | Grafana, Prometheus, gotify (:80→8050), alert-sender (:8080→8051) |
| `skills_bridge_internal` | 10.0.9.0/24 | openclaw-mcp-wrapper (:3457) |

**Service IPs (Cross-network):**
| Serviço | IP | Rede origem | Rede destino |
|---------|-----|------------|--------------|
| Ollama (host) | 10.0.1.1:11434 | docker0 (10.0.1.x) | host |
| Ollama (host) | 10.0.5.1:11434 | wbmqefxhd7vdn2dme3i6s9an | host |
| LiteLLM Proxy | 10.0.1.1:4000 | qgtzrmi... | docker0 |
| Kokoro TTS | 10.0.19.10:8880 | qgtzrmi... | bridge |
| Qdrant (Coolify) | 10.0.19.2:6333 | qgtzrmi... | bridge |
| wav2vec2 (whisper-api) | 10.0.19.8:8201 | qgtzrmi... | STT endpoint |
| wav2vec2-proxy | 10.0.19.5:8203 | qgtzrmi... | Deepgram-to-Whisper proxy |
| TTS Bridge | 10.0.19.11:8013 | qgtzrmi... | TTS endpoint |
| MCP Monorepo | 10.0.19.50:4006 | qgtzrmi... | host (/srv/monorepo) |
| MCP Qdrant | 10.0.19.51:4011 | qgtzrmi... | bridge (openclaw-memory) |

---

## 4. Containers Docker — Estado Detalhado

### Core Infrastructure

| Container        | Imagem                                     | Porta              | Rede    | Status      |
| ---------------- | ------------------------------------------ | ------------------ | ------- | ----------- |
| coolify          | 2370f00af778                               | :8000, :8080→:8000 | coolify | ✅ healthy  |
| coolify-proxy    | traefik:v3.6                               | :80, :443, :8080   | coolify | ✅ healthy  |
| coolify-db       | postgres:15-alpine                         | :5432              | coolify | ✅ healthy  |
| coolify-redis    | redis:7-alpine                             | :6379              | coolify | ✅ healthy  |
| coolify-sentinel | ghcr.io/coollabsio/sentinel:0.0.21         | —                  | coolify | ✅ healthy  |
| coolify-realtime | ghcr.io/coollabsio/coolify-realtime:1.0.11 | :6001, :6002       | coolify | ✅ healthy  |
| gitea-runner     | gitea-runner:latest                        | —                  | coolify | ✅ healthy  |
| task-runners-\*  | n8n-executor:latest                        | :5680              | coolify | 🔄 starting |

### AI/ML Stack

| Container              | Imagem                                   | Porta       | Rede                                  | Status     |
| ---------------------- | ---------------------------------------- | ----------- | ------------------------------------- | ---------- |
| zappro-litellm         | ghcr.io/berriai/litellm:main-stable      | :4000       | zappro-lite                           | ✅ UP      |
| zappro-litellm-db      | postgres:15-alpine                       | :5432       | zappro-lite                           | ✅ healthy |
| zappro-qdrant          | qdrant/qdrant:v1.17.1                    | :6333       | bridge                                | ✅ UP      |
| zappro-kokoro          | ghcr.io/remsky/kokoro-fastapi-gpu:v0.2.2 | :8012→:8880 | bridge                                | ✅ UP      |
| open-webui-wbmqefx...  | ghcr.io/openwebui/open-webui:main        | :8080       | wbmqefxhd7vdn2dme3i6s9an + qgtzrmi... | ✅ UP      |
| openclaw-qgtzrmi...    | coollabsio/openclaw:2026.2.6             | :4001→:8080 | qgtzrmi...                            | ✅ healthy |
| browser-qgtzrmi...     | coollabsio/openclaw-browser:latest       | :3000-3001  | qgtzrmi...                            | ✅ healthy |
| mcp-monorepo           | mcp-monorepo:local                       | :4006→:4006 | qgtzrmi...                            | ✅ UP      |
| mcp-qdrant             | python:3.11-slim                         | :4011→:4011 | qgtzrmi...                            | ✅ UP      |
| perplexity-agent       | perplexity-agent:latest                  | :4004       | bridge                                | ✅ healthy |
| openwebui-bridge-agent | openwebui-bridge-agent:latest            | :3456       | qgtzrmi... + wbmqefxhd7vdn2dme3i6s9an | ✅ healthy |
| openclaw-mcp-wrapper   | openclaw-mcp-wrapper:latest              | :3457       | skills_bridge_internal                | ✅ healthy |
| zappro-tts-bridge      | zappro-tts-bridge:latest                 | :8013→:8013 | qgtzrmi...                            | ✅ healthy |

### Voice Pipeline (AI Local — GPU)

| Container             | Imagem                                   | Porta           | Rede        | Status      |
| --------------------- | ---------------------------------------- | --------------- | ----------- | ----------- |
| Ollama (host)         | ollama/ollama:latest                     | :11434          | host        | ✅ UP (GPU) |
| LiteLLM Proxy         | ghcr.io/berriai/litellm:main-stable      | :4000 (docker0) | zappro-lite | ✅ UP       |
| Kokoro TTS            | ghcr.io/remsky/kokoro-fastapi-gpu:v0.2.2 | :8880 (bridge)  | bridge      | ✅ UP       |
| Qdrant (Coolify)      | qdrant/qdrant:v1.17.1                    | :6333           | qgtzrmi...  | ✅ UP       |
| zappro-wav2vec2       | whisper-api                              | :8201           | qgtzrmi...  | ✅ UP       |
| zappro-wav2vec2-proxy | wav2vec2-deepgram-proxy                  | :8203           | qgtzrmi...  | ✅ UP       |

**Host mappings (not containers):**
| Service | Host Port | Target | Purpose |
| ------------- | --------- | ------ | ------------------------------------ |
| wav2vec2 STT | :8202 | →:8201 | Host mapping: whisper-api PT-BR STT |

**Modelos disponíveis via LiteLLM (10.0.1.1:4000):**

- `gemma4` (instruction following, via Ollama host)
- `qwen2.5-vl` (visão, via Ollama host)
- `embedding-nomic` (embeddings, via Ollama host)

**TTS:** Kokoro local (`http://10.0.19.10:8880/v1`) com voz `pm_santa` (PT-BR)
**TTS Bridge:** zappro-tts-bridge (`http://10.0.19.11:8013`) — filtro de vozes (pm_santa, pf_dora)
**STT:** whisper-api local (`10.0.19.8:8201`) — OpenAI-compatible `/v1/audio/transcriptions`
**STT Proxy:** wav2vec2-proxy (`10.0.19.5:8203`) — Deepgram API format → whisper-api proxy (PT-BR enhancement)

### Observability

| Container           | Imagem                                | Porta       | Rede                  | Status     |
| ------------------- | ------------------------------------- | ----------- | --------------------- | ---------- |
| grafana             | grafana/grafana:latest                | :3100→:3000 | monitoring_monitoring | ✅ UP      |
| prometheus          | prom/prometheus:latest                | :9090       | monitoring_monitoring | ✅ healthy |
| node-exporter       | prom/node-exporter:latest             | :9100       | monitoring            | ✅ UP      |
| cadvisor            | gcr.io/cadvisor/cadvisor:latest       | :9250       | monitoring            | ✅ healthy |
| nvidia-gpu-exporter | utkuozdemir/nvidia_gpu_exporter:1.4.1 | :9835       | host                  | ✅ UP      |
| loki                | grafana/loki:3.2.1                    | :3101→:3100 | monitoring_monitoring | ✅ UP      |
| promtail            | grafana/promtail:3.2.1                | :9080       | monitoring_monitoring | ✅ UP      |
| gotify              | gotify/server:latest                  | :8050→:80   | monitoring_monitoring | ✅ healthy |
| alert-sender        | alert-sender:latest                   | :8051→:8080 | monitoring_monitoring | ✅ healthy |

### DevOps & Secrets

| Container             | Imagem                       | Porta       | Rede                 | Status                                                             |
| --------------------- | ---------------------------- | ----------- | -------------------- | ------------------------------------------------------------------ |
| painel                | nginx:alpine                 | :4003       | host                 | ✅ healthy                                                         |
| searxng               | searxng/searxng:latest       | :8888       | bridge               | ✅ UP                                                              |
| list-web              | list-web:latest              | :4080→:80   | list-web_default     | ✅ healthy                                                         |
| obsidian-web          | obsidian-web:latest          | :4081→:80   | obsidian-web_default | ✅ healthy                                                         |
| supabase-health-proxy | supabase-health-proxy:latest | :5433→:3000 | bridge               | ⚠️ PRUNED (2026-04-14 — container unhealthy, service discontinued) |
| connected_repo_db     | postgres:15-alpine           | :5432       | monorepo_default     | ✅ UP                                                              |
| zappro-redis          | redis:7.2.4-alpine           | :6379       | bridge               | ✅ UP                                                              |
| redis-opencode        | redis:7.2.4-alpine           | :6381       | bridge               | ✅ UP                                                              |

---

## 4.1 PostgreSQL x6 — Por Quê?

**Todas estas instâncias são legítimas e purpose-built:**

| Container            | Versão    | Propósito                | Rede             |
| -------------------- | --------- | ------------------------ | ---------------- |
| coolify-db           | 15-alpine | Coolify metadata         | coolify          |
| connected_repo_db    | 15-alpine | Dev local (monorepo)     | monorepo_default |
| zappro-litellm-db    | 15-alpine | LiteLLM virtual keys     | zappro-lite      |
| postgresql-jbu1zy... | 16-alpine | n8n (Coolify-managed)    | coolify          |
| ll01e4eis7wog1fn...  | 17.4.1    | Connected Repo (Coolify) | coolify          |

**⚠️ ALERTA:** 6 instâncias PostgreSQL é **alto**. Se precisar consolidar, comece por migrar `connected_repo_db` para `coolify-db`.

---

## 4.2 Redis x3 — Por Quê?

| Container      | Versão       | Propósito      | Porta |
| -------------- | ------------ | -------------- | ----- |
| coolify-redis  | 7-alpine     | Coolify cache  | 6379  |
| zappro-redis   | 7.2.4-alpine | zappro stack   | 6379  |
| redis-opencode | 7.2.4-alpine | OpenCode cache | 6381  |

**Todos legítimos.** Redis é projetado para multi-tenant isolation.

---

## 4.3 ⚠️ STACKS QUE NÃO EXISTEM MAIS

Estes serviços estão **documentados mas NÃO existem no sistema:**

| Stack                        | Motivo                             | Removido em |
| ---------------------------- | ---------------------------------- | ----------- |
| `speaches` (STT)             | Substituído por Deepgram cloud     | 2026-03     |
| `chatterbox-tts` (TTS)       | Substituído por Kokoro local       | 2026-03     |
| `voice-proxy` (nginx)        | Não deployado                      | —           |
| `supabase-*` (13 containers) | Stack removida, dados em backup    | 2026-04     |
| `captain-*` (CapRover)       | Substituído por Coolify            | 2026-03     |
| `aurelia-*`                  | Renomeado para `zappro-*`          | 2026-04     |
| `tts-bridge`                 | Duplicado do Kokoro (mesma função) | 2026-04-06  |

**Se aparecerem como containers, são fantasmas — investigar e remover.**

---

## 5. ZFS Datasets — Storage

```
tank (3.5T livre, poolname: tank)
├── tank/coolify/           → /srv/data/coolify          (configs Coolify)
├── tank/docker-data/        → /srv/docker-data           (volumes Docker)
├── tank/monorepo/           → /srv/monorepo              (código)
├── tank/backups/            → /srv/backups                (backups)
├── tank/models/             → /srv/models                 (17GB — Ollama + Kokoro)
└── tank/data/
    ├── qdrant/             → /srv/data/qdrant           (vector storage)
    ├── openclaw/            → /srv/data/openclaw          (openclaw workspaces)
    └── zappro-router/       → /srv/data/zappro-router
```

---

## 6. Arquitetura Cloudflare Tunnel — Decisões Chave

### Qual config é authoritative?

- **Cloudflare API** (via Terraform `cloudflare_zero_trust_tunnel_cloudflared_config`) é a **fonte da verdade** para o daemon cloudflared
- O cloudflared daemon sincroniza da API ao iniciar/restart
- `~/.cloudflared/config.yml` é **documentação local** — pode estar desatualizado
- Para mudar qualquer rota: **Terraform first** → `terraform apply` → `systemctl restart cloudflared`

### Fluxo de dados de uma requisição

```
hermes.zappro.site
    → DNS CNAME → aee7a93d-...cfargotunnel.com (Cloudflare proxied)
    → Cloudflare Edge (GRU) → cloudflared QUIC tunnel
    → cloudflared daemon (host) → ingress rule lookup
    → http://localhost:8642 (Hermes Gateway)
    → hermes-agent (bare metal, systemd)

bot.zappro.site
    → ⚠️ DEPRECATED — CNAME removido de Cloudflare (2026-04-14)
    → DNS: cloudflared tunnel degradado
    →_FUNCIONALIDADE: Substituído por hermes.zappro.site → :8642
```

### Drift conhecido (resolvido 2026-04-06)

| Subdomain | Antigo (config.yml local) | Correto (Terraform/API) |
| --------- | ------------------------- | ----------------------- |
| aurelia   | `http://localhost:8080`   | `http://localhost:3334` |

---

## 7. UFW + Traefik — Consolidated Network Layer

> **SPEC-050 (2026-04-15):** UFW + Traefik documentation consolidated here.
> All ingress passes through Traefik before reaching UFW.

### Network Stack

```
INTERNET
    │
    ▼
Cloudflare Edge (Zero Trust Tunnel)
    │
    ▼
cloudflared daemon (host network)
    │
    ▼
┌─────────────────────────────────────────────────────┐
│  TRAEFIK (Coolify Proxy) — ports 80/443/8080       │
│  ┌───────────────────────────────────────────────┐  │
│  │ Ingress rules (Cloudflare → localhost)        │  │
│  │  coolify.zappro.site  → :8000               │  │
│  │  hermes.zappro.site   → :8642               │  │
│  │  chat.zappro.site    → :8080 (OpenWebUI)   │  │
│  │  llm.zappro.site     → :4000 (LiteLLM)     │  │
│  │  api.zappro.site     → :4000                │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
    │
    ▼
UFW (host firewall)
┌─────────────────────────────────────────────────────┐
│  UFW active — default INPUT DROP                    │
│  ┌───────────────────────────────────────────────┐  │
│  │ ACCEPT 22/tcp    (SSH — Anywhere)            │  │
│  │ ACCEPT 80/tcp    (HTTP — Anywhere)           │  │
│  │ ACCEPT 443/tcp   (HTTPS — Anywhere)          │  │
│  │ ACCEPT 8080/tcp  (Traefik proxy — Anywhere)  │  │
│  │ ACCEPT 4000/tcp  (LiteLLM — localhost)        │  │
│  │ ACCEPT 11434/tcp (Ollama — localhost)        │  │
│  │ ACCEPT 8000/tcp  (Coolify — Cloudflare Only)  │  │
│  │ DROP    2222/tcp (Gitea SSH — Risk)         │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
    │
    ▼
SERVICES (bare metal + Docker + Coolify)
```

### UFW Rules (Host Firewall)

UFW is **active** on the host with `default INPUT DROP`.

| Rule          | Port  | Action | Purpose                        |
| ------------- | ----- | ------ | ------------------------------ |
| SSH           | 22    | ACCEPT | Remote administration          |
| HTTP          | 80    | ACCEPT | Traefik HTTP → HTTPS redirect  |
| HTTPS         | 443   | ACCEPT | SSL termination                |
| Traefik proxy | 8080  | ACCEPT | Cloudflare tunnel ingress      |
| LiteLLM       | 4000  | ACCEPT | localhost only                 |
| Ollama        | 11434 | ACCEPT | localhost only                 |
| Coolify       | 8000  | ACCEPT | Cloudflare tunnel only         |
| Gitea SSH     | 2222  | DROP   | ⚠️ Security risk — do not open |

### Traefik (Coolify Proxy) Rules

All public ingress routes through Traefik (Coolify Proxy) on ports 80/443/8080.

| Subdomain           | Target Port | Notes                         |
| ------------------- | ----------- | ----------------------------- |
| coolify.zappro.site | :8000       | Coolify PaaS panel            |
| hermes.zappro.site  | :8642       | Hermes Gateway agent          |
| chat.zappro.site    | :8080       | Open WebUI (Coolify managed)  |
| llm.zappro.site     | :4000       | LiteLLM proxy (pending :4002) |
| api.zappro.site     | :4000       | LiteLLM proxy                 |
| list.zappro.site    | :4080       | LAN only                      |
| md.zappro.site      | :4081       | LAN only                      |
| todo.zappro.site    | :4082       | LAN only                      |
| monitor.zappro.site | :3100       | LAN only                      |

### Portas Reservadas (Nunca usar)

- :3000 → Open WebUI proxy (RESERVED)
- :4000 → LiteLLM production (RESERVED)
- :4001 → OpenClaw Bot (RESERVED)
- :4002 → ai-gateway (RESERVED — SPEC-047)
- :8000 → Coolify PaaS (RESERVED)
- :8080 → Open WebUI (Coolify managed) (RESERVED)
- :8642 → Hermes Gateway (RESERVED)
- :6333 → Qdrant (RESERVED)

### Portas Livres para Dev

- Faixa :4002–:4099 (microserviços)
- :5173 (Vite frontend)

---

## 8. Segurança — Superfície de Ataque

### ⚠️ Aberturas expostas na LAN (192.168.0.0/16)

| Porta | Serviço             | Risco                         |
| ----- | ------------------- | ----------------------------- |
| 3100  | Grafana             | ⚠️ Sem auth verificada        |
| 9090  | Prometheus          | ⚠️ Sem auth, métricas sistema |
| 9835  | nvidia-gpu-exporter | ⚠️ Métricas GPU detalhadas    |
| 2222  | Gitea SSH           | ⚠️ Exposto everywhere         |

### 🔴 Secrets em texto puro (arquivos)

| Arquivo                                           | Conteúdo sensível                                      |
| ------------------------------------------------- | ------------------------------------------------------ |
| `~/zappro-lite/.env`                              | LITELLM_MASTER_KEY, OPENROUTER_API_KEY, REDIS_PASSWORD |
| `~/zappro-lite/docker-compose.yml`                | POSTGRES_PASSWORD (litellm_pass_2026)                  |
| `/srv/ops/terraform/cloudflare/terraform.tfstate` | Tunnel secret, Cloudflare API token                    |
| `/srv/ops/terraform/cloudflare/access.tf`         | Google OAuth credentials (commented, mas visíveis)     |

### ✅ Proteções ativas

- INPUT policy DROP (iptables) — 默认拒绝
- UFW ativo com regras específicas
- Cloudflare Access (Zero Trust) em 7/8 subdomínios públicos
- Docker networks isoladas por serviço

---

## 8. Referências

| Arquivo                                           | Conteúdo                                 |
| ------------------------------------------------- | ---------------------------------------- |
| `/srv/ops/terraform/cloudflare/main.tf`           | Tunnel + ingress + DNS (Terraform)       |
| `/srv/ops/terraform/cloudflare/variables.tf`      | Service URLs (fonte das URLs de ingress) |
| `/srv/ops/terraform/cloudflare/terraform.tfstate` | State (serial 136, local)                |
| `~/.cloudflared/config.yml`                       | Referência local das ingress rules       |
| `PORTS.md`                                        | Tabela completa de portas                |
| `SUBDOMAINS.md`                                   | Registro de subdomínios                  |
| `GUARDRAILS.md`                                   | Operações proibidas                      |

---

**Atualizado:** 2026-04-15 | **Próxima revisão:** mensal ou ao adicionar serviço/subdomínio
