# Phase 2: Expansão Massiva de Base Inverter BR - Pattern Map

**Mapped:** 2026-05-05
**Files analyzed:** 4 new/modified files
**Analogs found:** 4 / 4

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `scripts/hvac-rag/hvac_expansion_pipeline.py` | orchestrator | batch (subprocess chain + checkpoint) | `scripts/hvac-rag/hvac-kb-tests.py` | role-match (subprocess pattern) + `hvac_normalize_inmetro_catalog.py` (argparse/dry-run) |
| `scripts/hvac-rag/hvac_normalize_document.py` | transform/bridge | batch (JSONL read → JSONL write) | `/srv/hvac-pipeline/hvac_normalize.py` (source) + `hvac_normalize_inmetro_catalog.py` (JSONL write style) | exact (logic source) + role-match (output style) |
| `scripts/hvac-rag/hvac_add_manual.py` | intake pipeline | request-response (validate → gate → write) | self (modify existing) | self |
| `scripts/hvac-rag/hvac_missing_manuals.py` | reporter | CRUD (Qdrant scroll → Markdown emit) | self (modify existing) | self |

---

## Pattern Assignments

### `scripts/hvac-rag/hvac_expansion_pipeline.py` (orchestrator, batch)

**Primary analog for subprocess calls:** `scripts/hvac-rag/hvac-kb-tests.py`
**Primary analog for argparse/dry-run/main structure:** `scripts/hvac-rag/hvac_normalize_inmetro_catalog.py`
**Primary analog for Qdrant env config block:** `scripts/hvac-rag/hvac_missing_manuals.py`

**Shebang line** (copy from all hvac-rag scripts that use the venv):
```python
#!/srv/data/hvac-rag/.venv/bin/python3
```

**Imports pattern** (derived from `hvac_missing_manuals.py` lines 20-31 + `hvac-kb-tests.py` lines 14-23):
```python
import argparse
import json
import logging
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

import requests
```

**Logging setup** (copy from `hvac_manual_scraper.py` lines 27-28):
```python
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)
```

**Env config block** (copy from `hvac_missing_manuals.py` lines 33-45):
```python
QDRANT_URL      = os.environ.get("QDRANT_URL", "http://127.0.0.1:6333")
QDRANT_API_KEY  = os.environ.get("QDRANT_API_KEY", "")
COLLECTION_NAME = os.environ.get("HVAC_COLLECTION", "hvac_manuals_v1")

CATALOG_JSONL = Path(os.environ.get(
    "HVAC_INMETRO_CATALOG",
    "/srv/data/hvac-rag/catalog/inmetro_ac_br_models.jsonl"
))

REPORTS_DIR = Path(os.environ.get(
    "HVAC_REPORTS_DIR",
    "/srv/data/hvac-rag/reports"
))
```

**Checkpoint pattern** (from RESEARCH.md Pattern 1 — no live analog exists, use this verbatim):
```python
CHECKPOINT_PATH = Path("/srv/data/hvac-rag/catalog/pipeline_checkpoint.json")

def load_checkpoint() -> dict:
    if CHECKPOINT_PATH.exists():
        return json.loads(CHECKPOINT_PATH.read_text())
    return {"completed_steps": [], "pdf_status": {}, "started_at": None}

def save_checkpoint(checkpoint: dict) -> None:
    CHECKPOINT_PATH.write_text(json.dumps(checkpoint, indent=2, ensure_ascii=False))

def mark_step_done(checkpoint: dict, step: str) -> None:
    checkpoint["completed_steps"].append(step)
    save_checkpoint(checkpoint)

def step_done(checkpoint: dict, step: str) -> bool:
    return step in checkpoint["completed_steps"]
```

**Subprocess call pattern** (from `hvac-kb-tests.py` lines 14-18 for import; craft style from test runner):
```python
# From hvac-kb-tests.py lines 14-18 (subprocess import and SCRIPT_DIR pattern)
SCRIPT_DIR = Path(__file__).parent.resolve()

def run_step(cmd: list[str], step_name: str, dry_run: bool = False) -> bool:
    """Run a pipeline step as subprocess. Returns True on success."""
    if dry_run:
        logger.info(f"[dry-run] Would run: {' '.join(str(c) for c in cmd)}")
        return True
    logger.info(f"Running step: {step_name}")
    result = subprocess.run(cmd, capture_output=False)
    if result.returncode != 0:
        logger.error(f"Step '{step_name}' failed (exit {result.returncode})")
        return False
    return True
```

