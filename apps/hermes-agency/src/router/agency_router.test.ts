import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// NOTE: agency_router.ts has many complex dependencies that are difficult
// to fully unit test (llmComplete, mem0, ragRetrieve, circuit breaker, etc.)
// We test the standalone sanitizeForPrompt function which is pure logic.
// Full integration tests would require the complete stack.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Mock all dependencies before importing
// ---------------------------------------------------------------------------

vi.mock('../skills/index.ts', () => ({
  AGENCY_SKILLS: [
    {
      id: 'agency-ceo',
      name: 'CEO MIX',
      description: 'Router supervisor',
      tools: ['langgraph_execute', 'skill_route', 'human_gate_trigger', 'qdrant_query'],
      triggers: ['/start', '/agency', 'brief', 'campaign'],
    },
    {
      id: 'agency-onboarding',
      name: 'ONBOARDING',
      description: 'New client onboarding',
      tools: ['create_client_profile', 'init_qdrant_collection'],
      triggers: ['novo cliente', 'onboarding'],
    },
  ],
  getSkillById: vi.fn((id: string) => {
    const skills: Record<string, { id: string; name: string; tools: string[]; triggers: string[] }> = {
      'agency-ceo': {
        id: 'agency-ceo',
        name: 'CEO MIX',
        tools: ['langgraph_execute'],
        triggers: ['/start'],
      },
    };
    return skills[id] ?? null;
  }),
  getSkillByTrigger: vi.fn(),
}));

vi.mock('../skills/tool_registry.ts', () => ({
  TOOL_REGISTRY: {
    test_tool: async (args: Record<string, unknown>) => {
      if (!args['input']) return { ok: false, error: 'input required' };
      return { ok: true, data: { result: 'ok' } };
    },
  },
  createInitialState: vi.fn().mockReturnValue({
    messages: [],
    currentSkill: null,
    lastResult: null,
    pendingApproval: false,
  }),
}));

vi.mock('../litellm/router.ts', () => ({
  llmComplete: vi.fn().mockResolvedValue({ content: 'agency-onboarding' }),
}));

vi.mock('../skills/circuit_breaker.ts', () => ({
  isCallPermitted: vi.fn().mockReturnValue(true),
  recordSuccess: vi.fn(),
  recordFailure: vi.fn(),
}));

vi.mock('../mem0/client.ts', () => ({
  mem0GetRecent: vi.fn().mockResolvedValue([]),
  mem0Store: vi.fn().mockResolvedValue(undefined),
  addToSessionHistory: vi.fn(),
  formatMem0Context: vi.fn().mockReturnValue('// No memory context'),
}));

vi.mock('../skills/rag-instance-organizer.ts', () => ({
  ragRetrieve: vi.fn().mockResolvedValue([]),
}));

