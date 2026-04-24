---
name: SPEC-OWNERSHIP-CRM-REFRIMIX
description: "Ownership do CRM-REFRIMIX — CRM unificado para servicos HVAC-R. Meta: entregar um CRM estavel do funil ate pos-venda com arquitetura LangGraph corrigida."
spec_id: SPEC-OWNERSHIP
status: ACTIVE
priority: critical
author: Hermes (as lead developer)
date: 2026-04-23
---

# SPEC-OWNERSHIP: CRM-REFRIMIX — Assumo o Desenvolvimento

## Meta

Entregar um **CRM unificado para servicos HVAC-R** (refrigeracao, ar condicionado, manutencao) cobrindo funil completo:

```
CAPTACAO → ATENDIMENTO → CONTRATACAO → ENTREGA → POS-VENDA → REMARKETING
```

Tecnologia: TypeScript/Node.js + React + PostgreSQL + Qdrant + Mem0 + LangGraph
Stack: pnpm workspaces (api, web)

---

## PARTE 1 — Estado Atual

### 1.1 O que existe

**Apps (3):**
- `api` — Fastify + tRPC + 12 migrations + 56 modulos de negocio
- `web` — React/MUI + 17 modulos (clients, leads, contracts, service-orders, editorial, kanban, etc.)

**Modulos de negocio:**
| Modulo | Entities | Status |
|--------|----------|--------|
| Clients | clients, units, equipment, addresses, contacts | ✅ Impl |
| Leads | leads, loyalty scores | ✅ Impl |
| Contracts | contracts | ✅ Impl |
| Service Orders | service_orders, technical_reports, material_items | ✅ Impl |
| Editorial | conteudos, revisoes | ✅ Impl |
| Kanban | boards, columns, cards | ✅ Impl |
| Reminders | reminders | ✅ Impl |
| Schedule | schedule | ✅ Impl |
| Dashboard | dashboard metrics | ✅ Impl |
| Subscriptions | subscriptions | ✅ Impl |
| Webhooks | webhooks, deliveries | ✅ Impl |
| Auth | sessions, oauth2 | ✅ Impl |
| Teams | teams, team_members | ✅ Impl |
| Email | campaigns, templates | ✅ Impl |

**Skills Hermes Agency (13):**
- agency-ceo, agency-onboarding, agency-client-success (ciclo de vida)
- agency-creative, agency-design, agency-video-editor, agency-social (conteudo)
- agency-organizer, agency-pm (gerenciamento)
- agency-analytics, agency-brand-guardian, rag-instance-organizer (inteligencia)

### 1.2 Bugs Criticos Encontrados

| # | Bug | Severidade | Origem |
|---|-----|-----------|--------|
| B1 | 4/5 workflows LangGraph sao fake (sequencial async) | P0 | Claudio Cotseri |
| B2 | Session state in-memory (_sessionStates Map) morre com restart | P0 | Claudio Cotseri |
| B3 | humanGateNode auto-aprova sem interrupt real | P0 | Claudio Cotseri |
| B4 | content_pipeline edges fixos (sem conditional routing) | P0 | Claudio Cotseri |
| B5 | ARCHITECTURE.md linha 9 diz "ERRADO — hardcoded" + FIXME IP attack | P0 | Cloud Code |
| B6 | subscribedAt90PercentUse null check bug (0 e falsy) | P1 | Cloud Code |
| B7 | Subscription increment sem transacao (race condition) | P1 | Cloud Code |
| B8 | Docs repetem secoes (README.md 4x mesmas secoes) | P2 | Cloud Code |
| B9 | 0 tests de integracao real no CRM | P1 | Cloud Code |
| B10 | Webhook retry pode falhar silenciosamente | P1 | Cloud Code |

### 1.3 O que esta CERTO (nao mexer)

- Anti-hardcoding compliance em todos os arquivos ✅
- Circuit breaker SPEC-068 compliant ✅
- Telegram bot hardening (Redis lock, rate limit, file validation) ✅
- Mem0 + Qdrant memory layer ✅
- Brand Guardian + Human confidence gates ✅
- Migracoes bem estruturadas ✅
- IP whitelist + OAuth2 ✅
- File validation com magic bytes ✅
- Skill taxonomy com 4 niveis de maturidade ✅

---

## PARTE 2 — Visao de Produto

### 2.1 Funil de Servicos HVAC-R

