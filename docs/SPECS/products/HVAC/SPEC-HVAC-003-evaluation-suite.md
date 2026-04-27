---
name: SPEC-HVAC-003
description: HVAC RAG evaluation suite — measure retrieval precision, recall, and answer quality
status: draft
owner: platform
created: 2026-04-27
---

# SPEC-HVAC-003 — HVAC Evaluation Suite

## 1. Overview

Measure the quality of the HVAC RAG pipeline in terms of retrieval and answer quality.

**Benchmark dataset:** `data/hvac/eval/ground-truth.jsonl`
**Metrics:** Precision@K, Recall@K, MRR, Answer faithfulness, Citation accuracy
**Baseline:** Human evaluation on 20 question pairs

---

## 2. Eval Questions

From `hvac-faq.json` (SPEC-HVAC-002), extract:
- 30 question-answer pairs for automated eval
- 20 held-out pairs for human eval

```json
{
  "question": "How to reset error E001 on Carrier 24ACC636?",
  "expected_chunks": ["page 12", "page 15"],
  "expected_answer_contains": ["reset button", "hold 5 seconds"],
  "difficulty": "easy|medium|hard"
}
```

---

## 3. Metrics

| Metric | Definition | Target |
|--------|------------|--------|
| `precision@3` | Relevant chunks in top-3 / 3 | ≥ 0.8 |
| `recall@5` | Relevant chunks in top-5 / total relevant | ≥ 0.85 |
| `mrr` | Mean Reciprocal Rank of first relevant chunk | ≥ 0.75 |
| `answer_faithfulness` | % of answer claims verifiable in retrieved chunks | ≥ 0.9 |
| `citation_accuracy` | % of citations that support the claim | ≥ 0.95 |

---

## 4. Evaluation Script

```bash
# scripts/hvac-eval.py
python hvac-eval.py \
  --questions data/hvac/eval/ground-truth.jsonl \
  --manifest data/hvac/manifests/latest.json \
  --qdrant-url http://localhost:6333 \
  --output data/hvac/reports/eval-$(date +%Y%m%d).json
```

---

## 5. Reporting

- **Automated:** Run eval after each ingest batch (CI gate)
- **Dashboard:** JSON report → Grafana panel (TBD)
- **Grafana panel:** `Panel: HVAC RAG Quality` in homelab observability dashboard

---

## 6. Acceptance Criteria

1. Eval script exits 0 and outputs JSON with all 5 metrics
2. All 5 metrics meet targets (see table above) on the 30 automated eval questions
3. Citation accuracy ≥ 95% on human eval set
4. Eval is rerunnable: same manifest + same questions → same results

---

## 7. Related SPECs

- [SPEC-HVAC-001](SPEC-HVAC-001-rag-ingestion.md) — RAG Ingestion
- [SPEC-HVAC-002](SPEC-HVAC-002-openwebui-faq.md) — FAQ Open WebUI
- [SPEC-003](../../SPEC-003-memory-rag-llm-stack.md) — Memory RAG LLM Stack (evaluation framework)
