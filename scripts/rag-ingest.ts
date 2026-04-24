#!/usr/bin/env npx tsx
// RAG Knowledge Ingestion Pipeline
// Usage: npx tsx scripts/rag-ingest.ts --app hermes --lead will
// Environment: TRIEVE_URL, TRIEVE_API_KEY, OLLAMA_URL (default: http://localhost:11434)

import { parseArgs } from 'util';

const BULK_LIMIT = 120;
const EMBEDDING_MODEL = 'nomic-embed-text';
const EMBEDDING_DIM = 768;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Chunk {
  content: string;
  metadata: Record<string, string | number | boolean>;
}

interface IngestOptions {
  app: string;
  lead?: string;
  type?: 'knowledge' | 'memory' | 'context';
  chunking?: 'heading' | 'sentence' | 'page';
  dryRun?: boolean;
  force?: boolean;
}

// ---------------------------------------------------------------------------
// Knowledge Sources — directory mapping per app
// ---------------------------------------------------------------------------

const KNOWLEDGE_SOURCES: Record<string, string[]> = {
  hermes: [
    'hermes-second-brain/',
  ],
  monorepo: [
    'docs/',
    'SPECS/',
    'apps/*/src/',
  ],
  hvacr: [
    'apps/hvacr/',
  ],
  governance: [
    '/srv/ops/ai-governance/',
  ],
  pgadmin: [
    'docs/database/',
  ],
  qdrant: [
    'docs/vector/',
  ],
};

// ---------------------------------------------------------------------------
// CLI Argument Parsing
// ---------------------------------------------------------------------------

function parseCliArgs(): IngestOptions {
  const { values } = parseArgs({
    options: {
      app: { type: 'string', short: 'a' },
      lead: { type: 'string', short: 'l' },
      type: { type: 'string', short: 't', default: 'knowledge' },
      chunking: { type: 'string', short: 'c', default: 'heading' },
      'dry-run': { type: 'boolean', default: false },
      force: { type: 'boolean', default: false },
    },
  });

  if (!values.app) {
    console.error('Error: --app is required');
    console.error('Usage: npx tsx scripts/rag-ingest.ts --app <app> [--lead <lead>] [--type knowledge|memory|context]');
    process.exit(1);
  }

  return {
    app: values.app,
    lead: values.lead,
    type: (values.type as 'knowledge' | 'memory' | 'context') || 'knowledge',
    chunking: (values.chunking as 'heading' | 'sentence' | 'page') || 'heading',
    dryRun: values['dry-run'],
    force: values.force,
  };
}

// ---------------------------------------------------------------------------
// File System Utilities
// ---------------------------------------------------------------------------

async function* walkDirectory(dir: string, extensions = ['.md', '.txt', '.ts', '.tsx', '.yaml', '.yml', '.json']): AsyncGenerator<string> {
  const fs = await import('fs');
  const path = await import('path');

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        // Skip node_modules, .git, dist, build
        if (!['node_modules', '.git', 'dist', 'build', '.claude', '.cache'].includes(entry.name)) {
          yield* walkDirectory(fullPath, extensions);
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (extensions.includes(ext)) {
          yield fullPath;
        }
      }
    }
  } catch {
    // Directory may not exist or be readable
  }
}

// ---------------------------------------------------------------------------
// Content Chunking Strategies
// ---------------------------------------------------------------------------

function chunkByHeading(content: string, metadata: Record<string, string | number | boolean>): Chunk[] {
  const chunks: Chunk[] = [];
  const lines = content.split('\n');
  let currentChunk: string[] = [];
  let currentHeading = '';

  for (const line of lines) {
    // Detect headings (markdown # syntax)
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      // Save previous chunk if non-empty
      if (currentChunk.length > 0) {
        chunks.push({
          content: currentChunk.join('\n').trim(),
          metadata: { ...metadata, heading: currentHeading, chunk_type: 'heading' },
        });
        currentChunk = [];
      }
      currentHeading = headingMatch[2];
    }
    currentChunk.push(line);
  }

  // Don't forget the last chunk
  if (currentChunk.length > 0) {
    chunks.push({
      content: currentChunk.join('\n').trim(),
      metadata: { ...metadata, heading: currentHeading, chunk_type: 'heading' },
    });
  }

  return chunks;
}

function chunkBySentence(content: string, metadata: Record<string, string | number | boolean>): Chunk[] {
  // Split by sentence-ending punctuation followed by space or end
  const sentences = content.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 20);
  return sentences.map(sentence => ({
    content: sentence.trim(),
    metadata: { ...metadata, chunk_type: 'sentence' },
  }));
}

function chunkByPage(content: string, metadata: Record<string, string | number | boolean>, pageSize = 500): Chunk[] {
  const words = content.split(/\s+/);
  const chunks: Chunk[] = [];

  for (let i = 0; i < words.length; i += pageSize) {
    const pageWords = words.slice(i, i + pageSize);
    chunks.push({
      content: pageWords.join(' '),
      metadata: { ...metadata, page: Math.floor(i / pageSize) + 1, chunk_type: 'page' },
    });
  }

  return chunks;
}

