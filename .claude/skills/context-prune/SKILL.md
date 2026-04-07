---
name: Context Prune
description: Limpa sessões antigas do memory-keeper
trigger: /cp
---

# Context Prune Skill

Limpa sessões antigas do memory-keeper para manter o contexto dentro do limite.

## Cleanup Rules

| Age | Action |
|-----|--------|
| > 7 days | Delete |
| > 14 days | Delete + backup |
| < 7 days | Keep |

## Output

```markdown
## Context Prune Report

**Date:** YYYY-MM-DD HH:mm
**Database:** ~/.claude/memory/memory.db

### Sessions
| Status | Count | Age |
|--------|-------|-----|
| Kept | 45 | < 7 days |
| Deleted | 128 | > 7 days |
| Backed up | 12 | > 14 days |

### Storage
| Before | After | Saved |
|--------|-------|-------|
| 2.3 GB | 890 MB | 1.4 GB |

### Tokens Recovered
~45K tokens freed
```

## Como Usar

```bash
/cp              # Cleanup normal
/cp --aggressive # > 3 days
/cp --dry        # Só relatório
```

## Cron

Executa automaticamente via:
```
0 3 * * 0 cm -p "Execute: --skill context-prune"
```

## Regras

1. Sessions > 7 days = delete
2. Sessions > 14 days = backup antes de delete
3. Backup vai para `~/.claude/memory/backups/`
4. Nunca deleta sessions com tasks pendentes
