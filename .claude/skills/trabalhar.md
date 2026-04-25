---
name: Trabalhar
description: Executa tarefas pendentes da queue — build, test, verify, commit
trigger: /trabalhar, work on tasks, execute tasks, start working
version: 1.0.0
deprecated: false
---

# Trabalhar Skill

Executa tarefas pendentes da queue. Processa uma a uma com verify automatico.

## Quando Usar

- Apos `/planejar` para executar a queue
- Quando tens tarefas pendentes e queres avancar
- Depois de `/spec` + `/planejar`
- Antes de `/autopilot` se queres controle manual

## O que faz

1. **Lê queue** — Carrega `.claude/tasks/queue.md`
2. **Executa task** — Build → Test → Verify
3. **Reporta** — Marca como completa ou falha
4. **Avança** — Passa para proxima task
5. **Commit** — Auto-commit apos cada task completa

## Como Executar

```bash
/trabalhar
/trabalhar --task 3        # Executar task especifica
/trabalhar --resume        # Continuar de onde parou
/trabalhar --dry-run       # Simular sem executar
```

## Fluxo por Task

```
┌─────────────────────────────────────┐
│  Task: {nome}                       │
├─────────────────────────────────────┤
│  1. Build                           │
│     → pnpm build / npm run build    │
│     → Se falha: retry 1x, depois    │
│       escala                        │
│                                     │
│  2. Test                            │
│     → pnpm test / npm test         │
│     → Se falha: fix + re-run        │
│                                     │
│  3. Verify                          │
│     → pnpm tsc --noEmit            │
│     → lint check                    │
│                                     │
│  4. Commit                          │
│     → git add + commit automatico   │
│     → mensagem: "feat: {task}"    │
└─────────────────────────────────────┘
```

## Output

```markdown
## Progresso — {date}

### Completo
- [x] Task 1: Criar estrutura
- [x] Task 2: Setup banco

### Em progresso
- [ ] Task 3: API endpoints

### Pendente
- [ ] Task 4: Frontend components
- [ ] Task 5: Tests

---

**Concluido:** 2/5
**Tempo:** ~15min
**Proxima:** Task 3
```

## Error Handling

| Situacao | Acao |
|---------|------|
| Build falha | Retry 1x, depois escala |
| Test falha | Auto-fix se possivel, senao marca |
| Erro persistir | Para e reporta |
| Task completa | Auto-commit |

## Bounded Context

**Faz:**
- Executa tasks em ordem
- Build + Test + Verify
- Auto-commit apos sucesso

**Nao faz:**
- Criar tasks (use `/planejar`)
- Parallel execution (use `/autopilot`)
- Deployment (use `/deploy`)
