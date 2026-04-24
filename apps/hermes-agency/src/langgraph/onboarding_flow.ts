// Anti-hardcoded: all config via process.env
// LangGraph Onboarding Flow (WF-2) — Real StateGraph with interrupt
/* eslint-disable no-console */

import { MemorySaver, StateGraph, START, END, interrupt, Command } from '@langchain/langgraph';
import { bot } from '../telegram/bot.js';
import { COLLECTIONS } from '../qdrant/client.js';
import { fetchClient } from '../utils/fetch-client.js';

const QDRANT_URL = process.env['QDRANT_URL'] ?? 'http://localhost:6333';
const CHECKIN_DAYS = 7;

const checkpointer = new MemorySaver();

export type OnboardingState = {
  clientId: string;
  clientName: string;
  email: string;
  telegramChatId?: number;
  currentStep: string;
  profileCreated: boolean;
  qdrantInitialized: boolean;
  welcomeSent: boolean;
  milestoneCreated: boolean;
  checkinScheduled: boolean;
  humanApproved?: boolean;
  humanComment?: string;
  complete: boolean;
  error?: string;
};

// Node: Create client profile
async function createProfileNode(state: OnboardingState): Promise<Partial<OnboardingState>> {
  console.log(`[Onboarding] Creating profile for ${state.clientName}`);
  try {
    const res = await fetchClient(`${QDRANT_URL}/collections/${COLLECTIONS.CLIENTS}/points`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        points: [
          {
            id: state.clientId,
            vector: new Array(1024).fill(0),
            payload: {
              client_id: state.clientId,
              name: state.clientName,
              email: state.email,
              plan: 'trial',
              health_score: 100,
              onboarding_complete: false,
              created_at: new Date().toISOString(),
            },
          },
        ],
      }),
    });
    if (!res.ok) {
      console.error('[Onboarding] Failed to create client profile:', await res.text());
      return { currentStep: 'ERROR', error: 'Failed to create profile' };
    }
    console.log(`[Onboarding] Client profile created: ${state.clientId}`);
    return { currentStep: 'CREATE_PROFILE', profileCreated: true };
  } catch (err) {
    console.error('[Onboarding] createProfileNode error:', err);
    return { currentStep: 'ERROR', error: err instanceof Error ? err.message : String(err) };
  }
}

