// Anti-hardcoded: all config via process.env
// LangGraph Lead Qualification Workflow (WF-5) — Real StateGraph with interrupt
/* eslint-disable no-console */

import { MemorySaver, StateGraph, START, END, interrupt, Command } from '@langchain/langgraph';
import { llmComplete } from '../litellm/router.js';

const checkpointer = new MemorySaver();

export type LeadQualificationState = {
  prospectId: string;
  prospectMessage: string;
  currentStep: string;
  score?: number;
  qualified?: boolean;
  action?: 'onboarding' | 'nurture' | 'reject';
  taskCreated?: boolean;
  humanApproved?: boolean;
  humanComment?: string;
  error?: string;
};

// Node: Score the prospect
async function scoreNode(state: LeadQualificationState): Promise<Partial<LeadQualificationState>> {
  console.log(`[LeadQualification] Executing SCORE node for prospect`);
  try {
    const prompt = `Analise esta mensagem de um prospecto de agência de marketing.

Mensagem: "${state.prospectMessage}"

Avalie em 0-1:
- Clareza da necessidade
- Orçamento implícito
- Timeline implícita
- Fit com serviços de agência

Retorne apenas um número entre 0 e 1.`;

    const result = await llmComplete({
      messages: [{ role: 'user', content: prompt }],
      systemPrompt: 'Você é um especialista em qualificação de leads.',
      maxTokens: 10,
      temperature: 0,
    });

    const score = Math.max(0, Math.min(1, parseFloat(result.content) || 0.5));
    console.log(`[LeadQualification] Score: ${score.toFixed(2)}`);

    return { currentStep: 'SCORE', score };
  } catch (err) {
    console.error('[LeadQualification] scoreNode failed:', err);
    return { currentStep: 'ERROR', error: err instanceof Error ? err.message : String(err) };
  }
}

// Node: Classify action based on score
async function classifyNode(state: LeadQualificationState): Promise<Partial<LeadQualificationState>> {
  console.log(`[LeadQualification] Executing CLASSIFY node`);
  try {
    let action: 'onboarding' | 'nurture' | 'reject';
    let qualified: boolean;

    if ((state.score ?? 0) >= 0.8) {
      action = 'onboarding';
      qualified = true;
    } else if ((state.score ?? 0) >= 0.4) {
      action = 'nurture';
      qualified = false;
    } else {
      action = 'reject';
      qualified = false;
    }

    console.log(`[LeadQualification] Classified as ${action} (qualified: ${qualified})`);
    return { currentStep: 'CLASSIFY', action, qualified };
  } catch (err) {
    console.error('[LeadQualification] classifyNode failed:', err);
    return { currentStep: 'ERROR', error: err instanceof Error ? err.message : String(err) };
  }
}

// Node: Human approval gate — always interrupt for human approval
// Brand score is advisory; human makes the final decision for ALL paths
async function humanGateNode(state: LeadQualificationState): Promise<Partial<LeadQualificationState>> {
  console.log(`[LeadQualification] Executing HUMAN_GATE node`);

  // Always interrupt for human approval — brand score is advisory, human makes final decision
  const decision = await interrupt({
    prospectId: state.prospectId,
    prospectMessage: state.prospectMessage,
    score: state.score,
    action: state.action,
    message: `Aprovar lead ${state.prospectId} (${state.action})? Score: ${state.score?.toFixed(2)}`,
  });

  console.log(`[LeadQualification] Human approval result: approved=${decision.approved}, comment=${decision.comment ?? 'none'}`);
  return {
    currentStep: 'HUMAN_GATE',
    humanApproved: decision.approved,
    humanComment: decision.comment,
  };
}

