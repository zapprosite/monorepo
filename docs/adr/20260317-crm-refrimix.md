---

title: "PRD Técnico — Refrimix Tecnologia CRM Vertical para Climatização com IA, MCP e n8n"
document_type: "PRD"
status: "in-execution"
product_name: "Refrimix Tecnologia"
updated_at: "2026-03-18"
execution_phase: "Slice 8 — RBAC / Gestão de Usuários (Ready to Start)"
language: "pt-BR"
repository_template:
backend: "backend/"
frontend: "frontend/"
execution_model: "multi-agent"
primary_agents:
planning:
- "@researcher"
- "@planner"
build:
- "@implementer"
audit:
- "@reviewer"
deploy_sync:
- "@mcp-operator"
architecture_layers:

* "infraestrutura (IaC/CI/CD/observabilidade)"
* "backend (domínio, contratos, integrações, automações)"
* "frontend (UX operacional, design system, jornadas)"

---

# PRD: Refrimix Tecnologia — CRM Operacional para Climatização no Brasil

> **Visão Geral**: Construir um CRM vertical premium para empresas de climatização no Brasil, com foco em operação comercial, agenda técnica, manutenção recorrente, PMOC, marketing, fidelização e automações orquestradas por agentes, MCP e n8n, preservando a estrutura atual do repositório com separação obrigatória entre `backend/` e `frontend/`.

---

## 1. Objetivo e Requisitos

### Meta Principal

Entregar um sistema SaaS B2B operacional, em português do Brasil, com arquitetura escalável e pronta para execução incremental, capaz de atender o ciclo completo de uma empresa de climatização: captação de leads, conversão, gestão de clientes, histórico por equipamento, agenda técnica, relatórios obrigatórios, contratos PMOC, planos residenciais, social media, e-mail marketing, conteúdo assistido por IA e automações de reativação.

### Objetivos de Negócio

1. Centralizar operação comercial, técnica e de marketing em um único produto.
2. Reduzir perda de receita por falta de follow-up, manutenção vencida e contratos não renovados.
3. Aumentar previsibilidade operacional com agenda, kanban, lembretes e relatórios obrigatórios.
4. Estruturar um núcleo de inteligência assistida por agentes para pesquisa, geração de conteúdo, automações e recomendação de próxima ação.
5. Preparar o produto para integrações externas via OAuth, webhooks, MCP e provedores de IA desacoplados.

### Requisitos Chave

- [x] Respeitar integralmente o template existente com `backend/` e `frontend/`.
- [x] Exibir a marca oficial **Refrimix Tecnologia** em toda a interface.
- [x] Aplicar identidade visual premium com paleta centrada em azul marinho e branco.
- [x] Cobrir CRM, agenda, marketing, contratos, relatórios, automações e conteúdo.
- [x] Preparar a base para agents, conectores MCP, n8n e provider abstraction.
- [x] Manter arquitetura pronta para crescimento sem reescrita estrutural precoce.

### Requisitos Funcionais

O sistema deve conter, no mínimo, os seguintes módulos:

1. Dashboard Executivo
2. CRM de Leads e Clientes
3. Cadastro de Clientes e Equipamentos
4. Agendamento Operacional
5. Kanban Interno
6. Relatórios Técnicos e Lista de Materiais
7. Fidelização e Automações
8. PMOC e Contratos
9. Plano de Manutenção Residencial
10. Calendário Editorial / Social Media
11. Estratégia de Marketing e Tráfego Pago
12. Email Marketing
13. Jornal Inteligente estilo Perplexity-like
14. Camada de Agents / MCP / n8n / Webhooks

### Requisitos Não Funcionais

- Segurança por padrão: JWT, refresh token rotativo, RBAC, auditoria e segregação de segredos.
- Performance operacional: telas listáveis com paginação, filtros server-side e cache seletivo.
- Observabilidade mínima desde a primeira release: logs estruturados, tracing básico, métricas e correlação por request ID.
- Testabilidade: contratos, validações e domínio cobertos por testes unitários e integração.
- Usabilidade: UX desktop-first responsiva, foco em atendimento rápido e operação contínua.
- Acessibilidade: contraste mínimo AA e semântica consistente.

---

## 2. Escopo do Produto

### Escopo Inicial (MVP+)

O primeiro ciclo de execução deve entregar os alicerces do sistema e os módulos de maior impacto operacional:

