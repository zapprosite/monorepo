# TODO: Docs Enterprise Simplification

**Generated:** 2026-04-10
**Plan:** tasks/plan.md
**Status:** READY TO IMPLEMENT

---

## T01 — Auditar docs atual ⏳

**Goal:** Categorizar todos os ficheiros .md em docs/

- [ ] Listar todos os ficheiros .md em docs/
- [ ] Categorizar: SPEC, ADR, GUIDE, REFERENCE, LEGACY
- [ ] Identificar duplicados e órfãos
- [ ] Output: Lista categorizada

**Verification:** `find docs -name "*.md" | wc -l`

---

## T02 — Criar estrutura enterprise ⏳

**Goal:** Criar `docs/SPECS/`, `docs/GUIDES/`, `docs/REFERENCE/`

- [ ] `docs/SPECS/` directory
- [ ] `docs/GUIDES/` directory
- [ ] `docs/REFERENCE/` directory
- [ ] Manter `docs/ADRs/` (já existe)

**Verification:** `ls -d docs/{SPECS,GUIDES,REFERENCE,ADRs}/`

---

## T03 — Mover SPECs para docs/SPECS ⏳

**Goal:** Mover SPECs reais de specflow/ para SPECS/

- [ ] Identificar SPECs reais (não templates/guides)
- [ ] `git mv docs/specflow/SPEC-*.md docs/SPECS/`
- [ ] Ignorar: SPEC-INDEX.md, SPEC-TEMPLATE.md, SPEC-README.md

**Verification:** `git ls-files docs/SPECS/ | wc -l`

---

## T04 — Mover ADRs para docs/ADRs ⏳

**Goal:** ADRs separados de SPECs

- [ ] Identificar ADRs que estão em SPECs
- [ ] `git mv` para docs/ADRs/

**Verification:** `ls docs/ADRs/*.md | wc -l`

---

## T05 — Mover GUIDEs para docs/GUIDES ⏳

**Goal:** How-to documents separados

- [ ] CANVAS-CURSOR-LOOP.md → docs/GUIDES/
- [ ] CODE-REVIEW-GUIDE.md → docs/GUIDES/
- [ ] voice-pipeline-loop.md → docs/GUIDES/
- [ ] plans/PLAN-*.md → docs/GUIDES/

**Verification:** `ls docs/GUIDES/*.md | wc -l`

---

## T06 — Mover REFERENCE para docs/REFERENCE ⏳

**Goal:** Technical references separados

- [ ] AI-CONTEXT.md → docs/REFERENCE/AI-CONTEXT.md
- [ ] ARCHITECTURE-MODELS.md → docs/REFERENCE/
- [ ] TOOLCHAIN.md → docs/REFERENCE/

**Verification:** `ls docs/REFERENCE/*.md`

---

## T07 — Limpar folders legacy ⏳

**Goal:** Remover placeholders vazios

- [ ] Limpar `docs/specflow/` (mover residual)
- [ ] Limpar `docs/plans/`
- [ ] Limpar `docs/context/`
- [ ] DELETE `docs/adr/` `docs/ADR/` `docs/adrs/`

**Verification:** `ls docs/specflow/` deve ter só residual

---

## T08 — Atualizar obsidian mirror ⏳

**Goal:** Sincronizar docs/ → obsidian/ (read-only)

- [ ] rsync docs/SPECS/ → obsidian/SPECS/
- [ ] rsync docs/ADRs/ → obsidian/ADRs/
- [ ] rsync docs/GUIDES/ → obsidian/GUIDES/
- [ ] rsync docs/REFERENCE/ → obsidian/REFERENCE/
- [ ] README em obsidian/ explica que é espelho

**Verification:** `ls obsidian/SPECS/` existe

---

## T09 — Criar docs/CLAUDE.md com regras ⏳

**Goal:** Documentar regras de estrutura enterprise

- [ ] Estrutura: SPECS/, ADRs/, GUIDES/, REFERENCE/
- [ ] Naming conventions
- [ ] Obsidian is read-only
- [ ] Workflow: SPEC → ADR → GUIDE

**Verification:** `cat docs/CLAUDE.md`

---

## T10 — Atualizar .claude/CLAUDE.md ⏳

**Goal:** Main CLAUDE.md com novas paths

- [ ] Secção SPECflow atualizada (SPECS/ não specflow/)
- [ ] Remover refs a specflow/
- [ ] Adicionar docs/REFERENCE/

**Verification:** `grep "SPECS/" .claude/CLAUDE.md`

---

## Dependency Graph

```
T01 (audit)
    │
    ├── T02 (create structure)
    │       │
    │       ├── T03 (move SPECs)
    │       │       │
    │       │       └── T04 (move ADRs)
    │       │
    │       ├── T05 (move GUIDEs)
    │       │       │
    │       │       └── T06 (move REFERENCE)
    │       │               │
    │       └── T07 (clean legacy)
    │               │
    └── T08 (obsidian sync)
            │
            └── T09 (CLAUDE.md rules)
                    │
                    └── T10 (.claude/CLAUDE.md)
```

---

## Files to Migrate (SPECs → GUIDEs)

These specflow files are NOT specs, should go to GUIDES/:

| File | Target |
|------|--------|
| CANVAS-CURSOR-LOOP.md | GUIDES/ |
| CODE-REVIEW-GUIDE.md | GUIDES/ |
| voice-pipeline-loop.md | GUIDES/ |
| discovery.md | GUIDES/ |
| SPEC-022-CURSOR-LOOP-CLI-SOLUTIONS.md | GUIDES/ |
| SPEC-TEMPLATE.md | SPECS/TEMPLATE.md |
| SPEC-INDEX.md | (delete or merge) |
| SPEC-README.md | (delete or merge) |
| PLAN-docs-reorganization-20260408.md | GUIDES/ |

---

## Stats Estimate

| Metric | Count |
|--------|-------|
| SPECs to move | ~30 |
| GUIDEs to move | ~10 |
| REFERENCE to move | ~5 |
| Legacy to delete | ~6 dirs |
| Obsidian to sync | ~4 dirs |
