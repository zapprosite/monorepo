# Hermes Agency — Skill Taxonomy & Tool Registry

> **Data de criação:** 2026-04-23
> **Versão:** 1.0.0
> **Status:** Implementado parcialmente (circuit breaker existente, registry em elaboração)

---

## 1. Visão Geral

Este documento define a taxonomia completa de skills e o registro de ferramentas para o ecossistema **Hermes Agency**. O sistema é composto por **12 agentes especializados** coordinados por um supervisor CEO (LangGraph).

### Princípios Arquiteturais

- **O(1) Lookups:** Trigger map construído em tempo de inicialização do módulo (`index.ts:268-275`)
- **Fail-Hard Validation:** skill IDs duplicados lançam erro em tempo de carga (`index.ts:88-95`)
- **Circuit Breaker por Skill:** Evita falhas em cascata quando um skill degrada (`circuit_breaker.ts`)
- **Anti-hardcoded:** Toda configuração via `process.env`

---

## 2. Skill Categories

### 2.1 Hierarquia de Categorias

```
┌─────────────────────────────────────────────────────────────┐
│                    ORCHESTRATION                             │
│                  agency-ceo (meta-skill)                      │
│            Routes to all other skills                        │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│ CLIENT        │    │ CONTENT       │    │ PROJECT       │
│ LIFECYCLE     │    │ CREATION      │    │ MANAGEMENT    │
├───────────────┤    ├───────────────┤    ├───────────────┤
│ agency-       │    │ agency-       │    │ agency-       │
│ onboarding    │    │ creative      │    │ organizer     │
│ agency-       │    │ agency-       │    │ agency-pm     │
│ client-success│    │ design        │    │               │
│               │    │ agency-       │    │               │
│               │    │ video-editor  │    │               │
│               │    │ agency-social │    │               │
└───────────────┘    └───────────────┘    └───────────────┘
                              │
                              ▼
                     ┌───────────────┐
                     │ INTELLIGENCE   │
                     ├───────────────┤
                     │ agency-       │
                     │ analytics     │
                     │ agency-       │
                     │ brand-guardian│
                     │ rag-instance- │
                     │ organizer     │
                     └───────────────┘
```

### 2.2 Descrição das Categorias

| Categoria | Skills | Responsabilidade |
|-----------|--------|-----------------|
| **Orchestration** | `agency-ceo` | Meta-skill que roteia para outros skills, executa LangGraph workflows, trigger human gates |
| **Client Lifecycle** | `agency-onboarding`, `agency-client-success` | Ciclo completo do cliente: onboarding → health score → renewal |
| **Content Creation** | `agency-creative`, `agency-design`, `agency-video-editor`, `agency-social` | Geração de conteúdo multi-canal: scripts, imagens, videos, posts |
| **Project Management** | `agency-organizer`, `agency-pm` | Tasks, milestones, status updates, escalations |
| **Intelligence** | `agency-analytics`, `agency-brand-guardian`, `rag-instance-organizer` | Analytics, compliance de marca, RAG/context retrieval |

---

## 3. Tool Maturity Model

### 3.1 Níveis de Maturidade