- Autenticação, autorização e perfis.
- Dashboard executivo.
- CRM de leads/clientes.
- Cadastro de equipamentos.
- Agenda operacional.
- Kanban interno.
- Relatórios técnicos com lista de materiais.
- PMOC/contratos.
- Calendário editorial.
- Base de webhooks, eventos, MCP connectors e provider abstraction.
- Design system inicial da Refrimix Tecnologia.
- Documentação técnica e operacional.

### Escopo Expandido Planejado

- Email marketing transacional e campanhas.
- Jornal inteligente com pipeline blog → carrossel → calendário editorial.
- Copiloto de atendimento.
- Busca semântica e memória operacional.
- RAG corporativo com documentação técnica e comercial.
- PWA para técnicos em campo.
- Health score e analytics avançados.
- Portal do cliente.
- Integrações aprofundadas com Meta Ads, Google Ads e canais conversacionais.

### Fora do Escopo Inicial

- Faturamento/ERP completo.
- Gestão financeira avançada e conciliação bancária.
- Telefonia/IP telephony nativa.
- Aplicativo mobile nativo.
- Multi-tenant complexo com isolamento por banco dedicado.
- BI avançado com cubos analíticos dedicados.

---

## 3. Contexto de Negócio e Domínio

A Refrimix Tecnologia opera em um contexto onde o valor recorrente depende de manutenção preventiva, histórico técnico confiável, contratos renovados no prazo e relacionamento contínuo com cliente residencial e empresarial. O produto deve refletir esse domínio com forte modelagem em torno de:

- **Cliente**: pessoa física ou jurídica.
- **Unidade**: local de atendimento, especialmente relevante para empresas com múltiplas filiais.
- **Equipamento**: ativo técnico central para manutenção, visitas e histórico.
- **Contrato**: acordos comerciais, incluindo PMOC e planos residenciais.
- **Ordem de Serviço / Atendimento**: execução operacional.
- **Agenda**: planejamento de campo e controle de capacidade.
- **Interações**: contatos, follow-ups, lembretes, timeline.
- **Conteúdo/Marketing**: calendário, campanhas, ativos criativos, blog, e-mail.
- **Automação**: eventos, webhooks, jobs, integrações e ações assistidas por IA.

---

## 4. Arquitetura de Camadas

## 4.1 Infraestrutura (IaC, Runtime, CI/CD, Observabilidade)

### Decisão Arquitetural

Adotar infraestrutura containerizada e reproduzível, com provisionamento declarativo e pipeline automatizado.

### Padrão Recomendado

- **Local**: Docker Compose para banco, Redis e serviços auxiliares.
- **IaC**: Terraform para recursos de cloud.
- **Deploy**: containers versionados com build reprodutível.
- **Banco**: PostgreSQL.
- **Cache/Fila leve**: Redis.
- **Armazenamento de arquivos**: S3-compatible object storage.
- **CI/CD**: pipeline com lint, test, build, scan e deploy controlado.
- **Observabilidade**: logs estruturados JSON, métricas básicas e tracing inicial.
- **Segurança**: secrets manager, assinatura de webhooks, segregação por ambiente.

### Responsabilidades da Camada

- Provisionar banco, cache, object storage, rede, containers e variáveis seguras.
- Configurar ambientes `dev`, `staging` e `prod`.
- Habilitar backups automáticos do PostgreSQL.
- Garantir retenção de logs e políticas mínimas de recuperação.
- Instrumentar health checks, readiness e liveness.

## 4.2 Backend (Domínio, Contratos, Integrações, Eventos)

### Decisão Arquitetural

Adotar API modular em TypeScript com validação forte, contratos estáveis e separação entre domínio, aplicação, infraestrutura e interfaces.

### Stack Recomendada

- Node.js + TypeScript
- Fastify
- Prisma ORM
- PostgreSQL
- Redis
- Zod para validação de payload e schema contracts
- JWT + refresh token + RBAC
- BullMQ ou fila equivalente para jobs assíncronos
- OpenAPI gerado a partir dos contratos da API

### Responsabilidades da Camada

- Expor API REST versionada.
- Implementar regras de negócio e políticas de autorização.
- Manter contratos previsíveis para frontend, agentes e integrações.
- Disparar eventos internos e webhooks externos.
- Armazenar auditoria, histórico de automações e interações assistidas por IA.

## 4.3 Frontend (UX, Jornada Operacional, Design System)

### Decisão Arquitetural

Adotar SPA em TypeScript com foco em UX operacional, estado assíncrono previsível e design system consistente.

### Stack Recomendada

