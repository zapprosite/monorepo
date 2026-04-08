# Incidentes Registrados

## Índice de Incidentes

| Data | ID | Título | Severidade | Status |
|------|----|--------|------------|--------|
| 2026-04-08 | INCIDENT-2026-04-08 | Perplexity Agent GitOps Gap | 🔴 HIGH | ✅ RESOLVIDO |
| 2026-04-08 | INCIDENT-2026-04-08-wav2vec2 | LiteLLM STT Network Isolation | 🔴 HIGH | ✅ RESOLVIDO |

---

## INCIDENT-2026-04-08: Perplexity Agent GitOps Gap

**Problema:** Container não deployado, site down por ~4h
**Root Cause:** Gap entre Terraform (DNS) e Coolify (Deploy)
**Prevenção:** Verificar todos os itens do checklist em SPEC-PERPLEXITY-GITOPS.md

**Arquivo:** `INCIDENT-2026-04-08-perplexity-gitops-gap.md`

---

## Como Registrar Novo Incidente

1. Criar arquivo em `docs/INCIDENTS/INCIDENT-{DATA}-{breve-id}.md`
2. Preencher template com Timeline, Root Cause, Lessons Learned, Fixes
3. Atualizar este índice
4. Se severidade >= HIGH, adicionar à lista acima

## Template

```markdown
# INCIDENT-{DATA}: {Título}

**Data:** YYYY-MM-DD
**Severidade:** 🟢 LOW / 🟡 MEDIUM / 🔴 HIGH / ⚫ CRITICAL
**Tipo:** [categoria]
**Status:** INVESTIGATING / ✅ RESOLVIDO

---

## Sumário

[Descrição curta do problema]

## Timeline

| Hora | Evento |
|------|--------|
| HH:MM | ... |

## Root Cause

[Análise do que causou o problema]

## O que Nos Impedia de Ver o Problema

| Sintoma | Por que era enganoso |
|--------|---------------------|
| ... | ... |

## Lessons Learned

### O que aprendemos
### O que poderia ter evitado

## Fixes Implementados

[Lista de correções feitas]

## Prevenção Futura

[ checklist para não acontecer de novo ]

---

**Registrado:** YYYY-MM-DD
**Autor:** will
**Proxima revisão:** YYYY-MM-DD (+30 dias)
```

---

## Boas Práticas

- **Seja específico:** "GitOps Gap" é melhor que "Deployment Issue"
- **Documente a causa raiz, não os sintomas:** "Container não existia" é melhor que "Site estava down"
- **Inclua timeline:** facilita debugging futuro
- **Lessons learned são obrigatórios:** o objetivo é não repetir
- **Severidade:** use para priorizar revisão
