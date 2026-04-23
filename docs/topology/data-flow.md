# Data Flow — Homelab Multi-Claude

**Data:** 2026-04-22
**Fonte:** SERVICE_MAP.md, PORTS.md, ARCHITECTURE.md
**Versao:** 1.0

---

## 1. Fluxo de Requisicoes de Chat

### 1.1 Chat via LiteLLM Proxy (Padrao)

```
USER INPUT (texto)
     │
     ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                         LiteLLM Proxy :4000                            │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  OpenAI-compatible API (POST /chat/completions)                   │  │
│  │                                                                   │  │
│  │  Request:                                                         │  │
│  │  {                                                               │  │
│  │    "model": "minimax/minimax-01",                               │  │
│  │    "messages": [{"role": "user", "content": "..."}]              │  │
│  │  }                                                               │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│     │                                                                  │
│     ▼ (model selection via config)                                     │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐              │
│  │  MiniMax    │     │  GPT-4o     │     │   Ollama    │              │
│  │   M2.7      │     │   mini     │     │ (RTX 4090)  │              │
│  │ (primary)   │     │ (fallback) │     │  (Gemma4)   │              │
│  └─────────────┘     └─────────────┘     └─────────────┘              │
│     │                                                                  │
│     ◄────────────────── pooling ───────────────────►                  │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
     │
     ▼
RESPONSE (OpenAI format)
```

### 1.2 Fallback Automatico

```
LiteLLM Proxy detecta erro/fallback
     │
     ▼
┌─────────────────┐
│  Try MiniMax   │──► ERRO ──┐
│    M2.7        │          │
└─────────────────┘          │
                             ▼
                    ┌─────────────────┐
                    │  Try GPT-4o     │──► ERRO ──┐
                    │    mini         │          │
                    └─────────────────┘          │
                                               ▼
                                      ┌─────────────────┐
                                      │  Try Ollama     │
                                      │  Gemma4:26b    │
                                      │  (RTX 4090)    │
                                      └─────────────────┘
```

---

## 2. Pipeline de Voice

### 2.1 TTS (Text-to-Speech) — Edge TTS

```
TEXT INPUT
     │
     ▼
┌─────────────────────────────────────────┐
│           ai-gateway :4002              │
│  POST /audio/speech                     │
│  {                                      │
│    "input": "texto para falar",         │
│    "voice": "pt-BR-AntonioNeural"      │
│  }                                      │
└────────────────┬────────────────────────┘
                 │
                 ▼ HTTP
        ┌────────────────┐
        │  Edge TTS API  │ (Microsoft neural)
        │  (cloud)       │
        └────────┬───────┘
                 │
                 ▼ AUDIO (MP3/OGG)
        ┌────────────────┐
        │  ai-gateway    │
        │  response      │
        └────────┬───────┘
                 │
                 ▼
        ┌────────────────┐
        │  Telegram Bot  │ (envia audio para usuario)
        │  / Audio File  │
        └────────────────┘
```

### 2.2 STT (Speech-to-Text) — Groq Whisper Turbo

```
AUDIO INPUT (microfone / voice message)
     │
     ▼
┌─────────────────────────────────────────┐
│           ai-gateway :4002              │
│  POST /audio/transcriptions             │
│  (form-data with file)                 │
└────────────────┬────────────────────────┘
                 │
                 ▼ HTTP
        ┌────────────────────────┐
        │  Groq API              │
        │  whisper-large-v3-turbo│
        │  (150min/dia gratis)   │
        └────────┬───────────────┘
                 │
                 ▼ JSON
        ┌─────────────────────────────────────────┐
        │  Response:                               │
        │  { "text": "transcricao do audio" }     │
        └─────────────────────────────────────────┘
                 │
                 ▼
        ┌─────────────────────────────────────────┐
        │  Claude Code / Hermes Gateway           │
        │  (processa texto)                       │
        └─────────────────────────────────────────┘
```

### 2.3 Voice Pipeline Completo