// Node: Initialize Qdrant collection
async function initQdrantNode(state: OnboardingState): Promise<Partial<OnboardingState>> {
  console.log(`[Onboarding] Initializing Qdrant collection for ${state.clientId}`);
  try {
    const clientCollectionName = `agency_client_${state.clientId}`;
    const res = await fetchClient(`${QDRANT_URL}/collections/${clientCollectionName}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vectors: {
          size: 1024,
          distance: 'Cosine',
        },
      }),
    });
    if (!res.ok) {
      console.error('[Onboarding] Failed to init Qdrant collection:', await res.text());
      return { currentStep: 'ERROR', error: 'Failed to init Qdrant collection' };
    }
    console.log(`[Onboarding] Client collection created: ${clientCollectionName}`);
    return { currentStep: 'INIT_QDRANT', qdrantInitialized: true };
  } catch (err) {
    console.error('[Onboarding] initQdrantNode error:', err);
    return { currentStep: 'ERROR', error: err instanceof Error ? err.message : String(err) };
  }
}

// Node: Human approval gate — INTERRUPT before welcome is sent
async function humanGateNode(state: OnboardingState): Promise<Partial<OnboardingState>> {
  console.log(`[Onboarding] Executing HUMAN_GATE — requesting interrupt for approval`);

  // Interrupt: wait for human approval BEFORE sending welcome
  // interrupt(value) returns the resume value passed via Command when graph is resumed
  const decision = await interrupt({
    clientId: state.clientId,
    clientName: state.clientName,
    message: `Aprovar onboarding para ${state.clientName}?`,
  });

  console.log(`[Onboarding] Human approval result: approved=${decision.approved}, comment=${decision.comment}`);
  return {
    currentStep: 'HUMAN_GATE',
    humanApproved: decision.approved,
    humanComment: decision.comment,
  };
}

// Node: Send welcome message (only executes if approved)
async function welcomeNode(state: OnboardingState): Promise<Partial<OnboardingState>> {
  if (!state.humanApproved) {
    console.log(`[Onboarding] Welcome not approved — skipping`);
    return { currentStep: 'WELCOME_SKIPPED', welcomeSent: false };
  }

  console.log(`[Onboarding] Sending welcome to ${state.email}`);
  try {
    const message = `🎉 *Bem-vindo à Hermes Agency Suite!*

Olá, *${state.clientName}*!

Seu perfil foi criado com sucesso. Estamos animados para trabalhar com você!

*Próximos passos:*
1. ✅ Configurar sua conta
2. 📋 Definir seus primeiros objetivos
3. 🚀 Lançar sua primeira campanha

Em 7 dias, faremos um check-in para ver como tudo está indo.

Precisa de ajuda? Digite /help a qualquer momento.`;

    if (state.telegramChatId) {
      await bot.telegram.sendMessage(state.telegramChatId, message, { parse_mode: 'Markdown' });
      console.log(`[Onboarding] Welcome sent via Telegram to chatId: ${state.telegramChatId}`);
    } else {
      console.log(`[Onboarding] No telegramChatId — would send to ${state.email}:`, message);
    }
    return { currentStep: 'WELCOME', welcomeSent: true };
  } catch (err) {
    console.error('[Onboarding] welcomeNode error:', err);
    return { currentStep: 'ERROR', error: err instanceof Error ? err.message : String(err) };
  }
}

// Node: Create first milestone
async function milestoneNode(state: OnboardingState): Promise<Partial<OnboardingState>> {
  console.log(`[Onboarding] Creating first milestone for ${state.clientId}`);
  try {
    const milestoneId = `milestone-${Date.now()}`;
    const checkinDate = new Date();
    checkinDate.setDate(checkinDate.getDate() + CHECKIN_DAYS);

    const res = await fetchClient(`${QDRANT_URL}/collections/${COLLECTIONS.TASKS}/points`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        points: [
          {
            id: milestoneId,
            vector: new Array(1024).fill(0),
            payload: {
              task_id: milestoneId,
              client_id: state.clientId,
              title: 'Check-in de Onboarding',
              description: `Revisão do progresso após ${CHECKIN_DAYS} dias`,
              status: 'scheduled',
              priority: 'high',
              due_date: checkinDate.toISOString(),
              task_type: 'checkin',
              created_at: new Date().toISOString(),
            },
          },
        ],
      }),
    });
    if (!res.ok) {
      console.error('[Onboarding] Failed to create milestone:', await res.text());
      return { currentStep: 'ERROR', error: 'Failed to create milestone' };
    }
    console.log(`[Onboarding] First milestone created: ${milestoneId}`);
    return { currentStep: 'MILESTONE', milestoneCreated: true };
  } catch (err) {
    console.error('[Onboarding] milestoneNode error:', err);
    return { currentStep: 'ERROR', error: err instanceof Error ? err.message : String(err) };
  }
}

// Node: Schedule check-in
async function checkinNode(state: OnboardingState): Promise<Partial<OnboardingState>> {
  console.log(`[Onboarding] Scheduling check-in for ${state.clientId}`);
  try {
    const checkinDate = new Date();
    checkinDate.setDate(checkinDate.getDate() + CHECKIN_DAYS);

    const checkinTaskId = `checkin-${Date.now()}`;
    const res = await fetchClient(`${QDRANT_URL}/collections/${COLLECTIONS.TASKS}/points`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        points: [
          {
            id: checkinTaskId,
            vector: new Array(1024).fill(0),
            payload: {
              task_id: checkinTaskId,
              client_id: state.clientId,
              title: `Check-in de 7 dias — ${state.clientName}`,
              description: `Review do progresso do cliente após ${CHECKIN_DAYS} dias de onboarding`,
              status: 'scheduled',
              priority: 'medium',
              due_date: checkinDate.toISOString(),
              task_type: 'scheduled_checkin',
              created_at: new Date().toISOString(),
            },
          },
        ],
      }),
    });
    if (!res.ok) {
      console.error('[Onboarding] Failed to schedule checkin:', await res.text());
      return { currentStep: 'ERROR', error: 'Failed to schedule checkin' };
    }
    console.log(`[Onboarding] Check-in scheduled for ${checkinDate.toISOString()}`);
    return { currentStep: 'CHECKIN', checkinScheduled: true, complete: true };
  } catch (err) {
    console.error('[Onboarding] checkinNode error:', err);
    return { currentStep: 'ERROR', error: err instanceof Error ? err.message : String(err) };
  }
}

// Conditional edge: route based on human approval AFTER interrupt resumes
function shouldContinue(state: OnboardingState): 'WELCOME' | 'END' {
  if (state.humanApproved === true) {
    return 'WELCOME';
  }
  return 'END';
}

// Build the StateGraph
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const workflow = new StateGraph<any>({
  channels: {
    clientId: { type: 'string' },
    clientName: { type: 'string' },
    email: { type: 'string' },
    telegramChatId: { type: 'number', nullable: true },
    currentStep: { type: 'string' },
    profileCreated: { type: 'boolean' },
    qdrantInitialized: { type: 'boolean' },
    welcomeSent: { type: 'boolean' },
    milestoneCreated: { type: 'boolean' },
    checkinScheduled: { type: 'boolean' },
    humanApproved: { type: 'boolean', nullable: true },
    humanComment: { type: 'string', nullable: true },
    complete: { type: 'boolean' },
    error: { type: 'string', nullable: true },
  },
})
  .addNode('CREATE_PROFILE', createProfileNode)
  .addNode('INIT_QDRANT', initQdrantNode)
  .addNode('HUMAN_GATE', humanGateNode)
  .addNode('WELCOME', welcomeNode)
  .addNode('MILESTONE', milestoneNode)
  .addNode('CHECKIN', checkinNode)
  .addEdge(START, 'CREATE_PROFILE')
  .addEdge('CREATE_PROFILE', 'INIT_QDRANT')
  .addEdge('INIT_QDRANT', 'HUMAN_GATE')
  .addConditionalEdges('HUMAN_GATE', shouldContinue)
  .addEdge('WELCOME', 'MILESTONE')
  .addEdge('MILESTONE', 'CHECKIN')
  .addEdge('CHECKIN', END);

const compiledGraph = workflow.compile({ checkpointer });

export { compiledGraph as onboardingGraph };

// Execute the onboarding flow
export async function executeOnboardingFlow(
  clientName: string,
  email: string,
  telegramChatId?: number,
): Promise<OnboardingState> {
  const clientId = `client-${Date.now()}`;
  console.log(`[Onboarding] Starting onboarding flow for ${clientName} (${clientId})`);

  const initialState: OnboardingState = {
    clientId,
    clientName,
    email,
    telegramChatId,
    currentStep: 'START',
    profileCreated: false,
    qdrantInitialized: false,
    welcomeSent: false,
    milestoneCreated: false,
    checkinScheduled: false,
    complete: false,
  };

  try {
    const result = await compiledGraph.invoke(initialState, {
      configurable: { thread_id: clientId },
    });
    console.log(`[Onboarding] Flow complete for ${clientId}`);
    return result as OnboardingState;
  } catch (err) {
    console.error('[Onboarding] executeOnboardingFlow failed:', err);
    return {
      ...initialState,
      currentStep: 'ERROR',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// Resume after human approval
export async function approveOnboarding(
  clientId: string,
  approved: boolean,
  comment?: string,
): Promise<OnboardingState> {
  console.log(`[Onboarding] Resuming onboarding ${clientId} with approved=${approved}`);

  try {
    // Resume using Command to provide the interrupt value
    const result = await compiledGraph.invoke(
      new Command({
        resume: { approved, comment },
      }),
      {
        configurable: { thread_id: clientId },
      },
    );
    return result as OnboardingState;
  } catch (err) {
    console.error('[Onboarding] approveOnboarding failed:', err);
    return {
      clientId,
      clientName: '',
      email: '',
      currentStep: 'ERROR',
      profileCreated: false,
      qdrantInitialized: false,
      welcomeSent: false,
      milestoneCreated: false,
      checkinScheduled: false,
      humanApproved: approved,
      humanComment: comment ?? undefined,
      complete: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}