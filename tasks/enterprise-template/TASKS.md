# TASKS — Enterprise Template 2026-04

## Overview

Polir monorepo como template enterprise 04/2026.
Não implementar nada agora — apenas SPEC + pipeline + task breakdown.

---

## Task Breakdown

### PHASE -1: Git Preflight & Sync

| ID | Title | Agent | Nexus Mode | Status | Risk | Depends |
|----|-------|-------|------------|--------|------|---------|
| T00 | Git preflight verification | Hermes | preflight | completed | none | — |
| T01 | Push feature branch to remote | Hermes | sync | completed | low | T00 |

**Rationale:** 1 commit ahead of origin/main must be pushed before any plan work.

---

### PHASE 0: SPEC Creation

| ID | Title | Agent | Nexus Mode | Status | Risk | Depends |
|----|-------|-------|------------|--------|------|---------|
| T02 | Freeze current plan context | Nexus | plan_only | completed | none | T01 |
| T03 | Create SPEC-ENTERPRISE-TEMPLATE-2026-04 | Nexus | plan_only | completed | none | T02 |

**T02 — Freeze Current Plan Context**
- Reaproveitar análise existente
- NÃO reler apps/packages
- NÃO refazer auditoria profunda
- Documentar que pipeline enterprise depende do main pós-merge

**T03 — SPEC Scope:**
1. **Audit scope** — o que foi auditado previamente (SPEC-091, SPEC-093, AGENTS.md)
2. **Identity/license** — branding, LICENSE, NOTICE, CONTRIBUTING
3. **Workspace/tooling** — EditorConfig, .tool-versions, devcontainer
4. **Docs drift** — detectar docs desatualizados vs código
5. **CI/security gates** — pre-commit hooks, secret scanning, dependency review
6. **Dependency alignment** — versions across packages/apps
7. **Enterprise template scaffolding** — template files para novos projetos

---

### PHASE 1: Task Breakdown

| ID | Title | Agent | Nexus Mode | Status | Risk | Depends |
|----|-------|-------|------------|--------|------|---------|
| T04 | Create task breakdown | Nexus | plan_only | completed | none | T03 |

**T04 — Cada task deve ser:**
- Pequena (< 4h de trabalho)
- Reversível (pode fazer rollback)
- Escopada por PR (1 task = 1 PR)
- Sem mudanças em runtime
- Sem updates de dependências

---

### PHASE 2: Pipeline JSON

| ID | Title | Agent | Nexus Mode | Status | Risk | Depends |
|----|-------|-------|------------|--------|------|---------|
| T05 | Create pipeline.json | Nexus | plan_only | completed | none | T04 |

**T05 — Entregável:**
- depends_on explícito em cada task
- Gates humanos antes de qualquer mudança real
- Nenhum comando de execução (pnpm, docker, etc)

---

### PHASE 3: Human Review

| ID | Title | Agent | Nexus Mode | Status | Risk | Depends |
|----|-------|-------|------------|--------|------|---------|
| T06 | Human review gate | Hermes | review | completed | none | T05 |

---

## Constraints

### NÃO EXECUTAR (nunca)
- pnpm install / pnpm update / pnpm build / pnpm test
- git merge / git rebase / git reset / git push (exceto T01)
- docker / coolify / terraform / ufw / systemctl / zfs
- Acesso a secrets ou .env

### SEMPRE
- Modo PLAN_ONLY
- ler apenas docs/SPECS, CLAUDE.md, AGENTS.md
- Ignorar apps/** e packages/** para análise
- Gates humanos antes de implementação

---

---

### PHASE 4: Implementation

| ID | Title | Agent | Nexus Mode | Status | Risk | Depends |
|----|-------|-------|------------|--------|------|---------|
| T07 | Identity & License | Nexus | plan_only | completed | low | T06 |
| T08 | Workspace & Tooling | Nexus | plan_only | completed | low | T07 |
| T09 | Documentation Drift | Nexus | plan_only | completed | low | T08 |
| T10 | CI/CD & Security Gates | Nexus | plan_only | completed | low | T09 |
| T11 | Dependency Alignment | Nexus | plan_only | completed | low | T10 |
| T12 | Enterprise Template Scaffolding | Nexus | plan_only | completed | low | T11 |

**Constraints for all implementation tasks:**
- Modo PLAN_ONLY até human gate
- Não modificar código existente
- Não adicionar dependências
- Templates apenas — sem automação de runtime

---

## Next Step

Executar implementação após approval:

```bash
nexus.sh --spec SPEC-ENTERPRISE-TEMPLATE-2026-04 --phase review
```
