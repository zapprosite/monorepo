---
title: Model Manifest
description: Ollama model versions with blob hashes — frozen for deterministic AI inference
created: 2026-05-03
spec: SPEC-210
---

# MODEL_MANIFEST.md

> **Regra:** Nenhum modelo Ollama com tag `:latest`. Versões explícitas sempre.
> **Update:** Somente via PR com hash do novo blob.

---

## Active Models

| Model | Tag | ID | Size | Frozen |
|-------|-----|-----|------|--------|
| Qwen2.5 Coder | `qwen2.5-coder:14b-q6k` | `d36aa1bfdfb0` | 12 GB | ✅ |
| Qwen2.5 VL | `qwen2.5vl:3b` | `fb90415cde1e` | 3.2 GB | ✅ |
| Nomic Embed Text | `nomic-embed-text:latest` | `0a109f422b47` | 274 MB | ⚠️ → frozen as `nomic-embed-text:pinned-20260503` |

---

## Blob Hashes

```bash
# Gerar manifesto completo de blobs:
# ollama list | tail -n+2 | awk '{print $1}' | while read model; do
#   echo "=== $model ==="
#   ollama show "$model" 2>/dev/null | grep -E 'digest|size|modified'
# done
```

---

## Correction Plan

1. `nomic-embed-text:latest` → congelar para versão específica via `ollama pull nomic-embed-text:<version>`
2. Atualizar `docker-compose.rag-pipe.yml` — trocar `HVAC_EMBEDDING_MODEL=nomic-embed-text:latest` por tag fixa
3. Após freeze, remover `:latest` tag do modelo via `ollama cp` + `ollama rm`
