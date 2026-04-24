// Anti-hardcoded: all config via process.env
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock LLM router before importing agency_router
vi.mock('../litellm/router.ts', () => ({
  llmComplete: vi.fn(),
}));

import { routeToSkill } from '../router/agency_router.js';
import { llmComplete } from '../litellm/router.js';

const mockLlmComplete = llmComplete as ReturnType<typeof vi.fn>;

const testCtx = {
  userId: 'test-user',
  chatId: 12345,
  message: '',
};

// Default mock: assessConfidence returns 0.9 (high confidence — no human gate)
const HIGH_CONFIDENCE = {
  content: '0.9',
  model: 'qwen2.5vl:7b',
  provider: 'ollama',
  latencyMs: 10,
  cached: false,
} as const;

beforeEach(() => {
  vi.clearAllMocks();
  process.env['HUMAN_GATE_THRESHOLD'] = '0.7';
  // Default: always return high confidence so human gate never triggers
  mockLlmComplete.mockResolvedValue(HIGH_CONFIDENCE);
});

describe('routeToSkill — trigger-based routing', () => {
  it('routes "/start" to agency-ceo via trigger', async () => {
    const result = await routeToSkill('/start', testCtx);
    expect(result).toContain('CEO MIX');
  });

  it('routes "vídeo" to video-editor via trigger', async () => {
    const result = await routeToSkill('vídeo', testCtx);
    expect(result).toContain('VIDEO EDITOR');
  });

  it('routes "social" to social media via trigger', async () => {
    const result = await routeToSkill('social', testCtx);
    expect(result).toContain('SOCIAL MEDIA');
  });

  it('trigger routing resolves without throwing', async () => {
    await expect(routeToSkill('tarefa', testCtx)).resolves.toBeDefined();
  });

  it('assessConfidence is called even for trigger-based routing', async () => {
    await routeToSkill('tarefa', testCtx);
    // assessConfidence calls llmComplete once internally
    expect(mockLlmComplete).toHaveBeenCalledTimes(1);
  });
});

describe('routeToSkill — LLM-based routing (CEO fallback)', () => {
  it('routes via LLM when no trigger matches', async () => {
    // Two LLM calls: askCeoToRoute (returns skill ID) + assessConfidence (returns score)
    mockLlmComplete
      .mockResolvedValueOnce({ ...HIGH_CONFIDENCE, content: 'agency-analytics' }) // askCeoToRoute
      .mockResolvedValueOnce(HIGH_CONFIDENCE); // assessConfidence

    const result = await routeToSkill('quero ver métricas do último mês', testCtx);
    expect(result).toContain('ANALYTICS');
    expect(mockLlmComplete).toHaveBeenCalledTimes(2);
  });

  it('falls back to agency-ceo when LLM returns unknown skill ID', async () => {
    mockLlmComplete
      .mockResolvedValueOnce({ ...HIGH_CONFIDENCE, content: 'agency-does-not-exist' }) // askCeoToRoute
      .mockResolvedValueOnce(HIGH_CONFIDENCE); // assessConfidence

    const result = await routeToSkill('alguma coisa aleatória', testCtx);
    expect(result).toContain('CEO MIX');
  });

  it('falls back to agency-ceo when LLM throws an error', async () => {
    mockLlmComplete
      .mockRejectedValueOnce(new Error('Ollama timeout')) // askCeoToRoute fails
      .mockResolvedValueOnce(HIGH_CONFIDENCE); // assessConfidence

    const result = await routeToSkill('alguma coisa sem trigger', testCtx);
    expect(result).toContain('CEO MIX');
  });
});

describe('human gate', () => {
  it('returns human gate message when confidence < threshold', async () => {
    process.env['HUMAN_GATE_THRESHOLD'] = '0.9';
    mockLlmComplete
      .mockResolvedValueOnce({ ...HIGH_CONFIDENCE, content: 'agency-analytics' }) // askCeoToRoute
      .mockResolvedValueOnce({ ...HIGH_CONFIDENCE, content: '0.3' }); // assessConfidence — low

    const result = await routeToSkill('algo vago', testCtx);
    expect(result).toContain('confirmação humana');
  });
});

describe('sanitizeForPrompt (indirectly via LLM routing)', () => {
  it('handles input with null bytes without crashing', async () => {
    mockLlmComplete
      .mockResolvedValueOnce({ ...HIGH_CONFIDENCE, content: 'agency-ceo' })
      .mockResolvedValueOnce(HIGH_CONFIDENCE);

    const malicious = 'mensagem com \x00 null byte e \x1F controles';
    await expect(routeToSkill(malicious, testCtx)).resolves.toBeDefined();
  });

  it('handles very long input (> 2000 chars) without crashing', async () => {
    mockLlmComplete
      .mockResolvedValueOnce({ ...HIGH_CONFIDENCE, content: 'agency-ceo' })
      .mockResolvedValueOnce(HIGH_CONFIDENCE);

    const longInput = 'a'.repeat(5000);
    await expect(routeToSkill(longInput, testCtx)).resolves.toBeDefined();
  });
});
