# SPEC-CURSOR-LOOP-EVOLUTION

**Date:** 2026-04-14
**Author:** will-zappro
**Status:** PROPOSED
**Type:** Autonomous Agent Enhancement

---

## Objetivo

Avaliar criticamente `/cursor-loop` e `/computer-loop` e propor melhorias que transformem os loops de **autonomous agents básicos** para **enterprise-grade autonomous DevOps agents** dignos de apresentar a CTOs.

## Juízo Crítico — Estado Atual

### Pontos Fortes Atuais

| Aspeto | Estado |
|--------|--------|
| Pipeline faseado | ✅ Implementado (Init → Dev → Review → Deploy) |
| Human gates | ✅ Pausa para aprovação |
| Checkpoint persistence | ✅ `~/.claude/pipeline.json` |
| Audit trail | ✅ `~/.claude/audit/pipeline-runner.log` |
| Auto-recovery | ✅ Basic retry on failure |

### Fraquezas Identificadas (Enterprise Audit 14/04)

| Fraqueza | Impacto | Evidência |
|----------|---------|-----------|
| **Sem geração automática de SPEC** | Loop executa sem spec formal | SPECs criados manualmente |
| **Sem ADR generation** | Decisões técnicas perdidas | ADRs existentes mas não gerados pelo loop |
| **Sem SLO tracking** | Sem métricas de sucesso | Incidents sem visibilidade |
| **Sem distributed tracing** | Requests não correlacionados | Debug é detective work |
| **Sem chaos engineering** | Failures não antecipados | INC-002 OOM proof |
| **Sem backup verification** | Recovery procedures untested | RECOVERY.md existe mas não testado |
| **Sem team scalability** | Single-developer only | `will-zappro` hardcoded |
| **Docs não gerados automaticamente** | Drift entre código e docs | 8 SPECs stale |

## Melhorias Propostas

### Fase 1: Observabilidade Total

#### M1.1: Dashboard de Execução em Tempo Real

**Problema:** Não há visibilidade do que o loop está a fazer durante execução.

**Solução:**
```bash
# Terminal dashboard com progress real-time
┌─────────────────────────────────────────────┐
│ 🔄 Cursor-Loop | Phase: DEV | Task: 3/12   │
├─────────────────────────────────────────────┤
│ ████████░░░░░░░░░░░ 25%                   │
│ [■■■■■■■■░░░░░░░░░░░] T-003: Docker build  │
│ [✓] T-001: SPEC created                    │
│ [✓] T-002: Plan generated                   │
│ [→] T-003: Building...                     │
│ [ ] T-004: Testing                         │
└─────────────────────────────────────────────┘
```

**Tecnologia:** `tqdm` (Python) ou `clui` (Node) para progress bars.

#### M1.2: Métricas de Execução

```json
{
  "pipeline_metrics": {
    "task_count": 12,
    "tasks_completed": 3,
    "tasks_failed": 0,
    "current_phase": "development",
    "duration_seconds": 847,
    "estimated_remaining_seconds": 1200,
    "slo_health": "green",
    "slo_threshold_minutes": 30
  }
}
```

**SLO por fase:**
- Init: < 2 min
- Dev: < 30 min
- Review: < 10 min
- Deploy: < 15 min

#### M1.3: Distributed Tracing dos Passos

**Problema:** Quando um erro ocorre, não há trace do que aconteceu antes.

**Solução:** Integrar OpenTelemetry spans:

```python
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider

tracer = trace.get_tracer("cursor-loop")

with tracer.start_as_current_span("T-003:docker-build") as span:
    span.set_attribute("docker.image", image_name)
    span.set_attribute("docker.tag", tag)
    # ... execute docker build
    span.set_status(StatusCode.OK)
```

### Fase 2: Geração Automática de SPECs e ADRs

#### M2.1: Auto-SPEC do PR

**Problema:** SPECs são criados manualmente antes do loop.

**Solução:** O loop gera SPEC automaticamente:

