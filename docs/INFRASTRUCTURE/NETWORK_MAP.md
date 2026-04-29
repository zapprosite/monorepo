# NETWORK_MAP — Mapa de Rede do will-zappro Homelab

> **LEITURA OBRIGATÓRIA** para qualquer agente que vá:
> - Adicionar ou modificar serviços
> - Abrir portas ou subdomínios
> - Restartar containers ou stacks
> - Diagnosticar falhas de conectividade

**Host:** will-zappro | **GPU:** RTX 4090 (24 GB VRAM) | **Driver:** NVIDIA 580.126.20
**Kernel:** 6.17.0-20-generic | **Última atualização:** 2026-04-07

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
        │  Nome: will-zappro-homelab                        │
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
        │  bot.zappro.site    → http://localhost:4001      │
        │  chat.zappro.site   → http://localhost:8080      │
        │  coolify.zappro.site → http://localhost:8000     │
        │  git.zappro.site    → http://localhost:3300      │
        │  vault.zappro.site  → http://localhost:8200      │
        │  painel.zappro.site → http://localhost:4003     │
        │  n8n.zappro.site   → http://10.0.6.3:5678       │
        │  qdrant.zappro.site → http://localhost:6333     │
        │  monitor.zappro.site → http://localhost:3100    │
        │  llm.zappro.site   → http://localhost:4000      │
        │  api.zappro.site   → http://localhost:4000      │
        │  aurelia.zappro.site → http://localhost:3334     │
        └──────────────────────────────────────────────────┘
                                 │
                                 ▼
                 ┌──────────────────────────────┐
                 │       HOST: will-zappro        │
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
  │ :8000  Coolify  │                     │  infisical-net      │
  │ :8080  Traefik  │                     │    → infisical :8080│
  │ :8200  Infisical│                     │  zappro-lite        │
  │ :3100  Grafana  │                     │    → litellm :4000  │
  │ :2222  GiteaSSH │                     │    → litellm-db:5432│
  └─────────────────┘                     └─────────────────────┘

    Tailscale VPN: 100.83.45.79 (will-zappro.tailnet)
    └─ Acesso direto a todos os serviços acima (mesmo sem Cloudflare)
