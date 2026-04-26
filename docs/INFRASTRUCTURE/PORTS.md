# Port Allocation — will-zappro

**Autoridade:** [NETWORK_MAP.md](/srv/ops/ai-governance/NETWORK_MAP.md) (leia este primeiro)
**Última verificação:** 2026-04-06 — audit homelab: removido open-webui do :8080, adicionado tts-bridge :4007, painel :4003, searxng :8888

---

## ✅ Portas ATIVAS — verificado 2026-04-02

### Stack Coolify `/data/coolify/`

| Porta | Container | Acesso | Função |
|-------|-----------|--------|--------|
| **6001** | coolify-realtime (soketi) | host | WebSocket real-time |
| **6002** | coolify-realtime (soketi) | host | WebSocket real-time |
| **8000** | coolify (→ :8080 interno) | host | PaaS panel → coolify.zappro.site |

### Stack Zappro `~/zappro/` (formerly aurelia)

| Porta | Container | Acesso | Função | Subdomínio |
|-------|-----------|--------|--------|------------|
| **3100** | grafana | host | Dashboard | monitor.zappro.site |
| **3334** | zappro-litellm | host | LiteLLM UI/dashboard interno | — |
| **4000** | zappro-litellm | host | LiteLLM proxy (venv) | api.zappro.site / llm.zappro.site |
| **4004** | nginx-ratelimit | host | nginx rate-limited proxy → :4000 | — |
| **4005** | ai-router | host | AI Router (FastAPI) - intelligent routing | — |
| **5678** | n8n | host | Workflow automation | n8n.zappro.site |
| **6333** | zappro-qdrant | host | Qdrant REST | qdrant.zappro.site |
| **6334** | zappro-qdrant | host | Qdrant gRPC | — |
| **6379** | zappro-redis | host | Redis cache/pubsub | — |
| **6381** | aurelia-redis | localhost | Redis (aurelia stack) | — |
| **8012** | zappro-kokoro | localhost | Kokoro TTS (GPU) | — |
| **8880** | zappro-kokoro | bridge (Coolify net) | Kokoro TTS — IP `10.0.19.7:8880` para containers Coolify | — |
| **8080** | — | host | Deprecated (era aurelia-api) | aurelia.zappro.site |
| **8888** | searxng | host | Search engine (OpenCode) | — |
| **9090** | prometheus | localhost | TSDB métricas 30d | — |
| **9100** | node-exporter | host | Métricas host | — |
| **9250** | cadvisor | localhost | Métricas containers | — |
| **9835** | nvidia-gpu-exporter | host | NVIDIA GPU metrics (Prometheus) | — |

### Serviços Non-Docker

| Porta | Processo | Acesso | Função |
|-------|----------|--------|--------|
| **22** | sshd | host | SSH |
| **11434** | ollama (systemd) | localhost + docker0 bridge | LLM local (gemma4, llava, nomic-embed-text) — GPU via `10.0.1.1:11434` |
| **8201** | whisper-api (host) | localhost + docker0 bridge | Faster-Whisper small STT (OpenAI-compatible `/v1/audio/transcriptions`) |

---

### Stack Gitea/OpenClaw (Coolify)

| Porta | Container | Acesso | Função | Subdomínio |
|-------|-----------|--------|--------|------------|
| **3300** | gitea | host | Gitea Git server | git.zappro.site |
| **4001** | openclaw-qgtzrmi... | localhost | OpenClaw Bot UI | bot.zappro.site |
| **4003** | painel | host | Claude Code Panel (nginx:alpine) | painel.zappro.site |
| **4006** | mcp-monorepo | qgtzrmi net (10.0.19.50) | MCP Filesystem /srv/monorepo → OpenClaw | — |
| **4011** | mcp-qdrant | qgtzrmi net (10.0.19.51) | MCP Qdrant semantic search (openclaw-memory) | — |
| **8201** | whisper-api | host | Faster-Whisper STT (OpenAI-compatible) | — |

### Novos Serviços (2026-04-03)

| Porta | Container | Acesso | Função | Subdomínio |
|-------|-----------|--------|--------|------------|
| **4002** | — | localhost | ShieldGemma 9B (PENDENTE — nunca deployado) | — |
| **4003** | python http.server | host | Claude Code Panel HTML estático | painel.zappro.site |
| **8200** | infisical | localhost | Infisical vault self-hosted | vault.zappro.site |

## ⏳ Portas RESERVADAS — Pendente Deploy (Coolify)

| Porta | Serviço Planejado | Subdomínio | Status |
|-------|------------------|------------|--------|
| **3000** | Reservada | — | ⚠️ DEPRECATED — OpenWebUI foi removido do :8080 |
| **3010** | Open WebUI (se precisar) | chat.zappro.site | ⏳ Deploy via Coolify pendente |

---

## ✅ Portas LIVRES (confirmado 2026-04-02)

| Porta | Observação |
|-------|-----------|
| **80 / 443** | CapRover removido — livres (reservar para proxy futuro) |
| **3001 / 3002** | livres |
| **3333** | monorepo dev — não rodando |
| **4002–4099** | faixa livre para microserviços |
| **8443** | livre (Supabase removido) |
| **9000** | livre |

### Cross-Network Access (Docker Bridge → Host/Coolify)

| Porta | Destino | Rede Destino | Acesso via |
|-------|---------|--------------|------------|
| **4000** | LiteLLM Proxy | docker0 (10.0.1.1) | Coolify containers via `10.0.1.1:4000` |
| **8880** | Kokoro TTS | bridge (10.0.19.7) | Coolify containers via `10.0.19.7:8880` |
| **6333** | Qdrant (Coolify) | Coolify network (10.0.19.5) | Containers via `10.0.19.5:6333` |

---

## ❌ Portas REMOVIDAS (serviços extintos)

| Porta | Serviço | Motivo |
|-------|---------|--------|
| 80 / 443 / 3000 | captain-nginx / CapRover | substituído por Coolify |
| 5433 / 5435 / 6543 | Supabase PgBouncer / Postgres | Supabase removido |
| 8001 / 8443 / 54323 | Supabase Kong / Studio | Supabase removido |
| 8020 | whisper-local STT | substituído por Deepgram cloud |
| 5440 | litellm-db | removido |
| 6379 | aurelia-redis (legado) | substituído por `zappro-redis` (:6379) + `redis-opencode` (:6381) |

---

## Regras Anti-Conflito

```
❌ NUNCA usar :8000 → Coolify
❌ NUNCA usar :4000 em dev local sem checar zappro-litellm
❌ NUNCA usar :3000 → reservada para Open WebUI (Coolify)
❌ NUNCA usar :4001 → reservada para OpenClaw Bot (Coolify)
✅ Dev local no monorepo: usar PORT=4002+ ou PORT=5173 (Vite)
```

## Verificar Porta em Uso

```bash
ss -tlnp | grep :PORTA
```

## Ao Adicionar Nova Porta

1. `ss -tlnp | grep :PORTA` — confirmar livre
2. Adicionar nesta tabela
3. Atualizar [NETWORK_MAP.md](/srv/ops/ai-governance/NETWORK_MAP.md)
4. Se subdomínio público: atualizar [SUBDOMAINS.md](/srv/ops/ai-governance/SUBDOMAINS.md) + tunnel config remota + Terraform

---

**Ver também:** [NETWORK_MAP.md](/srv/ops/ai-governance/NETWORK_MAP.md) | [SUBDOMAINS.md](/srv/ops/ai-governance/SUBDOMAINS.md)
