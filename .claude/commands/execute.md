---
description: SPEC → PG → 14 agentes paralelos → PR. Workflow completo para implementar specs.
argument-hint: <descrição-da-feature>
---

# /execute — 14-Agent Orchestrator

## Uso

```bash
/execute Build a user authentication module with JWT
/execute criar dashboard de métricas com Prometheus
/execute adicionar autenticação OAuth com Google
```

## O que acontece

1. **`/spec <desc>`** → cria `docs/SPECS/SPEC-NNN.md`
2. **`/pg`** → gera `tasks/pipeline.json`
3. **14 agentes em paralelo** → executam as tarefas do pipeline
4. **SHIPPER** → cria PR no Gitea quando todos completam

## Os 14 Agentes

| #   | Agent         | O que faz                           |
| --- | ------------- | ----------------------------------- |
| 1   | SPEC-ANALYZER | Analisa SPEC, extrai AC e ficheiros |
| 2   | ARCHITECT     | Revê arquitectura e flags issues    |
| 3   | CODER-1       | Implementa backend (Fastify/tRPC)   |
| 4   | CODER-2       | Implementa frontend (React/MUI)     |
| 5   | TESTER        | Escreve testes                      |
| 6   | SMOKE         | Gera smoke tests                    |
| 7   | SECURITY      | Audit OWASP + secrets               |
| 8   | DOCS          | Actualiza documentação              |
| 9   | TYPES         | TypeScript check                    |
| 10  | LINT          | Lint                                |
| 11  | SECRETS       | Scan secrets                        |
| 12  | GIT           | Commits changes                     |
| 13  | REVIEWER      | Code review final                   |
| 14  | SHIPPER       | Cria PR (espera pelos outros 13)    |

## Como funciona

```
/execute "desc"
  → /spec "desc"                # cria SPEC.md
  → /pg                         # gera pipeline.json
  → bash .claude/skills/orchestrator/scripts/run-agents.sh SPEC-NNN.md
      → 14 procesos claude --agent em paralelo
      → cada um escreve em tasks/agent-states/{AGENT}.json
  → SHIPPER aguarda todos
  → SHIPPER cria PR via Gitea API
```

## Error Handling

- **CODER-1 ou CODER-2 falha** → PR bloqueado
- **TESTER ou SECURITY falha** → PR criado com warnings
- **TYPES/LINT/SECRETS falha** → CI apanha no Gitea Actions

## Monitorização

```bash
# Ver estados dos agentes
ls tasks/agent-states/

# Ver log de um agente
cat .claude/skills/orchestrator/logs/{AGENT}.log

# Esperar todos completarem
bash .claude/skills/orchestrator/scripts/wait-for-completion.sh
```

## Scripts

- `orchestrator/scripts/run-agents.sh` — Spawn 14 agentes
- `orchestrator/scripts/agent-wrapper.sh` — Wrapper por agente
- `orchestrator/scripts/wait-for-completion.sh` — Poll até completarem
