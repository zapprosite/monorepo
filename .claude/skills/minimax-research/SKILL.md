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

O script:
1. Recupera `MINIMAX_API_KEY` do Infisical (vault: dev, project: e42657ef-98b2-4b9c-9a04-46c093bd6d37)
2. Faz POST para `https://api.minimax.io/anthropic/v1/messages`
3. Usa modelo `MiniMax-M2.1` com max_tokens 1024

## Referências

- `references/quick-start.md` — Guia rapido de uso
- `references/api-reference.md` — Referencia da API MiniMax