function chunkContent(content: string, strategy: 'heading' | 'sentence' | 'page', metadata: Record<string, string | number | boolean>): Chunk[] {
  switch (strategy) {
    case 'heading':
      return chunkByHeading(content, metadata);
    case 'sentence':
      return chunkBySentence(content, metadata);
    case 'page':
      return chunkByPage(content, metadata);
    default:
      return [{ content, metadata: { ...metadata, chunk_type: 'raw' } }];
  }
}

// ---------------------------------------------------------------------------
// Ollama Embedding
// ---------------------------------------------------------------------------

async function embedText(text: string, ollamaUrl: string): Promise<number[]> {
  try {
    const response = await fetch(`${ollamaUrl}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: EMBEDDING_MODEL, input: text }),
    });

    if (!response.ok) {
      throw new Error(`Ollama embed failed: ${response.statusText}`);
    }

    const data = (await response.json()) as { embeddings: number[][] };
    return data.embeddings?.[0] ?? [];
  } catch (err) {
    console.error(`[embed] Error embedding text: ${err}`);
    return [];
  }
}

async function embedChunks(chunks: Chunk[], ollamaUrl: string): Promise<Map<string, number[]>> {
  const embeddings = new Map<string, number[]>();

  console.log(`[embed] Embedding ${chunks.length} chunks with ${EMBEDDING_MODEL}...`);

  // Embed in batches to avoid overwhelming Ollama
  const batchSize = 10;
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    const texts = batch.map(c => c.content);

    try {
      const response = await fetch(`${ollamaUrl}/api/embed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: EMBEDDING_MODEL, input: texts }),
      });

      if (!response.ok) {
        throw new Error(`Batch embed failed: ${response.statusText}`);
      }

      const data = (await response.json()) as { embeddings: number[][] };
      batch.forEach((chunk, idx) => {
        embeddings.set(chunk.content, data.embeddings?.[idx] ?? []);
      });
    } catch (err) {
      console.error(`[embed] Batch error at ${i}: ${err}`);
      // Fallback: embed individually
      for (const chunk of batch) {
        const embedding = await embedText(chunk.content, ollamaUrl);
        embeddings.set(chunk.content, embedding);
      }
    }

    // Progress indicator
    process.stdout.write(`\r[embed] Progress: ${Math.min(i + batchSize, chunks.length)}/${chunks.length}`);
  }
  console.log(); // newline after progress

  return embeddings;
}

// ---------------------------------------------------------------------------
// Trieve API
// ---------------------------------------------------------------------------

async function getOrCreateDataset(
  trieveUrl: string,
  apiKey: string | undefined,
  name: string,
  description: string,
): Promise<string | null> {
  // First, try to find existing dataset
  const listRes = await fetch(`${trieveUrl}/api/v1/datasets`, {
    headers: { Authorization: apiKey ? `ApiKey ${apiKey}` : '' },
  });

  if (listRes.ok) {
    const datasets = (await listRes.json()) as Array<{ id: string; name: string }>;
    const existing = datasets.find(d => d.name === name);
    if (existing) {
      console.log(`[trieve] Using existing dataset: ${name} (${existing.id})`);
      return existing.id;
    }
  }

  // Create new dataset
  const createRes = await fetch(`${trieveUrl}/api/v1/datasets`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `ApiKey ${apiKey}` } : {}),
    },
    body: JSON.stringify({ name, description }),
  });

  if (!createRes.ok) {
    console.error(`[trieve] Failed to create dataset: ${await createRes.text()}`);
    return null;
  }

  const data = (await createRes.json()) as { id: string; name: string };
  console.log(`[trieve] Created dataset: ${data.name} (${data.id})`);
  return data.id;
}

async function indexChunks(
  trieveUrl: string,
  apiKey: string | undefined,
  datasetId: string,
  chunks: Chunk[],
): Promise<boolean> {
  const url = `${trieveUrl}/api/v1/chunks`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'TR-Dataset': datasetId,
  };
  if (apiKey) headers['Authorization'] = `ApiKey ${apiKey}`;

  // Bulk limit: 120 chunks per request
  for (let i = 0; i < chunks.length; i += BULK_LIMIT) {
    const batch = chunks.slice(i, i + BULK_LIMIT);
    const payload = {
      chunks: batch.map(chunk => ({
        chunk_html: chunk.content,
        metadata: chunk.metadata,
        tag_set: chunk.metadata['type'] as string ?? 'general',
      })),
    };

    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(payload) });

    if (!res.ok) {
      console.error(`[trieve] Failed to index batch: ${await res.text()}`);
      return false;
    }

    console.log(`[trieve] Indexed batch ${Math.floor(i / BULK_LIMIT) + 1}/${Math.ceil(chunks.length / BULK_LIMIT)}`);
  }

  return true;
}

