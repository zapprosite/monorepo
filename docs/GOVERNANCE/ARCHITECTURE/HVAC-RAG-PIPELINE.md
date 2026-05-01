# HVAC RAG Architecture

## Overview

OpenWebUI chat.zappro.site → HVAC RAG Pipeline (4017) → LiteLLM (4000) → MiniMax API

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        HVAC RAG Architecture                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐     ┌─────────────────┐     ┌──────────────────┐      │
│  │  OpenWebUI   │     │  HVAC RAG Pipe   │     │     LiteLLM       │      │
│  │ chat.zappro  │────▶│   :4017 (filter) │────▶│    :4000          │      │
│  │  :3456       │     │                  │     │                  │      │
│  └──────────────┘     └─────────────────┘     └──────────────────┘      │
│         │                      │                        │                   │
│         │                      │                        │                   │
│         │                      │                        ▼                   │
│         │                      │                ┌──────────────┐          │
│         │                      │                │  Qdrant      │          │
│         │                      │                │  :6333       │          │
│         │                      │                │  (hvac_manu  │          │
│         │                      │                │   als_v1)    │          │
│         │                      │                └──────────────┘          │
│         │                      │                        ▲                   │
│         │                      │                        │                   │
│         │                      │          ┌─────────────┴──────┐         │
│         │                      │          │                    │         │
│         │              ┌───────┴──────────┴──┐               │         │
│         │              │   HVAC RAG Pipe       │               │         │
│         │              │  /filter/inlet        │               │         │
│         │              │  - Query Qdrant        │               │         │
│         │              │  - Build context       │               │         │
│         │              │  - Inject system prompt│               │         │
│         │              └────────────────────────┘               │         │
│         │                                                              │         │
│         │              ┌───────────────────────────────────────┐   │         │
│         │              │  zappro-redis :6379                    │   │         │
│         │              │  (OpenWebUI session/cache)            │   │         │
│         │              └───────────────────────────────────────┘   │         │
│         │                                                              │         │
└─────────┴──────────────────────────────────────────────────────────────┘
```

## Service Dependencies

| Service        | Network          | Purpose                      | Env Vars                     |
|----------------|------------------|------------------------------|------------------------------|
| openwebui-hvac | zappro-lite\_default | Chat UI + OAuth | OPENAI\_API\_BASE\_URL=http://host.docker.internal:4017/v1 |
| hvac-rag-pipe  | host (port 4017) | RAG filter pipeline | QDRANT\_URL=http://127.0.0.1:6333 |
| zappro-litellm | zappro-lite\_default | LLM gateway | DATABASE\_URL=postgres://... |
| zappro-redis   | zappro-lite\_default | Session/cache | REDIS\_HOST=zappro-redis |
| zappro-litellm-db | zappro-lite\_default | LiteLLM database | - |

## Data Flow

1. User sends message via OpenWebUI (chat.zappro.site:3456)
2. OpenWebUI forwards to HVAC RAG Pipeline at `:4017`
3. Pipeline queries Qdrant `hvac_manuals_v1` collection for relevant context
4. Pipeline injects context into system prompt
5. Pipeline returns enriched request to OpenWebUI
6. OpenWebUI calls LiteLLM at `:4000` with enriched prompt
7. LiteLLM proxies to MiniMax API

## Ports

| Service         | Port  | Protocol | Network    |
|-----------------|-------|----------|------------|
| openwebui-hvac  | 3456  | HTTP     | zappro-lite\_default |
| hvac-rag-pipe   | 4017  | HTTP     | host       |
| zappro-litellm  | 4000  | HTTP     | zappro-lite\_default |
| zappro-redis    | 6379  | TCP      | zappro-lite\_default |

## Volume Mounts

| Container       | Host Path                | Mount Point           |
|-----------------|--------------------------|-----------------------|
| openwebui-hvac  | /srv/data/openwebui      | /app/backend/data     |
| zappro-litellm  | /srv/monorepo/config/litellm/config.yaml | /app/config/config.yaml |

## Critical Rules

1. **HVAC RAG must use host network mode** - Pipeline at port 4017 must be on host network
2. **OpenWebUI must use zappro-lite_default network** - Must communicate with zappro-redis
3. **OpenWebUI OPENAI_API_BASE_URL must point to HVAC pipeline** - `http://host.docker.internal:4017/v1`
4. **Redis must be zappro-redis** - Not localhost, not other redis containers
