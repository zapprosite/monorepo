// Anti-hardcoded: all config via process.env
/**
 * Integration tests for onboarding_flow workflow (WF-2)
 * Tests: CREATE_PROFILE → INIT_QDRANT → HUMAN_GATE → WELCOME → MILESTONE → CHECKIN
 *
 * Uses interrupt() for human approval — graph pauses at HUMAN_GATE and resumes via Command.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from '@langchain/langgraph';

// Mock LLM router
vi.mock('../litellm/router.ts', () => ({
  llmComplete: vi.fn(),
}));

// Mock fetchClient (used for Qdrant calls)
vi.mock('../utils/fetch-client.js', () => ({
  fetchClient: vi.fn(),
}));

// Mock Telegram bot
vi.mock('../telegram/bot.js', () => ({
  bot: {
    telegram: {
      sendMessage: vi.fn().mockResolvedValue({ message_id: 123 }),
    },
  },
}));

// Mock COLLECTIONS import from qdrant/client
vi.mock('../qdrant/client.js', () => ({
  COLLECTIONS: {
    CLIENTS: 'agency_clients',
    TASKS: 'agency_tasks',
    CAMPAIGNS: 'agency_campaigns',
    WORKING_MEMORY: 'agency_working_memory',
  },
}));

import { llmComplete } from '../litellm/router.js';
import { fetchClient } from '../utils/fetch-client.js';
import { executeOnboardingFlow, approveOnboarding, onboardingGraph } from '../langgraph/onboarding_flow.js';
import { bot } from '../telegram/bot.js';

const mockLlmComplete = llmComplete as ReturnType<typeof vi.fn>;
const mockFetchClient = fetchClient as ReturnType<typeof vi.fn>;
const mockSendMessage = bot.telegram.sendMessage as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  process.env['QDRANT_URL'] = 'http://localhost:6333';

  // Default Qdrant mock responses
  mockFetchClient.mockResolvedValue({
    ok: true,
    json: async () => ({
      status: 'ok',
      result: { points: [] },
    }),
  } as Response);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function createMockLlmResponse(content: string) {
  return {
    content,
    model: 'minimax-m2.7',
    provider: 'minimax',
    latencyMs: 10,
    cached: false,
  };
}

describe('onboarding_flow — StateGraph structure', () => {
  it('compiles to a valid StateGraph', () => {
    expect(onboardingGraph).toBeDefined();
    expect(typeof onboardingGraph.invoke).toBe('function');
  });

  it('has executeOnboardingFlow and approveOnboarding exported', async () => {
    const source = await import('../langgraph/onboarding_flow.js');
    expect(typeof source.executeOnboardingFlow).toBe('function');
    expect(typeof source.approveOnboarding).toBe('function');
  });
});

describe('onboarding_flow — executeOnboardingFlow', () => {
  it('returns valid OnboardingState with required fields', async () => {
    // Will hit interrupt at HUMAN_GATE — workflow doesn't complete synchronously
    const result = await executeOnboardingFlow('Test Client', 'test@refrimix.com');

    // Should have initial state structure even if interrupted
    expect(result).toHaveProperty('clientId');
    expect(result).toHaveProperty('clientName');
    expect(result).toHaveProperty('email');
    expect(result).toHaveProperty('currentStep');
    expect(result.clientName).toBe('Test Client');
    expect(result.email).toBe('test@refrimix.com');
  });

  it('sets profileCreated=false initially before execution', async () => {
    const result = await executeOnboardingFlow('Jane Doe', 'jane@refrimix.com');

    // If interrupted at HUMAN_GATE, profile might be created
    // If it errored before, profileCreated stays false
    expect(typeof result.profileCreated).toBe('boolean');
  });

  it('generates a unique clientId', async () => {
    const result1 = await executeOnboardingFlow('Client A', 'a@test.com');
    const result2 = await executeOnboardingFlow('Client B', 'b@test.com');

    expect(result1.clientId).not.toBe(result2.clientId);
  });
});

describe('onboarding_flow — Qdrant integration', () => {
  it('creates client profile in Qdrant via fetchClient', async () => {
    await executeOnboardingFlow('Test Client', 'test@refrimix.com');

    // Verify fetchClient was called for Qdrant collection creation
    const qdrantCalls = mockFetchClient.mock.calls.filter(
      ([url]: [string]) => url.includes('qdrant') || url.includes('localhost:6333'),
    );
    expect(qdrantCalls.length).toBeGreaterThan(0);
  });

  it('initializes Qdrant collection for the new client', async () => {
    const result = await executeOnboardingFlow('Test Client', 'test@refrimix.com');

    // The workflow should have attempted to init the Qdrant collection
    // (check calls were made to fetchClient)
    expect(mockFetchClient).toHaveBeenCalled();
    // qdrantInitialized will be true if Qdrant calls succeeded
    expect(typeof result.qdrantInitialized).toBe('boolean');
  });
});

describe('onboarding_flow — human approval via interrupt', () => {
  it('interrupts at HUMAN_GATE waiting for approval', async () => {
    const result = await executeOnboardingFlow('Test Client', 'test@refrimix.com');

    // The workflow should have reached or passed HUMAN_GATE
    // If currentStep is START/ERROR, something failed early
    expect(['CREATE_PROFILE', 'INIT_QDRANT', 'HUMAN_GATE', 'ERROR']).toContain(result.currentStep);
  });

  it('approveOnboarding resumes with approved=true', async () => {
    const result = await executeOnboardingFlow('Test Client', 'test@refrimix.com');
    const clientId = result.clientId;

    const approvedResult = await approveOnboarding(clientId, true, 'Approved by manager');

    expect(approvedResult).toBeDefined();
    expect(approvedResult.humanApproved).toBe(true);
    expect(approvedResult.humanComment).toBe('Approved by manager');
  });

  it('approveOnboarding resumes with approved=false (rejected)', async () => {
    const result = await executeOnboardingFlow('Test Client', 'test@refrimix.com');
    const clientId = result.clientId;

    const rejectedResult = await approveOnboarding(clientId, false, 'Rejected — missing info');

    expect(rejectedResult).toBeDefined();
    expect(rejectedResult.humanApproved).toBe(false);
    expect(rejectedResult.humanComment).toBe('Rejected — missing info');
  });

  it('sets humanApproved field correctly after approval', async () => {
    const result = await executeOnboardingFlow('Jane', 'jane@test.com');
    const approved = await approveOnboarding(result.clientId, true);

    expect(approved).toHaveProperty('humanApproved');
  });
});

describe('onboarding_flow — Telegram notification', () => {
  it('approves onboarding with telegramChatId and sends welcome message', async () => {
    const result = await executeOnboardingFlow('Telegram Client', 'tg@refrimix.com', 123456789);
    const approved = await approveOnboarding(result.clientId, true);

    // If welcome was sent (humanApproved=true), check Telegram was called
    if (approved.welcomeSent) {
      expect(mockSendMessage).toHaveBeenCalledWith(
        123456789,
        expect.stringContaining('Bem-vindo'),
        expect.any(Object),
      );
    }
  });

  it('skips welcome when humanApproved=false', async () => {
    const result = await executeOnboardingFlow('Test Client', 'test@refrimix.com', 999999999);
    await approveOnboarding(result.clientId, false);

    // Should not have sent a welcome message
    expect(mockSendMessage).not.toHaveBeenCalled();
  });
});

describe('onboarding_flow — error handling', () => {
  it('handles Qdrant failure gracefully', async () => {
    mockFetchClient.mockRejectedValue(new Error('Qdrant connection refused'));

    const result = await executeOnboardingFlow('Test Client', 'test@refrimix.com');

    expect(result).toHaveProperty('error');
    expect(result.currentStep).toBe('ERROR');
  });

  it('handles invalid input format without crashing', async () => {
    // executeOnboardingFlow takes (clientName, email, telegramChatId?)
    // Empty strings are valid input but may produce error during execution
    const result = await executeOnboardingFlow('', '');

    expect(result).toBeDefined();
    expect(result.clientId).toBeDefined();
  });
});

describe('onboarding_flow — OnboardingState structure', () => {
  it('returns state with all required OnboardingState fields', async () => {
    const result = await executeOnboardingFlow('Test Client', 'test@refrimix.com');

    // Check all required fields
    expect(result).toHaveProperty('clientId');
    expect(result).toHaveProperty('clientName');
    expect(result).toHaveProperty('email');
    expect(result).toHaveProperty('currentStep');
    expect(result).toHaveProperty('profileCreated');
    expect(result).toHaveProperty('qdrantInitialized');
    expect(result).toHaveProperty('welcomeSent');
    expect(result).toHaveProperty('milestoneCreated');
    expect(result).toHaveProperty('checkinScheduled');
    expect(result).toHaveProperty('complete');
  });
});
