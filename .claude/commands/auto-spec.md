description: Auto SPEC → Deploy pipeline. Creates SPEC from idea, AI chooses loop, executes all tasks, commits, syncs, clears terminal, creates new random branch.
argument-hint: <idea>
---

# /auto-spec — Zero-Touch SPEC Pipeline

## Usage

```bash
/auto-spec [idea]
```

Example:
```bash
/auto-spec sistema de notificações push para mobile
/auto-spec adicionar autenticação OAuth com Google
/auto-spec criar dashboard de métricas com Prometheus
```

## What Happens

1. **Creates SPEC** from your idea
2. **AI reads SPEC** and decides loop complexity
3. **AI executes** tasks in loop
4. **On success:**
   - Commit + push
   - PR created
   - AI-CONTEXT sync
   - Terminal `/clear`
   - New random branch created
5. **System ready** for next `/auto-spec`

## Loop Selection (AI Decision)

| Complexity | AI Chooses |
|------------|------------|
| Simple (0-30 score) | `/computer-loop --fast` |
| Medium (31-60) | `/computer-loop --standard` |
| Complex (61+) | `/cursor-loop --enterprise` |

## Authorization

**MASTER:** User has authorized automatic `/clear` when context > 90%.

## See Also

- `SPEC-SPEC-AUTOMATOR.md` — Full system architecture