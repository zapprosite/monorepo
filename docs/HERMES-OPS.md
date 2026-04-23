# Hermes Agency Suite — Manual de Operações

**Versão:** 1.0.0
**Data de criação:** 2026-04-23
**Última verificação:** 2026-04-23
**Owner:** Platform Engineering
**Stack:** Node.js/Bun + TypeScript + LangGraph + Qdrant + Trieve + PostgreSQL MCP + Mem0

---

## Tabela de Conteúdo

1. [Visão Geral do Serviço](#1-visão-geral-do-serviço)
2. [Catálogo de Serviços](#2-catálogo-de-serviços)
3. [Endpoints de Saúde](#3-endpoints-de-saúde)
4. [Roteamento de Skills](#4-roteamento-de-skills)
5. [Arquitetura de Memória](#5-arquitetura-de-memória)
6. [Integração RAG](#6-integração-rag)
7. [Circuit Breaker](#7-circuit-breaker)
8. [PostgreSQL MCP](#8-postgresql-mcp)
9. [Operações](#9-operações)
10. [Troubleshooting](#10-troubleshooting)
11. [Monitoramento](#11-monitoramento)
12. [Desenvolvimento](#12-desenvolvimento)

---

## 1. Visão Geral do Serviço

### 1.1 O que é o Hermes Agency

O **Hermes Agency** é um sistema multi-agente de marketing e campanhas de IA, coordenado por um supervisor CEO (CEO_REFRIMIX_bot). O sistema utiliza 12 agentes especializados organizados por domínio (criativo, social, design, onboarding, etc.) e orquestra workflows LangGraph para交付 de campanhas de alto impacto.

### 1.2 Arquitetura de Alto Nível

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Hermes Agency (porta 3001)                    │
│                                                                      │
│  ┌──────────────────┐                                               │
│  │  CEO_REFRIMIX_bot │ ← Supervisor (roteia, delega, coordena)       │
│  │  (LangGraph)      │                                               │
│  └────────┬─────────┘                                               │
│           │                                                          │
│  ┌────────▼─────────────────────────────────────────────────────┐   │
│  │                    SKILL LAYER (12 skills)                    │   │
│  │  agency-onboarding  agency-creative  agency-social  agency-pm  │   │
│  │  agency-design      agency-analytics agency-brand-guardian    │   │
│  │  agency-video-editor agency-organizer rag-instance-organizer   │   │
│  │  agency-client-success                                       │   │
│  └────────┬─────────────────────────────────────────────────────┘   │
│           │                                                          │
│  ┌────────▼─────────────────────────────────────────────────────┐   │
│  │                    TOOL REGISTRY (40+ ferramentas)           │   │
│  │  qdrant_query  generate_script  create_task  rag_retrieve    │   │
│  │  score_content  upload_to_r2  analyze_engagement  etc.       │   │
│  └────────┬─────────────────────────────────────────────────────┘   │
│           │                                                          │
│  ┌────────▼─────────────────────────────────────────────────────┐   │
│  │              MEMORY LAYER (Mem0 + Qdrant)                   │   │
│  │  Session Memory (in-memory cache + Qdrant persist)           │   │
│  │  Long-Term Memory (client preferences, brand guidelines)     │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      INFRASTRUCTURE STACK                            │
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │
│  │   Qdrant     │  │   Trieve     │  │ PostgreSQL   │               │
│  │  (vetor DB)  │  │  (RAG SaaS)  │  │  MCP (4017) │               │
│  │  porta 6333  │  │  porta 6435  │  │              │               │
│  └──────────────┘  └──────────────┘  └──────────────┘               │
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │
│  │ LiteLLM      │  │   Ollama     │  │    Redis     │               │
│  │ (proxy LLM)  │  │ (embeddings) │  │  (rate limit │               │
│  │  porta 4000  │  │  porta 11434│  │  & reminders)│               │
│  └──────────────┘  └──────────────┘  └──────────────┘               │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.3 Fluxo de Requisição Típico

```
Usuário → Telegram Bot → agency_router.routeToSkill()
                              │
                    ┌─────────▼─────────┐
                    │ 1. Trigger Check  │ → getSkillByTrigger()
                    └─────────┬─────────┘
                              │ (no match)
                    ┌─────────▼─────────────────────────┐
                    │ 2. CEO LLM Routing                │
                    │    askCeoToRoute()                │
                    │    → MiniMax M2.7 via LiteLLM    │
                    │    → injeta Mem0 context         │
                    │    → injeta RAG context          │
                    └─────────┬─────────────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │ 3. Skill Execute │ → executeSkill()
                    └─────────┬─────────┘
                              │
               ┌──────────────┼──────────────┐
               ▼              ▼              ▼
        ┌───────────┐  ┌───────────┐  ┌───────────┐
        │  Brand    │  │  Human    │  │  Tools   │
        │ Guardian  │  │   Gate    │  │ Registry │
        │ (≥0.8)   │  │ (≥0.7)   │  │          │
        └───────────┘  └───────────┘  └───────────┘
```

---

## 2. Catálogo de Serviços

### 2.1 Serviço Principal

| Atributo | Valor |
|----------|-------|
| **Nome** | Hermes Agency Suite |
| **Porta** | 3001 |
| **Container Docker** | `zappro-hermes-agency` |
| **Health Endpoint** | `http://localhost:3001/health` |
| **URL Externa** | `https://hermes-agency.zappro.site` |
| **Versão** | 0.1.0 |

### 2.2 Skills Disponíveis (12 total)

| Skill ID | Nome | Descrição | Triggers |
|----------|------|-----------|----------|
| `agency-ceo` | CEO MIX | Router supervisor — roteia tasks, executa LangGraph, triggers human gates | `/start`, `/agency`, `brief`, `campaign` |
| `agency-onboarding` | ONBOARDING | Onboarding de novo cliente — cria perfil, inicializa Qdrant, envia boas-vindas | `novo cliente`, `onboarding`, `bem-vindo`, `/onboarding` |
| `agency-video-editor` | VIDEO EDITOR | Processamento de vídeo — transcreve, extrai momentos-chave, gera legendas | `vídeo`, `video`, `youtube`, `transcrever` |
| `agency-organizer` | ORGANIZADOR | Gerenciamento de tasks — cria tasks, atualiza status, atribui a agentes | `tarefa`, `task`, `organizar`, `lembrete` |
| `agency-creative` | CREATIVE | Criação de conteúdo — gera scripts, brainstorm de ângulos, escreve copy | `criar`, `script`, `copy`, `ideia`, `criativo` |
| `agency-design` | DESIGN | Design visual — gera prompts de imagem, cria brand kits, sugere cores | `design`, `imagem`, `visual`, `cores` |
| `agency-social` | SOCIAL MEDIA | Gerenciamento de redes sociais — agenda posts, gera hashtags, cross-post | `postar`, `social`, `hashtag`, `publicar`, `instagram`, `twitter` |
| `agency-pm` | PROJECT MANAGER | Gerenciamento de projetos — cria milestones, verifica entregas, escalona | `milestone`, `status`, `entrega`, `projeto`, `pm` |
| `agency-analytics` | ANALYTICS | Analytics e relatórios — busca métricas, gera relatórios, compara campanhas | `métricas`, `analytics`, `relatório`, `dashboard`, `análise` |
| `agency-brand-guardian` | BRAND GUARDIAN | Aplicação de consistência de marca — verifica consistência, escaneia violações | `brand`, `marca`, `consistência`, `approvar`, `revisar` |
| `rag-instance-organizer` | INSTANCE ORGANIZER | Organiza instâncias RAG por app/lead — cria datasets, indexa docs | `organizar instância`, `rag`, `knowledge base`, `indexar docs` |
| `agency-client-success` | CLIENT SUCCESS | Gestão de sucesso do cliente — envia NPS, coleta feedback, renova assinaturas | `nps`, `feedback`, `cliente`, `sucesso`, `renovar` |

### 2.3 LangGraph Workflows

| Workflow | Tipo | Descrição |
|----------|------|-----------|
| `content_pipeline` | **StateGraph (WF-1)** | Pipeline de conteúdo completo: CREATIVE → VIDEO → DESIGN → BRAND_GUARDIAN → HUMAN_GATE → SOCIAL → ANALYTICS |
| `onboarding` | Stub sequencial (WF-2) | Fluxo de onboarding de novo cliente |
| `lead_qualification` | Stub sequencial (WF-5) | Qualificação de leads |
| `social_calendar` | Stub sequencial (WF-4) | Geração de calendário social |
| `status_update` | Stub sequencial (WF-3) | Geração de updates de status |

### 2.4 Tool Registry

O registry contém **40+ ferramentas** registradas. Algumas das principais:

**Ferramentas de Roteamento (CEO):**
- `langgraph_execute` — Executa workflows LangGraph
- `skill_route` — Roteamento de skill
- `human_gate_trigger` — Trigger de portão humano
- `qdrant_query` — Consulta vetorial no Qdrant

**Ferramentas de Onboarding:**
- `create_client_profile` — Cria perfil de cliente no Qdrant
- `init_qdrant_collection` — Inicializa collections Qdrant para cliente
- `send_welcome_sequence` — Envia sequência de boas-vindas via Telegram
- `create_first_milestone` — Cria primeiro milestone de campanha

**Ferramentas de Criação:**
- `generate_script` — Gera script de vídeo marketing
- `brainstorm_angles` — Brainstorm de ângulos criativos
- `write_copy` — Escreve copy para plataforma específica
- `create_mood_board` — Cria mood board (placeholder)

**Ferramentas de Social Media:**
- `schedule_post` — Agenda post (stub integração)
- `generate_hashtags` — Gera hashtags
- `analyze_engagement` — Analisa engajamento (mock)

**Ferramentas de Tarefas:**
- `create_task` — Cria task no Qdrant
- `update_task_status` — Atualiza status de task
- `assign_to_agent` — Atribui task a agente
- `set_reminder` — Define lembrete (Redis + Qdrant fallback)
- `list_tasks` — Lista tasks

**Ferramentas RAG:**
- `rag_retrieve` — Recupera contexto via Trieve
- `rag_search` — Busca em dataset específico
- `rag_create_dataset` — Cria novo dataset Trieve
- `rag_list_datasets` — Lista datasets disponíveis

**Ferramentas de Brand Guardian:**
- `check_brand_consistency` — Verifica consistência de marca
- `scan_for_violations` — Escaneia violações
- `approve_content` — Aprova conteúdo
- `flag_for_review` — Flag para revisão
- `score_content` — Score de conteúdo (0-1)

### 2.5 Coleções Qdrant (9 collections)

| Collection | Descrição | Schema |
|------------|-----------|--------|
| `agency_clients` | Perfis de clientes | `client_id, name, plan, health_score, onboarding_complete` |
| `agency_campaigns` | Campanhas de marketing | `campaign_id, client_id, status, type, metrics` |
| `agency_conversations` | Histórico de conversas | `conversation_id, client_id, messages, last_message` |
| `agency_assets` | Assets creativos (imagens, vídeos) | `asset_id, client_id, type, tags, url` |
| `agency_brand_guides` | Guias de marca por cliente | `guide_id, client_id, voice_tone, colors, fonts` |
| `agency_tasks` | Tasks e entregáveis | `task_id, campaign_id, assignee, status, priority` |
| `agency_video_metadata` | Transcrição e momentos-chave | `video_id, campaign_id, transcription, key_moments` |
| `agency_knowledge` | Base de conhecimento | `doc_id, type, content, embedding` |
| `agency_working_memory` | Memória de trabalho por sessão | `session_id, agent_id, context_window, ttl` |

### 2.6 Variáveis de Ambiente Obrigatórias

```bash
# Core
HERMES_AGENCY_PORT=3001
HERMES_AGENCY_BOT_TOKEN=       # Token do Telegram Bot
AI_GATEWAY_FACILITY_KEY=       # Chave do AI Gateway
HERMES_API_KEY=                # API key para endpoints autenticados

# Data Stores
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=
OLLAMA_URL=http://localhost:11434
OLLAMA_EMBED_MODEL=nomic-embed-text

# LLM (via LiteLLM)
MINIMAX_API_KEY=
MINIMAX_API_BASE=https://api.minimax.io/anthropic/v1

# Rate Limiting
HERMES_RATE_WINDOW_MS=10000
HERMES_RATE_MAX_MSGS=5

# Circuit Breaker
CIRCUIT_BREAKER_THRESHOLD=3
CIRCUIT_BREAKER_RECOVERY_MS=30000

# Gates
BRAND_GUARDIAN_THRESHOLD=0.8
HUMAN_GATE_THRESHOLD=0.7

# RAG (Trieve)
TRIEVE_URL=http://localhost:6435
TRIEVE_API_KEY=
TRIEVE_DEFAULT_DATASET_ID=

# PostgreSQL MCP
MCP_POSTGRES_HOST=localhost
MCP_POSTGRES_PORT=4017

# Admin
HERMES_ADMIN_USER_IDS=          # IDs de admin para endpoints privilegiados
```

---

## 3. Endpoints de Saúde

### 3.1 `/health` — Status Básico

**Autenticação:** Nenhuma
**Uso:** Verificação rápida de disponibilidade

```bash
curl http://localhost:3001/health
```

**Resposta típica:**
```json
{
  "status": "ok",
  "service": "hermes-agency-suite",
  "version": "0.1.0",
  "timestamp": "2026-04-23T10:00:00.000Z"
}
```

### 3.2 `/ready` — Readiness Probe

**Autenticação:** Nenhuma
**Uso:** Kubernetes readiness probe

```bash
curl http://localhost:3001/ready
```

**Resposta:**
```json
{
  "ready": true,
  "timestamp": "2026-04-23T10:00:00.000Z"
}
```

### 3.3 `/live` — Liveness Probe

**Autenticação:** Nenhuma
**Uso:** Kubernetes liveness probe (mesmo que `/health` neste caso)

### 3.4 `/health/authenticated` — Status Completo

**Autenticação:** Bearer token (via `HERMES_API_KEY`)
**Uso:** Dashboard de status completo com circuit breakers e métricas

```bash
curl -H "Authorization: Bearer $HERMES_API_KEY" \
     http://localhost:3001/health/authenticated
```

**Resposta típica:**
```json
{
  "status": "ok",
  "service": "hermes-agency-suite",
  "version": "0.1.0",
  "timestamp": "2026-04-23T10:00:00.000Z",
  "circuitBreakers": [
    {
      "skillId": "agency-creative",
      "state": "closed",
      "failureCount": 0,
      "lastFailure": null,
      "lastSuccess": 1713868800000,
      "tripReason": null
    }
  ],
  "rateLimits": {
    "windowMs": 10000,
    "maxMessages": 5,
    "redisAvailable": true
  }
}
```

### 3.5 `/health/circuit-breakers` — Status de Circuit Breakers

**Autenticação:** Requer `userId` na query string que conste em `HERMES_ADMIN_USER_IDS`
**Uso:** Admin-only para ver e resetar circuit breakers

```bash
curl "http://localhost:3001/health/circuit-breakers?userId=123456"
```

---

## 4. Roteamento de Skills

### 4.1 Fluxo de Roteamento

O `agency_router.routeToSkill()` implementa um fluxo de 2 estágios:

```
┌─────────────────────────────────────────────────────────────────────┐
│                    ROUTING FLOW                                      │
│                                                                      │
│  1. TRIGGER-BASED ROUTING (O(1) Map lookup)                         │
│     getSkillByTrigger(input)                                         │
│     ↓ (match encontrado)                                            │
│     executeSkill(skillId, ...)                                       │
│                                                                      │
│  2. LLM-BASED ROUTING (CEO routing)                                  │
│     askCeoToRoute()                                                  │
│       ├── Injeta Mem0 context (histórico recente)                   │
│       ├── Injeta RAG context (conhecimento Trieve)                  │
│       ├── Prompt: "Você é o CEO da REFRIMIX..."                     │
│       └── GPT-4o via LiteLLM (CEO_MODEL=gpt-4o)                     │
│     ↓ (skill ID retornada)                                          │
│     executeSkill(skillId, ...)                                       │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.2 Trigger-Based Routing

Busca O(1) em um Map de triggers em lowercase:

```typescript
// Fonte: src/skills/index.ts
const _skillByTrigger = new Map<string, Skill>();
for (const skill of AGENCY_SKILLS) {
  for (const t of skill.triggers) {
    _skillByTrigger.set(t.toLowerCase(), skill);
  }
}

export function getSkillByTrigger(input: string): Skill | undefined {
  return _skillByTrigger.get(input.toLowerCase());
}
```

### 4.3 CEO LLM-Based Routing

Quando não há match de trigger, o CEO (modelo GPT-4o via LiteLLM) decide qual skill usar:

```typescript
// Fonte: src/router/agency_router.ts
const CEO_MODEL = process.env['CEO_MODEL'] ?? 'gpt-4o';

async function askCeoToRoute(input: string, ctx: RouterContext, sessionId: string): Promise<string> {
  // 1. Recupera contexto de memória (Mem0)
  const recentMemory = await mem0GetRecent(sessionId, 5);
  const memoryContext = formatMem0Context(recentMemory);

  // 2. Recupera contexto RAG (Trieve)
  const ragResults = await ragRetrieve(sanitizedInput, 3);
  const ragContext = ragResults.map(r => `— [score:${r.score}] ${r.content}`).join('\n');

  // 3. Monta prompt de roteamento
  const prompt = `Você é o CEO da REFRIMIX, uma empresa de design e marketing.
Você coordena agentes especializados para entregar campanhas de alto impacto.
Analise a mensagem do cliente e escolha a skill mais adequada...

Skills disponíveis:
${available}

Responda apenas com o ID da skill (ex: agency-onboarding).`;

  // 4. Fallback: se LLM falhar, retorna agency-ceo
  try {
    const result = await llmComplete({ messages: [{ role: 'user', content: prompt }], ... });
    return parseSkillId(result.content);
  } catch {
    return 'agency-ceo';  // Safe fallback
  }
}
```

### 4.4 Brand Guardian Gate

Antes de executar tools para skills de conteúdo (`agency-creative`, `agency-social`, `agency-design`), o Brand Guardian avalia o conteúdo:

```typescript
// Fonte: src/router/agency_router.ts
const BRAND_GUARDIAN_THRESHOLD = 0.8;

if (['agency-creative', 'agency-social', 'agency-design'].includes(skillId)) {
  const brandScore = await scoreContent(input);
  if (brandScore < BRAND_GUARDIAN_THRESHOLD) {
    recordSuccess(skillId);
    return `⚠️ Brand Guardian score: ${brandScore.toFixed(2)} (< 0.8)
🔒 Publicação bloqueada — revisão humana necessária.`;
  }
}
```

### 4.5 Human Gate

Se a confiança da mensagem for baixa (< 0.7), o fluxo pede confirmação humana:

```typescript
// Fonte: src/router/agency_router.ts
const HUMAN_GATE_THRESHOLD = parseFloat(process.env['HUMAN_GATE_THRESHOLD'] ?? '0.7');

const confidence = await assessConfidence(input);
if (confidence < HUMAN_GATE_THRESHOLD) {
  return `🤔 Confiança baixa (${confidence.toFixed(2)}) — confirmação humana requerida.
Mensagem: "${input}"
Skill sugerida: ${skill.name}`;
}
```

---

## 5. Arquitetura de Memória

### 5.1 Visão Geral da Camada de Memória

```
┌─────────────────────────────────────────────────────────────────────┐
│                     MEMORY ARCHITECTURE                              │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    IN-MEMORY CACHE                           │   │
│  │  (_sessionHistory Map)                                       │   │
│  │  • Acesso ultra-rápido (μs)                                 │   │
│  │  • Não persistente (volátil)                                │   │
│  │  • Max 50 entries por sessão                                │   │
│  │  • Sincronizado com Qdrant após cada store                  │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                              │                                       │
│                              ▼                                       │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                 QDRANT (agency_working_memory)                │   │
│  │  • Persistência com TTL                                     │   │
│  │  • Vetores de 1024 dimensões (nomic-embed-text)             │   │
│  │  • TTL: 7 dias (normal), 30 dias (important), 90 dias (critical)│
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                 LONG-TERM MEMORY (Qdrant collections)          │   │
│  │  • agency_clients (preferências)                             │   │
│  │  • agency_brand_guides (guias de marca)                      │   │
│  │  • agency_campaigns (contexto de campanha)                   │   │
│  │  • agency_conversations (histórico)                          │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 5.2 Mem0 — Session Memory

**Fonte:** `src/mem0/client.ts`

```typescript
// TTL por importance level
const TTL_MS = {
  normal: 7 * 24 * 60 * 60 * 1000,     // 7 dias
  important: 30 * 24 * 60 * 60 * 1000, // 30 dias
  critical: 90 * 24 * 60 * 60 * 1000,  // 90 dias
};

// Armazena memória com TTL
await mem0Store({
  sessionId: 'session-123',
  role: 'user',
  content: 'Cliente quer campanha para Natal',
  importance: 'important'  // TTL de 30 dias
});

// Recupera Entries recentes
const entries = await mem0GetRecent('session-123', 5);

// Busca por similaridade vetorial
const results = await mem0Search(
  'campanha natal',
  'session-123',
  { limit: 10, importance: 'important' }
);
```

### 5.3 In-Memory Cache

```typescript
// Fonte: src/mem0/client.ts
const _sessionHistory = new Map<string, Mem0Entry[]>();

// Adiciona ao cache in-memory (rápido, volátil)
export function addToSessionHistory(sessionId: string, entry: Omit<Mem0Entry, 'id'>): void {
  const history = _sessionHistory.get(sessionId) ?? [];
  history.push({ ...entry, id: `${sessionId}-${entry.timestamp}` });
  if (history.length > 50) history.shift();  // Max 50
  _sessionHistory.set(sessionId, history);
}

// Recupera do cache
export function getSessionHistory(sessionId: string, limit = 10): Mem0Entry[] {
  return (_sessionHistory.get(sessionId) ?? []).slice(-limit);
}
```

### 5.4 Embeddings (Ollama)

**Fonte:** `src/mem0/embeddings.ts`

```typescript
const OLLAMA_URL = process.env['OLLAMA_URL'] ?? 'http://localhost:11434';
const EMBED_MODEL = process.env['OLLAMA_EMBED_MODEL'] ?? 'nomic-embed-text';
const EMBED_DIMENSION = 1024;  // Dimensão do nomic-embed-text

// Gera embedding via Ollama
const embedding = await generateEmbedding('texto para embeddar');

// Fallback: pseudo-embedding determinístico (se Ollama indisponível)
function generatePseudoEmbedding(text: string): number[] {
  const vec = new Array(1024).fill(0);
  for (let i = 0; i < text.length; i++) {
    vec[i % 1024] += text.charCodeAt(i) * 0.01;
  }
  // Normaliza
  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
  return norm > 0 ? vec.map((v) => v / norm) : vec;
}
```

### 5.5 Long-Term Memory

**Fonte:** `src/mem0/longterm.ts`

```typescript
// Armazena preferência de cliente
await storeClientPreference(
  'client-123',
  'Cliente prefere tom informal em campanhas',
  { category: 'tone', source: 'onboarding_call' }
);

// Armazena guideline de marca
await storeBrandGuideline(
  'client-123',
  'Nunca usar azul royal — usar apenas azul marinho',
  { version: '2.0' }
);

// Armazena contexto de campanha
await storeCampaignContext(
  'campaign-456',
  'Campanha de Natal com foco em urgência',
  { quarter: 'Q4', theme: 'urgency' }
);

// Recupera todas as memórias de um cliente
const { preferences, brandGuidelines, interactions } = await getClientMemory('client-123');

// Busca em toda a agency memory
const results = await searchAllAgencyMemory('campanha urgência', { limit: 5 });
```

---

## 6. Integração RAG

### 6.1 Visão Geral

O Hermes utiliza **Trieve** como sistema RAG para busca de conhecimento contextual:

```
┌─────────────────────────────────────────────────────────────────────┐
│                        RAG ARCHITECTURE                              │
│                                                                      │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐         │
│  │   Trieve     │    │   Hermes     │    │    Qdrant    │         │
│  │  (datasets)  │◄───│   Agency     │───►│  (collections│         │
│  │              │    │              │    │   agency_*)  │         │
│  │ porta 6435   │    │              │    │  porta 6333  │         │
│  └──────────────┘    └──────────────┘    └──────────────┘         │
│                                                                      │
│  Trieve: datasets por dimensão (app, lead, knowledge)                │
│  Qdrant: collections agency_* (memória, clientes, campaigns)        │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 6.2 Datasets Trieve por Dimensão

| Dataset | Dimensão | Descrição | Chunking |
|---------|----------|-----------|----------|
| `hermes-knowledge` | app=hermes | Base de conhecimento do Hermes — skills, prompts | heading |
| `hermes-memory` | app=hermes, lead=memory | Memória de trabalho do Hermes | sentence |
| `monorepo-docs` | app=monorepo | SPECs, AGENTS.md, documentação | heading |
| `hvacr-knowledge` | app=hvacr | Documentação HVAC-R swarm | heading |
| `governance` | app=ops, lead=governance | AI governance docs | heading |
| `pgadmin` | app=pgadmin | Admin PostgreSQL — schemas, queries | sentence |
| `qdrant` | app=qdrant | Vector DB knowledge | heading |

### 6.3 Dataset Naming Convention

```typescript
// Fonte: src/skills/rag-instance-organizer.ts
export function buildDatasetName(config: DatasetConfig): string {
  const parts: string[] = [config.app.toLowerCase()];
  if (config.lead) parts.push(`lead-${config.lead.toLowerCase()}`);
  return parts.join('-');
}

// Exemplos:
// hermes-knowledge
// painel-lead-alfa-knowledge
// hvacr-lead-xyz-memory
```

### 6.4 Ferramentas RAG

```typescript
// Recupera contexto (usa TRIEVE_DEFAULT_DATASET_ID)
const results = await ragRetrieve('como fazer onboarding de cliente?', 5);
// Retorna: Array<RagSearchResult> com score de similaridade

// Busca em dataset específico
const results = await ragSearch(
  'dataset-id-123',
  'campanhas de natal',
  5
);

// Lista datasets disponíveis
const datasets = await listDatasets();
// Retorna: Array<{ id, name, description }>

// Cria novo dataset
const newDataset = await createDataset({
  app: 'painel',
  lead: 'cliente-alfa',
  description: 'Knowledge base do cliente alfa',
  chunkingStrategy: 'heading'
});
```

### 6.5 Chunk Management

```typescript
// Limite bulk: 120 chunks por request (Trieve API)
const BULK_LIMIT = 120;

// Indexa documentos em lotes
for (let i = 0; i < documents.length; i += BULK_LIMIT) {
  const batch = documents.slice(i, i + BULK_LIMIT);
  await indexDocument(datasetId, batch);
}
```

### 6.6 Fallback Chain

Se Trieve falhar, o sistema continua com degradação graceful:

```
ragRetrieve() → Trieve API
    ↓ (falha)
ragSearch() → Trieve API
    ↓ (falha)
RAG context vazio ("// No RAG context available")
```

---

## 7. Circuit Breaker

### 7.1 Arquitetura

```
┌─────────────────────────────────────────────────────────────────────┐
│                    CIRCUIT BREAKER STATES                            │
│                                                                      │
│  CLOSED ──────────────────────────────────────────────────────────►  │
│    │    (3 falhas)                                                   │
│    │                                                                 │
│    ▼                                                                 │
│  OPEN ─────────────────────────────────────────────────────────────  │
│    │    (30s cooldown)                                              │
│    │                                                                 │
│    ▼                                                                 │
│  HALF_OPEN ──────────────────────────────────────────────────────►  │
│    │    (test call succeed)              (test call fail)           │
│    │                              ◄───                              │
│    ▼                                                                 │
│  CLOSED                                                           │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 7.2 Configuração

```typescript
// Fonte: src/skills/circuit_breaker.ts
const FAILURE_THRESHOLD = parseInt(process.env['CIRCUIT_BREAKER_THRESHOLD'] ?? '3', 10);
const RECOVERY_TIMEOUT  = parseInt(process.env['CIRCUIT_BREAKER_RECOVERY_MS'] ?? '30000', 10);
```

| Parâmetro | Valor Padrão | Descrição |
|-----------|--------------|-----------|
| `CIRCUIT_BREAKER_THRESHOLD` | 3 | Número de falhas para abrir o circuit |
| `CIRCUIT_BREAKER_RECOVERY_MS` | 30000 | Tempo de cooldown (30s) |

### 7.3 Estados

```typescript
// Fonte: src/skills/circuit_breaker.ts
interface CircuitBreakerState {
  skillId: string;
  state: 'closed' | 'open' | 'half_open';
  failureCount: number;
  lastFailure: number | null;   // timestamp ms
  lastSuccess: number | null;  // timestamp ms
  tripReason: string | null;
}
```

### 7.4 API de Status

```typescript
// Verifica se chamada é permitida
isCallPermitted(skillId: string): boolean
// Retorna true se closed ou half_open

// Registra sucesso
recordSuccess(skillId: string): void
// Reseta failureCount, fecha circuit se half_open

// Registra falha
recordFailure(skillId: string, reason: string): void
// Incrementa contador, abre circuit se threshold atingido

// Obtém estado de um circuit breaker
getCircuitBreaker(skillId: string): CircuitBreakerState | null

// Obtém todos os circuit breakers
getAllCircuitBreakers(): CircuitBreakerState[]

// Reset manual (admin)
resetCircuitBreaker(skillId: string): void
```

### 7.5 Comandos de Verificação

```bash
# Ver todos os circuit breakers (admin)
curl "http://localhost:3001/health/circuit-breakers?userId=123456"

# Reset via tool registry
curl -X POST http://localhost:3001/tools/resetCircuitBreaker \
  -H "Content-Type: application/json" \
  -d '{"skillId": "agency-creative"}'
```

---

## 8. PostgreSQL MCP

### 8.1 Visão Geral

O PostgreSQL MCP (Model Context Protocol) permite acesso a bases PostgreSQL via API HTTP na porta 4017.

```
┌─────────────────────────────────────────────────────────────────────┐
│                    POSTGRESQL MCP (porta 4017)                      │
│                                                                      │
│  Hermes Agency ◄──── HTTP POST ────► MCP Server ◄────────────────►  │
│                                           │                         │
│                                    ┌──────▼──────┐                  │
│                                    │ PostgreSQL  │                  │
│                                    │  Database   │                  │
│                                    └─────────────┘                  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 8.2 Schema por Dimensão (App/Lead)

Cada app/lead possui seu próprio schema PostgreSQL:

```sql
-- Schema pattern: {app}[_{lead}]?
-- Exemplos:
--   hermes_will
--   painel_alfa
--   hvacr_xyz
```

### 8.3 Schema Típico

| Tabela | Descrição |
|--------|-----------|
| `clients` | Perfis de clientes |
| `campaigns` | Campanhas de marketing |
| `tasks` | Tarefas e entregáveis |
| `deliverables` | Entregáveis de campanha |
| `metrics` | Métricas de desempenho |

### 8.4 API de Acesso

```typescript
// Fonte: src/postgres/mcp-client.ts
const MCP_URL = `http://${MCP_HOST}:${MCP_PORT}/tools/call`;

// Operações de Schema
await createSchema('hermes', 'will');
await dropSchema('hermes', 'will');
await listSchemas('hermes');
await listTables('hermes', 'will');

// Operações de Dados
await query('SELECT * FROM clients LIMIT 10', 10);
await write("INSERT INTO clients (name, plan) VALUES ('Test', 'pro')");

// Operações de Índice
await createIndex('hermes', 'will', 'clients', 'idx_clients_email', ['email']);
```

### 8.5 Estratégia de Sync

```
PostgreSQL (MCP) ──sync──► Qdrant (vectors)
     │                           │
     ▼                           ▼
  dados relacionais         busca vetorial
  (transactions)           (similarity)
```

O PostgreSQL mantém o source of truth para dados relacionais, enquanto o Qdrant é usado para busca vetorial.

---

## 9. Operações

### 9.1 Deployment

**Stack:** Docker + Coolify (porta 8000)

```bash
# Verificar containers relacionados
docker ps | grep hermes

# Logs do container
docker logs zappro-hermes-agency --tail 100 -f

# Restart
docker restart zappro-hermes-agency
```

### 9.2 Environment Variables (.env canônico)

Localização: `/srv/monorepo/apps/hermes-agency/.env`

```bash
# ============================================
# HERMES AGENCY SUITE — Production .env
# ============================================

# Core
HERMES_AGENCY_PORT=3001
HERMES_AGENCY_BOT_TOKEN=telegram_bot_token_here
AI_GATEWAY_FACILITY_KEY=your_facility_key
HERMES_API_KEY=your_api_key_for_auth

# Ollama (embeddings + vision)
OLLAMA_URL=http://localhost:11434
OLLAMA_EMBED_MODEL=nomic-embed-text

# Qdrant
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=your_qdrant_api_key

# MiniMax (LLM via LiteLLM)
MINIMAX_API_KEY=your_minimax_key
MINIMAX_API_BASE=https://api.minimax.io/anthropic/v1

# Rate Limiting
HERMES_RATE_WINDOW_MS=10000
HERMES_RATE_MAX_MSGS=5

# Circuit Breaker
CIRCUIT_BREAKER_THRESHOLD=3
CIRCUIT_BREAKER_RECOVERY_MS=30000

# Gates
BRAND_GUARDIAN_THRESHOLD=0.8
HUMAN_GATE_THRESHOLD=0.7

# Trieve RAG
TRIEVE_URL=http://localhost:6435
TRIEVE_API_KEY=your_trieve_key
TRIEVE_DEFAULT_DATASET_ID=your_default_dataset

# PostgreSQL MCP
MCP_POSTGRES_HOST=localhost
MCP_POSTGRES_PORT=4017

# Redis
REDIS_URL=redis://localhost:6379

# Admin
HERMES_ADMIN_USER_IDS=123456,789012
```

### 9.3 Localização e Interpretação de Logs

```bash
# Logs Docker (principais)
docker logs zappro-hermes-agency --since 1h 2>&1 | grep -iE "error|warn|fatal"

# Logs específicos por componente
docker logs zappro-hermes-agency --tail 50 | grep -i circuit
docker logs zappro-hermes-agency --tail 50 | grep -i "skill"
docker logs zappro-hermes-agency --tail 50 | grep -i "rag"

# Scripts de health check
bash /srv/monorepo/scripts/daily-health-check.sh
bash /srv/monorepo/scripts/health-check.sh

# Localização dos scripts
ls -la /srv/monorepo/scripts/
```

### 9.4 Procedimentos de Restart

```bash
# ============================================
# RESTART PROCEDURE — Hermes Agency
# ============================================

# 1. Verificar dependências primeiro
curl -sf http://localhost:6333/health && echo "Qdrant OK" || echo "Qdrant FAIL"
curl -sf http://localhost:11434/api/tags && echo "Ollama OK" || echo "Ollama FAIL"
curl -sf http://localhost:6435/api/v1/health && echo "Trieve OK" || echo "Trieve FAIL"

# 2. Graceful shutdown
docker stop zappro-hermes-agency

# 3. Restart
docker start zappro-hermes-agency

# 4. Verificar startup
sleep 5
docker logs zappro-hermes-agency --tail 30

# 5. Verificar health endpoint
curl -sf http://localhost:3001/health && echo "Hermes OK" || echo "Hermes FAIL"
```

### 9.5 Smoke Tests

```bash
# ============================================
# SMOKE TESTS — Hermes Agency Suite
# ============================================

# Test 1: Health endpoint básico
curl -sf http://localhost:3001/health | jq .status
# Esperado: "ok"

# Test 2: Readiness probe
curl -sf http://localhost:3001/ready | jq .ready
# Esperado: true

# Test 3: Qdrant connectivity
curl -sf http://localhost:6333/health | jq .result
# Esperado: {"status":"available"}

# Test 4: Ollama embeddings
curl -sf -X POST http://localhost:11434/api/embeddings \
  -H "Content-Type: application/json" \
  -d '{"model":"nomic-embed-text","prompt":"test"}' | jq .embedding
# Esperado: array de 1024 floats

# Test 5: Circuit breaker (admin)
curl -s "http://localhost:3001/health/circuit-breakers?userId=123456" | jq .circuitBreakers
# Esperado: array de circuit breakers

# Test 6: Mem0 store/retrieve
# (via Telegram bot ou script de teste)

# Test 7: Trieve RAG
curl -sf http://localhost:6435/api/v1/health | jq .status
# Esperado: "online"
```

---

## 10. Troubleshooting

### 10.1 Circuit Breaker Aberto

**Sintomas:**
- Erro: `⚠️ Skill agency-creative temporarily unavailable (circuit breaker open)`
- Logs: `[CircuitBreaker] agency-creative is OPEN — rejecting call`

**Diagnóstico:**
```bash
# 1. Identificar circuit breakers abertos
curl -s "http://localhost:3001/health/circuit-breakers?userId=123456" | \
  jq '.circuitBreakers[] | select(.state == "open")'

# 2. Ver logs para identificar causa
docker logs zappro-hermes-agency --since 1h | grep -i "circuit" | tail -20

# 3. Verificar erros recentes
docker logs zappro-hermes-agency --since 1h | grep -iE "error|fail" | tail -30
```

**Resolução:**
```bash
# Reset manual do circuit breaker
curl -X POST http://localhost:3001/tools/resetCircuitBreaker \
  -H "Content-Type: application/json" \
  -d '{"skillId": "agency-creative"}'

# Ou esperar 30s (recovery timeout) para auto-recovary
```

**Fallback:**
- Usar skill alternativa enquanto o circuit breaker está aberto
- Ex: `agency-creative` indisponível → usar `agency-ceo` diretamente

### 10.2 Falhas de LLM Routing

**Sintomas:**
- Logs: `[agency_router] askCeoToRoute LLM failed`
- Roteamento sempre cai para `agency-ceo` (fallback)

**Causa raiz típica:**
- LiteLLM down (porta 4000)
- MiniMax API indisponível
- Rate limit atingido

**Diagnóstico:**
```bash
# Verificar LiteLLM
curl -sf http://localhost:4000/health && echo "OK" || echo "FAIL"

# Verificar logs do LiteLLM
docker logs zappro-litellm --tail 50 | grep -iE "error|timeout"

# Verificar rate limits
curl -s http://localhost:4000/rate_limits | jq
```

**Resolução:**
```bash
# Reiniciar LiteLLM se necessário
docker restart zappro-litellm

# Verificar API keys
docker exec zappro-litellm env | grep -iE "minimax|api_key"
```

### 10.3 Problemas de Conexão Qdrant

**Sintomas:**
- Logs: `Connection refused` ou `Qdrant not reachable`
- Hermes entra em "degraded mode"

**Diagnóstico:**
```bash
# Verificar se Qdrant está rodando
docker ps | grep qdrant

# Testar endpoint de saúde
curl -sf http://localhost:6333/health && echo "OK" || echo "FAIL"

# Verificar logs
docker logs qdrant --tail 50

# Verificar espaço em disco
df -h /srv/docker/qdrant
```

**Resolução:**
```bash
# Reiniciar Qdrant
docker restart qdrant
sleep 5

# Verificar se恢复了
curl -sf http://localhost:6333/health && echo "OK" || echo "FAIL"

# Verificar coleções
curl -s http://localhost:6333/collections | jq '.result.collections[].name'
```

**Graceful Degradation:**
- Hermes continua operando mesmo se Qdrant indisponível
- Cache in-memory permanece ativo
- Operações de store falham silenciosamente
- Recupera conectividade automaticamente quando Qdrant volta

### 10.4 Falhas de RAG (Trieve)

**Sintomas:**
- Logs: `[RAG] Search failed`, `[RAG] Failed to retrieve`
- Contexto RAG vem vazio nos logs de routing

**Fallback Chain:**
```
ragRetrieve() → ragSearch() → "// No RAG context available"
```

**Diagnóstico:**
```bash
# Verificar Trieve
curl -sf http://localhost:6435/api/v1/health && echo "OK" || echo "FAIL"

# Listar datasets
curl -s http://localhost:6435/api/v1/datasets | jq '.[].name'

# Testar busca manual
curl -s -X POST http://localhost:6435/api/v1/chunk/search \
  -H "Content-Type: application/json" \
  -H "TR-Dataset: $TRIEVE_DEFAULT_DATASET_ID" \
  -d '{"query":"test query","limit":3}' | jq '.results'
```

**Resolução:**
```bash
# Rebuild de dataset se necessário
# Ver seção 10.4 do OPS_RUNBOOK.md
```

### 10.5 Perda de Sessão Mem0

**Sintomas:**
- Usuário reclama que histórico foi perdido
- Memória não persiste entre sessões

**Diagnóstico:**
```bash
# Verificar se Qdrant tem dados
curl -s http://localhost:6333/collections/agency_working_memory/points/scroll \
  -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $QDRANT_API_KEY" \
  -d '{"limit": 5, "with_payload": true}' | jq '.result.points'

# Verificar TTL dos entries
# Entries com expiresAt < now são expirados
```

**Cache vs Persistência:**

| Camada | Persistência | Recuperação |
|--------|--------------|-------------|
| In-memory (`_sessionHistory`) | Volátil (reinício limpa) | Não recuperável |
| Qdrant (`agency_working_memory`) | Persistente com TTL | Recuperável |

**Resolução:**
- Sessões ativas: Recupera do in-memory cache se ainda presente
- Sessões expiradas: Recupera apenas se tinha importância `critical` (90 dias TTL)
- Para dados críticos: usar `longTermMemory` (sem TTL automático)

---

## 11. Monitoramento

### 11.1 Métricas Chave

| Métrica | Descrição | Threshold Alert |
|---------|-----------|-----------------|
| `circuit_breaker_open_duration` | Tempo com circuit breaker aberto | > 5 min = CRITICAL |
| `error_rate` | Taxa de erros por janela | > 5% = WARNING |
| `p95_latency` | Latência p95 de requests | > 2s = WARNING |
| `llm_latency` | Latência de chamadas LLM | > 10s = WARNING |
| `qdrant_search_latency` | Latência de busca vetorial | > 500ms = WARNING |
| `rag_retrieve_failures` | Falhas de recuperação RAG | > 10% = WARNING |
| `mem0_cache_hit_rate` | Hit rate do cache Mem0 | < 80% = WARNING |

### 11.2 Grafana Dashboard Panels

**Dashboard:** `Hermes Agency` (em `http://localhost:3000`)

**Panels recomendados:**

1. **Overview**
   - Request rate (req/min)
   - Error rate (%)
   - Active sessions

2. **Circuit Breakers**
   - State per skill (pie chart: closed/open/half_open)
   - Time in open state per skill
   - Last failure reason

3. **LLM Performance**
   - Latency by model (boxplot)
   - Token usage by provider
   - Error rate by model

4. **Memory**
   - Mem0 operations/sec
   - Qdrant collections size
   - TTL expiration rate

5. **RAG**
   - Retrieve latency
   - Search success rate
   - Dataset sizes

6. **Skills Usage**
   - Invocations per skill
   - Average execution time per skill
   - Tool success rate per skill

### 11.3 Alert Thresholds

```yaml
# Prometheus alerting rules (exemplo)

groups:
  - name: hermes-agency
    rules:
      - alert: CircuitBreakerOpen
        expr: circuit_breaker_open_duration > 300
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Circuit breaker {{ $labels.skill }} open for > 5min"

      - alert: HermesErrorRate
        expr: hermes_error_rate > 0.05
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Hermes error rate {{ $value }} > 5%"

      - alert: HermesLatencyHigh
        expr: hermes_p95_latency_seconds > 2
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Hermes p95 latency {{ $value }}s > 2s"

      - alert: QdrantDown
        expr: qdrant_health_check == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Qdrant is down"

      - alert: LiteLLMDown
        expr: litellm_health_check == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "LiteLLM is down"
```

---

## 12. Desenvolvimento

### 12.1 Adicionando Nova Skill

**Padrão:** `skill_registry.ts`

```typescript
// 1. Adicionar skill ao AGENCY_SKILLS em src/skills/index.ts

export const AGENCY_SKILLS: readonly Skill[] = [
  // ... skills existentes ...
  {
    id: 'agency-minha-nova-skill',
    name: 'MINHA NOVA SKILL',
    description: 'Descrição da nova skill',
    tools: ['tool_um', 'tool_dois', 'tool_tres'],
    triggers: ['trigger1', 'trigger2', '/comando'],
  },
];

// 2. Validar que todas as tools estão em REGISTERED_TOOLS
const REGISTERED_TOOLS = new Set<string>([
  // ... tools existentes ...
  'tool_um', 'tool_dois', 'tool_tres',  // Adicionar aqui
]);

// 3. Implementar tools em src/skills/tool_registry.ts
export const TOOL_REGISTRY: Record<string, ToolFn> = {
  // ... tools existentes ...
  tool_um: async (args) => { /* implementação */ },
  tool_dois: async (args) => { /* implementação */ },
  tool_tres: async (args) => { /* implementação */ },
};

// 4. O(n) validation roda automaticamente no module load
// Validará: IDs únicos, triggers únicos, tools referenciadas
```

### 12.2 Registro de Tool

```typescript
// Em src/skills/tool_registry.ts

// Tool signature
type ToolResult =
  | { ok: true; data: unknown }
  | { ok: false; error: string };

type ToolFn = (args: Record<string, unknown>) => Promise<ToolResult>;

// Exemplo de implementação
async function minha_tool(args: Record<string, unknown>): Promise<ToolResult> {
  const param1 = args['param1'] as string;
  const param2 = args['param2'] as number;

  if (!param1) return { ok: false, error: 'param1 é obrigatório' };

  try {
    // Lógica da tool
    const result = await fazerAlgo(param1, param2);
    return { ok: true, data: result };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

// Registrar no TOOL_REGISTRY
export const TOOL_REGISTRY: Record<string, ToolFn> = {
  // ... outras tools ...
  minha_tool,
};
```

### 12.3 Criação de LangGraph Workflow

```typescript
// Em src/langgraph/meu_workflow.ts

import { MemorySaver, StateGraph, START, END } from '@langchain/langgraph';

interface MeuWorkflowState {
  input: string;
  output?: string;
  step: string;
  error?: string;
}

async function nodeA(state: MeuWorkflowState): Promise<MeuWorkflowState> {
  console.log('[MeuWorkflow] Executing nodeA');
  return { ...state, step: 'NODE_A' };
}

async function nodeB(state: MeuWorkflowState): Promise<MeuWorkflowState> {
  console.log('[MeuWorkflow] Executing nodeB');
  return { ...state, step: 'NODE_B' };
}

const checkpointer = new MemorySaver();

const workflow = new StateGraph<any>({
  channels: {
    input: { type: 'string' },
    output: { type: 'string', nullable: true },
    step: { type: 'string' },
    error: { type: 'string', nullable: true },
  },
})
  .addNode('NODE_A', nodeA)
  .addNode('NODE_B', nodeB)
  .addEdge(START, 'NODE_A')
  .addEdge('NODE_A', 'NODE_B')
  .addEdge('NODE_B', END)
  .compile({ checkpointer });

export { workflow as meuWorkflowGraph };

// Registrar em supervisor.ts
export async function invokeWorkflow(workflowName: string, ...): Promise<WorkflowResult> {
  if (workflowName === 'meu_workflow') {
    return await meuWorkflowGraph.invoke(initialState, { configurable: { thread_id } });
  }
  // ...
}
```

### 12.4 Padrões de Teste

```typescript
// Em src/__tests__/agency_router.test.ts

describe('Agency Router', () => {
  it('should route by trigger for onboarding', async () => {
    const result = await routeToSkill('novo cliente', {
      userId: 'user-123',
      chatId: 123,
      message: 'novo cliente',
    });
    expect(result).toContain('agency-onboarding');
  });

  it('should route via CEO LLM when no trigger match', async () => {
    const result = await routeToSkill('criar uma campanha de natal', {
      userId: 'user-123',
      chatId: 123,
      message: 'criar uma campanha de natal',
    });
    // Verifica que executou alguma skill
    expect(result).toMatch(/agency-/);
  });

  it('should block content with low brand score', async () => {
    // Mock brand score baixo
    const result = await executeSkill('agency-creative', 'conteúdo ruim', ctx, sessionId);
    expect(result).toContain('Brand Guardian');
  });

  it('should request human approval for low confidence', async () => {
    // Mock confidence baixa
    const result = await executeSkill('agency-onboarding', 'mensagem vaga', ctx, sessionId);
    expect(result).toContain('Confiança baixa');
  });
});

// Teste de Circuit Breaker
describe('Circuit Breaker', () => {
  it('should open after 3 failures', async () => {
    for (let i = 0; i < 3; i++) {
      recordFailure('test-skill', 'test error');
    }
    expect(isCallPermitted('test-skill')).toBe(false);
  });

  it('should recover after success in half_open', async () => {
    recordFailure('test-skill', 'test error');
    recordFailure('test-skill', 'test error');
    recordFailure('test-skill', 'test error');
    // Agora está open

    // Simular que passou o recovery timeout
    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 30001);

    expect(isCallPermitted('test-skill')).toBe(true); // half_open

    recordSuccess('test-skill');
    expect(getCircuitBreaker('test-skill').state).toBe('closed');
  });
});
```

### 12.5 Validação de Módulo (HC-33)

O sistema valida ao carregar o módulo:

```typescript
// 1. IDs de skill únicos (fail-hard)
if (seenIds.has(skill.id)) {
  throw new Error(`Duplicate skill ID: ${skill.id} — fail-hard`);
}

// 2. Triggers únicos por skill (fail-hard)
if (seenTriggers.has(lower)) {
  throw new Error(`Duplicate trigger '${lower}' in skill '${skill.id}'`);
}

// 3. Tools referenciadas existem no REGISTERED_TOOLS (warn)
if (!REGISTERED_TOOLS.has(tool)) {
  console.warn(`Skill '${skill.id}' references unknown tool: '${tool}'`);
}

// 4. Tools duplicadas dentro de uma skill (warn)
if (seenTools.has(tool)) {
  console.warn(`Skill '${skill.id}' has duplicate tool: '${tool}'`);
}
```

---

## Quick Reference

### Portas dos Serviços

| Serviço | Porta | Health Endpoint |
|---------|-------|------------------|
| Hermes Agency | 3001 | `http://localhost:3001/health` |
| LiteLLM | 4000 | `http://localhost:4000/health` |
| AI Gateway | 4002 | `http://localhost:4002/health` |
| Qdrant | 6333 | `http://localhost:6333/health` |
| Qdrant Dashboard | 6334 | `http://localhost:6334/dashboard` |
| PostgreSQL MCP | 4017 | `http://localhost:4017/health` |
| Ollama | 11434 | `http://localhost:11434/api/tags` |
| Trieve | 6435 | `http://localhost:6435/api/v1/health` |
| Redis | 6379 | `redis-cli PING` |

### Comandos Rápidos

```bash
# Verificar todos os health endpoints
for port in 3001 4000 4002 6333 4017 11434 6435; do
  echo -n "Port $port: "
  curl -sf -m 3 http://localhost:$port/health 2>/dev/null && echo "OK" || echo "FAIL"
done

# Ver todos os circuit breakers
curl -s "http://localhost:3001/health/circuit-breakers?userId=123456" | jq '.circuitBreakers'

# Restart Hermes
docker restart zappro-hermes-agency

# Ver logs de erro
docker logs --since 1h zappro-hermes-agency 2>&1 | grep -iE "error|fatal"

# Smoke test
curl -sf http://localhost:3001/health | jq .status
```

---

*Este documento deve ser atualizado sempre que houver mudanças na infraestrutura ou na arquitetura do Hermes Agency Suite.*
