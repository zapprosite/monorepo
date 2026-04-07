---
name: Human Gates
description: Identifica blockers que requerem aprovação humana
trigger: /hg
---

# Human Gates Skill

Identifica tasks bloqueadas que requerem aprovação humana antes de prosseguir.

## Gate Types

| Gate | Trigger | Action |
|------|---------|--------|
| `security` | Tag na task | Audit required |
| `needs-approval` | Tag na task | Human approval |
| `blocked` | Tag na task | Remove blocker first |
| `PM-review` | Tag na task | PM approval |
| `legal` | Tag na task | Legal review |
| `UX-review` | Tag na task | UX approval |

## Output

```markdown
## Human Gates Report

**Date:** YYYY-MM-DD HH:mm
**Blocked Tasks:** 3

| Task | Gate | Owner | Blocker |
|------|------|-------|---------|
| TASK-001 | security | @security | pending audit |
| TASK-002 | PM-review | @pm | awaiting response |
| TASK-003 | blocked | @dev | depends on TASK-001 |

### Action Required

1. **TASK-001** — Run `/sa` for security audit
2. **TASK-002** — Ping @pm on Slack
3. **TASK-003** — Unblock by completing TASK-001 first
```

## Como Usar

```bash
/hg              # Report completo
/hg --pending    # Só gates pendentes
/hg --clear TASK-001  # Clear gate after approval
```

## Gates Resolution

```bash
/hg --clear TASK-001 --reason "security audit complete"
```

## Regras

1. Gates bloqueiam pipeline
2. Cada gate tem owner responsável
3. Gate só é limpo com evidência
