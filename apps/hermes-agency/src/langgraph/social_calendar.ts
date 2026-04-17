// Anti-hardcoded: all config via process.env
// LangGraph Social Calendar + Analytics Workflow (WF-4)

import { llmComplete } from '../litellm/router.ts';
import { COLLECTIONS } from '../qdrant/client.ts';

export type SocialCalendarState = {
  scheduledPosts: Array<{ platform: string; content: string; scheduledTime: string }>;
  metricsReport: string;
  published: boolean;
};

export async function executeSocialCalendar(): Promise<SocialCalendarState> {
  const state: SocialCalendarState = {
    scheduledPosts: [],
    metricsReport: '',
    published: false,
  };

  // Scrape social calendar
  state.scheduledPosts = await scrapeCalendar();

  // Fetch analytics for recent posts
  const metrics = await fetchRecentMetrics();

  // Brand Guardian review
  const brandOk = await brandReview(state.scheduledPosts);

  if (brandOk) {
    state.metricsReport = await generateMetricsReport(metrics);
    state.published = true;
  }

  return state;
}

async function scrapeCalendar(): Promise<
  Array<{ platform: string; content: string; scheduledTime: string }>
> {
  const QDRANT_URL = process.env.QDRANT_URL ?? 'http://localhost:6333';
  const posts: Array<{ platform: string; content: string; scheduledTime: string }> = [];
  let nextPageId: string | undefined;

  do {
    const body: Record<string, unknown> = {
      limit: 100,
      with_payload: true,
    };
    if (nextPageId) body['scroll_id'] = nextPageId;

    const res = await fetch(`${QDRANT_URL}/collections/${COLLECTIONS.CAMPAIGNS}/points/scroll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      console.error('[social_calendar] Qdrant scroll failed:', await res.text());
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

      // scheduled_posts may be stored as a nested array in metrics or directly in payload
      const scheduledPosts = (
        p['metrics'] as Record<string, unknown> | undefined
      )?.['scheduled_posts'] as
        | Array<{ platform: string; content: string; scheduledTime: string }>
        | undefined;

      if (Array.isArray(scheduledPosts)) {
        posts.push(...scheduledPosts);
      } else if (p['scheduledTime']) {
        // Fallback: scheduledTime stored directly on the payload (e.g. campaign-level post)
        posts.push({
          platform: String(p['platform'] ?? 'Unknown'),
          content: String(p['content'] ?? ''),
          scheduledTime: String(p['scheduledTime']),
        });
      }
    }

    nextPageId = data.result?.next_page_id;
  } while (nextPageId);

  return posts;
}

async function fetchRecentMetrics(): Promise<Record<string, unknown>> {
  // STUB: Query Qdrant agency_campaigns metrics field (e.g. p.metrics.impressions, .engagement)
  // or an analytics API (e.g. Instagram Graph API, Twitter Ads API) when available.
  // For now, return mock data so the rest of the workflow can be exercised.
  return { impressions: 1000, engagement: 50, clicks: 20 };
}

async function brandReview(posts: Array<{ platform: string; content: string }>): Promise<boolean> {
  const content = posts.map((p) => `${p.platform}: ${p.content}`).join('\n');
  const result = await llmComplete({
    messages: [{ role: 'user', content: `Score brand consistency 0-1: ${content}` }],
    maxTokens: 5,
  });
  const score = parseFloat(result.content);
  return score >= 0.7;
}

async function generateMetricsReport(metrics: Record<string, unknown>): Promise<string> {
  const result = await llmComplete({
    messages: [
      {
        role: 'user',
        content: `Gere relatório de métricas em português: ${JSON.stringify(metrics)}`,
      },
    ],
    maxTokens: 512,
  });
  return result.content;
}
