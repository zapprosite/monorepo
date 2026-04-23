#!/usr/bin/env npx tsx
// LLM Provider Health Check Script
// Tests each provider, measures latency, verifies response format

interface ProviderResult {
  name: string;
  healthy: boolean;
  latencyMs: number;
  response?: string;
  error?: string;
}

interface TestConfig {
  name: string;
  url: string;
  headers?: Record<string, string>;
  body: Record<string, unknown>;
  timeout: number;
  validateResponse?: (data: unknown) => boolean;
}

const TEST_PROMPT = 'Respond with exactly: "OK" and nothing else.';

const PROVIDERS: TestConfig[] = [
  {
    name: 'MiniMax (via API)',
    url: 'https://api.minimax.io/anthropic/v1/messages',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.MINIMAX_API_KEY ?? ''}`,
    },
    body: {
      model: 'minimax-m2.7',
      messages: [{ role: 'user', content: TEST_PROMPT }],
      max_tokens: 10,
    },
    timeout: 30000,
    validateResponse: (data) => {
      const d = data as { choices?: { message?: { content?: string } }[] };
      return d.choices?.[0]?.message?.content !== undefined;
    },
  },
  {
    name: 'LiteLLM Proxy',
    url: 'http://localhost:4000/v1/messages',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer dummy-key',
    },
    body: {
      model: 'minimax-m2.7',
      messages: [{ role: 'user', content: TEST_PROMPT }],
      max_tokens: 10,
    },
    timeout: 30000,
    validateResponse: (data) => {
      const d = data as { choices?: { message?: { content?: string } }[] };
      return d.choices?.[0]?.message?.content !== undefined;
    },
  },
  {
    name: 'Ollama (Gemma4-12b-it)',
    url: 'http://localhost:11434/api/chat',
    headers: { 'Content-Type': 'application/json' },
    body: {
      model: 'gemma4-12b-it',
      messages: [{ role: 'user', content: TEST_PROMPT }],
      stream: false,
    },
    timeout: 60000,
    validateResponse: (data) => {
      const d = data as { message?: { content?: string } };
      return d.message?.content !== undefined;
    },
  },
  {
    name: 'Ollama (qwen2.5vl:7b)',
    url: 'http://localhost:11434/api/chat',
    headers: { 'Content-Type': 'application/json' },
    body: {
      model: 'qwen2.5vl:7b',
      messages: [{ role: 'user', content: TEST_PROMPT }],
      stream: false,
    },
    timeout: 60000,
    validateResponse: (data) => {
      const d = data as { message?: { content?: string } };
      return d.message?.content !== undefined;
    },
  },
  {
    name: 'Ollama (Embeddings - nomic-embed-text)',
    url: 'http://localhost:11434/api/embeddings',
    headers: { 'Content-Type': 'application/json' },
    body: {
      model: 'nomic-embed-text',
      prompt: TEST_PROMPT,
    },
    timeout: 30000,
    validateResponse: (data) => {
      const d = data as { embedding?: unknown[] };
      return Array.isArray(d.embedding);
    },
  },
  {
    name: 'Groq (via LiteLLM)',
    url: 'http://localhost:4000/v1/messages',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer dummy-key',
    },
    body: {
      model: 'groq/llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: TEST_PROMPT }],
      max_tokens: 10,
    },
    timeout: 30000,
    validateResponse: (data) => {
      const d = data as { choices?: { message?: { content?: string } }[] };
      return d.choices?.[0]?.message?.content !== undefined;
    },
  },
  {
    name: 'OpenAI GPT-4o (via LiteLLM)',
    url: 'http://localhost:4000/v1/messages',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer dummy-key',
    },
    body: {
      model: 'gpt-4o',
      messages: [{ role: 'user', content: TEST_PROMPT }],
      max_tokens: 10,
    },
    timeout: 30000,
    validateResponse: (data) => {
      const d = data as { choices?: { message?: { content?: string } }[] };
      return d.choices?.[0]?.message?.content !== undefined;
    },
  },
];

async function testProvider(config: TestConfig): Promise<ProviderResult> {
  const start = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeout);

    const response = await fetch(config.url, {
      method: 'POST',
      headers: config.headers,
      body: JSON.stringify(config.body),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        name: config.name,
        healthy: false,
        latencyMs: Date.now() - start,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const data = await response.json();

    if (config.validateResponse && !config.validateResponse(data)) {
      return {
        name: config.name,
        healthy: false,
        latencyMs: Date.now() - start,
        error: 'Response format validation failed',
      };
    }

    // Extract response content for display
    let responseText = '';
    if ('choices' in data && data.choices?.[0]?.message?.content) {
      responseText = data.choices[0].message.content;
    } else if ('message' in data && data.message?.content) {
      responseText = data.message.content;
    } else if ('embedding' in data) {
      responseText = `[embedding:${(data as { embedding: unknown[] }).embedding.length}d]`;
    }

    return {
      name: config.name,
      healthy: true,
      latencyMs: Date.now() - start,
      response: responseText,
    };
  } catch (error) {
    const err = error as Error;
    return {
      name: config.name,
      healthy: false,
      latencyMs: Date.now() - start,
      error: err.name === 'AbortError' ? `Timeout after ${config.timeout}ms` : err.message,
    };
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('LLM Provider Health Check');
  console.log('='.repeat(60));
  console.log();

  const results = await Promise.all(PROVIDERS.map(testProvider));

  let healthyCount = 0;
  let unhealthyCount = 0;

  for (const result of results) {
    const status = result.healthy ? '✓ HEALTHY' : '✗ FAILED';
    const latency = result.latencyMs > 0 ? ` ${result.latencyMs}ms` : '';

    console.log(`[${status}]${latency} ${result.name}`);

    if (result.healthy) {
      healthyCount++;
      if (result.response) {
        console.log(`  → "${result.response}"`);
      }
    } else {
      unhealthyCount++;
      console.log(`  → ${result.error}`);
    }
    console.log();
  }

  console.log('-'.repeat(60));
  console.log(`Summary: ${healthyCount} healthy, ${unhealthyCount} failed`);
  console.log('='.repeat(60));

  process.exit(unhealthyCount > 0 ? 1 : 0);
}

main().catch(console.error);
