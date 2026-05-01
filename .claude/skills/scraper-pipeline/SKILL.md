---
name: scraper-pipeline
description: Executa pipeline completo de scraping HVAC — pré-validation → scrape → extract → embed → upsert Qdrant
---

# Scraper Pipeline Skill

## Pipeline Flow

```
1_scrape    Rod browser → FindPDFLinks (Chrome CDP)
2_download  HTTP download → /srv/data/hvac-manuals/{brand}/
3_extract   docling (Python) → JSON tables
4_embed     nomic-embed-text → 768D vector
5_upsert    Qdrant → hvac_service_manuals
```

## Pré-requisitos Validados

| Recurso | Endpoint | Verificação |
|---------|----------|-------------|
| Chrome | `/usr/bin/google-chrome` | `--version` |
| Ollama | `localhost:11434` | `/api/tags` |
| Qdrant | `10.0.19.2:6333` | `GET /collections/hvac_service_manuals` |
| Chrome profile | `/srv/data/hvac-manual-downloader/chrome-profiles/{brand}` | `-d` check |
| Infisical | `/srv/ops/secrets/infisical.service-token` | Python SDK |

## Uso

```bash
# Skill shortcut
/scraper lg --max 3
/scraper samsung --max 5
/scraper springer

# Script direto
.claude/skills/scraper-pipeline/run.sh <brand> [max]
```

## Brands

`lg`, `samsung`, `daikin`, `springer`

## Output

- **PDFs:** `/srv/data/hvac-manuals/{brand}/`
- **Qdrant:** collection `hvac_service_manuals` (768D Cosine)
- **Embeddings:** `nomic-embed-text` via Ollama

## Flags do Scraper

```bash
--pipeline=<brand>   Brand a processar
--max=<n>           Max downloads (default: unlimited)
--verbose            Logging detalhado
--qdrant=<addr>     Qdrant endpoint (default: 10.0.19.2:6333)
--ollama=<url>      Ollama endpoint (default: http://localhost:11434)
--output=<dir>      Output directory
--headless          Browser headless (default: true)
--rate-limit=<dur>  Delay entre requests (default: 2s)
```

## Skill Integration

### Via `/scraper` tool

```json
{
  "name": "scraper",
  "script": "cmd/manual-scraper/manual-scraper",
  "depends_on": ["extract", "embed", "qdrant"],
  "pipeline_flow": {
    "1_scrape": "Rod browser → FindPDFLinks",
    "2_download": "HTTP download → brand dir",
    "3_extract": "docling tables → JSON",
    "4_chunk": "ChunkFromPDF → []ChunkResult",
    "5_embed": "nomic-embed-text → 768D vector",
    "6_upsert": "Qdrant → hvac_service_manuals"
  }
}
```

### Dependência entre tools

```
/scraper → /extract → /embed → /qdrant
```

## Troubleshooting

### Chrome not found
```bash
export CHROME_BIN=/usr/bin/google-chrome
```

### Qdrant connection refused
- Verificar se Qdrant está acessível: `curl http://10.0.19.2:6333/`
- Collection existe: `GET /collections/hvac_service_manuals`

### Ollama nomic-embed-text missing
```bash
ollama pull nomic-embed-text
```

### Chrome profile login expired
- Credenciais em Infisical (`infisical.service-token`)
- Brand credentials: `OPENROUTER_API_KEY`, `LG_EMAIL`, `LG_PASSWORD`, etc.