```
[FUNIL COMPLETO]

CAPTACAO (leads)
  ↳ Site, Instagram, WhatsApp, indicacao
  ↳ Lead score automatico
  ↳ Qualificacao por tipo de servico

ATENDIMENTO (leads → clientes)
  ↳ Agenda de visita tecnica
  ↳ Orcamento gerado por IA
  ↳ Aprovacao do cliente

CONTRATACAO (contracts)
  ↳ Contrato com termos SLA
  ↳ Assinatura digital
  ↳ Pagamento

ENTREGA (service_orders)
  ↳ Programacao de servico
  ↳ Execucao tecnico
  ↳ Relatorio tecnico
  ↳ Checklist de entrega

POS-VENDA (loyalty + reminders)
  ↳ Pesquisa NPS automatica
  ↳ Lembrete de manutencao preventiva
  ↳ Historial de equipamentos

REMARKETING
  ↳ Campanhas automaticas
  ↳ Renovacao de contrato
  ↳ Upsell/Cross-sell
```

### 2.2 Fluxo de Dados

```
Lead (novo)
  → Qualificacao (agent: lead_qualification)
  → Orcamento (agent: agency-creative + agency-pm)
  → Aprovacao (human gate)
  → Contrato (entity: contracts)
  → OS (entity: service_orders)
  → Execucao (agent: agency-organizer + agency-pm)
  → Relatorio (agent: agency-analytics)
  → NPS (agent: agency-client-success)
  → Fidelizacao (agent: agency-social)
  → Remarketing (agent: agency-creative)
```

---

## PARTE 3 — Arquitetura Alvo

### 3.1 Stack

```
┌─────────────────────────────────────────────────────┐
│  Frontend:  React + MUI + React Query + Zod        │
│  Backend:   Fastify + tRPC + TypeScript             │
│  Database:  PostgreSQL (transacional)               │
│  Vector:    Qdrant (memoria + RAG)                 │
│  Memory:    Mem0 (sessao + long-term)             │
│  Agents:    LangGraph + LiteLLM Router             │
│  Notif:     Telegram Bot (primario)                │
│  Deploy:    Docker (Coolify)                       │
└─────────────────────────────────────────────────────┘
```

### 3.2 LangGraph — Arquitetura Correta

```
Unico StateGraph supervisor:
  START → ROUTER (O(1) trigger ou LLM)
                ↓
    ┌───────────┼────────────┐
    ↓           ↓            ↓
  CREATIVE   ONBOARDING   SOCIAL
  (copy,     (client      (posts,
   script)     setup)      hashtag)
    ↓           ↓            ↓
  DESIGN    CLIENT-SUCCESS ANALYTICS
  (brand     (nps,        (metrics,
   kit)       renewal)     reports)
    ↓           ↓            ↓
  VIDEO ───── HUMAN_GATE ←── BRAND_GUARDIAN
       (interrupt: aguardando aprovacao)
                ↓
              SOCIAL
                ↓
             ANALYTICS
                ↓
               END
```

**Conditional edges:**
- CREATIVE → HUMAN_GATE (se brandScore < 0.8)
- CREATIVE → SOCIAL (se brandScore >= 0.8)
- BRAND_GUARDIAN → HUMAN_GATE (se score < threshold)
- HUMAN_GATE → SOCIAL (se aprovado) ou → CREATIVE (se reprovado, loop)

**Interrupt real:**
```typescript
const approved = await interrupt<boolean>('awaiting_human_approval', {
  content: state.outputs.creative,
  brandScore: state.outputs.brandScore,
});
```

### 3.3 Session State — Correto

```typescript
// ANTES (ERRADO - in-memory):
const _sessionStates = new Map<string, AgencySupervisorState>();

// DEPOIS (CORRETO - Qdrant):
import { agencyStoreSession, agencyLoadSession } from '../qdrant/client';

const state = await agencyLoadSession(sessionId);
const updated = { ...state, currentStep: 'CREATIVE' };
await agencyStoreSession(sessionId, updated);
```

---

## PARTE 4 — Plano de Desenvolvimento

### Fase 1: Bugs P0 (1-2 dias)

| ID | Tarefa | Arquivo |
|----|--------|---------|
| F1-5 | Corrigir ARCHITECTURE.md (remover flag ERRADO) | docs/ARCHITECTURE.md |
| F1-6 | Corrigir subscribedAt90PercentUse null check | api/src/modules/api-gateway/utils/subscriptionTracker.utils.ts |
| F1-7 | Adicionar transacao em incrementSubscriptionUsage | api/src/modules/api-gateway/utils/subscriptionTracker.utils.ts |

