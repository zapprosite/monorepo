---
name: minimax-research
description: Research agent using MiniMax LLM for monorepo code/error analysis
trigger: /minimax-research
---

# MiniMax Research Agent

## Objetivo

Perform deep code analysis, error investigation, and architectural research using MiniMax M2.1 via `cursor-loop-research-minimax.sh`.

## Quando usar

- Analisar erros complexos no monorepo (TypeErrors, runtime crashes)
- Investigar arquitetura de codigo (padrões Fastify, ORM, etc.)
- Pesquisa rapida sobre codigo ou APIs

**Nao usar** para seguranca (use `/security-audit`) ou reviews genericos (use `/review`).

## Como executar

### Erro/Analise de codigo

```
/minimax-research TypeError: Cannot read property 'map' of undefined at transformer.ts:45
```

### Arquitetura

```
/minimax-research Compare the Fastify vs Express patterns in apps/api
```

### Query livre

```
/minimax-research How does the auth middleware work?
```

## Output esperado

Retorna analise estruturada:
- **Root cause** (para erros)
- **Code locations** com caminhos completos
- **Suggested fixes**
- **Related patterns** no codebase

## Script subjacente

```bash
bash scripts/cursor-loop-research-minimax.sh "<query>"
```

**Fluxo de secrets (.env canonical):**
1. `cursor-loop-research-minimax.sh` sourceia `.env` na mesma directoria
2. `.env` é a fonte canónica — segredos são sync'd from Infisical by external process
3. Se `MINIMAX_API_KEY` not in `.env` → erro com hint para configurar
4. **NUNCA usar Infisical SDK diretamente em scripts**

**NUNCA usar Infisical SDK directly in scripts.** Usar o padrão `.env canonical`.

## Referências

- `references/quick-start.md` — Guia rapido de uso
- `references/api-reference.md` — Referencia da API MiniMax
