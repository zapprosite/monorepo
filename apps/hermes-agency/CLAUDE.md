# hermes-agency — Hermes Marketing Agency Suite

**Type:** TypeScript/Node.js + Fastify
**Purpose:** Multi-agent marketing platform with CEO_REFRIMIX_bot as the supervisor leader
**Runtime:** Node.js 20+ | **Storage:** Qdrant (vector DB) + Redis + PostgreSQL + Mem0

---

## CEO_REFRIMIX_bot — Supervisor Leader

The `CEO_REFRIMIX_bot` is the **central supervisor** that coordinates all specialized agents. Think of it as the CEO of REFRIMIX — a design and marketing company that delegates tasks, executes tools, and returns structured results to users.

### CEO Mindset

When you interact with CEO_REFRIMIX_bot, think of it as consulting the CEO of REFRIMIX:
- Strategic delegation to specialized agents
- Brand consistency oversight via Brand Guardian
- Campaign orchestration end-to-end
- Quality gates before any output reaches the client

### How the CEO Routes Requests

```
User Input (Telegram)
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│  bot.ts (Telegram polling)                                  │
│  → Parses message, extracts text/attachments                │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│  agency_router.ts (CEO Routing Layer)                       │
│  1. Trigger Match (O(1)): getSkillByTrigger(input)           │
│     - Direct mapping: trigger keywords → skill ID           │
│  2. LLM Routing: askCeoToRoute()                           │
│     - If no trigger matched, ask MiniMax which skill       │
│       is appropriate for the request                        │
│  3. Returns: { skillId, confidence, reasoning }            │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│  TOOL_REGISTRY (Execution Layer)                           │
│  → Executes each tool in the skill via executeTool()       │
│  → Circuit breaker check per tool                          │
│  → Returns structured results                              │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│  Response Formatting                                        │
│  → CEO compiles tool results into coherent response         │
│  → Brand Guardian gate if content output                    │
│  → Human gate pause if required                             │
└─────────────────────────────────────────────────────────────┘
```

