# SPEC-001: Template claude-code-minimax Fusionado

**Status:** COMPLETED
**Created:** 2026-04-07
**Owner:** will

## Summary

Fusionar o template `claude-code-minimax` (zapprosite/claude-code-minimax) em `/srv/monorepo/.claude/` com a estrutura existente, eliminando redundâncias e criando specflow infrastructure.

## Motivation

O template `claude-code-minimax` tinha skills e agents avançados mas não estavam integrados no monorepo. O monorepo tinha docs mas sem workflow spec-driven. A fusão traz:
- Skills locais para todos os slash commands documentados
- Sistema de cron jobs para auto-orchestration
- Specflow completo (SPECs, reviews, tasks pipeline)

## Design

### Estrutura Criada

```
.claude/
├── skills/
│   ├── secrets-audit.md
│   ├── mcp-health.md
│   ├── repo-scan.md
│   ├── pipeline-gen.md
│   ├── smoke-test-gen.md
│   ├── human-gates.md
│   ├── deploy-validate.md
│   ├── context-prune.md
│   ├── snapshot-safe.md
│   └── spec-driven-development → (symlink)
├── commands/
│   ├── pg.md   (pipeline-gen)
│   ├── sec.md  (secrets-audit)
│   ├── hg.md   (human-gates)
│   ├── ss.md   (snapshot-safe)
│   ├── dv.md   (deploy-validate)
│   └── rs.md   (repo-scan)
├── hooks/
│   └── pre-commit  (secrets audit)
├── scheduled_tasks.json  (9 cron jobs)
└── CLAUDE.md (actualizado com specflow)
docs/specflow/
├── SPEC-README.md
├── SPEC-TEMPLATE.md
├── discovery.md
├── tasks.md
└── reviews/
    └── REVIEW-GUIDE.md
```

### Cron Jobs (9 total)

| ID | Cron | Função |
|---|---|---|
| 614f0574 | */30 * * * * | Memory sync + git status |
| checkpoint-90min | */90 * * * * | checkpoint.sh |
| context-meter | */60 * * * * | context-meter.sh |
| modo-dormir-daily | 0 3 * * * | /rs repo-scan + pipeline |
| code-review-daily | 0 4 * * * | git log review |
| test-coverage-daily | 0 5 * * * | bun test --coverage |
| secrets-audit-daily | 0 6 * * * | grep secrets pattern |
| mcp-health-daily | 0 8 * * * | MCP servers status |

### Gaps Identificados e Resolvidos

1. **Agents inexistentes** → Agents em `.claude/agents/` (gitignored). Não fazer commit de agents pessoais.
2. **Slash commands sem comando real** → Criados em `.claude/commands/`
3. **Pre-commit hook missing** → Criado `.claude/hooks/pre-commit`
4. **Cron jobs com agents errados** → Corrigidos prompts para usar slash commands
5. **SPEC sem example real** → Este documento

## Implementation Notes

- `.claude/agents/` está no .gitignore — agents pessoais pertencem ao template em `~/.claude/projects/claude-code-minimax/`
- `scheduled_tasks.json` usa prompts em português para cron jobs
- Pre-commit hook scanea apenas staged files, não todos os ficheiros do repo
- Cron jobs verificam antes de agir (silence when OK pattern)

## Verification

```bash
# Verificar slash commands
ls .claude/commands/

# Verificar cron jobs
jq '.tasks[].id' .claude/scheduled_tasks.json

# Verificar pre-commit hook
git config --get core.hooksPath  # → .claude/hooks

# Verificar SPEC
ls docs/specflow/SPEC-*.md
```

## Commit

`fd9bd2d` — feat(claude): add claude-code-minimax template fusion

---

**TODO:** Manter este documento atualizado se a estrutura `.claude/` mudar.
