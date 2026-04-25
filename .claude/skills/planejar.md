---
name: Planejar
description: Cria lista de tarefas a partir da SPEC — extrai tasks, prioriza, gera queue
trigger: /planejar, planejar tarefas, criar tarefas, task breakdown, decompose
version: 1.0.0
deprecated: false
---

# Planejar Skill

Cria lista de tarefas a partir da SPEC. Extrai tasks, prioriza e gera queue.

## Quando Usar

- Apos `/spec` para decompor em tarefas executaveis
- Quando tens um objetivo mas nao sabes por onde comecar
- Precisas dividir trabalho grande em passos menores
- Antes de executar com `/trabalhar` ou `/autopilot`

## O que faz

1. **Lê SPEC.md** — Extrai requisitos, acceptance criteria, e deliverables
2. **Decompoe** — Quebra em tarefas atomicas e ordenadas
3. **Prioriza** — ordem logica de execucao (deps primeiro)
4. **Gera queue** — lista estruturada para execucao

## Como Executar

```bash
/planejar
/planejar docs/SPECS/SPEC-042.md
```

## Output

Gera tasks em `.claude/tasks/queue.md`:

```markdown
## Task Queue — SPEC-042

### Fase 1: Setup
- [ ] Criar estrutura de diretorios
- [ ] Setup dependências
- [ ] Configurar ESLint/Prettier

### Fase 2: Backend
- [ ] Implementar schema do banco
- [ ] Criar API endpoints
- [ ] Adicionar autenticação JWT

### Fase 3: Frontend
- [ ] Setup React/Vite
- [ ] Criar componentes base
- [ ] Integrar API

### Fase 4: Testes
- [ ] Unit tests backend
- [ ] Integration tests
- [ ] E2E smoke tests

### Prioridade
1. setup → 2. backend → 3. frontend → 4. testes
```

## Bounded Context

**Faz:**
- Extrai tasks da SPEC
- Prioriza por dependencias
- Gera queue legivel

**Nao faz:**
- Executar as tarefas (use `/trabalhar`)
- Criar a SPEC (use `/spec`)
- Modificar codigo