- React + TypeScript + Vite
- React Router
- TanStack Query
- React Hook Form
- Zod
- Tailwind CSS + tokens próprios de design
- Biblioteca de primitives acessíveis para overlays, menus, dialogs e tabs

### Responsabilidades da Camada

- Entregar navegação por módulos com sidebar fixa.
- Exibir dashboards, tabelas operacionais, agendas e formulários densos.
- Implementar UX coesa para técnico, comercial, marketing, atendimento e gestor.
- Consumir contratos da API com tipagem estável.
- Preparar o produto para futuras capacidades PWA.

---

## 5. Arquitetura do Repositório

A estrutura atual do projeto é mandatória e não deve ser substituída por outro modelo de monorepo.

### Estrutura Base Obrigatória

```text
backend/
  src/
  dist/
  package.json
  tsconfig.json
  Dockerfile
  .env
  .env.example

frontend/
  src/
  dist/
  package.json
  vite.config.ts
  tsconfig.json
  .env
  .env.example
```

### Expansão Permitida

Novas pastas devem ser criadas apenas dentro de `backend/src` e `frontend/src`.

### Organização Recomendada

#### `backend/src`

- `app/` bootstrap, plugins, server config
- `modules/` módulos de domínio
- `common/` utilitários, erros, middlewares, guards
- `contracts/` schemas Zod, DTOs e OpenAPI sources
- `infra/` prisma, redis, queues, storage, observability
- `integrations/` n8n, MCP, providers, OAuth adapters
- `events/` publishers, subscribers, job handlers
- `config/` env parsing e config typed
- `tests/` fixtures e testes integrados

#### `frontend/src`

- `app/` bootstrap, providers, router
- `layouts/` shell principal, sidebar, topbar
- `pages/` páginas por módulo
- `features/` blocos funcionais por domínio
- `components/` UI compartilhada
- `lib/` api client, auth, query client, utils
- `hooks/` hooks reutilizáveis
- `types/` contratos tipados
- `styles/` tokens e estilos globais

---

## 6. Design System e Branding

### Identidade Obrigatória

- **Nome do CRM/Dashboard**: Refrimix Tecnologia
- **Subtítulo opcional**: CRM inteligente para climatização e manutenção

### Paleta Oficial

#### Cores Principais

- Navy 900: `#0B1F3A`
- Navy 800: `#123057`
- Azul institucional: `#1D4ED8`
- Branco: `#FFFFFF`
- Fundo claro: `#F5F7FB`
- Texto secundário: `#64748B`

#### Cores de Apoio

- Ciano tecnológico: `#06B6D4`
- Verde sucesso: `#16A34A`
- Amarelo alerta: `#F59E0B`
- Vermelho crítico: `#DC2626`
- Roxo IA/automação: `#6D28D9`

### Regras de UX

- Sidebar fixa em azul marinho.
- Topbar branca com contraste claro.
- Cards com alta legibilidade e hierarquia visual nítida.
- Tabelas com densidade operacional, sem sacrificar leitura.
- Indicadores visuais de SLA, prioridade, risco e automação.
- Ícones consistentes por módulo.
- Badges para status de IA, integração, contrato e atendimento.
- Componentes acessíveis, com foco visível e navegação por teclado.

---

## 7. Modelo de Usuários e Permissões

### Perfis

- **Admin**: controle global do sistema.
- **Gestor**: visão executiva, relatórios, contratos e operação.
- **Comercial**: leads, funil, propostas, follow-ups.
- **Marketing**: calendário editorial, campanhas, conteúdo.
- **Técnico**: agenda, OS, relatórios, checklist, materiais.
- **Atendimento**: cadastro, agendamento, interações e suporte operacional.
- **Financeiro**: leitura de contratos, status e relatórios vinculados.

### Política de Acesso

Implementar RBAC com permissões granulares por módulo e ação:

- `read`
- `create`
- `update`
- `delete`
- `assign`
- `approve`
- `export`
- `trigger_automation`
- `manage_integrations`

---

## 8. Requisitos Funcionais Detalhados por Módulo

## 8.1 Dashboard Executivo

Deve consolidar KPIs operacionais, comerciais e de marketing:

- leads por origem
- propostas abertas
- vendas convertidas
- contratos ativos
- PMOCs vigentes
- manutenções vencidas
- agenda do dia
- follow-ups pendentes
- alertas críticos
- saúde da carteira
- campanhas em andamento

### Critérios

- filtros por período, responsável, unidade e segmento
- cards com drill-down
- widgets de lembrete e ações rápidas

## 8.2 CRM de Leads e Clientes