// ---------------------------------------------------------------------------
// Build Dataset Name
// ---------------------------------------------------------------------------

function buildDatasetName(app: string, lead?: string, type = 'knowledge'): string {
  const parts = [app.toLowerCase()];
  if (lead) parts.push(`lead-${lead.toLowerCase()}`);
  parts.push(type);
  return parts.join('-');
}

// ---------------------------------------------------------------------------
// Main Ingestion Pipeline
// ---------------------------------------------------------------------------

async function runIngestion(opts: IngestOptions): Promise<void> {
  const {
    app,
    lead,
    type,
    chunking,
    dryRun,
  } = opts;

  const trieveUrl = process.env['TRIEVE_URL'] ?? 'http://localhost:6435';
  const ollamaUrl = process.env['OLLAMA_URL'] ?? 'http://localhost:11434';
  const apiKey = process.env['TRIEVE_API_KEY'];

  const datasetName = buildDatasetName(app, lead, type);
  console.log(`\n=== RAG Ingestion Pipeline ===`);
  console.log(`App: ${app}${lead ? ` (lead: ${lead})` : ''}`);
  console.log(`Type: ${type} | Chunking: ${chunking}`);
  console.log(`Dataset: ${datasetName}`);
  console.log(`Trieve: ${trieveUrl} | Ollama: ${ollamaUrl}`);
  console.log(`Dry run: ${dryRun}`);
  console.log('='.repeat(40));

  // Step 1: Scan knowledge source directories
  const basePaths = KNOWLEDGE_SOURCES[app] ?? [];
  if (basePaths.length === 0) {
    console.warn(`[warn] No knowledge sources defined for app: ${app}`);
    console.info(`[info] Available apps: ${Object.keys(KNOWLEDGE_SOURCES).join(', ')}`);
    return;
  }

  console.log(`\n[1/4] Scanning ${basePaths.length} knowledge source(s)...`);
  const allFiles: string[] = [];
  const monorepoRoot = process.cwd();

  for (const sourcePath of basePaths) {
    // Resolve relative paths from monorepo root
    const fullPath = sourcePath.startsWith('/')
      ? sourcePath
      : `${monorepoRoot}/${sourcePath}`;

    for await (const file of walkDirectory(fullPath)) {
      allFiles.push(file);
    }
  }

  console.log(`[1/4] Found ${allFiles.length} file(s)`);

  if (allFiles.length === 0) {
    console.warn('[warn] No files found to ingest');
    return;
  }

  if (dryRun) {
    console.log('\n[dry-run] Files that would be processed:');
    allFiles.forEach(f => console.log(`  - ${f}`));
    return;
  }

  // Step 2: Read and chunk content
  console.log(`\n[2/4] Reading and chunking content (strategy: ${chunking})...`);
  const fs = await import('fs');
  const path = await import('path');
  const allChunks: Chunk[] = [];

  for (const file of allFiles) {
    try {
      const content = fs.readFileSync(file, 'utf-8');
      const fileMetadata: Record<string, string | number | boolean> = {
        source: file,
        filename: path.basename(file),
        type: path.extname(file).slice(1) || 'text',
      };

      const chunks = chunkContent(content, chunking, fileMetadata);
      allChunks.push(...chunks);
    } catch (err) {
      console.error(`[warn] Could not read ${file}: ${err}`);
    }
  }

  console.log(`[2/4] Generated ${allChunks.length} chunk(s)`);

  if (allChunks.length === 0) {
    console.warn('[warn] No content to index');
    return;
  }

  // Step 3: Embed via Ollama
  console.log(`\n[3/4] Embedding chunks via Ollama (${EMBEDDING_MODEL})...`);
  const embeddings = await embedChunks(allChunks, ollamaUrl);
  console.log(`[3/4] Embedding complete (${embeddings.size} vectors)`);

  // Step 4: Index into Trieve
  console.log(`\n[4/4] Indexing into Trieve dataset: ${datasetName}...`);
  const datasetId = await getOrCreateDataset(trieveUrl, apiKey, datasetName, `${app} ${type} dataset`);

  if (!datasetId) {
    console.error('[error] Could not get or create dataset');
    process.exit(1);
  }

  const success = await indexChunks(trieveUrl, apiKey, datasetId, allChunks);

  if (success) {
    console.log(`\n=== Ingestion Complete ===`);
    console.log(`Dataset: ${datasetName} (${datasetId})`);
    console.log(`Total chunks: ${allChunks.length}`);
    console.log(`=========================`);
  } else {
    console.error('\n[error] Ingestion failed');
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Entry Point
// ---------------------------------------------------------------------------

const opts = parseCliArgs();
runIngestion(opts).catch(err => {
  console.error('[fatal]', err);
  process.exit(1);
});
