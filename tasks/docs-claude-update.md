# docs-claude-update.md

## Status: PENDING (Permission denied)

### Task T10: Update .claude/CLAUDE.md to reflect new docs structure

**Intended Changes:**

#### Section: Specflow (Spec-Driven Development)

1. **Overview** (line 86)
   - OLD: `docs/specflow/`
   - NEW: `docs/SPECS/`

2. **Ficheiros** (lines 103-107)
   - OLD: `docs/specflow/SPEC-*.md`
   - NEW: `docs/SPECS/SPEC-*.md`
   
   - OLD: `docs/specflow/SPEC-TEMPLATE.md`
   - NEW: `docs/SPECS/SPEC-TEMPLATE.md`
   
   - OLD: `docs/specflow/discovery.md`
   - NEW: `docs/SPECS/discovery.md`
   
   - OLD: `docs/specflow/tasks.md`
   - NEW: `docs/SPECS/tasks.md`
   
   - OLD: `docs/specflow/reviews/REVIEW-*.md`
   - NEW: `docs/SPECS/reviews/REVIEW-*.md`

3. **Added new entry** in Ficheiros:
   - `docs/REFERENCE/` — Referências e guias rápidos

### Full Updated Content for Specflow Section

```markdown
## Specflow (Spec-Driven Development)

### Overview
O projeto usa spec-driven development. Antes de implementar features significativas, um documento SPEC-*.md deve existir em `docs/SPECS/`.

### Workflow
```
SPECIFY → PLAN → TASKS → IMPLEMENT → REVIEW → SHIP
```

### Comandos
- `/spec` — Iniciar workflow spec-driven (spec-driven-development skill)
- `/md` — Modo dormir: escaneia SPECs pendentes e gera pipeline
- `/pg` — Pipeline gen: gera tasks a partir de SPECs
- `/rr` — Code review: gera REVIEW-*.md
- `/se` — Secrets audit: scan antes de push
- `/hg` — Human gates: identify blockers
- `/img` — Analisa imagem com LLaVA local (ollama llava)

### Ficheiros
- `docs/SPECS/SPEC-*.md` — Especificações por feature
- `docs/SPECS/SPEC-TEMPLATE.md` — Template
- `docs/SPECS/discovery.md` — Decisões de arquitetura
- `docs/SPECS/tasks.md` — Tarefas extraídas
- `docs/SPECS/reviews/REVIEW-*.md` — Code reviews
- `docs/REFERENCE/` — Referências e guias rápidos

### Regras
1. Cada feature nova → criar `SPEC-NNN-nome.md`
2. Após 3+ SPECs → executar `/pg` para atualizar tasks.md
3. Antes de commit → executar `/rr` e guardar em reviews/
4. Modo dormir escaneia SPECs automaticamente às 3h
```

### Notes
- All other rules in the file remain intact
- Only path references were updated (specflow/ → SPECS/)
- Added docs/REFERENCE/ reference as requested
