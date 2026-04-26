# Mapa de Serviços & Dependências

**Host:** will-zappro
**Atualizado:** 2026-04-06
**Total containers ativos:** 26

---

## 1. Stacks Ativas

### Stack: Plataforma (`/srv/apps/platform/docker-compose.yml`)

#### Qdrant (Banco de Vetores)
- **Imagem:** qdrant/qdrant:latest
- **Container:** qdrant | **Portas:** 6333 (REST), 6334 (gRPC)
- **Storage:** /srv/data/qdrant (ZFS tank/qdrant)
- **Health:** `curl http://localhost:6333/health`
- **Logs:** `docker logs qdrant`
- **Backup:** `/srv/ops/scripts/backup-qdrant.sh`
- **Depende de:** nada | **Usado por:** n8n, monorepo worker-ai, voice pipeline

#### n8n (Automação de Workflows)
- **Imagem:** n8nio/n8n:latest
- **Container:** n8n | **Porta:** 5678
- **Storage:** /srv/data/n8n (ZFS tank/n8n)
- **Health:** `curl http://localhost:5678/api/v1/health`
- **Logs:** `docker logs n8n`
- **Backup:** `/srv/ops/scripts/backup-n8n.sh`
- **Depende de:** n8n-postgres | **Usado por:** orquestrador do pipeline de voz

#### PostgreSQL n8n
- **Imagem:** postgres:16-alpine
- **Container:** n8n-postgres | **Porta:** interna (não exposta ao host)
- **Storage:** /srv/data/postgres (ZFS tank/postgres)
- **Health:** `docker exec n8n-postgres pg_isready -U n8n`
- **Backup:** `/srv/ops/scripts/backup-postgres.sh`
- **Depende de:** nada | **Usado por:** n8n

---

### Stack: Supabase (`/srv/apps/supabase/docker/docker-compose.yml`) — **REMOVED 2026-04-06**

> ⚠️ **Stack desativado.** Supabase foi removido do ambiente.Usado por:** aplicações web antigas (desativadas).

---

### Supabase: Schema `catalog` (Catálogo Central de Dados) — **REMOVED 2026-04-06**

> ⚠️ **Schema removido.** Catálogo central foi desativado junto com o stack Supabase.

---

### Stack: CapRover (`/srv/apps/caprover/`)

| Container | Porta Host | Função |
|-----------|-----------|--------|
| captain-nginx | 80, 443 | Reverse proxy + SSL |
| captain-captain | 3000 | Dashboard CapRover |
| captain-certbot | interno | Renovação SSL automática |

- **Status:** ✅ Ativo (sem domínio público ainda)
- **Depende de:** nada | **Usado por:** futuras apps públicas via domínio

---

### Stack: Voz (`/srv/apps/voice/docker-compose.yml`) — **REMOVED 2026-04-06**

> ⚠️ **Stack desativado.** speaches e chatterbox foram removidos.Voice pipeline agora usa Kokoro TTS e Whisper API como serviços independentes.

| Componente | Status |替代 |
|-----------|--------|-----|
| voice-proxy (nginx) | REMOVED | — |
| speaches (STT) | REMOVED | Whisper API em :8201 |
| chatterbox-tts (TTS) | REMOVED | Kokoro TTS em :8012/:8880 |

---

### Stack: Kokoro TTS (`/srv/apps/kokoro/`)

#### Kokoro TTS (Text-to-Speech)
- **Imagem:** ghcr.io/remsky/kokoro-onnx:latest
- **Container:** kokoro | **Portas:** 8012 (host), 8880 (interna)
- **Modelo:** Kokoro 82M (ONNX, PT-BR otimizado)
- **Storage:** /srv/models/kokoro
- **GPU:** RTX 4090 via CDI
- **VRAM:** ~1,5 GB
- **Latência:** ~0,3s quente / 1,2s fria
- **API:** `POST :8012/v1/audio/speech` (OpenAI-compatible)
- **Vozes disponíveis:** múltiplas vozes PT-BR
- **Depende de:** nada | **Usado por:** OpenClaw, voice pipeline

#### Whisper API (STT — Speech-to-Text)
- **Container:** whisper-api | **Porta:** 8201 (host)
- **Modelo:** faster-whisper-large-v3 (CUDA)
- **VRAM:** ~4 GB
- **API:** `POST :8201/v1/audio/transcriptions` (OpenAI-compatible)
- **Depende de:** nada | **Usado por:** OpenClaw, voice pipeline

---

### tts-bridge — **REMOVED 2026-04-06**

