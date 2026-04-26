---
name: SPEC-REVIEW-MONOREPO
description: Review geral enterprise do monorepo Nexus + Hermes + Mem0
status: draft
owner: platform-engineering
created: 2026-04-26
---

# SPEC-REVIEW-MONOREPO — Review Enterprise do Monorepo

## Problema

Precisa de um review geral enterprise de todo o monorepo para identificar:
- Issues de correctness, security, performance
- Dependencies desatualizadas
- Architecture debt
- Code quality score

## Solução

Usar Nexus 7 review agents em paralelo:
1. correctness-reviewer — Logic errors, edge cases
2. readability-reviewer — Naming, complexity
3. architecture-reviewer — Dependencies, layers
4. security-reviewer — OWASP, secrets
5. perf-reviewer — N+1, pagination
6. dependency-auditor — Outdated packages
7. quality-scorer — Aggregate scoring

## Scope

- `/srv/monorepo/` — todos os arquivos core
- Rate limit: 500 RPM (MiniMax M2.7)

## Acceptance Criteria

1. Todos 7 review agents executam sem erro
2. Report gerado com findings categorizados
3. Quality score calculado
4. Arquivo de report salvo em `docs/REVIEW-REPORT-YYYY-MM-DD.md`

## Tech Stack

- Nexus Framework (vibe-kit)
- MiniMax M2.7 (500 RPM)
- mclaude CLI

## Riscos

- Rate limit excedido — mitigated by 500ms delay entre chamadas
- Files muito grandes — mitigated by 4000 char limit per file
