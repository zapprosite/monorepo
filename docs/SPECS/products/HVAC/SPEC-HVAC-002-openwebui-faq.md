---
name: SPEC-HVAC-002
description: HVAC FAQ Knowledge base in Open WebUI — user-facing Q&A retrieval
status: draft
owner: platform
created: 2026-04-27
---

# SPEC-HVAC-002 — HVAC FAQ Open WebUI

## 1. Overview

Surface HVAC equipment information through Open WebUI's Knowledge base as an FAQ assistant. Users ask natural-language questions and get cited answers from the ingested manuals.

**Source:** `hvac-manifest.json` + normalized Markdown from [SPEC-HVAC-001](SPEC-HVAC-001-rag-ingestion.md)
**Destination:** Open WebUI Knowledge collection `hvac-manuals`
**Interface:** Open WebUI Chat with `hvac-manuals` Knowledge attached

---

## 1.1 What Open WebUI IS NOT in this context

This SPEC defines Open WebUI as a **RAG/FAQ UI only**. It explicitly does NOT provide:

- **Shell access** — Open WebUI is not a CLI or terminal interface
- **Commander pattern** — No agentic command routing or skill invocation
- **Public Qdrant proxy** — The Qdrant collection `hvac_chunks` is accessed only through Open WebUI's Knowledge retrieval, not as a public vector API
- **Agent runtime** — No Hermes, Claude, or Codex agents are invoked through this interface

**Boundary:** All RAG retrieval flows through Open WebUI's built-in Knowledge → LLM pipeline. External agents (Hermes, Claude, Codex) read from Qdrant directly per [SPEC-MEM-001](../SPEC-MEM-001-nexus-shared-memory-contract.md), not through Open WebUI.

---

## 2. FAQ Generation

Before surfacing in Open WebUI, generate structured FAQ from the normalized HVAC data:

```python
# scripts/hvac-generate-faq.py
for model in normalized_models:
    faqs = [
        {
            "question": f"How to troubleshoot {model['model']} error code {code}?",
            "answer": lookup_troubleshooting(model, code),
            "equipment_type": model["equipment_type"],
            "model": model["model"]
        }
        for code in model.get("error_codes", [])
    ]
```

Output: `data/hvac/faq/hvac-faq.json`

---

## 3. Open WebUI Knowledge Setup

1. Create Knowledge collection: `hvac-manuals`
2. Upload all normalized Markdown files from `data/hvac/normalized/`
3. Tag strategy:
   - `equipment_type` as knowledge tags
   - `manufacturer` as knowledge tags
   - `model` as document name

---

## 4. FAQ Assistant Configuration

- Model: configured LiteLLM model (per [SPEC-003](../../SPEC-003-memory-rag-llm-stack.md))
- Knowledge: `hvac-manuals` attached
- System prompt: "You are an HVAC equipment assistant. Answer using the attached manuals only. If the information is not in the manuals, say so."
- Citations: enabled (show source page/section)

---

## 5. Acceptance Criteria

1. User can ask "What does error code E001 mean on a Carrier 24ACC636?" and get a cited answer
2. Citations reference the specific manual page, not just the document
3. Questions outside the manual domain get "I don't have that information" (no hallucination)
4. FAQ JSON has ≥50 entries covering error codes and common troubleshooting questions

---

## 6. Related SPECs

- [SPEC-HVAC-001](SPEC-HVAC-001-rag-ingestion.md) — RAG Ingestion (data factory)
- [SPEC-HVAC-003](SPEC-HVAC-003-evaluation-suite.md) — Evaluation Suite (quality measurement)
