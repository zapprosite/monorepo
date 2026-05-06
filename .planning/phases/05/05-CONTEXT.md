# Phase 05: Implementação Dual-Index Semantic Bridge - Context

**Gathered:** 2026-05-06
**Status:** Ready for planning
**Mode:** Technical Prep (Pre-Autonomous)

<domain>
## Phase Boundary

Implementar o sistema de recuperação em dois estágios (Dual-Index) para o ecossistema HVAC Inverter. O objetivo é usar uma camada de FAQ (Top 50 questões geradas por LLM) como ponte semântica para intenções do usuário, seguida por uma recuperação de evidências técnicas no índice bruto (Raw Manuals).

**Objetivos Chave:**
1. Gerar e indexar FAQs técnicos de alta fidelidade para cada manual.
2. Refatorar o `hvac_rag_pipe.py` para realizar busca híbrida/dual.
3. Garantir 100% de citações verificáveis (grounding).
</domain>

<decisions>
## Implementation Decisions

### Arquitetura de Índices
- **Índice FAQ**: Coleção Qdrant `hvac_manuals_faq`. Contém pares Pergunta/Resposta + metadados de página/modelo.
- **Índice Raw**: Coleção Qdrant `hvac_manuals_v1` (já existente). Contém o texto bruto extraído via Docling.

### Fluxo de Recuperação
1. **Fase 1 (Intenção)**: Busca semântica no `hvac_manuals_faq`.
2. **Fase 2 (Evidência)**: Recuperação de chunks relacionados no `hvac_manuals_v1` baseada nos resultados da Fase 1 (modelo e página).

### Geração de FAQ
- Usar Qwen2.5-27B (Local) via Nexus para gerar as Top 50 questões de serviço por manual processado.
</decisions>

<code_context>
## Existing Code Insights
- `scripts/hvac-rag/hvac_manual_enrich.py`: Base para extração e enriquecimento.
- `scripts/hvac-rag/hvac_rag_pipe.py`: Atual orquestrador de busca.
- `scripts/hvac-rag/hvac_normalize_document.py`: Limpeza de layout Docling.
</code_context>

<specifics>
## Specific Requirements
- O FAQ deve incluir códigos de erro, especificações de sensor, pressões de trabalho e procedimentos de teste.
- Metadados devem ser preservados entre os índices para garantir o "link" (ex: `manual_id`, `model`, `page`).
</specifics>

<deferred>
## Deferred Ideas
- Preview visual de PDF (Phase UI futura).
- Feedback loop de usuário real para o índice FAQ.
</deferred>