> Serviço de bridge Kokoro → outros formatos. Removido após consolidação do stack de voz.

---

### Stack: LiteLLM (`/srv/apps/litellm/docker-compose.yml`)

#### litellm (LLM Gateway)
- **Imagem:** ghcr.io/berriai/litellm:main-stable
- **Container:** litellm | **Porta:** 4000 (network_mode: host)
- **API:** http://localhost:4000/v1 (OpenAI-compatible) → https://llm.zappro.site/v1
- **UI admin:** http://localhost:4000/ui
- **Auth:** Bearer token (master key + virtual keys)
- **Modelos expostos:** `gpt-4o`, `qwen3.5`, `bge-m3`, `text-embedding-ada-002`
- **Backend:** Ollama em localhost:11434
- **Depende de:** litellm-db, ollama | **Usado por:** qualquer app via OPENAI_BASE_URL

#### litellm-db (PostgreSQL interno)
- **Imagem:** postgres:16-alpine
- **Container:** litellm-db | **Porta:** 127.0.0.1:5440→5432
- **Função:** Armazena virtual keys, spend tracking, usuários
- **Credenciais:** user=litellm, db=litellm
- **Depende de:** nada | **Usado por:** litellm

---

### Stack: OpenClaw Bot (Coolify managed)

#### OpenClaw Gateway + Telegram Bot
- **Imagem:** coollabsio/openclaw:2026.2.6 (PINADA)
- **Container:** openclaw-qgtzrmi6771lt8l7x8rqx72f | **Porta:** 8080 (nginx)
- **Bot:** @CEO_REFRIMIX_bot (Telegram polling)
- **Modelo primario:** minimax/MiniMax-M2.7 (DIRETO via api.minimax.io)
- **Visao (olhos):** liteLLM/llava (via LiteLLM -> Ollama GPU)
- **TTS (boca):** Kokoro PT-BR (10.0.19.6:8880, voice pm_santa)
- **STT (ouvidos):** Deepgram nova-3 (cloud)
- **Config:** Volume persistente `/data/.openclaw/openclaw.json`
- **Health:** `docker logs openclaw-qgtzrmi6771lt8l7x8rqx72f --tail 5`
- **Debug:** `/srv/ops/ai-governance/OPENCLAW_DEBUG.md`
- **Depende de:** MiniMax API (cloud), LiteLLM (visao), Kokoro (TTS)

#### Browser (Chrome DevTools)
- **Imagem:** coollabsio/openclaw-browser:latest
- **Container:** browser-qgtzrmi6771lt8l7x8rqx72f | **Porta:** 9223 (interna)
- **Depende de:** nada | **Usado por:** OpenClaw (browsing agent)

---

### Serviço: Ollama (LLM local — systemd, não Docker)

- **Processo:** systemd unit `ollama`
- **Porta:** 11434
- **API:** http://localhost:11434 (OpenAI-compatible)

| Modelo | Params | Quant | VRAM | Contexto | Capacidades |
|--------|--------|-------|------|----------|-------------|
| qwen3.5 | 9,65B | Q4_K_M | ~6,5 GB | 262.144 tokens | completion, vision, tools, **thinking** |
| gemma4 | 12B | Q4_K_M | ~7 GB | 32.768 tokens | completion, instruction |
| llava | 7B | Q4_K_M | ~4,5 GB | 8.192 tokens | vision (multi-modal) |
| nomic-embed-text | 274M | F16 | ~0,5 GB | 8.192 tokens | embedding (1024 dims) |
| bge-m3 | 566M | F16 | ~1,2 GB | 8.192 tokens | embedding (1024 dims) |

- **Comportamento:** descarrega modelos após ~5 min de inatividade
- **Verificar carregados:** `curl http://localhost:11434/api/ps`
- **Depende de:** nada | **Usado por:** n8n, monorepo worker-ai, OpenClaw (llava)

---

### Stack: Monitoramento (`/srv/apps/monitoring/docker-compose.yml`)

| Container | Porta Host | Função |
|-----------|-----------|--------|
| grafana | 3100 | Dashboard Grafana → monitor.zappro.site |
| prometheus | 9090 | TSDB métricas (retenção 30d) |
| node-exporter | 9100 | CPU/RAM/disk/ZFS/network (host network) |
| nvidia-gpu-exporter | 9835 | GPU temp/util/VRAM via nvidia-smi (CDI) |
| cadvisor | 9250 | Métricas de containers Docker |

