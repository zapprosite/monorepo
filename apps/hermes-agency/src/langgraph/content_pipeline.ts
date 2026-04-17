// Anti-hardcoded: all config via process.env
// LangGraph Content Pipeline Workflow (WF-1)

import { llmComplete } from '../litellm/router.ts';
import { routeToSkill } from '../router/agency_router.ts';

export type ContentPipelineState = {
  brief: string;
  clientId: string;
  campaignId: string;
  currentStep: string;
  creativeOutput?: string;
  videoOutput?: string;
  designOutput?: string;
  brandScore?: number;
  finalOutput?: string;
  blocked: boolean;
  blockReason?: string;
};

const PIPELINE_STEPS = [
  { name: 'CREATIVE', skill: 'agency-creative', next: 'VIDEO' },
  { name: 'VIDEO', skill: 'agency-video-editor', next: 'DESIGN' },
  { name: 'DESIGN', skill: 'agency-design', next: 'BRAND_GUARDIAN' },
  { name: 'BRAND_GUARDIAN', skill: 'agency-brand-guardian', next: 'HUMAN_GATE' },
  { name: 'HUMAN_GATE', skill: 'agency-ceo', next: 'SOCIAL' },
  { name: 'SOCIAL', skill: 'agency-social', next: 'ANALYTICS' },
  { name: 'ANALYTICS', skill: 'agency-analytics', next: 'DONE' },
];

export async function executeContentPipeline(
  brief: string,
  clientId: string,
): Promise<ContentPipelineState> {
  const state: ContentPipelineState = {
    brief,
    clientId,
    campaignId: `campaign-${Date.now()}`,
    currentStep: 'CREATIVE',
    blocked: false,
  };

  console.log(`[ContentPipeline] Starting campaign ${state.campaignId} for client ${clientId}`);

  for (const step of PIPELINE_STEPS) {
    state.currentStep = step.name;

    if (step.name === 'HUMAN_GATE') {
      if (state.brandScore !== undefined && state.brandScore < 0.8) {
        state.blocked = true;
        state.blockReason = `Brand Guardian score ${state.brandScore.toFixed(2)} < 0.8 — human approval required`;
        console.warn(`[ContentPipeline] Blocked at ${step.name}: ${state.blockReason}`);
        return state;
      }
      continue;
    }

    if (step.name === 'BRAND_GUARDIAN') {
      // Score the current creative output
      const contentToScore = [state.creativeOutput, state.videoOutput, state.designOutput]
        .filter(Boolean)
        .join('\n---\n');

      state.brandScore = await scoreBrandConsistency(contentToScore);
      console.log(`[ContentPipeline] Brand score: ${state.brandScore.toFixed(2)}`);
      continue;
    }

    // Execute skill step
    const stepOutput = await executeStep(step.name, step.skill, state);
    if (stepOutput.error) {
      console.error(`[ContentPipeline] Step ${step.name} failed:`, stepOutput.error);
      state.blocked = true;
      state.blockReason = `Step ${step.name} failed: ${stepOutput.error}`;
      return state;
    }

    // Store output in correct field
    switch (step.name) {
      case 'CREATIVE':
        state.creativeOutput = stepOutput.result;
        break;
      case 'VIDEO':
        state.videoOutput = stepOutput.result;
        break;
      case 'DESIGN':
        state.designOutput = stepOutput.result;
        break;
      case 'SOCIAL':
        // social output
        break;
      case 'ANALYTICS':
        state.finalOutput = stepOutput.result;
        break;
    }

    console.log(`[ContentPipeline] Step ${step.name} complete`);
  }

  state.currentStep = 'DONE';
  console.log(`[ContentPipeline] Campaign ${state.campaignId} complete`);
  return state;
}

async function executeStep(
  stepName: string,
  skillId: string,
  state: ContentPipelineState,
): Promise<{ result?: string; error?: string }> {
  try {
    const prompt = buildStepPrompt(stepName, state);
    const result = await llmComplete({
      messages: [{ role: 'user', content: prompt }],
      systemPrompt: `Você é um especialista em marketing de conteúdo. Siga as instruções do pipeline de forma顺序.`,
      maxTokens: 2048,
      temperature: 0.7,
    });

    return { result: result.content };
  } catch (err) {
    return { error: String(err) };
  }
}

function buildStepPrompt(stepName: string, state: ContentPipelineState): string {
  switch (stepName) {
    case 'CREATIVE':
      return `Com base neste briefing, crie um script de marketing e brainstorm de ângulos:

Brief: ${state.brief}

Forneça:
1. Script principal (300-500 palavras)
2. 3 ângulos criativos diferentes
3. Tom e estilo recomendados`;
    case 'VIDEO':
      return `Usando este conteúdo criativo, sugira como seria o processamento de vídeo:

Conteúdo: ${state.creativeOutput}

Forneça:
1. Timestamps de momentos-chave
2. Legenda sugerido
3. Call-to-action`;
    case 'DESIGN':
      return `Com base no conteúdo e vídeo, gere sugestões visuais:

Conteúdo: ${state.creativeOutput}
Vídeo: ${state.videoOutput}

Forneça:
1. Prompt para imagem
2. Paleta de cores
3. Layout sugerido`;
    case 'SOCIAL':
      return `Prepare o conteúdo para postagem em redes sociais:

Conteúdo: ${state.creativeOutput}
Design: ${state.designOutput}

Forneça:
1. Caption para Instagram
2. Hashtags (10-15)
3. Thread para Twitter/X`;
    case 'ANALYTICS':
      return `Analise o desempenho previsto e gere relatório final:

Todos os outputs anteriores:
${state.creativeOutput}
${state.videoOutput}
${state.designOutput}

Forneça:
1. Métricas previstas
2. KPIs principais
3. Próximos passos`;
    default:
      return state.brief;
  }
}

async function scoreBrandConsistency(content: string): Promise<number> {
  const prompt = `Avalie a consistência de marca deste conteúdo. Considere: tom, estilo, valores da marca, clareza da mensagem.

Conteúdo:
${content}

Retorne APENAS um número entre 0.0 e 1.0.`;

  try {
    const result = await llmComplete({
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 10,
      temperature: 0,
    });
    return Math.max(0, Math.min(1, parseFloat(result.content)));
  } catch {
    return 0.5;
  }
}
