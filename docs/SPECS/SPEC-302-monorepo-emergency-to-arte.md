# SPEC-302 — Monorepo: Do Estado de Emergência ao Estado da Arte

**Data:** 2026-05-04
**Autor:** SRE Dev Senior
**Status:** DRAFT — Aguardando aprovação
**Branch alvo:** `feature/nano-blade` (continuação)
**Baseado em:** Diagnóstico completo do monorepo (survey automatizado, 44 checks)

---

## 0. Executive Summary

O monorepo está em **estado de emergência**. O backend (`apps/api`) não compila (137 erros TypeScript). Quase metade dos packages são fantasmas. 48% dos módulos backend não têm frontend. Há 9 docker-compose.yml na raiz referenciando apps extintos. Não é "salada" — é **aterro sanitário de código**.

Este SPEC define o caminho do **aterro ao estado da arte** em 4 fases, com critérios rígidos de aceitação.

---

## 1. Diagnóstico: A Verdade Sem Açúcar

### 1.1 Apps

| App | Status | Build | Uso |
|-----|--------|-------|-----|
| `apps/api` | **BROKEN** | ❌ 137 erros TS | Core CRM — indeployável |
| `apps/web` | Active | ✅ Passa | Frontend React — saudável |
| `apps/ai-gateway` | Active | ✅ Passa | Voice gateway TTS/STT — saudável |

### 1.2 Packages

| Package | Status | Build | Importado por |
|---------|--------|-------|---------------|
| `@repo/zod-schemas` | Active | ✅ | api, web, ai-gateway |
| `@repo/ui` (ui-mui) | Active | ✅ | web |
| `@repo/config` | Active | — | ui, email, trpc (config ts) |
| `@repo/db` | **PHANTOM** | — | **ninguém** — usa drizzle-orm (errado) |
| `@repo/env` | **PHANTOM** | — | **ninguém** |
| `@repo/trpc` | **PHANTOM** | ✅ | **ninguém** — peer dep v10 vs v11 |
| `@repo/email` | **PHANTOM** | ✅ | **ninguém** |

**Fato:** 4 de 7 packages (57%) são lixo morto.

### 1.3 Backend CRM (`apps/api/src/modules/`)

| # | Módulo | Status | Tabela | Router | Frontend | Erros |
|---|--------|--------|--------|--------|----------|-------|
| 1 | auth | used | ✅ | ✅ | ✅ | — |
| 2 | clients | used | ✅ | ✅ | ✅ | — |
| 3 | contracts | used | ✅ | ✅ | ✅ | — |
| 4 | editorial | used | ✅ | ✅ | ✅ | — |
| 5 | equipment | used | ✅ | ✅ | ✅ | — |
| 6 | journal-entries | used | ✅ | ✅ | ✅ | — |
| 7 | kanban | used | ✅ | ✅ | ✅ | — |
| 8 | leads | used | ✅ | ✅ | ✅ | — |
| 9 | loyalty | used | ✅ | ✅ | ✅ | — |
| 10 | maintenance | used | ✅ | ✅ | ✅ | — |
| 11 | reminders | used | ✅ | ✅ | ✅ | — |
| 12 | schedule | used | ✅ | ✅ | ✅ | — |
| 13 | service-orders | **broken** | ✅ | ✅ | ✅ | 7 erros |
| 14 | api-gateway | **orphan** | — | ✅ | ❌ | — |
| 15 | company | **orphan** | ✅ | — | ❌ | — |
| 16 | content-engine | **orphan** | ✅ | ✅ | ❌ | — |
| 17 | dashboard | **orphan** | — | ✅ | ❌ | — |
| 18 | haystack | **orphan** | — | — | ❌ | — |
| 19 | logs | **orphan** | ✅ | — | ❌ | — |
| 20 | mcp-connectors | **orphan** | ✅ | ✅ | ❌ | — |
| 21 | memory | **orphan** | — | ✅ | ❌ | recém-criado |
| 22 | prompts | **orphan** | ✅ | ✅ | ❌ | — |
| 23 | subscriptions | **broken** | ✅ | ✅ | ❌ | 4 erros |
| 24 | teams | **orphan** | ✅ | — | ❌ | TS2742 |
| 25 | upload | **orphan** | — | ✅ | ❌ | — |
| 26 | users | **orphan** | ✅ | ✅ | ❌ | 5 erros |
| 27 | webhooks | **broken** | ✅ | ✅ | ❌ | 4 erros |

**Fato:** 14 de 29 módulos (48%) são código morto. 4 estão quebrados.

### 1.4 Erros de Compilação por Categoria

| Categoria | Erros | Causa |
|-----------|-------|-------|
| `TS2742` (pqb internal) | ~90 | OrchidORM `pqb` não expõe tipos internos; type annotation necessária em `columns` |
| `TS2345` (wrong args) | ~15 | Testes quebrados passando objetos incompletos |
| `TS2339` (prop not exist) | ~10 | `innerJoin` não tipado, `subscriptionId` ausente |
| `TS6133` (unused) | ~12 | Variáveis e imports mortos |
| `TS2552` (cannot find name) | ~5 | `FAKE_UUID_2` não definido em testes |
| `TS2322` (type mismatch) | ~5 | `string \| null \| undefined` → `string` |

