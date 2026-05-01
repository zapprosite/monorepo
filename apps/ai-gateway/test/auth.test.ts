/**
 * SPEC-047 T402 — Unit tests: auth middleware + schemas
 */

import { describe, it, expect, beforeAll } from 'vitest';

// Set env before importing module (anti-hardcoded)
beforeAll(() => {
  process.env.AI_GATEWAY_FACADE_KEY = 'test-key-32-bytes-xxxxxxxxxxxxxxxxxxx';
  process.env.LITELLM_LOCAL_URL = 'http://localhost:4000/v1';
  process.env.LITELLM_MASTER_KEY = 'test-litellm-key';
  process.env.TTS_BRIDGE_URL = 'http://localhost:8013';
  process.env.STT_PROXY_URL = 'http://localhost:8203';
});

describe('ChatCompletionRequestSchema', () => {
  it('accepts valid request', async () => {
    const { ChatCompletionRequestSchema } = await import('@repo/zod-schemas/openai-compat.zod');
    const result = ChatCompletionRequestSchema.safeParse({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Olá' }],
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty messages', async () => {
    const { ChatCompletionRequestSchema } = await import('@repo/zod-schemas/openai-compat.zod');
    const result = ChatCompletionRequestSchema.safeParse({ model: 'gpt-4o', messages: [] });
    expect(result.success).toBe(false);
  });

  it('defaults stream to false', async () => {
    const { ChatCompletionRequestSchema } = await import('@repo/zod-schemas/openai-compat.zod');
    const result = ChatCompletionRequestSchema.safeParse({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'test' }],
    });
    expect(result.success && result.data.stream).toBe(false);
  });
});

describe('AudioSpeechRequestSchema', () => {
  it('defaults voice to pm_santa (SPEC-009)', async () => {
    const { AudioSpeechRequestSchema } = await import('@repo/zod-schemas/openai-compat.zod');
    const result = AudioSpeechRequestSchema.safeParse({ model: 'tts-1', input: 'Olá mundo' });
    expect(result.success && result.data.voice).toBe('pm_santa');
  });

  it('rejects invalid voice', async () => {
    const { AudioSpeechRequestSchema } = await import('@repo/zod-schemas/openai-compat.zod');
    const result = AudioSpeechRequestSchema.safeParse({
      model: 'tts-1',
      input: 'test',
      voice: 'af_sarah',
    });
    expect(result.success).toBe(false);
  });
});

describe('constant-time auth', () => {
  it('timingSafeEqual returns true for equal buffers', async () => {
    const { timingSafeEqual } = await import('node:crypto');
    const a = Buffer.from('same-key');
    const b = Buffer.from('same-key');
    expect(timingSafeEqual(a, b)).toBe(true);
  });

  it('timingSafeEqual returns false for different buffers', async () => {
    const { timingSafeEqual } = await import('node:crypto');
    const a = Buffer.from('key-one!');
    const b = Buffer.from('key-two!');
    expect(timingSafeEqual(a, b)).toBe(false);
  });
});