```

---

## 2. Subdomínios Públicos (Cloudflare Zero Trust Tunnel)

> **Arquitetura:** Terraform (`cloudflare_zero_trust_tunnel_cloudflared_config`) é **authoritative** para a Cloudflare API.
> O cloudflared daemon sincroniza ingress rules da API. `~/.cloudflared/config.yml` é apenas referência local.
> **Para mudar porta de serviço:** editar `variables.tf` → `terraform apply` → cloudflared restart.

| Subdomínio | Target (localhost) | Access Policy | Status | VRAM |
|-----------|-------------------|---------------|--------|------|
| `api.zappro.site` | `:4000` | zappro.ia@gmail.com | ✅ UP | — |
| `bot.zappro.site` | `:4001` | **NONE (public)** | ✅ UP | — |
| `chat.zappro.site` | `:8080` (Coolify) | zappro.ia@gmail.com | ✅ UP (Open WebUI) | — |
| `coolify.zappro.site` | `:8000` | zappro.ia@gmail.com | ✅ UP | — |
| `git.zappro.site` | `:3300` | zappro.ia@gmail.com | ✅ UP | — |
| `llm.zappro.site` | `:4000` | zappro.ia@gmail.com | ✅ UP | — |
| `monitor.zappro.site` | `:3100` | LAN only (192.168.0.0/16) | ✅ UP | — |
| `n8n.zappro.site` | `:5678` (Docker net IP 10.0.6.3) | zappro.ia@gmail.com | ✅ UP | — |
| `painel.zappro.site` | `:4003` | zappro.ia@gmail.com | ✅ UP | — |
| `qdrant.zappro.site` | `:6333` | zappro.ia@gmail.com | ✅ UP | — |
| `vault.zappro.site` | `:8200` | zappro.ia@gmail.com | ✅ UP | — |
| `aurelia.zappro.site` | `:3334` | zappro.ia@gmail.com | ⚠️ DEPRECATED | — |

### Google OAuth (Zero Trust)
- **Status:** Configurado manualmente via Cloudflare Dashboard (API token não tem permissão `Access: Identity Providers`)
- **Credenciais:** NUNCA em código fonte — armazenadas manualmente no Dashboard

---

## 3. Portas do Host — Escopo Completo

| Porta | Serviço | Acesso | Notas |
|-------|---------|--------|-------|
| 22 | SSH | Anywhere (UFW) | Aceso direto |
| 80 | cloudflared/Traefik | Anywhere (UFW) | HTTP → redirect HTTPS |
| 443 | cloudflared/Traefik | Anywhere (UFW) | HTTPS terminator |
| 8080 | cloudflared/Traefik | Anywhere (UFW) | cloudflared proxy |
| 2222 | Gitea SSH | Anywhere (UFW) | ⚠️ Exposto — risco |
| 3000 | — | — | Reservado (Open WebUI) |
| 3100 | Grafana | LAN only (UFW) | ⚠️ Sem auth detectada |
| 3101 | Loki | LAN only | Log aggregation (Promtail) |
| 3300 | Gitea HTTP | LAN only (UFW) | Autenticado via Cloudflare |
| 4000 | LiteLLM | localhost+LAN | ✅ Auth requerida |
| 4001 | OpenClaw Bot | localhost | ✅ Auth requerida (401 sem creds) |
| 4007 | tts-bridge | host | ⚠️ NÃO DOCUMENTADO — verificar propósito antes de usar | — |
| 4003 | Claude Code Panel | localhost | ✅ Auth requerida |
| 5432 | PostgreSQL | 127.0.0.1 (UFW) | 3 instâncias: coolify-db, infisical-db, connected_repo_db |
| 5678 | n8n | Via tunnel (10.0.6.3) | Via Docker network, não localhost |
| 6333 | Qdrant | 127.0.0.1 (UFW) | ⚠️ Sem auth API |
| 6379 | Redis | 127.0.0.1 (UFW) | 3 instâncias |
| 6381 | Redis opencode | 127.0.0.1 (UFW) | — |
| 8000 | Coolify | Via tunnel (Cloudflare) | Via tunnel, exposto em LAN via UFW |
| 8012 | Kokoro TTS | 127.0.0.1 (UFW) | GPU TTS (host bridge) |
| 8200 | Infisical | 127.0.0.1 (UFW) | — |
| 8888 | SearXNG | 127.0.0.1 (UFW) | — |
| 9090 | Prometheus | 127.0.0.1 (UFW) | ⚠️ Sem auth |
| 9100 | Node Exporter | host network | — |
| 9250 | Cadvisor | 127.0.0.1 (UFW) | — |
| 9835 | nvidia-gpu-exporter | 0.0.0.0 (UFW) | ⚠️ Exposto LAN — métricas GPU |
| 11434 | Ollama | 127.0.0.1 (UFW) | GPU models (gemma3, llava, nomic-embed) |

**Docker Bridge Networks (Coolify):**
| Rede | Subnet | Serviços |
|------|--------|----------|
| `wbmqefxhd7vdn2dme3i6s9an` | 10.0.5.0/24 | OpenWebUI (:8080, IP 10.0.5.2) |
| `qgtzrmi6771lt8l7x8rqx72f` | 10.0.19.0/24 | OpenClaw (:8080), Browser (:9222), wav2vec2 (:8201), wav2vec2-proxy (:8203) |
| `bridge` | host | Kokoro (:8880), Qdrant (:6333) |
| `zappro-lite` | docker0 (10.0.1.x) | LiteLLM Proxy (:4000) |

**Service IPs (Cross-network):**
| Serviço | IP | Rede origem | Rede destino |
|---------|-----|------------|--------------|
| Ollama (host) | 10.0.1.1:11434 | docker0 (10.0.1.x) | host |
| Ollama (host) | 10.0.5.1:11434 | wbmqefxhd7vdn2dme3i6s9an | host |
| LiteLLM Proxy | 10.0.1.1:4000 | qgtzrmi... | docker0 |
| Kokoro TTS | 10.0.19.7:8880 | qgtzrmi... | bridge |
| Qdrant (Coolify) | 10.0.19.5:6333 | qgtzrmi... | bridge |
| wav2vec2 (whisper-api) | 10.0.19.8:8201 | qgtzrmi... | STT endpoint |
| wav2vec2-proxy | 10.0.19.9:8203 | qgtzrmi... | Deepgram-to-Whisper proxy |
| MCP Monorepo | 10.0.19.50:4006 | qgtzrmi... | host (/srv/monorepo) |
| MCP Qdrant | 10.0.19.51:4011 | qgtzrmi... | bridge (openclaw-memory) |

---

## 4. Containers Docker — Estado Detalhado

### Core Infrastructure
| Container | Imagem | Porta | Rede | Status |
|----------|--------|-------|------|--------|
| coolify | 2370f00af778 | :8000, :8080→:8000 | coolify | ✅ healthy |
| coolify-proxy | traefik:v3.6 | :80, :443, :8080 | coolify | ✅ healthy |
| coolify-db | postgres:15-alpine | :5432 | coolify | ✅ healthy |
| coolify-redis | redis:7-alpine | :6379 | coolify | ✅ healthy |
| coolify-sentinel | ghcr.io/coollabsio/sentinel:0.0.21 | — | coolify | ✅ healthy |
| coolify-realtime | ghcr.io/coollabsio/coolify-realtime:1.0.11 | :6001, :6002 | coolify | ✅ healthy |

### AI/ML Stack
| Container | Imagem | Porta | Rede | Status |
|----------|--------|-------|------|--------|
| zappro-litellm | ghcr.io/berriai/litellm:main-stable | :4000 | zappro-lite | ✅ UP |
| zappro-litellm-db | postgres:15-alpine | :5432 | zappro-lite | ✅ healthy |
| zappro-qdrant | qdrant/qdrant:v1.17.1 | :6333 | bridge | ✅ UP |
| zappro-kokoro | ghcr.io/remsky/kokoro-fastapi-gpu:v0.2.2 | :8012→:8880 | bridge | ✅ UP |
| open-webui-wbmqefx... | ghcr.io/openwebui/open-webui:main | :8080 | wbmqefxhd7vdn2dme3i6s9an + qgtzrmi... | ✅ UP |
| openclaw-qgtzrmi... | coollabsio/openclaw:2026.2.6 | :4001→:8080 | qgtzrmi... | ✅ healthy |
| browser-qgtzrmi... | coollabsio/openclaw-browser:latest | :3000-3001 | qgtzrmi... | ✅ healthy |
| browser-y9yb5xw... | coollabsio/openclaw-browser:latest | :3000-3001 | — | ✅ healthy |
| browser-q7lyxl6... | coollabsio/openclaw-browser:latest | :3000-3001 | — | ✅ healthy |
| mcp-monorepo | mcp-monorepo:local | :4006→:4006 | qgtzrmi... | ✅ UP |
| mcp-qdrant | python:3.11-slim | :4011→:4011 | qgtzrmi... | ✅ UP |

### Voice Pipeline (AI Local — GPU)
| Container | Imagem | Porta | Rede | Status |
|----------|--------|-------|------|--------|
| Ollama (host) | ollama/ollama:latest | :11434 | host | ✅ UP (GPU) |
| LiteLLM Proxy | ghcr.io/berriai/litellm:main-stable | :4000 (docker0) | zappro-lite | ✅ UP |
| Kokoro TTS | ghcr.io/remsky/kokoro-fastapi-gpu:v0.2.2 | :8880 (bridge) | bridge | ✅ UP |
| Qdrant (Coolify) | qdrant/qdrant:v1.17.1 | :6333 | qgtzrmi... | ✅ UP |
| zappro-wav2vec2 | whisper-api | :8201 | qgtzrmi... | ✅ UP |
| zappro-wav2vec2-proxy | wav2vec2-deepgram-proxy | :8203 | qgtzrmi... | ✅ UP |

**Modelos disponíveis via LiteLLM (10.0.1.1:4000):**
- `gemma4` (instruction following, via Ollama host)
- `llava` (visão, via Ollama host)
- `embedding-nomic` (embeddings, via Ollama host)

**TTS:** Kokoro local (`http://10.0.19.7:8880/v1`) com voz `pm_santa` (PT-BR)
**STT:** whisper-api local (`10.0.19.8:8201`) — OpenAI-compatible `/v1/audio/transcriptions`
**STT Proxy:** wav2vec2-proxy (`10.0.19.9:8203`) — Deepgram API format → whisper-api proxy (PT-BR enhancement)

