#!/usr/bin/env npx tsx
// RAG Knowledge Base Search
// Usage: npx tsx scripts/rag-search.ts --query "search text" [--dataset name] [--limit 5] [--json]
// Environment: TRIEVE_URL, TRIEVE_API_KEY, OLLAMA_URL (default: http://localhost:11434)

import { parseArgs } from 'node:util';

const EMBEDDING_MODEL = 'nomic-embed-text';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SearchResult {
	id: string;
	content: string;
	metadata: Record<string, unknown>;
	score: number;
	source?: string;
	heading?: string;
}

interface SearchOptions {
	query: string;
	dataset?: string;
	limit: number;
	json: boolean;
}

// ---------------------------------------------------------------------------
// CLI Argument Parsing
// ---------------------------------------------------------------------------

function parseCliArgs(): SearchOptions {
	const { values } = parseArgs({
		options: {
			query: { type: 'string', short: 'q' },
			dataset: { type: 'string', short: 'd' },
			limit: { type: 'string', short: 'l', default: '5' },
			json: { type: 'boolean', default: false },
		},
	});

	if (!values.query) {
		console.error('Error: --query is required');
		console.error(
			'Usage: npx tsx scripts/rag-search.ts --query "search text" [--dataset name] [--limit 5] [--json]',
		);
		process.exit(1);
	}

	return {
		query: values.query,
		dataset: values.dataset,
		limit: parseInt(values.limit, 10) || 5,
		json: values.json,
	};
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
		console.error(`[error] Failed to embed query: ${err}`);
		process.exit(1);
	}
}

// ---------------------------------------------------------------------------
// Trieve Hybrid Search
// ---------------------------------------------------------------------------

async function searchTrieve(
	trieveUrl: string,
	apiKey: string | undefined,
	datasetId: string,
	queryEmbedding: number[],
	limit: number,
): Promise<SearchResult[]> {
	const url = `${trieveUrl}/api/v1/chunks/search`;

	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
		'TR-Dataset': datasetId,
	};
	if (apiKey) headers.Authorization = `ApiKey ${apiKey}`;

	const body = {
		embedding: queryEmbedding,
		limit,
		highlightThreshold: 0.5,
		hybridOptions: {
			full_text_weight: 0.5,
			vector_weight: 0.5,
		},
	};

	const response = await fetch(url, {
		method: 'POST',
		headers,
		body: JSON.stringify(body),
	});

	if (!response.ok) {
		throw new Error(`Trieve search failed: ${response.statusText} - ${await response.text()}`);
	}

	const data = (await response.json()) as {
		results: Array<{
			id: string;
			chunk_html: string;
			metadata: Record<string, unknown>;
			score: number;
		}>;
	};

	return (data.results || []).map((result) => ({
		id: result.id,
		content: result.chunk_html,
		metadata: result.metadata || {},
		score: result.score,
		source: result.metadata?.source as string | undefined,
		heading: result.metadata?.heading as string | undefined,
	}));
}

// ---------------------------------------------------------------------------
// Find Dataset by Name
// ---------------------------------------------------------------------------

async function findDatasetId(
	trieveUrl: string,
	apiKey: string | undefined,
	datasetName: string,
): Promise<string | null> {
	const headers: Record<string, string> = {};
	if (apiKey) headers.Authorization = `ApiKey ${apiKey}`;

	const response = await fetch(`${trieveUrl}/api/v1/datasets`, { headers });

	if (!response.ok) {
		console.error(`[error] Failed to list datasets: ${response.statusText}`);
		return null;
	}

	const datasets = (await response.json()) as Array<{ id: string; name: string }>;
	const dataset = datasets.find((d) => d.name === datasetName);

	return dataset?.id ?? null;
}

// ---------------------------------------------------------------------------
// Output Formatting
// ---------------------------------------------------------------------------

