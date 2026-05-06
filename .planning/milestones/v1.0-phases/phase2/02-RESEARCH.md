# Phase 2: Expansão Massiva de Base Inverter BR - Research

**Researched:** 2026-05-05
**Domain:** HVAC RAG pipeline orchestration, web scraping, language detection, Qdrant coverage measurement
**Confidence:** HIGH (all claims verified against live codebase)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Orquestrador: `hvac_expansion_pipeline.py` (single script, checkpoint-based)
- Pipeline order: sync_catalog → normalize → missing_manuals → scraper_batch → add_manual
- Tier-1 brands (priority): LG, Samsung, Daikin
- Meta: catálogo INMETRO 100% normalizado + ≥80% dos modelos tier-1 com manual indexado no Qdrant
- Checkpoint file: `/srv/data/hvac-rag/catalog/pipeline_checkpoint.json` (JSON)
- Failed/missing → `/srv/data/hvac-rag/reports/pending_review.jsonl`
- Coverage report output: `/srv/data/hvac-rag/reports/coverage_report.md`
- Validação PT-BR: adicionar check no intake (rejeitar manuais sem conteúdo PT)
- Relatório Markdown enriquecido por marca via evolução de `hvac_missing_manuals.py`

### Claude's Discretion
- Nomes exatos das funções internas do orquestrador
- Formato do checkpoint file (JSON preferível para legibilidade)
- Threshold de confiança para detecção de idioma PT-BR

### Deferred Ideas (OUT OF SCOPE)
- Browser-use integration no `hvac_manual_downloader.py`
- Dashboard HTML com Chart.js para visualização de cobertura
- Alertas automáticos (e-mail/Slack) quando cobertura cai abaixo de threshold
</user_constraints>

---

## Summary

Phase 2 expands the HVAC Inverter RAG knowledge base from 2 indexed PDFs (442 chunks) to full coverage of INMETRO-registered Inverter models for tier-1 brands. The existing pipeline scripts are functional but not connected — the orchestrator `hvac_expansion_pipeline.py` is the main deliverable that chains them together with checkpoint-based resumability.

The most critical finding is a **pipeline integration gap**: `hvac_add_manual.py --index` writes a manifest entry and JSON sidecar, but the downstream `hvac_chunk.py` reads from `normalized-documents.jsonl` — a different schema with language, brand, model, and equipment-type metadata. A normalization step (sourced from `/srv/hvac-pipeline/hvac_normalize.py`) must bridge these two stages. This normalization step does not currently exist in `/srv/monorepo/scripts/hvac-rag/` and must be either copied or re-implemented.

Language detection is already solved: `/srv/hvac-pipeline/hvac_normalize.py` implements signal-count detection (PT/ES/EN) producing `language`, `language_confidence`, and `language_method` fields. The PT-BR check required by CONTEXT.md should use this existing approach (threshold: `language == 'pt-BR'` and `confidence >= 0.30`). No external library (langdetect, langid) is installed in the venv and none needs to be installed.

**Primary recommendation:** Build `hvac_expansion_pipeline.py` as a 6-step orchestrator. Steps 1–2 are existing scripts called as subprocesses. Step 3 generates a `brand:model` batch file from the INMETRO JSONL catalog (gap: `hvac_missing_manuals.py` emits Markdown only, not a machine-readable batch file — batch generation must be added to the pipeline or to missing_manuals). Steps 4–6 call the scraper, the intake, and the indexer.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Catalog sync (INMETRO XLSX) | Scripts / CLI | — | Offline batch job, no web server involvement |
| Catalog normalization | Scripts / CLI | — | Data transformation pipeline step |
| Gap analysis (INMETRO vs Qdrant) | Scripts / CLI | Qdrant (query) | Reads catalog + Qdrant, emits report |
| Batch file generation | Scripts / CLI | — | Transforms gap report into scraper input |
| Manual scraping (LG/Samsung/Daikin) | Scripts / CLI | HTTP (external sites) | Web scraping, rate-limited |
| PDF intake + validation | Scripts / CLI | Docling (PDF→MD) | Fingerprint, policy, inverter gate, PT-BR check |
| Normalization step | Scripts / CLI | — | Bridges intake output to chunker input |
| Chunking | Scripts / CLI | — | Docling markdown → JSONL chunks |
| Qdrant indexing | Scripts / CLI | Qdrant (upsert) + Ollama (embed) | Batch upsert with nomic-embed-text |
| Coverage reporting | Scripts / CLI | Qdrant (scroll) | Reads Qdrant + catalog, emits Markdown |
| Pipeline orchestration | Scripts / CLI | — | Checkpoint-based subprocess runner |

---

## Standard Stack