**pending_review.jsonl write pattern** (from RESEARCH.md Pattern 4 + `hvac_manual_scraper.py` lines 109-113 for JSONL append style):
```python
# Append pattern from hvac_manual_scraper.py save_scraper_manifest_entry (lines 109-113)
PENDING_REVIEW_PATH = REPORTS_DIR / "pending_review.jsonl"

def log_pending_review(rec: dict, reason: str) -> None:
    entry = {
        "catalog_id": rec.get("catalog_id"),
        "brand": rec.get("brand"),
        "model": rec.get("indoor_model") or rec.get("model"),
        "reason": reason,  # "no_scraper_support" | "scrape_failed" | "not_ptbr" | "not_inverter"
        "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }
    PENDING_REVIEW_PATH.parent.mkdir(parents=True, exist_ok=True)
    with PENDING_REVIEW_PATH.open("a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")
```

**Qdrant scroll helper** (copy from `hvac_missing_manuals.py` lines 60-121):
```python
# Exact pattern: _qdrant_headers() + get_indexed_models() from hvac_missing_manuals.py lines 60-121
def _qdrant_headers() -> dict:
    h = {"Content-Type": "application/json"}
    if QDRANT_API_KEY:
        h["Authorization"] = f"Bearer {QDRANT_API_KEY}"
    return h
```

**Startup validation (fail-fast)** — new pattern required, no existing analog:
```python
def validate_environment() -> None:
    """Fail fast if required env vars are absent."""
    if not os.environ.get("QDRANT_API_KEY"):
        print("FATAL: QDRANT_API_KEY not set in environment", file=sys.stderr)
        sys.exit(1)
```

**argparse + dry-run + main pattern** (from `hvac_normalize_inmetro_catalog.py` lines 212-253):
```python
def main() -> None:
    parser = argparse.ArgumentParser(description="HVAC Expansion Pipeline Orchestrator")
    parser.add_argument("--dry-run", action="store_true", help="Simulate pipeline without executing steps")
    parser.add_argument("--reset",   action="store_true", help="Clear checkpoint and restart from step 1")
    parser.add_argument("--from-step", type=str, default=None, help="Override: start from this step name")
    parser.add_argument("--tier1-only", action="store_true", help="Process only LG/Samsung/Daikin")
    args = parser.parse_args()
    ...

if __name__ == "__main__":
    main()
```

**JSONL catalog loader** (copy from `hvac_missing_manuals.py` lines 125-166 — `load_inmetro_catalog()`):
```python
# Lines 125-166 of hvac_missing_manuals.py: load_inmetro_catalog() with brand filter,
# inverter tech filter, and BLACKLISTED_EQUIP_TYPES guard — copy verbatim.
```

---

### `scripts/hvac-rag/hvac_normalize_document.py` (transform/bridge, batch JSONL)

**Primary analog for logic:** `/srv/hvac-pipeline/hvac_normalize.py` (entire file — copy functions)
**Primary analog for JSONL write style:** `scripts/hvac-rag/hvac_normalize_inmetro_catalog.py` lines 212-253
**Primary analog for argparse/main:** `scripts/hvac-rag/hvac_normalize_inmetro_catalog.py`

**Shebang:**
```python
#!/srv/data/hvac-rag/.venv/bin/python3
```

**Imports pattern** (from `hvac_normalize_inmetro_catalog.py` lines 14-26 + `hvac_add_manual.py` lines 19-34):
```python
import argparse
import json
import os
import re
import sys
from pathlib import Path
from datetime import datetime, timezone

# sys.path injection — copy from hvac_add_manual.py lines 27-34
SCRIPTS_DIR = Path("/srv/monorepo/scripts/hvac-rag")
sys.path.insert(0, str(SCRIPTS_DIR))
```

**Core functions to copy verbatim from `/srv/hvac-pipeline/hvac_normalize.py`:**

- `score_language(text)` — lines 16-40: signal-count language detection returning `{language, confidence, method, signals, review_required}`
- `extract_model_candidates(text)` — lines 42-57: regex-based model extraction returning `list[tuple[str, int]]`
- `extract_brand_candidates(text)` — lines 59-68: brand occurrence counting returning `list[tuple[str, int]]`
- `extract_equipment_type(text)` — lines 70-106: keyword + regex equipment type detection
- `extract_error_codes(text)` — lines 108-121
- `detect_doc_type(text)` — lines 123-135

