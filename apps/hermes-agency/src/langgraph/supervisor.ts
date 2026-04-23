// Anti-hardcoded: all config via process.env
// LangGraph Supervisor — routes invokeWorkflow calls to registered workflows

import { contentPipelineGraph, executeContentPipeline, approveContentPipeline } from './content_pipeline.js';
import { executeOnboardingFlow } from './onboarding_flow.js';
import { executeLeadQualification } from './lead_qualification.js';
import { executeSocialCalendar } from './social_calendar.js';
import { executeStatusUpdate } from './status_update.js';

/**
 * Supported workflow names.
 * Only `content_pipeline` is a true LangGraph StateGraph (WF-1).
 * The others are sequential async workflows (WF-2 through WF-5) — not yet migrated to StateGraph.
 */
export type WorkflowName =
  | 'content_pipeline'
  | 'onboarding'
  | 'lead_qualification'
  | 'social_calendar'
  | 'status_update';

/** Result shape returned by every registered workflow. */
export type WorkflowResult = {
  workflow: WorkflowName;
  status: 'ok' | 'error';
  data?: unknown;
  error?: string;
};

// ---------------------------------------------------------------------------
// Workflow registry
// ---------------------------------------------------------------------------

const WORKFLOW_REGISTRY: Record<
  WorkflowName,
  (_input: string, _threadId?: string) => Promise<WorkflowResult>
> = {
  content_pipeline: async (input: string, threadId?: string) => {
    try {
      // input is a brief string; threadId maps to campaignId for resumption
      const result = await executeContentPipeline(input, threadId ?? `client-${Date.now()}`);
      return { workflow: 'content_pipeline', status: 'ok', data: result };
    } catch (err) {
      return { workflow: 'content_pipeline', status: 'error', error: String(err) };
    }
  },

  onboarding: async (input: string) => {
    try {
      // input format: "clientName|email|[telegramChatId]"
      const parts = input.split('|');
      if (parts.length < 2) {
        return { workflow: 'onboarding', status: 'error', error: 'Invalid input format: expected "clientName|email|[telegramChatId]"' };
      }
      const [clientName, email, telegramChatId] = parts as [string, string, string | undefined];
      const result = await executeOnboardingFlow(
        clientName,
        email,
        telegramChatId ? parseInt(telegramChatId, 10) : undefined,
      );
      return { workflow: 'onboarding', status: 'ok', data: result };
    } catch (err) {
      return { workflow: 'onboarding', status: 'error', error: String(err) };
    }
  },

  lead_qualification: async (input: string) => {
    try {
      // input is the prospect message
      const result = await executeLeadQualification(input);
      return { workflow: 'lead_qualification', status: 'ok', data: result };
    } catch (err) {
      return { workflow: 'lead_qualification', status: 'error', error: String(err) };
    }
  },

  social_calendar: async () => {
    try {
      // No input required for social calendar
      const result = await executeSocialCalendar();
      return { workflow: 'social_calendar', status: 'ok', data: result };
    } catch (err) {
      return { workflow: 'social_calendar', status: 'error', error: String(err) };
    }
  },

  status_update: async () => {
    try {
      // No input required for status update
      const result = await executeStatusUpdate();
      return { workflow: 'status_update', status: 'ok', data: result };
    } catch (err) {
      return { workflow: 'status_update', status: 'error', error: String(err) };
    }
  },
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Route an invoke request to the appropriate workflow.
 *
 * @param workflowName - One of the supported WorkflowName values
 * @param input        - Workflow-specific input string
 * @param threadId     - Optional thread/campaign ID for resumable workflows (content_pipeline)
 */
export async function invokeWorkflow(
  workflowName: string,
  input: string,
  threadId?: string,
): Promise<WorkflowResult> {
  const fn = WORKFLOW_REGISTRY[workflowName as WorkflowName];
  if (!fn) {
    const available = Object.keys(WORKFLOW_REGISTRY).join(', ');
    return {
      workflow: workflowName as WorkflowName,
      status: 'error',
      error: `Unknown workflow: "${workflowName}". Available: ${available}`,
    };
  }
  return fn(input, threadId);
}

/**
 * Re-export the compiled content_pipeline graph for direct LangGraph operations
 * (e.g., checking interrupts, resuming with Command).
 */
export { contentPipelineGraph };

/**
 * Convenience to resume a content_pipeline workflow after human approval.
 */
export { approveContentPipeline };

// ---------------------------------------------------------------------------
// LangGraph stub status
// ---------------------------------------------------------------------------

/**
 * Documents which workflow files are real LangGraph StateGraphs vs stubs.
 *
 * TRUE StateGraph (nodes + edges + compile):
 *   - content_pipeline.ts (WF-1) — StateGraph with CREATIVE→VIDEO→DESIGN→BRAND_GUARDIAN→HUMAN_GATE→SOCIAL→ANALYTICS
 *
 * STUBS (sequential async functions — no StateGraph):
 *   - onboarding_flow.ts (WF-2)   — executeOnboardingFlow()
 *   - lead_qualification.ts (WF-5) — executeLeadQualification()
 *   - social_calendar.ts (WF-4)    — executeSocialCalendar()
 *   - status_update.ts (WF-3)      — executeStatusUpdate()
 */
export const WORKFLOW_STATUS = {
  content_pipeline: 'StateGraph (WF-1)',
  onboarding: 'stub — sequential async (WF-2)',
  lead_qualification: 'stub — sequential async (WF-5)',
  social_calendar: 'stub — sequential async (WF-4)',
  status_update: 'stub — sequential async (WF-3)',
} as const;