- **Storage:** /srv/data/monitoring/{grafana,prometheus} (ZFS tank)
- **Dashboard:** GPU with Linux Server (ID 20003)
- **GPU:** nvidia_gpu_exporter usa nvidia-smi, zero VRAM
- **Depende de:** nada | **Usado por:** monitor.zappro.site (público via Cloudflare Tunnel)

---

### Dev: connected_repo_db

- **Imagem:** postgres (template monorepo)
- **Container:** connected_repo_db | **Porta:** 5432
- **Uso:** banco local para desenvolvimento do Connected Repo Starter

---

## 2. Grafo de Dependências

```
RTX 4090 (GPU CDI)
    ├── Whisper API (STT, ~4GB VRAM)
    └── Kokoro TTS (TTS, ~1,5GB VRAM)

OpenClaw :8080 (@CEO_REFRIMIX_bot)
    ├── → MiniMax API (cloud, direto, cerebro)
    ├── → LiteLLM :4000 (llava=olhos via Ollama)
    ├── → Kokoro :8880 (TTS=boca)
    └── → Deepgram (cloud, STT=ouvidos)

LiteLLM :4000 (→ llm.zappro.site)
    ├── → Ollama :11434 (qwen3.5, gemma4, llava, nomic-embed-text)
    ├── → Whisper API :8201 (STT)
    ├── → Kokoro :8012 (TTS)
    └── → litellm-db :5440 (virtual keys)

Ollama :11434
    ├── qwen3.5 (LLM, ~6.5GB VRAM)
    ├── gemma4 (LLM, ~7GB VRAM)
    ├── llava (vision, ~4.5GB VRAM)
    ├── bge-m3 (embeddings, ~1.2GB VRAM)
    └── nomic-embed-text (embeddings, ~0.5GB VRAM)

Kokoro TTS :8012/:8880
    └── → vozes PT-BR (Abigail, Adrian, ..., Thomas)

n8n :5678
    ├── → n8n-postgres :5432 (interna)
    ├── → Qdrant :6333 (vetores)
    ├── → Ollama :11434 (LLM + embed)
    └── → Whisper API :8201 (STT)
```

---

## 3. Budget VRAM (RTX 4090 — 24 GB)

| Componente | VRAM | Estado |
|-----------|------|--------|
| Desktop Xorg + GNOME | ~1 GB | fixo sempre |
| Whisper API (faster-whisper large-v3) | ~4 GB | sob demanda |
| Kokoro TTS (ONNX) | ~1,5 GB | sob demanda |
| Qwen 3.5 Q4_K_M | ~6,5 GB | sob demanda (Ollama) |
| Gemma4 Q4_K_M | ~7 GB | sob demanda (Ollama) |
| Llava Q4_K_M | ~4,5 GB | sob demanda (OpenClaw vision) |
| BGE-M3 F16 | ~1,2 GB | sob demanda (Ollama) |
| Nomic-embed-text F16 | ~0,5 GB | sob demanda (Ollama) |
| **Pior caso total** | **~25,7 GB** | **Excede! Gerenciar carga** |
| **Estado atual (sem gemma4)** | **~10 GB** | **~14 GB livres** |

> ⚠️ Carregar gemma4 + qwen3.5 simultaneamente excede VRAM. Ollama descarrega modelos inativos automaticamente.

---

## 4. Ordem de Boot (se tudo parado)

```
1. Docker Engine (systemd)
2. docker-compose -f /srv/apps/platform/docker-compose.yml up -d
3. docker-compose -f /srv/apps/supabase/docker/docker-compose.yml up -d
4. docker-compose -f /srv/apps/caprover/docker-compose.yml up -d
5. docker-compose -f /srv/apps/voice/docker-compose.yml up -d
6. docker-compose -f /srv/apps/monitoring/docker-compose.yml up -d
7. docker-compose -f /srv/apps/litellm/docker-compose.yml up -d
8. systemctl start ollama                         (Ollama — se não autostart)
```

---

## 5. Recuperação Rápida

```bash
# Voice stack down
docker-compose -f /srv/apps/voice/docker-compose.yml up -d

# Plataforma down
docker-compose -f /srv/apps/platform/docker-compose.yml up -d

# Supabase down
docker-compose -f /srv/apps/supabase/docker/docker-compose.yml up -d

# Ver todos os containers
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# VRAM atual
nvidia-smi --query-gpu=memory.used,memory.free --format=csv,noheader
```

---

**Atualizado:** 2026-03-18 | **Revisão:** mensal ou ao adicionar serviços
