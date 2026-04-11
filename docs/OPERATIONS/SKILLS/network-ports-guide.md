# Network & Ports Guide

> **Versão:** 1.0.0 | **Data:** 2026-04-11
> **Host:** will-zappro homelab
> **Purpose:** Ensinar qualquer LLM a entender a topologia de rede e usar portas corretas

---

## 1. Visão Geral da Topologia

```
╔══════════════════════════════════════════════════════════════════╗
║                         INTERNET                                ║
╚════════════════════════════════╤══════════════════════════════╝
                                 │
                    Cloudflare Edge (GRU — Brazil)
                    Cloudflare Zero Trust Tunnel
                    ID: aee7a93d-c2e2-4c77-a395-71edc1821402
                                 │
                    cloudflared daemon (host network)
                                 │
        ┌────────────────────────┴────────────────────────┐
        │              Ingress Rules (cloudflared)           │
        ├──────────────────────────────────────────────────┤
        │  bot.zappro.site    → http://localhost:4001      │
        │  coolify.zappro.site → http://localhost:8000     │
        │  git.zappro.site    → http://localhost:3300      │
        │  vault.zappro.site  → http://localhost:8200      │
        │  painel.zappro.site → http://localhost:4003      │
        │  n8n.zappro.site   → http://10.0.6.3:5678        │
        │  qdrant.zappro.site → http://localhost:6333     │
        │  monitor.zappro.site → http://localhost:3100     │
        │  llm.zappro.site   → http://localhost:4000       │
        │  api.zappro.site   → http://localhost:4000       │
        │  chat.zappro.site  → http://localhost:8080       │
        └──────────────────────────────────────────────────┘
                                 │
╔════════════════════════════════╧══════════════════════════════╗
║                       HOST: will-zappro                       ║
║                  127.0.0.1 + 192.168.15.83                    ║
╚════════════════════════════════╤══════════════════════════════╝
                                 │
           ┌─────────────────────┴─────────────────────┐
           ▼                                           ▼
  ┌─────────────────┐                     ┌─────────────────────┐
  │  DOCKER HOST    │                     │  Docker Networks    │
  │  (ports on host)│                     │  (isolated bridges) │
  ├─────────────────┤                     ├─────────────────────┤
  │ :3300  Gitea    │                     │ coolify (10.0.6.x)  │
  │ :4000  LiteLLM  │                     │ qgtzrmi (10.0.19.x) │
  │ :4001  OpenClaw │                     │ zappro-lite (10.0.1.x)│
  │ :4003  Panel    │                     │ monitoring (10.0.4.x)│
  │ :6333  Qdrant   │                     └─────────────────────┘
  │ :8000  Coolify  │
  │ :3100  Grafana  │
  └─────────────────┘

  Tailscale VPN: 100.83.45.79 (acesso direto a todos os serviços)
```

---

## 2. Portas em Uso — Tabela Completa

### Portas Reservadas (NUNCA usar)

| Porta | Serviço | Razão |
|-------|---------|-------|
| **8000** | Coolify PaaS | Deploy via Coolify |
| **3000** | Open WebUI | Reservada (chat.zappro.site) |
| **4000** | LiteLLM proxy | Produção (api.zappro.site) |
| **4001** | OpenClaw Bot | Reservada (bot.zappro.site) |

### Portas Ativas — Infraestrutura

| Porta | Serviço | Acesso | Função |
|-------|---------|--------|--------|
| 22 | SSH | Anywhere (UFW) | Acesso SSH |
| 80 | cloudflared/Traefik | Anywhere | HTTP → HTTPS redirect |
| 443 | cloudflared/Traefik | Anywhere | HTTPS terminator |
| 2222 | Gitea SSH | Anywhere | Git SSH (⚠️ exposto) |
| 3300 | Gitea HTTP | LAN only | Git HTTP via Cloudflare Access |
| 8000 | Coolify | Via tunnel | PaaS panel |
| 8200 | Infisical | localhost | Vault secrets |

### Portas Ativas — AI/ML Stack

