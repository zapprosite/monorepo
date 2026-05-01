# PRD Template — Autonomous Feature Development

> Use this template when starting a new feature. Complete all sections before any code is written.

---

## 1. Problema

**O que está quebrado / incompleto?**
Describe o problema em 1-3 frases. Sem solução ainda.

---

## 2. Solução Proposta

**O que você quer que aconteça?**
Descreva a solução sem tecnologia ainda — só o resultado desejado.

---

## 3.-brainstorm

```
Anotações livres — sem filtro, quantity over quality.

Ideia 1:
Ideia 2:
Ideia 3:
...
```

---

## 4. Decision Tree

| Opção | Prós | Contras | Decision |
|-------|------|---------|----------|
| A | | | ❌/✅ |
| B | | | ❌/✅ |

**Selected approach:** [Why this one]

---

## 5. Scope

**In Scope:**
- [ ]

**Out of Scope:**
- [ ]

---

## 6. Acceptance Criteria

1. Quando [condição], então [resultado]
2. ...
3. ...

---

## 7. Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Frontend | | |
| Backend | | |
| Database | | |
| Infra | | |

---

## 8. Human Gates

| Task ID | Gate | Reason |
|---------|------|--------|
| T00 | REQUIRES_HUMAN | PRD approval — humana decide se vale |
| Tnn | REQUIRES_HUMAN | [reason] |
| Tnn | AUTO | [reason] |
| Final | REQUIRES_HUMAN | Review final antes de merge |

**Rule:** Se não está marcado REQUIRES_HUMAN, é AUTO — agente faz sem perguntar.

---

## 9. Execution Block

```yaml
execution:
  # Workers e Rate Limit
  max_workers: 5                    # max workers paralelo
  rate_limit_rpm: 500               # MiniMax 500 rpm ou definir outro
  context_window: 240000             # tokens (MiniMax 240k)

  # Comportamento
  context_reset_per_task: true       # cada task começa fresh
  ci_retry_loop: true               # loop até CI passar
  smoke_threshold: PASS             # smoke passing = ok sem humano

  # Fases
  phases: [plan, do, verify]        # reduzido de PREVC 5 fases

  # Snapshot
  snapshot_interval: 3              # snapshot a cada N tasks

  # Notificações
  notify_on: [COMPLETE, FAIL]       # email em COMPLETE ou FAIL
  notify_email: zappro.ia@gmail.com

  # Subdomain (se aplicável)
  deploy_subdomain: false
  # deploy_subdomain: "my-app"      # descomente se precisa deploy
  # deploy_url: "http://localhost:3001"
```

---

## 10. Task Breakdown

| Task ID | Description | Complexity | Gate |
|---------|-------------|------------|------|
| T00 | PRD approval | - | REQUIRES_HUMAN |
| T01 | | LOW/MED/HIGH | |
| T02 | | LOW/MED/HIGH | |
| T03 | | LOW/MED/HIGH | |
| Final | Human review | HIGH | REQUIRES_HUMAN |

**Complexity guide:**
- LOW: lint fix, typo, comment, rename → never call human
- MED: new function, small refactor, test write → 3 retries then call human
- HIGH: API endpoint, security change, multi-file → human gate at start

---

## 11. Smoke Tests

```bash
# List smoke tests to run after build
# Each must exit 0 for task to be considered PASSED

echo "TASK_NAME=my-task"
echo "smoke_001: curl -sf http://localhost:3000/health | grep OK"
echo "smoke_002: ./scripts/smoke_lint.sh"
```

---

## 12. Anti-Patterns (não fazer)

- Não usar contexto de tasks anteriores para tasks novas
- Não fazer "assumção" — se não sabe, pergunta
- Não agregar humanos no meio do loop (só T00 e Final)
- Não deixar context window crescer — resetar sempre

---

## Metadata

| Field | Value |
|-------|-------|
| Name | PRD-NNN |
| Owner | will@zappro.site |
| Created | YYYY-MM-DD |
| Status | draft → approved → executing → complete |

---

## Checkout

- [ ] PRD completo com todas seções
- [ ] Human gates marcados explicitamente
- [ ] Smoke tests definidos
- [ ] Execution block preenchido
- [ ] Owner aprovou T00 (PRD approval)