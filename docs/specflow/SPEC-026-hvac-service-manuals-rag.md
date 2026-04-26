---
name: SPEC-026 HVAC Service Manuals Semantic RAG
description: Sistema RAG para indexar e buscar manuais de serviço HVAC por modelo, marca, código de erro e tipo de equipamento
type: specification
status: IN_PROGRESS
priority: HIGH
author: will
date: 2026-04-11
related: SPEC-032, SPEC-060
---

# SPEC-026: HVAC Service Manuals Semantic RAG

**Status:** IN_PROGRESS
**Created:** 2026-04-11
**Updated:** 2026-04-17
**Related:** [docs/REFERENCE/hvac-models-and-error-codes.md](../REFERENCE/hvac-models-and-error-codes.md)

---

## 1. Objective

Construir um **RAG semântico** que indexa manuais de serviço HVAC por:
- Modelo, marca, código de erro
- Tipo (split, multi-split, cassette, piso-teto)
- Tecnologia (inverter, convencional, VRF)
- Refrigerante (R-410A, R-32, R-290)

**Dados de referência:** [docs/REFERENCE/hvac-models-and-error-codes.md](../REFERENCE/hvac-models-and-error-codes.md)

---

## 2. Tech Stack

| Componente | Tecnologia |
|------------|------------|
| Embeddings | Ollama `nomic-embed-text` (768D) ou MiniMax |
| Vector DB | Qdrant 1.13 |
| Transcription | Whisper / wav2vec2 |
| LLM Response | MiniMax M2.7 |
| Parsing PDF | ledongthuc/pdf + docling |
| Pipeline | Go swarm agents |

---

## 3. Collection Schema

**Collection:** `hvac_service_manuals`

```json
{
  "id": "springer_xtreme_e8_001",
  "vector": [0.123...],
  "payload": {
    "brand": "springer",
    "model": "Xtreme Save Connect",
    "type": "split_inverter",
    "error_code": "E8",
    "section": "ERROR_CODES",
    "content_type": "manual|table|video_transcript",
    "source": "manufacturer_pdf",
    "is_verified": true,
    "qwen_score": 0.92,
    "token_count": 512
  }
}
```

**Metadata Filters:**
```
brand, model, btu, type, technology, compressor_type,
refrigerant, error_code, section, content_type
```

---

## 4. Indexing Pipeline

```
PDF/URL
  ├── Download (cmd/manual-scraper)
  ├── Extract text (ledongthuc/pdf)
  ├── Extract tables (docling)
  ├── Chunk (rag/chunker.go)
  │   ├── error_code: 512 tokens
  │   ├── procedure: 768 tokens
  │   └── spec: 1024 tokens
  ├── Embed (nomic-embed-text 768D)
  └── Upsert (Qdrant hvac_service_manuals)
```

---

## 5. Query Pipeline

```
WhatsApp → intake → classifier → rag_query_agent
  ├── Embed query (nomic)
  ├── Hybrid search (dense + sparse + RRF)
  ├── Confidence scoring
  │   ├── HIGH ≥ 0.85 → resposta direta
  │   ├── MEDIUM ≥ 0.60 → resposta + caveat
  │   └── LOW < 0.40 → web fallback
  └── MiniMax M2.7 response
```

---

## 6. Content Sources

### ✅ ALLOWED
| Source | Type |
|--------|------|
| LG Brazil | Manufacturer (public manuals) |
| Samsung Brazil | Manufacturer |
| Daikin Brazil | Manufacturer |
| Springer/Midea | Manufacturer |
| GitHub: coolfix | errorCodes.json |
| GitHub: hvac-troubleshoot-pro | 18-table schema |

### ❌ BLOCKED
| Source | Reason |
|--------|--------|
| ManualsLib | robots.txt + reCAPTCHA |
| Scribd | Paywall |
| HVAC-Talk | $99/ano subscription |

---

## 7. Acceptance Criteria

| # | Criterion | Test |
|---|-----------|------|
| AC-1 | Index PDF → chunks → Qdrant | Query returns indexed content |
| AC-2 | Chunk error code tables intact | Query "Springer E8" returns relevant chunks |
| AC-3 | Confidence calibration | HIGH/MEDIUM/LOW thresholds respected |
| AC-4 | Qdrant hybrid search | dense + sparse + RRF fusion works |
| AC-5 | DEV simulation | whatsapp-simulator outputs response |

---

## 8. Files

| File | Purpose |
|------|---------|
| `internal/rag/chunker.go` | ChunkFromPDF() |
| `internal/rag/qdrant/client.go` | Qdrant upsert/search |
| `internal/agents/rag_query_agent.go` | Query pipeline |
| `internal/agents/rag_indexer_agent.go` | Indexing pipeline |
| `cmd/manual-scraper/` | PDF download + extraction |
| `docs/REFERENCE/hvac-models-and-error-codes.md` | Reference data |

---

## 9. Success Metrics

- Indexar 50+ manuais (Springer, LG, Samsung)
- 100+ error codes by brand
- Response time < 2s
- Recall@5 ≥ 85%

---

*Modelo de dados em: [docs/REFERENCE/hvac-models-and-error-codes.md](../REFERENCE/hvac-models-and-error-codes.md)*