- cadastro de lead com origem, canal, responsável e status
- pipeline comercial configurável
- timeline de contatos
- follow-ups, tarefas e observações internas
- conversão de lead para cliente
- segmentação residencial/empresarial
- tags, prioridade e potencial

## 8.3 Clientes e Equipamentos

- cadastro do cliente
- múltiplos contatos e endereços
- múltiplas unidades
- equipamentos por unidade
- histórico técnico por equipamento
- próximos serviços e contratos relacionados

## 8.4 Agendamento Operacional

- agenda de segunda a sábado em horário comercial
- visualização por técnico, equipe e cliente
- tipos de atendimento: visita, manutenção preventiva, corretiva, instalação, retorno
- confirmação, reagendamento, cancelamento e conclusão
- bloqueios de capacidade por técnico

## 8.5 Kanban Interno

- boards por setor
- colunas configuráveis
- cards com SLA, prioridade, responsável, checklist e vencimento
- filtros por status, área e pessoa

## 8.6 Relatórios Técnicos e Materiais

- relatórios de visita, instalação e manutenção
- checklist obrigatório por serviço
- materiais e peças aplicadas
- upload de imagens
- assinatura técnico/cliente
- estrutura preparada para geração de PDF

## 8.7 Fidelização e Automações

- identificação de clientes sem manutenção há 90 dias
- geração de lembrete automático
- campanhas de reativação
- score de fidelidade
- gatilhos por tempo, contrato e equipamento

## 8.8 PMOC e Contratos

- cadastro e gestão de contratos
- contratos PMOC com frequência, unidade e vigência
- anexos e histórico de renovação
- alertas de vencimento
- plano de execução recorrente

## 8.9 Plano de Manutenção Residencial

- catálogo de planos
- periodicidade e benefícios
- status e renovação
- agenda vinculada
- base preparada para cobrança futura

## 8.10 Calendário Editorial / Social Media

- visão calendário/lista
- canal, pauta, formato, copy, CTA, data e status
- vínculo com campanha
- vínculo com blog e carrossel
- workflow de produção e aprovação

## 8.11 Estratégia de Marketing e Tráfego Pago

- planejamento por funil
- campanhas Meta Ads e Google Ads
- orçamento, objetivo, segmentação, criativos e landing pages
- arquitetura pronta para OAuth e providers externos

## 8.12 Email Marketing

- listas e segmentos
- campanhas e templates
- automações por gatilho de negócio
- campanhas sazonais e de reativação

## 8.13 Jornal Inteligente

- captura de insights e tendências
- geração de pautas
- transformação de pauta em blog, resumo, carrossel, legenda e CTA
- histórico, revisão humana e rastreabilidade de origem

## 8.14 Agents, MCP, n8n e Webhooks

- camada de conectores MCP
- eventos internos e externos
- filas, retries e logs de execução
- status de integrações
- provider abstraction para IA e serviços externos

---

## 9. Requisitos Técnicos de Backend

### Padrões Obrigatórios

- API versionada em `/api/v1`
- validação com Zod em entrada e saída crítica
- erros padronizados com código, mensagem, detalhes e request ID
- logging estruturado
- autenticação com access token e refresh token
- RBAC com guards por rota
- paginação, filtros e ordenação server-side
- idempotência para webhooks e automações sensíveis
- auditoria para ações críticas

### Módulos de Backend

- Auth
- Users / Roles / Permissions
- Leads
- Clients
- Units
- Equipment
- Schedule
- Service Orders
- Technical Reports
- Materials
- Tasks / Kanban
- Contracts / PMOC
- Residential Plans
- Reminders / Loyalty
- Marketing
- Editorial Calendar
- Content Engine
- Email Campaigns
- Integrations
- Webhooks
- Automations
- AI / MCP / Provider Adapters
- Audit Logs

### Contratos Principais

- `AuthLoginRequest`, `AuthRefreshRequest`
- `LeadCreate`, `LeadUpdate`, `LeadListQuery`
- `ClientCreate`, `ClientDetailResponse`
- `EquipmentCreate`, `EquipmentHistoryResponse`
- `ScheduleCreate`, `ScheduleReschedule`
- `ServiceOrderCreate`, `ServiceOrderClose`
- `TechnicalReportSubmit`
- `ContractCreate`, `PMOCContractCreate`
- `ReminderCreate`, `ReminderTriggerEvent`
- `EditorialCalendarItemCreate`
- `WebhookEventReceive`
- `AutomationRunStatus`
- `AIInteractionCreate`