### Full Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                         TELEGRAM                                 │
│                     @REFRIMIX_Bot                                │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│  bot.ts                                                         │
│  • Polling updates via node-telegram-bot-api                    │
│  • Rate limiting (sliding window)                               │
│  • Distributed lock via Redis SETNX                             │
│  • File validation (MIME magic bytes)                           │
│  • Routes to agency_router                                      │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│  agency_router.ts (CEO_REFRIMIX_bot)                            │
│  • getSkillByTrigger() — O(1) trigger map lookup               │
│  • askCeoToRoute() — MiniMax LLM for ambiguous inputs           │
│  • executeSkill() — runs skill tools sequentially               │
│  • human_gate_trigger() — pauses for approval                  │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│  TOOL_REGISTRY                                                  │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐            │
│  │  rag_* tools │ │ qdrant_*     │ │ langgraph_*  │            │
│  │  (Trieve)    │ │ tools        │ │ tools        │            │
│  └──────────────┘ └──────────────┘ └──────────────┘            │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐            │
│  │  human_gate  │ │ skill_route  │ │ brand_*      │            │
│  │  _trigger    │ │              │ │ tools        │            │
│  └──────────────┘ └──────────────┘ └──────────────┘            │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐            │
│  │  *           │ │ *            │ │ *            │            │
│  │  (skill-     │ │ (skill-      │ │ (skill-      │            │
│  │   specific)  │ │  specific)   │ │  specific)   │            │
│  └──────────────┘ └──────────────┘ └──────────────┘            │
└──────────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│  RAG Stack       │ │  LangGraph       │ │  Qdrant          │
│  Trieve          │ │  Workflows       │ │  Collections     │
│  Qdrant          │ │                  │ │                  │
│  Ollama          │ │                  │ │                  │
│  (nomic-embed)   │ │                  │ │                  │
│  Mem0            │ │                  │ │                  │
└──────────────────┘ └──────────────────┘ └──────────────────┘
          │                   │                   │
          └───────────────────┼───────────────────┘
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│  Mem0 Memory Layer (Session/Long-term Memory)                   │
│  • Per-user session memory                                      │
│  • Per-campaign context                                        │
│  • Brand guidelines memory                                      │
└──────────────────────────────────────────────────────────────────┘
```

---

## All 13 Skills with Tools

| ID | Name | Triggers | Tools |
|----|------|----------|-------|
| `agency-ceo` | CEO MIX | `/start`, `/agency`, `/ceo`, `brief`, `campaign` | langgraph_execute, skill_route, human_gate_trigger, qdrant_query, rag_retrieve |
| `agency-onboarding` | ONBOARDING | `novo cliente`, `onboarding`, `bem-vindo` | create_client_profile, init_qdrant_collection, send_welcome_sequence, create_first_milestone, rag_create_dataset |
| `agency-video-editor` | VIDEO EDITOR | `vídeo`, `video`, `youtube`, `transcrever` | transcribe_video, extract_key_moments, generate_caption, upload_to_r2, qdrant_store |
| `agency-organizer` | ORGANIZADOR | `tarefa`, `task`, `organizar`, `lembrete` | create_task, update_task_status, assign_to_agent, set_reminder, list_tasks, get_task_details |
| `agency-creative` | CREATIVE | `criar`, `script`, `copy`, `ideia` | generate_script, brainstorm_angles, write_copy, create_mood_board, qdrant_retrieve, rag_retrieve |
| `agency-design` | DESIGN | `design`, `imagem`, `visual`, `cores` | generate_image_prompt, create_brand_kit, suggest_colors, mockup_layout, check_brand_consistency |
| `agency-social` | SOCIAL MEDIA | `postar`, `social`, `hashtag`, `publicar` | schedule_post, generate_hashtags, cross_post, analyze_engagement, post_to_social, qdrant_store |
| `agency-pm` | PROJECT MANAGER | `milestone`, `status`, `entrega`, `projeto` | create_milestone, check_deliverables, send_status_update, escalate_if_needed, get_campaign_status, list_milestones |
| `agency-analytics` | ANALYTICS | `métricas`, `analytics`, `relatório`, `dashboard` | fetch_metrics, generate_report, compare_campaigns, alert_anomaly, qdrant_aggregate, rag_retrieve |
| `agency-brand-guardian` | BRAND GUARDIAN | `brand`, `marca`, `consistência` | check_brand_consistency, scan_for_violations, approve_content, flag_for_review, score_content |
| `agency-client-success` | CLIENT SUCCESS | `nps`, `feedback`, `cliente`, `sucesso` | send_nps_survey, collect_feedback, schedule_call, renew_subscription, update_health_score, qdrant_query |
| `rag-instance-organizer` | INSTANCE ORGANIZER | `organizar instância`, `rag`, `knowledge base`, `indexar docs` | rag_retrieve, rag_search, rag_create_dataset, rag_list_datasets, qdrant_query, mem0_write, mem0_read |
| `agency-mem0-manager` | MEMORY MANAGER | `memória`, `memory`, `lembrar`, `esquecer` | mem0_write, mem0_read, mem0_search, mem0_delete, mem0_get_user_memory |

---

## RAG Stack: Trieve + Qdrant + Ollama + Mem0

### Complete RAG Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│                         RAG Request                             │
│                    rag_retrieve(query, topK)                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Trieve (:6435) — Primary RAG Interface                         │
│  • Hybrid search (semantic + keyword)                          │
│  • Dataset management by app/lead                             │
│  • Re-ranking with nomic-embed-text                           │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────┐
│  Qdrant (:6333)         │     │  Ollama (:11434)       │
│  • agency_* collections│     │  • nomic-embed-text    │
│  • Vector storage       │     │  • Local embeddings    │
│  • Fast ANN search      │     │  • No API costs        │
└─────────────────────────┘     └─────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Mem0 (:5000) — Memory Layer                                   │
│  • User session memory                                         │
│  • Long-term fact storage                                      │
│  • Preference learning                                         │
│  • Context injection for LLM calls                             │
└─────────────────────────────────────────────────────────────────┘
```