| Porta | Serviço | Acesso | Função |
|-------|---------|--------|--------|
| 11434 | Ollama | localhost + bridge | LLM local (GPU) |
| 4000 | LiteLLM proxy | localhost+LAN | LLM proxy (gemma4, llava) |
| 4004 | nginx-ratelimit | host | Rate-limited proxy → :4000 |
| 4005 | ai-router | host | FastAPI intelligent routing |
| 6333 | Qdrant | localhost | Vector DB (sem auth) |
| 6334 | Qdrant gRPC | bridge | Vector DB gRPC |
| 8012 | Kokoro TTS | localhost | GPU TTS (host bridge) |
| 8201 | whisper-api | localhost + bridge | Faster-Whisper STT |
| 8203 | wav2vec2-proxy | qgtzrmi net | Deepgram API → whisper-api proxy |

### Portas Ativas — Observability

| Porta | Serviço | Acesso | Função |
|-------|---------|--------|--------|
| 3100 | Grafana | LAN only | Dashboard (⚠️ sem auth verificada) |
| 3101 | Loki | LAN only | Log aggregation |
| 9090 | Prometheus | localhost | TSDB metrics 30d (⚠️ sem auth) |
| 9100 | node-exporter | host | Host metrics |
| 9250 | cadvisor | localhost | Container metrics |
| 9835 | nvidia-gpu-exporter | LAN | GPU metrics (⚠️ exposto LAN) |

### Portas Ativas — Automation & Dev

| Porta | Serviço | Acesso | Função |
|-------|---------|--------|--------|
| 4003 | Claude Code Panel | localhost | nginx estático |
| 4006 | MCP Monorepo | qgtzrmi net | /srv/monorepo → OpenClaw |
| 4011 | MCP Qdrant | qgtzrmi net | Semantic search |
| 5678 | n8n | Via tunnel (Docker net) | Workflow automation |
| 8888 | SearXNG | localhost | Search engine |

### Faixa Livre para Dev

```
4002–4099  Faixa livre para microserviços (dev local)
5173       Vite frontend (dev)
3001–3010  Reservadas (não usar :3000)
3333       Monorepo dev (não está rodando)
```

---

## 3. Docker Networks

### Redes Disponíveis

| Rede | Subnet | Serviços |
|------|--------|----------|
| `coolify` | 10.0.6.0/24 | n8n (:5678), Coolify itself |
| `qgtzrmi6771lt8l7x8rqx72f` | 10.0.19.0/24 | OpenClaw (:8080), browser (:9222), wav2vec2 (:8201), wav2vec2-proxy (:8203), mcp-monorepo (:4006), mcp-qdrant (:4011) |
| `zappro-lite` | 10.0.1.0/24 (docker0) | LiteLLM proxy (:4000), LiteLLM PostgreSQL (:5432) |
| `monitoring_monitoring` | 10.0.4.0/24 | Grafana (:3100), Prometheus (:9090), Loki (:3101), Promtail (:9080) |
| `bridge` | host | Kokoro (:8880), Qdrant (:6333), SearXNG (:8888), zappro-redis (:6379) |
| `infisical-net` | — | Infisical vault |
| `monorepo_default` | — | connected_repo_db |

### IPs de Serviços (Cross-Network)

| Serviço | IP | Rede Destino | Como Acessar |
|---------|-----|--------------|---------------|
| Ollama (host) | 10.0.1.1:11434 | docker0 / qgtzrmi | Container → host |
| LiteLLM proxy | 10.0.1.1:4000 | zappro-lite | Containers Coolify → docker0 |
| Kokoro TTS | 10.0.19.7:8880 | bridge | Containers qgtzrmi → bridge |
| Qdrant (Coolify) | 10.0.19.5:6333 | bridge | Containers qgtzrmi → bridge |
| wav2vec2 | 10.0.19.8:8201 | qgtzrmi | STT endpoint |
| wav2vec2-proxy | 10.0.19.9:8203 | qgtzrmi | Deepgram format proxy |
| MCP Monorepo | 10.0.19.50:4006 | qgtzrmi | OpenClaw → host /srv/monorepo |
| MCP Qdrant | 10.0.19.51:4011 | qgtzrmi | OpenClaw → openclaw-memory |

---

## 4. Subdomínios e URLs

### Tabela de Subdomínios

