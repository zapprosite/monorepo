/**
 * HVAC RAG Pipe Client — HTTP proxy to hvac_rag_pipe.py (:4017)
 *
 * Translates the Fastify body into an OpenAI-compatible
 * /v1/chat/completions request and unwraps the response.
 */

/** Base URL of the HVAC RAG Pipe (FastAPI, port 4017). */
const HVAC_PIPE_URL = process.env.HVAC_PIPE_URL ?? 'http://127.0.0.1:4017';

/** LiteLLM API key forwarded to the pipe (it uses this to call upstream LLM). */
const HVAC_PIPE_TIMEOUT_MS = Number(process.env.HVAC_PIPE_TIMEOUT_MS ?? 30_000);

export interface HvacQueryInput {
	query: string;
	brand?: string;
	session_id?: string;
	model?: string;
}

export interface HvacQueryResult {
	answer: string;
	evidence_level: string;
	source: string;
	session_id: string;
	model?: string;
}

export interface HvacHealthResult {
	status: string;
	service?: string;
	version?: string;
	error?: string;
}

/**
 * Call hvac_rag_pipe.py /v1/chat/completions and return a structured result.
 *
 * Maps the OpenAI-compatible response back to the simplified HvacQueryResult
 * so the REST consumer (Open WebUI Tool / frontend) gets a clean payload.
 */
export async function callHvacPipe(input: HvacQueryInput): Promise<HvacQueryResult> {
	const sessionId = input.session_id ?? `api-${Date.now()}`;
	const modelName = input.model ?? 'zappro-clima-tutor';

	// Build an OpenAI-compatible messages array
	const messages: Array<{ role: string; content: string }> = [];

	// Prepend brand context in the system message when provided
	if (input.brand) {
		messages.push({
			role: 'system',
			content: `Marca do equipamento: ${input.brand}`,
		});
	}

	messages.push({ role: 'user', content: input.query });

	const requestBody = {
		model: modelName,
		messages,
		temperature: 0.3,
		max_tokens: 1024,
		stream: false,
	};

	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), HVAC_PIPE_TIMEOUT_MS);

	try {
		const response = await fetch(`${HVAC_PIPE_URL}/v1/chat/completions`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				// Forward conversation/session info via headers (hvac_rag_pipe reads these)
				'conversation-id': sessionId,
				'user-id': 'openwebui-tool',
			},
			body: JSON.stringify(requestBody),
			signal: controller.signal,
		});

		if (!response.ok) {
			const errorText = await response.text().catch(() => 'unknown error');
			throw new Error(`hvac_rag_pipe error ${response.status}: ${errorText.slice(0, 200)}`);
		}

		const data = (await response.json()) as {
			choices?: Array<{ message?: { content?: string } }>;
			evidence_level?: string;
			model?: string;
			fallback?: boolean;
		};

		const answer = data.choices?.[0]?.message?.content ?? '';
		const evidenceLevel = (data as Record<string, unknown>).evidence_level as string | undefined;
		const isFallback = Boolean(data.fallback);

		return {
			answer,
			evidence_level: evidenceLevel ?? (isFallback ? 'fallback' : 'unknown'),
			source: isFallback ? 'fallback' : 'hvac_rag_pipe',
			session_id: sessionId,
			model: data.model ?? modelName,
		};
	} finally {
		clearTimeout(timeout);
	}
}

/**
 * Health check proxy — forwards GET /health from hvac_rag_pipe.
 */
export async function hvacPipeHealth(): Promise<HvacHealthResult> {
	try {
		const response = await fetch(`${HVAC_PIPE_URL}/health`, {
			method: 'GET',
			signal: AbortSignal.timeout(5_000),
		});

		if (!response.ok) {
			return { status: 'error', error: `http_${response.status}` };
		}

		return (await response.json()) as HvacHealthResult;
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return { status: 'error', error: message };
	}
}
