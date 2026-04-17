// Anti-hardcoded: all config via process.env
// LiteLLM-compatible Fallback Chain Router
// Chain: qwen2.5vl:7b (Ollama direct) → llama3-ptbr (Ollama direct) → gemini-2.0-flash (cloud) → minimax-m2.7 (emergency only)

const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://localhost:11434';
const GEMINI_URL = process.env.GEMINI_URL ?? 'https://api.gemini.com/v1beta/chat/completions';
const LLM_KEY = process.env.LITELLM_MASTER_KEY ?? '';
const EMERGENCY_LLM_KEY = process.env.MINIMAX_API_KEY ?? '';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? '';

// Fallback chain — qwen2.5vl local → llama3-ptbr local → gemini cloud → minimax emergency
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
  {
    model: 'gemini-2.0-flash',
    provider: 'gemini',
    costPer1K: 0.05,
    isLocal: false,
    url: GEMINI_URL,
  },
];

const EMERGENCY_MODEL = {
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

export async function llmComplete(req: LLMRequest): Promise<LLMResponse> {
  const start = Date.now();

  for (const llm of FALLBACK_CHAIN) {
    try {
      const response = await callLLM(llm, req, false);
      return { ...response, latencyMs: Date.now() - start };
    } catch (err) {
      console.warn(`[Fallback] ${llm.model} failed:`, err);
      continue;
    }
  }

  // Emergency fallback — minimax (only if both local and cloud failed)
  if (EMERGENCY_LLM_KEY) {
    try {
      const response = await callLLM(EMERGENCY_MODEL, req, true);
      console.warn('[Fallback] Using emergency minimax-m2.7 — both Ollama and Gemini failed');
      return { ...response, latencyMs: Date.now() - start };
    } catch (err) {
      console.error('[Fallback] Emergency model also failed:', err);
    }
  }

  throw new Error('All LLM providers failed');
}

async function callLLM(
  llm: { model: string; provider: string; url: string },
  req: LLMRequest,
  isEmergency: boolean,
): Promise<Omit<LLMResponse, 'latencyMs'>> {
  const messages = [
    ...(req.systemPrompt ? [{ role: 'system' as const, content: req.systemPrompt }] : []),
    ...req.messages,
  ];

  if (llm.provider === 'ollama') {
    return callOllama(llm.model, messages, req.maxTokens, req.temperature);
  }

  // Cloud providers (gemini, minimax) — OpenAI-compatible
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (isEmergency) {
    headers['Authorization'] = `Bearer ${EMERGENCY_LLM_KEY}`;
  } else if (llm.provider === 'gemini' && GEMINI_API_KEY) {
    headers['Authorization'] = `Bearer ${GEMINI_API_KEY}`;
  } else {
    headers['Authorization'] = `Bearer ${LLM_KEY}`;
  }

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
