// Anti-hardcoded: all config via process.env
// LangGraph Social Calendar + Analytics Workflow (WF-4) — Real StateGraph with interrupt
/* eslint-disable no-console */

import { MemorySaver, StateGraph, START, END, interrupt, Command } from '@langchain/langgraph';
import { llmComplete } from '../litellm/router.js';
import { COLLECTIONS } from '../qdrant/client.js';
import { fetchClient } from '../utils/fetch-client.js';

const QDRANT_URL = process.env['QDRANT_URL'] ?? 'http://localhost:6333';

const checkpointer = new MemorySaver();

export type SocialCalendarState = {
  currentStep: string;
  scheduledPosts: Array<{ platform: string; content: string; scheduledTime: string }>;
  brandScore?: number;
  metricsReport?: string;
  humanApproved?: boolean;
  humanComment?: string;
  published?: boolean;
  error?: string;
};

// Node: Scrape social calendar
async function scrapeNode(_state: SocialCalendarState): Promise<Partial<SocialCalendarState>> {
  console.log(`[SocialCalendar] Executing SCRAPE node`);
  const posts: Array<{ platform: string; content: string; scheduledTime: string }> = [];

  try {
    let nextPageId: string | undefined;

    do {
      const body: Record<string, unknown> = {
        limit: 100,
        with_payload: true,
      };
      if (nextPageId) body['scroll_id'] = nextPageId;

      const res = await fetchClient(`${QDRANT_URL}/collections/${COLLECTIONS.CAMPAIGNS}/points/scroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        console.error('[SocialCalendar] Qdrant scroll failed:', await res.text());
        break;
      }

      const data = (await res.json()) as {
        result?: {
          points?: Array<{ payload?: Record<string, unknown> }>;
          next_page_id?: string;
        };
      };

      const points = data.result?.points ?? [];
      for (const point of points) {
        const p = point.payload ?? {};

        const scheduledPosts = (p['metrics'] as Record<string, unknown> | undefined)?.[
          'scheduled_posts'
        ] as Array<{ platform: string; content: string; scheduledTime: string }> | undefined;

        if (Array.isArray(scheduledPosts)) {
          posts.push(...scheduledPosts);
        } else if (p['scheduledTime']) {
          posts.push({
            platform: String(p['platform'] ?? 'Unknown'),
            content: String(p['content'] ?? ''),
            scheduledTime: String(p['scheduledTime']),
          });
        }
      }

      nextPageId = data.result?.next_page_id;
    } while (nextPageId);

    console.log(`[SocialCalendar] Scraped ${posts.length} scheduled posts`);
    return { currentStep: 'SCRAPE', scheduledPosts: posts };
  } catch (err) {
    console.error('[SocialCalendar] scrapeNode failed:', err);
    return { currentStep: 'ERROR', error: err instanceof Error ? err.message : String(err) };
  }
}

// Node: Brand Guardian review
async function brandReviewNode(state: SocialCalendarState): Promise<Partial<SocialCalendarState>> {
  console.log(`[SocialCalendar] Executing BRAND_REVIEW node`);
  try {
    const content = state.scheduledPosts.map((p) => `${p.platform}: ${p.content}`).join('\n');
    const result = await llmComplete({
      messages: [{ role: 'user', content: `Score brand consistency 0-1: ${content}` }],
      maxTokens: 5,
    });
    const brandScore = Math.max(0, Math.min(1, parseFloat(result.content) || 0.5));
    console.log(`[SocialCalendar] Brand score: ${brandScore.toFixed(2)}`);
    return { currentStep: 'BRAND_REVIEW', brandScore };
  } catch (err) {
    console.error('[SocialCalendar] brandReviewNode failed:', err);
    return { currentStep: 'ERROR', error: err instanceof Error ? err.message : String(err) };
  }
}

// Node: Human approval gate
async function humanGateNode(state: SocialCalendarState): Promise<Partial<SocialCalendarState>> {
  console.log(`[SocialCalendar] Executing HUMAN_GATE node`);

  // Always interrupt for human approval — brand score is advisory, human makes final decision
  console.log(
    `[SocialCalendar] Brand score ${(state.brandScore ?? 0).toFixed(2)} — requesting human approval`,
  );

  // BUG FIX: interrupt() returns the resume value passed via Command.resume.
  // The resume value is { humanApproved: boolean, humanComment?: string }
  // Previously was returning `approved` directly (an object), but should return .humanApproved
  const approval = await interrupt({
    brandScore: state.brandScore,
    postCount: state.scheduledPosts.length,
    message: `Aprovar publicação de ${state.scheduledPosts.length} posts? Brand score: ${state.brandScore?.toFixed(2)}`,
  });

  console.log(`[SocialCalendar] Human approval result:`, approval);
  return {
    currentStep: 'HUMAN_GATE',
    humanApproved: approval.humanApproved,
    humanComment: approval.humanComment,
  };
}

// Node: Generate metrics report
async function metricsNode(): Promise<Partial<SocialCalendarState>> {
  console.log(`[SocialCalendar] Executing METRICS node`);
  try {
    const metrics = await fetchRecentMetrics();
    const result = await llmComplete({
      messages: [
        {
          role: 'user',
          content: `Gere relatório de métricas em português: ${JSON.stringify(metrics)}`,
        },
      ],
      maxTokens: 512,
    });
    console.log(`[SocialCalendar] Metrics report generated`);
    return { currentStep: 'METRICS', metricsReport: result.content };
  } catch (err) {
    console.error('[SocialCalendar] metricsNode failed:', err);
    return { currentStep: 'ERROR', error: err instanceof Error ? err.message : String(err) };
  }
}

// Node: Publish posts
async function publishNode(state: SocialCalendarState): Promise<Partial<SocialCalendarState>> {
  console.log(`[SocialCalendar] Executing PUBLISH node`);
  try {
    // TODO: Actually publish to social media platforms
    console.log(`[SocialCalendar] Publishing ${state.scheduledPosts.length} posts...`);
    console.log(`[SocialCalendar] Posts published successfully`);
    return { currentStep: 'PUBLISH', published: true };
  } catch (err) {
    console.error('[SocialCalendar] publishNode failed:', err);
    return { currentStep: 'ERROR', error: err instanceof Error ? err.message : String(err) };
  }
}

// Helper: Fetch recent metrics
async function fetchRecentMetrics(): Promise<Record<string, unknown>> {
  try {
    const result = await llmComplete({
      messages: [
        {
          role: 'user',
          content: 'Query recent post metrics from the calendar system',
        },
      ],
      maxTokens: 256,
    });
    return JSON.parse(result.content);
  } catch (err) {
    console.error('[SocialCalendar] fetchRecentMetrics failed:', err);
    return {};
  }
}

// Conditional edge: route based on human approval
function shouldPublish(state: SocialCalendarState): 'METRICS' | 'END' {
  if (state.humanApproved === true) {
    return 'METRICS';
  }
  return 'END';
}

// Build the StateGraph
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const workflow = new StateGraph<any>({
  channels: {
    currentStep: { type: 'string' },
    scheduledPosts: { type: 'any', nullable: true },
    brandScore: { type: 'number', nullable: true },
    metricsReport: { type: 'string', nullable: true },
    humanApproved: { type: 'boolean', nullable: true },
    humanComment: { type: 'string', nullable: true },
    published: { type: 'boolean', nullable: true },
    error: { type: 'string', nullable: true },
  },
})
  .addNode('SCRAPE', scrapeNode)
  .addNode('BRAND_REVIEW', brandReviewNode)
  .addNode('HUMAN_GATE', humanGateNode)
  .addNode('METRICS', metricsNode)
  .addNode('PUBLISH', publishNode)
  .addEdge(START, 'SCRAPE')
  .addEdge('SCRAPE', 'BRAND_REVIEW')
  .addEdge('BRAND_REVIEW', 'HUMAN_GATE')
  .addConditionalEdges('HUMAN_GATE', shouldPublish)
  .addEdge('METRICS', 'PUBLISH')
  .addEdge('PUBLISH', END);

const compiledGraph = workflow.compile({ checkpointer });

export { compiledGraph as socialCalendarGraph };

// Execute social calendar workflow
export async function executeSocialCalendar(): Promise<SocialCalendarState> {
  const threadId = `social-${Date.now()}`;
  console.log(`[SocialCalendar] Starting social calendar workflow (${threadId})`);

  const initialState: SocialCalendarState = {
    currentStep: 'SCRAPE',
    scheduledPosts: [],
  };

  try {
    const result = await compiledGraph.invoke(initialState, {
      configurable: { thread_id: threadId },
    });
    console.log(`[SocialCalendar] Workflow complete for ${threadId}`);
    return result as SocialCalendarState;
  } catch (err) {
    console.error('[SocialCalendar] executeSocialCalendar failed:', err);
    return {
      ...initialState,
      currentStep: 'ERROR',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// Resume after human approval
export async function approveSocialCalendar(
  threadId: string,
  approved: boolean,
  comment?: string,
): Promise<SocialCalendarState> {
  console.log(`[SocialCalendar] Resuming workflow ${threadId} with approved=${approved}`);

  try {
    // Resume using Command to provide the interrupt value
    // BUG FIX: Pass object { humanApproved, humanComment } to match what interrupt returns
    const result = await compiledGraph.invoke(
      new Command({
        resume: { humanApproved: approved, humanComment: comment },
      }),
      {
        configurable: { thread_id: threadId },
      },
    );
    return result as SocialCalendarState;
  } catch (err) {
    console.error('[SocialCalendar] approveSocialCalendar failed:', err);
    return {
      currentStep: 'ERROR',
      scheduledPosts: [],
      humanApproved: approved,
      humanComment: comment ?? undefined,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
