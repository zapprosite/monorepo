// Anti-hardcoded: all config via process.env
/**
 * Integration tests for supervisor.ts — invokeWorkflow router
 *
 * Tests that invokeWorkflow correctly routes to all 5 registered workflows
 * and returns proper WorkflowResult shape.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock all workflow internals before importing supervisor
vi.mock('../langgraph/content_pipeline.js', () => ({
  contentPipelineGraph: { invoke: vi.fn() },
  executeContentPipeline: vi.fn().mockResolvedValue({ workflow: 'content_pipeline', status: 'ok' }),
  approveContentPipeline: vi.fn(),
}));

vi.mock('../langgraph/onboarding_flow.js', () => ({
  onboardingGraph: { invoke: vi.fn() },
  executeOnboardingFlow: vi.fn().mockResolvedValue({ workflow: 'onboarding', status: 'ok' }),
  approveOnboarding: vi.fn(),
}));

vi.mock('../langgraph/lead_qualification.js', () => ({
  leadQualificationGraph: { invoke: vi.fn() },
  executeLeadQualification: vi.fn().mockResolvedValue({ workflow: 'lead_qualification', status: 'ok' }),
  approveLead: vi.fn(),
}));

vi.mock('../langgraph/social_calendar.js', () => ({
  socialCalendarGraph: { invoke: vi.fn() },
  executeSocialCalendar: vi.fn().mockResolvedValue({ workflow: 'social_calendar', status: 'ok' }),
  approveSocialCalendar: vi.fn(),
}));

vi.mock('../langgraph/status_update.js', () => ({
  statusUpdateGraph: { invoke: vi.fn() },
  executeStatusUpdate: vi.fn().mockResolvedValue({ workflow: 'status_update', status: 'ok' }),
  approveStatusUpdate: vi.fn(),
}));

import { invokeWorkflow, WorkflowName, WorkflowResult } from '../langgraph/supervisor.js';

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('supervisor — invokeWorkflow', () => {
  it('returns WorkflowResult with status ok for content_pipeline', async () => {
    const result = await invokeWorkflow('content_pipeline', 'Briefing de verao');

    expect(result).toHaveProperty('workflow');
    expect(result).toHaveProperty('status');
    expect(result.workflow).toBe('content_pipeline');
    expect(result.status).toBe('ok');
  });

  it('returns WorkflowResult with status ok for onboarding', async () => {
    const result = await invokeWorkflow('onboarding', 'João Silva|joao@refrimix.com');

    expect(result.status).toBe('ok');
    expect(result.workflow).toBe('onboarding');
  });

  it('returns WorkflowResult with status ok for lead_qualification', async () => {
    const result = await invokeWorkflow('lead_qualification', 'Quero ser cliente');

    expect(result.status).toBe('ok');
    expect(result.workflow).toBe('lead_qualification');
  });

  it('returns WorkflowResult with status ok for social_calendar', async () => {
    const result = await invokeWorkflow('social_calendar', '');

    expect(result.status).toBe('ok');
    expect(result.workflow).toBe('social_calendar');
  });

  it('returns WorkflowResult with status ok for status_update', async () => {
    const result = await invokeWorkflow('status_update', '');

    expect(result.status).toBe('ok');
    expect(result.workflow).toBe('status_update');
  });

  it('returns status error for unknown workflow', async () => {
    const result = await invokeWorkflow('unknown_workflow' as WorkflowName, 'input');

    expect(result.status).toBe('error');
    expect(result.error).toBeDefined();
    expect(result.error).toContain('Unknown workflow');
    expect(result.error).toContain('unknown_workflow');
  });

  it('returns error when workflow input format is invalid', async () => {
    // onboarding requires "name|email" format
    const result = await invokeWorkflow('onboarding', 'invalid-format-no-pipe');

    expect(result.status).toBe('error');
    expect(result.error).toContain('Invalid input format');
  });
});

describe('supervisor — WorkflowResult shape', () => {
  it('result contains workflow, status, and data fields', async () => {
    const result = await invokeWorkflow('content_pipeline', 'test brief');

    expect(result).toHaveProperty('workflow');
    expect(result).toHaveProperty('status');
    expect(result.status).toBe('ok');
  });

  it('error result contains workflow, status, and error fields', async () => {
    const result = await invokeWorkflow('nonexistent' as WorkflowName, '');

    expect(result.status).toBe('error');
    expect(result).toHaveProperty('error');
    expect(typeof result.error).toBe('string');
  });
});

describe('supervisor — WorkflowName type', () => {
  it('accepts all 5 valid workflow names', async () => {
    const workflows: WorkflowName[] = [
      'content_pipeline',
      'onboarding',
      'lead_qualification',
      'social_calendar',
      'status_update',
    ];

    for (const wf of workflows) {
      const result = await invokeWorkflow(wf, 'test');
      expect(result.workflow).toBe(wf);
    }
  });
});

describe('supervisor — re-exports', () => {
  it('re-exports compiled graphs', async () => {
    const source = await import('../langgraph/supervisor.js');
    expect(source.contentPipelineGraph).toBeDefined();
    expect(source.onboardingGraph).toBeDefined();
    expect(source.leadQualificationGraph).toBeDefined();
    expect(source.socialCalendarGraph).toBeDefined();
    expect(source.statusUpdateGraph).toBeDefined();
  });

  it('re-exports approval functions', async () => {
    const source = await import('../langgraph/supervisor.js');
    expect(typeof source.approveContentPipeline).toBe('function');
    expect(typeof source.approveOnboarding).toBe('function');
    expect(typeof source.approveLead).toBe('function');
    expect(typeof source.approveSocialCalendar).toBe('function');
    expect(typeof source.approveStatusUpdate).toBe('function');
  });

  it('exports WORKFLOW_STATUS constant', async () => {
    const source = await import('../langgraph/supervisor.js');
    expect(source.WORKFLOW_STATUS).toBeDefined();
    expect(source.WORKFLOW_STATUS['content_pipeline']).toContain('StateGraph');
    expect(source.WORKFLOW_STATUS['onboarding']).toContain('StateGraph');
    expect(source.WORKFLOW_STATUS['lead_qualification']).toContain('StateGraph');
    expect(source.WORKFLOW_STATUS['social_calendar']).toContain('StateGraph');
    expect(source.WORKFLOW_STATUS['status_update']).toContain('StateGraph');
  });
});
