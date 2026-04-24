// Anti-hardcoded: all config via process.env
// Hermes Skill: RAG Instance Organizer
// Teaches Hermes how to organize vector instances by app, lead, or any dimension
/* eslint-disable no-console */

import { fetchClient } from '../utils/fetch-client.js';
import type { Skill } from './index.js';

// ---------------------------------------------------------------------------
// Tool names — must be in REGISTERED_TOOLS before use
// Add to skills/index.ts REGISTERED_TOOLS when introducing a new tool
// ---------------------------------------------------------------------------

const RAG_TOOLS = [
  'rag_retrieve',
  'rag_index_document',
  'rag_list_datasets',
  'rag_create_dataset',
  'rag_search',
  'qdrant_query',
] as const;

export type RagTool = (typeof RAG_TOOLS)[number];

// ---------------------------------------------------------------------------
// Skill Definition
// ---------------------------------------------------------------------------

export const RAG_INSTANCE_ORGANIZER: Skill = {
  id: 'rag-instance-organizer',
  name: 'INSTANCE ORGANIZER',
  description:
    'Organiza instâncias RAG por app ou lead. Ensina o Hermes a criar datasets, indexar documentos, e recuperar conhecimento contextual para cada dimensão organizacional.',
  tools: [...RAG_TOOLS],
  triggers: [
    'organizar instância',
    'instance organizer',
    'novo dataset',
    'novo lead',
    'indexar docs',
    'buscar contexto',
    'rag',
    'knowledge base',
  ],
};

// ---------------------------------------------------------------------------
// Dataset Naming Convention
// ---------------------------------------------------------------------------

export interface DatasetConfig {
  /** App identifier — e.g. "hermes", "painel", "hvacr", "monorepo" */
  app: string;
  /** Optional lead/project dimension — e.g. "will", "client-alfa", "lead-xyz" */
  lead?: string;
  /** Human-readable description */
  description: string;
  /** Chunking strategy: "heading" | "sentence" | "page" */
  chunkingStrategy?: 'heading' | 'sentence' | 'page';
}

/**
 * Builds a Trieve dataset name following the convention:
 *   {app}[-{lead}]?[-knowledge|-memory|-context]?
 *
 * Examples:
 *   hermes-knowledge
 *   painel-lead-alfa-knowledge
 *   hvacr-lead-xyz-memory
 */
export function buildDatasetName(config: DatasetConfig): string {
  const parts: string[] = [config.app.toLowerCase()];
  if (config.lead) parts.push(`lead-${config.lead.toLowerCase()}`);
  return parts.join('-');
}

/**
 * Parses a dataset name back into its components.
 * Inverse of buildDatasetName.
 */
export function parseDatasetName(name: string): DatasetConfig | null {
  const parts = name.split('-');
  const app = parts[0];
  if (!app) return null;

  const lead = parts.includes('lead') ? parts[parts.indexOf('lead') + 1] : undefined;

  return {
    app,
    lead,
    description: '', // description is not encoded in the name
  };
}

// ---------------------------------------------------------------------------
// RAG Operations (pseudo-implementation — calls Trieve via HTTP)
// ---------------------------------------------------------------------------

export interface RagDocument {
  content: string;
  metadata: Record<string, string | number | boolean>;
}

export interface RagSearchResult {
  id: string;
  content: string;
  score: number;
  metadata: Record<string, string | number | boolean>;
}

/**
 * Create a new Trieve dataset for a specific app/lead dimension.
 * Uses Trieve API v1 — see /api/dataset endpoint.
 */