### Dataset Naming Convention (Trieve)

```
{app}[-{lead}]-knowledge|memory|context

Examples:
  hermes-knowledge           → app=hermes, general knowledge
  painel-lead-alfa-knowledge → app=painel, lead=alfa
  hvacr-lead-xyz-memory     → app=hvacr, lead=xyz, working memory
  refrimix-campaigns-context → app=refrimix, campaign context
```

### Pre-configured Datasets

| Dataset | App | Description |
|---------|-----|-------------|
| `hermes-knowledge` | hermes | Skills, prompts, TREE.md |
| `hermes-memory` | hermes | Session working memory |
| `monorepo-docs` | monorepo | SPECs, AGENTS.md |
| `hvacr-knowledge` | hvacr | HVAC-R swarm docs |
| `refrimix-brand` | refrimix | Brand guidelines, style guide |
| `governance` | ops | PORTS.md, SUBDOMAINS.md, NETWORK_MAP.md |
| `pgadmin` | pgadmin | PostgreSQL schemas, queries |
| `qdrant` | qdrant | Qdrant collections, indexing |

### How to Use RAG

```typescript
// 1. Create dataset for app/lead
rag_create_dataset({ app: 'refrimix', lead: 'summer2024', description: 'Summer campaign docs' })

// 2. Index documents (batched, 120 per call)
indexDocument({ datasetId: '...', documents: [...], batchSize: 120 })

// 3. Retrieve relevant chunks
rag_retrieve({ query: 'brand colors Pantone', topK: 5 })

// 4. Hybrid search
rag_search({ datasetId: 'refrimix-brand', query: 'logo usage guidelines', limit: 10 })
```

---

## Mem0 Memory Layer

### How Mem0 Works

Mem0 provides a persistent memory layer that stores facts, preferences, and context across sessions.

```
┌─────────────────────────────────────────────────────────────────┐
│                        Mem0 Architecture                        │
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐        │
│  │ User Memory │    │ Session     │    │ Agent       │        │
│  │ (long-term)│    │ Memory      │    │ Memory      │        │
│  └─────────────┘    └─────────────┘    └─────────────┘        │
│         │                 │                  │                │
│         └─────────────────┼──────────────────┘                │
│                           ▼                                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                  Mem0 API (:5000)                       │   │
│  │  • add() — store memories                              │   │
│  │  • search() — retrieve relevant memories               │   │
│  │  • get() — fetch all memories for user/entity          │   │
│  │  • delete() — remove specific memories                 │   │
│  └─────────────────────────────────────────────────────────┘   │
│                           │                                    │
│                           ▼                                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Ollama (nomic-embed-text)                   │   │
│  │              Embedding generation                        │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### How to Read Memory

```typescript
// Read all memories for a user
mem0_read({ user_id: 'refrimix-client-123' })

// Search memories by query
mem0_search({ query: 'brand preferences', user_id: 'refrimix-client-123', limit: 5 })

// Get specific memory type
mem0_get_user_memory({ user_id: 'refrimix-client-123', memory_type: 'preferences' })
```

### How to Write Memory

```typescript
// Write a fact
mem0_write({
  user_id: 'refrimix-client-123',
  content: 'Cliente prefere campanhas com tons vibrantes e chamadas para ação diretas',
  memory_type: 'preference'
})

// Write context from campaign
mem0_write({
  user_id: 'refrimix-client-123',
  content: 'Campanha summer2024 foca em sustentabilidade e economia de energia',
  memory_type: 'campaign_context'
})

