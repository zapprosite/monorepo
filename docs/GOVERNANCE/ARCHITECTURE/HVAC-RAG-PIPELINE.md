# HVAC RAG Pipeline - Complete Architecture

## Service Topology

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            HOST (srv/monorepo)                             │
│                                                                             │
│  ┌──────────────┐     ┌─────────────────┐                                  │
│  │  hvac-rag    │     │   Qdrant        │                                  │
│  │  -pipe.py    │────▶│   :6333         │                                  │
│  │  :4017       │     │   hvac_manuals  │                                  │
│  └──────────────┘     └─────────────────┘                                  │
│         │                                                                  │
└─────────┼──────────────────────────────────────────────────────────────────┘
          │
          │ http://host.docker.internal:4017/v1
          │
┌─────────▼───────────────────────────────────────────────────────────────────┐
│                         DOCKER (zappro-lite_default)                       │
│                                                                             │
│  ┌──────────────┐     ┌─────────────────┐     ┌──────────────────┐       │
│  │  OpenWebUI   │────▶│  trieve-redis   │     │  LiteLLM          │       │
│  │  :3456       │     │  :6379           │     │  :4000            │       │
│  └──────────────┘     └─────────────────┘     └──────────────────┘       │
│         │                                                  │              │
│         │              ┌─────────────────────────────────┘              │
│         │              │                                                    │
│         │     ┌─────────┴──────────┐                                       │
│         │     │ zappro-lite_default │                                       │
│         │     │ 10.0.3.0/24        │                                       │
│         │     └────────────────────┘                                       │
│         │                                                                  │
│         │              ┌─────────────────────────────────┐               │
│         │              │ zappro-litellm-db :5432          │               │
│         │              │ PostgreSQL (LiteLLM data)        │               │
│         │              └─────────────────────────────────┘               │
│         │                                                                  │
└─────────┴──────────────────────────────────────────────────────────────────┘
```

## Port Mapping

| Service         | Container Port | Host Port | Protocol | Notes                    |
|-----------------|-----------------|-----------|----------|--------------------------|
| OpenWebUI       | 3456            | 3456      | HTTP     | Chat interface           |
| HVAC RAG Pipe   | 4017            | 4017      | HTTP     | RAG filter (host mode)  |
| LiteLLM         | 4000            | 4000      | HTTP     | LLM gateway              |
| Qdrant          | 6333            | -         | HTTP     | Vector database          |
| trieve-redis    | 6379            | -         | TCP      | Session cache (open)     |
| zappro-redis    | 6379            | 127.0.0.1  | TCP      | Has auth (unused)        |
| zappro-litellm-db| 5432           | -         | TCP      | PostgreSQL               |

## Network Configuration

### zappro-lite_default (bridge)
- Subnet: 10.0.3.0/24
- Gateway: 10.0.3.1
- Containers:
  - openwebui-hvac (10.0.3.5)
  - zappro-litellm (10.0.3.3)
  - zappro-litellm-db (10.0.3.4)
  - zappro-redis (10.0.3.2)
  - trieve-redis (10.0.8.5 - connected via network)

### Host Network
- hvac-rag-pipe.py runs on host network (port 4017)
- Accessed via host.docker.internal (172.17.0.1)

## Communication Flow

### Chat Flow
1. User → OpenWebUI (:3456) [Google OAuth]
2. OpenWebUI → HVAC RAG Pipeline (host.docker.internal:4017/v1)
3. HVAC RAG → Qdrant (:6333) [vector search]
4. HVAC RAG → OpenWebUI [enriched prompt]
5. OpenWebUI → LiteLLM (:4000) [LLM request]
6. LiteLLM → MiniMax API [external]

### Redis Flow
- OpenWebUI → trieve-redis (:6379) [session/cache]
- No authentication required for trieve-redis

## Service Definitions

### OpenWebUI (openwebui-hvac)
```yaml
image: openwebui/open-webui:latest
networks: [zappro-lite_default]
ports: [3456:3456]
env:
  OPENAI_API_BASE_URL: http://host.docker.internal:4017/v1
  REDIS_HOST: trieve-redis
  DEFAULT_MODEL: zappro-clima-tutor
```

### HVAC RAG Pipeline (hvac-rag-pipe)
```yaml
# Runs on host network mode
python hvac-rag-pipe.py --port 4017
endpoints:
  POST /hvac-rag/filter/inlet
  POST /hvac-rag/filter/outlet
  GET /health
```

### LiteLLM (zappro-litellm)
```yaml
image: ghcr.io/berriai/litellm:main-latest
networks: [zappro-lite_default]
ports: [4000:4000]
depends_on: [zappro-litellm-db]
```

## Critical Rules

### DO
1. ✅ Use container names for inter-container communication
2. ✅ Use host.docker.internal for host-to-container communication
3. ✅ Specify explicit networks in compose files
4. ✅ Use version-locked configurations
5. ✅ Run verification script after changes

### DON'T
1. ❌ Use localhost in containers
2. ❌ Mix host network_mode with bridge networks
3. ❌ Leave Redis without authentication (except trieve-redis)
4. ❌ Modify locked configs without version bump
5. ❌ Commit secrets to git