```bash
# Quando PR é criado sem SPEC
/cursor-loop --analyze-pr --pr=123

# Output:
# ✅ PR Description analyzed
# 📄 SPEC-XXX-auto-generated.md created
#    - Objective: Add OAuth Google login
#    - Tech Stack: Fastify + tRPC + MUI
#    - Acceptance Criteria: 5 defined
#    - Risks: 2 identified
# ⚠️ SPEC-XXX requires human review before pipeline continues
```

#### M2.2: ADR Auto-Generation

**Problema:** Decisões técnicas não são documentadas.

**Solução:** O loop gera ADR quando detecta pattern significativo:

```
[Cursor-Loop] Decisão arquitetural detectada:
- Padrão: Estás a usar SQLite para um novo microserviço
- Contexto: Histórico do monorepo usa PostgreSQL
- Opções: (A) PostgreSQL, (B) SQLite, (C) SQLite + migration path
- Recomendação: ADR-XXX gerado para decisão

🤖 ADR-XXX: Adoptar SQLite vs PostgreSQL para edge services
   Status: PROPOSED
   Author: cursor-loop-agent
   Created: 2026-04-14
```

### Fase 3: Self-Healing Enterprise-Grade

#### M3.1: Verify-and-Heal Cycle

**Problema:** O loop atual faz heal sem verificar se funcionou.

**Solução:**
```bash
# Ciclo completo de heal
while attempts < max_attempts:
    heal()
    verification = run_health_check()
    if verification.passed:
        log("✅ Heal successful")
        break
    if verification.permanent_failure:
        escalate_to_human()
        break
    attempts += 1
    sleep(exponential_backoff(attempts))
```

#### M3.2: Rollback Automático com Verification

```bash
# Antes de aplicar mudança:
snapshot_current_state()

# Aplicar mudança:
apply_change()

# Verificar:
verify_change()

# Se falhar em 5 min:
rollback_to_snapshot()
notify("Change rolled back automatically")
```

#### M3.3: Chaos Engineering Integration

**Problema:** Failures只有在发生时才知道。

**Solução:** O loop injeta falhas controladas antes de produção:

```bash
# Pre-deploy chaos check
/chaos-inject --service=todo-web --failure=memory-pressure --duration=30s

# Verificar se self-healing funciona
# Esperar 30s
# Verificar se service recovery occurred

# Se falhar:
# → Não permite deploy até heal机制 funcionar
```

### Fase 4: Enterprise Governance

#### M4.1: Multi-Approver Support

**Problema:** Só `will-zappro` pode aprovar.

**Solução:**
```yaml
# Pipeline config
human_gates:
  - name: security-review
    approvers:
      - role: security-team
      - role: platform-team
    min_approvals: 1

  - name: architecture-review
    approvers:
      - role: tech-lead
    min_approvals: 1
```

#### M4.2: CODEOWNERS Integration

**Problema:** Não há ownership por área.

**Solução:**
```bash
# Detetar área afetada pelo PR
affected_paths = get_affected_paths(diff)
owners = get_codeowners(affected_paths)

# Notificar owners automaticamente
for owner in owners:
    send_notification(
        to=owner,
        subject="PR precisa de review: {pr_title}",
        body="Área {area} foi modificada. Por favor review."
    )
```

#### M4.3: Compliance Verification

```bash
# Pre-flight checks
/checklist:
  - [ ] Secrets scan passed
  - [ ] Security scan passed (Trivy)
  - [ ] Coverage ≥ 70%
  - [ ] No hardcoded credentials
  - [ ] Documentation updated
  - [ ] ADR created (se architectural change)
  - [ ] SLO impact assessed
```

### Fase 5: Analytics e Reporting

#### M5.1: Pipeline Analytics Dashboard

