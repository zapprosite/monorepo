# Tool System — //{use} Unificada

## Overview

Sistema de tools CLI com atalho `//{use}` para automação do homelab e pipeline HVAC.

## Quick Reference

```bash
//sync          # ai-context-sync - sincroniza .context/ com memory
//heal          # auto-healer - verifica health dos containers
//checkpoint    # checkpoint.sh - salva estado do contexto
//context       # context-meter.sh - mede uso de contexto
//scraper       # manual-scraper pipeline - baixa manuais HVAC
//extract       # docling tables - extrai tabelas de PDFs
//embed         # Ollama embeddings - gera vetores
//qdrant        # Vector DB - upsert/search Qdrant
//github        # GitHub sync - baixa de repos HVAC
//build         # Go build - compila binários
//deploy        # Coolify deploy - deploya containers
//status        # Overview do homelab
```

## Tool Definitions

### //sync
**Script:** `/home/will/.claude/mcps/ai-context-sync/sync.sh`
**Função:** Sincroniza .context/ directory com memory index
**Triggers:** manual, pre-commit, post-merge, cron (30min)
**Output:** JSON sync report

```bash
//sync
# Output:
//{"files_synced": 5, "memory_updated": true, "timestamp": "..."}
```

### //heal
**Script:** `/home/will/.claude/skills/gitea-coolify-deploy/scripts/auto-healer.sh`
**Função:** Verifica health de containers Docker, reinicia se necessário
**Frequência:** cron 5min
**Logs:** `/srv/ops/logs/healing.log`

```bash
//heal
# Output:
//{"containers_checked": 11, "restarted": [], "healthy": true}
```

### //scraper
**Script:** `cmd/manual-scraper/manual-scraper --pipeline {brand}`
**Função:** Pipeline completo: scrape → download → extract → chunk → embed → qdrant
**Brands:** lg, samsung, springer

```bash
//scraper lg --max 10
//scraper samsung --verbose
```

### //extract
**Script:** `cmd/manual-scraper/extractor/tables.py`
**Função:** Extrai tabelas de PDFs usando docling

```bash
//extract /srv/data/manuals/lg/AR-09NS1.pdf -o tables.json
```

### //embed
**Script:** `cmd/manual-scraper/indexer/embedder.go`
**Função:** Gera embeddings via Ollama nomic-embed-text

```bash
//embed "texto do manual HVAC"
# Output: [0.123, -0.456, ...] (768D vector)
```

### //qdrant
**Script:** internal/rag/qdrant/client.go
**Função:** Vector storage and search

```bash
//qdrant upsert --id lg_ar09ns1_e8 --vector [0.123] --payload '{"brand":"lg","error_code":"E8"}'
//qdrant search --vector [0.123] --limit 5 --filter brand=lg
```

### //github
**Script:** `cmd/manual-scraper/sources/github.go`
**Função:** Sync com GitHub repos HVAC

```bash
//github sync coolfix
//github sync hvac_troubleshoot_pro
```

### //build
**Script:** `go build ./...`
**Função:** Build com caching

```bash
//build cmd/manual-scraper
//build ./...
```

### //deploy
**Script:** Coolify API
**Função:** Deploy via Coolify

```bash
//deploy perplexity-agent
//deploy hvacr-swarm:latest
```

### //status
**Função:** Overview do homelab

```bash
//status
# Output:
# {"containers": 11, "healthy": 11, "cpu": "0.30%", "memory": "3.00%"}
```

## Dependency Graph

```
//scraper
    ├── //extract (docling tables)
    ├── //embed (Ollama)
    └── //qdrant (vector upsert)

    //github (source data)
            │
            ▼
//scraper ──► //extract ──► //embed ──► //qdrant
                                       ▲
                                       │
//sync ◄────► //checkpoint ◄──── //context
    │
    ▼
//heal
```

## Cron Schedule

| Tool | Frequência | Crontab |
|------|------------|---------|
| //sync | 30min | `*/30 * * * *` |
| //heal | 5min | `*/5 * * * *` |
| //checkpoint | 90min | `23 */1.5 * * *` |
| //context | 60min | `0 * * * *` |
| //github sync | daily | `0 3 * * *` |
| //status | daily | `0 8 * * *` |

## Tool Execution Flow

1. **Parse** tool name from `//{use}`
2. **Load** tool definition from `$CLAUDE_TOOLS/{tool}.json`
3. **Execute** script with args
4. **Output** JSON to stdout
5. **Log** execution to `/srv/ops/logs/{tool}.log`
6. **Update** memory index on success

## Error Handling

- Tool failure → retry 3x with exponential backoff
- Timeout → log + alert if critical
- Partial failure → continue with warning

## Adding New Tools

1. Create script in `/home/will/.claude/skills/{tool}/`
2. Add definition to this guide
3. Add to //status overview
4. Create cron if needed