### Observability
| Container | Imagem | Porta | Rede | Status |
|----------|--------|-------|------|--------|
| grafana | grafana/grafana:latest | :3100→:3000 | monitoring_monitoring | ✅ UP |
| prometheus | prom/prometheus:latest | :9090 | monitoring_monitoring | ✅ healthy |
| node-exporter | prom/node-exporter:latest | :9100 | monitoring | ✅ UP |
| cadvisor | gcr.io/cadvisor/cadvisor:latest | :9250 | monitoring | ✅ healthy |
| nvidia-gpu-exporter | utkuozdemir/nvidia_gpu_exporter:1.4.1 | :9835 | host | ✅ UP |
| loki | grafana/loki:3.2.1 | :3101→:3100 | monitoring_monitoring | ✅ UP |
| promtail | grafana/promtail:3.2.1 | :9080 | monitoring_monitoring | ✅ UP |

### DevOps & Secrets
| Container | Imagem | Porta | Rede | Status |
|----------|--------|-------|------|--------|
| painel | nginx:alpine | :4003 | host | ✅ healthy |
| firefox-pgasow... | jlesage/firefox | :5800, :5900 | — | ✅ healthy |
| searxng | searxng/searxng:latest | :8888 | bridge | ✅ UP |
| connected_repo_db | postgres:15-alpine | :5432 | monorepo_default | ✅ UP |
| zappro-redis | redis:7.2.4-alpine | :6379 | bridge | ✅ UP |
| redis-opencode | redis:7.2.4-alpine | :6381 | bridge | ✅ UP |

