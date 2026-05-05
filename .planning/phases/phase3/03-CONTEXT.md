# Phase 3: Manual Finder e Aquisição Automática - Context

**Gathered:** 2026-05-05
**Status:** Ready for planning

## Boundary

Fechar o ciclo operacional entre coverage faltante e indexação real de manuais. A fase não deve mexer em OpenWebUI nem no modelo público; OpenWebUI segue strict-only com `hvac-manual-strict`.

## Current Assets

- `hvac_missing_manuals.py` gera coverage Markdown e lista marcas com scraper.
- `hvac_expansion_pipeline.py` gera batch e executa scraper/intake/checkpoint.
- `hvac_manual_scraper.py` suporta LG, Samsung, Daikin, Springer e Carrier com BeautifulSoup.
- `hvac_web_search.py` fornece Tavily API, Tavily MCP, DuckDuckGo Lite e Google News RSS.
- `hvac_manual_downloader.py` existe, mas é placeholder.
- `hvac_add_manual.py` é o gate canônico de ingestão.
- `pending_review.jsonl` registra marcas/modelos que precisam de revisão.

## Decisions

- Criar `hvac_manual_finder.py` como CLI canônico.
- Não confiar em URL sem baixar e validar PDF.
- Priorizar fonte oficial: domínio do fabricante > suporte local BR > PDF direto > outras fontes.
- Toda falha deve virar entrada rastreável em `pending_review.jsonl`.
- Finder deve ser idempotente e não duplicar PDFs já baixados/indexados.

## Proposed Pipeline

```text
coverage/missing catalog
  -> build search queries
  -> web search providers
  -> rank official URLs
  -> download candidate PDFs
  -> hvac_add_manual.py --dry-run
  -> hvac_add_manual.py --index when accepted
  -> update coverage report
  -> pending_review for failures
```

## Out of Scope

- Browser-use completo com login em portal fechado.
- UI visual para seleção de candidatos.
- OCR/vision de placas.
