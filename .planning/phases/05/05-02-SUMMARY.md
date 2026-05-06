---
plan: 05-02
status: complete
completed: 2026-05-06
---

# Plan 05-02 Summary - Busca Dual FAQ -> Raw Manual

## Mudanças Realizadas

- `search_qdrant` foi preservado como entrypoint compatível e agora delega para `orchestrate_dual_search`.
- Criado `search_qdrant_raw` para busca no índice bruto `hvac_manuals_v1`.
- Criado `search_qdrant_faq` para busca no índice de intenção `hvac_manuals_faq`.
- Criado `orchestrate_dual_search(query)` com fluxo FAQ primeiro e recuperação de prova real no índice bruto.
- Adicionado `--query` no script para smoke de busca dual via CLI.

## Verificação

```bash
python3 scripts/hvac-rag/hvac_rag_pipe.py --query "Como testar sensor de descarga LG Inverter?"
pytest tests/hvac-rag/test_rag_dual_search.py
```

Resultado: testes unitários passaram. O smoke CLI executou, mas o backend de embeddings em `:4018` retornou HTTP 400 e não retornou hits.

## Desvios do Plano

A citação de página correta não pôde ser validada no ambiente atual porque a busca depende do serviço de embeddings/Qdrant operacional.

## Self-Check: PASSED WITH ENV LIMITATION