export async function createDataset(config: DatasetConfig): Promise<{ id: string; name: string } | null> {
  const name = buildDatasetName(config);
  const url = `${process.env['TRIEVE_URL'] ?? 'http://localhost:6435'}/api/v1/datasets`;
  const apiKey = process.env['TRIEVE_API_KEY'];

  try {
    const res = await fetchClient(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `ApiKey ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        name,
        description: config.description,
        // Trieve dataset settings can include chunking strategy, embedding model, etc.
        settings: {
          ...(config.chunkingStrategy ? { chunking_strategy: config.chunkingStrategy } : {}),
        },
      }),
    });

    if (!res.ok) {
      console.error(`[RAG] Failed to create dataset ${name}:`, await res.text());
      return null;
    }

    const data = (await res.json()) as { id: string; name: string };
    console.log(`[RAG] Dataset created: ${data.name} (${data.id})`);
    return data;
  } catch (err) {
    console.error(`[RAG] createDataset error:`, err);
    return null;
  }
}

/**
 * Index a document into a Trieve dataset.
 * Respects the 120-chunks-per-request limit (bulk upload).
 */
export async function indexDocument(
  datasetId: string,
  documents: RagDocument[],
): Promise<boolean> {
  const url = `${process.env['TRIEVE_URL'] ?? 'http://localhost:6435'}/api/v1/chunks`;
  const apiKey = process.env['TRIEVE_API_KEY'];

  // Trieve bulk limit: 120 chunks per request
  const BULK_LIMIT = 120;
  const chunks = documents.map((doc) => ({
    chunk_html: doc.content,
    metadata: doc.metadata,
    tag_set: doc.metadata['type'] as string ?? 'general',
  }));

  try {
    // Process in batches of BULK_LIMIT
    for (let i = 0; i < chunks.length; i += BULK_LIMIT) {
      const batch = chunks.slice(i, i + BULK_LIMIT);
      const res = await fetchClient(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'TR-Dataset': datasetId,
          ...(apiKey ? { Authorization: `ApiKey ${apiKey}` } : {}),
        },
        body: JSON.stringify({ chunks: batch }),
      });

      if (!res.ok) {
        console.error(`[RAG] Failed to index chunk batch:`, await res.text());
        return false;
      }
    }

    console.log(`[RAG] Indexed ${documents.length} documents into dataset ${datasetId}`);
    return true;
  } catch (err) {
    console.error(`[RAG] indexDocument error:`, err);
    return false;
  }
}

/**
 * Search a Trieve dataset for relevant chunks.
 * Supports hybrid search (semantic + fulltext).
 */
export async function ragSearch(
  datasetId: string,
  query: string,
  limit = 5,
): Promise<RagSearchResult[]> {
  const url = `${process.env['TRIEVE_URL'] ?? 'http://localhost:6435'}/api/v1/chunk/search`;
  const apiKey = process.env['TRIEVE_API_KEY'];

  try {
    const res = await fetchClient(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'TR-Dataset': datasetId,
        ...(apiKey ? { Authorization: `ApiKey ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        query,
        limit,
        search_type: 'hybrid', // semantic + fulltext
        highlight_results: true,
      }),
    });

    if (!res.ok) {
      console.error(`[RAG] Search failed:`, await res.text());
      return [];
    }

    const data = (await res.json()) as {
      results?: Array<{
        chunk: { id: string; chunk_html: string; metadata: Record<string, string | number | boolean> };
        score?: number;
      }>;
    };

    return (data.results ?? []).map((r) => ({
      id: r.chunk.id,
      content: r.chunk.chunk_html,
      score: r.score ?? 0,
      metadata: r.chunk.metadata,
    }));
  } catch (err) {
    console.error(`[RAG] ragSearch error:`, err);
    return [];
  }
}

/**
 * List all datasets in Trieve.
 * Uses Trieve API v1 — GET /api/v1/datasets.
 */
export async function listDatasets(): Promise<Array<{ id: string; name: string; description?: string }>> {
  const url = `${process.env['TRIEVE_URL'] ?? 'http://localhost:6435'}/api/v1/datasets`;
  const apiKey = process.env['TRIEVE_API_KEY'];

  try {
    const res = await fetchClient(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `ApiKey ${apiKey}` } : {}),
      },
    });

    if (!res.ok) {
      console.error(`[RAG] Failed to list datasets:`, await res.text());
      return [];
    }

    const data = (await res.json()) as Array<{ id: string; name: string; description?: string }>;
    console.log(`[RAG] Listed ${data.length} datasets`);
    return data;
  } catch (err) {
    console.error(`[RAG] listDatasets error:`, err);
    return [];
  }
}

/**
 * Retrieve contextual knowledge for a given query.
 * Infers the correct dataset from the app context in the conversation.
 */
export async function ragRetrieve(query: string, topK = 5): Promise<RagSearchResult[]> {
  // NOTE: In production, the app context should be extracted from the conversation
  // and the datasetId should be resolved via the conversation context or Mem0.
  // This is a fallback that searches the default knowledge dataset.
  const defaultDataset = process.env['TRIEVE_DEFAULT_DATASET_ID'] ?? '';
  if (!defaultDataset) {
    console.warn('[RAG] TRIEVE_DEFAULT_DATASET_ID not set — cannot retrieve');
    return [];
  }
  return ragSearch(defaultDataset, query, topK);
}

