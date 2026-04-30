---
spec_id: SPEC-001
title: "MVP CRM Serviços — Dark Mode + Verde Ácido"
status: active
owner: will
priority: P0
created: 2026-04-30
---

# SPEC-001 — MVP CRM para Serviços Técnicos

## 1. Visão

Criar um CRM minimalista e funcional para empresas de serviços técnicos (HVAC, refrigeração, manutenção), baseado no **Twenty CRM** (open source, 45.3k stars), com tema **dark mode + verde ácido (#39FF14)**. O foco é simplicidade e velocidade — apenas as funcionalidades essenciais para captar leads, converter em clientes, agendar serviços e acompanhar contratos.

## 2. Contexto & Decisões

### 2.1 Por que Twenty CRM?
- **Stack moderna**: TypeScript, React 19, NestJS, PostgreSQL, Redis — igual ao nosso ecossistema
- **Comunidade ativa**: 45.3k stars, releases frequentes, documentação boa
- **Arquitetura extensível**: Sistema de "objects", "views" e "apps" que permite customização via código
- **AI-ready**: Desenhado para integração com AI agents

### 2.2 Arquivamento do CRM Legado
O CRM atual (monorepo apps/web + apps/api) foi movido para branch `archive/crm-legacy-20260430`. As ideias e regras de negócio foram extraídas e simplificadas neste SPEC.

### 2.3 Funcionalidades do Legado → MVP
| Legado | MVP | Motivo |
|--------|-----|--------|
| 16 módulos | 5 módulos | Foco no core |
| 36 tabelas | 8 tabelas | Simplicidade |
| Equipamentos/Unidades | ❌ Removido | Específico HVAC, adicionar depois |
| Ordens de Serviço | ❌ Removido | Complexo, adicionar depois |
| Kanban | ❌ Removido | Não essencial |
| Calendário Editorial | ❌ Removido | Marketing, não core |
| Journal Entries | ❌ Removido | Diário pessoal |
| RAG/Trieve | ❌ Removido | AI avançada, adicionar depois |

## 3. Funcionalidades (Módulos)

### Módulo 1: Dashboard
- KPIs: Total Clientes, Leads Ativos, Contratos Ativos, Lembretes Pendentes, Agenda Hoje
- Listas rápidas: Próximos agendamentos, Lembretes pendentes, Contratos recentes
- Layout: Cards minimalistas, dark mode, verde ácido para destaques

### Módulo 2: Leads (Pipeline Comercial)
- CRUD completo
- Pipeline de status: **Novo → Contato → Qualificado → Proposta → Negociação → Ganho/Perdido**
- Campos: Nome, Email, Telefone, Origem, Responsável, Observações, Valor estimado
- Ação: **Converter Lead → Cliente** (automático, preserva histórico)
- Filtros: Por status, origem, responsável, busca textual

### Módulo 3: Clientes
- CRUD completo
- Campos: Nome, Tipo (PF/PJ), Documento (CPF/CNPJ), Email, Telefone, Endereço
- Tags: Categorização livre (ex: "VIP", "Inadimplente", "Recorrente")
- Status: Ativo / Inativo
- Relacionamentos: Visualizar leads que originaram, contratos, agendamentos

### Módulo 4: Agenda (Serviços)
- CRUD de agendamentos vinculados a cliente
- Campos: Cliente, Data/Hora, Tipo (Instalação, Manutenção, Visita Técnica, Emergência), Técnico responsável, Status, Observações
- Workflow de status: **Agendado → Confirmado → Em Andamento → Concluído / Cancelado**
- Visualização: Lista + Calendário (semana/mês)
- Notificações: Lembretes automáticos

### Módulo 5: Contratos
- CRUD vinculado a cliente
- Campos: Cliente, Tipo (Comercial, Manutenção, Residencial), Valor, Frequência (Mensal/Trimestral/Semestral/Anual), Data início, Data fim
- Workflow de status: **Rascunho → Ativo → Suspenso / Encerrado / Cancelado**
- Renovação: Alerta automático 30 dias antes do vencimento

### Módulo 6: Lembretes (Follow-ups)
- CRUD vinculado a cliente
- Campos: Cliente, Título, Tipo (Ligação, Email, Visita, Renovação), Data, Status
- Workflow: **Pendente → Concluído / Cancelado**
- Integração: Aparecem no Dashboard e podem gerar agendamentos

## 4. Design System

### 4.1 Cores (Dark Mode)
| Token | Valor | Uso |
|-------|-------|-----|
| `--bg-primary` | `#0A0A0F` | Fundo principal |
| `--bg-secondary` | `#12121A` | Cards, painéis |
| `--bg-tertiary` | `#1A1A25` | Hover, inputs |
| `--accent` | `#39FF14` | Verde ácido — ações primárias, destaques |
| `--accent-dim` | `#2ECC71` | Verde mais suave — estados sucesso |
| `--text-primary` | `#FFFFFF` | Texto principal |
| `--text-secondary` | `#A0A0B0` | Texto secundário |
| `--text-muted` | `#6B6B7B` | Placeholders, desabilitado |
| `--danger` | `#FF4757` | Erros, exclusão |
| `--warning` | `#FFA502` | Alertas |
| `--info` | `#1E90FF` | Informações |

### 4.2 Tipografia
- **Fonte**: Inter (Google Fonts)
- **Tamanhos**: 
  - Título H1: 32px / bold
  - Título H2: 24px / semibold
  - Body: 14px / regular
  - Caption: 12px / medium
  - KPI Value: 48px / bold / verde ácido

### 4.3 Componentes Base
- **Botões**: Radius 8px, border 1px solid rgba(57,255,20,0.3), hover com glow verde
- **Cards**: Radius 12px, bg `#12121A`, border 1px solid rgba(255,255,255,0.05)
- **Inputs**: Radius 8px, bg `#1A1A25`, border 1px solid rgba(255,255,255,0.1), focus border verde ácido
- **Tabela**: Linhas alternadas, hover com bg rgba(57,255,20,0.05)
- **Status badges**: Pill format, cores conforme o status

## 5. Arquitetura Técnica

### 5.1 Stack
| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 19 + Vite + TanStack Query + React Router + Tailwind CSS |
| Backend | NestJS + tRPC + PostgreSQL + Redis |
| Auth | OAuth2 Google (dev bypass via X-Dev-User header) |
| Deploy | Docker Compose + Cloudflare Tunnel |
| Monorepo | Nx (mesma estrutura do Twenty) |

### 5.2 Estrutura de Pastas
```
crm-mvp/
├── apps/
│   ├── web/              # Frontend React
│   └── api/              # Backend NestJS
├── packages/
│   ├── ui/               # Componentes compartilhados (shadcn/ui base)
│   ├── zod-schemas/      # Schemas de validação
│   └── trpc/             # Tipos tRPC compartilhados
├── docker-compose.yml
└── README.md
```

### 5.3 Schema do Banco (8 tabelas)
```sql
users (id, email, name, avatar, teamId, createdAt)
teams (id, name, slug, createdAt)
sessions (id, userId, token, expiresAt)

leads (id, name, email, phone, source, status, responsibleId, 
       estimatedValue, notes, convertedToClientId, teamId, createdAt)

clients (id, name, type, document, email, phone, address, 
         tags, status, teamId, createdAt)

schedules (id, clientId, dateTime, type, technicianId, 
           status, notes, teamId, createdAt)

contracts (id, clientId, type, value, frequency, 
           startDate, endDate, status, teamId, createdAt)

reminders (id, clientId, title, type, dueDate, 
           status, teamId, createdAt)
```

## 6. Fluxos de Usuário

### 6.1 Login Dev (sem OAuth)
1. Usuário acessa `/auth/login`
2. Clica "Dev Login"
3. Frontend salva `dev_user` no sessionStorage
4. tRPC client envia `X-Dev-User` header
5. Backend extrai usuário via `extractDevUser`
6. Sessão criada, redireciona para `/dashboard`

### 6.2 Pipeline: Lead → Cliente → Contrato → Agenda
1. **Captação**: Lead cadastrado manualmente ou importado
2. **Qualificação**: Status avança pelo pipeline
3. **Conversão**: Lead ganho → automaticamente vira Cliente
4. **Contratação**: Criar contrato vinculado ao cliente
5. **Agendamento**: Criar serviço vinculado ao cliente
6. **Follow-up**: Lembretes automáticos para renovações

## 7. API (tRPC Routers)

```typescript
// auth.trpc.ts
auth.getSessionInfo
auth.logout

// dashboard.trpc.ts  
dashboard.getStats          // KPIs agregados
dashboard.getRecentItems    // Atividades recentes

// leads.trpc.ts
leads.list                  // + filtros + paginação
leads.getById
leads.create
leads.update
leads.delete
leads.convertToClient       // Ação especial

// clients.trpc.ts
clients.list
clients.getById
clients.create
clients.update
clients.delete

// schedules.trpc.ts
schedules.list
schedules.getById
schedules.create
schedules.update
schedules.delete
schedules.updateStatus

// contracts.trpc.ts
contracts.list
contracts.getById
contracts.create
contracts.update
contracts.delete
contracts.updateStatus

// reminders.trpc.ts
reminders.list
reminders.getById
reminders.create
reminders.update
reminders.delete
reminders.complete
```

## 8. Critérios de Aceitação

### 8.1 Funcionais
- [ ] Usuário pode fazer login dev sem interação humana
- [ ] Dashboard exibe KPIs atualizados em tempo real (< 2s)
- [ ] Lead pode ser criado, editado, movido no pipeline e convertido em cliente
- [ ] Cliente exibe histórico completo (leads origem, contratos, agendamentos)
- [ ] Agendamento pode ser criado com workflow de status
- [ ] Contrato gerencia status e alerta vencimento
- [ ] Lembrete pode ser criado, concluído e vinculado a cliente

### 8.2 Não-funcionais
- [ ] Página carrega em < 1s (First Contentful Paint)
- [ ] Tempo de resposta da API < 200ms (p95)
- [ ] Dark mode é o único tema (sem toggle)
- [ ] Verde ácido (#39FF14) usado consistentemente para ações primárias e destaques
- [ ] Design responsivo (mobile-first, touch targets 44px+)
- [ ] Teste E2E smoke passa em < 60s

## 9. Riscos & Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Twenty é muito complexo para fork | Média | Alto | Usar apenas como referência de arquitetura, não fork direto |
| Integração com auth existente | Baixa | Médio | Manter X-Dev-User bypass já funcional |
| PostgreSQL schema migration | Média | Médio | Usar migrations incrementais (TypeORM/Prisma) |
| Performance com muitos registros | Baixa | Médio | Paginação + indexes desde o início |

## 10. Roadmap Pós-MVP

| Fase | Feature | Prioridade |
|------|---------|------------|
| v0.2 | Equipamentos + Unidades (HVAC) | P1 |
| v0.3 | Ordens de Serviço (OS) com relatório técnico | P1 |
| v0.4 | Kanban para gestão de tarefas | P2 |
| v0.5 | Email marketing integrado | P3 |
| v0.6 | AI Assistant (RAG sobre clientes) | P3 |

## 11. Anexos

### 11.1 Referências
- Twenty CRM: https://github.com/twentyhq/twenty (45.3k stars)
- CRM Legado: Branch `archive/crm-legacy-20260430`
- Design System: Token list na seção 4.1

### 11.2 Decisões Arquiteturais
- **AD-001**: Usar NestJS ao invés de Fastify — melhor integração com Twenty ecosystem
- **AD-002**: PostgreSQL ao invés de MySQL — consistência com Twenty
- **AD-003**: Tailwind CSS ao invés de MUI — mais fácil customizar dark mode + verde ácido
- **AD-004**: Nx monorepo — consistência com Twenty e melhor DX

---
**Status**: Active  
**Next Step**: Executar bootstrap pipeline (pipeline.json)
