# Plan: Docs Enterprise Simplification

**Data:** 2026-04-10
**Status:** READY
**Author:** will

---

## Diagnóstico

### Estrutura Atual (CAÓTICA)

```
docs/
├── ADRs/                    # Só README + TEMPLATE (ADRs reais em specflow!)
├── specflow/               # 42 ficheiros: SPECs + reviews + templates + guides
├── context/                # Só README
├── plans/                  # 1 ficheiro PLAN
├── archive/                # Archives de migrations
├── adr/                    # VAZIO (legacy)
├── ADR/                    # VAZIO (legacy)
├── adrs/                   # VAZIO (legacy)
└── obsidian/               # Espelho passivo
```

### Problemas

1. **ADRs místurados nos SPECs** — `specflow/` tem 42 ficheiros, maioria não são SPECs
2. **Placeholders legacy** — `docs/adr/`, `docs/ADR/`, `docs/adrs/` vazios mas referenciados
3. **SPECs com GUIDES dentro** — `SPEC-022-CURSOR-LOOP-CLI-SOLUTIONS.md` é research, não SPEC
4. **Obsidian não está a espelhar** — `obsidian/` existe mas não está sincronizado
5. **Multiple indexes** — SPEC-INDEX.md, ADRs/README.md, AI-CONTEXT.md (root)

### Meta Enterprise

