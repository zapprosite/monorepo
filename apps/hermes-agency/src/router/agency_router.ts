// Anti-hardcoded: all config via process.env
// Agency Router — Hermes → skill dispatcher (CEO_REFRIMIX_bot supervisor)
/* eslint-disable no-console */

import { AGENCY_SKILLS, getSkillById, getSkillByTrigger } from '../skills/index.js';
import { TOOL_REGISTRY, createInitialState, type SupervisorState } from '../skills/tool_registry.js';
import { llmComplete } from '../litellm/router.js';
// SPEC-068: Canonical circuit breaker — replaces inline HC-36 from SPEC-060
import { isCallPermitted, recordSuccess, recordFailure } from '../skills/circuit_breaker.js';
// Mem0 memory client — session persistence via Qdrant
import { mem0GetRecent, mem0Store, addToSessionHistory, formatMem0Context } from '../mem0/client.js';
// RAG context retrieval via Trieve
import { ragRetrieve, type RagSearchResult } from '../skills/rag-instance-organizer.js';

const BRAND_GUARDIAN_THRESHOLD = 0.8;
const HUMAN_GATE_THRESHOLD = parseFloat(process.env['HUMAN_GATE_THRESHOLD'] ?? '0.7');
const CEO_MODEL = process.env['CEO_MODEL'] ?? 'gpt-4o';

// Per-session supervisor state (in-memory — survives across messages in same session)
const _sessionStates = new Map<string, AgencySupervisorState>();

export interface RouterContext {
  userId: string;
  chatId: number;
  message: string;
  sessionId?: string;
}

// Extended session state with conversation history
interface AgencySupervisorState extends SupervisorState {
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string; timestamp: number }>;
}

export async function routeToSkill(input: string, ctx: RouterContext): Promise<string> {
  const sessionId = ctx.sessionId ?? String(ctx.chatId);

  // Store user message in conversation history
  await storeInHistory(sessionId, 'user', input);

  // 1. Try trigger-based routing
  const triggered = getSkillByTrigger(input);
  if (triggered) {
    return executeSkill(triggered.id, input, ctx, sessionId);
  }

  // 2. Ask CEO (LLM) to decide which skill
  const decision = await askCeoToRoute(input, ctx, sessionId);
  return executeSkill(decision, input, ctx, sessionId);
}

/**
 * Store a message in session conversation history (both memory cache and Qdrant).
 */
async function storeInHistory(sessionId: string, role: 'user' | 'assistant', content: string): Promise<void> {
  const timestamp = Date.now();
  // Add to in-memory history
  addToSessionHistory(sessionId, { sessionId, role, content, timestamp, importance: 'normal' });
  // Persist to Qdrant via Mem0 (timestamp generated internally)
  await mem0Store({ sessionId, role, content });
}

/**
 * Sanitizes user input to prevent prompt injection.
 * Removes control characters and escapes special characters that could
 * manipulate LLM behavior.
 */
