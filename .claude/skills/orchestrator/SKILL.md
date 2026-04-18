---
name: orchestrator
description: Executa 14 agentes em paralelo para implementar SPECs — /spec → /pg → 14 agents → PR
trigger: /execute
version: 2.0.0
type: skill
---

# /execute — 14-Agent Orchestrator (SPEC-071 Enterprise)

## Objetivo

Executa o workflow completo: `/spec` → `/pg` → **14 agentes em paralelo** → PR no Gitea.
**SPEC-071 Enterprise** adiciona 7 dominios de operacao ao orchestrator.

```
/execute "Build a user authentication module with JWT"
```

## SPEC-071 — 7 Domínios Enterprise

| Dominio | Scripts/Ficheiros | Função |
|---------|-------------------|--------|
| **V1 Version Lock** | `versions-check.sh`, `versions-update.sh` | Drift detection + version sync |
| **V2 Orchestrator v2** | `circuit_breaker.sh`, `reentrancy_lock.sh`, `dead_letter.sh` | Circuit breaker (3 retries, exp backoff), PID lock, DLQ |
| **V3 Observability** | `trace_id.sh`, `metrics_collector.sh` | UUID por pipeline, Prometheus exporter |
| **V4 Rollback Engine** | `snapshot.sh`, `rollback.sh` | Snapshot state antes de cada agent, restore |
| **V5 Capacity Planner** | `capacity_calculator.sh`, `auto_throttle.sh` | RAM/CPU calculation, MAX_PARALLEL auto-throttle |
| **V6 Cost Engine** | `track_cost.sh`, `model_fallback.sh`, `.orchestrator/budget.yml` | LLM cost tracking, model fallback chain |
| **V7 Runbooks** | `docs/OPS/RUNBOOKS/*.md` | P1-P4 alerts + ORCHESTRATOR-FAILURE + PIPELINE-ROLLBACK |

## agent-wrapper.sh Integration Flow (V2→V4)

```
reentrancy_lock.sh    →  snapshot.sh  →  execute  →  dead_letter.sh (on failure)
(PID lock)             (state snapshot)             (DLQ after 3 fails)
```

## Quando Usar

- Quando tens uma ideia e queres ir de zero a PR sem parar
- Substitui o antigo cursor-loop/computer-loop (agora deprecated)
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
- Version lock, circuit breaker, reentrancy lock, snapshots, rollback, capacity, cost

**Nao faz:**

- Substituir CI/CD do Gitea (smoke tests, deploys)
- Auto-healing de serviços (runbooks são manuais, não automatizados)
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

## Scripts (SPEC-071)

| Script | Dominio | Descrição |
|--------|---------|-----------|
| `run-agents.sh` | Core | Spawn 14 processos em paralelo |
| `agent-wrapper.sh` | Core | Wrapper por agente (lock → snapshot → execute → DLQ) |
| `wait-for-completion.sh` | Core | Poll agent-states/ até todos completarem |
| `versions-check.sh` | V1 | Deteta drift de versões pinned |
| `versions-update.sh` | V1 | Sincroniza versões para match |
| `circuit_breaker.sh` | V2 | Circuit breaker com 3 retries + exp backoff |
| `reentrancy_lock.sh` | V2 | PID lock por pipeline ID |
| `dead_letter.sh` | V2 | DLQ after 3 failures |
| `trace_id.sh` | V3 | Gera UUID por pipeline |
| `metrics_collector.sh` | V3 | Prometheus exporter |
| `snapshot.sh` | V4 | Snapshot state antes de cada agent |
| `rollback.sh` | V4 | Restore state from snapshot |
| `capacity_calculator.sh` | V5 | Calcula RAM/CPU disponíveis (JSON output) |
| `auto_throttle.sh` | V5 | Auto-throttle MAX_PARALLEL baseado em recursos |
| `track_cost.sh` | V6 | Regista custo LLM por pipeline |
| `model_fallback.sh` | V6 | Modelo fallback quando budget exceeded |

## Ficheiros de Configuração

| Ficheiro | Dominio | Descrição |
|----------|---------|-----------|
| `.orchestrator/budget.yml` | V6 | Budget $0.50/pipeline, alert 80%, model fallback chain |
| `.orchestrator/cost-tracking.json` | V6 | Cost data por pipeline e modelo |
| `docs/OPS/CAPACITY.md` | V5 | Capacity planner usage guide |
| `docs/OPS/COST-CONTROL.md` | V6 | Cost engine usage guide |
| `docs/OPS/RUNBOOKS/README.md` | V7 | Runbook registry |