function formatResults(results: SearchResult[]): void {
	const divider = '─'.repeat(60);

	results.forEach((result, index) => {
		console.log(`\n${divider}`);
		console.log(`Result ${index + 1} | Score: ${result.score.toFixed(4)}`);

		if (result.heading) {
			console.log(`Heading: ${result.heading}`);
		}
		if (result.source) {
			console.log(`Source: ${result.source}`);
		}

		console.log(divider);
		// Truncate very long content for display
		const content =
			result.content.length > 800 ? `${result.content.slice(0, 800)}...` : result.content;
		console.log(content);

		if (Object.keys(result.metadata).length > 0) {
			console.log(`\nMetadata: ${JSON.stringify(result.metadata, null, 2)}`);
		}
	});
}

function outputJson(results: SearchResult[]): void {
	const output = {
		query: opts.query,
		count: results.length,
		results: results.map((r) => ({
			id: r.id,
			content: r.content,
			metadata: r.metadata,
			score: r.score,
			source: r.source,
			heading: r.heading,
		})),
	};
	console.log(JSON.stringify(output, null, 2));
}

// ---------------------------------------------------------------------------
// Main Search Logic
// ---------------------------------------------------------------------------

async function runSearch(opts: SearchOptions): Promise<void> {
	const { query, dataset, limit, json } = opts;

	const trieveUrl = process.env.TRIEVE_URL ?? 'http://localhost:6435';
	const ollamaUrl = process.env.OLLAMA_URL ?? 'http://localhost:11434';
	const apiKey = process.env.TRIEVE_API_KEY;

	console.log(`\n=== RAG Search ===`);
	console.log(`Query: ${query}`);
	console.log(`Dataset: ${dataset ?? '(default)'}`);
	console.log(`Limit: ${limit}`);
	console.log(`Trieve: ${trieveUrl} | Ollama: ${ollamaUrl}`);
	console.log('='.repeat(40));

	// Step 1: Resolve dataset ID
	let datasetId: string;

	if (dataset) {
		const resolvedId = await findDatasetId(trieveUrl, apiKey, dataset);
		if (!resolvedId) {
			console.error(`[error] Dataset not found: ${dataset}`);
			process.exit(1);
		}
		datasetId = resolvedId;
	} else {
		// Use first available dataset
		const headers: Record<string, string> = {};
		if (apiKey) headers.Authorization = `ApiKey ${apiKey}`;

		const listRes = await fetch(`${trieveUrl}/api/v1/datasets`, { headers });
		if (!listRes.ok) {
			console.error(`[error] Failed to list datasets: ${listRes.statusText}`);
			process.exit(1);
		}

		const datasets = (await listRes.json()) as Array<{ id: string; name: string }>;
		if (datasets.length === 0) {
			console.error('[error] No datasets available');
			process.exit(1);
		}

		datasetId = datasets[0].id;
		console.log(`[info] Using dataset: ${datasets[0].name} (${datasetId})`);
	}

	// Step 2: Embed query
	console.log(`\n[1/2] Embedding query via Ollama (${EMBEDDING_MODEL})...`);
	const queryEmbedding = await embedText(query, ollamaUrl);

	if (queryEmbedding.length === 0) {
		console.error('[error] Failed to generate embedding for query');
		process.exit(1);
	}
	console.log(`[1/2] Embedding generated (${queryEmbedding.length} dimensions)`);

	// Step 3: Search Trieve
	console.log(`\n[2/2] Searching Trieve...`);
	const results = await searchTrieve(trieveUrl, apiKey, datasetId, queryEmbedding, limit);

	if (results.length === 0) {
		console.log('\n[info] No results found');
		return;
	}

	console.log(`[2/2] Found ${results.length} result(s)`);

	// Output
	if (json) {
		outputJson(results);
	} else {
		formatResults(results);
	}
}

// ---------------------------------------------------------------------------
// Entry Point
// ---------------------------------------------------------------------------

const opts = parseCliArgs();
runSearch(opts).catch((err) => {
	console.error('[fatal]', err);
	process.exit(1);
});
