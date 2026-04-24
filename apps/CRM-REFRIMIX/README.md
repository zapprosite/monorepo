# CRM-REFRIMIX

CRM unificado para serviços HVAC-R (refrigeração, ar condicionado, manutenção) cobrindo funil completo:

```
CAPTACAO → ATENDIMENTO → CONTRATACAO → ENTREGA → POS-VENDA → REMARKETING
```

## Tech Stack

- **Backend:** Fastify + tRPC + TypeScript
- **Frontend:** React + MUI + React Query + Zod
- **Database:** PostgreSQL (transacional)
- **Vector:** Qdrant (memória + RAG)
- **Memory:** Mem0 (sessão + long-term)
- **Agents:** LangGraph + LiteLLM Router
- **Notifications:** Telegram Bot (primário)
- **Deploy:** Docker (Coolify)

## Apps

| App | Description |
|-----|-------------|
| `api` | Fastify + tRPC + 12 migrations + 56 módulos de negócio |
| `web` | React/MUI + 17 módulos (clients, leads, contracts, etc.) |

## Modules

| Módulo | Entities | Status |
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

## Testing

```bash
# Smoke tests
pytest tests/smoke/

# Integration tests
pytest tests/integration/
```

## Bugs

| ID | Bug | Severidade | Status |
|----|-----|-----------|--------|
| B1 | LangGraph workflows fake | P0 | ✅ Corrigido |
| B2 | Session state in-memory | P0 | ✅ Corrigido |
| B3 | humanGateNode auto-aprova | P0 | ✅ Corrigido |
| B4 | Content pipeline edges fixos | P0 | ✅ Corrigido |
| B5 | ARCHITECTURE.md ERRADO | P0 | ✅ Corrigido |
| B6 | subscribedAt90PercentUse null | P1 | ✅ Corrigido |
| B7 | Subscription race condition | P1 | ✅ Corrigido |
| B8 | Docs repetem secoes | P2 | ✅ Verificado (não aplicável) |
| B9 | Zero tests CRM | P1 | ✅ Corrigido |
| B10 | Webhook retry opaco | P1 | ✅ Corrigido |
