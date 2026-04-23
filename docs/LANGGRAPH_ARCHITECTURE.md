# LangGraph Architecture — Hermes Agency

**Status:** Design Document
**Last Updated:** 2026-04-23
**Workflows:** WF-1 (Content Pipeline), WF-2 (Onboarding), WF-3 (Status Update), WF-4 (Social Calendar), WF-5 (Lead Qualification)

---

## Overview

The Hermes Agency uses LangGraph StateGraphs as the orchestration layer for multi-step agentic workflows. A central `supervisor.ts` acts as the single entry point, routing `invokeWorkflow` calls to the appropriate graph.

### Current State

| Workflow | File | Status |
|---|---|---|
| WF-1 Content Pipeline | `content_pipeline.ts` | **StateGraph (REAL)** |
| WF-2 Onboarding | `onboarding_flow.ts` | stub — sequential async |
| WF-3 Status Update | `status_update.ts` | stub — sequential async |
| WF-4 Social Calendar | `social_calendar.ts` | stub — sequential async |
| WF-5 Lead Qualification | `lead_qualification.ts` | stub — sequential async |

### Goal

Migrate all stub workflows to proper LangGraph StateGraphs with:
- `MemorySaver` checkpointing for durable execution
- `interruptBefore` for human-in-the-loop approval points
- Shared state schema with `clientId` and `sessionId`
- Tool calls via `TOOL_REGISTRY`
- Circuit breaker checked per tool call

---

## Shared Infrastructure

### Base State Schema

Every workflow state extends a common base:

```typescript
interface BaseState {
  clientId: string;
  sessionId: string;
  currentStep: string;
  error?: string;
}
```

### Checkpointer

All graphs use `MemorySaver` for in-memory checkpointing:

```typescript
import { MemorySaver } from '@langchain/langgraph';

const checkpointer = new MemorySaver();
```

### Tool Execution Pattern

Each node calls `TOOL_REGISTRY` tools via `executeTool()`:

```typescript
import { TOOL_REGISTRY, executeTool } from '../skills/tool_registry.js';

async function someNode(state: MyState): Promise<Partial<MyState>> {
  const result = await executeTool('some_tool', { arg1: state.value1 });
  if (!result.ok) {
    return { error: result.error, currentStep: 'ERROR' };
  }
  return { output: result.data };
}
```

### Circuit Breaker Integration

Before each tool call, check if the circuit breaker permits execution:

```typescript
import { isCallPermitted } from '../skills/circuit_breaker.js';

async function someNode(state: MyState): Promise<Partial<MyState>> {
  if (!isCallPermitted('skill_id')) {
    return { error: 'Circuit breaker open for skill_id', currentStep: 'CIRCUIT_BREAKER' };
  }
  // ... proceed with tool call
}
```

---

## WF-1: Content Pipeline

**File:** `src/langgraph/content_pipeline.ts`
**Status:** REAL StateGraph

### State Schema

```typescript
interface ContentPipelineState extends BaseState {
  brief: string;
  campaignId: string;
  creativeOutput?: string;
  videoOutput?: string;
  designOutput?: string;
  brandScore?: number;
  finalOutput?: string;
  blocked: boolean;
  blockReason?: string;
  humanApproved?: boolean;
  humanComment?: string;
}
```

### Node Definitions

| Node | Tool Called | Description |
|---|---|---|
| `CREATIVE` | `brainstorm_angles`, `generate_script` | Generate marketing script and creative angles |
| `VIDEO` | `generate_script` (supplemental) | Video processing suggestions and timestamps |
| `DESIGN` | `create_mood_board` | Visual suggestions, color palette, layout |
| `BRAND_GUARDIAN` | Internal LLM scoring | Score brand consistency 0-1 |
| `HUMAN_GATE` | `human_gate_trigger` | Interrupt for human approval |
| `SOCIAL` | `write_copy`, `generate_hashtags` | Prepare social media captions |
| `ANALYTICS` | `analyze_engagement` (mock) | Predicted metrics and KPIs |

### Edges

```
START → CREATIVE → VIDEO → DESIGN → BRAND_GUARDIAN → HUMAN_GATE → SOCIAL → ANALYTICS → END
```

### Interrupt Configuration

```typescript
compiledGraph = workflow.compile({
  checkpointer,
  interruptBefore: ['HUMAN_GATE'],
});
```

### Resume Pattern

```typescript
await compiledGraph.invoke(
  { humanApproved: true, humanComment: 'Approved' } as Partial<ContentPipelineState>,
  { configurable: { thread_id: campaignId } }
);
```

---

## WF-2: Onboarding Flow

**File:** `src/langgraph/onboarding_flow.ts`
**Status:** stub → StateGraph (planned)

### Target State Schema

```typescript
interface OnboardingState extends BaseState {
  clientName: string;
  email: string;
  telegramChatId?: number;
  profileCreated: boolean;
  qdrantInitialized: boolean;
  welcomeSent: boolean;
  milestoneCreated: boolean;
  checkinScheduled: boolean;
  onboardingComplete: boolean;
  profile?: Record<string, unknown>;
  qdrantCollectionName?: string;
  milestoneId?: string;
}
```

