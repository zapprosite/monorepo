// Anti-hardcoded: all config via process.env
// LangGraph Status Update Workflow (WF-3) — Recurring Monday 9am
// Migrated from sequential async to real StateGraph with interrupt()
/* eslint-disable no-console */

import { MemorySaver, StateGraph, START, END, interrupt, Command } from '@langchain/langgraph';
import { llmComplete } from '../litellm/router.js';
import { COLLECTIONS } from '../qdrant/client.js';
import { bot } from '../telegram/bot.js';
import { fetchClient } from '../utils/fetch-client.js';

const QDRANT_URL = process.env['QDRANT_URL'] ?? 'http://localhost:6333';

// Checkpointer for durable execution with persistence
const checkpointer = new MemorySaver();

// State type for status update workflow
interface StatusUpdateState {
  campaignIds: string[];
  report: string;
  broadcastSent: boolean;
  humanApproved?: boolean;
  humanComment?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Node functions
// ---------------------------------------------------------------------------

async function fetchCampaignsNode(_state: StatusUpdateState): Promise<Partial<StatusUpdateState>> {
  console.log(`[StatusUpdate] Executing FETCH_CAMPAIGNS node`);
  try {
    const campaignIds = await fetchActiveCampaigns();
    console.log(`[StatusUpdate] Found ${campaignIds.length} active campaigns`);
    return { campaignIds };
  } catch (err) {
    console.error('[StatusUpdate] fetchCampaignsNode failed:', err);
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

async function generateReportNode(state: StatusUpdateState): Promise<Partial<StatusUpdateState>> {
  console.log(`[StatusUpdate] Executing GENERATE_REPORT node`);
  try {
    const metrics = await fetchAllMetrics(state.campaignIds);
    const report = await generateStatusReport(metrics);
    console.log(`[StatusUpdate] Report generated`);
    return { report };
  } catch (err) {
    console.error('[StatusUpdate] generateReportNode failed:', err);
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

async function humanGateNode(state: StatusUpdateState): Promise<Partial<StatusUpdateState>> {
  console.log(`[StatusUpdate] Executing HUMAN_GATE node — interrupting for approval`);

  // Interrupt to wait for human approval before broadcasting
  // Pass data to store, receive resume value when graph is resumed with Command
  const resumeData = {
    report: state.report,
    campaignCount: state.campaignIds.length,
    message: `Aprovar envio do relatório para ${state.campaignIds.length} campanhas?`,
  };
  const decision = await interrupt(resumeData) as { approved: boolean; comment?: string };

  console.log(`[StatusUpdate] Human decision: approved=${decision.approved}`);
  return { humanApproved: decision.approved, humanComment: decision.comment };
}

async function broadcastNode(state: StatusUpdateState): Promise<Partial<StatusUpdateState>> {
  console.log(`[StatusUpdate] Executing BROADCAST node`);
  try {
    const success = await broadcastToClients(state.report);
    return { broadcastSent: success };
  } catch (err) {
    console.error('[StatusUpdate] broadcastNode failed:', err);
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

function routeAfterGate(state: StatusUpdateState): string {
  if (state.humanApproved) {
    return 'BROADCAST';
  }
  console.log(`[StatusUpdate] Human rejected broadcast — ending workflow`);
  return '__end__';
}

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

async function fetchActiveCampaigns(): Promise<string[]> {
  try {
    const response = await fetchClient(`${QDRANT_URL}/collections/${COLLECTIONS.CAMPAIGNS}/points/scroll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filter: {
          must: [
            {
              key: 'status',
              match: { value: 'active' },
            },
          ],
        },
        limit: 100,
        with_payload: true,
      }),
    });

    if (!response.ok) {
      console.error('[StatusUpdate] Qdrant scroll failed:', response.status, await response.text());
      return [];
    }

    const data = (await response.json()) as QdrantScrollResponse;
    const campaignIds = (data.result?.points ?? []).map((point) => point.payload?.['campaign_id'] as string).filter(Boolean);

    return campaignIds;
  } catch (err) {
    console.error('[StatusUpdate] fetchActiveCampaigns error:', err);
    return [];
  }
}

async function fetchAllMetrics(campaignIds: string[]): Promise<Record<string, unknown>[]> {
  if (campaignIds.length === 0) {
    return [];
  }

  try {
    const response = await fetchClient(`${QDRANT_URL}/collections/${COLLECTIONS.CAMPAIGNS}/points/scroll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filter: {
          must: campaignIds.map((id) => ({
            key: 'campaign_id',
            match: { value: id },
          })),
        },
        limit: 100,
        with_payload: true,
      }),
    });

    if (!response.ok) {
      console.warn('[StatusUpdate] Could not fetch campaign metrics from Qdrant:', response.status);
    } else {
      const data = (await response.json()) as QdrantScrollResponse;
      const metrics = data.result?.points?.map((point) => ({
        campaignId: point.payload?.['campaign_id'] as string,
        status: point.payload?.['status'] as string,
        type: point.payload?.['type'] as string,
        clientId: point.payload?.['client_id'] as string,
        metrics: (point.payload?.['metrics'] as Record<string, unknown>) ?? {},
      }));

      if (metrics && metrics.length > 0) {
        console.log(`[StatusUpdate] Fetched metrics for ${metrics.length} campaigns`);
        return metrics;
      }
    }
  } catch (err) {
    console.warn('[StatusUpdate] fetchAllMetrics Qdrant error:', err);
  }

  console.warn(`[StatusUpdate] Using mock metrics (Qdrant returned no campaign data)`);
  return campaignIds.map((id) => ({
    campaignId: id,
    status: 'active',
    type: 'unknown',
    clientId: 'unknown',
    metrics: { impressions: 0, engagement: 0, reach: 0, clicks: 0 },
  }));
}

async function generateStatusReport(metrics: Record<string, unknown>[]): Promise<string> {
  const result = await llmComplete({
    messages: [
      {
        role: 'user',
        content: `Gere um relatório de status em português para campanhas de marketing:\n${JSON.stringify(metrics)}`,
      },
    ],
    systemPrompt:
      'Você é um project manager de agência de marketing. Gere um relatório claro e profissional.',
    maxTokens: 1024,
  });
  return result.content;
}

async function broadcastToClients(report: string): Promise<boolean> {
  let chatIds: number[] = [];

  try {
    const response = await fetchClient(`${QDRANT_URL}/collections/${COLLECTIONS.CLIENTS}/points/scroll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        limit: 100,
        with_payload: true,
      }),
    });

    if (!response.ok) {
      console.error('[StatusUpdate] Qdrant clients scroll failed:', response.status, await response.text());
    } else {
      const data = (await response.json()) as QdrantScrollResponse;
      chatIds = (data.result?.points ?? [])
        .map((point) => point.payload?.['chat_id'] as number | undefined)
        .filter((id): id is number => typeof id === 'number' && id > 0);
    }
  } catch (err) {
    console.error('[StatusUpdate] broadcastToClients Qdrant fetch error:', err);
  }

  if (chatIds.length === 0) {
    console.warn('[StatusUpdate] No client chat_ids found in Qdrant — cannot broadcast');
    return false;
  }

  let successCount = 0;
  for (const chatId of chatIds) {
    try {
      await bot.telegram.sendMessage(chatId, `📊 *Relatório de Status*\n\n${report}`, {
        parse_mode: 'Markdown',
      });
      successCount++;
    } catch (err) {
      console.error(`[StatusUpdate] Failed to send to chat ${chatId}:`, err);
    }
  }

  console.log(`[StatusUpdate] Broadcast sent to ${successCount}/${chatIds.length} clients`);
  return successCount > 0;
}

// ---------------------------------------------------------------------------
// Build StateGraph
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const workflow = new StateGraph<any>({
  channels: {
    campaignIds: { type: 'array', nullable: true },
    report: { type: 'string', nullable: true },
    broadcastSent: { type: 'boolean', nullable: true },
    humanApproved: { type: 'boolean', nullable: true },
    humanComment: { type: 'string', nullable: true },
    error: { type: 'string', nullable: true },
  },
})
  .addNode('FETCH_CAMPAIGNS', fetchCampaignsNode)
  .addNode('GENERATE_REPORT', generateReportNode)
  .addNode('HUMAN_GATE', humanGateNode)
  .addNode('BROADCAST', broadcastNode)
  .addEdge(START, 'FETCH_CAMPAIGNS')
  .addEdge('FETCH_CAMPAIGNS', 'GENERATE_REPORT')
  .addEdge('GENERATE_REPORT', 'HUMAN_GATE')
  .addConditionalEdges('HUMAN_GATE', routeAfterGate, {
    BROADCAST: 'BROADCAST',
  })
  .addEdge('BROADCAST', END);

// Compile with checkpointer for durable execution
const compiledGraph = workflow.compile({
  checkpointer,
});

export { compiledGraph as statusUpdateGraph };

// ---------------------------------------------------------------------------
// Execute function (for backward compatibility with supervisor registry)
// ---------------------------------------------------------------------------

export type { StatusUpdateState };

export async function executeStatusUpdate(): Promise<StatusUpdateState> {
  const threadId = `status-update-${Date.now()}`;
  console.log(`[StatusUpdate] Starting workflow thread ${threadId}`);

  const initialState: StatusUpdateState = {
    campaignIds: [],
    report: '',
    broadcastSent: false,
  };

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = (await compiledGraph.invoke(initialState, {
      configurable: { thread_id: threadId },
    })) as any as StatusUpdateState;
    console.log(`[StatusUpdate] Workflow complete: broadcastSent=${result['broadcastSent']}`);
    return result;
  } catch (err) {
    console.error('[LangGraph] executeStatusUpdate failed:', err);
    return {
      ...initialState,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ---------------------------------------------------------------------------
// Resume after human approval
// ---------------------------------------------------------------------------

export async function approveStatusUpdate(
  threadId: string,
  approved: boolean,
  comment?: string,
): Promise<StatusUpdateState> {
  console.log(`[StatusUpdate] Resuming thread ${threadId} with approved=${approved}`);

  try {
    // Resume using Command to provide the interrupt value
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = (await compiledGraph.invoke(
      new Command({
        resume: { approved, comment },
      }),
      {
        configurable: { thread_id: threadId },
      },
    )) as any as StatusUpdateState;
    return result;
  } catch (err) {
    console.error('[LangGraph] approveStatusUpdate failed:', err);
    return {
      campaignIds: [],
      report: '',
      broadcastSent: false,
      humanApproved: approved,
      humanComment: comment ?? undefined,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface QdrantScrollResponse {
  result?: {
    points: Array<{
      id: string | number;
      payload?: Record<string, unknown>;
    }>;
    next_page_offset?: string | number | null;
  };
  status?: string;
}