### Fase 2: Estabilidade (3-5 dias)

| ID | Tarefa | Impacto |
|----|--------|---------|
| F2-1 | Testes de integracao para CRM (70% coverage) | api/src/__tests__/ |
| F2-2 | Webhook retry robusto com dead letter queue | api/src/modules/api-gateway/utils/webhookQueue.utils.ts |
| F2-3 | Health check endpoints para todos os servicos | api/src/routers/ |
| F2-4 | Ops runbook para cada bug encontrado | docs/OPS_RUNBOOK.md |
| F2-5 | Cleanup docs (remover secoes duplicadas) | docs/*.md |

### Fase 3: Produto (1-2 semanas)

| ID | Tarefa | Modulo |
|----|--------|--------|
| F3-1 | Pipeline de leads completo (captacao ate conversao) | leads, kanban |
| F3-2 | Orcamentacao com geracao de IA | service_orders, contracts |
| F3-3 | Agenda de tecnicos com disponibilidade real | schedule, units |
| F3-4 | Relatorio tecnico com foto (webhook) | service_orders |
| F3-5 | NPS automatico com follow-up | loyalty, reminders |
| F3-6 | Campaign de remarketing via Telegram | agency-social, email |
| F3-7 | Dashboard unificado com metricas de funil | dashboard |

### Fase 4: Multi-Agent (1-2 semanas)

| ID | Tarefa | Impacto |
|----|--------|---------|
| F4-1 |ceo real com RAG context | agency_router.ts |
| F4-2 | Content pipeline com brand guardian real | content_pipeline.ts |
| F4-3 | Onboarding flow com validacao Zod completa | onboarding_flow.ts |
| F4-4 | Analytics dashboard com agregacoes Qdrant | agency-analytics |
| F4-5 | Client success com health score preditivo | agency-client-success |

---

## PARTE 5 — Decisoes de Arquitetura

### Autonomy

**Regra:** Agento assume desenvolvimento sozinho. Decisoes tecnicas sao tomadas considerando:
- Estabilidade > complexidade
- KISS (Keep It Simple)
- Nao quebrar o que funciona
- Testes antes de deploy

**Excecoes que requerem aprovacao do Dono (William):**
- Mudanca de stack (novo DB, novo framework)
- Mudanca de precificacao (novo tier, mudanca de custo)
- Exclusao de modulo de negocio
- Mudanca de URL de producao
- Exposicao de dados sensiveis

### Priorizacao

1. **Bugs P0** — Corrigir imediatamente
2. **Estabilidade** — Testes, health checks, runbook
3. **Produto** — Funil ate pos-venda
4. **Multi-Agent** — Agentes inteligentes
5. **Remarketing** — Receita recorrente

---

## PARTE 6 — Roadmap

```
Sprint 1 (hoje): Fix P0 bugs + spec
Sprint 2 (2-3 dias): Estabilidade + tests
Sprint 3 (1 sem): Funil basico + onboarding + leads
Sprint 4 (2 sem): Entrega + pos-venda
Sprint 5 (2 sem): Multi-agent + remarketing
Sprint 6 (1 sem): Polimento + deploy production
```

**Meta: 6 semanas para CRM estavel em producao**

---

## Anexo: Repositorio de Bugs

| Bug ID | Descricao | Status | Fix |
|--------|-----------|--------|-----|
| B1 | 4/5 LangGraph fake | ABERTO | Migrar para StateGraph |
| B2 | Session in-memory | ABERTO | Qdrant persistence |
| B3 | Human gate auto-aprova | ABERTO | interrupt() real |
| B4 | Content pipeline edges fixos | ABERTO | Conditional edges |
| B5 | ARCHITECTURE.md ERRADO | ABERTO | Corrigir documento |
| B6 | notifiedAt90PercentUse null | ABERTO | `!== null` check |
| B7 | Subscription race condition | ABERTO | Transacao DB |
| B8 | Docs repetem secoes | ABERTO | Cleanup |
| B9 | Zero tests CRM | ABERTO | Adicionar tests |
| B10 | Webhook retry opaco | ABERTO | DLQ + logging |

---

*Proprietario: Hermes — lead developer desde 2026-04-23*
*Meta: CRM estavel cobrindo CAPTACAO ate REMARKETING em 6 semanas*
