---
plan: 03-02
status: complete
completed: 2026-05-06
---

# Plan 03-02 Summary - Busca Web Oficial e Ranking

## Mudanças Realizadas

- `scripts/hvac-rag/hvac_manual_finder.py` agora aceita `--search` para buscar e ranquear candidatos de manual.
- Adicionado suporte best-effort a Tavily via `TAVILY_API_KEY` e DuckDuckGo HTML sem nova dependência obrigatória.
- Ranking preserva prioridade para domínios oficiais de fabricantes e PDFs.
- Seed oficial por fabricante garante ordenação oficial-first quando o provedor externo falha ou retorna poucos resultados.

## Verificação

```bash
python3 scripts/hvac-rag/hvac_manual_finder.py --search "Samsung AR12CVHZAWK manual"
pytest tests/hvac-rag/test_manual_finder.py
```

Resultado: primeiro candidato em `samsung.com`; testes focados passaram.

## Desvios do Plano

Nenhum bloqueador. Tavily depende de `TAVILY_API_KEY` no ambiente; sem chave, o fluxo usa DuckDuckGo/fallback oficial.

## Self-Check: PASSED