// Write brand fact
mem0_write({
  entity_id: 'refrimix',
  content: 'REFRIMIX brand colors: #FF6B35 (orange), #1A1A2E (navy), #FFFFFF (white)',
  memory_type: 'brand_guideline'
})
```

### Memory Types

| Type | Description | Example |
|------|-------------|---------|
| `preference` | User likes/dislikes | "Prefers short subject lines" |
| `campaign_context` | Active campaign details | "Summer 2024 focuses on eco-friendly" |
| `brand_guideline` | Brand rules | "Primary color is Pantone 1505" |
| `interaction_history` | Past interactions | "Asked about logo usage last week" |
| `feedback` | Client feedback | "Loved the last email sequence" |

---

## PostgreSQL MCP — Schema by App/Lead

### MCP Server Location

```
/srv/monorepo/apps/hermes-agency/mcps/mcp-postgres/
├── server.py              # Python MCP implementation
├── package.json
└── README.md
```

### Schema Naming Convention

```
{app}[_{lead}]

Examples:
  hermes              → general Hermes data
  hermes_will         → user-specific (lead=will)
  painel_alfa         → app=painel, lead=alfa specific
  refrimix            → REFRIMIX brand/campaign data
  refrimix_summer2024 → REFRIMIX summer campaign
```

### PostgreSQL Tools (via MCP)

| Tool | Description |
|------|-------------|
| `create_schema` | Create schema `{app}[_{lead}]` |
| `drop_schema` | Drop schema CASCADE |
| `list_schemas` | List schemas (optional filter by app) |
| `create_table` | Create table with typed columns |
| `drop_table` | Drop table |
| `list_tables` | List tables with row counts and sizes |
| `describe_table` | Column metadata (name, type, nullable, pk) |
| `query` | SELECT (limit 100 rows) |
| `write` | INSERT/UPDATE/DELETE |
| `create_index` | CREATE INDEX |

### Connection Details

```bash
# Via pgAdmin (browser)
https://pgadmin.zappro.site:4050

# Via MCP CLI
MCP_POSTGRES_HOST=localhost MCP_POSTGRES_PORT=5432 python3 server.py

# Environment variables
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=hermes
POSTGRES_PASSWORD=<from vault>
POSTGRES_DATABASE=hermes_agency
```

### Schema by App/Lead

| App | Lead | Schema | Purpose |
|-----|------|--------|---------|
| hermes | will | hermes_will | Working memory, sessions |
| refrimix | — | refrimix | Brand guidelines, campaigns |
| refrimix | summer2024 | refrimix_summer2024 | Summer campaign data |
| painel | alfa | painel_alfa | Panel client specific |
| hvacr | xyz | hvacr_xyz | HVAC-R documentation |

### Example: Create Schema for New Campaign

```typescript
// Via CEO skill_route to agency-onboarding
human_gate_trigger({
  message: "Criar schema para nova campanha?",
  buttons: ["Sim, criar", "Cancelar"]
})

// If approved:
// 1. create_schema({ name: 'refrimix_summer2024' })
// 2. create_table({
//      schema: 'refrimix_summer2024',
//      table: 'campaign_metrics',
//      columns: { date: 'date', impressions: 'integer', clicks: 'integer' }
//    })
// 3. create_index({ schema: 'refrimix_summer2024', table: 'campaign_metrics', column: 'date' })
```

---

## LangGraph Workflows

### Available Workflows

| File | Description | Use Case |
|------|-------------|----------|
| `content_pipeline.ts` | Full content creation with Brand Guardian | Create campaign content |
| `onboarding_flow.ts` | Client onboarding sequence | New client welcome |
| `lead_qualification.ts` | Lead scoring and routing | Qualify incoming leads |
| `social_calendar.ts` | Social media scheduling | Plan social posts |
| `status_update.ts` | Status reporting | Client updates |

### Content Pipeline (StateGraph)

```typescript
// nodes: [HUMAN_GATE, brand_guardian, quality_check, publish, archive]
// checkpointer: MemorySaver
// interruptBefore: [HUMAN_GATE]

langgraph_execute({
  workflow: 'content_pipeline',
  input: {
    campaign_id: 'summer2024',
    content_type: 'instagram_post',
    brief: 'Destaque a economia de energia dos nossos refrigeradores'
  }
})
```

### How to Invoke LangGraph Workflows

```typescript
// Via CEO tool
langgraph_execute({
  workflow: 'content_pipeline',
  input: userMessage  // The campaign brief
})

