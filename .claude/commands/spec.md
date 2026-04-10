---
description: Fluxo spec-driven completo: PRD → SPEC → ADRs → Pipeline
argument-hint: <feature-description>
---

# /spec — Spec-Driven Development Workflow

Fluxo completo para transformar uma ideia em tasks executáveis em 5 passos.

## Modelo por fase
- PRD draft → `cm` (MiniMax M2.7)
- PRD final + SPEC → `c` (Claude Opus)

## Fluxo (automático sempre)

### 1. PRD
Gerar PRD em `docs/PRDs/YYYY-MM-DD-nome.md` usando `docs/TEMPLATES/PRD-template.md`

### 2. SPEC
Gerar SPEC em `docs/specflow/SPEC-NNN-nome.md` usando `docs/specflow/SPEC-TEMPLATE.md`

### 3. ADRs (Task Slices)
Cada slice do SPEC gera um ADR em `docs/ADRs/NNN-slice-name.md`:
- Must Have → ADR-001-NNN-mvp.md
- Should Have → ADR-002-NNN-should.md
- Could Have → ADR-003-NNN-could.md

### 4. Pipeline
Executar `/pg` para gerar `tasks/pipeline.json`

### 5. TaskMaster (futuro)
Usar taskmaster-ai MCP quando disponível.

## Argumentos
- `<descrição>`: gera PRD + SPEC + ADRs + pipeline.json automaticamente

## Exemplos
```
/spec autenticação OAuth Google
/spec pipeline CI/CD com Gitea Actions
/spec dashboard monitoring com Grafana
```

## Modelo de usage
- `cm` para rascunho rápido ( MiniMax M2.7 )
- `c` para PRD final e SPEC ( Claude Opus )