---

## 10. Requisitos Técnicos de Frontend

### Shell Principal

- layout autenticado com sidebar, topbar, breadcrumb, global search e quick actions
- suporte a estados de carregamento, vazio, erro e sucesso
- contexto de autenticação e sessão
- guardas de rota por permissão

### Padrões de Interface

- tabelas operacionais com filtros persistentes
- formulários longos com validação inline
- drawers/modals para ações rápidas
- timeline e histórico unificado
- dashboards com cards, gráficos simples e alertas
- status badges padronizados
- páginas densas com ergonomia para uso diário

### Páginas Mínimas

- Login
- Dashboard
- Leads
- Clientes
- Equipamentos
- Agenda
- Kanban
- Relatórios Técnicos
- Contratos / PMOC
- Planos Residenciais
- Calendário Editorial
- Marketing
- Integrações
- Configurações / Usuários / Permissões

---

## 11. Modelo de Dados de Alto Nível

### Entidades Obrigatórias

- `User`
- `Role`
- `Permission`
- `Lead`
- `Client`
- `Contact`
- `Address`
- `Unit`
- `Equipment`
- `Schedule`
- `ServiceOrder`
- `TechnicalReport`
- `MaterialItem`
- `Task`
- `KanbanBoard`
- `KanbanColumn`
- `KanbanCard`
- `Contract`
- `PMOCContract`
- `ResidentialMaintenancePlan`
- `LoyaltyEvent`
- `Reminder`
- `MarketingStrategy`
- `Campaign`
- `AdCampaign`
- `EditorialCalendarItem`
- `ContentIdea`
- `BlogPost`
- `CarouselAsset`
- `EmailCampaign`
- `WebhookEvent`
- `MCPConnector`
- `AutomationRun`
- `AuditLog`
- `AIInteraction`
- `KnowledgeDocument`

### Relacionamentos Essenciais

- Cliente possui múltiplos contatos, endereços, unidades, contratos e equipamentos.
- Unidade pertence a um cliente e contém múltiplos equipamentos.
- Equipamento possui histórico de serviços, relatórios, lembretes e vínculo opcional com contrato.
- Lead pode ser convertido em cliente.
- Contrato pode possuir múltiplas unidades e regras de recorrência.
- Agenda vincula cliente, unidade, equipamento, técnico e ordem de serviço.
- Calendário editorial vincula campanha, canal e ativos gerados.
- Eventos de automação referenciam entidade de origem, contexto e resultado.

### Enums Obrigatórios

- `UserRole`
- `LeadStatus`
- `LeadSource`
- `ClientType`
- `EquipmentStatus`
- `ScheduleStatus`
- `ServiceType`
- `ContractStatus`
- `ReminderType`
- `ReminderStatus`
- `CampaignChannel`
- `CampaignStatus`
- `ContentStatus`
- `WebhookStatus`
- `AutomationStatus`
- `AIProvider`
- `IntegrationType`

---

## 12. Integrações e Automação

### n8n

O sistema deve expor webhooks assinados e consumir fluxos assíncronos com idempotência.

#### Casos Prioritários

- reativação após 90 dias sem manutenção
- alerta de vencimento contratual
- distribuição automática de leads
- criação de tarefa automática
- envio de briefing para marketing
- sincronização de eventos relevantes

### MCP Connectors

Criar camada de abstração para conectores MCP com:

- registro do conector
- credenciais por ambiente
- status de saúde
- logs de chamada
- timeout e retry policy
- policy de fallback

### IA / Provider Abstraction

O produto deve suportar múltiplos providers, com preferência arquitetural por um adaptador principal e fallback por capacidade.

#### Casos de Uso de IA

- resumo de histórico do cliente
- sugestão de próxima ação
- geração de pauta e copy
- resumo de visita técnica
- classificação de lead
- geração assistida de proposta
- busca semântica futura
- RAG corporativo futuro

---

## 13. Segurança, Compliance e Auditoria

### Requisitos

- parse tipado de variáveis de ambiente
- secrets fora do código
- rotação de refresh tokens
- hash seguro de senha
- rate limiting em auth e webhooks
- assinatura HMAC para webhooks
- trilha de auditoria para ações críticas
- segregação de permissões por perfil
- sanitização de inputs
- proteção contra mass assignment
- validação de upload de arquivos
- política mínima de retenção de logs
- backups automáticos e restore testado

### Eventos que Devem Ser Auditados