// Via specific skill
skill_route({
  target_skill: 'agency-pm',
  input: { workflow: 'status_update', campaign_id: 'summer2024' }
})
```

### State Graph Flow

```
                    ┌─────────────┐
                    │   START     │
                    └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │ HUMAN_GATE  │ ←── Interrupt for approval
                    └─────────────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
              ▼            ▼            ▼
       ┌──────────┐ ┌──────────────┐ ┌──────────┐
       │  BRAND   │ │   QUALITY    │ │  ERROR   │
       │ GUARDIAN │ │    CHECK     │ │  HANDLER │
       └──────────┘ └──────────────┘ └──────────┘
              │            │            │
              └────────────┼────────────┘
                           ▼
                    ┌─────────────┐
                    │   PUBLISH   │
                    └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │   ARCHIVE   │
                    └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │    END      │
                    └─────────────┘
```

---

## Brand Guardian Gate

Brand Guardian is a mandatory quality gate that checks all content before publishing.

### Confidence Thresholds

| Output Type | Minimum Confidence | Action if Below |
|-------------|-------------------|-----------------|
| Copy/Text | 0.75 | Flag for human review |
| Images | 0.70 | Require human approval |
| Video | 0.80 | Block auto-publish |
| Brand Colors | 0.90 | Hard block |
| Logo Usage | 0.85 | Hard block |

### Brand Guardian Checks

```typescript
// Check content consistency
check_brand_consistency({
  content: 'Desfrute do verão com economia!',
  brand_id: 'refrimix'
})

// Scan for violations
scan_for_violations({
  content: 'http://competitor.com/promo',
  scan_types: ['competitor_links', 'forbidden_words', 'color_mismatch']
})

// Score content (0-1)
score_content({
  content: imagePrompt,
  brand_id: 'refrimix',
  content_type: 'instagram_post'
})
```

### Gate Behavior

```
Content Creation
      │
      ▼
┌─────────────────┐
│ Brand Guardian  │ ──► Confidence ≥ threshold ──► PUBLISH
│     CHECK       │
└─────────────────┘
      │
      │ Confidence < threshold
      ▼
┌─────────────────┐
│  Flag for       │
│  Human Review   │
└─────────────────┘
      │
      ▼
┌─────────────────┐
│  human_gate     │
│  _trigger       │
└─────────────────┘
```

---

## Circuit Breakers

Each skill/tool has an independent circuit breaker that opens after consecutive failures.

### Configuration

```typescript
{
  failureThreshold: 3,    // Failures before opening
  resetTimeout: 30000,    // ms before half-open
  monitoringPeriod: 60000  // Window for failure count
}
```

### Behavior

| State | Behavior |
|-------|----------|
| CLOSED | Normal operation, requests pass through |
| OPEN | Reject all requests for 30s, return error |
| HALF_OPEN | Allow test request, if success → CLOSE |

### How to Monitor

```typescript
// View all circuit breaker states
getAllCircuitBreakers()

// Response:
{
  'agency-creative': { state: 'CLOSED', failures: 0 },
  'agency-social': { state: 'OPEN', failures: 3, resetAt: '2024-01-15T10:30:00Z' },
  'rag_retrieve': { state: 'CLOSED', failures: 0 }
}