### 1.5 Infra/Outros

| Item | Quantidade | Problema |
|------|-----------|----------|
| docker-compose.yml na raiz | 9 | Referenciam apps extintos (fit-v2, trieve) |
| Diretórios órfãos na raiz | 4+ | `.Trash-1000/`, `archive/`, `alertmanager/`, `prometheus/` |
| SPECs mortas | 40+ | Em `docs/SPECS/SPECS-dead/` e espalhadas |
| `mcps/` referenciado | 1 | Em `pnpm-workspace.yaml` mas não existe |
| Migrations vs tabelas | 16 vs 39 | Muitas tabelas sem migration dedicada |

---

## 2. Visão do Estado da Arte

```
monorepo/
├── apps/
│   ├── api/              → CRM backend (Fastify + OrchidORM + tRPC)
│   ├── web/              → Frontend React 19 + MUI + tRPC client
│   └── ai-gateway/       → Voice gateway (Fastify + edge-tts + Groq STT)
│
├── packages/
│   ├── zod-schemas/      → Schemas compartilhados (Zod)
│   ├── ui/               → Component library (MUI)
│   └── config/           → TypeScript configs
│
├── docker-compose.yml    → ÚNICO compose (api + web + db + ai-gateway)
├── turbo.json            → Pipeline build/test/lint
├── biome.json            → Lint + Format
└── pnpm-workspace.yaml   → 3 apps + 3 packages
```

**Regras do Estado da Arte:**
1. Se não builda, é lixo.
2. Se não é usado por ninguém, é lixo.
3. Se não tem frontend, é candidato a remoção (a menos que seja API interna crítica).
4. Um único docker-compose.yml na raiz. Infra externa fica em `/srv/ops/`.
5. SPECs ativas em `docs/SPECS/`. SPECs mortas em `docs/archive/SPECS/`.

---

## 3. Plano de Execução

### FASE 0 — Parada de Emergência (hoje)
**Objetivo:** Parar de espalhar lixo. Tudo o que não builda é lixo.

| # | Tarefa | Critério de Aceitação |
|---|--------|----------------------|
| F0.1 | Corrigir `TS2742` no backend | `pnpm --filter=@connected-repo/backend build` passa sem erros |
| F0.2 | Remover packages fantasmas | `@repo/db`, `@repo/env`, `@repo/trpc`, `@repo/email` deletados; `pnpm install` limpo |
| F0.3 | Remover `mcps/` do workspace | `pnpm-workspace.yaml` não referencia `mcps/`; `pnpm install` passa |

**Decisão arquitetural F0:** O erro `TS2742` é causado pelo OrchidORM `pqb` não exportando tipos internos. A solução é adicionar type annotations explícitas nos `columns` de cada tabela ou configurar `tsconfig.json` para incluir os tipos do `pqb`. Vamos testar ambas e escolher a que for menos invasiva.

---

### FASE 1 — Poda Agressiva (1 dia)
**Objetivo:** Só fica o que é usado. Reduzir de ~15K LOC para ~8K LOC no backend.

| # | Tarefa | Critério de Aceitação |
|---|--------|----------------------|
| F1.1 | Remover módulos backend sem frontend | Deletar: api-gateway, company, content-engine, dashboard, haystack, logs, mcp-connectors, memory, prompts, subscriptions, teams, upload, users, webhooks. `git diff --stat` mostra -3K linhas em `apps/api/src/modules/` |
| F1.2 | Remover tabelas órfãs do `db.ts` | `db.ts` só registra tabelas de módulos ativos |
| F1.3 | Remover routers órfãos do `trpc.router.ts` | `trpc.router.ts` só exporta routers de módulos ativos |
| F1.4 | Limpar docker-compose fantasmas | Apenas `docker-compose.yml` canônico na raiz. Outros 8 deletados ou movidos para `/srv/ops/infra/` |
| F1.5 | Limpar raiz do repo | Deletar `.Trash-1000/`, `archive/`, e verificar se `alertmanager/`, `grafana/`, `prometheus/` são usados |
| F1.6 | Atualizar `env-vault-sync.sh` | Script não tenta sincronizar para apps/packages removidos |

**Decisão arquitetural F1:** A regra é: *se não tem frontend, é código morto*. Exceções só por justificativa escrita no commit. Auth, clients, contracts, editorial, equipment, journal-entries, kanban, leads, loyalty, maintenance, reminders, schedule, service-orders ficam. Tudo o mais vai.

---

### FASE 2 — Consolidação (2-3 dias)
**Objetivo:** Um monorepo coeso e consistente.

