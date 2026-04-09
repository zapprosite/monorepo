---
description: Gera PRD completo com Opus. Use `c` para PRD final, `cm` para rascunho rápido.
argument-hint: <descrição da feature>
---

# /plan — Geração de PRD Enterprise

## Modelo recomendado
- Rascunho rápido → `cm` (MiniMax M2.7, barato)
- PRD final → `c` (Claude Opus, máxima qualidade)

## Processo

1. Perguntar:
   - Qual feature/problema?
   - Qual slice alvo? (1=MVP, 2=Core, 3=Enhanced)
   - Qual app afetado? (api/web/workers/perplexity-agent)

2. Ler contexto existente:
   - docs/specflow/SPEC-*.md (specs existentes)
   - tasks/pipeline.json (tasks em andamento)
   - CLAUDE.md (regras do projeto)

3. Gerar docs/specflow/PRD-[slug]-[YYYYMMDD].md
   usando docs/TEMPLATES/PRD-template.md como base

4. Gerar docs/specflow/SPEC-[slug]-[YYYYMMDD].md
   usando docs/TEMPLATES/SPEC-template.md como base

5. Chamar /pg para gerar tasks no pipeline.json

6. Informar ao usuário:
   - path do PRD gerado
   - path do SPEC gerado
   - número de tasks adicionadas ao pipeline.json