**Core normalize_document function** (from `/srv/hvac-pipeline/hvac_normalize.py` lines 137-199, adapt for standalone use):
```python
# Source: /srv/hvac-pipeline/hvac_normalize.py lines 137-199 (normalize function)
# Key output schema — matches normalized-documents.jsonl verified schema:
def normalize_document(doc_record: dict, md_text: str) -> dict:
    lang_info = score_language(md_text)
    models    = extract_model_candidates(md_text)
    brands    = extract_brand_candidates(md_text)
    eq_types  = extract_equipment_type(md_text)
    codes     = extract_error_codes(md_text)
    doc_type  = detect_doc_type(md_text)

    # Filter garbage from models (from hvac_normalize.py lines 171)
    models = [(m, c) for m, c in models
              if m not in ['DAIKIN', 'DAIKIN EUROPE', 'CARRIER', 'SIEMENS'] and len(m) >= 4]

    reasons = []
    if not models:     reasons.append("no_model_candidates_found")
    if not brands:     reasons.append("no_brand_detected")
    if not eq_types:   reasons.append("equipment_type_unclear")
    if lang_info["review_required"]: reasons.append("language_uncertain")

    status = "normalized" if not reasons else "needs_review"

    return {
        "doc_id":                   doc_record["doc_id"],
        "source_pdf":               doc_record.get("source_pdf", doc_record.get("pdf_path", "")),
        "brand_candidates":         [{"brand": b, "occurrences": c} for b, c in brands[:5]],
        "model_candidates":         [{"model": m, "occurrences": c} for m, c in models[:20]],
        "equipment_type_candidates":[{"type": t, "occurrences": c} for t, c in eq_types[:5]],
        "error_code_candidates":    codes[:50],
        "doc_type":                 doc_type,
        "language":                 lang_info["language"],
        "language_confidence":      lang_info["confidence"],
        "language_method":          lang_info["method"],
        "language_signals":         lang_info["signals"],
        "language_review_required": lang_info["review_required"],
        "normalization_status":     status,
        "review_reasons":           reasons,
        "approved_for_chunking":    status == "normalized",
        "md_path":                  doc_record.get("md_path"),
    }
```

**JSONL write pattern** (from `hvac_normalize_inmetro_catalog.py` lines 244-248):
```python
# From hvac_normalize_inmetro_catalog.py lines 244-248
NORM_DOCS_PATH = Path("/srv/data/hvac-rag/manifests/normalized-documents.jsonl")

def append_normalized(record: dict) -> None:
    """Append one record to normalized-documents.jsonl (does not rewrite)."""
    NORM_DOCS_PATH.parent.mkdir(parents=True, exist_ok=True)
    with NORM_DOCS_PATH.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(record, ensure_ascii=False) + "\n")
```

**JSONL loader for existing documents.jsonl** (from `hvac_add_manual.py` lines 63-66):
```python
# From hvac_add_manual.py lines 63-66 load_manifest()
def load_jsonl(path: Path) -> list[dict]:
    if not path.exists():
        return []
    return [json.loads(line) for line in path.open() if line.strip()]
```

**dry-run + argparse pattern** (from `hvac_normalize_inmetro_catalog.py` lines 212-253):
```python
def main() -> None:
    parser = argparse.ArgumentParser(description="Normalize documents.jsonl → normalized-documents.jsonl")
    parser.add_argument("--dry-run",     action="store_true")
    parser.add_argument("--doc-id",      type=str, default=None, help="Process only this doc_id")
    parser.add_argument("--manifest",    type=str, default=None, help="Override documents.jsonl path")
    parser.add_argument("--output",      type=str, default=None, help="Override normalized-documents.jsonl path")
    args = parser.parse_args()
    ...
    if args.dry_run:
        print(f"[dry-run] Would write {count} records to {NORM_DOCS_PATH}", file=sys.stderr)
        sys.exit(0)
```

---

### `scripts/hvac-rag/hvac_add_manual.py` (MODIFY: add PT-BR check gate)

**Self analog** — modify at the existing file. Pattern to insert:

**Where to insert** — after the `check_inverter()` function (line 117), before `match_inmetro_catalog()` (line 135):

