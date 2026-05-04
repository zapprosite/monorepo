#!/usr/bin/env npx tsx
// RAG Knowledge Base Search (Hermes Second Brain / Mem0 + Qdrant)
// Usage: npx tsx scripts/rag-search.ts --query "search text" [--limit 5] [--json]
// Environment: HERMES_API_URL (default: http://localhost:8642)

import { parseArgs } from 'node:util';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SearchResult {
	id: string;
	content: string;
	metadata: Record<string, unknown>;
	score: number;
	source?: string;
}

interface SearchOptions {
	query: string;
	limit: number;
	json: boolean;
	agent_id?: string;
}

// ---------------------------------------------------------------------------
// CLI Argument Parsing
// ---------------------------------------------------------------------------

function parseCliArgs(): SearchOptions {
	const { values } = parseArgs({
		options: {
			query: { type: 'string', short: 'q' },
			limit: { type: 'string', short: 'l', default: '5' },
			json: { type: 'boolean', default: false },
			'agent-id': { type: 'string', default: 'rag-ingest' },
		},
	});

	if (!values.query) {
		console.error('Error: --query is required');
		console.error(
			'Usage: npx tsx scripts/rag-search.ts --query "search text" [--limit 5] [--json] [--agent-id <id>]',
		);
		process.exit(1);
	}

	return {
		query: values.query,
		limit: parseInt(values.limit, 10) || 5,
		json: values.json,
		agent_id: values['agent-id'] as string,
	};
}

// ---------------------------------------------------------------------------
// Hermes API (Mem0 + Qdrant)
// ---------------------------------------------------------------------------

const HERMES_API_URL = process.env['HERMES_API_URL'] ?? 'http://localhost:8642';

async function searchMemories(
	query: string,
	limit: number,
	agent_id?: string,
): Promise<SearchResult[]> {
	try {
		const response = await fetch(`${HERMES_API_URL}/memory/query`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ query, limit, agent_id }),
		});

		if (!response.ok) {
			throw new Error(`Hermes search failed: ${response.statusText} - ${await response.text()}`);
		}

		const data = (await response.json()) as { results: Array<Record<string, unknown>> };

		return (data.results || []).map((result: any) => ({
			id: result.id ?? 'unknown',
			content: result.memory ?? result.content ?? '',
			metadata: result.metadata ?? {},
			score: result.score ?? 0,
			source: result.metadata?.source as string | undefined,
		}));
	} catch (err) {
		console.error(`[error] Search failed: ${err}`);
		process.exit(1);
	}
}

// ---------------------------------------------------------------------------
// Output Formatting
// ---------------------------------------------------------------------------

function formatResults(results: SearchResult[]): void {
	const divider = '─'.repeat(60);

	results.forEach((result, index) => {
		console.log(`\n${divider}`);
		console.log(`Result ${index + 1} | Score: ${result.score.toFixed(4)}`);

		if (result.source) {
			console.log(`Source: ${result.source}`);
		}

		console.log(divider);
		const content =
			result.content.length > 800 ? `${result.content.slice(0, 800)}...` : result.content;
		console.log(content);

		if (Object.keys(result.metadata).length > 0) {
			console.log(`\nMetadata: ${JSON.stringify(result.metadata, null, 2)}`);
		}
	});
}

function outputJson(query: string, results: SearchResult[]): void {
	const output = {
		query,
		count: results.length,
		results: results.map((r) => ({
			id: r.id,
			content: r.content,
			metadata: r.metadata,
			score: r.score,
			source: r.source,
		})),
	};
	console.log(JSON.stringify(output, null, 2));
}

// ---------------------------------------------------------------------------
// Main Search Logic
// ---------------------------------------------------------------------------

async function runSearch(opts: SearchOptions): Promise<void> {
	const { query, limit, json, agent_id } = opts;

	console.log(`\n=== RAG Search (Hermes Second Brain) ===`);
	console.log(`Query: ${query}`);
	console.log(`Limit: ${limit}`);
	console.log(`Hermes API: ${HERMES_API_URL}`);
	console.log('='.repeat(40));

	console.log(`\n[1/1] Searching memories via Hermes...`);
	const results = await searchMemories(query, limit, agent_id);

	if (results.length === 0) {
		console.log('\n[info] No results found');
		return;
	}

	console.log(`[1/1] Found ${results.length} result(s)`);

	if (json) {
		outputJson(query, results);
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