// ---------------------------------------------------------------------------
// Predefined Dataset Templates (per app)
// ---------------------------------------------------------------------------

export const DATASET_TEMPLATES: Record<string, DatasetConfig> = {
  'hermes-knowledge': {
    app: 'hermes',
    description: 'Hermes Agent knowledge base — skills, prompts, TREE.md',
    chunkingStrategy: 'heading',
  },
  'hermes-memory': {
    app: 'hermes',
    lead: 'memory',
    description: 'Hermes session working memory',
    chunkingStrategy: 'sentence',
  },
  'monorepo-docs': {
    app: 'monorepo',
    description: 'Monorepo SPECs, AGENTS.md, documentation',
    chunkingStrategy: 'heading',
  },
  'hvacr-knowledge': {
    app: 'hvacr',
    description: 'HVAC-R swarm documentation',
    chunkingStrategy: 'heading',
  },
  'governance': {
    app: 'ops',
    lead: 'governance',
    description: 'AI governance — PORTS.md, SUBDOMAINS.md, NETWORK_MAP.md',
    chunkingStrategy: 'heading',
  },
  'pgadmin': {
    app: 'pgadmin',
    description: 'PostgreSQL admin knowledge — schemas, queries, best practices',
    chunkingStrategy: 'sentence',
  },
  'qdrant': {
    app: 'qdrant',
    description: 'Qdrant vector DB knowledge — collections, indexing, search',
    chunkingStrategy: 'heading',
  },
};

// ---------------------------------------------------------------------------
// Hermes Execution Guide
// ---------------------------------------------------------------------------

/**
 * How Hermes should use this skill when invoked:
 *
 * 1. IDENTIFY dimension — extract app/lead from conversation context
 *    - "organizar instância do painel" → app="painel"
 *    - "knowledge base do hvacr" → app="hvacr"
 *    - "contexto do lead alfa" → app + lead="alfa"
 *
 * 2. RESOLVE dataset name — use buildDatasetName(config)
 *    - Check if dataset already exists via /api/v1/datasets
 *
 * 3. CREATE if missing — call createDataset()
 *
 * 4. INDEX documents — call indexDocument() with relevant docs
 *    - Docs from: hermes-second-brain/, monorepo/docs/, /srv/ops/ai-governance/
 *
 * 5. RETRIEVE on query — call ragSearch() or ragRetrieve() to inject context
 *
 * 6. ORGANIZE by lead if needed — suffix lead dimension to dataset name
 *    - e.g. "painel-lead-alfa-knowledge" for lead-specific knowledge
 *
 * ========================================================================
 * POSTGRESQL (pgadmin) ORGANIZATION
 * ========================================================================
 * For PostgreSQL instances organized by app/lead:
 *
 * Dataset pattern: pgadmin-{app}[-{lead}]-schema
 * Example: pgadmin-hermes-will-schema
 *
 * Hermes should know:
 * - Each app/lead gets its own Postgres schema: {app}_{lead}? (e.g. hermes_will)
 * - Connection via: pgadmin.zappro.site (:4050)
 * - Qdrant collections are separate from Trieve datasets
 *   - Qdrant: agency_* collections (hermes-agency) — see qdrant/client.ts
 *   - Trieve: app-specific datasets (RAG) — separate collection namespace
 *
 * ========================================================================
 * QDRANT ORGANIZATION
 * ========================================================================
 * Qdrant is used for:
 * - agency_* collections (Hermes Agency Suite) — see qdrant/client.ts
 * - NOT for Trieve RAG (Trieve manages its own Qdrant collection internally)
 *
 * Trieve datasets → separate from Qdrant agency collections
 * Trieve creates its own Qdrant collection internally (configured at deploy)
 *
 * If you need to organize Qdrant collections by app/lead:
 * - Pattern: {app}[_{lead}]_collection
 * - Example: hermes_will_clients, painel_alfa_campaigns
 * - Use qdrant/client.ts COLLECTIONS constant + suffix pattern
 */

// ---------------------------------------------------------------------------
// Validation at module load
// ---------------------------------------------------------------------------

const _skill = RAG_INSTANCE_ORGANIZER;
console.log(`[skills] Loaded: ${_skill.id} — ${_skill.tools.length} tools, ${_skill.triggers.length} triggers`);