**PT-BR signal constants** (verbatim from `/srv/hvac-pipeline/hvac_normalize.py` lines 6-8):
```python
# Copy these three lists verbatim from /srv/hvac-pipeline/hvac_normalize.py lines 6-8
PT_SIGNALS = ['instalação', 'unidade', 'segurança', 'alimentação', 'refrigeração',
              'advertência', 'figura', 'tabela', 'cuidado', 'precauções', 'aviso',
              'especificação', 'manual de', 'serviço']
ES_SIGNALS = ['instalación', 'unidad', 'seguridad', 'alimentación', 'refrigeración',
              'advertencia', 'figura', 'tabla', 'cuidado', 'precaución', 'aviso',
              'especificación', 'manual de', 'servicio']
EN_SIGNALS = ['installation', 'unit', 'safety', 'power supply', 'refrigerant',
              'warning', 'figure', 'table', 'caution', 'specification',
              'service manual', 'operation', 'usage']
```

**detect_ptbr function** (adapt from `/srv/hvac-pipeline/hvac_normalize.py` `score_language()` lines 16-40):
```python
def detect_ptbr(md_text: str) -> tuple[str, float]:
    """Return (language, confidence) using signal-count method.
    Source: /srv/hvac-pipeline/hvac_normalize.py score_language() lines 16-40."""
    text_lower = md_text.lower()
    scores = {'pt-BR': 0.0, 'es': 0.0, 'en': 0.0}
    for sig in PT_SIGNALS:
        scores['pt-BR'] += text_lower.count(sig)
    for sig in ES_SIGNALS:
        scores['es'] += text_lower.count(sig)
    for sig in EN_SIGNALS:
        scores['en'] += text_lower.count(sig)
    total = sum(scores.values())
    if total == 0:
        return 'unknown', 0.0
    top_lang = max(scores, key=scores.__getitem__)
    confidence = scores[top_lang] / total
    return top_lang, round(confidence, 4)
```

**check_ptbr gate function** (insertion point: after `check_inverter()`, before `match_inmetro_catalog()`):
```python
def check_ptbr(md_text: str, policy: dict) -> tuple[bool, str | None]:
    """Return (allowed, rejection_reason). Rejects only confirmed non-PT manuals.
    Pattern: RESEARCH.md Pattern 3 — bilingual PT+EN/ES manuals must not be rejected."""
    if not policy.get("require_ptbr", False):
        return True, None
    lang, conf = detect_ptbr(md_text)
    if lang == 'pt-BR':
        return True, None
    if lang != 'unknown' and conf >= 0.40:
        return False, f"language_not_ptbr:{lang}({conf:.2f})"
    return True, None   # low-confidence or unknown → accept
```

**Insertion point in `main()`** — add after the `check_inverter` block (lines 274-280), same pattern as the inverter check:
```python
# 4c: PT-BR language check (after inverter hard-lock, same guard pattern as lines 274-280)
if not reject_reason and md_text:
    pt_ok, pt_reason = check_ptbr(md_text, policy)
    if not pt_ok:
        reject_reason = pt_reason or "language_not_ptbr"
        reject_source = "policy_ptbr"
        print(f"  ❌ PT-BR check: {reject_reason}")
```

**pending_review.jsonl write on rejection** — add in the REJECTED write block (after line 455), following the `save_scraper_manifest_entry` append style from `hvac_manual_scraper.py` lines 109-113:
```python
# After writing rejected/*.json record, append to pending_review.jsonl
pending_path = Path("/srv/data/hvac-rag/reports/pending_review.jsonl")
pending_path.parent.mkdir(parents=True, exist_ok=True)
pending_entry = {
    "doc_id": doc_id,
    "pdf_path": str(pdf_path),
    "brand": catalog_match.get("matched_model"),
    "reason": reject_reason,
    "timestamp": ts,
}
with pending_path.open("a", encoding="utf-8") as fh:
    fh.write(json.dumps(pending_entry, ensure_ascii=False) + "\n")
```

---

### `scripts/hvac-rag/hvac_missing_manuals.py` (MODIFY: enriched coverage report)

**Self analog** — modify existing file. Key patterns to add:

**New CLI flag** (add to `main()` argparse block at lines 275-281):
```python
# Add to existing argparse block — same style as existing --dry-run and --brand flags
parser.add_argument(
    "--output-coverage",
    type=str,
    default=None,
    help="Write enriched per-brand coverage table to this .md path"
)
```

