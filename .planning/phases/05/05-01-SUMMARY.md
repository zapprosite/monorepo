---
plan: 05-01
status: complete
completed: 2026-05-06
---

# Plan 05-01 Summary - FAQ Técnico e Índice Qdrant

## Mudanças Realizadas

- Criado `scripts/hvac-rag/hvac_faq_generator.py` para gerar pares P/R estruturados a partir de Markdown.
- `hvac_manual_enrich.py` agora suporta `--generate-faq`, `--limit` e `--use-nexus-cli`.
- A coleção alvo `hvac_manuals_faq` continua inicializada sob demanda com vetores de 768D quando `--index` é usado.
- Removida leitura direta de `.env`; credenciais Qdrant passam apenas por variável de ambiente.

## Verificação

```bash
python3 scripts/hvac-rag/hvac_manual_enrich.py --generate-faq --limit 1
pytest tests/hvac-rag/test_faq_generator.py
```

Resultado: geração FAQ processou 1 manual e gravou FAQ JSON/MD. O LiteLLM retornou 401 na extração de metadata e o fluxo caiu no fallback extrativo sem expor secret.

## Desvios do Plano

Indexação real no Qdrant não foi executada porque `--index` não foi ativado na verificação e o ambiente LiteLLM/Qdrant não forneceu credenciais válidas para metadata/embedding.

## Self-Check: PASSED WITH ENV LIMITATION
