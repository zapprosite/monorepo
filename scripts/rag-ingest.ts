#!/usr/bin/env npx tsx
// RAG Knowledge Ingestion Pipeline (Hermes Second Brain / Mem0 + Qdrant)
// Usage: npx tsx scripts/rag-ingest.ts --app hermes --lead will
// Environment: HERMES_API_URL (default: http://localhost:8642)

import { parseArgs } from 'node:util';

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
}

// ---------------------------------------------------------------------------
// Knowledge Sources — directory mapping per app
// ---------------------------------------------------------------------------

const KNOWLEDGE_SOURCES: Record<string, string[]> = {
	hce: ['libs/', 'apps/api/context.py', 'services/sync_engine.py'],
	monorepo: ['docs/', 'SPECS/', 'apps/*/src/'],
	hvacr: ['apps/hvacr/'],
	governance: ['/srv/ops/ai-governance/'],
	pgadmin: ['docs/database/'],
	qdrant: ['docs/vector/'],
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
		},
	});

	if (!values.app) {
		console.error('Error: --app is required');
		console.error(
			'Usage: npx tsx scripts/rag-ingest.ts --app <app> [--lead <lead>] [--type knowledge|memory|context]',
		);
		process.exit(1);
	}

	return {
		app: values.app,
		lead: values.lead,
		type: (values.type as 'knowledge' | 'memory' | 'context') || 'knowledge',
		chunking: (values.chunking as 'heading' | 'sentence' | 'page') || 'heading',
		dryRun: values['dry-run'],
	};
}

// ---------------------------------------------------------------------------
// File System Utilities
// ---------------------------------------------------------------------------

async function* walkDirectory(
	dir: string,
	extensions = ['.md', '.txt', '.ts', '.tsx', '.yaml', '.yml', '.json'],
): AsyncGenerator<string> {
	const fs = await import('node:fs');
	const path = await import('node:path');

	try {
		const entries = fs.readdirSync(dir, { withFileTypes: true });

		for (const entry of entries) {
			const fullPath = path.join(dir, entry.name);

			if (entry.isDirectory()) {
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

function chunkByHeading(
	content: string,
	metadata: Record<string, string | number | boolean>,
): Chunk[] {
	const chunks: Chunk[] = [];
	const lines = content.split('\n');
	let currentChunk: string[] = [];
	let currentHeading = '';

	for (const line of lines) {
		const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
		if (headingMatch) {
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

	if (currentChunk.length > 0) {
		chunks.push({
			content: currentChunk.join('\n').trim(),
			metadata: { ...metadata, heading: currentHeading, chunk_type: 'heading' },
		});
	}

	return chunks;
}

function chunkBySentence(
	content: string,
	metadata: Record<string, string | number | boolean>,
): Chunk[] {
	const sentences = content.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 20);
	return sentences.map((sentence) => ({
		content: sentence.trim(),
		metadata: { ...metadata, chunk_type: 'sentence' },
	}));
}

function chunkByPage(
	content: string,
	metadata: Record<string, string | number | boolean>,
	pageSize = 500,
): Chunk[] {
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

function chunkContent(
	content: string,
	strategy: 'heading' | 'sentence' | 'page',
	metadata: Record<string, string | number | boolean>,
): Chunk[] {
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
// Hermes API (Mem0 + Qdrant)
// ---------------------------------------------------------------------------

const HERMES_API_URL = process.env['HERMES_API_URL'] ?? 'http://localhost:8642';

async function saveMemory(
	text: string,
	tags: string[],
	source: string,
	agent_id = 'rag-ingest',
): Promise<boolean> {
	try {
		const response = await fetch(`${HERMES_API_URL}/memory/`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ text, tags, source, agent_id }),
		});

		if (!response.ok) {
			console.error(`[hermes] Failed to save memory: ${response.statusText}`);
			return false;
		}

		return true;
	} catch (err) {
		console.error(`[hermes] Error saving memory: ${err}`);
		return false;
	}
}

// ---------------------------------------------------------------------------
// Main Ingestion Pipeline
// ---------------------------------------------------------------------------

async function runIngestion(opts: IngestOptions): Promise<void> {
	const { app, lead, type, chunking, dryRun } = opts;

	console.log(`\n=== RAG Ingestion Pipeline (Hermes Second Brain) ===`);
	console.log(`App: ${app}${lead ? ` (lead: ${lead})` : ''}`);
	console.log(`Type: ${type} | Chunking: ${chunking}`);
	console.log(`Hermes API: ${HERMES_API_URL}`);
	console.log(`Dry run: ${dryRun}`);
	console.log('='.repeat(40));

	// Step 1: Scan knowledge source directories
	const basePaths = KNOWLEDGE_SOURCES[app] ?? [];
	if (basePaths.length === 0) {
		console.warn(`[warn] No knowledge sources defined for app: ${app}`);
		console.info(`[info] Available apps: ${Object.keys(KNOWLEDGE_SOURCES).join(', ')}`);
		return;
	}

	console.log(`\n[1/3] Scanning ${basePaths.length} knowledge source(s)...`);
	const allFiles: string[] = [];
	const monorepoRoot = process.cwd();

	for (const sourcePath of basePaths) {
		const fullPath = sourcePath.startsWith('/') ? sourcePath : `${monorepoRoot}/${sourcePath}`;
		for await (const file of walkDirectory(fullPath)) {
			allFiles.push(file);
		}
	}

	console.log(`[1/3] Found ${allFiles.length} file(s)`);

	if (allFiles.length === 0) {
		console.warn('[warn] No files found to ingest');
		return;
	}

	if (dryRun) {
		console.log('\n[dry-run] Files that would be processed:');
		allFiles.forEach((f) => console.log(`  - ${f}`));
		return;
	}

	// Step 2: Read and chunk content
	console.log(`\n[2/3] Reading and chunking content (strategy: ${chunking})...`);
	const fs = await import('node:fs');
	const path = await import('node:path');
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

	console.log(`[2/3] Generated ${allChunks.length} chunk(s)`);

	if (allChunks.length === 0) {
		console.warn('[warn] No content to index');
		return;
	}

	// Step 3: Save to Hermes (Mem0 handles embeddings + Qdrant upsert)
	console.log(`\n[3/3] Saving ${allChunks.length} chunks to Hermes Second Brain...`);
	let saved = 0;
	let failed = 0;

	for (let i = 0; i < allChunks.length; i++) {
		const chunk = allChunks[i];
		const tags = [app, type, ...(chunk.metadata.tags as string[] ?? [])];
		const ok = await saveMemory(chunk.content, tags, chunk.metadata.source as string ?? 'rag-ingest');
		if (ok) saved++; else failed++;

		if ((i + 1) % 10 === 0 || i === allChunks.length - 1) {
			process.stdout.write(`\r[3/3] Progress: ${i + 1}/${allChunks.length} (saved: ${saved}, failed: ${failed})`);
		}
	}
	console.log();

	console.log(`\n=== Ingestion Complete ===`);
	console.log(`Total chunks: ${allChunks.length}`);
	console.log(`Saved: ${saved} | Failed: ${failed}`);
	console.log(`=========================`);

	if (failed > 0) {
		process.exit(1);
	}
}

// ---------------------------------------------------------------------------
// Entry Point
// ---------------------------------------------------------------------------

const opts = parseCliArgs();
runIngestion(opts).catch((err) => {
	console.error('[fatal]', err);
	process.exit(1);
});