**Per-brand summary table generator** (new function, same style as `generate_report()` at lines 170-270):
```python
def generate_coverage_table(
    catalog: list[dict],
    indexed: set[str],
    scraper_brands: set[str],
) -> str:
    """
    Generate Markdown table: brand | INMETRO total | indexed | missing | coverage% | scraper.
    Follow same pattern as generate_report() — build lines list, return "\n".join(lines).
    """
    from collections import defaultdict

    brand_total:   dict[str, int] = defaultdict(int)
    brand_indexed: dict[str, int] = defaultdict(int)

    for rec in catalog:
        brand = (rec.get("brand") or "").lower().strip()
        model_family = (rec.get("model_family") or rec.get("model") or "").lower().strip()
        key = f"{brand}::{model_family}"
        brand_total[brand] += 1
        if key in indexed:
            brand_indexed[brand] += 1

    # Report header style: same as generate_report() lines 199-215
    now = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
    lines = [
        "## Resumo por Marca",
        "",
        f"**Atualizado:** {now}  ",
        "",
        "| Marca | Modelos INMETRO | Indexados | Faltantes | Cobertura | Scraper |",
        "|-------|----------------|-----------|-----------|-----------|---------|",
    ]
    for brand in sorted(brand_total):
        total   = brand_total[brand]
        idx     = brand_indexed.get(brand, 0)
        missing = total - idx
        pct     = round(100 * idx / total, 1) if total else 0.0
        scraper = "OK" if brand in scraper_brands else "pendente"
        lines.append(f"| {brand.upper()} | {total} | {idx} | {missing} | {pct}% | {scraper} |")

    return "\n".join(lines)
```

**Output write pattern** (copy from `generate_report()` output path write at lines 318-320):
```python
# Same as lines 318-320 of hvac_missing_manuals.py
coverage_output = Path(args.output_coverage)
coverage_output.parent.mkdir(parents=True, exist_ok=True)
coverage_output.write_text(coverage_md, encoding="utf-8")
print(f"\n✅ Relatório de cobertura salvo em: {coverage_output}")
```

**Where to add coverage report call in `main()`** — after the existing report generation (line 309), as a second output (not replacing, extending):
```python
# After existing: report_md = generate_report(catalog, indexed, ...)
# Add:
if args.output_coverage:
    coverage_md = generate_coverage_table(
        catalog, indexed,
        scraper_brands={"lg", "samsung", "daikin", "carrier", "springer"}
    )
    ...write to output_coverage path...
```

---

## Shared Patterns

### Env Var Config Block
**Source:** `scripts/hvac-rag/hvac_missing_manuals.py` lines 33-45
**Apply to:** `hvac_expansion_pipeline.py`, `hvac_normalize_document.py`
```python
QDRANT_URL      = os.environ.get("QDRANT_URL", "http://127.0.0.1:6333")
QDRANT_API_KEY  = os.environ.get("QDRANT_API_KEY", "")
COLLECTION_NAME = os.environ.get("HVAC_COLLECTION", "hvac_manuals_v1")
CATALOG_JSONL   = Path(os.environ.get("HVAC_INMETRO_CATALOG",
                       "/srv/data/hvac-rag/catalog/inmetro_ac_br_models.jsonl"))
```

### Qdrant Auth Headers
**Source:** `scripts/hvac-rag/hvac_missing_manuals.py` lines 60-64 (`_qdrant_headers()`)
**Apply to:** `hvac_expansion_pipeline.py` (Qdrant health-check at startup)
```python
def _qdrant_headers() -> dict:
    h = {"Content-Type": "application/json"}
    if QDRANT_API_KEY:
        h["Authorization"] = f"Bearer {QDRANT_API_KEY}"
    return h
```

### JSONL Append Write
**Source:** `scripts/hvac-rag/hvac_manual_scraper.py` lines 109-113 (`save_scraper_manifest_entry()`)
**Apply to:** `hvac_normalize_document.py` (append to normalized-documents.jsonl), `hvac_add_manual.py` (append to pending_review.jsonl), `hvac_expansion_pipeline.py` (append to pending_review.jsonl)
```python
with PATH.open("a", encoding="utf-8") as f:
    f.write(json.dumps(entry, ensure_ascii=False) + "\n")
```

### JSONL Load
**Source:** `scripts/hvac-rag/hvac_add_manual.py` lines 63-66 (`load_manifest()`)
**Apply to:** `hvac_normalize_document.py`, `hvac_expansion_pipeline.py`
```python
def load_jsonl(path: Path) -> list[dict]:
    if not path.exists():
        return []
    return [json.loads(line) for line in path.open() if line.strip()]
```

### dry-run Guard Pattern
**Source:** `scripts/hvac-rag/hvac_normalize_inmetro_catalog.py` lines 235-242
**Apply to:** `hvac_expansion_pipeline.py`, `hvac_normalize_document.py`
```python
if args.dry_run:
    print(f"[dry-run] Would write {count} records to {OUTPUT_PATH}", file=sys.stderr)
    sys.exit(0)
```

