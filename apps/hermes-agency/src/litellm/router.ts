// Anti-hardcoded: all config via process.env
// LLM Chain Router — TEXT ONLY
// PRIMARY ONLY: minimax-m2.7 (premium, plano 50$)
// Ollama is NOT used for text — only for Vision (qwen2.5vl:7b) and STT (whisper-1)
// See bot.ts for Vision/STT which use Ollama directly

const MINIMAX_API_KEY = process.env['MINIMAX_API_KEY'] ?? '';

const PRIMARY_MODEL = {
  model: 'minimax-m2.7',
  provider: 'minimax',
  costPer1K: 0.1,
  isLocal: false,
  url: 'https://api.minimax.io/anthropic/v1/messages',
};

export interface LLMResponse {
  content: string;
  model: string;
  provider: string;
  latencyMs: number;
  cached: boolean;
}

export interface LLMRequest {
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[];
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
}

/**
 * MiniMax PRIMARY — for ALL text tasks.
 * Ollama is NEVER used for text fallback (only Vision + STT).
 */
export async function llmComplete(req: LLMRequest): Promise<LLMResponse> {
  const start = Date.now();

  if (!MINIMAX_API_KEY?.trim()) {
    throw new Error('MINIMAX_API_KEY not set — cannot route text requests');
  }

  const response = await callMinimax(PRIMARY_MODEL, req);
  return { ...response, latencyMs: Date.now() - start };
}

async function callMinimax(
  llm: { model: string; url: string },
  req: LLMRequest,
): Promise<Omit<LLMResponse, 'latencyMs'>> {
  const messages = [
    ...(req.systemPrompt ? [{ role: 'system' as const, content: req.systemPrompt }] : []),
    ...req.messages,
  ];

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${MINIMAX_API_KEY}`,
  };

  const response = await fetch(llm.url, {
    method: 'POST',
    headers,
    signal: AbortSignal.timeout(60000),
    body: JSON.stringify({
      model: llm.model,
      messages,
      max_tokens: req.maxTokens ?? 2048,
      temperature: req.temperature ?? 0.7,
    }),
  });

  if (!response.ok) {
    throw new Error(`Minimax ${llm.model} returned ${response.status}`);
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };

  const content = data.choices?.[0]?.message?.content ?? '';
  return { content, model: llm.model, provider: 'minimax', cached: false };
}