```
                                    VOICE PIPELINE COMPLETO
    ┌─────────────────────────────────────────────────────────────────────────┐

    ┌─────────────┐      ┌─────────────────┐      ┌─────────────┐
    │   USER      │      │  ai-gateway     │      │   Groq      │
    │  (audio)    │─────►│   :4002         │─────►│  Whisper    │
    │  (input)    │ ogg  │                 │      │   Turbo     │
    └─────────────┘      └─────────────────┘      └──────┬──────┘
                                                          │
                                                          ▼ TEXT
                                                   ┌─────────────┐
                                                   │  Hermes     │
                                                   │  Gateway    │
                                                   │   :3001     │
                                                   └──────┬──────┘
                                                          │
                                                          ▼ LLM
                                                   ┌─────────────┐
                                                   │  LiteLLM    │
                                                   │   :4000     │
                                                   │ (MiniMax)   │
                                                   └──────┬──────┘
                                                          │
                                                          ▼ TEXT RESPONSE
                                                   ┌─────────────┐
                                                   │  Hermes     │
                                                   │  Gateway    │
                                                   └──────┬──────┘
                                                          │
                               ┌───────────────────────────┼───────────────────────────┐
                               │                           │                           │
                               ▼                           ▼                           ▼
                        ┌─────────────┐           ┌─────────────┐           ┌─────────────┐
                        │   Telegram  │           │  ai-gateway │           │  Hermes MCP │
                        │    Bot      │           │   :4002     │           │   :8092     │
                        │  (envia)    │           │  (Edge TTS) │           │  (Claude)   │
                        └─────────────┘           └──────┬──────┘           └─────────────┘
                                                          │
                                                          ▼ AUDIO
                                                   ┌─────────────┐
                                                   │   USER      │
                                                   │  (audio)    │
                                                   └─────────────┘
    ┌─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Fluxo de Autenticacao

### 3.1 Auth JWT com zappro-api

```
CLIENT REQUEST
     │
     ▼
┌─────────────────────────────────────────┐
│          zappro-api :4003               │
│  POST /auth/login                        │
│  { "username": "...", "password": "..." }│
└────────────────┬────────────────────────┘
                 │
                 ▼ Verify Credentials
        ┌────────────────┐
        │  PostgreSQL   │ (user store)
        │  (future)     │
        └────────┬──────┘
                 │
                 ▼ Generate JWT
        ┌────────────────┐
        │  JWT Token     │
        │  (expires: 24h)│
        └────────┬──────┘
                 │
                 ▼
        ┌─────────────────────────────────────────┐
        │  Response:                              │
        │  { "access_token": "eyJ...", "token_type": "Bearer" }
        └─────────────────────────────────────────┘
                 │
                 ▼
        ┌─────────────────────────────────────────┐
        │  Subsequent Requests                    │
        │  Authorization: Bearer eyJ...           │
        └─────────────────────────────────────────┘
                 │
                 ▼
        ┌─────────────────────────────────────────┐
        │          LiteLLM Proxy :4000           │
        │  (proxies with API key)                │
        └─────────────────────────────────────────┘
```

---

## 4. Fluxo RAG (Retrieval-Augmented Generation)

```
USER QUERY
     │
     ▼
┌─────────────────────────────────────────┐
│         zappro-api :4003               │
│  POST /rag/query                        │
│  { "query": "pergunta do usuario" }    │
└────────────────┬────────────────────────┘
                 │
                 ▼ Embed Query
        ┌────────────────┐
        │  Ollama        │
        │  (nomic-embed-text)│
        │  :11434        │
        └────────┬──────┘
                 │
                 ▼ Embedding Vector
        ┌─────────────────────────────────────────┐
        │          Qdrant :6333                   │
        │  (vector search)                         │
        │  collection: "knowledge_base"          │
        └────────────────┬────────────────────────┘
                 │
                 ▼ Retrieved Context
        ┌─────────────────────────────────────────┐
        │  Context + Query + LLM                  │
        │                                           │
        │  LiteLLM (MiniMax M2.7)                  │
        │  with retrieved context                 │
        └────────────────┬────────────────────────┘
                 │
                 ▼
