// Anti-hardcoded: all config via process.env
// LLM Chain Router
// PRIMARY: minimax-m2.7 (premium, plano 50$)
// FALLBACK: qwen2.5vl (local, multimodal) → llama3-ptbr (local, PT-BR)

const OLLAMA_URL = process.env['OLLAMA_URL'] ?? 'http://localhost:11434';
const MINIMAX_API_KEY = process.env['MINIMAX_API_KEY'] ?? '';

// Primary — minimax premium (plano 50$)
const PRIMARY_MODEL = {
  model: 'minimax-m2.7',
  provider: 'minimax',
  costPer1K: 0.1,
  isLocal: false,
  url: 'https://api.minimax.io/anthropic/v1/messages',
};

// Fallback chain — Ollama local models
const FALLBACK_CHAIN = [
  {
    model: 'qwen2.5vl:7b',
    provider: 'ollama',
    costPer1K: 0,
    isLocal: true,
    url: `${OLLAMA_URL}/api/chat`,
  },
  {
    model: 'llama3-portuguese-tomcat-8b-instruct-q8:latest',
    provider: 'ollama',
    costPer1K: 0,
    isLocal: true,
    url: `${OLLAMA_URL}/api/chat`,
  },
];

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

export async function llmComplete(req: LLMRequest): Promise<LLMResponse> {
  const start = Date.now();

  // Try PRIMARY first — minimax premium (plano 50$)
  if (MINIMAX_API_KEY) {
    try {
      const response = await callLLM(PRIMARY_MODEL, req, true);
      return { ...response, latencyMs: Date.now() - start };
    } catch (err) {
      console.warn(`[LLM] minimax-m2.7 primary failed:`, err);
    }
  }

  // Fallback — Ollama local models
  for (const llm of FALLBACK_CHAIN) {
    try {
      const response = await callLLM(llm, req, false);
      return { ...response, latencyMs: Date.now() - start };
    } catch (err) {
      console.warn(`[LLM] ${llm.model} fallback failed:`, err);
      continue;
    }
  }

  throw new Error('All LLM providers failed');
}

async function callLLM(
  llm: { model: string; provider: string; url: string },
  req: LLMRequest,
  _isPrimary: boolean,
): Promise<Omit<LLMResponse, 'latencyMs'>> {
  const messages = [
    ...(req.systemPrompt ? [{ role: 'system' as const, content: req.systemPrompt }] : []),
    ...req.messages,
  ];

  if (llm.provider === 'ollama') {
    return callOllama(llm.model, messages, req.maxTokens, req.temperature);
  }

  // Cloud provider (minimax)
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
    throw new Error(`LLM ${llm.model} returned ${response.status}`);
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };

  const content = data.choices?.[0]?.message?.content ?? '';
  return { content, model: llm.model, provider: llm.provider, cached: false };
}

async function callOllama(
  model: string,
  messages: { role: string; content: string }[],
  maxTokens?: number,
  temperature?: number,
): Promise<Omit<LLMResponse, 'latencyMs'>> {
  const response = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(60000),
    body: JSON.stringify({
      model,
      messages,
      stream: false,
      options: {
        num_predict: maxTokens ?? 2048,
        temperature: temperature ?? 0.7,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama ${model} returned ${response.status}`);
  }

  const data = (await response.json()) as { message?: { content?: string } };
  const content = data.message?.content ?? '';
  return { content, model, provider: 'ollama', cached: false };
}
