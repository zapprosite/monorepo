// Anti-hardcoded: all config via process.env
// Qdrant Client — Multi-tenant collections for Hermes Agency Suite
/* eslint-disable no-console */

const QDRANT_URL = process.env['QDRANT_URL'] ?? 'http://localhost:6333';
const QDRANT_API_KEY = process.env['QDRANT_API_KEY'] ?? '';

if (!QDRANT_API_KEY) {
  console.error('[Qdrant] QDRANT_API_KEY not set in .env');
  process.exit(1);
}

const COLLECTION_DIMENSION = 1024; // bge-m3 embedding dimension

const QDRANT_HEADERS = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${QDRANT_API_KEY}`,
};

export const COLLECTIONS = {
  CLIENTS: 'agency_clients',
  CAMPAIGNS: 'agency_campaigns',
  CONVERSATIONS: 'agency_conversations',
  ASSETS: 'agency_assets',
  BRAND_GUIDES: 'agency_brand_guides',
  TASKS: 'agency_tasks',
  VIDEO_METADATA: 'agency_video_metadata',
  KNOWLEDGE: 'agency_knowledge',
  WORKING_MEMORY: 'agency_working_memory',
} as const;

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];

export interface CollectionSchema {
  name: CollectionName;
  description: string;
  payloadSchema: string;
}

export const COLLECTION_SCHEMAS: CollectionSchema[] = [
  {
    name: COLLECTIONS.CLIENTS,
    description: 'Client profiles for the agency',
    payloadSchema:
      'client_id: string, name: string, plan: string, health_score: float, onboarding_complete: bool',
  },
  {
    name: COLLECTIONS.CAMPAIGNS,
    description: 'Marketing campaigns',
    payloadSchema:
      'campaign_id: string, client_id: string, status: string, type: string, metrics: object',
  },
  {
    name: COLLECTIONS.CONVERSATIONS,
    description: 'Client conversation history',
    payloadSchema:
      'conversation_id: string, client_id: string, messages: array, last_message: string',
  },
  {
    name: COLLECTIONS.ASSETS,
    description: 'Creative assets (images, videos, documents)',
    payloadSchema: 'asset_id: string, client_id: string, type: string, tags: array, url: string',
  },
  {
    name: COLLECTIONS.BRAND_GUIDES,
    description: 'Brand guidelines per client',
    payloadSchema:
      'guide_id: string, client_id: string, voice_tone: string, colors: array, fonts: array',
  },
  {
    name: COLLECTIONS.TASKS,
    description: 'Agency tasks and deliverables',
    payloadSchema:
      'task_id: string, campaign_id: string, assignee: string, status: string, priority: string',
  },
  {
    name: COLLECTIONS.VIDEO_METADATA,
    description: 'Video transcription and key moments',
    payloadSchema:
      'video_id: string, campaign_id: string, transcription: string, key_moments: array',
  },
  {
    name: COLLECTIONS.KNOWLEDGE,
    description: 'Agency knowledge base',
    payloadSchema: 'doc_id: string, type: string, content: string, embedding: array',
  },
  {
    name: COLLECTIONS.WORKING_MEMORY,
    description: 'Agent working memory per session',
    payloadSchema: 'session_id: string, agent_id: string, context_window: array, ttl: int',
  },
];

export async function createCollectionIfNotExists(name: CollectionName): Promise<boolean> {
  try {
    const existsRes = await fetch(`${QDRANT_URL}/collections/${name}`, { headers: QDRANT_HEADERS });
    if (existsRes.ok) {
      const exists = (await existsRes.json()) as { result?: { exists?: boolean } };
      if (exists.result?.exists) {
        console.log(`[Qdrant] Collection ${name} already exists`);
        return true;
      }
    }

    // Create collection
    const createRes = await fetch(`${QDRANT_URL}/collections/${name}`, {
      method: 'PUT',
      headers: QDRANT_HEADERS,
      body: JSON.stringify({
        vectors: {
          size: COLLECTION_DIMENSION,
          distance: 'Cosine',
        },
      }),
    });

    if (!createRes.ok) {
      console.error(`[Qdrant] Failed to create ${name}:`, await createRes.text());
      return false;
    }

    console.log(`[Qdrant] Created collection: ${name}`);
    return true;
  } catch (err) {
    console.error(`[Qdrant] Error with collection ${name}:`, err);
    return false;
  }
}

export async function initAllCollections(): Promise<void> {
  console.log('[Qdrant] Initializing all 9 agency collections...');
  const results = await Promise.all(
    COLLECTION_SCHEMAS.map((schema) => createCollectionIfNotExists(schema.name)),
  );

  const allSuccess = results.every(Boolean);
  if (allSuccess) {
    console.log('[Qdrant] All collections ready');
  } else {
    console.warn('[Qdrant] Some collections failed — check Qdrant is accessible');
  }
}

// ---------------------------------------------------------------------------
// CRUD Operations
// ---------------------------------------------------------------------------

export interface PointPayload {
  [key: string]: unknown;
}

export interface SearchFilter {
  must?: Array<Record<string, unknown>>;
  should?: Array<Record<string, unknown>>;
  must_not?: Array<Record<string, unknown>>;
}

export interface UpsertParams {
  collection: CollectionName;
  id: string | number;
  vector: number[];
  payload: PointPayload;
}

export interface SearchParams {
  collection: CollectionName;
  vector: number[];
  limit: number;
  filter?: SearchFilter;
}

export interface DeleteParams {
  collection: CollectionName;
  id: string | number;
}

export async function upsertVector({
  collection,
  id,
  vector,
  payload,
}: UpsertParams): Promise<boolean> {
  try {
    const res = await fetch(`${QDRANT_URL}/collections/${collection}/points`, {
      method: 'PUT',
      headers: QDRANT_HEADERS,
      body: JSON.stringify({
        points: [{ id, vector, payload }],
      }),
    });

    if (!res.ok) {
      console.error(`[Qdrant] Upsert failed for ${collection}/${id}:`, await res.text());
      return false;
    }

    return true;
  } catch (err) {
    console.error(`[Qdrant] Upsert error (${collection}/${id}):`, err);
    return false;
  }
}

export async function search({
  collection,
  vector,
  limit,
  filter,
}: SearchParams): Promise<Array<{ id: string | number; score: number; payload: PointPayload }>> {
  try {
    const res = await fetch(`${QDRANT_URL}/collections/${collection}/points/search`, {
      method: 'POST',
      headers: QDRANT_HEADERS,
      body: JSON.stringify({
        vector,
        limit,
        filter,
        with_payload: true,
      }),
    });

    if (!res.ok) {
      console.error(`[Qdrant] Search failed for ${collection}:`, await res.text());
      return [];
    }

    const data = (await res.json()) as {
      result?: Array<{ id: string | number; score: number; payload: PointPayload }>;
    };
    return data.result ?? [];
  } catch (err) {
    console.error(`[Qdrant] Search error (${collection}):`, err);
    return [];
  }
}

export async function deleteVector({ collection, id }: DeleteParams): Promise<boolean> {
  try {
    const res = await fetch(`${QDRANT_URL}/collections/${collection}/points/${id}`, {
      method: 'DELETE',
      headers: QDRANT_HEADERS,
    });

    if (!res.ok) {
      console.error(`[Qdrant] Delete failed for ${collection}/${id}:`, await res.text());
      return false;
    }

    return true;
  } catch (err) {
    console.error(`[Qdrant] Delete error (${collection}/${id}):`, err);
    return false;
  }
}

export interface GetPointParams {
  collection: CollectionName;
  id: string | number;
}

export interface PointResult {
  id: string | number;
  payload: PointPayload;
}

export async function getPoint({ collection, id }: GetPointParams): Promise<PointResult | null> {
  try {
    const res = await fetch(`${QDRANT_URL}/collections/${collection}/points/${id}`, {
      method: 'GET',
      headers: QDRANT_HEADERS,
    });

    if (!res.ok) {
      console.error(`[Qdrant] GetPoint failed for ${collection}/${id}:`, await res.text());
      return null;
    }

    const data = (await res.json()) as {
      result?: { id: string | number; payload?: PointPayload };
    };

    if (!data.result) return null;
    return { id: data.result.id, payload: data.result.payload ?? {} };
  } catch (err) {
    console.error(`[Qdrant] GetPoint error (${collection}/${id}):`, err);
    return null;
  }
}

export async function updatePoint(
  collection: CollectionName,
  id: string | number,
  payload: PointPayload,
): Promise<boolean> {
  try {
    // Qdrant PUT upserts full point — merge payload by fetching first
    const existing = await getPoint({ collection, id });
    const mergedPayload = existing ? { ...existing.payload, ...payload } : payload;
    const vector = (existing?.payload?.['vector'] as number[]) ?? new Array(COLLECTION_DIMENSION).fill(0);

    const res = await fetch(`${QDRANT_URL}/collections/${collection}/points`, {
      method: 'PUT',
      headers: QDRANT_HEADERS,
      body: JSON.stringify({
        points: [{ id, vector, payload: mergedPayload }],
      }),
    });

    if (!res.ok) {
      console.error(`[Qdrant] UpdatePoint failed for ${collection}/${id}:`, await res.text());
      return false;
    }

    return true;
  } catch (err) {
    console.error(`[Qdrant] UpdatePoint error (${collection}/${id}):`, err);
    return false;
  }
}

export async function scrollCollection(
  collection: CollectionName,
  limit = 100,
  offset?: string,
): Promise<{ points: PointResult[]; nextPageOffset?: string }> {
  try {
    const body: Record<string, unknown> = {
      limit,
      with_payload: true,
    };
    if (offset) body['offset'] = offset;

    const res = await fetch(`${QDRANT_URL}/collections/${collection}/points/scroll`, {
      method: 'POST',
      headers: QDRANT_HEADERS,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      console.error(`[Qdrant] Scroll failed for ${collection}:`, await res.text());
      return { points: [] };
    }

    const data = (await res.json()) as {
      result?: { points?: PointResult[]; next_page_offset?: string };
    };

    return {
      points: data.result?.points ?? [],
      nextPageOffset: data.result?.next_page_offset as string | undefined,
    };
  } catch (err) {
    console.error(`[Qdrant] Scroll error (${collection}):`, err);
    return { points: [] };
  }
}
