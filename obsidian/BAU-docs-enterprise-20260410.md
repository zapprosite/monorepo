# Baú — Docs Enterprise Simplification

**Data:** 2026-04-10
**Status:** ✅ COMPLETO

---

## Resumo Executivo

Simplificação da estrutura de documentação do monorepo para padrão enterprise rigoroso.

---

## Estrutura Alcançada

```
docs/
├── SPECS/      ← 36 specs (features reais)
├── ADRs/       ← Architecture Decisions (separados)
├── GUIDES/     ← 8 how-to documents
├── REFERENCE/  ← 7 referências técnicas
├── GOVERNANCE/ ← Regras imutáveis
├── INFRASTRUCTURE/ ← Docs de infra
├── MCPs/       ← Docs de MCP servers
├── OPERATIONS/ ← Operações
├── TEMPLATES/  ← Templates
├── INCIDENTS/  ← Incidents
└── archive/    ← Arquivo

obsidian/ (espelho read-only)
```

---

## Tarefas Executadas (10 agents)

| # | Tarefa | Estado |
|---|--------|--------|
| T01 | Audit docs/ | ✅ |
| T02 | Criar estrutura enterprise | ✅ |
| T03 | Mover SPECs para docs/SPECS | ✅ (36 files) |
| T04 | Mover ADRs para docs/ADRs | ✅ |
| T05 | Mover GUIDEs para docs/GUIDES | ✅ (8 files) |
| T06 | Mover REFERENCE para docs/REFERENCE | ✅ (7 files) |
| T07 | Limpar folders legacy | ✅ (specflow/, context/, plans/ removidos) |
| T08 | Atualizar obsidian mirror | ✅ |
| T09 | Criar docs/CLAUDE.md com regras | ✅ |
| T10 | Atualizar .claude/CLAUDE.md | ✅ |

---

## Ficheiros Significativos

### docs/CLAUDE.md (novo)
- Regras enterprise rígidas
- Estrutura: SPECS/, ADRs/, GUIDES/, REFERENCE/
- Naming conventions
- Obsidian é read-only

### docs/GUIDES/
- CANVAS-CURSOR-LOOP.md
- CODE-REVIEW-GUIDE.md
- discovery.md
- voice-pipeline-desktop.md
- voice-pipeline-loop.md
- tasks.md
- PLAN-docs-reorganization-20260408.md

### docs/REFERENCE/
- ARCHITECTURE-MASTER.md (movido de specflow/)
- AI-CONTEXT.md
- ARCHITECTURE-MODELS.md
- CLI-SHORTCUTS.md
- TOOLCHAIN.md
- WORKFLOW.md

---

## Regras Enterprise Aplicadas

1. **SPECs** → `docs/SPECS/SPEC-NNN-nome.md`
2. **ADRs** → `docs/ADRs/ADR-NNN-nome.md`
3. **GUIDEs** → `docs/GUIDES/kebab-case.md`
4. **REFERENCE** → `docs/REFERENCE/kebab-case.md`
5. **obsidian/** → Espelho read-only, sincronizado manualmente

---

## Limpeza Realizada

- ❌ `docs/specflow/` — REMOVIDO (42 ficheiros movidos)
- ❌ `docs/context/` — REMOVIDO (vazio)
- ❌ `docs/plans/` — REMOVIDO (conteúdo movido)
- ❌ `docs/adr/`, `docs/ADR/`, `docs/adrs/` — REMOVIDOS (placeholders legacy)

---

## Para Ver no Obsidian

Este ficheiro está em `obsidian/BAU-docs-enterprise-20260410.md` — visualize no Obsidian para ver o resumo completo.

---

**Co-Authored-By:** Claude Opus 4.6 <noreply@anthropic.com>
