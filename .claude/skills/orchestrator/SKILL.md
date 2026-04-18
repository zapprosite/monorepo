---
name: orchestrator
description: Executa 14 agentes em paralelo para implementar SPECs — /spec → /pg → 14 agents → PR
trigger: /execute
version: 2.0.0
type: skill
---

# /execute — 14-Agent Orchestrator

## Objetivo

Executa o workflow completo: `/spec` → `/pg` → **14 agentes em paralelo** → PR no Gitea.

```
/execute "Build a user authentication module with JWT"
```

## Quando Usar

- Quando tens uma ideia e queres ir de zero a PR sem parar
- Substitui o antigo cursor-loop/computer-loop (agora eliminated)
- `/spec` e `/pg` continuam a funcionar sozinhos para debugging

## Fluxo

```
1. /spec "descrição"           → docs/SPECS/SPEC-NNN.md
2. /pg                          → tasks/pipeline.json
3. run-agents.sh                 → 14 agentes em paralelo
4. wait-for-completion.sh       → polling até todos terminarem
5. SHIPPER                      → cria PR via Gitea API
```

## Os 14 Agentes

| #   | Agent         | Command                                  | Função                            |
| --- | ------------- | ---------------------------------------- | --------------------------------- |
| 1   | SPEC-ANALYZER | `claude --agent /researcher`             | Lê SPEC.md, extrai AC + ficheiros |
| 2   | ARCHITECT     | `claude --agent /infra-from-spec`        | Revê arquitectura, flags issues   |
| 3   | CODER-1       | `claude --agent /backend-scaffold`       | Implementa backend                |
| 4   | CODER-2       | `claude --agent /frontend-design`        | Implementa frontend               |
| 5   | TESTER        | `claude --agent /test`                   | Escreve testes                    |
| 6   | SMOKE         | `claude --agent /smoke-test-gen`         | Gera smoke tests                  |
| 7   | SECURITY      | `claude --agent /minimax-security-audit` | Audit OWASP                       |
| 8   | DOCS          | `claude --agent /doc-maintenance`        | Actualiza docs                    |
| 9   | TYPES         | `pnpm tsc --noEmit`                      | Type check                        |
| 10  | LINT          | `pnpm lint`                              | Lint                              |
| 11  | SECRETS       | `claude --agent /se`                     | Scan secrets                      |
| 12  | GIT           | `claude --agent /commit`                 | Commits                           |
| 13  | REVIEWER      | `claude --agent /review`                 | Code review                       |
| 14  | SHIPPER       | `claude --agent /turbo`                  | Cria PR (espera pelos outros 13)  |

## Bounded Context

**Faz:**

- SPEC → PR completo em 14 agentes paralelos
- Coordinacão via filesystem (agent-states/)
- Error handling com SHIPPER como decisor final

**Nao faz:**

- Substituir CI/CD do Gitea (smoke tests, deploys)
- Auto-healing de serviços
- Operacoes de infra (Coolify, Terraform)

## Erro Handling

| Agente                 | Critical      | On Failure                  |
| ---------------------- | ------------- | --------------------------- |
| CODER-1, CODER-2       | **CRITICAL**  | Para pipeline, bloqueia PR  |
| TESTER, SECURITY       | IMPORTANT     | Avisa, continua, nota no PR |
| TYPES, LINT, SECRETS   | VERIFICATION  | Avisa, CI apanha            |
| GIT, REVIEWER, SHIPPER | ORCHESTRATION | SHIPPER decide              |

## Como Executar

```bash
/execute "Build a user authentication module with JWT"
```

Ou passo a passo:

```bash
/spec "Build a user authentication module with JWT"
# ... SPEC criado ...

/pg
# ... pipeline.json gerado ...

# Executar os 14 agentes manualmente:
bash .claude/skills/orchestrator/scripts/run-agents.sh docs/SPECS/SPEC-042.md
```

## Scripts

- `scripts/run-agents.sh` — Spawn 14 processos em paralelo
- `scripts/agent-wrapper.sh` — Wrapper por agente (claim → execute → mark)
- `scripts/wait-for-completion.sh` — Polls agent-states/ até todos completarem
