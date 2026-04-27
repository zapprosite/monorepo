# SPEC-HVAC-001 — Task Queue

**Spec:** [SPEC-HVAC-001](../../docs/SPECS/products/HVAC/SPEC-HVAC-001-rag-ingestion.md)
**Pipeline:** [pipeline.json](pipeline.json)
**Task breakdown:** [TASKS.md](TASKS.md)

## Quick Start

```bash
# Setup
make hvac-setup

# Full pipeline
make hvac-ingest

# Validate
make hvac-validate

# Index to Open WebUI + Qdrant
make hvac-index
```

## Nexus Workflow

```bash
# Plan
nexus.sh --spec SPEC-HVAC-001 --phase plan

# Review
nexus.sh --spec SPEC-HVAC-001 --phase review

# Execute (13 tasks, 15 workers)
nexus.sh --spec SPEC-HVAC-001 --phase execute --parallel 15

# Verify
nexus.sh --spec SPEC-HVAC-001 --phase verify

# Complete
nexus.sh --spec SPEC-HVAC-001 --phase complete
```

## Task Count: 13

| Phase | Tasks |
|-------|-------|
| Setup | T01–T05 |
| Core Scripts | T10–T14 |
| Automation | T20–T22 |

## Prerequisites

- Python ≥ 3.11
- `pip install docling litellm`
- `apt install jq`
- Open WebUI + Qdrant (for indexing)

## Data Directory

```
data/hvac/
  pdfs/         # Source PDFs (TBD — user to provide path)
  sha256/       # sha256 hashes of processed PDFs
  normalized/   # HVAC-normalized JSON output
  chunks/       # RAG-ready text chunks
  manifests/    # hvac-manifest.json
  reports/      # Validation + eval reports
```