- login/logout
- troca de senha
- alteração de perfil/permissão
- alteração de contrato PMOC
- criação/edição de relatório técnico
- disparo de automação
- execução de integração externa
- alteração de lembrete automático
- exclusão lógica de registros críticos

---

## 14. Observabilidade e Operação

### Logs

Todos os serviços devem emitir logs estruturados com:

- timestamp
- level
- service
- environment
- request_id
- user_id opcional
- module
- action
- duration_ms
- outcome

### Métricas

- latência por rota
- taxa de erro por módulo
- jobs concluídos/falhos
- tentativas de webhook
- filas pendentes
- consumo de recursos básicos

### Health Checks

- aplicação
- banco
- Redis
- storage
- integrações críticas configuradas

---

## 15. Estratégia de Testes

### Backend

- unit tests para regras de negócio
- integration tests para rotas críticas
- contract tests para schemas de entrada/saída
- testes de autorização
- testes de idempotência em webhooks
- testes de jobs assíncronos

### Frontend

- unit tests de componentes críticos
- testes de formulários e validação
- testes de navegação protegida
- smoke tests por módulo
- testes E2E para fluxos prioritários

### Fluxos E2E Prioritários

1. Login → Dashboard → criação de lead → conversão para cliente.
2. Cadastro de cliente → equipamento → agendamento → relatório técnico.
3. Criação de contrato PMOC → alerta de vencimento.
4. Cliente sem manutenção por 90 dias → lembrete → automação n8n.
5. Pauta editorial → post blog → carrossel vinculado.

---

## 16. Fases de Execução e Distribuição por Agentes

## 🟢 Phase 1: Planning

**Primary Agents**: `@researcher`, `@planner`

### Objetivo

Transformar o draft em especificação técnica, reduzir ambiguidade, identificar impacto no repositório atual e congelar decisões arquiteturais iniciais.

### Task 1.1 — Análise de Impacto do Repositório ➜ `@researcher`

**Entregáveis**

- inventário do estado atual de `backend/` e `frontend/`
- dependências existentes e lacunas técnicas
- aderência do template atual à proposta
- riscos de retrofit e dívida técnica herdada
- mapa de módulos existentes vs. módulos exigidos

### Task 1.2 — Tech Spec e Plano de Implementação ➜ `@planner`

**Entregáveis**

- tech spec consolidado
- diagrama textual das camadas
- contratos prioritários da API
- backlog fatiado por épicos, features e tasks
- sequência de entrega compatível com branch/worktree

### Task 1.3 — ADRs Arquiteturais ➜ `@planner`

**ADRs mínimas**

1. Escolha de framework backend
2. Estrutura modular do backend
3. Estratégia de autenticação e RBAC
4. Modelo de eventos e webhooks
5. Estratégia de design system no frontend
6. Abstração de providers de IA/MCP
7. Estratégia de fila, retry e jobs

### Critério de Saída da Phase 1

- escopo congelado para a iteração
- stack definida
- backlog priorizado
- riscos principais classificados
- ADRs iniciais aprovadas

---

## 🔵 Phase 2: Build

**Primary Agents**: `@implementer`

### Objetivo

Implementar vertical slices preservando a estrutura do repo e produzindo código testável e incremental.

### Task 2.1 — Worktree e Base de Execução ➜ `@implementer`

**Ações**

- criar worktree/branch isolada
- configurar envs e scripts
- validar build local dos dois apps
- alinhar padrões de lint/format/test

### Task 2.2 — Infraestrutura Aplicacional Base ➜ `@implementer`

**Camada Infra**

- dockerização consistente
- compose local com postgres + redis
- config typed por ambiente
- client do banco
- client do redis
- logger estruturado
- base de health checks

### Task 2.3 — Núcleo de Backend ➜ `@implementer`

**Camada Backend**

- auth + refresh + RBAC
- bootstrap Fastify
- estrutura de módulos
- contratos Zod
- error handling central
- auditoria base
- seeds iniciais
- OpenAPI

### Task 2.4 — Núcleo de Frontend ➜ `@implementer`

**Camada Frontend**

- shell autenticado
- sidebar Refrimix Tecnologia
- design tokens
- providers de auth/query/router
- guards de rota
- páginas base por módulo
- tabela padrão, formulário padrão, card padrão

### Task 2.5 — Vertical Slices Prioritários ➜ `@implementer`

**Ordem**

