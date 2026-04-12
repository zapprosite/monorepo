---
name: SPEC-030-AGENTS-MD-TOP-LINKS
description: Auditoria lenta de todos os docs/*.md — identificar docs críticos para linkar no topo do AGENTS.md
status: COMPLETED
priority: critical
author: will-zappro
date: 2026-04-12
specRef: SPEC-029-INFISICAL-SDK-MANDATORY.md
---

# SPEC-030 — AGENTS.md Top Links Audit

## Objective

Auditar todos os ficheiros `.md` no repositório para identificar documentos críticos que devem ser linkados no topo do `AGENTS.md` como **⚠️ OBRIGATÓRIO PARA TODOS OS LLMs**. Evitar que LLMs alucinhem, usem tokens hardcoded, ou ignorem políticas importantes.

---

## Contexto

Já foi adicionado ao topo do `AGENTS.md`:
- `SECRETS-MANDATE.md` 🔴 CRÍTICO
- `GUARDRAILS.md` 🔴 CRÍTICO
- `CONTRACT.md` 🟡 ALTA
- `.claude/CLAUDE.md` 🟡 ALTA

Precisa-se de uma auditoria completa para garantir que **nenhum documento crítico está a faltar**.

---

## Technical Approach

### Fase 1: Scan (12 agents em paralelo)

Categorizar todos os `.md` por relevância para LLM e linkar no topo:

| Cluster | Files | Agent |
|---------|-------|-------|
| **GOVERNANCE** (security/policies) | CONTRACT, GUARDRAILS, SECRETS-MANDATE, APPROVAL_MATRIX, CHANGE_POLICY | Agent-1 |
| **GOVERNANCE** (infrastructure) | IMMUTABLE-SERVICES, PINNED-SERVICES, LOCKED-CONFIG, DUPLICATE-SERVICES-RULE | Agent-2 |
| **GOVERNANCE** (operations) | INCIDENTS, RECOVERY, DATABASE_GOVERNANCE, ANTI-FRAGILITY | Agent-3 |
| **GOVERNANCE** (credentials) | MASTER-PASSWORD-PROCEDURE, SECRETS_POLICY, EXCEPTIONS | Agent-4 |
| **GOVERNANCE** (quick-ref) | QUICK_START, DOCUMENTATION_MAP | Agent-5 |
| **SPECS** (critical stack) | SPEC-009 (audio stack), SPEC-023 (monitoring), SPEC-024 (monorepo) | Agent-6 |
| **SPECS** (other active) | SPEC-022, SPEC-025, SPEC-026, SPEC-027, SPEC-028 | Agent-7 |
| **GUIDES** (critical) | INFISICAL-SDK-PATTERN, CODE-REVIEW-GUIDE, discovery | Agent-8 |
| **REFERENCE** (architecture) | ARCHITECTURE-MASTER, ARCHITECTURE-MODELS, AI-CONTEXT | Agent-9 |
| **REFERENCE** (tools) | TOOLCHAIN, CLI-SHORTCUTS, WORKFLOW | Agent-10 |
| **INCIDENTS** (if critical) | CONSOLIDATED-PREVENTION-PLAN, any open INCIDENT-*.md | Agent-11 |
| **ARCHIVE** (review) | All archive/*.md — decide se algum deve ser referenced ou promoted | Agent-12 |

### Fase 2: Consolidate

Cada agent retorna:
1. Lista de docs críticos encontrados no cluster
2. Prioridade (🔴 CRÍTICO / 🟡 ALTA / 🟢 MÉDIA / ⚪ BAIXA)
3. Razão pela qual é crítico para LLM
4. Proposta de texto para o bloco OBRIGATÓRIO

### Fase 3: Update AGENTS.md

Consolidar output dos 12 agents num bloco único no topo do AGENTS.md.

---

## Success Criteria

1. **Todos os GOVERNANCE docs** estão linkados se forem críticos para LLM
2. **SPECs críticos** (audio, monitoring, monorepo) estão linkados
3. **Zero documentos críticos esquecidos**
4. **Prioridades corretas** — só 🔴 CRÍTICO e 🟡 ALTA no bloco OBRIGATÓRIO
5. **Texto claro** — LLM sabe exatamente o que fazer ou evitar

---

## Output

`AGENTS.md` atualizado com bloco OBRIGATÓRIO completo.
