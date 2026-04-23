// Anti-hardcoded: all config via process.env
// Agency Onboarding Skill — creates client profiles, initializes Qdrant collections, sends welcome messages

import { randomUUID } from 'node:crypto';
import {
  COLLECTIONS,
  upsertVector,
  createCollectionIfNotExists,
  type CollectionName,
} from '../qdrant/client.js';
import { llmComplete, type LLMRequest } from '../litellm/router.js';

const HERMES_AGENCY_BOT_TOKEN = process.env['HERMES_AGENCY_BOT_TOKEN'] ?? '';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Zero vector for payload-only records (no embedding needed) */
const ZERO_VECTOR = Array(1024).fill(0);

interface ClientProfile {
  client_id: string;
  name: string;
  plan: string;
  health_score: number;
  onboarding_complete: boolean;
  created_at: string;
}

interface TaskRecord {
  task_id: string;
  campaign_id: string;
  assignee: string;
  status: string;
  priority: string;
  title: string;
  description: string;
  due_date?: string;
}

/**
 * Generates a personalized welcome message using the LLM.
 */
async function generateWelcomeMessage(clientName: string, plan: string): Promise<string> {
  const req: LLMRequest = {
    systemPrompt:
      'You are Hermes, the agency coordination AI. Generate a warm, professional welcome message for a new agency client. Keep it concise (2-3 short paragraphs). Include: 1) Welcome and excitement, 2) What the agency will do for them, 3) First steps hint.',
    messages: [
      {
        role: 'user',
        content: `Generate a welcome message for a new client called "${clientName}" on the "${plan}" plan.`,
      },
    ],
    maxTokens: 500,
    temperature: 0.8,
  };

  const response = await llmComplete(req);
  return response.content;
}

// ---------------------------------------------------------------------------
// Skill Functions
// ---------------------------------------------------------------------------

/**
 * Creates a new client profile in the agency_clients Qdrant collection.
 * Returns the client_id on success.
 */
export async function createClientProfile(
  clientName: string,
  plan: string,
): Promise<{ success: boolean; clientId?: string; error?: string }> {
  try {
    const clientId = randomUUID();
    const profile: ClientProfile = {
      client_id: clientId,
      name: clientName,
      plan,
      health_score: 100,
      onboarding_complete: false,
      created_at: new Date().toISOString(),
    };

    const saved = await upsertVector({
      collection: COLLECTIONS.CLIENTS,
      id: clientId,
      vector: ZERO_VECTOR,
      payload: profile,
    });

    if (!saved) {
      return { success: false, error: 'Failed to upsert client profile to Qdrant' };
    }

    console.log(`[Onboarding] Created client profile: ${clientName} (${clientId})`);
    return { success: true, clientId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[Onboarding] createClientProfile error:`, message);
    return { success: false, error: message };
  }
}

/**
 * Initializes Qdrant collections for a new client.
 * Creates client-specific collections using agency_* schemas as templates.
 * Collections created: agency_{clientId}_campaigns, agency_{clientId}_assets, agency_{clientId}_conversations
 */
export async function initQdrantCollection(
  clientId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    // Client-specific collections
    const clientCollections: CollectionName[] = [
      `agency_${clientId}_campaigns` as CollectionName,
      `agency_${clientId}_assets` as CollectionName,
      `agency_${clientId}_conversations` as CollectionName,
    ];

    const results = await Promise.all(
      clientCollections.map((name) => createCollectionIfNotExists(name)),
    );

    const allSuccess = results.every(Boolean);
    if (!allSuccess) {
      return { success: false, error: 'Some client collections failed to create' };
    }

    console.log(`[Onboarding] Initialized Qdrant collections for client ${clientId}`);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[Onboarding] initQdrantCollection error:`, message);
    return { success: false, error: message };
  }
}

/**
 * Sends a welcome sequence to the client via Telegram.
 * Uses the HERMES_AGENCY_BOT_TOKEN to send a message to the client's chat_id.
 */
export async function sendWelcomeSequence(
  clientId: string,
  chatId?: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!HERMES_AGENCY_BOT_TOKEN) {
      return { success: false, error: 'HERMES_AGENCY_BOT_TOKEN not configured' };
    }

    if (!chatId) {
      return { success: false, error: 'chatId required for Telegram message' };
    }

    // Fetch client name from Qdrant to personalize message
    // For now, use a generic message if we can't get the name
    const welcomeText = `🎉 Welcome to the Agency!

Your account is now set up and ready to go. Our team is excited to start working with you.

You'll receive your first campaign brief shortly. In the meantime, feel free to explore our services.

Best,
Hermes Agency AI`;

    const url = `https://api.telegram.org/bot${HERMES_AGENCY_BOT_TOKEN}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: welcomeText,
        parse_mode: 'Markdown',
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return { success: false, error: `Telegram API error: ${errText}` };
    }

    console.log(`[Onboarding] Sent welcome sequence to chat ${chatId}`);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[Onboarding] sendWelcomeSequence error:`, message);
    return { success: false, error: message };
  }
}

/**
 * Creates the first milestone/task for a new client campaign.
 * Stores the task in the agency_tasks Qdrant collection.
 */
export async function createFirstMilestone(
  clientId: string,
  campaignName: string,
): Promise<{ success: boolean; taskId?: string; error?: string }> {
  try {
    const taskId = randomUUID();
    const campaignId = randomUUID();

    const milestone: TaskRecord = {
      task_id: taskId,
      campaign_id: campaignId,
      assignee: 'unassigned',
      status: 'pending',
      priority: 'high',
      title: `Launch: ${campaignName}`,
      description: `First milestone for new client campaign "${campaignName}". Deliverables: brand brief review, initial strategy session, first content draft.`,
      due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
    };

    const saved = await upsertVector({
      collection: COLLECTIONS.TASKS,
      id: taskId,
      vector: ZERO_VECTOR,
      payload: milestone,
    });

    if (!saved) {
      return { success: false, error: 'Failed to upsert milestone to Qdrant' };
    }

    console.log(`[Onboarding] Created first milestone for client ${clientId}: ${taskId}`);
    return { success: true, taskId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[Onboarding] createFirstMilestone error:`, message);
    return { success: false, error: message };
  }
}
