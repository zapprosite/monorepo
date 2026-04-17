// Anti-hardcoded: all config via process.env
// Qdrant Client — Multi-tenant collections for Hermes Agency Suite

const QDRANT_URL = process.env.QDRANT_URL ?? 'http://localhost:6333';
const COLLECTION_DIMENSION = 1024; // bge-m3 embedding dimension

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
  payloadSchema: Record<string, string>;
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
    const existsRes = await fetch(`${QDRANT_URL}/collections/${name}`);
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
      headers: { 'Content-Type': 'application/json' },
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
