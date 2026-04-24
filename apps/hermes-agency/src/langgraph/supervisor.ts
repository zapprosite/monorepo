// Anti-hardcoded: all config via process.env
// LangGraph Supervisor — routes invokeWorkflow calls to registered workflows

import { contentPipelineGraph, executeContentPipeline, approveContentPipeline } from './content_pipeline.js';
import { onboardingGraph, executeOnboardingFlow, approveOnboarding } from './onboarding_flow.js';
import { leadQualificationGraph, executeLeadQualification, approveLead } from './lead_qualification.js';
import { socialCalendarGraph, executeSocialCalendar, approveSocialCalendar } from './social_calendar.js';
import { statusUpdateGraph, executeStatusUpdate, approveStatusUpdate } from './status_update.js';

/**
 * Supported workflow names.
 * All 5 workflows are now true LangGraph StateGraphs with interrupt() for human approval.
 * Migrated from sequential async as part of bug-B1 fix.
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
 * Re-export compiled graphs for direct LangGraph operations
 * (e.g., checking interrupts, resuming with Command).
 */
export { contentPipelineGraph };
export { onboardingGraph };
export { leadQualificationGraph };
export { socialCalendarGraph };
export { statusUpdateGraph };

/**
 * Convenience to resume workflows after human approval.
 */
export { approveContentPipeline };
export { approveOnboarding };
export { approveLead };
export { approveSocialCalendar };
export { approveStatusUpdate };

// ---------------------------------------------------------------------------
// LangGraph workflow status
// ---------------------------------------------------------------------------

/**
 * Documents which workflow files are real LangGraph StateGraphs.
 *
 * All 5 workflows are now TRUE StateGraph (nodes + edges + compile + checkpointer + interrupt):
 *   - content_pipeline.ts (WF-1) — StateGraph with interrupt()
 *   - onboarding_flow.ts (WF-2) — StateGraph with interrupt()
 *   - lead_qualification.ts (WF-5) — StateGraph with interrupt()
 *   - social_calendar.ts (WF-4) — StateGraph with interrupt()
 *   - status_update.ts (WF-3) — StateGraph with interrupt()
 *
 * Migration from sequential async to StateGraph completed as part of bug-B1.
 */
export const WORKFLOW_STATUS = {
  content_pipeline: 'StateGraph (WF-1) ✅',
  onboarding: 'StateGraph (WF-2) ✅',
  lead_qualification: 'StateGraph (WF-5) ✅',
  social_calendar: 'StateGraph (WF-4) ✅',
  status_update: 'StateGraph (WF-3) ✅',
} as const;
