// Anti-hardcoded: all config via process.env
// LiteLLM Proxy Integration Tests — Router proxy for multiple LLM providers
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock fetch for LiteLLM Proxy API — isolated with vi.spyOn
// ---------------------------------------------------------------------------

let fetchSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  // Spy on global fetch and mock it
  fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: true,
    json: vi.fn().mockResolvedValue({}),
    text: vi.fn().mockResolvedValue(''),
  });
});

afterEach(() => {
  fetchSpy?.mockRestore();
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChatCompletionMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ChatCompletionChoice {
  message: ChatCompletionMessage;
  index: number;
  finish_reason: string;
}

interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: ChatCompletionChoice[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// ---------------------------------------------------------------------------
// LiteLLM Proxy endpoint helpers (simplified for testing)
// ---------------------------------------------------------------------------

// NOTE: Read env var inside function to allow test env var overrides
async function chatCompletion(
  model: string,
  messages: ChatCompletionMessage[],
  apiKey?: string,
): Promise<ChatCompletionResponse | null> {
  const baseUrl = process.env['LITELLM_PROXY_URL'] ?? 'http://localhost:4000';
  const url = `${baseUrl}/v1/chat/completions`;
  
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({ model, messages }),
    });

    if (!res.ok) {
      console.error(`[LiteLLM] Chat completion failed: ${res.status}`);
      return null;
    }

    return (await res.json()) as ChatCompletionResponse;
  } catch (err) {
    console.error('[LiteLLM] Chat completion error:', err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('LiteLLM Proxy', () => {
  describe('chatCompletion', () => {
    it('calls correct endpoint for minimax-m2.7 model', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          id: 'chatcmpl-minimax',
          object: 'chat.completion',
          created: Date.now(),
          model: 'minimax-m2.7',
          choices: [
            {
              message: { role: 'assistant', content: 'OK' },
              index: 0,
              finish_reason: 'stop',
            },
          ],
        }),
      });

      const result = await chatCompletion('minimax-m2.7', [
        { role: 'user', content: 'Hello' },
      ]);

      expect(result).not.toBeNull();
      expect(result?.model).toBe('minimax-m2.7');
      expect(fetchSpy).toHaveBeenCalledWith(
        'http://localhost:4000/v1/chat/completions',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('calls correct endpoint for gpt-4o model', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          id: 'chatcmpl-gpt4',
          object: 'chat.completion',
          created: Date.now(),
          model: 'gpt-4o',
          choices: [
            {
              message: { role: 'assistant', content: 'GPT-4 response' },
              index: 0,
              finish_reason: 'stop',
            },
          ],
        }),
      });

      const result = await chatCompletion('gpt-4o', [
        { role: 'user', content: 'Hello' },
      ]);

      expect(result).not.toBeNull();
      expect(result?.model).toBe('gpt-4o');
      expect(fetchSpy).toHaveBeenCalledWith(
        'http://localhost:4000/v1/chat/completions',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('returns null on API error', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: vi.fn().mockResolvedValue('Internal Server Error'),
      });

      const result = await chatCompletion('minimax-m2.7', [
        { role: 'user', content: 'Hello' },
      ]);

      expect(result).toBeNull();
    });

    it('returns null on network error', async () => {
      fetchSpy.mockRejectedValueOnce(new Error('Network error'));

      const result = await chatCompletion('minimax-m2.7', [
        { role: 'user', content: 'Hello' },
      ]);

      expect(result).toBeNull();
    });

    it('sends correct Authorization header when apiKey provided', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          id: 'chatcmpl',
          model: 'test',
          choices: [],
        }),
      });

      await chatCompletion(
        'test-model',
        [{ role: 'user', content: 'Hello' }],
        'sk-test-key',
      );

      const [, options] = fetchSpy.mock.calls[0];
      expect(options.headers).toEqual(
        expect.objectContaining({
          Authorization: 'Bearer sk-test-key',
        }),
      );
    });

    it('uses custom LITELLM_PROXY_URL when set', async () => {
      process.env['LITELLM_PROXY_URL'] = 'https://custom.litellm.ai';

      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          id: 'chatcmpl',
          model: 'test',
          choices: [],
        }),
      });

      await chatCompletion('test-model', [
        { role: 'user', content: 'Hello' },
      ]);

      const [url] = fetchSpy.mock.calls[0];
      expect(url).toBe('https://custom.litellm.ai/v1/chat/completions');
    });

    it('includes messages in request body', async () => {
      const messages = [
        { role: 'system' as const, content: 'You are a helpful assistant.' },
        { role: 'user' as const, content: 'Hello' },
      ];

      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          id: 'chatcmpl',
          model: 'test',
          choices: [],
        }),
      });

      await chatCompletion('test-model', messages);

      const [, options] = fetchSpy.mock.calls[0];
      const body = JSON.parse(options.body);
      expect(body.messages).toEqual(messages);
      expect(body.model).toBe('test-model');
    });
  });
});
