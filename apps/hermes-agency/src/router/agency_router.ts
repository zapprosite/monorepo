// Anti-hardcoded: all config via process.env
// Agency Router — Hermes → skill dispatcher

import { AGENCY_SKILLS, getSkillById, getSkillByTrigger } from '../skills/index.ts';

const HERMES_URL = process.env.HERMES_GATEWAY_URL ?? 'http://127.0.0.1:8642';
const LLM_URL = process.env.LITELLM_LOCAL_URL ?? 'http://localhost:4000/v1';
const LLM_KEY = process.env.LITELLM_MASTER_KEY ?? '';
const BRAND_GUARDIAN_THRESHOLD = 0.8;
const HUMAN_GATE_THRESHOLD = 0.7;

export interface RouterContext {
  skillId: string;
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

async function askCeoToRoute(input: string, ctx: RouterContext): Promise<string> {
  const available = AGENCY_SKILLS.map((s) => ({
    id: s.id,
    name: s.name,
    triggers: s.triggers.join(', '),
  })).join('\n');

  const prompt = `Você é o CEO MIX de uma agência de marketing. Analise a mensagem e escolha a skill mais adequada.

Mensagem: "${input}"
Usuário: ${ctx.userId}

Skills disponíveis:
${available}

Responda apenas com o ID da skill (ex: agency-onboarding).`;

  const response = await fetch(`${LLM_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${LLM_KEY}`,
    },
    body: JSON.stringify({
      model: 'ollama/qwen2.5vl:7b',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 50,
      temperature: 0.1,
    }),
  });

  const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content ?? 'agency-ceo';
  const skillId = content
    .trim()
    .split('\n')[0]
    .replace(/[^a-z-]/g, '');

  return getSkillById(skillId) ? skillId : 'agency-ceo';
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
    return `🤔 Confiança baixa (${confidence.toFixed(2)}) —人类的确认 required.\n\nMensagem: "${input}"\nSkill sugerida: ${skill.name}`;
  }

  return `✅ Routed to **${skill.name}**\n📋 Tools: ${skill.tools.join(', ')}\n🎯 Executing: ${input.substring(0, 100)}...`;
}

async function scoreContent(content: string): Promise<number> {
  const prompt = `Analise este conteúdo quanto à consistência de marca (tom, valores, estilo). Retorne um número entre 0 e 1.

Conteúdo: "${content}"

Responda apenas com o número.`;

  try {
    const response = await fetch(`${LLM_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${LLM_KEY}`,
      },
      body: JSON.stringify({
        model: 'ollama/qwen2.5vl:7b',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 10,
        temperature: 0,
      }),
    });
    const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const score = parseFloat(data.choices?.[0]?.message?.content ?? '0.5');
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
    const response = await fetch(`${LLM_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${LLM_KEY}`,
      },
      body: JSON.stringify({
        model: 'ollama/qwen2.5vl:7b',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 10,
        temperature: 0,
      }),
    });
    const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const score = parseFloat(data.choices?.[0]?.message?.content ?? '0.5');
    return Math.max(0, Math.min(1, score));
  } catch {
    return 0.5;
  }
}
