// Anti-hardcoded: all config via process.env
// LangGraph Lead Qualification Workflow (WF-5)
/* eslint-disable no-console */

import { llmComplete } from '../litellm/router.js';

export type LeadQualificationState = {
  prospectId: string;
  prospectMessage: string;
  score: number;
  qualified: boolean;
  action: 'onboarding' | 'nurture' | 'reject';
  taskCreated: boolean;
  error?: string;
};

export async function executeLeadQualification(
  prospectMessage: string,
): Promise<LeadQualificationState> {
  const state: LeadQualificationState = {
    prospectId: `prospect-${Date.now()}`,
    prospectMessage,
    score: 0,
    qualified: false,
    action: 'nurture',
    taskCreated: false,
  };

  try {
    // Score the prospect
    state.score = await scoreProspect(prospectMessage);

    // Classify action based on score
    if (state.score >= 0.8) {
      state.action = 'onboarding';
      state.qualified = true;
    } else if (state.score >= 0.4) {
      state.action = 'nurture';
      state.qualified = false;
    } else {
      state.action = 'reject';
      state.qualified = false;
    }

    // Create appropriate task
    state.taskCreated = await createTask(state);

    return state;
  } catch (err) {
    console.error('[LangGraph] executeLeadQualification failed:', err);
    return { ...state, error: err instanceof Error ? err.message : String(err) };
  }
}

async function scoreProspect(message: string): Promise<number> {
  const prompt = `Analise esta mensagem de um prospecto de agência de marketing.

Mensagem: "${message}"

Avalie em 0-1:
- Clareza da necessidade
- Orçamento implícito
- Timeline implícita
- Fit com serviços de agência

Retorne apenas um número entre 0 e 1.`;

  try {
    const result = await llmComplete({
      messages: [{ role: 'user', content: prompt }],
      systemPrompt: 'Você é um especialista em qualificação de leads.',
      maxTokens: 10,
      temperature: 0,
    });

    const score = parseFloat(result.content);
    return Math.max(0, Math.min(1, isNaN(score) ? 0.5 : score));
  } catch (err) {
    console.error('[LangGraph] scoreProspect failed:', err);
    return 0;
  }
}

async function createTask(state: LeadQualificationState): Promise<boolean> {
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
    return true;
  } catch (err) {
    console.error('[LangGraph] createTask failed:', err);
    return false;
  }
}
