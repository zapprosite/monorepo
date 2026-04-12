# Incidentes Registrados

## 📌 PINNING MARKER

**Este arquivo é fonte de verdade para incidentes. Não substitua sem aprovação.**
**Valido desde:** 2026-04-08 | **Proxima revisão:** 2026-05-08
**Total de incidentes registados:** 5 (todos resolvidos)

---

## Índice de Incidentes

| Data | ID | Título | Severidade | Status |
|------|----|--------|------------|--------|
| 2026-04-08 | INCIDENT-2026-04-08 | Perplexity Agent GitOps Gap | 🔴 HIGH | ✅ RESOLVIDO |
| 2026-04-08 | INCIDENT-2026-04-08-wav2vec2 | LiteLLM STT Network Isolation | 🔴 HIGH | ✅ RESOLVIDO |
| 2026-04-08 | INCIDENT-2026-04-08-voice | Voice Pipeline Stability Master Plan | 🔴 HIGH | ✅ RESOLVIDO |
| 2026-04-08 | INCIDENT-2026-04-08-kokoro | Kokoro Voice Access Control | 🟡 MEDIUM | ✅ RESOLVIDO |
| 2026-04-08 | INCIDENT-2026-04-08-gitea | Gitea Actions Runner — Workflows Não Executavam | 🟡 MEDIUM | ✅ RESOLVIDO |

---

## INCIDENT-2026-04-08: Perplexity Agent GitOps Gap

**Problema:** Container não deployado, site down por ~4h
**Root Cause:** Gap entre Terraform (DNS) e Coolify (Deploy)
**Prevenção:** Verificar todos os itens do checklist em SPEC-028-PERPLEXITY-GITOPS.md

**Arquivo:** `INCIDENT-2026-04-08-perplexity-gitops-gap.md`

---

## INCIDENT-2026-04-08-gitea: Gitea Actions Runner

**Problema:** Workflows não executavam — runner não estava deployado
**Root Cause:** act_runner nunca foi iniciado, secrets não configurados
**Prevenção:** Verificar runner online antes de criar workflows

**Arquivo:** `INCIDENT-2026-04-08-gitea-actions-runner.md`

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

## Lesson Learned: Gitea vs GitHub Remotes

**INCIDENT-2026-04-08-GITEA-PUSH:** Push de teste foi para GitHub em vez de Gitea.

O monorepo tem dois remotes:
- `origin` → `git@github.com:zapprosite/monorepo.git` (GitHub)
- `gitea` → `git@git.zappro.site:will/monorepo.git` (Gitea)

**Gitea Actions só dispara com push para `gitea` (git.zappro.site), NÃO para GitHub.**

**Fluxo correto para testar Gitea Action:**
```bash
# 1. Verificar remote do workflow
ls .gitea/workflows/  # existe? = Gitea

# 2. Push para Gitea
git remote -v  # confirmar remote gitea
git push gitea main

# 3. Verificar em git.zappro.site/{owner}/{repo}/actions
```

**Verificar antes de push:**
```bash
grep -l "gitea/workflows" .gitea/workflows/*.yml && echo "Gitea Actions found"
```