```
┌─────────────────────────────────────────────────────────────┐
│  LEVEL 4: INTELLIGENT                                       │
│  + LLM judgment, context awareness, multi-step reasoning    │
│  Examples: generate_script, qdrant_aggregate                │
├─────────────────────────────────────────────────────────────┤
│  LEVEL 3: PRODUCTION                                        │
│  + Circuit breaker, retry logic, comprehensive error handling│
│  Examples: create_task, update_task_status, rag_retrieve    │
├─────────────────────────────────────────────────────────────┤
│  LEVEL 2: REAL (Basic)                                      │
│  + Calls API, basic validation, no error handling            │
│  Examples: analyze_engagement (stub data), schedule_post   │
├─────────────────────────────────────────────────────────────┤
│  LEVEL 1: STUB                                              │
│  + Returns mock data, no external calls                      │
│  Examples: create_mood_board (placeholder URLs),           │
│            skill_route (stub response)                      │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Mapeamento de Ferramentas por Nível

| Ferramenta | Skill | Nível | Notas |
|------------|-------|-------|-------|
| `langgraph_execute` | agency-ceo | 3 | Circuit breaker via `invokeWorkflow` |
| `skill_route` | agency-ceo | 1 | Stub — retorna mock |
| `human_gate_trigger` | agency-ceo | 1 | Stub — apenas marca pending |
| `qdrant_query` | agency-ceo | 3 | Qdrant client com error handling |
| `create_client_profile` | agency-onboarding | 3 | Validação Zod, Qdrant storage |
| `init_qdrant_collection` | agency-onboarding | 3 | Criação real de collection |
| `send_welcome_sequence` | agency-onboarding | 2 | Telegram/email stub |
| `create_first_milestone` | agency-onboarding | 3 | Qdrant persistence |
| `transcribe_video` | agency-video-editor | 2 | Stub — retorna mock |
| `extract_key_moments` | agency-video-editor | 2 | Stub — retorna mock |
| `generate_caption` | agency-video-editor | 4 | LLM-powered |
| `upload_to_r2` | agency-video-editor | 2 | Stub — mock R2 URL |
| `create_task` | agency-organizer | 3 | Qdrant persistence, circuit breaker |
| `update_task_status` | agency-organizer | 3 | Qdrant update, validation |
| `assign_to_agent` | agency-organizer | 2 | Stub notification |
| `set_reminder` | agency-organizer | 3 | Redis primary, Qdrant fallback |
| `list_tasks` | agency-organizer | 3 | Qdrant scroll com filters |
| `generate_script` | agency-creative | 4 | LLM-powered marketing |
| `brainstorm_angles` | agency-creative | 4 | LLM-powered |
| `write_copy` | agency-creative | 4 | LLM-powered |
| `create_mood_board` | agency-creative | 1 | Placeholder URLs |
| `qdrant_retrieve` | agency-creative | 3 | Qdrant semantic search |
| `generate_image_prompt` | agency-design | 4 | LLM-powered |
| `create_brand_kit` | agency-design | 2 | Stub |
| `suggest_colors` | agency-design | 4 | LLM-powered |
| `mockup_layout` | agency-design | 2 | Stub |
| `schedule_post` | agency-social | 2 | Stub — não persiste |
| `generate_hashtags` | agency-social | 4 | LLM-powered |
| `cross_post` | agency-social | 2 | Stub |
| `analyze_engagement` | agency-social | 2 | Mock metrics |
| `post_to_social` | agency-social | 2 | Stub |
| `create_milestone` | agency-pm | 3 | Qdrant persistence |
| `check_deliverables` | agency-pm | 3 | Qdrant query |
| `send_status_update` | agency-pm | 3 | Telegram integration |
| `escalate_if_needed` | agency-pm | 3 | Human gate trigger |
| `get_campaign_status` | agency-pm | 3 | Qdrant aggregation |
| `fetch_metrics` | agency-analytics | 3 | Qdrant aggregation |
| `generate_report` | agency-analytics | 4 | LLM-powered |
| `compare_campaigns` | agency-analytics | 3 | Qdrant multi-collection |
| `alert_anomaly` | agency-analytics | 3 | Redis pub/sub |
| `qdrant_aggregate` | agency-analytics | 3 | Qdrant aggregation |
| `check_brand_consistency` | agency-brand-guardian | 4 | LLM judgment |
| `scan_for_violations` | agency-brand-guardian | 4 | LLM-powered |
| `approve_content` | agency-brand-guardian | 3 | Qdrant update |
| `flag_for_review` | agency-brand-guardian | 3 | Qdrant + notification |
| `score_content` | agency-brand-guardian | 4 | LLM scoring |
| `rag_retrieve` | rag-instance-organizer | 3 | Qdrant semantic search |
| `rag_index_document` | rag-instance-organizer | 3 | Qdrant upsert |
| `rag_list_datasets` | rag-instance-organizer | 3 | Dataset enumeration |
| `rag_create_dataset` | rag-instance-organizer | 3 | Collection creation |
| `rag_search` | rag-instance-organizer | 3 | Dataset-scoped search |
| `qdrant_query` | rag-instance-organizer | 3 | Raw Qdrant query |
| `send_nps_survey` | agency-client-success | 3 | Telegram dispatch |
| `collect_feedback` | agency-client-success | 3 | Qdrant storage |
| `schedule_call` | agency-client-success | 3 | Calendar integration |
| `renew_subscription` | agency-client-success | 3 | Stripe/payment stub |
| `update_health_score` | agency-client-success | 3 | Qdrant update |

---

## 4. Cross-Skill Dependencies

### 4.1 Grafo de Dependências

```
agency-creative ──────────────────────────────► agency-brand-guardian
    │                                                ▲
    │ (must pass brand check before publishing)      │
    │                                                │
    │                                                │
    └────────────────────────────────────────────────┘
              (approve_content workflow)


agency-pm ─────────────────────────────────────► agency-analytics
    │                                             ▲
    └────────────── (uses metrics for status) ─────┘


