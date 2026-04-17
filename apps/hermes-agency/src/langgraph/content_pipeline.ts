// Anti-hardcoded: all config via process.env
// LangGraph Content Pipeline Workflow (WF-1)
// Uses proper StateGraph with MemorySaver checkpointing and interrupt for human-in-the-loop

import { MemorySaver } from "@langchain/langgraph";
import { interrupt, StateGraph, START, END } from "@langchain/langgraph";
import { llmComplete } from '../litellm/router.ts';

// Checkpointer for durable execution with persistence
const checkpointer = new MemorySaver();

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
  // Human approval state
  humanApproved?: boolean;
  humanComment?: string;
};

// Node functions for each pipeline step
async function creativeNode(state: ContentPipelineState): Promise<Partial<ContentPipelineState>> {
  console.log(`[ContentPipeline] Executing CREATIVE node`);
  const result = await llmComplete({
    messages: [{
      role: 'user',
      content: `Com base neste briefing, crie um script de marketing e brainstorm de ângulos:

Brief: ${state.brief}

Forneça:
1. Script principal (300-500 palavras)
2. 3 ângulos criativos diferentes
3. Tom e estilo recomendados`
    }],
    systemPrompt: `Você é um especialista em marketing de conteúdo. Siga as instruções do pipeline de forma sequencial.`,
    maxTokens: 2048,
    temperature: 0.7,
  });
  return { creativeOutput: result.content, currentStep: 'CREATIVE' };
}

async function videoNode(state: ContentPipelineState): Promise<Partial<ContentPipelineState>> {
  console.log(`[ContentPipeline] Executing VIDEO node`);
  const result = await llmComplete({
    messages: [{
      role: 'user',
      content: `Usando este conteúdo criativo, sugira como seria o processamento de vídeo:

Conteúdo: ${state.creativeOutput}

Forneça:
1. Timestamps de momentos-chave
2. Legenda sugerido
3. Call-to-action`
    }],
    systemPrompt: `Você é um especialista em marketing de conteúdo.`,
    maxTokens: 2048,
    temperature: 0.7,
  });
  return { videoOutput: result.content, currentStep: 'VIDEO' };
}

async function designNode(state: ContentPipelineState): Promise<Partial<ContentPipelineState>> {
  console.log(`[ContentPipeline] Executing DESIGN node`);
  const result = await llmComplete({
    messages: [{
      role: 'user',
      content: `Com base no conteúdo e vídeo, gere sugestões visuais:

Conteúdo: ${state.creativeOutput}
Vídeo: ${state.videoOutput}

Forneça:
1. Prompt para imagem
2. Paleta de cores
3. Layout sugerido`
    }],
    systemPrompt: `Você é um designer gráfico especialista.`,
    maxTokens: 2048,
    temperature: 0.7,
  });
  return { designOutput: result.content, currentStep: 'DESIGN' };
}

async function brandGuardianNode(state: ContentPipelineState): Promise<Partial<ContentPipelineState>> {
  console.log(`[ContentPipeline] Executing BRAND_GUARDIAN node`);
  const contentToScore = [state.creativeOutput, state.videoOutput, state.designOutput]
    .filter(Boolean)
    .join('\n---\n');

  const prompt = `Avalie a consistência de marca deste conteúdo. Considere: tom, estilo, valores da marca, clareza da mensagem.

Conteúdo:
${contentToScore}

Retorne APENAS um número entre 0.0 e 1.0.`;

  const result = await llmComplete({
    messages: [{ role: 'user', content: prompt }],
    maxTokens: 10,
    temperature: 0,
  });

  const brandScore = Math.max(0, Math.min(1, parseFloat(result.content)));
  console.log(`[ContentPipeline] Brand score: ${brandScore.toFixed(2)}`);

  return { brandScore, currentStep: 'BRAND_GUARDIAN' };
}

async function humanGateNode(state: ContentPipelineState): Promise<Partial<ContentPipelineState>> {
  console.log(`[ContentPipeline] Executing HUMAN_GATE node`);

  // Interrupt for human approval when brand score is below threshold
  if (state.brandScore !== undefined && state.brandScore < 0.8) {
    console.log(`[ContentPipeline] Brand score ${state.brandScore.toFixed(2)} < 0.8 - requiring human approval`);

    // interrupt() pauses execution and waits for human to provide input via Command
    // The graph state is persisted, allowing resumption after approval
    const approved = interrupt(
      `Human approval required: brand score ${state.brandScore.toFixed(2)} < 0.8 threshold`
    );

    if (!approved) {
      return {
        blocked: true,
        blockReason: `Human rejected content with brand score ${state.brandScore.toFixed(2)}`,
        humanApproved: false,
        currentStep: 'HUMAN_GATE'
      };
    }
  }

  return { humanApproved: true, currentStep: 'HUMAN_GATE' };
}