### Node Definitions

| Node | Tools Called | Description |
|---|---|---|
| `CREATE_PROFILE` | `qdrant_query`, internal fetch | Create client profile in Qdrant `agency_clients` |
| `INIT_QDRANT` | `rag_create_dataset` | Create client-specific Qdrant collection |
| `SEND_WELCOME` | `schedule_post` (Telegram) | Send welcome message via bot |
| `CREATE_MILESTONE` | `create_task` | Create first check-in milestone task |
| `HUMAN_REVIEW` | `human_gate_trigger` | Interrupt for human review |
| `SCHEDULE_CHECKIN` | `set_reminder` | Schedule 7-day check-in reminder |

### Edges

```
START → CREATE_PROFILE → INIT_QDRANT → SEND_WELCOME → CREATE_MILESTONE → HUMAN_REVIEW → SCHEDULE_CHECKIN → END
```

### Interrupt Configuration

```typescript
interruptBefore: ['HUMAN_REVIEW'],
```

### Edge Routing (conditional)

```typescript
// After CREATE_PROFILE, check if profile was created successfully
.addEdge('CREATE_PROFILE', (state) =>
  state.profileCreated ? 'INIT_QDRANT' : 'END'
)

// After HUMAN_REVIEW, proceed or abort
.addEdge('HUMAN_REVIEW', (state) =>
  state.humanApproved ? 'SCHEDULE_CHECKIN' : 'END'
)
```

---

## WF-3: Status Update

**File:** `src/langgraph/status_update.ts`
**Status:** stub → StateGraph (planned)

### Target State Schema

```typescript
interface StatusUpdateState extends BaseState {
  campaignIds: string[];
  metrics: Record<string, unknown>[];
  report: string;
  broadcastSent: boolean;
  chatIds: number[];
  successCount: number;
}
```

### Node Definitions

| Node | Tools Called | Description |
|---|---|---|
| `FETCH_METRICS` | `qdrant_query`, scroll | Fetch all active campaigns and their metrics |
| `GENERATE_SUMMARY` | `rag_retrieve` (context), LLM | Generate status report in Portuguese |
| `SEND_UPDATE` | `schedule_post` (Telegram broadcast) | Send report to all client Telegram chats |
| `ARCHIVE` | `update_task_status` | Archive old campaigns, mark as 'completed' |

### Edges

```
START → FETCH_METRICS → GENERATE_SUMMARY → SEND_UPDATE → ARCHIVE → END
```

### No Interrupt Points

WF-3 is fully automated (recurring Monday 9am). No human intervention required.

---

## WF-4: Social Calendar

**File:** `src/langgraph/social_calendar.ts`
**Status:** stub → StateGraph (planned)

### Target State Schema

```typescript
interface SocialCalendarState extends BaseState {
  scheduledPosts: Array<{
    platform: string;
    content: string;
    scheduledTime: string;
  }>;
  brandScore?: number;
  metricsReport?: string;
  approvedPosts: Array<{ platform: string; content: string }>;
  published: boolean;
  engagementMetrics?: Record<string, unknown>;
}
```

### Node Definitions

| Node | Tools Called | Description |
|---|---|---|
| `SCRAPE_CALENDAR` | `qdrant_query`, scroll | Fetch scheduled posts from Qdrant |
| `BRAINSTORM_CONTENT` | `brainstorm_angles`, `write_copy` | Generate new content ideas |
| `BRAND_REVIEW` | Internal LLM scoring | Score brand consistency |
| `HUMAN_APPROVAL` | `human_gate_trigger` | Interrupt for human approval |
| `SCHEDULE_POST` | `schedule_post` | Schedule approved posts |
| `PUBLISH` | Internal (stub) | Publish to social platforms |
| `ANALYZE_ENGAGEMENT` | `analyze_engagement` | Fetch and analyze engagement metrics |

### Edges

```
START → SCRAPE_CALENDAR → BRAINSTORM_CONTENT → BRAND_REVIEW → HUMAN_APPROVAL →
  [approved] → SCHEDULE_POST → PUBLISH → ANALYZE_ENGAGEMENT → END
  [rejected] → END
```

### Interrupt Configuration

```typescript
interruptBefore: ['HUMAN_APPROVAL'],
```

---

## WF-5: Lead Qualification

**File:** `src/langgraph/lead_qualification.ts`
**Status:** stub → StateGraph (planned)

### Target State Schema

```typescript
interface LeadQualificationState extends BaseState {
  prospectId: string;
  prospectMessage: string;
  score: number;
  qualified: boolean;
  route: 'hot' | 'warm' | 'cold';
  taskCreated: boolean;
  taskId?: string;
  nurtureSequenceId?: string;
  prospectProfile?: Record<string, unknown>;
}
```

### Node Definitions