Padrão simples e rigoroso:
- **SPECs** → Feature specs (apenas)
- **ADRs** → Architecture decisions (separados)
- **GUIDES** → How-to documents
- **REFERENCE** → Technical references
- **obsidian/** → Espelho read-only, sincronizado manualmente

---

## Estrutura Proposta (Enterprise)

```
docs/
├── SPECS/                   # Especificações de features
│   ├── SPEC-001-nome.md     # SPECs reais
│   ├── SPEC-002-nome.md
│   └── SPEC-TEMPLATE.md
├── ADRs/                    # Architecture Decision Records
│   ├── ADR-001-nome.md      # ADRs reais
│   ├── ADR-002-nome.md
│   └── ADR-TEMPLATE.md
├── GUIDES/                  # How-to documents
│   ├── setup-dev.md
│   ├── deploy.md
│   └── troubleshooting.md
├── REFERENCE/               # Technical reference
│   ├── CLI.md
│   ├── ARCHITECTURE.md
│   └── API.md
└── obsidian/                # Espelho passivo READ-ONLY
    ├── SPECS/
    ├── ADRs/
    ├── GUIDES/
    └── REFERENCE/

(Old folders: archive/ context/ plans/ specflow/ — MOVER e LIMPAR)
```

---

## Tasks

### T01 — Auditar docs atual
**Ficheiros afetados:** todos em `docs/`
**Critério:**
- [ ] Listar todos os ficheiros .md em docs/
- [ ] Categorizar: SPEC, ADR, GUIDE, REFERENCE, LEGACY
- [ ] Identificar duplicados e órfãos
- [ ] Count: X SPECs, Y ADRs, Z GUIDEs, W LEGACY

### T02 — Criar estrutura enterprise
**Ficheiros:** nova estrutura de directorias
**Critério:**
- [ ] Criar `docs/SPECS/` (se não existir)
- [ ] Criar `docs/GUIDES/` (se não existir)
- [ ] Criar `docs/REFERENCE/` (se não existir)
- [ ] Manter `docs/ADRs/` (já existe)

### T03 — Mover SPECs para docs/SPECS
**Ficheiros:** SPECs de `docs/specflow/`
**Critério:**
- [ ] Mover SPEC-*.md (apenas specs reais) para docs/SPECS/
- [ ] Ignorar: SPEC-INDEX.md, SPEC-TEMPLATE.md, SPEC-README.md
- [ ] Verificar: `git mv` preserva history

### T04 — Mover ADRs para docs/ADRs
**Ficheiros:** ADRs existentes
**Critério:**
- [ ] ADRs do SPEC-*.md que são decisões architecture → docs/ADRs/
- [ ] Manter numbering sequencial (ADR-001, ADR-002...)

### T05 — Mover GUIDEs para docs/GUIDES
**Ficheiros:** How-to documents
**Critério:**
- [ ] CANVAS-CURSOR-LOOP.md → docs/GUIDES/
- [ ] CODE-REVIEW-GUIDE.md → docs/GUIDES/
- [ ] voice-pipeline-loop.md → docs/GUIDES/
- [ ] plans/PLAN-*.md → docs/GUIDES/

### T06 — Mover REFERENCE para docs/REFERENCE
**Ficheiros:** Technical references
**Critério:**
- [ ] AI-CONTEXT.md → docs/REFERENCE/ (ou renomear)
- [ ] ARCHITECTURE-MODELS.md → docs/REFERENCE/
- [ ] TOOLCHAIN.md → docs/REFERENCE/

### T07 — Limpar folders legacy
**Ficheiros:** specflow/, plans/, context/, adr/, ADR/, adrs/
**Critério:**
- [ ] `docs/specflow/` → EMPTY ou ARCHIVE (mover tudo que não foi movido)
- [ ] `docs/plans/` → LIMPAR (mover conteúdo)
- [ ] `docs/context/` → LIMPAR (mover conteúdo)
- [ ] `docs/adr/` → DELETE (vazio)
- [ ] `docs/ADR/` → DELETE (vazio)
- [ ] `docs/adrs/` → DELETE (vazio)

### T08 — Atualizar obsidian mirror
**Ficheiros:** obsidian/
**Critério:**
- [ ] Sincronizar docs/SPECS/ → obsidian/SPECS/
- [ ] Sincronizar docs/ADRs/ → obsidian/ADRs/
- [ ] Sincronizar docs/GUIDES/ → obsidian/GUIDES/
- [ ] Sincronizar docs/REFERENCE/ → obsidian/REFERENCE/
- [ ] Criar README em obsidian/ a explicar que é espelho

### T09 — Criar CLAUDE.md com regras
**Ficheiros:** docs/CLAUDE.md (regras de estrutura)
**Critério:**
- [ ] Documentar estrutura enterprise
- [ ] Regras: onde criar cada tipo de doc
- [ ] Workflow: SPEC → ADR → GUIDE
- [ ] Obsidian é read-only

### T10 — Atualizar .claude/CLAUDE.md
**Ficheiros:** .claude/CLAUDE.md
**Critério:**
- [ ] Atualizar secção SPECflow para nova estrutura
- [ ] Remover refs a specflow/ (agora SPECS/)
- [ ] Adicionar docs/REFERENCE/ ao path

---

## Dependency Graph

```
T01 (audit) ─────────────────────────────────────────────────
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
    │       └── T07 (clean legacy) ──────────────────────────
    │               │
    └── T08 (obsidian sync)
            │
            └── T09 (CLAUDE.md rules)
                    │
                    └── T10 (.claude/CLAUDE.md)
```

---

## Checkpoints

| Phase | Gate | Critério |
|-------|------|----------|
| T01 | Audit complete | Lista de todos os docs categorizados |
| T02 | Structure created | 4 pastas novas existem |
| T03 | SPECs moved | `git ls-files docs/SPECS/` mostra SPECs |
| T04 | ADRs moved | ADRs em docs/ADRs/ |
| T07 | Legacy cleaned | `docs/specflow/`, `docs/plans/`, `docs/context/` vazios |
| T09 | Rules documented | docs/CLAUDE.md existe e tem regras |
| T10 | Main CLAUDE updated | .claude/CLAUDE.md tem novas paths |

---

## Regras Enterprise (Rígidas)

### 1. Estrutura de Docs

| Tipo | Location | Exemplo |
|------|----------|---------|
| SPEC | `docs/SPECS/SPEC-NNN-nome.md` | SPEC-001-workflow-performatico.md |
| ADR | `docs/ADRs/ADR-NNN-nome.md` | ADR-001-governance-centralizada.md |
| GUIDE | `docs/GUIDES/nome.md` | GUIDES/setup-dev.md |
| REFERENCE | `docs/REFERENCE/nome.md` | REFERENCE/CLI.md |

### 2. Naming

- **SPEC:** `SPEC-NNN-descritivo.md`
- **ADR:** `ADR-NNN-descritivo.md`
- **GUIDE:** `kebab-case.md`
- **REFERENCE:** `kebab-case.md`

### 3. Obsidian (Espelho Read-Only)

```
docs/ (source of truth)
    ↓ rsync manual
obsidian/ (read-only mirror)
```

**Regra:** Nunca editar obsidian/ diretamente. Editar em docs/ e sincronizar.

### 4. Migration de SPECs

SPECs existentes em `specflow/` que são research (não specs):
- `SPEC-022-CURSOR-LOOP-CLI-SOLUTIONS.md` → `GUIDES/cursor-loop-cli-solutions.md`
- `CANVAS-CURSOR-LOOP.md` → `GUIDES/cursor-loop-architecture.md`
- `voice-pipeline-loop.md` → `GUIDES/voice-pipeline-loop.md`

### 5. Files to DELETE (Legacy/Placeholder)

- `docs/adr/` (vazio)
- `docs/ADR/` (vazio)
- `docs/adrs/` (vazio)
- `docs/plans/` (vazio após mover conteúdo)
- `docs/context/` (vazio após mover conteúdo)

---

## Execution

```bash
# Phase 1: Audit
T01: find docs -name "*.md" | categorize

# Phase 2: Structure
T02: mkdir -p docs/SPECS docs/GUIDES docs/REFERENCE

# Phase 3: Migrate (git mv)
T03-T06: Mover ficheiros para locations corretas
T07: Limpar folders legacy

# Phase 4: Sync
T08: rsync -av docs/ obsidian/

# Phase 5: Rules
T09-T10: Criar e atualizar CLAUDE.md files
```
