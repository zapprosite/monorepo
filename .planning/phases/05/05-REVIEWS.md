---
phase: 05
reviewers: [nexus, opencode]
reviewed_at: 2026-05-06T09:49:57Z
plans_reviewed: [05-01-PLAN.md, 05-02-PLAN.md]
---

# Cross-AI Plan Review — Phase 05

## Nexus Review

### Summary

Phase 05 has a clear dual-index architecture: `05-01` builds the FAQ intent layer and `05-02` routes queries through FAQ first, then raw manual evidence. The split is coherent and directly supports the Semantic Bridge goal. The main gaps are not conceptual; they are operational and verification-related: consistency between indexes, metadata guarantees, fallback behavior, poisoning/injection risk, and observability are under-specified.

### Strengths

- Clear separation between FAQ intent retrieval and raw manual evidence retrieval.
- The plan keeps source-of-truth evidence in `hvac_manuals_v1` instead of treating generated FAQ answers as final proof.
- The use of `manual_id`, model and page metadata is the right linking mechanism between indexes.
- The verification path includes a realistic CLI smoke for a technician-style query.

### Concerns

- HIGH: The plans do not define a strong consistency contract between FAQ points and raw manual chunks. A stale FAQ intent can route to missing or outdated evidence.
- HIGH: Generated FAQ content can introduce hallucinated technical values unless every FAQ answer stores provenance and is validated against source chunks before indexing.
- HIGH: There is no explicit protection against index poisoning or prompt injection entering through generated FAQ payloads.
- MEDIUM: `05-01` says Qdrant upsert with 768D vectors, but the verification does not require proving collection schema, point count, payload fields or embedding dimension.
- MEDIUM: `05-02` does not specify fallback behavior when FAQ search is empty, low-confidence, or references a missing manual.
- MEDIUM: Page/chunk citation fidelity is not fully covered until the missing `05-03` validation plan.
- LOW: Observability is missing for FAQ hit score, raw evidence score, fallback rate, and bridge latency.

### Suggestions

- Add a validation gate before FAQ indexing: each FAQ answer must include `manual_id`, `source_md` or `source_pdf`, page/chunk metadata when available, and a source excerpt.
- Add a Qdrant schema smoke: verify collection exists, vector size is 768, and at least one inserted point has the required payload keys.
- Add confidence thresholds: if FAQ score is below threshold or linked evidence returns empty, fall back to raw search and label evidence as degraded.
- Add sanitization for generated FAQ payloads before indexing to reduce prompt-injection and poisoning risk.
- Add metrics/logging for `faq_hits`, `raw_hits`, `faq_to_raw_link_used`, `fallback_reason`, and embedding/backend failures.
- Promote `05-03` from roadmap placeholder into a real plan covering grounding, citation page checks, and adversarial/no-evidence queries.

### Risk Assessment

Overall risk: MEDIUM-HIGH until `05-03` exists and passes. The architecture is sound, but production correctness depends on metadata fidelity, Qdrant schema validation, backend health, and grounding tests. The highest risk is a generated FAQ becoming an unverified authority instead of a routing bridge.

## OpenCode Review

OpenCode was available and invoked, but produced no output after the timeout window. The process was terminated and recorded as reviewer timeout.

## Consensus Summary

- The plan direction is valid.
- The bridge must treat FAQ as intent only, never as final technical authority.
- The missing executable plan is `05-03`: final grounding, citation and no-hallucination validation.
- Before shipping, add schema/metadata verification and fallback behavior tests around FAQ -> raw manual retrieval.