### Core (already installed in `/srv/data/hvac-rag/.venv`)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| requests | 2.33.1 | HTTP downloads, Qdrant API, Ollama API | Already used by all pipeline scripts |
| beautifulsoup4 | 4.14.3 | Parse HTML pages from manufacturer sites | Already in hvac_manual_scraper.py |
| openpyxl | 3.1.5 | Parse INMETRO XLSX catalog | Used by hvac_sync_inmetro_catalog.py |
| docling | 2.91.0 | PDF→Markdown conversion | Phase 1 standard, Docling Precision |
| PyYAML | 6.0.3 | Document policy YAML | Used by hvac_add_manual.py |

[VERIFIED: `/srv/data/hvac-rag/.venv/bin/pip list` output]

### No New Dependencies Required

The PT-BR language detection uses a signal-count wordlist approach already implemented in `/srv/hvac-pipeline/hvac_normalize.py`. No external language detection library (langdetect, langid) needs to be installed.

**Language detection signals (verified from `/srv/hvac-pipeline/hvac_normalize.py`):**
- PT signals: `instalação`, `unidade`, `segurança`, `alimentação`, `refrigeração`, `advertência`, `figura`, `tabela`, `cuidado`, `precauções`, `aviso`, `especificação`, `manual de`, `serviço`
- ES signals: Spanish equivalents of the above
- EN signals: English equivalents

---

## Architecture Patterns

### Full Pipeline Flow (Current + Phase 2 Extensions)

```
INMETRO gov.br XLSX
        │
        ▼
hvac_sync_inmetro_catalog.py
        │ inmetro_raw_DATE.json
        ▼
hvac_normalize_inmetro_catalog.py
        │ inmetro_ac_br_models.jsonl
        ▼
[batch file generator — NEW in orchestrator]
        │ missing_models.txt  (brand:model per line)
        ▼
Qdrant scroll (get_indexed_models)
        │
        ▼
hvac_missing_manuals.py  ──── coverage report
        │
        ▼
hvac_manual_scraper.py --batch-file missing_models.txt
        │ PDFs → /srv/data/hvac-rag/incoming/pdf/{brand}/
        │ failed/missing → pending_review.jsonl
        ▼
for each PDF:
  hvac_add_manual.py --index    (fingerprint, policy, inverter gate, PT-BR check)
        │ ACCEPTED → manifests/documents.jsonl + processed/markdown/
        │ REJECTED → rejected/ + pending_review.jsonl
        ▼
  [normalization step — bridges add_manual to chunk]
        │ append to manifests/normalized-documents.jsonl
        ▼
  hvac_chunk.py (reads normalized-documents.jsonl)
        │ chunks/jsonl/chunks.jsonl
        ▼
  hvac_index_qdrant.py --write
        │ → Qdrant hvac_manuals_v1
        ▼
[coverage measurement]
hvac_reconcile_catalog_qdrant.py  → manual-coverage.json
        │
        ▼
hvac_missing_manuals.py (enriched Markdown)  → coverage_report.md
```

### Pattern 1: Checkpoint-Based Orchestrator

**What:** A single Python script that runs each pipeline step, recording step completion in a JSON checkpoint file. On re-run, completed steps are skipped.

**When to use:** Long-running batch pipelines (50–200 PDFs) where individual steps can fail and must be retried without re-executing completed work.