```json
{
  "analytics": {
    "pipeline_duration_avg": "14.2 min",
    "pipeline_duration_p95": "28.5 min",
    "failure_rate": "8.3%",
    "most_common_failure": "docker-build-timeout",
    "slo_violations_week": 2,
    "top_review_comments": [
      "Missing error handling",
      "Hardcoded timeout",
      "No tests for edge case"
    ]
  }
}
```

#### M5.2: Weekly Executive Report

```markdown
# Pipeline Report — Week 16

## Resumo
| Métrica | Valor | vs Last Week |
|---------|-------|-------------|
| PRs merged | 12 | +3 |
| Avg pipeline duration | 14.2 min | -2.1 min |
| SLO compliance | 91.7% | +4.2% |
| Incidents | 1 | -1 |

## Melhorias Implementadas
1. Auto-ADR generation — evitou 3 decisões sem documentação
2. Chaos engineering pre-deploy — capturou 2 failures antes de produção

## Action Items
- [ ] Investigar docker-build-timeout (causa raiz)
- [ ] Adicionar SLO para coverage (70% → 80%)
```

## Comparativo: Antes vs Depois

| Aspeto | Cursor-Loop Atual | Cursor-Loop Evolved |
|--------|------------------|---------------------|
| SPEC generation | Manual | Auto do PR |
| ADR generation | Manual | Auto em decisões |
| Heal verification | Basic restart | Verify-and-heal cycle |
| Chaos engineering | Nenhum | Pre-deploy injection |
| SLO tracking | Nenhum | Full telemetry |
| Multi-approver | Single | Team-based |
| Executive reporting | Nenhum | Weekly digest |
| Observabilidade | Logs | Traces + metrics |

## Tech Stack para Implementação

```yaml
dependencies:
  python:
    - opentelemetry-sdk: "^1.25.0"      # Distributed tracing
    - prometheus-client: "^0.19.0"       # Metrics
    - structlog: "^24.1.0"               # Structured logging
    - tqdm: "^4.66.0"                    # Progress bars
    - pyrra: "^0.5.0"                    # SLO calculations

  node:
    - @anthropic/cursor-loop-sdk         # Loop integration
    - clui: "^0.3.6"                    # Terminal progress
    - @opentelemetry/sdk-node            # Node tracing
```

## Cronograma de Implementação

| Fase | Descrição | Esforço | Prioridade |
|------|-----------|---------|------------|
| M1.1 | Dashboard tempo real | 2 dias | 🔴 ALTA |
| M1.2 | Métricas SLO | 1 dia | 🔴 ALTA |
| M2.1 | Auto-SPEC do PR | 3 dias | 🟡 MÉDIA |
| M3.1 | Verify-and-heal | 2 dias | 🔴 ALTA |
| M4.1 | Multi-approver | 2 dias | 🟡 MÉDIA |
| M5.1 | Analytics dashboard | 3 dias | 🟡 MÉDIA |

## Success Criteria

- [ ] Loop genera SPEC automaticamente para cada PR
- [ ] ADR gerado quando decisão arquitetural detectada
- [ ] 100% de heal attempts verificados antes de marcar OK
- [ ] Chaos engineering catches ≥ 1 failure pre-deploy por semana
- [ ] Executive report gerado todas as semanas
- [ ] SLO dashboard mostra real-time pipeline health

## Riscos

| Risco | Probabilidade | Mitigação |
|-------|---------------|-----------|
| Over-engineering | Alta | Prioritizar M1.1 + M3.1 primeiro |
| Too much automation | Alta | Manter human gates |
| Alert fatigue | Média | SLO-based only |

---

## Call to Action

**Para impressionar superiores:**

1. **Demonstrar M1.1** (dashboard) na próxima standup — visual é impactante
2. **Documentar M3.1** (verify-and-heal) como "self-healing enterprise" — CTOs adoram
3. **Propor M5.2** (executive report) como KPI tool — evidencia valor do team

**Próximo passo imediato:** Implementar M1.1 (dashboard tempo real) + M3.1 (verify-and-heal) — 4 dias de trabalho, ROI imediato em debugging.