agency-onboarding ────────────────────────────► agency-creative
    │                                          │
    │ (creates first campaign after onboarding) │
    │                                          │
    │                                          │
    └──────────────────────────────────────────┘
           (triggered by first milestone)


rag-instance-organizer ──────────────────────► ALL SKILLS
    │                                           │
    │ (provides context/knowledge retrieval)    │
    │                                           │
    └───────────────────────────────────────────┘


agency-social ────────────────────────────────► agency-creative
    │                                          │
    │ (uses copy/generated content)             │
    │                                          │
    └──────────────────────────────────────────┘
```

### 4.2 Fluxos de Trabalho cross-skill

| Fluxo | Skills Envolvidos | Descrição |
|-------|-------------------|-----------|
| **Content Publishing** | creative → brand-guardian → social | Gera → valida marca → publica |
| **Campaign Status** | pm → analytics → organizer | PM pede métricas → analytics responde → organizer atualiza task |
| **Client Onboarding** | onboarding → creative → organizer | Cria perfil → gera primeiro conteúdo → cria milestone |
| **Context Retrieval** | any → rag-instance-organizer | Qualquer skill pode buscar contexto via RAG |

---

## 5. Skill Triggers

### 5.1 Trigger Map (O(1) Lookup)

Implementado em `index.ts:268-275`:

```typescript
const _skillByTrigger = new Map<string, Skill>();
for (const skill of AGENCY_SKILLS) {
  for (const t of skill.triggers) _skillByTrigger.set(t.toLowerCase(), skill);
}
```

### 5.2 Exact Match Triggers

| Trigger | Skill | Uso |
|---------|-------|-----|
| `/start` | agency-ceo | Inicialização do agency |
| `/agency` | agency-ceo | Menu principal |
| `/ceo` | agency-ceo | Modo supervisor |
| `/onboarding` | agency-onboarding | Fluxo de onboarding direto |
| `brief` | agency-ceo | Criar novo briefing |
| `campaign` | agency-ceo | Operações de campanha |

### 5.3 Keyword Triggers

| Keywords | Skill | Idioma |
|----------|-------|--------|
| `novo cliente`, `bem-vindo`, `onboarding` | agency-onboarding | PT |
| `vídeo`, `video`, `youtube`, `transcrever` | agency-video-editor | PT/EN |
| `tarefa`, `task`, `organizar`, `lembrete` | agency-organizer | PT/EN |
| `criar`, `script`, `copy`, `ideia`, `criativo` | agency-creative | PT |
| `design`, `imagem`, `visual`, `cores` | agency-design | PT/EN |
| `postar`, `social`, `hashtag`, `publicar`, `instagram`, `twitter` | agency-social | PT |
| `milestone`, `status`, `entrega`, `projeto`, `pm` | agency-pm | PT/EN |
| `métricas`, `analytics`, `relatório`, `dashboard`, `análise` | agency-analytics | PT |
| `brand`, `marca`, `consistência`, `approvar`, `revisar` | agency-brand-guardian | PT/EN |
| `rag`, `knowledge base`, `organizar instância`, `indexar docs` | rag-instance-organizer | PT/EN |
| `nps`, `feedback`, `cliente`, `sucesso`, `renovar` | agency-client-success | PT/EN |

### 5.4 Semantic Triggers

Quando o input não faz match exato, o `agency-ceo` usa LLM para determinar:

1. **Intenção do usuário** (categoria)
2. **Skill mais apropiado** para atender
3. **Confiança** na decisão (< 0.7 = human gate)

```typescript
// Pseudo-código para semantic routing
async function semanticRoute(input: string): Promise<Skill | null> {
  const embedding = await embed(input);
  const scores = await Promise.all(
    AGENCY_SKILLS.map(s => cosineSimilarity(embedding, s.triggerVector))
  );
  const best = argmax(scores);
  return scores[best] > 0.7 ? AGENCY_SKILLS[best] : null;
}
```

---

## 6. Tool Registry Enhancement

### 6.1 Estrutura Proposta

```typescript
// Enhanced ToolDefinition com metadados
interface ToolDefinition {
  name: string;
  version: string;           // semver
  skillId: string;
  category: ToolCategory;
  maturity: MaturityLevel;   // 1-4
  deprecationWarning?: string;
  deprecationDate?: string;  // when it will be removed
  lastUpdated: string;       // ISO date
  usageCount: number;        // incrementada em executeTool
  avgLatencyMs?: number;
  errorRate?: number;        // failures / total calls
  dependencies: string[];    // other tools/skills
  envVars?: string[];        // required env vars
  schema: ZodSchema;          // input validation
  handler: ToolFn;
}

