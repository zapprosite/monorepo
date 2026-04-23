// Anti-hardcoded: all config via process.env
// LangGraph Status Update Workflow (WF-3) — Recurring Monday 9am
/* eslint-disable no-console */

import { llmComplete } from '../litellm/router.js';
import { COLLECTIONS } from '../qdrant/client.js';
import { bot } from '../telegram/bot.js';

const QDRANT_URL = process.env['QDRANT_URL'] ?? 'http://localhost:6333';

export type StatusUpdateState = {
  campaignIds: string[];
  report: string;
  broadcastSent: boolean;
};

export async function executeStatusUpdate(): Promise<StatusUpdateState> {
  const state: StatusUpdateState = {
    campaignIds: [],
    report: '',
    broadcastSent: false,
  };

  // Fetch all active campaigns from Qdrant
  state.campaignIds = await fetchActiveCampaigns();

  // Generate status report
  const metrics = await fetchAllMetrics(state.campaignIds);
  state.report = await generateStatusReport(metrics);

  // Broadcast to Telegram (all clients)
  state.broadcastSent = await broadcastToClients(state.report);

  return state;
}

async function fetchActiveCampaigns(): Promise<string[]> {
  try {
    const response = await fetch(`${QDRANT_URL}/collections/${COLLECTIONS.CAMPAIGNS}/points/scroll`, {
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

    console.log(`[StatusUpdate] Found ${campaignIds.length} active campaigns`);
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
    // Fetch all campaign records in one scroll (no filter) and extract metrics
    const response = await fetch(`${QDRANT_URL}/collections/${COLLECTIONS.CAMPAIGNS}/points/scroll`, {
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
      // Fall through to mock data below
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

  // Graceful fallback: return mock metrics with campaignIds, log clearly this is fallback
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

  // Step 1: Fetch all client chat_ids from Qdrant agency_clients
  try {
    const response = await fetch(`${QDRANT_URL}/collections/${COLLECTIONS.CLIENTS}/points/scroll`, {
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

  // Step 2: Send report to each client chat via Telegram bot
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