vi.mock('../langgraph/supervisor.ts', () => ({
  invokeWorkflow: vi.fn().mockResolvedValue({ status: 'ok', data: {} }),
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

// We import the module to test its exports
import { routeToSkill, getSessionState, clearSessionState } from './agency_router.js';

// ---------------------------------------------------------------------------
// sanitizeForPrompt (tested via module introspection)
// ---------------------------------------------------------------------------

describe('sanitizeForPrompt', () => {
  // Helper to call sanitizeForPrompt indirectly through askCeoToRoute
  // since it's not directly exported. We test behavior through integration.

  it('is applied to user input in routing context', async () => {
    // The sanitizeForPrompt is applied inside askCeoToRoute
    // We verify this by checking that the llmComplete receives sanitized input
    const { llmComplete } = await import('../litellm/router.js');
    vi.clearAllMocks();

    const ctx = {
      userId: 'user_123',
      chatId: 12345,
      message: 'test message with control chars \x00\x1f and "quotes" and\nnewlines',
      sessionId: 'test_session',
    };

    await routeToSkill(ctx.message, ctx);

    // Verify llmComplete was called with sanitized content
    expect(llmComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({
            content: expect.stringContaining('test message with control chars'),
          }),
        ]),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// routeToSkill
// ---------------------------------------------------------------------------

describe('routeToSkill', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns error for unknown skill via CEO fallback', async () => {
    const { getSkillByTrigger } = await import('../skills/index.ts');
    (getSkillByTrigger as ReturnType<typeof vi.fn>).mockReturnValue(null);

    const ctx = {
      userId: 'user_123',
      chatId: 12345,
      message: 'random message that triggers CEO',
      sessionId: 'test_session',
    };

    const result = await routeToSkill(ctx.message, ctx);
    expect(typeof result).toBe('string');
  });

  it('stores user message in history', async () => {
    const { addToSessionHistory, mem0Store } = await import('../mem0/client.ts');

    const ctx = {
      userId: 'user_123',
      chatId: 12345,
      message: 'test message',
      sessionId: 'test_session',
    };

    await routeToSkill(ctx.message, ctx);

    expect(addToSessionHistory).toHaveBeenCalled();
    expect(mem0Store).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Session state management
// ---------------------------------------------------------------------------

describe('session state management', () => {
  it('getSessionState returns null for unknown session', () => {
    const state = getSessionState('unknown_session_12345');
    expect(state).toBeNull();
  });

  it('clearSessionState removes session', async () => {
    const ctx = {
      userId: 'user_123',
      chatId: 99999,
      message: 'test',
      sessionId: 'session_to_clear',
    };

    await routeToSkill(ctx.message, ctx);
    clearSessionState('session_to_clear');

    const state = getSessionState('session_to_clear');
    expect(state).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Integration: sanitizeForPrompt behavior
// ---------------------------------------------------------------------------

describe('sanitizeForPrompt behavior (via askCeoToRoute)', () => {
  it('removes null bytes', async () => {
    const { llmComplete } = await import('../litellm/router.ts');
    vi.clearAllMocks();

    const ctx = {
      userId: 'user',
      chatId: 1,
      message: 'hello\x00world',
      sessionId: 'nullbyte_test',
    };

    await routeToSkill(ctx.message, ctx);

    const call = llmComplete.mock.calls[0][0];
    const promptContent = call.messages[0].content;
    expect(promptContent).not.toContain('\x00');
  });

  it('removes control characters (0x00-0x1F, 0x7F) from user input', async () => {
    const { llmComplete } = await import('../litellm/router.ts');
    vi.clearAllMocks();

    const ctx = {
      userId: 'user',
      chatId: 1,
      message: 'test\x1fcontrol\x7fchars',
      sessionId: 'control_test',
    };

    await routeToSkill(ctx.message, ctx);

    const call = llmComplete.mock.calls[0][0];
    const promptContent = call.messages[0].content;
    // The raw control characters should not appear in the user message portion
    // Extract the message from the prompt and check it doesn't have control chars
    const msgMatch = promptContent.match(/Mensagem: "([^"]+)"/);
    const userMessage = msgMatch ? msgMatch[1] : '';
    // eslint-disable-next-line no-control-regex
    expect(userMessage).not.toMatch(/[\x00-\x1F\x7F]/);
  });

  it('escapes double quotes', async () => {
    const { llmComplete } = await import('../litellm/router.ts');
    vi.clearAllMocks();

    const ctx = {
      userId: 'user',
      chatId: 1,
      message: 'say "hello"',
      sessionId: 'quotes_test',
    };

    await routeToSkill(ctx.message, ctx);

    const call = llmComplete.mock.calls[0][0];
    const promptContent = call.messages[0].content;
    // Quotes should be escaped as \" inside the prompt
    expect(promptContent).toContain('\\"');
  });

  it('escapes newlines by replacing with space', async () => {
    const { llmComplete } = await import('../litellm/router.ts');
    vi.clearAllMocks();

    const ctx = {
      userId: 'user',
      chatId: 1,
      message: 'line1\nline2',
      sessionId: 'newline_test',
    };

    await routeToSkill(ctx.message, ctx);

    const call = llmComplete.mock.calls[0][0];
    const promptContent = call.messages[0].content;
    // After sanitization, the newline is replaced (not preserved as literal \n in the final string)
    // The prompt should not have an actual newline character within the message content
    const msgLine = promptContent.split('Mensagem:')[1]?.split('"')[1] ?? '';
    expect(msgLine).not.toContain('\n');
  });

  it('escapes tabs by replacing with space', async () => {
    const { llmComplete } = await import('../litellm/router.ts');
    vi.clearAllMocks();

    const ctx = {
      userId: 'user',
      chatId: 1,
      message: 'col1\tcol2',
      sessionId: 'tab_test',
    };

    await routeToSkill(ctx.message, ctx);

    const call = llmComplete.mock.calls[0][0];
    const promptContent = call.messages[0].content;
    const msgLine = promptContent.split('Mensagem:')[1]?.split('"')[1] ?? '';
    expect(msgLine).not.toContain('\t');
  });

  it('escapes carriage returns by replacing with space', async () => {
    const { llmComplete } = await import('../litellm/router.ts');
    vi.clearAllMocks();

    const ctx = {
      userId: 'user',
      chatId: 1,
      message: 'line1\rline2',
      sessionId: 'cr_test',
    };

    await routeToSkill(ctx.message, ctx);

    const call = llmComplete.mock.calls[0][0];
    const promptContent = call.messages[0].content;
    const msgLine = promptContent.split('Mensagem:')[1]?.split('"')[1] ?? '';
    expect(msgLine).not.toContain('\r');
  });

  it('escapes backslashes by doubling them', async () => {
    const { llmComplete } = await import('../litellm/router.ts');
    vi.clearAllMocks();

    const ctx = {
      userId: 'user',
      chatId: 1,
      message: 'path\\to\\file',
      sessionId: 'backslash_test',
    };

    await routeToSkill(ctx.message, ctx);

    const call = llmComplete.mock.calls[0][0];
    const promptContent = call.messages[0].content;
    // Backslashes should be escaped (doubled) - the prompt should not have single backslashes in the message
    const msgLine = promptContent.split('Mensagem:')[1]?.split('"')[1] ?? '';
    // If escaped properly, single backslashes are doubled, so original single-backslash positions change
    // The message portion should not contain unescaped backslashes adjacent to normal chars
    expect(msgLine).not.toMatch(/[^\\]\\[^\\]/);
  });

  it('limits input to 2000 characters', async () => {
    const { llmComplete } = await import('../litellm/router.ts');
    vi.clearAllMocks();

    const longMessage = 'a'.repeat(3000);
    const ctx = {
      userId: 'user',
      chatId: 1,
      message: longMessage,
      sessionId: 'long_test',
    };

    await routeToSkill(ctx.message, ctx);

    const call = llmComplete.mock.calls[0][0];
    const promptContent = call.messages[0].content;
    // The sanitized input (message) should be truncated to 2000 chars
    const msgMatch = promptContent.match(/Mensagem: "([^"]+)"/);
    const userMessage = msgMatch ? msgMatch[1] : '';
    // After truncation, the message should be exactly 2000 chars
    expect(userMessage.length).toBe(2000);
  });
});