type ToolCategory =
  | 'rag'
  | 'marketing'
  | 'task-management'
  | 'analytics'
  | 'brand-protection'
  | 'client-lifecycle'
  | 'video'
  | 'social-media'
  | 'infrastructure'
  | 'orchestration';

type MaturityLevel = 1 | 2 | 3 | 4;
```

### 6.2 Métricas de Uso

Adicionar em `executeTool`:

```typescript
// Métricas por tool (in-memory, persistidas em Qdrant periodicamente)
const toolMetrics = new Map<string, {
  calls: number;
  failures: number;
  totalLatencyMs: number;
  lastCall: number;
}>();

export async function executeTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
  const start = Date.now();
  const metrics = toolMetrics.get(name) ?? { calls: 0, failures: 0, totalLatencyMs: 0, lastCall: 0 };

  metrics.calls++;
  metrics.lastCall = Date.now();

  try {
    const result = await TOOL_REGISTRY[name]?.(args);
    if (result.ok) {
      metrics.totalLatencyMs += Date.now() - start;
    } else {
      metrics.failures++;
    }
    toolMetrics.set(name, metrics);
    return result;
  } catch (err) {
    metrics.failures++;
    toolMetrics.set(name, metrics);
    return { ok: false, error: String(err) };
  }
}
```

### 6.3 Deprecation Warnings

```typescript
// Tool com deprecação
const legacyTool: ToolDefinition = {
  name: 'skill_route',
  version: '1.0.0',
  skillId: 'agency-ceo',
  category: 'orchestration',
  maturity: 1,
  deprecationWarning: 'Use langgraph_execute with workflow=route instead',
  deprecationDate: '2026-06-01',  // Remove after this date
  lastUpdated: '2026-01-15',
  usageCount: 0,
  dependencies: [],
  schema: z.object({ input: z.string() }),
  handler: skill_route,
};

// Check em executeTool
export async function executeTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
  const def = TOOL_DEFINITIONS[name];
  if (def?.deprecationWarning) {
    console.warn(`[DEPRECATION] Tool '${name}' is deprecated: ${def.deprecationWarning}`);
    if (def.deprecationDate && new Date() > new Date(def.deprecationDate)) {
      return { ok: false, error: `Tool '${name}' has been removed as of ${def.deprecationDate}` };
    }
  }
  // ...
}
```

---

## 7. Implementação Atual vs Proposta

### 7.1 O que Existe

| Componente | Status | Localização |
|------------|--------|-------------|
| Skill Registry | ✅ Implementado | `index.ts` |
| O(1) Trigger Lookup | ✅ Implementado | `index.ts:268-275` |
| Tool Registry | ✅ Implementado | `tool_registry.ts` |
| Circuit Breaker | ✅ Implementado | `circuit_breaker.ts` |
| Validation (duplicates) | ✅ Implementado | `index.ts:87-127` |
| Tool Maturity Levels | ❌ Não implementado | N/A |
| Versioning | ❌ Não implementado | N/A |
| Deprecation Warnings | ❌ Não implementado | N/A |
| Usage Metrics | ❌ Não implementado | N/A |
| Semantic Triggers | ❌ Parcial (LLM judge existe) | `index.ts` comments |

### 7.2 Tasks de Implementação

- [ ] **Maturity Migration:** Classificar cada tool existente no Tool Maturity Model
- [ ] **ToolDefinitions:** Criar `tool_registry_definitions.ts` com metadados completos
- [ ] **Metrics Collection:** Instrumentar `executeTool` com métricas de uso
- [ ] **Deprecation System:** Adicionar warnings e datas de remoção para tools Level 1
- [ ] **Semantic Routing:** Implementar `semanticRoute()` com embeddings
- [ ] **Health Endpoint:** Expor `/health/tools` com métricas e status

---

## 8. Referências

- Skill Registry: `apps/hermes-agency/src/skills/index.ts`
- Tool Registry: `apps/hermes-agency/src/skills/tool_registry.ts`
- Circuit Breaker: `apps/hermes-agency/src/skills/circuit_breaker.ts`
- Qdrant Client: `apps/hermes-agency/src/qdrant/client.ts`
- LangGraph Supervisor: `apps/hermes-agency/src/langgraph/supervisor.ts`

---

## 9. Histórico de Alterações

| Versão | Data | Autor | Descrição |
|--------|------|-------|-----------|
| 1.0.0 | 2026-04-23 | Claude | Versão inicial com taxonomy completa |
