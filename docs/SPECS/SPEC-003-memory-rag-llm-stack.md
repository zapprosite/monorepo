---
spec_id: SPEC-003
title: Memory RAG LLM Stack
status: active
date: 2026-04-24
owner: Platform Engineering
supersedes:
  - SPEC-074
  - SPEC-092
  - SPEC-120
  - SPEC-121
  - SPEC-122
  - SPEC-130
  - docs/SPECs/SPEC-3LAYER-MEMORY
  - docs/SPECs/SPEC-VIBE-BRAIN-REFACTOR
---

# SPEC-003: Memory RAG LLM Stack

## Objective

Hermes needs three separate knowledge layers. Mixing them caused drift and
debug loops. The active stack is:

1. Repo docs as source of truth.
2. Qdrant/Trieve as retrieval.
3. Mem0/Qdrant as dynamic working memory.
4. LiteLLM/Ollama as reasoning and embedding infrastructure.

## Layer Contract

| Layer | Stores | Does not store | Canonical path/service |
|---|---|---|---|
| Repo | Specs, ADRs, runbooks, tasks | Session chatter, secrets | `/srv/monorepo`, second brain repo |
| RAG | Indexed docs/chunks | Preferences, secrets | Trieve + Qdrant |
| Memory | Preferences, recent state, summaries | Canonical facts, secrets | Mem0 + Qdrant |
| Reasoning | No durable data by default | Secrets in prompts/logs | LiteLLM + Ollama |

## Active Services

| Service | Purpose | Config |
|---|---|---|
| Qdrant | Vector DB for RAG and memory | `QDRANT_URL`, `QDRANT_API_KEY` |
| Trieve | RAG datasets and hybrid search | `TRIEVE_URL`, `TRIEVE_API_KEY`, `TRIEVE_DEFAULT_DATASET_ID` |
| Mem0 | Dynamic memory facade | `MEM0_*`, Qdrant backend |
| Ollama | Local embeddings/models | `OLLAMA_URL`, `OLLAMA_EMBED_MODEL` |
| LiteLLM | Provider gateway | `LITELLM_LOCAL_URL`, `LITELLM_MASTER_KEY` |
| AI Gateway | OpenAI-compatible facade | `AI_GATEWAY_*` |

## Known Issues

| Issue | Current evidence | Required fix |
|---|---|---|
| Embedding dimension drift | `.env.example` says 768, code uses 1024 in `mem0/embeddings.ts` and `qdrant/client.ts` | Pick one model/dimension and enforce it in code/env/docs |
| Old result specs contain operational secrets | Historical SPEC-121/122 had values copied from `.env` | Keep values redacted and scan docs/tasks |
| Trieve endpoints are implemented but not health-gated | `rag-instance-organizer.ts` catches failures and returns empty context | Add `/health/rag` or startup warning |
| LiteLLM MiniMax API base drift | Old docs mention path duplication | Keep API base host-only in env docs |
| Memory fallback pseudo-embedding can hide outages | Fallback preserves function but degrades retrieval quality | Emit metric/log and expose degraded status |

## Canonical Embedding Decision

Until measured otherwise, use `embedding-nomic` with dimension from env:

- `LITELLM_EMBEDDING_MODEL=embedding-nomic`
- `LITELLM_EMBEDDING_DIM=768`
- `QDRANT_VECTOR_DIM=768`
- `OLLAMA_EMBED_MODEL=nomic-embed-text`

If the runtime model returns a different vector size, fail fast during collection
init instead of silently creating mismatched collections.

## Acceptance Criteria

- One embedding dimension is enforced across env, Qdrant collection creation, and tests.
- RAG and Mem0 are documented as separate layers.
- `rag-instance-organizer` has health visibility.
- Memory writes do not persist secrets or raw credentials.
- All retrieval tasks can be replayed from repo docs plus `tasks/pipeline.json`.