| Node | Tools Called | Description |
|---|---|---|
| `COLLECT_INFO` | `rag_retrieve` (context) | Enrich prospect info from RAG |
| `SCORE_LEAD` | Internal LLM scoring | Score 0-1 based on budget, timeline, fit |
| `ROUTE` | Internal routing | Route to hot/warm/cold based on score |
| `CREATE_TASK` | `create_task` | Create appropriate task in Qdrant |
| `AGENCY_CREATIVE` (hot) | `assign_to_agent` | Assign to agency-creative skill |
| `NURTURE` (warm) | `rag_create_dataset` | Add to nurture sequence dataset |
| `AWAIT_INFO` (cold) | `set_reminder` | Set reminder to follow up |

### Routing Logic

```
Score >= 0.8 → 'hot' → agency-creative immediately
Score >= 0.4 → 'warm' → nurture sequence
Score < 0.4 → 'cold' → await more info
```

### Edges

```
START → COLLECT_INFO → SCORE_LEAD → ROUTE →
  [hot] → CREATE_TASK → AGENCY_CREATIVE → END
  [warm] → CREATE_TASK → NURTURE → END
  [cold] → AWAIT_INFO → END
```

### Conditional Edge Pattern

```typescript
.addEdge('ROUTE', (state) => {
  if (state.score >= 0.8) return 'CREATE_TASK_HOT';
  if (state.score >= 0.4) return 'CREATE_TASK_WARM';
  return 'AWAIT_INFO';
})
```

---

## Implementation Roadmap

### Phase 1: Foundation (WF-2 Onboarding)

**Why first:** Onboarding is the entry point for new clients. Converting it to StateGraph first establishes the pattern for other workflows.

1. Define `OnboardingState` interface
2. Convert `executeOnboardingFlow()` to `StateGraph`
3. Add `interruptBefore: ['HUMAN_REVIEW']`
4. Wire tool calls to `TOOL_REGISTRY`
5. Add circuit breaker checks
6. Test interrupt/resume flow

### Phase 2: Automated Flows (WF-3, WF-4)

**Why second:** These have clearer sequential flows with one interrupt point each.

**WF-3 Status Update:**
1. Define `StatusUpdateState` interface
2. Convert to StateGraph (no interrupts)
3. Add broadcast tool integration

**WF-4 Social Calendar:**
1. Define `SocialCalendarState` interface
2. Convert to StateGraph
3. Add `interruptBefore: ['HUMAN_APPROVAL']`
4. Add engagement analytics

### Phase 3: Routing Flow (WF-5)

**Why last:** Lead qualification has conditional branching that requires careful edge routing.

1. Define `LeadQualificationState` interface
2. Convert to StateGraph with conditional edges
3. Implement hot/warm/cold routing
4. Add task creation for each route

### Phase 4: Cross-Cutting Concerns

1. Add shared `BaseState` type to all workflows
2. Implement thread_id persistence across restarts
3. Add monitoring/metrics per workflow
4. Document error handling patterns

---

## Error Handling Pattern

Each node should handle errors gracefully:

```typescript
async function myNode(state: MyState): Promise<Partial<MyState>> {
  try {
    const result = await executeTool('some_tool', { args: state.input });
    if (!result.ok) {
      return { error: result.error, currentStep: 'ERROR' };
    }
    return { output: result.data, currentStep: 'MY_NODE' };
  } catch (err) {
    console.error('[MyWorkflow] myNode failed:', err);
    return {
      error: err instanceof Error ? err.message : String(err),
      currentStep: 'ERROR',
    };
  }
}
```

### Error Edges

```typescript
.addEdge('MY_NODE', (state) =>
  state.error ? 'ERROR_HANDLER' : 'NEXT_NODE'
)
```

---

## Supervisor Integration

The `supervisor.ts` remains the single entry point:

```typescript
const WORKFLOW_REGISTRY = {
  content_pipeline: async (input, threadId) => {
    return await executeContentPipeline(input, threadId);
  },
  onboarding: async (input) => {
    const [clientName, email, telegramChatId] = input.split('|');
    return await executeOnboardingGraph({ clientName, email, telegramChatId });
  },
  // ... other workflows
};
```

---

## Metrics & Observability

Each workflow should emit structured logs:

```typescript
console.log(JSON.stringify({
  event: 'workflow_node_complete',
  workflow: 'onboarding',
  node: 'CREATE_PROFILE',
  clientId: state.clientId,
  duration_ms: Date.now() - startTime,
}));
```

---

## Testing Strategy

1. **Unit tests:** Test each node function in isolation with mocked `TOOL_REGISTRY`
2. **Integration tests:** Test full graph execution with `MemorySaver`
3. **Interrupt tests:** Test resume flow after `interrupt()` is triggered
4. **Error tests:** Verify graceful error handling and edge routing to ERROR_HANDLER

---

## File Structure

```
src/langgraph/
├── index.ts                    # Re-exports all graphs
├── supervisor.ts               # Workflow router (entry point)
├── content_pipeline.ts         # WF-1: StateGraph (REAL)
├── onboarding_flow.ts          # WF-2: StateGraph (planned)
├── status_update.ts            # WF-3: StateGraph (planned)
├── social_calendar.ts          # WF-4: StateGraph (planned)
└── lead_qualification.ts       # WF-5: StateGraph (planned)
```
