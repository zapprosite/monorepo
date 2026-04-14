---
name: review-minimax
description: Holistic PR review using MiniMax 1M context — full diff + SPECs + review history, 5-axis analysis
trigger: /mxr
---

# Review MiniMax

## Objetivo

Deep code review of PRs using MiniMax M2.7's 1M token context — analyze 30+ file diffs alongside linked SPECs and review history without chunking.

## Quando usar

- Reviewing PRs with 10+ changed files
- Need TypeScript deep analysis (generics, discriminated unions, type drift)
- Want PR description auto-generated in conventional commits format
- Tracking recurring review issues across PRs

**Complementa:** `/review` (per-file) + `/sec` (security parallel).

## Como usar

```
/mxr
/mxr [PR_NUMBER]
/mxr --commit [HASH]
```

Example:
```
/mxr 42
/mxr --commit abc1234
```

## Fluxo

```
/mxr [PR_NUMBER]
  -> Coleta:
      git diff main...HEAD (ou diff do PR via Gitea API)
      SPECs linkados (por referencia em commits)
      reviews/review-log.jsonl (historico de issues recorrentes)
  -> MiniMax analisa (5 axes):
      1. Correctness — TypeScript deep (infer, generics, discriminated unions)
      2. Readability — naming, structure
      3. Architecture — module boundaries, dependency direction
      4. Security — Infisical SDK, protectedProcedure, secrets
      5. Performance — N+1 queries, missing indexes
  -> Output:
      docs/SPECS/reviews/REVIEW-<N>.md
      PR description draft (conventional commits)
      Flag: breaking changes propagation
```

## Output esperado

```
REVIEW-042.md com:
  - 5-axis findings
  - Governance violations (Infisical SDK, immutable services)
  - PR description draft
  - Recurring issues flagged (cross-referenced com review-log.jsonl)
```

## Bounded context

**Faz:**
- Analisa PRs com 30+ arquivos sem chunking (1M tokens)
- TypeScript type system deep analysis
- Governance rule enforcement (SPEC-034 governance rules)
- Gera PR description em conventional commits format

**Nao faz:**
- Nao e gate automatico de CI (e manual — nao integrado em code-review.yml atualmente)
- Nao aprova/rejeita PRs automaticamente
- Nao modifica codigo

## Nota de integracao CI

`/mxr` e um comando manual nesta versao. Integracao com `.gitea/workflows/code-review.yml` esta pendente (SPEC-034 Review: I-4).

## Dependencias

- `MINIMAX_API_KEY` em Infisical vault
- `reviews/` directory para `review-log.jsonl` (criar se nao existir)
- Endpoint: `https://api.minimax.io/anthropic/v1`
- Modelo: MiniMax-M2.7 (1M token context)

## Referencias

- SPEC-034: `docs/SPECS/SPEC-034-minimax-agent-use-cases.md` (Code Review section)
- SPEC-034 Review: I-4 (CI integration gap), S-1 (AC-5 circular), S-4 (chunking fallback)