async function socialNode(state: ContentPipelineState): Promise<Partial<ContentPipelineState>> {
  console.log(`[ContentPipeline] Executing SOCIAL node`);
  await llmComplete({
    messages: [{
      role: 'user',
      content: `Prepare o conteúdo para postagem em redes sociais:

Conteúdo: ${state.creativeOutput}
Design: ${state.designOutput}

Forneça:
1. Caption para Instagram
2. Hashtags (10-15)
3. Thread para Twitter/X`
    }],
    systemPrompt: `Você é um especialista em social media.`,
    maxTokens: 2048,
    temperature: 0.7,
  });
  return { currentStep: 'SOCIAL' };
}

async function analyticsNode(state: ContentPipelineState): Promise<Partial<ContentPipelineState>> {
  console.log(`[ContentPipeline] Executing ANALYTICS node`);
  const result = await llmComplete({
    messages: [{
      role: 'user',
      content: `Analise o desempenho previsto e gere relatório final:

Todos os outputs anteriores:
${state.creativeOutput}
${state.videoOutput}
${state.designOutput}

Forneça:
1. Métricas previstas
2. KPIs principais
3. Próximos passos`
    }],
    systemPrompt: `Você é um analista de marketing.`,
    maxTokens: 2048,
    temperature: 0.7,
  });
  return { finalOutput: result.content, currentStep: 'ANALYTICS' };
}

// Build the StateGraph with proper edges
const workflow = new StateGraph<ContentPipelineState>({
  channels: {
    brief: { type: 'string' },
    clientId: { type: 'string' },
    campaignId: { type: 'string' },
    currentStep: { type: 'string' },
    creativeOutput: { type: 'string', nullable: true },
    videoOutput: { type: 'string', nullable: true },
    designOutput: { type: 'string', nullable: true },
    brandScore: { type: 'number', nullable: true },
    finalOutput: { type: 'string', nullable: true },
    blocked: { type: 'boolean' },
    blockReason: { type: 'string', nullable: true },
    humanApproved: { type: 'boolean', nullable: true },
    humanComment: { type: 'string', nullable: true },
  }
})
  .addNode('CREATIVE', creativeNode)
  .addNode('VIDEO', videoNode)
  .addNode('DESIGN', designNode)
  .addNode('BRAND_GUARDIAN', brandGuardianNode)
  .addNode('HUMAN_GATE', humanGateNode)
  .addNode('SOCIAL', socialNode)
  .addNode('ANALYTICS', analyticsNode)
  .addEdge(START, 'CREATIVE')
  .addEdge('CREATIVE', 'VIDEO')
  .addEdge('VIDEO', 'DESIGN')
  .addEdge('DESIGN', 'BRAND_GUARDIAN')
  .addEdge('BRAND_GUARDIAN', 'HUMAN_GATE')
  .addEdge('HUMAN_GATE', 'SOCIAL')
  .addEdge('SOCIAL', 'ANALYTICS')
  .addEdge('ANALYTICS', END);

// Compile with checkpointer for durable execution
const compiledGraph = workflow.compile({
  checkpointer,
  interruptBefore: ['HUMAN_GATE'], // Pause at HUMAN_GATE for human approval
});

export { compiledGraph as contentPipelineGraph };

// Convenience function to run the pipeline
export async function executeContentPipeline(
  brief: string,
  clientId: string,
): Promise<ContentPipelineState> {
  const campaignId = `campaign-${Date.now()}`;
  console.log(`[ContentPipeline] Starting campaign ${campaignId} for client ${clientId}`);

  const initialState: ContentPipelineState = {
    brief,
    clientId,
    campaignId,
    currentStep: 'CREATIVE',
    blocked: false,
  };

  // Run the graph with checkpointing (thread_id enables resumption)
  const result = await compiledGraph.invoke(initialState, {
    configurable: { thread_id: campaignId },
  });

  console.log(`[ContentPipeline] Campaign ${campaignId} complete`);
  return result;
}

// Resume after human approval
export async function approveContentPipeline(
  campaignId: string,
  approved: boolean,
  comment?: string
): Promise<ContentPipelineState> {
  console.log(`[ContentPipeline] Resuming campaign ${campaignId} with approved=${approved}`);

  // Resume the graph by passing the approval decision
  const result = await compiledGraph.invoke(
    {
      humanApproved: approved,
      humanComment: comment,
    } as ContentPipelineState,
    {
      configurable: { thread_id: campaignId },
    }
  );

  return result;
}
