# Arquitetura do Sistema — Homelab Multi-Claude

**Data:** 2026-04-22
**Fonte:** CLAUDE_CODE_BLUEPRINT.md, SERVICE_MAP.md, PORTS.md
**Versao:** 1.0

---

## 1. Visao Geral

```
PC PRINCIPAL (Gen5 4TB NVMe + RTX 4090 24GB + 64GB RAM)
│
├── Ubuntu Server (headless, SSH do PC secundario)
├── ZFS pool: tank (4TB RAID-Z)
│
├── ┌─────────────────────────────────────────────────────────────┐
├── │  Bare Metal Services                                        │
│   │  • Hermes Gateway :8642 (Telegram bot + voice agent)       │
│   │  • Hermes MCP :8092 (MCPO bridge para Claude Code)         │
│   │  • Ollama :11434 (RTX 4090 — Gemma4 local)                 │
│   │  • zappro-api :4003 (FastAPI auth JWT)                     │
│   │  • ai-gateway :4002 (OpenAI-compat facade — TTS/STT/Vision)│
│   │  • opencode-go :9000 (OpenCode CLI)                        │
│   └─────────────────────────────────────────────────────────────┘
│
├── ┌─────────────────────────────────────────────────────────────┐
├── │  Docker Compose Stack                                       │
│   │  • LiteLLM :4000 (multi-provider proxy — MiniMax/GPT)     │
│   │  • Grafana :3100 (dashboards)                              │
│   │  • Loki :3101 (logs)                                      │
│   │  • Prometheus :9090 (metrics)                              │
│   │  • Qdrant :6333 (vector DB — RAG)                          │
│   │  • ai-router :4005 (routing inteligente)                   │
│   │  • nginx-ratelimit :4004 (rate limiting → :4000)           │
│   └─────────────────────────────────────────────────────────────┘
│
└── PC SECUNDARIO (Gen3 1TB NVMe + RTX 3060 12GB + 32GB RAM)
    └── Dashboard principal (SSH para PC principal)
```

---

## 2. Ordem de Carregamento de Contexto (Obligatoria)

Antes de qualquer tarefa, ler nesta ordem:

```bash
# 1. Monorepo AGENTS.md (source of truth para processos)
cat /srv/monorepo/AGENTS.md | tail -200

# 2. Second Brain TREE (mapeia estrutura de conhecimento)
cat ~/Desktop/hermes-second-brain/TREE.md 2>/dev/null || ls ~/Desktop/hermes-second-brain/

# 3. OPS Governance (regras operacionais)
cat /srv/ops/ai-governance/README.md 2>/dev/null
cat /srv/ops/ai-governance/CONTRACT.md 2>/dev/null

# 4. Sistema atual (se mudanca de infra)
cat ~/Desktop/SYSTEM_ARCHITECTURE.md 2>/dev/null
```

---

## 3. Projetos

| Projeto | Path | Tipo | Stack |
|---------|------|------|-------|
| **Monorepo** | `/srv/monorepo` | pnpm workspaces + Fastify/tRPC | TypeScript, Biome |
| **Second Brain** | `~/Desktop/hermes-second-brain` | Obsidian-style vault | Markdown, Git |
| **Hermes Agent** | `~/.hermes/hermes-agent` | Python asyncio | Claude Code, MCP |
| **OPS Scripts** | `/srv/ops/scripts` | Bash + Terraform | Docker, ZFS |

### 3.1 Monorepo — Estrutura

```
/srv/monorepo/
├── apps/                    # Aplicacoes deployaveis
├── packages/                # Bibliotecas compartilhadas
│   └── zod-schemas/        → Validacao Zod-first (unica fonte)
├── docs/
│   ├── SPECS/              → SPEC-XXX.md (specs ativos)
│   └── INFRASTRUCTURE/
│       ├── PORTS.md        → Mapa de portas (OBRIGATORIO atualizar)
│       └── SUBDOMAINS.md   → Subdominios Cloudflare
├── orchestrator/           → Pipeline de 3 fases
│   └── scripts/
│       ├── run-pipeline.sh
│       ├── snapshot.sh
│       └── rollback.sh
└── .claude/
    └── skills/orchestrator/logs/  → Logs dos agentes
```

### 3.2 Second Brain

Vault Obsidian-style em `~/Desktop/hermes-second-brain/` com:
- TREE.md — mapeia toda a estrutura de conhecimento
- Notas interconnectadas para pesquisa rapida
- Sincronizado via Git

### 3.3 Hermes Agent

Python asyncio agent que executa em `~/.hermes/hermes-agent`:
- Telegram bot para triggers
- Voice agent com Edge TTS + Groq Whisper
- MCP bridge via Hermes MCP :8092

---

## 4. Setup de Hardware

### PC Principal

