// Anti-hardcoded: all config via process.env
// LangGraph Onboarding Flow (WF-2)

import { bot } from '../telegram/bot.ts';
import { COLLECTIONS } from '../qdrant/client.ts';

const QDRANT_URL = process.env['QDRANT_URL'] ?? 'http://localhost:6333';
const CHECKIN_DAYS = 7;

export type OnboardingState = {
  clientId: string;
  clientName: string;
  email: string;
  telegramChatId?: number;
  step: string;
  profileCreated: boolean;
  qdrantInitialized: boolean;
  welcomeSent: boolean;
  milestoneCreated: boolean;
  checkinScheduled: boolean;
  complete: boolean;
};

export async function executeOnboardingFlow(
  clientName: string,
  email: string,
  telegramChatId?: number,
): Promise<OnboardingState> {
  const state: OnboardingState = {
    clientId: `client-${Date.now()}`,
    clientName,
    email,
    telegramChatId,
    step: 'CREATE_PROFILE',
    profileCreated: false,
    qdrantInitialized: false,
    welcomeSent: false,
    milestoneCreated: false,
    checkinScheduled: false,
    complete: false,
  };

  // Step 1: Create client profile
  state.profileCreated = await createClientProfile(state);
  state.step = 'INIT_QDRANT';

  // Step 2: Initialize Qdrant collection for client
  state.qdrantInitialized = await initQdrantCollection(state);
  state.step = 'WELCOME';

  // Step 3: Send welcome sequence
  state.welcomeSent = await sendWelcomeSequence(state);
  state.step = 'MILESTONE';

  // Step 4: Create first milestone
  state.milestoneCreated = await createFirstMilestone(state);
  state.step = 'CHECKIN';

  // Step 5: Schedule check-in
  state.checkinScheduled = await scheduleCheckin(state);
  state.complete = true;

  return state;
}

async function createClientProfile(state: OnboardingState): Promise<boolean> {
  console.log(`[Onboarding] Creating profile for ${state.clientName}`);
  try {
    const res = await fetch(`${QDRANT_URL}/collections/${COLLECTIONS.CLIENTS}/points`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        points: [
          {
            id: state.clientId,
            vector: new Array(1024).fill(0), // placeholder vector
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
      return false;
    }
    console.log(`[Onboarding] Client profile created: ${state.clientId}`);
    return true;
  } catch (err) {
    console.error('[Onboarding] createClientProfile error:', err);
    return false;
  }
}

async function initQdrantCollection(state: OnboardingState): Promise<boolean> {
  console.log(`[Onboarding] Initializing Qdrant collection for ${state.clientId}`);
  try {
    // Create a client-specific sub-collection using namespace prefix
    const clientCollectionName = `agency_client_${state.clientId}`;
    const res = await fetch(`${QDRANT_URL}/collections/${clientCollectionName}`, {
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
      return false;
    }
    console.log(`[Onboarding] Client collection created: ${clientCollectionName}`);
    return true;
  } catch (err) {
    console.error('[Onboarding] initQdrantCollection error:', err);
    return false;
  }
}

async function sendWelcomeSequence(state: OnboardingState): Promise<boolean> {
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
    return true;
  } catch (err) {
    console.error('[Onboarding] sendWelcomeSequence error:', err);
    return false;
  }
}

async function createFirstMilestone(state: OnboardingState): Promise<boolean> {
  console.log(`[Onboarding] Creating first milestone for ${state.clientId}`);
  try {
    const milestoneId = `milestone-${Date.now()}`;
    const checkinDate = new Date();
    checkinDate.setDate(checkinDate.getDate() + CHECKIN_DAYS);

    const res = await fetch(`${QDRANT_URL}/collections/${COLLECTIONS.TASKS}/points`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        points: [
          {
            id: milestoneId,
            vector: new Array(1024).fill(0), // placeholder vector
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
      return false;
    }
    console.log(`[Onboarding] First milestone created: ${milestoneId}`);
    return true;
  } catch (err) {
    console.error('[Onboarding] createFirstMilestone error:', err);
    return false;
  }
}

async function scheduleCheckin(state: OnboardingState): Promise<boolean> {
  console.log(`[Onboarding] Scheduling check-in for ${state.clientId}`);
  try {
    const checkinDate = new Date();
    checkinDate.setDate(checkinDate.getDate() + CHECKIN_DAYS);

    // Store checkin reminder in agency_tasks collection
    const checkinTaskId = `checkin-${Date.now()}`;
    const res = await fetch(`${QDRANT_URL}/collections/${COLLECTIONS.TASKS}/points`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        points: [
          {
            id: checkinTaskId,
            vector: new Array(1024).fill(0), // placeholder vector
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
      return false;
    }
    console.log(`[Onboarding] Check-in scheduled for ${checkinDate.toISOString()}`);
    return true;
  } catch (err) {
    console.error('[Onboarding] scheduleCheckin error:', err);
    return false;
  }
}