// Manual reset
TOOL_REGISTRY['resetCircuitBreaker']({ skillId: 'agency-social' })
```

### Which Tools Have Circuit Breakers

All tools in TOOL_REGISTRY have per-tool circuit breakers:
- `rag_*` tools (Trieve)
- `qdrant_*` tools
- `langgraph_*` tools
- `mem0_*` tools
- `human_gate_trigger`

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `HERMES_AGENCY_BOT_TOKEN` | Yes | — | Telegram bot token |
| `HERMES_AGENCY_PORT` | No | 3001 | Health endpoint port |
| `HERMES_ADMIN_USER_IDS` | Yes | — | Admin Telegram IDs (CSV) |
| `HERMES_GATEWAY_URL` | No | localhost:8642 | Hermes Gateway URL |
| `AI_GATEWAY_FACADE_KEY` | Yes | — | AI Gateway auth key |
| `QDRANT_URL` | No | localhost:6333 | Qdrant vector DB |
| `QDRANT_API_KEY` | Yes | — | Qdrant API key |
| `OLLAMA_URL` | No | localhost:11434 | Ollama LLM endpoint |
| `TRIEVE_URL` | No | localhost:6435 | Trieve RAG API |
| `TRIEVE_API_KEY` | Yes | — | Trieve API key |
| `TRIEVE_DEFAULT_DATASET_ID` | No | — | Default dataset for rag_retrieve |
| `MEM0_URL` | No | localhost:5000 | Mem0 API endpoint |
| `MEM0_API_KEY` | No | — | Mem0 API key |
| `REDIS_URL` | No | localhost:6379 | Redis for locks/rate limiting |
| `POSTGRES_HOST` | No | localhost | PostgreSQL host |
| `POSTGRES_PORT` | No | 5432 | PostgreSQL port |
| `POSTGRES_USER` | Yes | — | PostgreSQL user |
| `POSTGRES_PASSWORD` | Yes | — | PostgreSQL password |
| `POSTGRES_DATABASE` | No | hermes_agency | PostgreSQL database |

---

## Usage Examples

### How to Ask CEO for a Campaign

```
User: "Quero uma campanha para o verão focado em economia de energia"

CEO Routing:
1. Trigger match: "campanha" → agency-ceo
2. CEO executes:
   - langgraph_execute({ workflow: 'content_pipeline', input: brief })
   - skill_route to agency-creative for copy
   - skill_route to agency-design for visuals
   - brand_guardian check on all outputs

Response:
✅ **CEO_REFRIMIX_bot** orchestrou campanha completa

📋 **Campaign:** Summer Energy Savings
🎯 **Brief:** Economia de energia em refrigeradores
🔧 **Skills executadas:**
   - agency-creative: scripts + copy
   - agency-design: image prompts
   - agency-brand-guardian: approved ✓

📊 **Deliverables:**
   - Instagram post: 3 variants
   - Story: 1 template
   - Copy: headline + body + CTA
```

### How to Use RAG

```typescript
// 1. Create dataset for new campaign
rag_create_dataset({
  app: 'refrimix',
  lead: 'summer2024',
  description: 'Summer 2024 energy savings campaign'
})
// Returns: { id: 'ds_xxx', name: 'refrimix-summer2024-knowledge' }

// 2. Index documents (e.g., brand guide, product specs)
rag_search({
  datasetId: 'ds_xxx',
  query: 'brand colors pantone',
  limit: 5
})
// Returns: relevant chunks with scores

// 3. Use in creative generation
rag_retrieve({
  query: 'refrigerador economia energia',
  topK: 3
})
```

### How to Create PostgreSQL Schema

```typescript
// Via human gate approval first
human_gate_trigger({
  message: "Criar schema refrimix_summer2024?",
  buttons: ["Sim", "Cancelar"]
})

// On approval:
// 1. Create schema
create_schema({ name: 'refrimix_summer2024' })

// 2. Create tables
create_table({
  schema: 'refrimix_summer2024',
  table: 'posts',
  columns: {
    id: 'serial PRIMARY KEY',
    platform: 'varchar(50)',
    content: 'text',
    scheduled_at: 'timestamp',
    status: 'varchar(20)'
  }
})

// 3. Create indexes
create_index({
  schema: 'refrimix_summer2024',
  table: 'posts',
  column: 'scheduled_at',
  name: 'idx_posts_scheduled'
})

// 4. List tables to verify
list_tables({ schema: 'refrimix_summer2024' })
```

### How to Use Mem0

```typescript
// Store user preference
mem0_write({
  user_id: 'client-refrimix',
  content: 'Prefere imagens com pessoas reais, não stock photos',
  memory_type: 'preference'
})