```
CPU:    Gen5 (generacao atual)
NVMe:   4TB (RAID-Z ZFS pool)
GPU:    RTX 4090 24GB (VRAM — 23GB livre quando Gemma4 nao carregado)
RAM:    64GB
OS:     Ubuntu Server (headless)
Rede:   SSH so via PC secundario
ZFS:    tank (4TB RAID-Z)
```

### PC Secundario

```
CPU:    Gen3
NVMe:   1TB
GPU:    RTX 3060 12GB
RAM:    32GB
OS:     Dashboard principal
Funcao: SSH para PC principal, monitor, terminal
```

### VRAM Strategy

- **Gemma4:26b-q4** carregado sob demanda (22GB VRAM)
- **LiteLLM** faz pooling automatico entre MiniMax/GPT
- Quando Gemma4 carregado: VRAM disponivel cai para ~1GB

---

## 5. Topologia de Servicos

### 5.1 Ports Ativos (Nao Usar)

| Port | Servico | Host | Proposito |
|------|---------|------|-----------|
| :3000 | zappro-web | Ubuntu Desktop | React chat UI (dark mode) |
| :4000 | LiteLLM | Docker Compose | Production LLM proxy |
| :4002 | ai-gateway | Ubuntu Desktop | OpenAI-compat facade (TTS/STT/Vision) |
| :4003 | zappro-api | Ubuntu Desktop | FastAPI auth JWT + proxy LiteLLM |
| :8000 | Coolify | Ubuntu Desktop | Container management (PaaS) |
| :8080 | OpenWebUI | Coolify | Chat interface |
| :8092 | Hermes MCP | Ubuntu bare metal | MCPO bridge (Claude Code) |
| :8642 | Hermes Gateway | Ubuntu bare metal | Telegram bot + voice agent |
| :6333 | Qdrant | Coolify | Vector DB (RAG/embeddings) |

### 5.2 Ports Livres para Dev

| Faixa | Uso |
|-------|-----|
| 4004–4099 | Microservicos (dev) |
| :5173 | Vite frontend dev |

### 5.3 Diagrama de Conectividade

```
                        Cloudflare Tunnel
                    (cloudflared — SSL termination)
                              │
            ┌─────────────────┼─────────────────┐
            │                 │                 │
     coolify.zappro.    hermes.zappro.    api.zappro.
           site             site              site
            │                 │                 │
     ┌──────▼──────┐   ┌──────▼──────┐   ┌──────▼──────┐
     │   Traefik   │   │  Cloudflared│   │  Cloudflared│
     │  (Coolify)  │   │  Tunnel     │   │  Tunnel     │
     └──────┬──────┘   └──────┬──────┘   └──────┬──────┘
            │                 │                 │
     ┌──────▼──────┐   ┌──────▼──────┐   ┌──────▼──────┐
     │   Coolify   │   │  Hermes    │   │   LiteLLM   │
     │   PaaS      │   │  Gateway   │   │   Proxy     │
     │   :8000     │   │  :8642     │   │   :4000     │
     └──────┬──────┘   └──────┬──────┘   └──────┬──────┘
            │                 │                 │
     ┌──────▼──────┐   ┌──────▼──────┐   ┌──────▼──────┐
     │   Qdrant    │   │  Hermes    │   │   Ollama    │
     │   :6333     │   │  MCP :8092 │   │  (RTX 4090) │
     └─────────────┘   └────────────┘   │  :11434     │
                                         └─────────────┘
```

---

## 6. Pipeline de Voice (TTS + STT)

### 6.1 TTS — Edge TTS (Microsoft Neural)

```bash
# Script canonico
~/.hermes/scripts/tts-edge.sh "texto" 7220607041
```

- **Motor:** Microsoft Edge TTS (voz AntonioNeural PT-BR)
- **Integracao:** Via ai-gateway :4002
- **Voz:** AntonioNeural (PT-BR) — neural de alta qualidade

### 6.2 STT — Groq Whisper Turbo

```bash
# Transcrever audio
curl -X POST https://api.groq.com/openai/v1/audio/transcriptions \
  -H "Authorization: Bearer $GROQ_API_KEY" \
  -F "file=@audio.ogg" \
  -F "model=whisper-large-v3-turbo"
```

- **Motor:** Groq Whisper Turbo (150min/dia gratis)
- **Integracao:** Via ai-gateway :4002
- **Vantagem:** Nao requer GPU local, transcricao rapida via Groq

### 6.3 Diagrama do Pipeline de Voice

```
                        VOICE PIPELINE
    ┌──────────────────────────────────────────────────────┐

    TEXT INPUT                              AUDIO OUTPUT
        │                                       ▲
        │                                       │
    ┌───▼────────────────┐              ┌──────┴──────┐
    │  Claude Code /     │              │  Edge TTS   │
    │  Hermes Gateway    │              │  AntonioNeural │
    └───┬────────────────┘              └─────────────┘
        │                                       ▲
        │                                       │ HTTP
        │                                  ┌────┴────┐
        │                                  │ai-gateway│
        │                                  │  :4002   │
        │                                  └────┬────┘
        │                                       │
   ┌────▼────────────────────┐                  │
   │  Groq Whisper Turbo     │                  │
   │  (whisper-large-v3-turbo│                  │
   └────┬────────────────────┘                  │
        │                                       │
   AUDIO INPUT                                  │
        │                                       │
   ┌────▼────────────────────┐                  │
   │  ai-gateway :4002       │──────────────────┘
   │  (OpenAI-compat facade) │
   └─────────────────────────┘
```

