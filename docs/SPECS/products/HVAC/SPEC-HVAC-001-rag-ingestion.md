---
name: SPEC-HVAC-001
description: HVAC manual RAG ingestion pipeline — PDF to Open WebUI Knowledge
status: draft
owner: platform
created: 2026-04-27
---

# SPEC-HVAC-001 — HVAC Manual RAG Ingestion Pipeline

## 1. Overview

Build a data factory that ingests HVAC equipment manuals (PDF) and produces a RAG-ready knowledge base in Open WebUI / Qdrant.

**Source:** HVAC equipment PDF manuals (TBD location)
**Destination:** Open WebUI Knowledge base + Qdrant vector index
**Output artifact:** `hvac-manifest.json` — chunk inventory with metadata

---

## 2. Pipeline Stages

```
PDF
  └─► sha256/dedup        # Deduplicate by content hash
        └─► Docling        # Convert PDF → Markdown + JSON
              └─► normalize  # HVAC field extraction (model, specs, troubleshooting)
                    └─► chunk  # Split into RAG-ready chunks (512 tokens, 50 overlap)
                          └─► manifest  # hvac-manifest.json with chunk metadata
                                └─► validate  # Schema validation + completeness check
                                      └─► index  # Open WebUI Knowledge + Qdrant
```

### Stage 1 — sha256/dedup

- Compute `sha256` of each PDF file
- Maintain `seen-hashes.txt` to skip already-processed files
- Target: `data/hvac/pdfs/` (TBD — confirm location with user)

### Stage 2 — Docling

- **Tool:** [Docling](https://docling.site/cli/) (`pip install docling`)
- **CLI:** `docling document.pdf -o output/`
- Outputs: `output.md` (Markdown) + `output.json` (structured JSON)
- Install docling if not present: `pip install docling`

### Stage 3 — HVAC Normalization

Extract and standardize fields from Docling JSON:

```json
{
  "model": "string",
  "manufacturer": "string",
  "equipment_type": "AC | Heat Pump | Furnace | Boiler | ..." ,
  "error_codes": ["E001", "..."],
  "troubleshooting_steps": ["..."],
  "specifications": { "btu": 0, "voltage": 0, ... },
  "warranty_years": 0,
  "source_page": 0
}
```

Use a Python script (`scripts/hvac-normalize.py`) with:
- `docling` Python API for JSON parsing
- `hvac-schema.json` for validation (JSON Schema)
- Output: `data/hvac/normalized/<sha256>.json`

### Stage 4 — Chunking

- **Method:** Recursive text splitting (512 tokens, 50 token overlap)
- **Preserve:** page boundaries, table structures, section headers
- **Add metadata:** `model`, `manufacturer`, `equipment_type`, `chunk_index`, `total_chunks`

### Stage 5 — Manifest

Generate `hvac-manifest.json`:

```json
{
  "version": "1.0",
  "created_at": "ISO8601",
  "total_chunks": 0,
  "total_models": 0,
  "chunks": [
    {
      "chunk_id": "hvac-000001",
      "file_sha256": "...",
      "model": "...",
      "equipment_type": "...",
      "page_start": 0,
      "page_end": 0,
      "chunk_index": 0,
      "text_preview": "...",
      "qdrant_point_id": "..."
    }
  ]
}
```

### Stage 6 — Validation

- JSON Schema validation of `hvac-manifest.json`
- Completeness check: all normalized files have manifest entries
- Chunk quality check: no chunk < 50 chars, no chunk > 1024 tokens
- Report: `data/hvac/reports/validation-<timestamp>.json`

### Stage 7 — Index

**Open WebUI Knowledge:**
- Upload Markdown files to Open WebUI workspace
- Create Knowledge collection: `hvac-manuals`
- Tag each document with `equipment_type`, `manufacturer`

**Qdrant (optional, for hybrid search):**
- Embed chunks using `nomic-embed-text` via LiteLLM
- Collection: `hvac_chunks`
- Payload: `model`, `manufacturer`, `equipment_type`, `chunk_text`

---

## 3. Directory Structure

```
data/hvac/
  pdfs/                    # Source PDFs (TBD)
  sha256/                  # sha256 hashes of processed PDFs
  normalized/              # Docling JSON + HVAC normalization output
  chunks/                  # RAG-ready text chunks
  manifests/               # hvac-manifest.json per batch
  reports/                 # Validation reports

scripts/
  hvac-normalize.py        # Normalization script
  hvac-chunk.py            # Chunking script
  hvac-validate.py         # Validation script
  hvac-index.py            # Open WebUI + Qdrant indexing

schemas/
  hvac-schema.json         # JSON Schema for HVAC normalized output
  manifest-schema.json      # JSON Schema for hvac-manifest.json
```

---

## 4. Dependencies

| Tool | Install | Purpose |
|------|---------|---------|
| `docling` | `pip install docling` | PDF → Markdown/JSON |
| Python ≥3.11 | system | Script runtime |
| `jq` | system | JSON manipulation |
| LiteLLM | `pip install litellm` | Embeddings (via Qdrant) |
| `nomic-embed-text` | LiteLLM | Text embedding |

---

## 5. Acceptance Criteria

1. Given a PDF in `data/hvac/pdfs/`, running `make hvac-ingest` produces a valid `hvac-manifest.json`
2. Each chunk in the manifest has `model`, `equipment_type`, `chunk_index`, and `text_preview`
3. No duplicate chunks (sha256 dedup) — same PDF content processed twice produces identical output
4. Validation script exits 0 for a clean manifest, exits 1 for schema violations
5. Open WebUI Knowledge collection `hvac-manuals` is populated with all normalized Markdown
6. Qdrant collection `hvac_chunks` has embeddings for all chunks (if Qdrant is enabled)
7. Processing is idempotent — re-running on same PDFs produces identical manifest

---

## 6. Out of Scope

- OCR for scanned PDFs (future: add Tesseract stage)
- Multi-language translation
- Real-time indexing (this is a batch pipeline)
- Open WebUI Pipelines (future: if logic becomes complex)

---

## 7. Related SPECs

- [SPEC-003](../SPEC-003-memory-rag-llm-stack.md) — Memory RAG LLM Stack (Qdrant, LiteLLM, embedding contract)
- [SPEC-HVAC-002](SPEC-HVAC-002-openwebui-faq.md) — HVAC FAQ Open WebUI (Knowledge base usage)
- [SPEC-HVAC-003](SPEC-HVAC-003-evaluation-suite.md) — HVAC Evaluation Suite (retrieval quality)

---

## 8. Memory and Context Contract

This pipeline writes to shared Nexus memory. All RAG chunks are stored in Qdrant `hvac_chunks` collection and are accessible to all Nexus agents (Hermes, Claude, Codex) via the shared memory contract defined in [SPEC-MEM-001](../SPEC-MEM-001-nexus-shared-memory-contract.md).

**Contract rules:**
- Chunks are indexed with `source: hvac-manuals`, `doc_type: hvac_chunk`
- Embeddings use `nomic-embed-text` via LiteLLM (same model as all other Nexus collections)
- Retrieval priority: equipment_type > manufacturer > model
- No agent writes to second-brain directly from this pipeline