// Retrieve when generating content
mem0_search({
  query: 'preferencias de imagens',
  user_id: 'client-refrimix',
  limit: 5
})
// → 'Prefere imagens com pessoas reais, não stock photos'

// Use in creative generation
// agency-creative receives context: "User prefers real people in images"
```

### How to Query Qdrant Directly

```typescript
// Store client profile
qdrant_upsert({
  collection: 'agency_clients',
  payload: {
    client_id: 'refrimix',
    brand_colors: ['#FF6B35', '#1A1A2E'],
    campaign_count: 12,
    last_campaign: 'spring2024'
  }
})

// Search similar campaigns
qdrant_query({
  collection: 'agency_campaigns',
  query: 'energy savings summer',
  limit: 5,
  filter: { must: [{ key: 'client', match: { value: 'refrimix' } }] }
})
```

---

## Qdrant Collections

### Agency Suite Collections

```
agency_clients          → Client profiles, brand guidelines
agency_campaigns        → All marketing campaigns
agency_conversations    → Conversation history per client
agency_assets           → Creative assets metadata
agency_brand_guides     → Brand guidelines per client
agency_tasks            → Tasks and deliverables
agency_video_metadata   → Video transcriptions and metadata
agency_knowledge       → Agency knowledge base
agency_working_memory   → Per-session agent memory
```

### Qdrant vs Trieve

| Aspect | Qdrant | Trieve |
|--------|--------|--------|
| Purpose | agency_* collections | RAG datasets |
| Access | Via qdrant/client.ts | Via Trieve API (:6435) |
| Collections | Pre-configured | Dynamic per app/lead |
| Use case | Structured data, profiles | Unstructured doc search |

---

## Memory Architecture (5-Layer)

The homelab uses a **5-layer memory architecture** for comprehensive AI context management:

```
┌────────────────────────────────────────────────────────────────────┐
│ Layer 1: Session Memory (Mem0)        │ TTL: 7-90 days           │
│ agency_working_memory via Qdrant       │ Ollama embeddings        │
├────────────────────────────────────────────────────────────────────┤
│ Layer 2: Long-Term Memory (Mem0)      │ Persistent               │
│ agency_clients, agency_campaigns, etc.│ Semantic indexing        │
├────────────────────────────────────────────────────────────────────┤
│ Layer 3: Knowledge Base (Trieve)      │ RAG, hybrid search       │
│ {app}[-{lead}]-knowledge|memory       │ Chunked docs            │
├────────────────────────────────────────────────────────────────────┤
│ Layer 4: Structured Memory (Postgres)  │ Relational consistency  │
│ {app}[_{lead}] schemas                │ clients, campaigns       │
├────────────────────────────────────────────────────────────────────┤
│ Layer 5: Cache Layer (Redis)           │ Rate limits, locks      │
│ ratelimit:, lock:, session:            │ Fast access             │
└────────────────────────────────────────────────────────────────────┘
```

### Memory Files

```
src/mem0/
├── client.ts       # Session memory with TTL support
├── longterm.ts     # Long-term memory managers
├── embeddings.ts   # Ollama nomic-embed-text integration
└── index.ts       # All exports
```

### Session Memory (TTL-Based)

```typescript
import { mem0Store, mem0GetRecent, mem0Search, mem0CleanupExpired } from './mem0';

const { sessionId, userId } = ctx;

// Store with importance-based TTL
await mem0Store({
  sessionId,
  userId,
  role: 'user',
  content: 'Cliente prefere campanhas vibrantes',
  importance: 'important'  // 30 days TTL
});

// Retrieve recent context
const recent = await mem0GetRecent(sessionId, 10);

// Search session memory
const results = await mem0Search('preferencias visuais', sessionId, { limit: 5 });

// Cleanup expired (call daily via cron)
await mem0CleanupExpired();
```

### Long-Term Memory (Per-Collection)

```typescript
import {
  storeClientPreference,
  storeBrandGuideline,
  storeCampaignContext,
  getClientMemory,
  searchAllAgencyMemory,
  formatLongTermContext
} from './mem0/longterm';