---

## 7. Roteamento de Modelos

### 7.1 Modelos Ativos

| Modelo | Uso | Custo | Provider |
|--------|-----|-------|----------|
| **MiniMax M2.7** | Chat principal | Token plan | LiteLLM :4000 |
| **GPT-4o-mini** | Fallback automatico | $0.15/1M tokens | LiteLLM :4000 |
| **Gemma4:26b-q4** | Codigo local (Ollama) | Grátis | Ollama :11434 |

### 7.2 VRAM Strategy

```
RTX 4090 24GB VRAM:
├── 22GB → Gemma4:26b-q4 (sob demanda)
└── 1-2GB → Reservado (驱动 + fallback)
```

- **Gemma4** carregado sob demanda (22GB)
- **LiteLLM** faz pooling automatico entre MiniMax/GPT
- Sem swap no Gen5 (SSD rapido mas wear leveling)

### 7.3 Diagrama de Roteamento

```
                    USER REQUEST
                         │
                         ▼
            ┌────────────────────────┐
            │     LiteLLM Proxy      │
            │       :4000           │
            │  (OpenAI-compat)      │
            └──────────┬───────────┘
                       │
         ┌─────────────┼─────────────┐
         │             │             │
    ┌────▼────┐   ┌────▼────┐   ┌────▼────┐
    │MiniMax  │   │ GPT-4o │   │ Ollama  │
    │ M2.7    │   │ mini   │   │(RTX4090)│
    └─────────┘   └─────────┘   └─────────┘
         │             │             │
         └─────────────┼─────────────┘
                       │
                 RESPONSE
```

---

## 8. MCP Servers

| MCP | Port | Host | Proposito |
|-----|------|------|-----------|
| coolify | 4012 | Docker | Gerenciar Coolify via API |
| ollama | 4013 | Docker | Gerenciar modelos via Ollama API |
| system | 4014 | Docker | ZFS/Docker/System metrics |
| cron | 4015 | Docker | Cron job management |
| qdrant | 4011 | Docker | Vector search + memory (RAG) |
| monorepo | 4006 | Docker | Filesystem + git para monorepo |

---

## 9. Governance Regras

### 9.1 Obrigatorio para Mudancas Estruturais

1. Ler `CONTRACT.md` em `/srv/ops/ai-governance/`
2. Verificar `GUARDRAILS.md` se requer aprovacao
3. Criar ZFS snapshot antes: `sudo zfs snapshot -r tank@pre-$(date +%Y%m%d-%H%M%S)-<motivo>`
4. Documentar em `/srv/ops/ai-governance/logs/`

### 9.2 NUNCA FAZER

```
- wipefs /dev/nvme*           → destroi ZFS pool
- zpool destroy tank           → destroi todos os dados
- rm -rf /srv/data/*           → deleta dados de producao
- rm -rf /srv/backups/*       → deleta backups
- docker volume prune -f      → deleta volumes sem backup
- Bypass Traefik com port forward direto
- Abrir portas sem verificar PORTS.md primeiro
```

### 9.3 Comandos Seguros (sem aprovacao)

```bash
docker ps
docker compose -f /srv/apps/platform/docker-compose.yml ps
zpool status tank
zfs list -t snapshot
# Backups
/srv/ops/scripts/backup-postgres.sh
/srv/ops/scripts/backup-qdrant.sh
```

---

## 10. Debug Quick Reference

```bash
# Status servicos
docker ps | grep -E "qdrant|n8n|gitea|coolify"

# Logs recentes
journalctl --user -u hermes-gateway -n 30

# VRAM usage
nvidia-smi

# ZFS health
zpool status tank
zfs list -t snapshot

# LiteLLM health
curl http://localhost:4000/health
```

---

## 11. Anti-Patterns

### ZERO HARDCODING

```python
# CORRETO — carregar de ~/.hermes/secrets.env
from pathlib import Path
_secrets = Path.home() / '.hermes' / 'secrets.env'
if _secrets.exists():
    with open(_secrets) as f:
        for line in f:
            if '=' in line and not line.startswith('#'):
                k, _, v = line.partition('=')
                os.environ[k.strip()] = v.strip()
MY_KEY = os.environ.get('MY_KEY', '')

# ERRADO — hardcoded
MY_KEY = 'sk-123456'
```

---

**Atualizado:** 2026-04-22
**Versao:** Blueprint v1.0