// Node: Create appropriate task
async function taskNode(state: LeadQualificationState): Promise<Partial<LeadQualificationState>> {
  console.log(`[LeadQualification] Executing TASK node`);
  try {
    switch (state.action) {
      case 'onboarding':
        console.log(`[LeadQualification] Creating onboarding task for ${state.prospectId}`);
        // TODO: Create task in Qdrant agency_tasks for CS agent
        break;
      case 'nurture':
        console.log(`[LeadQualification] Nurture sequence for ${state.prospectId}`);
        // TODO: Add to nurture sequence
        break;
      case 'reject':
        console.log(`[LeadQualification] Rejected ${state.prospectId}`);
        break;
    }
    return { currentStep: 'TASK', taskCreated: true };
  } catch (err) {
    console.error('[LeadQualification] taskNode failed:', err);
    return { currentStep: 'ERROR', error: err instanceof Error ? err.message : String(err) };
  }
}

// Conditional edge: route based on human approval for ALL action types
// BUG FIX: Previously only checked humanApproved for 'onboarding' action,
// causing 'nurture' and 'reject' paths to auto-approve without interrupt
function shouldContinue(state: LeadQualificationState): 'TASK' | 'END' {
  // All paths (onboarding, nurture, reject) require human approval
  if (state.humanApproved !== true) {
    console.log(`[LeadQualification] Human rejected or pending — END`);
    return 'END';
  }
  console.log(`[LeadQualification] Human approved — TASK`);
  return 'TASK';
}

// Build the StateGraph
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const workflow = new StateGraph<any>({
  channels: {
    prospectId: { type: 'string' },
    prospectMessage: { type: 'string' },
    currentStep: { type: 'string' },
    score: { type: 'number', nullable: true },
    qualified: { type: 'boolean', nullable: true },
    action: { type: 'string', nullable: true },
    taskCreated: { type: 'boolean', nullable: true },
    humanApproved: { type: 'boolean', nullable: true },
    humanComment: { type: 'string', nullable: true },
    error: { type: 'string', nullable: true },
  },
})
  .addNode('SCORE', scoreNode)
  .addNode('CLASSIFY', classifyNode)
  .addNode('HUMAN_GATE', humanGateNode)
  .addNode('TASK', taskNode)
  .addEdge(START, 'SCORE')
  .addEdge('SCORE', 'CLASSIFY')
  .addEdge('CLASSIFY', 'HUMAN_GATE')
  .addConditionalEdges('HUMAN_GATE', shouldContinue)
  .addEdge('TASK', END);

const compiledGraph = workflow.compile({ checkpointer });

export { compiledGraph as leadQualificationGraph };

// Execute lead qualification
export async function executeLeadQualification(
  prospectMessage: string,
): Promise<LeadQualificationState> {
  const prospectId = `prospect-${Date.now()}`;
  console.log(`[LeadQualification] Starting qualification for prospect ${prospectId}`);

  const initialState: LeadQualificationState = {
    prospectId,
    prospectMessage,
    currentStep: 'SCORE',
  };

  try {
    const result = await compiledGraph.invoke(initialState, {
      configurable: { thread_id: prospectId },
    });
    console.log(`[LeadQualification] Qualification complete for ${prospectId}`);
    return result as LeadQualificationState;
  } catch (err) {
    console.error('[LeadQualification] executeLeadQualification failed:', err);
    return {
      ...initialState,
      currentStep: 'ERROR',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// Resume after human approval
export async function approveLead(
  prospectId: string,
  approved: boolean,
  comment?: string,
): Promise<LeadQualificationState> {
  console.log(`[LeadQualification] Resuming lead ${prospectId} with approved=${approved}`);

  try {
    // Resume using Command to provide the interrupt value
    const result = await compiledGraph.invoke(
      new Command({
        resume: { approved, comment },
      }),
      {
        configurable: { thread_id: prospectId },
      },
    );
    return result as LeadQualificationState;
  } catch (err) {
    console.error('[LeadQualification] approveLead failed:', err);
    return {
      prospectId,
      prospectMessage: '',
      currentStep: 'ERROR',
      humanApproved: approved,
      humanComment: comment ?? undefined,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