function sanitizeForPrompt(input: string): string {
  return (
    input
      // eslint-disable-next-line no-control-regex
      .replace(/\x00/g, '') // Remove null bytes
      // eslint-disable-next-line no-control-regex
      .replace(/[\x00-\x1F\x7F]/g, ' ') // Remove control characters
      .replace(/\\/g, '\\\\') // Escape backslashes
      .replace(/"/g, '\\"') // Escape double quotes
      .replace(/\n/g, '\\n') // Escape newlines
      .replace(/\r/g, '\\r') // Escape carriage returns
      .replace(/\t/g, '\\t') // Escape tabs
      .slice(0, 2000)
  ); // Limit input length
}

async function askCeoToRoute(input: string, ctx: RouterContext, sessionId: string): Promise<string> {
  const available = AGENCY_SKILLS.map((s) => ({
    id: s.id,
    name: s.name,
    triggers: s.triggers.join(', '),
  })).join('\n');

  const sanitizedInput = sanitizeForPrompt(input);

  // ─────────────────────────────────────────────────────────────────
  // Inject Mem0 memory context — recent conversation history
  // ─────────────────────────────────────────────────────────────────
  const recentMemory = await mem0GetRecent(sessionId, 5);
  const memoryContext = formatMem0Context(recentMemory);

  // ─────────────────────────────────────────────────────────────────
  // Inject RAG context — relevant knowledge from Trieve
  // ─────────────────────────────────────────────────────────────────
  let ragContext = '// No RAG context available';
  try {
    const ragResults = await ragRetrieve(sanitizedInput, 3);
    if (ragResults.length > 0) {
      ragContext = ragResults
        .map((r: RagSearchResult) => `— [score:${r.score.toFixed(2)}] ${r.content.slice(0, 300)}`)
        .join('\n');
    }
  } catch (ragErr) {
    console.warn('[agency_router] RAG retrieve failed:', ragErr);
  }

  // ─────────────────────────────────────────────────────────────────
  // CEO prompt — REFRIMIX CEO persona (design/marketing company)
  // ─────────────────────────────────────────────────────────────────
  const prompt = `Você é o CEO da REFRIMIX, uma empresa de design e marketing.
Você coordena agentes especializados para entregar campanhas de alto impacto.
Analise a mensagem do cliente e escolha a skill mais adequada para atender à demanda.

como CEO da REFRIMIX, você pensa em:
- Planejamento de campanhas publicitárias
- Estratégia de marca e posicionamento
- Direção criativa e design
- Análise de mercado e público-alvo
- Métricas de campanha e resultados

Mensagem: "${sanitizedInput}"
Usuário: ${ctx.userId}

## Contexto de Memória (histórico recente):
${memoryContext}

## Contexto de Conhecimento (RAG):
${ragContext}

Skills disponíveis:
${available}

Responda apenas com o ID da skill (ex: agency-onboarding).`;

  let content = '';
  try {
    const result = await llmComplete({
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 50,
      temperature: 0.1,
      model: CEO_MODEL,
    });
    if (result?.content) {
      content = result.content;
    }
  } catch (err) {
    // HC-23: LLM failure — return agency-ceo as safe fallback instead of propagating
    console.error('[agency_router] askCeoToRoute LLM failed:', err);
    return 'agency-ceo';
  }
  const firstLine = ((content as string) || '').trim().split('\n')[0] ?? '';
  const rawSkillId = firstLine.replace(/[^a-z-]/g, '');

  // Defense-in-depth: validate against known skill IDs whitelist
  const validSkillIds = new Set(AGENCY_SKILLS.map((s) => s.id));
  const skillId = validSkillIds.has(rawSkillId) ? rawSkillId : 'agency-ceo';

  console.log(
    `[agency_router] CEO routed "${input.substring(0, 60)}..." → ${skillId} (model=${CEO_MODEL}, raw="${content.trim()}")`,
  );

  return skillId;
}

async function executeSkill(
  skillId: string,
  input: string,
  _ctx: RouterContext,
  sessionId: string,
): Promise<string> {
  // SPEC-068: Circuit breaker — reject if OPEN
  if (!isCallPermitted(skillId)) {
    return `⚠️ Skill ${skillId} temporarily unavailable (circuit breaker open). Try again later.`;
  }

  const skill = getSkillById(skillId);
  if (!skill) {
    return `❌ Skill não encontrada: ${skillId}`;
  }

  // Get or create session state
  let state = _sessionStates.get(sessionId);
  if (!state) {
    const initial = createInitialState();
    state = { ...initial, conversationHistory: [] };
    _sessionStates.set(sessionId, state);
  }
  state.currentSkill = skillId;

  try {
    // Brand Guardian gate — mandatory for content before publishing
    if (['agency-creative', 'agency-social', 'agency-design'].includes(skillId)) {
      const brandScore = await scoreContent(input);
      if (brandScore < BRAND_GUARDIAN_THRESHOLD) {
        recordSuccess(skillId);
        return `⚠️ Brand Guardian score: ${brandScore.toFixed(2)} (< ${BRAND_GUARDIAN_THRESHOLD})\n🔒 Publicação bloqueada — revisão humana necessária.`;
      }
    }

    // Human gate — confidence < 0.7
    const confidence = await assessConfidence(input);
    if (confidence < HUMAN_GATE_THRESHOLD) {
      recordSuccess(skillId);
      return `🤔 Confiança baixa (${confidence.toFixed(2)}) — confirmação humana requerida.\n\nMensagem: "${input}"\nSkill sugerida: ${skill.name}`;
    }

    // ─────────────────────────────────────────────────────────────────────
    // CEO_REFRIMIX_bot: Execute skill tools in sequence
    // Store assistant response in history after tools complete
    const toolResults: Array<{ tool: string; result: unknown }> = [];
    for (const toolName of skill.tools) {
      // Check circuit breaker for this specific tool
      if (!isCallPermitted(toolName)) {
        toolResults.push({ tool: toolName, result: { error: 'circuit breaker open' } });
        continue;
      }

      const toolFn = TOOL_REGISTRY[toolName];
      if (!toolFn) {
        toolResults.push({ tool: toolName, result: { error: 'tool not implemented' } });
        continue;
      }

      // Pass the user's message as the primary input to the first tool
      const toolArgs = { input, message: input, query: input };
      const result = await toolFn(toolArgs);

      if (!result.ok) {
        toolResults.push({ tool: toolName, result: { error: result.error } });
        recordFailure(toolName, result.error ?? 'unknown');
      } else {
        toolResults.push({ tool: toolName, result: result.data });
        recordSuccess(toolName);
      }
    }

    state.lastResult = toolResults;

    // ─────────────────────────────────────────────────────────────────────
    // Return structured result (CEO_REFRIMIX_bot format)
    // ─────────────────────────────────────────────────────────────────────
    const toolsSummary = toolResults
      .map((t) => `  • ${t.tool}: ${JSON.stringify(t.result).slice(0, 100)}`)
      .join('\n');

    const responseMessage = [
      `✅ CEO_REFRIMIX_bot executou **${skill.name}**`,
      `📋 Skill ID: \`${skillId}\``,
      `🔧 Tools executados: ${skill.tools.length}`,
      ``,
      `\`\`\`\n${toolsSummary}\n\`\`\``,
      `🎯 Input: "${input.slice(0, 100)}"`,
    ].join('\n');

    // Store assistant response in conversation history
    await storeInHistory(sessionId, 'assistant', responseMessage);

    recordSuccess(skillId);
    return responseMessage;
  } catch (err) {
    recordFailure(skillId, err instanceof Error ? err.message : String(err));
    throw err;
  }
}

async function scoreContent(content: string): Promise<number> {
  const prompt = `Analise este conteúdo quanto à consistência de marca (tom, valores, estilo). Retorne um número entre 0 e 1.

Conteúdo: "${content}"

Responda apenas com o número.`;

  try {
    const result = await llmComplete({
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 10,
      temperature: 0,
    });
    const score = parseFloat(result.content);
    return Math.max(0, Math.min(1, score));
  } catch {
    return 0.5;
  }
}

async function assessConfidence(input: string): Promise<number> {
  const prompt = `Avalie a clareza desta mensagem de cliente. Retorne 0-1.

Mensagem: "${input}"

0 = completamente vaga, não entendo o que o cliente quer.
1 = completamente clara, sei exatamente o que fazer.

Responda apenas com o número.`;

  try {
    const result = await llmComplete({
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 10,
      temperature: 0,
    });
    const score = parseFloat(result.content);
    return Math.max(0, Math.min(1, score));
  } catch {
    return 0.5;
  }
}

/**
 * Get supervisor state for a session (for debugging/admin)
 */
export function getSessionState(sessionId: string): AgencySupervisorState | null {
  return _sessionStates.get(sessionId) ?? null;
}

/**
 * Clear session state (for memory management)
 */
export function clearSessionState(sessionId: string): void {
  _sessionStates.delete(sessionId);
}