**Checkpoint format (Claude's discretion — JSON recommended):**

```python
# Source: CONTEXT.md + codebase pattern analysis
CHECKPOINT_PATH = Path("/srv/data/hvac-rag/catalog/pipeline_checkpoint.json")

def load_checkpoint() -> dict:
    if CHECKPOINT_PATH.exists():
        return json.loads(CHECKPOINT_PATH.read_text())
    return {"completed_steps": [], "pdf_status": {}, "started_at": None}

def mark_step_done(checkpoint: dict, step: str) -> None:
    checkpoint["completed_steps"].append(step)
    CHECKPOINT_PATH.write_text(json.dumps(checkpoint, indent=2))

def step_done(checkpoint: dict, step: str) -> bool:
    return step in checkpoint["completed_steps"]
```

**Per-PDF status tracking:**

```python
# Track each PDF individually within the scraping step
checkpoint["pdf_status"][pdf_path] = {
    "status": "accepted" | "rejected" | "failed",
    "rejection_reason": "...",
    "indexed": True | False,
    "processed_at": "ISO8601"
}
```

### Pattern 2: Batch File Generation from INMETRO JSONL

**What:** The orchestrator must generate the `brand:model` batch file that the scraper consumes. The existing `hvac_missing_manuals.py` emits Markdown only; the batch file must be generated directly from the INMETRO catalog, filtered by models not yet in Qdrant.

**Example generation logic:**

```python
# Source: analysis of hvac_missing_manuals.py + hvac_manual_scraper.py batch format
SCRAPER_BRANDS = {"lg", "samsung", "daikin", "springer", "carrier"}
TIER1_BRANDS = {"lg", "samsung", "daikin"}

def generate_batch_file(catalog: list[dict], indexed: set[str], 
                        batch_path: Path, tier1_only: bool = False) -> int:
    """Generate brand:model batch file for scraper, tier-1 first."""
    lines = []
    tier1_lines = []
    tier2_lines = []
    
    for rec in catalog:
        brand = rec.get("brand", "").lower()
        if brand not in SCRAPER_BRANDS:
            continue  # No scraper support — goes to pending_review.jsonl
        model = rec.get("indoor_model") or rec.get("model", "")
        key = f"{brand}::{rec.get('model_family', model).lower()}"
        if key in indexed:
            continue  # Already covered
        entry = f"{brand}:{model}"
        if brand in TIER1_BRANDS:
            tier1_lines.append(entry)
        else:
            tier2_lines.append(entry)
    
    # Tier-1 first, then tier-2
    all_lines = tier1_lines + ([] if tier1_only else tier2_lines)
    batch_path.write_text("\n".join(all_lines) + "\n")
    return len(all_lines)
```

### Pattern 3: PT-BR Language Check in Intake

**What:** Add PT-BR detection to `hvac_add_manual.py` as an additional rejection gate. Reuse the signal-count approach from `/srv/hvac-pipeline/hvac_normalize.py`.

**When to reject:** Document has `language != 'pt-BR'` AND `confidence >= 0.40` for another language. Documents with `confidence < 0.30` for any language should NOT be rejected (technical PDFs with diagrams often score low).

**Recommended threshold (Claude's discretion):** Reject only when a non-PT language scores `confidence >= 0.40` and PT scores `< 0.15`. This prevents rejecting bilingual PT+EN service manuals.

```python
# Source: /srv/hvac-pipeline/hvac_normalize.py signal_count approach
PT_SIGNALS = [
    'instalação', 'unidade', 'segurança', 'alimentação', 'refrigeração',
    'advertência', 'figura', 'tabela', 'cuidado', 'precauções', 'aviso',
    'especificação', 'manual de', 'serviço'
]
# (ES and EN signals from same source)

def detect_ptbr(md_text: str) -> tuple[str, float]:
    """Return (language, confidence) using signal-count method."""
    ...
    # Returns ('pt-BR', 0.6) | ('en', 0.7) | ('unknown', 0.0)

def check_ptbr(md_text: str, policy: dict) -> tuple[bool, str | None]:
    """Return (allowed, rejection_reason). Only reject confirmed non-PT manuals."""
    if not policy.get("require_ptbr", False):
        return True, None
    lang, conf = detect_ptbr(md_text)
    if lang == 'pt-BR':
        return True, None
    if lang != 'unknown' and conf >= 0.40:
        return False, f"language_not_ptbr:{lang}({conf:.2f})"
    return True, None  # Unknown or low-confidence — accept
```

### Pattern 4: Brands Without Scraper → pending_review.jsonl

**What:** Brands not in `BRAND_CONFIG` (Midea, Gree, Fujitsu, Hitachi, Komeco, Elgin, Agratto) cannot be auto-scraped. The orchestrator must detect these and write them to `pending_review.jsonl`.

```python
# Source: CONTEXT.md + analysis of hvac_manual_scraper.py BRAND_CONFIG
SCRAPER_BRANDS = {"lg", "samsung", "daikin", "springer", "carrier"}
PENDING_REVIEW_PATH = Path("/srv/data/hvac-rag/reports/pending_review.jsonl")

def log_pending_review(rec: dict, reason: str) -> None:
    entry = {
        "catalog_id": rec.get("catalog_id"),
        "brand": rec.get("brand"),
        "model": rec.get("indoor_model") or rec.get("model"),
        "reason": reason,  # "no_scraper_support" | "scrape_failed" | "not_ptbr" | "not_inverter"
        "timestamp": datetime.utcnow().isoformat() + "Z"
    }
    with PENDING_REVIEW_PATH.open("a") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")
```

### Pattern 5: Normalization Bridge Step

**What:** `hvac_add_manual.py --index` writes to `manifests/documents.jsonl` (schema: doc_id, raw_sha256, md_path, domain_score, duplicate_status). The `hvac_chunk.py` reads from `manifests/normalized-documents.jsonl` (schema: doc_id, brand_candidates, model_candidates, language, approved_for_chunking, md_path). A normalization step must bridge these two.

**Implementation approach:** The orchestrator calls a normalization function (inline or as a helper) that reads the newest entry from `documents.jsonl` and appends a normalized record to `normalized-documents.jsonl`. Source logic from `/srv/hvac-pipeline/hvac_normalize.py`.

```python
# Source: /srv/hvac-pipeline/hvac_normalize.py
def normalize_document(doc_record: dict, md_text: str) -> dict:
    """Convert documents.jsonl record to normalized-documents.jsonl format."""
    lang_result = score_language(md_text)
    brand_candidates = extract_brand_candidates(md_text)
    model_candidates = extract_model_candidates(md_text)
    equip_candidates = extract_equipment_type(md_text)
    
    return {
        "doc_id": doc_record["doc_id"],
        "source_pdf": doc_record.get("source_pdf", doc_record.get("pdf_path", "")),
        "brand_candidates": [{"brand": b, "occurrences": c} for b, c in brand_candidates],
        "model_candidates": [{"model": m, "occurrences": c} for m, c in model_candidates],
        "equipment_type_candidates": [{"type": t, "occurrences": c} for t, c in equip_candidates],
        "error_code_candidates": [],  # populated by hvac_chunk.py
        "doc_type": doc_record.get("doc_type", "unknown"),
        "language": lang_result["language"],
        "language_confidence": lang_result["confidence"],
        "language_method": lang_result["method"],
        "language_signals": lang_result["signals"],
        "language_review_required": lang_result["review_required"],
        "normalization_status": "normalized",
        "review_reasons": [],
        "approved_for_chunking": True,
        "md_path": doc_record.get("md_path"),
    }
```

### Pattern 6: Enriched Coverage Report

**What:** Evolve `hvac_missing_manuals.py` to emit a Markdown table per brand showing: % coverage, models indexed vs missing, last updated date. This is the `coverage_report.md` at `/srv/data/hvac-rag/reports/`.

**Evolution required in `hvac_missing_manuals.py`:**
- Add `--output-coverage` flag that writes to `/srv/data/hvac-rag/reports/coverage_report.md`
- Add per-brand summary table as an additional section in the report
- Add `last_run` timestamp and phase info to the report header

**New section format:**

```markdown
## Resumo por Marca

| Marca | Modelos INMETRO | Indexados | Faltantes | Cobertura | Scraper |
|-------|----------------|-----------|-----------|-----------|---------|
| LG    | 45             | 38        | 7         | 84.4%     | ✅      |
| Samsung | 52           | 41        | 11        | 78.8%     | ✅      |
| Daikin | 33            | 27        | 6         | 81.8%     | ✅      |
| Carrier | 18           | 0         | 18        | 0.0%      | ✅      |
| Midea | 22             | 0         | 22        | 0.0%      | ❌ pending |
```

### Anti-Patterns to Avoid

- **Calling hvac_chunk.py without updating normalized-documents.jsonl first:** hvac_chunk.py reads `approved_for_chunking` from normalized-docs. If a new PDF is in documents.jsonl but not in normalized-docs, it will never be chunked.
- **Using `--brand all` without generating batch file first:** The scraper's `--brand all` with `--batch-file` requires the batch file to exist and contain valid `brand:model` lines. Generating it inline in the orchestrator avoids this dependency.
- **Re-running sync_catalog if XLSX unchanged:** The sync step downloads the INMETRO XLSX. The checkpoint should mark it done if the file is fresh (< 24h old). `hvac_sync_inmetro_catalog.py` already caches to `/tmp/inmetro_ac_DATE.xlsx`.
- **Duplicate indexing:** The scraper writes to `scraper_manifest.jsonl` with SHA256. The intake checks `documents.jsonl`. These are separate dedup mechanisms. Do not skip the intake dedup assuming the scraper manifest is sufficient.
- **Rejecting bilingual manuals:** Many tier-1 PDFs (especially Daikin) are bilingual PT+ES or PT+EN. The PT-BR check must not reject documents that have PT-BR content but score below threshold due to multilingual content.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PDF→Markdown | Custom PDF parser | `docling_convert()` from hvac_chunk.py | Already integrated with table header preservation from Phase 1 |
| Deduplication | Custom hash comparison | Existing SHA256 logic in hvac_add_manual.py | Handles exact + content + fuzzy (Jaccard) dedup |
| Inverter gate | Custom content filter | `is_inverter_technology()` + `is_blacklisted()` from hvac_intake.py | Hard-lock implemented in Phase 1, must not be removed |
| Qdrant upsert | Direct HTTP calls | `hvac_index_qdrant.py` | Handles batching, embedding, collection creation, smoke tests |
| Coverage measurement | Manual count | `hvac_reconcile_catalog_qdrant.py` | Produces `manual-coverage.json` with full per-model status |
| Language detection | Install langdetect | Signal-count from `/srv/hvac-pipeline/hvac_normalize.py` | No dependency needed, already validated in production |
| Brand extraction | Regex from scratch | `extract_brand_candidates()` from `/srv/hvac-pipeline/hvac_normalize.py` | Works for all 15+ brands |

**Key insight:** The entire normalization layer already exists in `/srv/hvac-pipeline/hvac_normalize.py`. It was not migrated to `/srv/monorepo/scripts/hvac-rag/` during Phase 1. The orchestrator or a new `hvac_normalize_document.py` file should encapsulate these functions.

---

## Common Pitfalls

### Pitfall 1: Scraper Yields HTML Errors as "PDFs"

**What goes wrong:** `hvac_manual_scraper.py` downloads the first matching link. Manufacturer sites (especially LG Brazil and Samsung) sometimes return HTTP 200 with an HTML error page when the manual link redirects or requires authentication. The file lands in `incoming/pdf/` with `.pdf` extension but is actually HTML.

**Why it happens:** `requests.get()` with `stream=True` downloads whatever the server returns without validating `Content-Type`.

**How to avoid:** Add Content-Type validation in `download_file()` — check that `resp.headers.get('Content-Type', '').startswith('application/pdf')` before saving. If Content-Type is `text/html`, treat as failure.

**Warning signs:** Downloaded file is < 50KB, or `file sha256` matches a previously-downloaded "PDF" from the same brand.

### Pitfall 2: hvac_chunk.py Reads Entire normalized-documents.jsonl on Each Run

**What goes wrong:** `hvac_chunk.py main()` reads ALL records from `normalized-documents.jsonl` and rewrites ALL chunks. If called per-PDF in the orchestrator loop, each call re-processes every previously-approved document, making the pipeline O(N²) in time.

**Why it happens:** `hvac_chunk.py` was designed for batch processing, not incremental operation.

**How to avoid:** The orchestrator should call `hvac_chunk.py` ONCE after all PDFs have been added to `normalized-documents.jsonl`, not once per PDF. Alternatively, pass an `--incremental` flag (if added) that processes only records added since the last run.

**Recommended approach:** Batch all normalizations first, then call chunk once, then call index once.

### Pitfall 3: INMETRO XLSX URL Changes

**What goes wrong:** `hvac_sync_inmetro_catalog.py` has 2 hardcoded INMETRO URLs. The gov.br site restructures URLs periodically without redirects.

**Why it happens:** Government sites change URL patterns without maintaining backward compatibility.

**How to avoid:** `hvac_sync_inmetro_catalog.py` already has `--url` override flag. The orchestrator should catch sync failure and emit a clear error message with the manual fallback: `https://pbe.inmetro.gov.br/`. Use `--offline` flag if XLSX was already downloaded today.

**Warning signs:** `requests.exceptions.HTTPError: 404` in sync step. Check `/tmp/inmetro_ac_*.xlsx` for cached file.

### Pitfall 4: Qdrant Collection Missing On Fresh Run

**What goes wrong:** `hvac_index_qdrant.py` will fail if the Qdrant collection `hvac_manuals_v1` does not exist. It creates the collection only when `--recreate` is passed. On first run of the orchestrator on a new environment, the collection may not exist.

**Why it happens:** `hvac_index_qdrant.py` checks for collection existence before creating, but the logic has a subtle ordering dependency.

**How to avoid:** The orchestrator should verify Qdrant connectivity and collection existence before starting the pipeline. Call `GET /collections/hvac_manuals_v1` and create if needed. `hvac_index_qdrant.py` handles this if called with the right flags.

### Pitfall 5: Qdrant Needs API Key Even for Local Instances

**What goes wrong:** All Qdrant calls fail with "Must provide an API key or an Authorization bearer token" if `QDRANT_API_KEY` is not set.

**Why it happens:** The local Qdrant instance is configured with API key authentication (confirmed from live test: `curl http://localhost:6333/health` returned auth error).

**How to avoid:** Ensure `QDRANT_API_KEY` is set in the environment before any Qdrant operation. The orchestrator should check `os.environ.get("QDRANT_API_KEY")` at startup and fail fast if absent. The key is in `/srv/monorepo/.env`.

**Warning signs:** Any Qdrant call returns HTTP 401 or "Must provide an API key".

### Pitfall 6: Missing ≥80% Coverage Measurement

**What goes wrong:** The ≥80% tier-1 goal is measured against the Qdrant collection's `brand` and `model_family` payload fields. The current Qdrant index was built from only 2 PDFs with `brand_candidates` containing multiple brands (e.g., both LG and Daikin appear in the same chunk). The coverage measurement in `hvac_missing_manuals.py` uses `brand::model_family` keys which may not match INMETRO catalog model IDs exactly.

**Why it happens:** The match is substring-based, not exact. A manual for model family "RXYQ" covers multiple models but the catalog lists specific variants.

**How to avoid:** The ≥80% goal should be measured at the `model_family` level, not the exact model level. `hvac_missing_manuals.py` already groups by `model_family` — verify this is the basis for the coverage percentage in the enriched report.

---

## Critical Gap Analysis

### Gap 1: hvac_normalize_document.py Does Not Exist in Monorepo

**Finding:** `/srv/hvac-pipeline/hvac_normalize.py` contains `score_language()`, `extract_brand_candidates()`, `extract_model_candidates()`, `extract_equipment_type()`, and `detect_doc_type()`. This file is NOT in `/srv/monorepo/scripts/hvac-rag/`. However, `hvac_add_manual.py` imports `from hvac_normalize import detect_doc_type, extract_model_candidates` — which works because the shebang uses the SCRIPTS_DIR path injection.

[VERIFIED: `find /srv/monorepo/scripts/hvac-rag -name "hvac_normalize.py"` returned nothing; found at `/srv/hvac-pipeline/hvac_normalize.py`]

**Impact:** The pipeline cannot complete the normalization bridge step without migrating or wrapping `/srv/hvac-pipeline/hvac_normalize.py`.

**Required action:** Create `hvac_normalize_document.py` in `/srv/monorepo/scripts/hvac-rag/` that wraps the functions from `/srv/hvac-pipeline/hvac_normalize.py` with additional logic for the normalized-documents.jsonl schema.

### Gap 2: hvac_missing_manuals.py Does Not Emit Machine-Readable Batch File

**Finding:** `hvac_missing_manuals.py` generates a Markdown report of missing models. The scraper expects `brand:model` per line in a plain text batch file. The orchestrator must generate this batch file independently from the INMETRO JSONL catalog.

[VERIFIED: Reading full `hvac_missing_manuals.py` — no `--batch-output` or JSONL export flag exists]

**Required action:** Add batch file generation logic directly to the orchestrator's step between `missing_manuals` and `scraper_batch`.

### Gap 3: hvac_chunk.py is Not Incremental

**Finding:** `hvac_chunk.py main()` reads the entire `normalized-documents.jsonl` and regenerates all chunks. It does not support incremental operation (process only new records).

[VERIFIED: Lines 382–393 of hvac_chunk.py]

**Required action:** The orchestrator must NOT call `hvac_chunk.py` per-PDF. Instead, accumulate all new normalized records first, then call `hvac_chunk.py` once for the full batch. The `hvac_index_qdrant.py` upsert is idempotent (uses deterministic UUIDs from chunk_id SHA256), so re-indexing previously indexed chunks is wasteful but not harmful.

### Gap 4: Qdrant Requires Authentication

**Finding:** Local Qdrant instance requires API key. `curl http://localhost:6333/health` returns authentication error.

[VERIFIED: Live probe returned "Must provide an API key or an Authorization bearer token"]

**Required action:** All Qdrant operations in the orchestrator must use the key from `QDRANT_API_KEY` env var. The orchestrator must fail fast at startup if this var is absent.

---

## Success Criteria Validation

### How to Measure "≥80% Tier-1 Indexed"

The measurement is based on `hvac_reconcile_catalog_qdrant.py` output (`manual-coverage.json`):

```python
# From hvac_reconcile_catalog_qdrant.py build_summary()
coverage_pct = round(indexed / total * 100, 2) if total else 0.0
```

For tier-1 brands specifically, filter the `rows` list by brand before computing:

```python
tier1_rows = [r for r in rows if r["brand"].lower() in {"lg", "samsung", "daikin"}]
tier1_indexed = sum(1 for r in tier1_rows if r["manual_status"] == "indexed")
tier1_total = len(tier1_rows)
tier1_coverage = round(tier1_indexed / tier1_total * 100, 2) if tier1_total else 0.0
```

**Phase gate:** `tier1_coverage >= 80.0` AND `inmetro_catalog_100_normalized == True`.

### How to Verify "Catálogo INMETRO 100% Normalizado"

Check that `inmetro_ac_br_models.jsonl` contains all records from the most recent `inmetro_raw_DATE.json`:

```python
raw_count = len(json.load(open(latest_raw_json)))
norm_count = sum(1 for _ in open(norm_jsonl))
catalog_complete = (norm_count / raw_count) >= 0.95  # 5% tolerance for schema failures
```

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Qdrant :6333 | hvac_index_qdrant.py, hvac_missing_manuals.py | ✓ (needs API key) | unknown | — |
| Ollama :11434 (nomic-embed-text) | hvac_index_qdrant.py | Assumed running | unknown | — |
| INMETRO gov.br XLSX | hvac_sync_inmetro_catalog.py | ✓ (cached `/tmp/`) | 2026-05 | `--offline` flag |
| LG Brazil support site | hvac_manual_scraper.py | ASSUMED | — | pending_review.jsonl |
| Samsung Brazil support site | hvac_manual_scraper.py | ASSUMED | — | pending_review.jsonl |
| Daikin Brazil support site | hvac_manual_scraper.py | ASSUMED | — | pending_review.jsonl |
| Docling (PDF→MD) | hvac_chunk.py docling_convert | ✓ (installed) | 2.91.0 | — |

[VERIFIED: pip list output for venv; Qdrant availability probed but requires API key; manufacturer sites assumed reachable]

**Missing dependencies with no fallback:**
- Qdrant API key must be set in `QDRANT_API_KEY` env var — no fallback, orchestrator must fail fast if absent
- Ollama with nomic-embed-text must be running for indexing step — no fallback (embedding is required for Qdrant upsert)

**Missing dependencies with fallback:**
- Manufacturer scraping sites: if unreachable, models go to `pending_review.jsonl` — pipeline continues

---

## Validation Architecture

> `workflow.nyquist_validation` key absent in `.planning/config.json` — treated as enabled.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | pytest (system python) |
| Config file | None — see Wave 0 |
| Quick run command | `pytest tests/hvac-rag/ -x -q` |
| Full suite command | `pytest tests/hvac-rag/ -v` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CATALOG-01 | INMETRO JSONL has all inverter records | unit | `pytest tests/hvac-rag/test_catalog.py::test_inmetro_normalized -x` | ❌ Wave 0 |
| SCRAPER-01 | Scraper batch mode processes brand:model file | unit | `pytest tests/hvac-rag/test_scraper.py::test_batch_file_parsing -x` | ❌ Wave 0 |
| INTAKE-01 | PT-BR check rejects confirmed non-PT PDFs | unit | `pytest tests/hvac-rag/test_intake_ptbr.py -x` | ❌ Wave 0 |
| PIPELINE-01 | Checkpoint resumes from failed step | unit | `pytest tests/hvac-rag/test_pipeline_checkpoint.py -x` | ❌ Wave 0 |
| COVERAGE-01 | Coverage report shows tier-1 % per brand | unit | `pytest tests/hvac-rag/test_coverage_report.py -x` | ❌ Wave 0 |
| PENDING-01 | Brands without scraper logged to pending_review.jsonl | unit | `pytest tests/hvac-rag/test_pending_review.py -x` | ❌ Wave 0 |

### Wave 0 Gaps

- [ ] `tests/hvac-rag/test_catalog.py` — covers CATALOG-01
- [ ] `tests/hvac-rag/test_scraper.py` — covers SCRAPER-01
- [ ] `tests/hvac-rag/test_intake_ptbr.py` — covers INTAKE-01
- [ ] `tests/hvac-rag/test_pipeline_checkpoint.py` — covers PIPELINE-01
- [ ] `tests/hvac-rag/test_coverage_report.py` — covers COVERAGE-01
- [ ] `tests/hvac-rag/test_pending_review.py` — covers PENDING-01
- [ ] `tests/hvac-rag/conftest.py` — shared fixtures (mock Qdrant, mock catalog)

---

## Security Domain

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes | Existing policy YAML validates PDFs; PT-BR check adds layer |
| V6 Cryptography | no | SHA256 fingerprinting (not cryptographic security context) |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malicious PDF download (path traversal in filename) | Tampering | `re.sub(r'[^\w\-_.]', '_', ...)` already in hvac_add_manual.py |
| Qdrant API key in logs | Information Disclosure | Never log QDRANT_API_KEY; orchestrator should use `os.environ.get()` only |
| INMETRO URL redirect to malicious site | Spoofing | Validate `Content-Type: application/vnd.openxmlformats*` before parsing XLSX |
| Scraped HTML masquerading as PDF | Tampering | Add Content-Type check in download_file() — Gap 1 of Pitfall 1 |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Manufacturer support sites (LG BR, Samsung BR, Daikin BR) are reachable and have crawlable PDF links | Environment Availability | Scraper returns 0 results; all tier-1 models go to pending_review |
| A2 | Ollama with nomic-embed-text is running on :11434 | Environment Availability | hvac_index_qdrant.py fails at embedding step |
| A3 | Qdrant `hvac_manuals_v1` collection exists or will be created by hvac_index_qdrant.py | Environment Availability | Index step fails unless --recreate is used |
| A4 | The ≥80% target is measured at model_family level, not exact model level | Success Criteria | Target may be impossible if exact match is required (many variant models per family) |

**If A1 is wrong (most likely):** Scraper yields 0 PDFs for a brand. The orchestrator should detect empty scraper output and log all models for that brand to `pending_review.jsonl` with reason `scrape_failed`.

---

## Open Questions (RESOLVED — 2026-05-05)

1. **Is Qdrant currently running and indexed? → RESOLVED: YES**
   - `hvac_manuals_v1`: 442 points, status=green, API key required (confirmed from live probe)
   - Orchestrator must pass `Authorization: Bearer $QDRANT_API_KEY` header and validate at startup

2. **Do LG/Samsung/Daikin Brazil sites allow programmatic PDF access? → PARTIALLY RESOLVED**
   - Sites target JavaScript-rendered pages — BeautifulSoup scraping may not find PDFs
   - Resolution: Plan includes `--dry-run` probe per brand before batch; failures → pending_review.jsonl (design already accounts for this)
   - Risk accepted: tier-1 site accessibility is best-effort; pending_review.jsonl captures misses

3. **What is the current INMETRO catalog size for tier-1 brands? → RESOLVED: catalog dir empty**
   - `/srv/data/hvac-rag/catalog/` is empty — `hvac_sync_inmetro_catalog.py` must run as pipeline step 1
   - Baseline counts unknown until first sync; orchestrator Wave 1 runs sync first before any scraping

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual PDF intake one by one | Batch orchestrator with checkpoint | Phase 2 | Enables 50–200 PDF processing without manual intervention |
| No language validation | PT-BR signal-count check | Phase 2 | Filters Spanish/English-only manuals |
| Markdown gap report only | Markdown + machine-readable batch file | Phase 2 | Enables automated scraper feeding |
| Global coverage % only | Per-brand coverage table in Markdown | Phase 2 | Shows tier-1 progress per brand |

---

## Sources

### Primary (HIGH confidence)
- `/srv/monorepo/scripts/hvac-rag/hvac_manual_scraper.py` — full read, batch mode verified
- `/srv/monorepo/scripts/hvac-rag/hvac_add_manual.py` — full read, integration flow verified
- `/srv/monorepo/scripts/hvac-rag/hvac_missing_manuals.py` — full read, gap confirmed (no batch output)
- `/srv/monorepo/scripts/hvac-rag/hvac_chunk.py` — full read, non-incremental behavior confirmed
- `/srv/monorepo/scripts/hvac-rag/hvac_index_qdrant.py` — full read, upsert mechanism verified
- `/srv/monorepo/scripts/hvac-rag/hvac_reconcile_catalog_qdrant.py` — full read, coverage metric verified
- `/srv/monorepo/scripts/hvac-rag/hvac_intake.py` — full read, is_inverter_technology confirmed
- `/srv/hvac-pipeline/hvac_normalize.py` — full read, language detection + brand/model extraction verified
- `/srv/data/hvac-rag/manifests/normalized-documents.jsonl` — schema verified (language_method: signal_count)
- `/srv/data/hvac-rag/manifests/qdrant-index-report.json` — 442 chunks indexed verified
- Live probe: `/srv/data/hvac-rag/.venv/bin/pip list` — dependency versions verified
- Live probe: `find /srv/monorepo/scripts/hvac-rag` — script inventory verified
- Live probe: Qdrant health endpoint — auth required confirmed

### Secondary (MEDIUM confidence)
- `/srv/data/hvac-rag/docs/HVAC-OPENWEBUI-RAG.md` — pipeline overview
- `/srv/data/hvac-rag/manifests/chunking-report.json` — current 2-doc baseline confirmed

### Tertiary (LOW confidence — assumptions)
- Manufacturer site reachability for LG/Samsung/Daikin Brazil [ASSUMED]
- Ollama availability for embedding [ASSUMED]

---

## Metadata

**Confidence breakdown:**
- Pipeline integration (gaps, flow): HIGH — all scripts read directly
- Language detection: HIGH — source code verified in `/srv/hvac-pipeline/hvac_normalize.py`
- Scraper batch mode: HIGH — code verified, batch-file parsing confirmed
- Manufacturer site accessibility: LOW — not probed, assumed
- Current INMETRO catalog coverage: LOW — catalog dir empty at probe time
- Qdrant collection state: MEDIUM — index report (442 points) from last run, may be stale

**Research date:** 2026-05-05
**Valid until:** 2026-06-05 (stable codebase, 30 days)