| # | Tarefa | Critério de Aceitação |
|---|--------|----------------------|
| F2.1 | Alinhar dependências | Nenhum conflito de versão peer dep; `pnpm install` sem warnings |
| F2.2 | Unificar ORM | `drizzle-orm` removido do monorepo (já foi com `packages/db`) |
| F2.3 | Limpar migrations mortas | Migrations de tabelas extintas removidas ou marcadas como deprecated |
| F2.4 | Consolidar `.env` | Variáveis para apps/packages removidos eliminadas; `.env.example` sincronizado |
| F2.5 | Atualizar CI/CD | Workflows não tentam buildar apps/packages removidos |

---

### FASE 3 — Estado da Arte (1 semana)
**Objetivo:** Brilhar. Factory pattern em massa, build verde, tests verdes, docs limpas.

| # | Tarefa | Critério de Aceitação |
|---|--------|----------------------|
| F3.1 | Factory Pattern em massa | Todos os módulos simples (com `teamId` na tabela) usam `createCrudRouter()`. Editorial já foi. Próximos: leads, equipment (adicionar teamId), contracts |
| F3.2 | Build verde | `pnpm build` na raiz passa sem erros |
| F3.3 | Tests verdes | Testes quebrados removidos. Smoke tests passam. `pnpm test` passa |
| F3.4 | SPECs limpas | SPECs mortas movidas para `docs/archive/SPECS/`. Apenas SPECs ativas em `docs/SPECS/` |
| F3.5 | Documentar arquitetura final | Atualizar `AGENTS.md`, `ROADMAP.md`, e criar `ARCHITECTURE.md` se não existir |

---

## 4. Decisões Arquiteturais Registradas

### ADR-001: Remoção de módulos sem frontend
**Decisão:** Módulos backend sem página correspondente no frontend são considerados código morto e serão removidos.
**Racional:** O CRM é uma aplicação fullstack. Se não há UI, não há uso. APIs internas não-documentadas são dívida técnica.
**Alternativa considerada:** Manter módulos e criar frontend depois. Rejeitado: YAGNI. Se precisar, está no git.

### ADR-002: OrchidORM como ORM canônico
**Decisão:** OrchidORM é a única ORM do monorepo. `packages/db` (drizzle-orm) será removido.
**Racional:** O backend principal já usa OrchidORM. Não há benefício em manter duas ORMs. Drizzle é ótimo, mas escolha foi feita e não vale a migração.

### ADR-003: Hermes Second Brain como camada de memória/RAG
**Decisão:** Todos os serviços de memória/RAG usam Hermes Second Brain (`:8642`, Mem0+Qdrant). Não há mais Trieve.
**Racional:** Hermes já está rodando, tem API REST simples, e não requer manutenção de infra adicional. Trieve era overkill para o uso.

### ADR-004: Docker-compose único na raiz
**Decisão:** Apenas um `docker-compose.yml` na raiz do monorepo. Infra externa fica em `/srv/ops/infra/`.
**Racional:** A raiz do repo é para o produto. Infra de suporte (OpenWebUI, Grafana, Prometheus) é operacional e pertence ao diretório de operações.

### ADR-005: Factory Pattern para CRUD
**Decisão:** CRUD padrão é gerado por `createCrudRouter()`. Cada módulo só implementa lógica customizada.
**Racional:** 60% do backend é boilerplate CRUD repetido. A factory reduz ~70% das linhas em módulos simples.

---

## 5. Critérios de Aceitação Finais

- [ ] `pnpm build` na raiz passa sem erros (todos os apps e packages ativos)
- [ ] `pnpm test` passa sem falhas (ou testes quebrados foram removidos com justificativa)
- [ ] `pnpm lint` (Biome) passa sem erros
- [ ] `git diff --stat` mostra redução de >30% de linhas em `apps/api/src/modules/`
- [ ] Nenhum package fantasma no workspace
- [ ] Nenhum módulo backend sem frontend (exceto justificado no commit)
- [ ] Apenas 1 `docker-compose.yml` na raiz
- [ ] `.env.example` sincronizado e sem variáveis órfãs
- [ ] `AGENTS.md` e `ROADMAP.md` atualizados
- [ ] Smoke tests E2E passam

---

## 6. Estimativa

| Fase | Duração | Entrega |
|------|---------|---------|
| F0 — Parada de Emergência | 1-2h | Backend compila |
| F1 — Poda Agressiva | 1 dia | -30% LOC backend |
| F2 — Consolidação | 2-3 dias | Build verde, deps alinhadas |
| F3 — Estado da Arte | 1 semana | Factory pattern, tests, docs |
| **Total** | **~2 semanas** | **Monorepo enxuto e saudável** |

---

## 7. Riscos

| Risco | Prob. | Impacto | Mitigação |
|-------|-------|---------|-----------|
| TS2742 não tem solução simples | Média | Alto | Testar annotation manual vs tsconfig vs downgrade do pqb |
| Módulos removidos eram usados por API interna | Baixa | Médio | Verificar logs de acesso antes de remover |
| Frontend quebra ao remover backend modules | Baixa | Alto | Buildar web após cada remoção |
| `packages/ui` depende de packages fantasmas | Baixa | Médio | Verificar árvore de dependências antes de deletar |

---

*Menos é mais. Um monorepo de 5 apps que builda vale 10× mais que um de 15 que não builda.*