RESPONSE (augmented with context)
```

---

## 5. Fluxo MCP (Model Context Protocol)

### 5.1 Claude Code → Hermes MCP

```
CLAUDE CODE
     │
     │ MCP Request (JSON-RPC)
     ▼
┌─────────────────────────────────────────┐
│          Hermes MCP :8092              │
│  (MCPO bridge)                          │
│                                           │
│  ┌───────────────────────────────────┐   │
│  │  Resources:                       │   │
│  │  - hermes://secrets               │   │
│  │  - hermes://config                │   │
│  │                                   │   │
│  │  Tools:                           │   │
│  │  - hermes_message_send            │   │
│  │  - hermes_voice_tts               │   │
│  └───────────────────────────────────┘   │
└────────────────┬────────────────────────┘
                 │
                 │ HTTP
                 ▼
        ┌─────────────────────────────────────────┐
        │          Hermes Gateway :3001           │
        │  (Telegram bot + voice agent)           │
        └─────────────────────────────────────────┘
```

### 5.2 MCP Servers (Docker)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         MCP SERVERS (Docker Network)                          │
│                                                                               │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐ │
│  │ mcp-coolify   │  │  mcp-ollama   │  │  mcp-system   │  │  mcp-cron     │ │
│  │    :4012      │  │    :4013      │  │    :4014      │  │    :4015      │ │
│  └───────┬───────┘  └───────┬───────┘  └───────┬───────┘  └───────┬───────┘ │
│          │                  │                  │                  │          │
│          └──────────────────┼──────────────────┼──────────────────┘          │
│                             │                  │                             │
│                      ┌──────▼──────────────────▼──────┐                      │
│                      │         Claude Code            │                      │
│                      │      (MCP Client :4011-4015)   │                      │
│                      └─────────────────────────────────┘                      │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Fluxo Docker Network → Host

### 6.1 Cross-Network Access

```
DOCKER CONTAINER                                    HOST
     │                                                │
     │  ┌─────────────────────────────────────────┐   │
     │  │  LiteLLM Proxy :4000                   │   │
     │  │  Docker Network (10.0.1.x)             │   │
     │  └─────────────────────────────────────────┘   │
     │              │                                  │
     │              │  10.0.1.1:4000                  │
     │              ▼                                  │
     │  ┌─────────────────────────────────────────┐   │
     │  │  Ollama :11434 (docker0)                │   │
     │  │  Accessible as: 10.0.1.1:11434         │   │
     │  └─────────────────────────────────────────┘   │
     │                                                │
     │  ┌─────────────────────────────────────────┐   │
     │  │  Qdrant :6333 (Coolify net)            │   │
     │  │  Accessible as: 10.0.19.5:6333         │   │
     │  └─────────────────────────────────────────┘   │
     │                                                │
     │  COOLIFY MANAGED                               │
     │  ┌─────────────────────────────────────────┐   │
     │  │  Qdrant :6333                           │   │
     │  │  (Coolify network 10.0.19.x)           │   │
     │  └─────────────────────────────────────────┘   │
     │                                                │
     ▼                                                ▼
  CONNECTED                                       ACCESSIBLE
  Via docker network                               Via host routes
