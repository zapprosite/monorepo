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

O script usa Infisical automaticamente. Para debug local:

| Variavel | Descricao |
|----------|-----------|
| `MINIMAX_API_KEY` | Override: usa este token em vez de buscar no vault |
| `INFISICAL_TOKEN` | Override: usa este token Infisical em vez do service-token |

**Nota:** Em producao, o script usa `infisical.service-token` em `/srv/ops/secrets/`.
