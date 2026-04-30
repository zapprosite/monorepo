# PLANO-001 — Implementação MVP CRM Serviços

## Fase 1: Bootstrap (Dia 1)

### 1.1 Infraestrutura
- [ ] Criar estrutura de pastas Nx monorepo
- [ ] Configurar Docker Compose (PostgreSQL + Redis + API + Web)
- [ ] Setup Tailwind CSS com tema dark + verde ácido
- [ ] Configurar tRPC (backend + frontend)
- [ ] Configurar OAuth2 (Google) + dev bypass

### 1.2 Banco de Dados
- [ ] Criar schema PostgreSQL (8 tabelas)
- [ ] Configurar TypeORM/Prisma migrations
- [ ] Seed dados de exemplo (dev team, clientes de teste)

### 1.3 Componentes Base UI
- [ ] Button (variantes: primary/outline/ghost)
- [ ] Card
- [ ] Input + Textarea + Select
- [ ] Badge (status colors)
- [ ] Table (sortable, paginated)
- [ ] Modal/Dialog
- [ ] Toast notifications
- [ ] Sidebar navigation
- [ ] Header

## Fase 2: Auth + Dashboard (Dia 2)

### 2.1 Autenticação
- [ ] Tela de login (/auth/login)
- [ ] Dev login (bypass)
- [ ] Proteção de rotas
- [ ] Logout

### 2.2 Dashboard
- [ ] Layout com sidebar + header
- [ ] KPI cards (6 métricas)
- [ ] Gráficos/Sparklines (opcional v1)
- [ ] Listas rápidas (agendamentos, lembretes, contratos)

## Fase 3: Core CRM (Dia 3-4)

### 3.1 Leads
- [ ] Lista com filtros e busca
- [ ] Form de criação/edição
- [ ] Pipeline visual (drag opcional v1)
- [ ] Ação: Converter para Cliente
- [ ] Deletar com confirmação

### 3.2 Clientes
- [ ] Lista com filtros e busca
- [ ] Form de criação/edição
- [ ] Detalhes com histórico
- [ ] Tags

## Fase 4: Operações (Dia 5)

### 4.1 Agenda
- [ ] Lista de agendamentos
- [ ] Form de criação/edição
- [ ] Workflow de status
- [ ] Calendário visual (v2, lista por enquanto)

### 4.2 Contratos
- [ ] Lista com filtros
- [ ] Form de criação/edição
- [ ] Workflow de status
- [ ] Alerta de vencimento

### 4.3 Lembretes
- [ ] Lista
- [ ] Form rápido
- [ ] Marcar como concluído

## Fase 5: Polimento + Deploy (Dia 6)

### 5.1 Testes
- [ ] Teste E2E smoke (login → dashboard)
- [ ] Testes unitários críticos

### 5.2 Deploy
- [ ] Docker build otimizado
- [ ] Configurar Cloudflare Tunnel
- [ ] Subir em produção
- [ ] Smoke test em produção

### 5.3 Documentação
- [ ] README.md
- [ ] CHANGELOG.md
- [ ] SUBDOMAINS.md update

## Dependências entre Tarefas

```
Bootstrap → Auth → Dashboard → Leads → Clientes → Agenda + Contratos + Lembretes → Deploy
```

## Critérios de Pronto (Definition of Done)

1. Feature funciona em dev (localhost)
2. Feature funciona em produção
3. Design dark mode + verde ácido aplicado
4. Teste E2E passa (se aplicável)
5. Sem console errors
6. Performance aceitável (< 200ms API, < 1s FCP)

## Estimativa

| Fase | Dias | Entregável |
|------|------|-----------|
| 1 | 1 | Infra + UI base |
| 2 | 1 | Auth + Dashboard |
| 3 | 2 | Leads + Clientes |
| 4 | 1 | Agenda + Contratos + Lembretes |
| 5 | 1 | Testes + Deploy |
| **Total** | **6 dias** | **MVP completo** |

## Riscos

- **Atraso no design system**: Mitigar criando tokens Tailwind primeiro
- **Complexidade do Twenty**: Não fazer fork direto, apenas inspirar na arquitetura
- **Scope creep**: Revisitar SPEC antes de aceitar novas features
