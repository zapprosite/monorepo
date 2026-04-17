// Anti-hardcoded: all config via process.env
// Agency Router — Hermes → skill dispatcher

import { AGENCY_SKILLS, getSkillById, getSkillByTrigger } from '../skills/index.ts';
import { llmComplete } from '../litellm/router.ts';

const BRAND_GUARDIAN_THRESHOLD = 0.8;
const HUMAN_GATE_THRESHOLD = parseFloat(process.env.HUMAN_GATE_THRESHOLD ?? '0.7');
const CEO_MODEL = process.env.CEO_MODEL ?? 'gpt-4o';

export interface RouterContext {
  userId: string;
  chatId: number;
  message: string;
}

export async function routeToSkill(input: string, ctx: RouterContext): Promise<string> {
  // 1. Try trigger-based routing
  const triggered = getSkillByTrigger(input);
  if (triggered) {
    return executeSkill(triggered.id, input, ctx);
  }

  // 2. Ask CEO (LLM) to decide which skill
  const decision = await askCeoToRoute(input, ctx);
  return executeSkill(decision, input, ctx);
}

/**
 * Sanitizes user input to prevent prompt injection.
 * Removes control characters and escapes special characters that could
 * manipulate LLM behavior.
 */
function sanitizeForPrompt(input: string): string {
  return input
    .replace(/\x00/g, '') // Remove null bytes
    .replace(/[\x00-\x1F\x7F]/g, ' ') // Remove control characters
    .replace(/\\/g, '\\\\') // Escape backslashes
    .replace(/"/g, '\\"') // Escape double quotes
    .replace(/\n/g, '\\n') // Escape newlines
    .replace(/\r/g, '\\r') // Escape carriage returns
    .replace(/\t/g, '\\t') // Escape tabs
    .slice(0, 2000); // Limit input length
}

async function askCeoToRoute(input: string, ctx: RouterContext): Promise<string> {
  const available = AGENCY_SKILLS.map((s) => ({
    id: s.id,
    name: s.name,
    triggers: s.triggers.join(', '),
  })).join('\n');

  const sanitizedInput = sanitizeForPrompt(input);

  const prompt = `Você é o CEO MIX de uma agência de marketing. Analise a mensagem e escolha a skill mais adequada.

Mensagem: "${sanitizedInput}"
Usuário: ${ctx.userId}

Skills disponíveis:
${available}

Responda apenas com o ID da skill (ex: agency-onboarding).`;

  const result = await llmComplete({
    messages: [{ role: 'user', content: prompt }],
    maxTokens: 50,
    temperature: 0.1,
    model: CEO_MODEL,
  });

  const content = result.content;
  const rawSkillId = content
    .trim()
    .split('\n')[0]
    .replace(/[^a-z-]/g, '');

  // Defense-in-depth: validate against known skill IDs whitelist
  const validSkillIds = new Set(AGENCY_SKILLS.map((s) => s.id));
  const skillId = validSkillIds.has(rawSkillId) ? rawSkillId : 'agency-ceo';

  console.log(`[agency_router] CEO routed "${input.substring(0, 60)}..." → ${skillId} (model=${CEO_MODEL}, raw="${content.trim()}")`);

  return skillId;
}

async function executeSkill(skillId: string, input: string, ctx: RouterContext): Promise<string> {
  const skill = getSkillById(skillId);
  if (!skill) {
    return `❌ Skill não encontrada: ${skillId}`;
  }

  // Brand Guardian gate — mandatory for content before publishing
  if (['agency-creative', 'agency-social', 'agency-design'].includes(skillId)) {
    const brandScore = await scoreContent(input);
    if (brandScore < BRAND_GUARDIAN_THRESHOLD) {
      return `⚠️ Brand Guardian score: ${brandScore.toFixed(2)} (< ${BRAND_GUARDIAN_THRESHOLD})\n🔒 Publicação bloqueada — revisão humana necessária.`;
    }
  }

  // Human gate — confidence < 0.7
  const confidence = await assessConfidence(input);
  if (confidence < HUMAN_GATE_THRESHOLD) {
    return `🤔 Confiança baixa (${confidence.toFixed(2)}) — confirmação humana requerida.\n\nMensagem: "${input}"\nSkill sugerida: ${skill.name}`;
  }

  return `✅ Routed to **${skill.name}**\n📋 Tools: ${skill.tools.join(', ')}\n🎯 Executing: ${input.substring(0, 100)}...`;
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