---

## 4.1 PostgreSQL x6 — Por Quê?

**Todas estas instâncias são legítimas e purpose-built:**

| Container | Versão | Propósito | Rede |
|---------|--------|---------|------|
| coolify-db | 15-alpine | Coolify metadata | coolify |
| infisical-db | 16-alpine | Infisical secrets vault | infisical-net |
| connected_repo_db | 15-alpine | Dev local (monorepo) | monorepo_default |
| zappro-litellm-db | 15-alpine | LiteLLM virtual keys | zappro-lite |
| postgresql-jbu1zy... | 16-alpine | n8n (Coolify-managed) | coolify |
| ll01e4eis7wog1fn... | 17.4.1 | Connected Repo (Coolify) | coolify |

**⚠️ ALERTA:** 6 instâncias PostgreSQL é **alto**. Se precisar consolidar, comece por migrar `connected_repo_db` para `coolify-db`.

---

## 4.2 Redis x4 — Por Quê?

| Container | Versão | Propósito | Porta |
|---------|--------|---------|-------|
| coolify-redis | 7-alpine | Coolify cache | 6379 |
| infisical-redis | 7-alpine | Infisical cache | 6379 |
| zappro-redis | 7.2.4-alpine | zappro stack | 6379 |
| redis-opencode | 7.2.4-alpine | OpenCode cache | 6381 |

