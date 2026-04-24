#!/usr/bin/env npx tsx
// Initialize Qdrant collections for Hermes Agency
// Usage: npx tsx scripts/init-qdrant-collections.ts --reset false

import { parseArgs } from 'util';

const QDRANT_URL = process.env['QDRANT_URL'] ?? 'http://localhost:6333';
const QDRANT_API_KEY=process.env['QDRANT_API_KEY'];
if (!QDRANT_API_KEY) throw new Error("QDRANT_API_KEY not set in environment");

const VECTOR_SIZE = 768; // nomic-embed-text
const DISTANCE = 'Cosine';
const HNSW_M = 16;
const HNSW_EF_CONSTRUCT = 200;

const QDRANT_HEADERS = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${QDRANT_API_KEY}`,
};

interface CollectionDefinition {
  name: string;
  description: string;
  payloadSchema: Record<string, string>;
  payloadIndexes: string[];
}

const COLLECTIONS: CollectionDefinition[] = [
  {
    name: 'agency_clients',
    description: 'Client profiles for the agency',
    payloadSchema: {
      id: 'string',
      name: 'string',
      plan: 'string',
      health_score: 'float',
      chat_id: 'integer',
      created_at: 'string',
      metadata: {
        lead_source: 'string',
        industry: 'string',
        contacts: [
          {
            name: 'string',
            role: 'string',
            email: 'string',
          },
        ],
      },
    },
    payloadIndexes: ['id', 'plan', 'chat_id', 'created_at'],
  },
  {
    name: 'agency_campaigns',
    description: 'Marketing campaigns',
    payloadSchema: {
      id: 'string',
      client_id: 'string',
      name: 'string',
      status: 'string',
      created_at: 'string',
      budget: 'float',
      platforms: ['string'],
      metrics: {
        impressions: 'integer',
        clicks: 'integer',
        conversions: 'integer',
        spend: 'float',
      },
    },
    payloadIndexes: ['id', 'client_id', 'status', 'created_at'],
  },
  {
    name: 'agency_brand_guides',
    description: 'Brand guidelines per client',
    payloadSchema: {
      id: 'string',
      client_id: 'string',
      version: 'string',
      tone_of_voice: 'string',
      colors: {
        primary: 'string',
        secondary: 'string',
        accent: 'string',
      },
      prohibited_terms: ['string'],
      competitors: ['string'],
      guidelines_text: 'string',
      created_at: 'string',
      updated_at: 'string',
    },
    payloadIndexes: ['id', 'client_id', 'version'],
  },
  {
    name: 'agency_conversations',
    description: 'Client conversation history',
    payloadSchema: {
      id: 'string',
      chat_id: 'integer',
      client_id: 'string',
      messages: [
        {
          role: 'string',
          content: 'string',
          timestamp: 'string',
        },
      ],
      session_id: 'string',
      created_at: 'string',
    },
    payloadIndexes: ['id', 'chat_id', 'client_id', 'session_id', 'created_at'],
  },
  {
    name: 'agency_working_memory',
    description: 'Agent working memory per session',
    payloadSchema: {
      id: 'string',
      user_id: 'string',
      recent_entries: [
        {
          role: 'string',
          content: 'string',
          timestamp: 'integer',
        },
      ],
      context: {
        current_skill: 'string',
        current_task: 'string',
        metadata: 'object',
      },
      last_updated: 'string',
    },
    payloadIndexes: ['id', 'user_id', 'last_updated'],
  },
  {
    name: 'agency_assets',
    description: 'Creative assets (images, videos, documents)',
    payloadSchema: {
      id: 'string',
      client_id: 'string',
      campaign_id: 'string',
      name: 'string',
      type: 'string',
      url: 'string',
      tags: ['string'],
      mime_type: 'string',
      size_bytes: 'integer',
      created_at: 'string',
    },
    payloadIndexes: ['id', 'client_id', 'campaign_id', 'type', 'tags'],
  },
  {
    name: 'agency_tasks',
    description: 'Agency tasks and deliverables',
    payloadSchema: {
      id: 'string',
      client_id: 'string',
      campaign_id: 'string',
      title: 'string',
      description: 'string',
      assignee: 'string',
      status: 'string',
      priority: 'string',
      due_date: 'string',
      created_at: 'string',
      updated_at: 'string',
    },
    payloadIndexes: ['id', 'client_id', 'campaign_id', 'status', 'assignee', 'priority'],
  },
  {
    name: 'agency_video_metadata',
    description: 'Video transcription and key moments',
    payloadSchema: {
      id: 'string',
      client_id: 'string',
      campaign_id: 'string',
      asset_id: 'string',
      title: 'string',
      duration_seconds: 'integer',
      transcription: 'string',
      key_moments: [
        {
          timestamp: 'integer',
          label: 'string',
          description: 'string',
        },
      ],
      created_at: 'string',
    },
    payloadIndexes: ['id', 'client_id', 'campaign_id', 'asset_id'],
  },
  {
    name: 'agency_knowledge',
    description: 'Agency knowledge base',
    payloadSchema: {
      id: 'string',
      type: 'string',
      title: 'string',
      content: 'string',
      tags: ['string'],
      created_at: 'string',
      updated_at: 'string',
    },
    payloadIndexes: ['id', 'type', 'tags', 'created_at'],
  },
];

async function collectionExists(name: string): Promise<boolean> {
  const res = await fetch(`${QDRANT_URL}/collections/${name}`, { headers: QDRANT_HEADERS });
  if (!res.ok) return false;
  const data = (await res.json()) as { result?: { exists?: boolean } };
  return data.result?.exists ?? false;
}

async function deleteCollection(name: string): Promise<boolean> {
  console.log(`[INIT] Deleting collection: ${name}`);
  const res = await fetch(`${QDRANT_URL}/collections/${name}`, {
    method: 'DELETE',
    headers: QDRANT_HEADERS,
  });
  if (!res.ok) {
    console.error(`[INIT] Failed to delete ${name}:`, await res.text());
    return false;
  }
  console.log(`[INIT] Deleted: ${name}`);
  return true;
}

async function createCollection(definition: CollectionDefinition): Promise<boolean> {
  console.log(`[INIT] Creating collection: ${definition.name}`);

  // Create collection with HNSW index configuration
  const res = await fetch(`${QDRANT_URL}/collections/${definition.name}`, {
    method: 'PUT',
    headers: QDRANT_HEADERS,
    body: JSON.stringify({
      vectors: {
        size: VECTOR_SIZE,
        distance: DISTANCE,
      },
      hnsw_config: {
        m: HNSW_M,
        ef_construct: HNSW_EF_CONSTRUCT,
      },
    }),
  });

  if (!res.ok) {
    console.error(`[INIT] Failed to create ${definition.name}:`, await res.text());
    return false;
  }

  console.log(`[INIT] Created: ${definition.name} (vectors: ${VECTOR_SIZE}, distance: ${DISTANCE})`);

  // Create payload indexes
  for (const fieldName of definition.payloadIndexes) {
    const indexRes = await fetch(`${QDRANT_URL}/collections/${definition.name}/index`, {
      method: 'PUT',
      headers: QDRANT_HEADERS,
      body: JSON.stringify({
        field_name: fieldName,
        field_schema: 'keyword',
      }),
    });

    if (!indexRes.ok) {
      console.warn(`[INIT] Warning: could not create index on ${definition.name}.${fieldName}`);
    } else {
      console.log(`[INIT]   + index on '${fieldName}'`);
    }
  }

  return true;
}

async function initCollections(reset: boolean): Promise<void> {
  console.log('[INIT] Starting Qdrant collection initialization...');
  console.log(`[INIT] Target: ${QDRANT_URL}`);
  console.log(`[INIT] Reset mode: ${reset}`);

  // Verify Qdrant is reachable
  try {
    const healthRes = await fetch(`${QDRANT_URL}/health`, { headers: QDRANT_HEADERS });
    if (!healthRes.ok) {
      console.error('[INIT] Qdrant health check failed');
      process.exit(1);
    }
    console.log('[INIT] Qdrant is reachable');
  } catch (err) {
    console.error('[INIT] Cannot connect to Qdrant:', err);
    process.exit(1);
  }

  // Process each collection
  for (const definition of COLLECTIONS) {
    const exists = await collectionExists(definition.name);

    if (exists) {
      if (reset) {
        await deleteCollection(definition.name);
        await createCollection(definition);
      } else {
        console.log(`[INIT] Skipping ${definition.name} (already exists, reset=false)`);
      }
    } else {
      await createCollection(definition);
    }
  }

  console.log('[INIT] Collection initialization complete!');
}

async function main() {
  const { values } = parseArgs({
    options: {
      reset: { type: 'string', default: 'false' },
    },
  });

  const reset = values['reset'] === 'true';
  await initCollections(reset);
}

main().catch((err) => {
  console.error('[INIT] Fatal error:', err);
  process.exit(1);
});