| Subdomínio | Porta | Target | Access Policy |
|------------|-------|--------|---------------|
| `api.zappro.site` | 4000 | localhost:4000 | zappro.ia@gmail.com |
| `bot.zappro.site` | 4001 | localhost:4001 | **NONE (public)** |
| `chat.zappro.site` | 8080 | localhost:8080 (Coolify) | zappro.ia@gmail.com |
| `coolify.zappro.site` | 8000 | localhost:8000 | zappro.ia@gmail.com |
| `git.zappro.site` | 3300 | localhost:3300 | zappro.ia@gmail.com |
| `llm.zappro.site` | 4000 | localhost:4000 | zappro.ia@gmail.com |
| `monitor.zappro.site` | 3100 | localhost:3100 | LAN only (192.168.0.0/16) |
| `n8n.zappro.site` | 5678 | 10.0.6.3:5678 | zappro.ia@gmail.com |
| `painel.zappro.site` | 4003 | localhost:4003 | zappro.ia@gmail.com |
| `qdrant.zappro.site` | 6333 | localhost:6333 | zappro.ia@gmail.com |
| `vault.zappro.site` | 8200 | localhost:8200 | zappro.ia@gmail.com |

### URL Patterns

**Para serviços internos (de outros containers):**
```
liteLLM:     http://zappro-litellm:4000
wav2vec2:    http://zappro-wav2vec2:8201
wav2vec2-proxy: http://zappro-wav2vec2-proxy:8203
OpenClaw:    http://openclaw-qgtzrmi6771lt8l7x8rqx72f:8080
```

**Para serviços no host (de containers):**
```
Ollama (host):    http://10.0.1.1:11434
LiteLLM (docker0): http://10.0.1.1:4000
Kokoro (bridge):   http://10.0.19.7:8880
Qdrant (bridge):   http://10.0.19.5:6333
```

**Para serviços expostos via Cloudflare Tunnel:**
```
https://api.zappro.site      → LiteLLM proxy
https://bot.zappro.site      → OpenClaw Bot (public)
https://chat.zappro.site     → Open WebUI
https://coolify.zappro.site  → Coolify PaaS
https://git.zappro.site      → Gitea
https://llm.zappro.site      → LiteLLM proxy
https://monitor.zappro.site  → Grafana (LAN only)
https://n8n.zappro.site      → n8n automation
https://painel.zappro.site   → Claude Code Panel
https://qdrant.zappro.site   → Qdrant vector DB
https://vault.zappro.site    → Infisical vault
```

---

## 5. Cloudflare Tunnel Routing

### Arquitetura

```
bot.zappro.site
    → DNS CNAME → aee7a93d-...cfargotunnel.com (Cloudflare proxied)
    → Cloudflare Edge (GRU) → cloudflared QUIC tunnel
    → cloudflared daemon (host) → ingress rule lookup
    → http://localhost:4001 (OpenClaw port mapping 4001→8080)
    → container openclaw-qgtzrmi...:8080
```

### Configuração

- **Terraform** (`/srv/ops/terraform/cloudflare/main.tf`) é **authoritative** para Cloudflare API
- `~/.cloudflared/config.yml` é apenas **referência local** (pode estar desatualizado)
- Para mudar qualquer rota: **Terraform first** → `terraform apply` → `systemctl restart cloudflared`

### Verificar Status do Tunnel

```bash
# Status do daemon
sudo systemctl status cloudflared

# Logs recentes
journalctl -u cloudflared --no-pager -n 20

# Testar subdomínio
curl -sfI https://bot.zappro.site

# Verificar drift Terraform
cd /srv/ops/terraform/cloudflare && terraform plan
```

---

## 6. Comandos de Verificação

### Verificar Porta em Uso

```bash
# Verificar porta específica
ss -tlnp | grep :8000

# Ver todas as portas em uso
ss -tlnp

# Ver portas UDP
ss -ulnp

# netstat alternativo
netstat -tlnp | grep :8000
```

### Verificar Container e Rede

```bash
# Listar networks Docker
docker network ls

# Ver networks de um container
docker inspect openclaw-qgtzrmi6771lt8l7x8rqx72f --format '{{json .NetworkSettings.Networks}}'

# Verificar containers em uma network
docker network inspect qgtzrmi6771lt8l7x8rqx72f --format '{{range .Containers}}{{.Name}} {{end}}'

# Testar conectividade de dentro do container
docker exec zappro-litellm curl -sf http://wav2vec2:8201/health
```