**Todos legítimos.** Redis é projetado para multi-tenant isolation.

---

## 4.3 ⚠️ STACKS QUE NÃO EXISTEM MAIS

Estes serviços estão **documentados mas NÃO existem no sistema:**

| Stack | Motivo | Removido em |
|-------|-------|-------------|
| `speaches` (STT) | Substituído por Deepgram cloud | 2026-03 |
| `chatterbox-tts` (TTS) | Substituído por Kokoro local | 2026-03 |
| `voice-proxy` (nginx) | Não deployado | — |
| `supabase-*` (13 containers) | Stack removida, dados em backup | 2026-04 |
| `captain-*` (CapRover) | Substituído por Coolify | 2026-03 |
| `aurelia-*` | Renomeado para `zappro-*` | 2026-04 |
| `tts-bridge` | Duplicado do Kokoro (mesma função) | 2026-04-06 |

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
bot.zappro.site
    → DNS CNAME → aee7a93d-...cfargotunnel.com (Cloudflare proxied)
    → Cloudflare Edge (GRU) → cloudflared QUIC tunnel
    → cloudflared daemon (host) → ingress rule lookup
    → http://localhost:4001 (OpenClaw port mapping 4001→8080)
    → container openclaw-qgtzrmi...:8080 (Docker network isolado)
```

### Drift conhecido (resolvido 2026-04-06)
| Subdomain | Antigo (config.yml local) | Correto (Terraform/API) |
|-----------|--------------------------|------------------------|
| n8n | `https://n8n.zappro.site` (loop) | `http://10.0.6.3:5678` |
| aurelia | `http://localhost:8080` | `http://localhost:3334` |

---

## 7. Segurança — Superfície de Ataque

### ⚠️ Aberturas expostas na LAN (192.168.0.0/16)
| Porta | Serviço | Risco |
|-------|---------|-------|
| 3100 | Grafana | ⚠️ Sem auth verificada |
| 9090 | Prometheus | ⚠️ Sem auth, métricas sistema |
| 9835 | nvidia-gpu-exporter | ⚠️ Métricas GPU detalhadas |
| 2222 | Gitea SSH | ⚠️ Exposto everywhere |

### 🔴 Secrets em texto puro (arquivos)
| Arquivo | Conteúdo sensível |
|---------|------------------|
| `~/zappro-lite/.env` | LITELLM_MASTER_KEY, OPENROUTER_API_KEY, REDIS_PASSWORD |
| `~/zappro-lite/docker-compose.yml` | POSTGRES_PASSWORD (litellm_pass_2026) |
| `/srv/ops/terraform/cloudflare/terraform.tfstate` | Tunnel secret, Cloudflare API token |
| `/srv/ops/terraform/cloudflare/access.tf` | Google OAuth credentials (commented, mas visíveis) |

### ✅ Proteções ativas
- INPUT policy DROP (iptables) — default deny
- UFW ativo com regras específicas
- Cloudflare Access (Zero Trust) em 7/8 subdomínios públicos
- Docker networks isoladas por serviço

---

## 8. Referências

| Arquivo | Conteúdo |
|---------|----------|
| `/srv/ops/terraform/cloudflare/main.tf` | Tunnel + ingress + DNS (Terraform) |
| `/srv/ops/terraform/cloudflare/variables.tf` | Service URLs (fonte das URLs de ingress) |
| `/srv/ops/terraform/cloudflare/terraform.tfstate` | State (serial 136, local) |
| `~/.cloudflared/config.yml` | Referência local das ingress rules |
| `/srv/ops/ai-governance/PORTS.md` | Tabela completa de portas |
| `/srv/ops/ai-governance/SUBDOMAINS.md` | Registro de subdomínios |
| `/srv/ops/ai-governance/GUARDRAILS.md` | Operações proibidas |

---

**Atualizado:** 2026-04-07 | **Próxima revisão:** mensal ou ao adicionar serviço/subdomínio
