#!/usr/bin/env npx tsx
/**
 * Apply Qdrant payload metadata indexes for Brain Refactor
 * Indexes: doc_type, project, service_name, owner, source_path on the `will` collection
 *
 * Usage:
 *   bunx tsx scripts/qdrant-index-metadata.ts
 *   bunx tsx scripts/qdrant-index-metadata.ts --dry-run
 */

import { parseArgs } from 'util';

const QDRANT_URL = process.env['QDRANT_URL'] ?? 'http://localhost:6333';
const QDRANT_API_KEY = process.env['QDRANT_API_KEY'];
if (!QDRANT_API_KEY) throw new Error('QDRANT_API_KEY not set');

const COLLECTION = 'will';
const FIELDS = ['doc_type', 'project', 'service_name', 'owner', 'source_path'];

const HEADERS = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${QDRANT_API_KEY}`,
};

async function fieldIndexExists(fieldName: string): Promise<boolean> {
  const res = await fetch(`${QDRANT_URL}/collections/${COLLECTION}`, { headers: HEADERS });
  if (!res.ok) return false;
  const data = (await res.json()) as {
    result?: { payload_schema?: Record<string, { data_type: string }> };
  };
  const schema = data.result?.payload_schema ?? {};
  return fieldName in schema;
}

async function createIndex(fieldName: string, dryRun: boolean): Promise<boolean> {
  if (dryRun) {
    console.log(`[DRY-RUN] Would create index on '${fieldName}'`);
    return true;
  }

  const exists = await fieldIndexExists(fieldName);
  if (exists) {
    console.log(`[SKIP] Index already exists on '${fieldName}'`);
    return true;
  }

  const res = await fetch(`${QDRANT_URL}/collections/${COLLECTION}/index`, {
    method: 'PUT',
    headers: HEADERS,
    body: JSON.stringify({
      field_name: fieldName,
      field_schema: 'keyword',
    }),
  });

  if (!res.ok) {
    console.error(`[ERROR] Failed to create index on '${fieldName}':`, await res.text());
    return false;
  }

  console.log(`[OK] Created index on '${fieldName}'`);
  return true;
}

async function applyMetadataIndexes(dryRun: boolean): Promise<void> {
  console.log(`[INIT] Applying Qdrant metadata indexes to collection '${COLLECTION}'`);
  console.log(`[INIT] QDRANT_URL: ${QDRANT_URL}`);
  console.log(`[INIT] Dry run: ${dryRun}`);

  const collectionRes = await fetch(`${QDRANT_URL}/collections/${COLLECTION}`, { headers: HEADERS });
  if (!collectionRes.ok) {
    console.error(`[ERROR] Collection '${COLLECTION}' not found`);
    process.exit(1);
  }
  console.log(`[OK] Collection '${COLLECTION}' exists`);

  const results = await Promise.all(FIELDS.map((f) => createIndex(f, dryRun)));

  if (results.every((r) => r)) {
    console.log('[DONE] All indexes applied successfully');
  } else {
    console.error('[ERROR] Some indexes failed');
    process.exit(1);
  }
}

async function main() {
  const { values } = parseArgs({
    options: {
      'dry-run': { type: 'string', default: 'false' },
    },
  });

  const dryRun = values['dry-run'] === 'true';
  await applyMetadataIndexes(dryRun);
}

main().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});