### Qdrant Scroll Loop
**Source:** `scripts/hvac-rag/hvac_missing_manuals.py` lines 68-121 (`get_indexed_models()`)
**Apply to:** `hvac_expansion_pipeline.py` (step: get indexed models for batch file generation)
```python
# Full scroll pattern with pagination (offset = next_page_offset), error handling,
# and brand/model_family key format: "brand::model_family" — copy verbatim from lines 68-121.
```

### Timestamp ISO8601
**Source:** `scripts/hvac-rag/hvac_add_manual.py` line 406
**Apply to:** All new files writing JSONL records
```python
ts = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
```

### Markdown Report Lines Pattern
**Source:** `scripts/hvac-rag/hvac_missing_manuals.py` lines 199-270 (`generate_report()`)
**Apply to:** `hvac_missing_manuals.py` new `generate_coverage_table()` function
```python
# Build as list[str], join at end with "\n".join(lines)
# Use f-strings for table rows, append "" for blank lines between sections.
```

### sys.path Injection for Local Imports
**Source:** `scripts/hvac-rag/hvac_add_manual.py` lines 27-29
**Apply to:** `hvac_normalize_document.py` (to import from hvac_normalize if not inlining)
```python
SCRIPTS_DIR = Path("/srv/monorepo/scripts/hvac-rag")
sys.path.insert(0, str(SCRIPTS_DIR))
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `hvac_expansion_pipeline.py` checkpoint mechanism | orchestrator state | file I/O (JSON) | No existing checkpoint pattern in monorepo scripts; the closest subprocess orchestrator is `hvac-kb-tests.py` which has no checkpoint. Pattern sourced from RESEARCH.md. |
| PT-BR language gate in `hvac_add_manual.py` | validation gate | transform | The PT signal wordlist exists in `/srv/hvac-pipeline/hvac_normalize.py` (not in monorepo) but the gate call pattern itself is new. |

---

## Critical Implementation Notes for Planner

1. **Shebang choice:** `hvac_expansion_pipeline.py` and `hvac_normalize_document.py` should use `#!/srv/data/hvac-rag/.venv/bin/python3` (same as `hvac_add_manual.py` line 1) so they run in the venv that has `requests`, `beautifulsoup4`, etc.

2. **hvac_normalize.py functions:** The four extraction functions (`score_language`, `extract_brand_candidates`, `extract_model_candidates`, `extract_equipment_type`) from `/srv/hvac-pipeline/hvac_normalize.py` should be **copied inline** into `hvac_normalize_document.py` rather than imported, because the pipeline path injection is fragile and the source file is outside the monorepo.

3. **hvac_chunk.py is not incremental** (RESEARCH.md Gap 3): The orchestrator must call `hvac_chunk.py` ONCE after all PDFs are normalized, not once per PDF. The planner must model the pipeline as: [loop: add_manual + normalize_document per PDF] → [single call: chunk] → [single call: index_qdrant].

4. **pending_review.jsonl is append-only:** Both `hvac_add_manual.py` (on rejection) and `hvac_expansion_pipeline.py` (brands without scraper support) write to this file. They must use the JSONL append pattern, never overwrite.

5. **TRACKED_BRANDS and SCRAPER_BRANDS:** `hvac_missing_manuals.py` line 48 defines `TRACKED_BRANDS` (12 brands). The orchestrator needs a subset `SCRAPER_BRANDS = {"lg", "samsung", "daikin", "springer", "carrier"}` for batch generation. Brands in TRACKED_BRANDS but not SCRAPER_BRANDS go directly to `pending_review.jsonl`.

6. **Coverage report output path:** `/srv/data/hvac-rag/reports/coverage_report.md` (from CONTEXT.md decisions). The `--output-coverage` flag in `hvac_missing_manuals.py` should default to this path.

---

## Metadata

**Analog search scope:** `/srv/monorepo/scripts/hvac-rag/` (all 35 files), `/srv/hvac-pipeline/hvac_normalize.py`
**Files read:** `hvac_add_manual.py`, `hvac_missing_manuals.py`, `hvac_manual_scraper.py` (lines 1-295), `hvac_reconcile_catalog_qdrant.py`, `hvac_normalize_inmetro_catalog.py`, `hvac_sync_inmetro_catalog.py` (lines 1-80), `hvac-kb-tests.py` (lines 1-60), `/srv/hvac-pipeline/hvac_normalize.py` (lines 1-199)
**Pattern extraction date:** 2026-05-05