1. ✅ Leads/Clientes — Slice 1 (2026-03-17)
2. ✅ Equipamentos/Unidades — Slice 2 (2026-03-17)
3. ✅ Agenda Operacional — Slice 3 (2026-03-17)
4. ✅ Relatórios Técnicos / OS — Slice 4 (2026-03-18)
5. ✅ Contratos / PMOC / Planos Residenciais — Slice 5 (2026-03-18)
6. ✅ Calendário Editorial — Slice 6 (2026-03-18)
7. ✅ Lembretes CRM — Slice 7 (2026-03-18)
8. 🔄 RBAC / Gestão de Usuários — Slice 8 (Ready to Start)
9. ⏳ Kanban Interno — Slice 9 (Planned)
10. ⏳ Plano de Manutenção Residencial — Slice 10 (Planned)
11. ⏳ Fidelização / Score de Fidelidade — Slice 11 (Planned)
12. ⏳ Email Marketing / Campanhas — Slice 12 (Planned)
13. ⏳ Webhooks / n8n Adapters — Slice 13 (Planned)
14. ⏳ MCP Connectors / AI Provider Abstraction — Slice 14 (Planned)
15. ⏳ Jornal Inteligente / Content Engine — Slice 15 (Planned)

**Status de Slices Completadas**

| Slice | Componente | Backend Tables | Frontend Routes | Zod Schemas | Status |
|-------|-----------|---|---|---|--------|
| 1 | Leads | ✅ leads | ✅ leads.router | ✅ lead.zod | Merged |
| 2 | Clientes/Equipamentos | ✅ clients, units, equipment | ✅ clients.router, equipment.router | ✅ client, unit, equipment | Merged |
| 3 | Agenda | ✅ schedules | ✅ schedule.router | ✅ schedule.zod | Merged |
| 4 | Relatórios Técnicos | ✅ service_orders, technical_reports, material_items | ✅ service-orders.router | ✅ service_order, technical_report, material_item | Merged |
| 5 | Contratos/PMOC | ✅ contracts | ✅ contracts.router | ✅ contract.zod | Merged |
| 6 | Calendário Editorial | ✅ editorial_calendar_items | ✅ editorial.router | ✅ editorial.zod | Merged |
| 7 | Lembretes CRM | ✅ reminders | ✅ reminders.router | ✅ reminder.zod | Merged |

**Slices Planejadas (8–15)**

| Slice | Componente | Épico | Prioridade |
|-------|-----------|-------|-----------|
| 8 | RBAC — Roles, Permissões, Usuários | A (Foundation) | 🔴 Alta |
| 9 | Kanban Interno — Boards, Colunas, Cards | C (Field Ops) | 🟡 Média |
| 10 | Plano de Manutenção Residencial — Catálogo, Períodos, Agenda | D (Contratos) | 🟡 Média |
| 11 | Fidelização — Score, Reativação 90d, Automação | D (Contratos) | 🟡 Média |
| 12 | Email Marketing — Listas, Templates, Campanhas | E (Marketing) | 🟢 Baixa |
| 13 | Webhooks / n8n — Eventos, Filas, Retries, Adapters | F (Automação) | 🟡 Média |
| 14 | MCP Connectors / AI Providers — Registry, Abstraction, Logs | F (Automação) | 🟢 Baixa |
| 15 | Jornal Inteligente — Pipeline pauta→blog→carrossel→editorial | E (Marketing) | 🟢 Baixa |

### Task 2.6 — Testes da Fase ➜ `@implementer`

- unitários e integração dos módulos entregues
- smoke tests frontend
- fixtures reusáveis

### Critério de Saída da Phase 2

- features compilando
- migrações aplicáveis
- contratos estáveis
- testes essenciais passando
- sem quebra do template do repo

---

## 🟡 Phase 3: Audit

**Primary Agents**: `@reviewer`

### Objetivo

Auditar segurança, performance, consistência arquitetural e qualidade do diff antes do merge.

### Task 3.1 — Auditoria de Código e Diff ➜ `@reviewer`

**Validar**

- coesão com ADRs
- ausência de código morto
- clareza dos nomes
- aderência ao padrão do repo
- impacto nas integrações futuras

### Task 3.2 — Segurança e Confiabilidade ➜ `@reviewer`

**Validar**

- auth/rbac
- sanitização
- proteção de segredos
- assinatura de webhook
- idempotência
- auditoria
- controle de uploads
- tratamentos de erro

### Task 3.3 — Performance e Escalabilidade ➜ `@reviewer`

**Validar**

- paginação e filtros server-side
- consultas N+1
- índices necessários
- cache coerente
- retenção de logs
- jobs resilientes

