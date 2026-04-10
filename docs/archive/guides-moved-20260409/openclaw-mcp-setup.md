# OpenClaw — MCP & TTS Setup

**Data:** 2026-04-07
**Bot:** @CEO_REFRIMIX_bot (coollabsio/openclaw:2026.2.6)
**Rede:** Coolify qgtzrmi (10.0.19.x)

---

## Arquitetura

```
OpenClaw Bot (@CEO_REFRIMIX_bot)
├── Primary:   minimax/MiniMax-M2.7 (cloud direto)
├── Vision:    litellm/llava → Ollama GPU
├── TTS:       Kokoro 10.0.19.7:8880 (voice pm_alex)
├── STT:       whisper-local via OLLAMA_BASE_URL
└── Memory:    skill qdrant-rag → Qdrant direto
```

---

## TTS — Kokoro (Correção)

### Configuração

O OpenClaw usa TTS via provider `openai` com modelo `kokoro`. A configuração fica em `/data/.openclaw/openclaw.json`:

```json
{
  "messages": {
    "tts": {
      "auto": "inbound",
      "provider": "openai",
      "openai": {
        "apiKey": "unused",
        "model": "kokoro",
        "voice": "pm_alex"
      }
    }
  }
}
```

### Variaveis de Ambiente (.env do Coolify)

| Variavel | Valor | Funcao |
|---|---|---|
| `OPENAI_TTS_BASE_URL` | `http://10.0.19.7:8880/v1` | Endpoint Kokoro (bridge network) |
| `OPENCLAW_CONFIG_JSON` | `{"messages":{"tts":{"openai":{"voice":"pm_alex"}}}}` | Override voz |

### Ordem de Merge do Config

```
OPENCLAW_CONFIG_JSON (base)
  ↓ deepMerge
openclaw.json persisted (sobrescreve base)
  ↓ env vars (sobrescreve tudo)
```

**Atencao:** A config persisted sobrescreve o JSON base. Para mudar a voz, editar diretamente o `openclaw.json` no volume.

### Arquivo

```
/srv/data/coolify/services/qgtzrmi6771lt8l7x8rqx72f/.env
/srv/data/coolify/services/qgtzrmi6771lt8l7x8rqx72f/docker-compose.yml
```

### Teste

```bash
# Testar Kokoro direto
curl -X POST "http://10.0.19.7:8880/v1/audio/speech" \
  -H "Content-Type: application/json" \
  -d '{"model":"kokoro","input":"Olá, teste.","voice":"pm_alex"}' \
  --output /tmp/test_tts.mp3

# Ver config no container
docker exec openclaw-qgtzrmi6771lt8l7x8rqx72f node -e \
  "console.log(JSON.stringify(JSON.parse(require('fs').readFileSync('/data/.openclaw/openclaw.json','utf8')).messages.tts,null,2))"
```

---

## Memory — Skills (Nao MCP)

O OpenClaw acessa Qdrant via **skill** (`qdrant-rag`), nao via MCP. Pattern: scripts Python fazem HTTP calls diretos.

### Skills Disponiveis

| Skill | Funcao | Endpoint |
|---|---|---|
| `qdrant-rag` | Semantic search + upsert via LiteLLM | Qdrant 10.0.19.5:6333 |
| `openclaw-repo-hunter` | Busca repos OSS no GitHub | web_search |
| `monorepo-explorer` | Acesso read-only ao /srv/monorepo | MCP 10.0.19.50:4006 |

### qdrant-rag

Collections: `clients`, `brand-guides`, `campaigns`, `knowledge`
Embedding: `embedding-nomic` (768d) via LiteLLM `http://10.0.1.1:4000`

### monorepo-explorer

Usa `mcp_client.py` que faz HTTP POST para `http://10.0.19.50:4006/mcp`.

Ferramentas: `list_directory`, `read_file`, `search_files`, `git_status`, `git_log`

---

## MCP Servers Externos

### MCP Monorepo — 10.0.19.50:4006

- **Container:** `mcp-monorepo` (python:3.11-slim)
- **Rede:** qgtzrmi (mesma do OpenClaw)
- **Volume:** `/srv/monorepo:ro`
- **Health:** `curl -s http://10.0.19.50:4006/health`

### MCP Qdrant — 10.0.19.51:4011

- **Container:** `mcp-qdrant` (python:3.11-slim)
- **Rede:** qgtzrmi
- **Collection:** `openclaw-memory` (768d, cosine)
- **Uso:** n8n workflows, Claude Code host, outros servicos externos
- **Nao** integrado ao OpenClaw (OpenClaw usa skill qdrant-rag direto)

---

## Rede — Cross-Network

| Origem | Destino | Via | Porta |
|---|---|---|---|
| OpenClaw (10.0.19.x) | Kokoro | bridge | 10.0.19.7:8880 |
| OpenClaw | LiteLLM | docker0 | 10.0.1.1:4000 |
| OpenClaw | Ollama | host.docker.internal | 11434 |
| OpenClaw | Qdrant | skill HTTP | 10.0.19.5:6333 |
| MCP servers | Qdrant | bridge | 10.0.19.5:6333 |
| Host | OpenClaw UI | Traefik | :4001 |

---

## Comandos Uteis

```bash
# Restart OpenClaw (recarrega env_file)
cd /srv/data/coolify/services/qgtzrmi6771lt8l7x8rqx72f
docker-compose down && docker-compose up -d

# Ver logs
docker logs openclaw-qgtzrmi6771lt8l7x8rqx72f --tail 30 -f

# Ver TTS config
docker exec openclaw-qgtzrmi6771lt8l7x8rqx72f node -e \
  "console.log(JSON.stringify(JSON.parse(require('fs').readFileSync('/data/.openclaw/openclaw.json','utf8')).messages.tts,null,2))"

# Testar Kokoro TTS
curl -X POST "http://10.0.19.7:8880/v1/audio/speech" \
  -H "Content-Type: application/json" \
  -d '{"model":"kokoro","input":"Teste de voz.","voice":"pm_alex"}' \
  --output /tmp/test.mp3

# Ver skills
docker exec openclaw-qgtzrmi6771lt8l7x8rqx72f ls /data/workspace/skills/

# Ver Qdrant collections
curl -s "http://10.0.19.5:6333/collections" \
  -H "api-key: vmEbyCYrU68bR7lkzCbL05Ey4BPnTZgr"
```