// Store client preference
await storeClientPreference('refrimix', 'Prefere CTAs diretos');

// Store brand guideline
await storeBrandGuideline('refrimix', 'Cores: #FF6B35 (orange), #1A1A2E (navy)');

// Get all memories for a client
const clientMem = await getClientMemory('refrimix');
// { preferences: [...], brandGuidelines: [...], interactions: [...] }

// Search across all agency collections
const allResults = await searchAllAgencyMemory('brand colors pantone', { limit: 5 });

// Format for prompt injection
const context = formatLongTermContext(clientMem.preferences);
```

### TTL by Importance

| Importance | TTL | Use Case |
|------------|-----|----------|
| `normal` | 7 days | Regular conversation |
| `important` | 30 days | Key decisions, preferences |
| `critical` | 90 days | Brand guidelines, briefs |

### Memory Flow in Request

```
Request → mem0GetRecent(sessionId) → Inject [session memory]
       → searchAllAgencyMemory()   → Inject [client/campaign context]
       → rag_search()              → Inject [RAG docs]
       → pg_query()                → Inject [structured data]
       → LLM Inference             → Response
       → mem0Store(response)       → Persist to session memory
```

### Redis Cache Keys

```typescript
// Rate limiting
`ratelimit:${userId}`           // Sliding window

// Distributed locks
`lock:${resource}`              // 30s TTL

// Session cache
`session:${sessionId}`          // 1h TTL

// Brand guidelines cache
`brand:${brandId}`              // 24h TTL
```

---

## Anti-Hardcoded Pattern

```typescript
// ✅ CORRETO — all configs via process.env
const QDRANT_URL = process.env['QDRANT_URL'] ?? 'http://localhost:6333';
const API_KEY = process.env['TRIEVE_API_KEY'] ?? '';

// ❌ ERRADO — hardcoded values
const API_KEY = 'secret123';
const QDRANT_URL = 'http://prod.qdrant.com:6333';
```

---

## File Structure

```
apps/hermes-agency/
├── src/
│   ├── index.ts                    # Entry point + health server
│   ├── telegram/
│   │   ├── bot.ts                 # Telegram polling (CEO entry)
│   │   ├── distributed_lock.ts    # Redis SETNX locks
│   │   ├── rate_limiter.ts        # Sliding window rate limiter
│   │   └── file_validator.ts     # MIME magic bytes + size
│   ├── router/
│   │   └── agency_router.ts      # CEO routing logic
│   ├── skills/
│   │   ├── index.ts               # Skill registry (13 skills)
│   │   ├── tool_registry.ts       # Tool implementations
│   │   ├── rag-instance-organizer.ts  # RAG tools + configs
│   │   ├── mem0-manager.ts        # Mem0 memory tools
│   │   └── circuit_breaker.ts    # Per-skill circuit breaker
│   ├── litellm/
│   │   └── router.ts              # MiniMax LLM calls
│   ├── qdrant/
│   │   └── client.ts              # Qdrant client
│   └── langgraph/
│       ├── content_pipeline.ts    # Content workflow (StateGraph)
│       ├── onboarding_flow.ts     # Client onboarding
│       ├── lead_qualification.ts  # Lead scoring
│       ├── social_calendar.ts     # Social scheduling
│       └── status_update.ts       # Status reporting
├── mcps/
│   └── mcp-postgres/              # PostgreSQL MCP server
│       ├── server.py             # Python MCP implementation
│       └── package.json
└── package.json
```

---

## Test Commands

```bash
# Run tests
pnpm --filter hermes-agency test

# Type check
pnpm --filter hermes-agency check-types

# Build
pnpm --filter hermes-agency build
```

---

## SPEC References

- SPEC-058: Hermes Agency Suite (initial)
- SPEC-059: Datacenter Hardening (Redis locks, rate limits, file validation)
- SPEC-068: LangGraph Circuit Breaker
- SPEC-092: Trieve RAG Integration
- SPEC-074: Hermes Second Brain + Mem0