### Task 3.4 — Testes e Aceite Técnico ➜ `@reviewer`

**Executar**

- unit tests
- integration tests
- smoke/E2E prioritários
- revisão manual de UX operacional
- revisão do design system

### Critério de Saída da Phase 3

- zero blocker de segurança
- zero inconsistência estrutural crítica
- cobertura mínima aceitável nos fluxos prioritários
- diff aprovado para sincronização e entrega

---

## 🔴 Phase 4: Deploy / Sync

**Primary Agents**: `@mcp-operator`

### Objetivo

Sincronizar contexto, consolidar documentação, operacionalizar pipeline e garantir entrega reproduzível.

### Task 4.1 — Context Sync ➜ `@mcp-operator`

**Entregáveis**

- sincronização de contexto via MCP `ai-context`
- snapshot do estado da feature
- resumo estruturado para próximas iterações

### Task 4.2 — CI/CD e Higiene de Entrega ➜ `@mcp-operator`

**Entregáveis**

- pipeline de lint, test, build e scan
- estratégia de deploy para staging
- checklist de rollback
- validação de envs obrigatórios

### Task 4.3 — Documentação Técnica e Walkthrough ➜ `@mcp-operator`

**Entregáveis**

- README raiz
- README backend
- README frontend
- guia de setup local
- variáveis de ambiente
- scripts e troubleshooting
- roadmap atualizado

### Task 4.4 — Merge Seguro ➜ `@mcp-operator`

**Condições**

- branch verde
- revisão aprovada
- migração segura
- documentação concluída
- contexto sincronizado

### Critério de Saída da Phase 4

- build reproduzível
- staging funcional
- documentação suficiente para handoff
- merge seguro autorizado

---

## 17. Backlog Inicial por Épicos

### Épico A — Foundation

- autenticação e RBAC
- design system base
- infra local
- observabilidade mínima
- documentação base

### Épico B — CRM Core

- leads
- clientes
- contatos
- unidades
- equipamentos
- timeline/histórico

### Épico C — Field Operations

- agenda
- ordem de serviço
- relatórios técnicos
- materiais
- checklist
- assinaturas

### Épico D — Contracts & Retention

- contratos
- PMOC
- planos residenciais
- lembretes
- score de fidelidade

### Épico E — Marketing & Content

- calendário editorial
- campanhas
- estratégia de mídia
- blog/carrossel pipeline
- email marketing base

### Épico F — Automation & Intelligence

- webhooks
- n8n adapters
- MCP connectors
- AI provider abstraction
- automações de reativação
- copiloto operacional

---

## 18. Critérios de Aceitação Globais

O produto será aceito tecnicamente apenas se:

1. Preservar a estrutura `backend/` e `frontend/`.
2. Exibir corretamente a marca **Refrimix Tecnologia**.
3. Aplicar a paleta navy + branco com contraste adequado.
4. Atender fluxos reais do setor de climatização no Brasil.
5. Entregar CRM, agenda, marketing, contratos, relatórios e automações.
6. Disponibilizar base de integração para agents, MCP e n8n.
7. Manter arquitetura limpa, modular e extensível.
8. Possuir documentação suficiente para setup e evolução.
9. Passar em testes mínimos e auditoria de segurança.
10. Estar pronto para próxima iteração sem refactor estrutural imediato.

---

## 19. Riscos e Mitigações

### Risco: excesso de escopo no ciclo inicial

**Mitigação**: fatiar por vertical slices e priorizar Foundation + CRM Core + Field Operations.

### Risco: acoplamento prematuro com provider de IA

**Mitigação**: adapter pattern com provider abstraction desde a primeira implementação.

### Risco: automações frágeis via webhooks

**Mitigação**: assinatura HMAC, retries controlados, idempotência e auditoria.

### Risco: telas densas comprometerem UX

**Mitigação**: design system consistente, tabelas padronizadas e testes manuais por perfil.

### Risco: dívida técnica por retrofit no repo existente

**Mitigação**: Phase 1 obrigatória com análise de impacto e ADRs antes de build.

---

## 20. Definição de Pronto (DoR / DoD)

### Definition of Ready

- problema, módulo e escopo da iteração definidos
- ADRs relevantes aprovadas
- contratos principais descritos
- critérios de aceite escritos
- impactos no repo mapeados

### Definition of Done

- código sem segredos expostos
- documentação atualizada em português do Brasil
- testes essenciais aprovados
- auditoria sem blockers críticos
- contexto sincronizado
- build reproduzível
- diff revisado e pronto para merge