### Verificar Serviço Específico

```bash
# Coolify
curl -sf http://localhost:8000/health

# LiteLLM
curl -sf http://localhost:4000/health

# OpenClaw
curl -sf http://localhost:4001/health

# Grafana
curl -sf http://localhost:3100/api/health

# Prometheus
curl -sf http://localhost:9090/-/healthy

# wav2vec2/STT
curl -sf http://localhost:8201/health

# Ollama
curl -sf http://localhost:11434/api/tags
```

### Verificar DNS e Tunnel

```bash
# Resolver subdomínio
nslookup bot.zappro.site

# Testar rota externa
curl -sfI https://bot.zappro.site

# Ver Cloudflare tunnel status
cloudflared tunnel info will-zappro-homelab
```

---

## 7. Regras Anti-Conflito

```
❌ NUNCA usar :8000        → Coolify (já em uso)
❌ NUNCA usar :4000        → LiteLLM produção (já em uso)
❌ NUNCA usar :4001        → OpenClaw Bot (já em uso)
❌ NUNCA usar :3000        → Reservada para Open WebUI
❌ NUNCA usar :8080        →cloudflared/Traefik (já em uso)

✅ Dev local no monorepo: usar PORT=4002+ ou PORT=5173 (Vite)
✅ Microserviços novos: faixa 4002–4099
```

---

## 8. Padrões de Acesso por Tipo

### Host Local → Container

```bash
# Via localhost (porta exposta no host)
curl http://localhost:4000/health

# Via docker0 bridge (10.0.1.x)
curl http://10.0.1.1:4000/health
```

### Container → Container (mesma rede)

```bash
# Nome do container como hostname (Docker DNS)
docker exec zappro-litellm curl http://wav2vec2:8201/health

# IP do container na rede
docker exec zappro-litellm curl http://10.0.19.8:8201/health
```

### Container → Host

```bash
# Via docker0 bridge gateway
curl http://10.0.1.1:11434/api/tags

# Via bridge network (Kokoro, Qdrant)
curl http://10.0.19.7:8880/v1/models
```

### De Fora (Internet) → Host

```bash
# Via Cloudflare Tunnel (subdomínio)
curl -sfI https://bot.zappro.site

# Via Tailscale VPN (acesso direto)
curl http://100.83.45.79:4001/health
```

---

## 9. Quick Reference Card

|needed? | Service | Internal URL | External URL |
|--------|---------|--------------|--------------|
| LLM proxy | LiteLLM | http://localhost:4000 | https://api.zappro.site |
| Voice bot | OpenClaw | http://localhost:4001 | https://bot.zappro.site |
| STT | wav2vec2 | http://localhost:8201 | — |
| STT proxy | wav2vec2-proxy | http://localhost:8203 | — |
| TTS | Kokoro | http://10.0.19.7:8880 | — |
| Vector DB | Qdrant | http://localhost:6333 | https://qdrant.zappro.site |
| Git | Gitea | http://localhost:3300 | https://git.zappro.site |
| PaaS | Coolify | http://localhost:8000 | https://coolify.zappro.site |
| Vault | Infisical | http://localhost:8200 | https://vault.zappro.site |
| Logs | Grafana | http://localhost:3100 | https://monitor.zappro.site |
| Automation | n8n | http://10.0.6.3:5678 | https://n8n.zappro.site |
| Chat UI | Open WebUI | http://localhost:8080 | https://chat.zappro.site |
| Panel | Claude Panel | http://localhost:4003 | https://painel.zappro.site |

---

## Fontes

- `/srv/monorepo/docs/INFRASTRUCTURE/PORTS.md` — Tabela completa de portas
- `/srv/monorepo/docs/INFRASTRUCTURE/NETWORK_MAP.md` — Mapa de rede detalhado
- `/srv/monorepo/docs/INFRASTRUCTURE/SUBDOMAINS.md` — Registro de subdomínios
- `/srv/ops/terraform/cloudflare/main.tf` — Terraform (source of truth para tunnel)