```

---

## 7. Fluxo de Dados — Segundo Brain

```
DESKTOP (Obsidian Vault)                      SERVER (Monorepo)
     │                                              │
     │  ┌────────────────────────────────┐        │
     │  │  ~/Desktop/hermes-second-brain │        │
     │  │  TREE.md                       │        │
     │  │  notes/*.md                    │        │
     │  └────────────────────────────────┘        │
     │              │                               │
     │              │  Git push                    │
     │              ▼                               │
     │  ┌────────────────────────────────┐        │
     │  │  Gitea :3300                   │        │
     │  │  hermes-second-brain repo      │        │
     │  └────────────────────────────────┘        │
     │              │                               │
     │              │  Clone/pull                   │
     │              ▼                               │
     │  ┌────────────────────────────────┐        │
     │  │  ~/Desktop/hermes-second-brain │        │
     │  │  ( synced )                    │        │
     │  └────────────────────────────────┘        │
     │                                              │
     │  ┌────────────────────────────────┐        │
     │  │  Claude Code (dev)             │        │
     │  │  reads TREE.md + notes         │        │
     │  └────────────────────────────────┘        │
     │              │                               │
     │              │  context loading              │
     │              ▼                               │
     │  ┌────────────────────────────────┐        │
     │  │  AGENTS.md + knowledge base    │        │
     │  └────────────────────────────────┘        │
     │                                              │
     ▼                                              ▼
  SYNCED                                          READY FOR USE
```

---

## 8. Fluxo de Deployment (Monorepo)

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                         MONOREPO DEPLOYMENT FLOW                               │
│                                                                                │
│  ┌─────────────┐      ┌─────────────┐      ┌─────────────┐      ┌─────────┐ │
│  │   SPEC      │─────►│    PG       │─────►│ run-pipeline│─────►│  SHIPPER│ │
│  │   (spec)    │      │  (plan)     │      │   (.sh)     │      │  (PR)   │ │
│  └─────────────┘      └─────────────┘      └──────┬──────┘      └────┬────┘ │
│                                                      │                   │      │
│                                                      ▼                   │      │
│                                               ┌─────────────┐            │      │
│                                               │  Pipeline   │            │      │
│                                               │  3 phases:  │            │      │
│                                               │  P → R → E  │            │      │
│                                               └──────┬──────┘            │      │
│                                                      │                   │      │
│                                                      ▼                   │      │
│                                               ┌─────────────┐            │      │
│                                               │   Docker    │◄───────────┘      │
│                                               │  Build      │                   │
│                                               └──────┬──────┘                   │
│                                                      │                           │
│                                                      ▼                           │
│                                               ┌─────────────┐                   │
│                                               │   Coolify   │                   │
│                                               │   PaaS      │                   │
│                                               │   :8000     │                   │
│                                               └─────────────┘                   │
└────────────────────────────────────────────────────────────────────────────────┘
```

---

## 9. Fluxo de Backup

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           BACKUP FLOW                                        │
│                                                                               │
│  ┌────────────────┐       ┌────────────────┐       ┌────────────────┐      │
│  │  ZFS Pool      │       │  Snapshots     │       │  Backup Script │      │
│  │  tank (4TB)    │──────►│  (pre-change)  │──────►│  (srv/ops/)   │      │
│  └────────────────┘       └────────────────┘       └───────┬────────┘      │
│                                                              │               │
│       ┌─────────────────────────────────────────────────────┼───────────┐   │
│       │                                                     │           │   │
│       ▼                                                     ▼           │   │
│  ┌─────────────┐                                    ┌─────────────┐   │   │
│  │ tank@pre-   │                                    │  /srv/backups│   │   │
│  │ 20260422-   │                                    │  (ZFS snap)  │   │   │
│  │ 143000-feat │                                    └──────┬──────┘   │   │
│  └─────────────┘                                           │           │   │
│                                                            ▼           │   │
│                                                       ┌─────────────┐  │   │
│                                                       │  Off-site   │  │   │
│                                                       │  (future)   │  │   │
│                                                       └─────────────┘  │   │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │  Comandos de Backup (seguros):                                          │  │
│  │                                                                             │  │
│  │  # Snapshot antes de mudanca                                              │  │
│  │  sudo zfs snapshot -r tank@pre-$(date +%Y%m%d-%H%M%S)-<descricao>        │  │
│  │                                                                             │  │
│  │  # Rollback se algo quebrar                                               │  │
│  │  sudo zfs rollback -r tank@<snapshot-name>                               │  │
│  │                                                                             │  │
│  │  # Scripts de backup                                                      │  │
│  │  /srv/ops/scripts/backup-postgres.sh                                     │  │
│  │  /srv/ops/scripts/backup-qdrant.sh                                       │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

**Atualizado:** 2026-04-22
**Versao:** 1.0
