# MiniMax Research - Quick Start

## Uso basico

```bash
bash scripts/cursor-loop-research-minimax.sh "your research question"
```

## Exemplos

### Analise de erro

```bash
bash scripts/cursor-loop-research-minimax.sh "TypeError: Cannot read property 'map' of undefined at transformer.ts:45"
```

### Arquitetura

```bash
bash scripts/cursor-loop-research-minimax.sh "Compare the Fastify vs Express patterns in apps/api"
```

## Output esperado

```
=== MiniMax Research Agent ===
Query: How does the auth middleware work?

Analysis:
- Root cause: Token validation happens in middleware/auth.ts
- Location: apps/api/src/middleware/auth.ts:23
- Pattern: JWT verification using @fastify/jwt
- Related: apps/api/src/routes/auth.ts for token generation
- Suggested: Add rate limiting to prevent brute force

Recommendation: Implement token refresh mechanism
```

## Variaveis de ambiente

O script sourceia `.env` na mesma directoria. Secrets syncados do Infisical para .env.

| Variavel | Descricao |
|----------|-----------|
| `MINIMAX_API_KEY` | Token da API MiniMax (synced from Infisical) |

**Nota:** Se `MINIMAX_API_KEY` não estiver em `.env`, o script retorna erro com hint.
