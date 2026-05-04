/**
 * Hermes Second Brain (Mem0 + Qdrant) HTTP client
 * Replaces legacy Trieve RAG integration
 */

const HERMES_API_URL = process.env['HERMES_API_URL'] ?? 'http://localhost:8642';
const QDRANT_URL = process.env['QDRANT_URL'] ?? 'http://localhost:6333';
const QDRANT_API_KEY = process.env['QDRANT_API_KEY'] ?? '';

// ── Hermes API Helper ──────────────────────────────────────────────────────────

async function hermesRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
	const url = `${HERMES_API_URL}${path}`;
	const res = await fetch(url, {
		...options,
		headers: {
			'Content-Type': 'application/json',
			...options.headers,
		},
	});

	if (!res.ok) {
		const text = await res.text();
		throw new Error(`Hermes request failed (${res.status}): ${text}`);
	}

	return res.json() as Promise<T>;
}

// ── Qdrant Helper (for collections list) ───────────────────────────────────────

async function qdrantRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
	const url = `${QDRANT_URL}${path}`;
	const res = await fetch(url, {
		...options,
		headers: {
			'Content-Type': 'application/json',
			...(QDRANT_API_KEY ? { 'api-key': QDRANT_API_KEY } : {}),
			...options.headers,
		},
	});

	if (!res.ok) {
		const text = await res.text();
		throw new Error(`Qdrant request failed (${res.status}): ${text}`);
	}

	return res.json() as Promise<T>;
}

// ── Types ──────────────────────────────────────────────────────────────────────

export interface QdrantCollection {
	name: string;
}

export interface MemoryResult {
	id: string;
	memory: string;
	tags?: string[];
	metadata?: Record<string, unknown>;
	score?: number;
}

export interface HermesSearchResponse {
	results: MemoryResult[];
}

export interface HermesSaveInput {
	text: string;
	tags?: string[];
	source?: string;
	agent_id?: string;
	run_id?: string;
}

export interface HermesSaveResponse {
	success: boolean;
	memory: unknown;
}

// ── Collections ────────────────────────────────────────────────────────────────

export async function listQdrantCollections(): Promise<QdrantCollection[]> {
	const data = await qdrantRequest<{ result: { collections: { name: string }[] } }>('/collections');
	return data.result.collections.map((c) => ({ name: c.name }));
}

// ── Search ─────────────────────────────────────────────────────────────────────

export async function searchMemories(
	query: string,
	limit = 5,
	agent_id?: string,
	run_id?: string,
): Promise<MemoryResult[]> {
	const data = await hermesRequest<HermesSearchResponse>('/memory/query', {
		method: 'POST',
		body: JSON.stringify({ query, limit, agent_id, run_id }),
	});
	return data.results;
}

// ── Save ───────────────────────────────────────────────────────────────────────

export async function saveMemory(input: HermesSaveInput): Promise<HermesSaveResponse> {
	return hermesRequest<HermesSaveResponse>('/memory/', {
		method: 'POST',
		body: JSON.stringify(input),
	});
}

// ── Health ─────────────────────────────────────────────────────────────────────

export async function hermesHealth(): Promise<{ status: string; service: string }> {
	return hermesRequest<{ status: string; service: string }>('/health');
}
