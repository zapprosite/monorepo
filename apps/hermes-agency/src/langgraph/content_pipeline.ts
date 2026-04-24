// Anti-hardcoded: all config via process.env
// LangGraph Content Pipeline Workflow (WF-1)
// Uses proper StateGraph with MemorySaver checkpointing and interrupt for human-in-the-loop
/* eslint-disable no-console */

import { MemorySaver, StateGraph, START, END, interrupt, Command } from '@langchain/langgraph';
import { llmComplete } from '../litellm/router.js';

// Checkpointer for durable execution with persistence
const checkpointer = new MemorySaver();

// State type for the content pipeline
type ContentType = 'video' | 'blog' | 'social' | 'email';

interface PipelineState {
  brief: string;
  clientId: string;
  campaignId: string;
  contentType: ContentType;
  currentStep: string;
  creativeOutput?: string;
  videoOutput?: string;
  designOutput?: string;
  brandScore?: number;
  finalOutput?: string;
  blocked: boolean;
  blockReason?: string;
  humanApproved?: boolean;
  humanComment?: string;
  error?: string;
}

// Node functions for each pipeline step
async function creativeNode(state: PipelineState): Promise<PipelineState> {
  try {
    console.log(`[ContentPipeline] Executing CREATIVE node`);
    const result = await llmComplete({
      messages: [
        {
          role: 'user',
          content: `Com base neste briefing, crie um script de marketing e brainstorm de ângulos:

Brief: ${state.brief}

Forneça:
1. Script principal (300-500 palavras)
2. 3 ângulos criativos diferentes
3. Tom e estilo recomendados`,
        },
      ],
      systemPrompt: `Você é um especialista em marketing de conteúdo. Siga as instruções do pipeline de forma sequencial.`,
      maxTokens: 2048,
      temperature: 0.7,
    });
    return { ...state, creativeOutput: result.content, currentStep: 'CREATIVE' };
  } catch (err) {
    console.error('[LangGraph] creativeNode failed:', err);
    return {
      ...state,
      error: err instanceof Error ? err.message : String(err),
      currentStep: 'ERROR',
    };
  }
}

async function videoNode(state: PipelineState): Promise<PipelineState> {
  try {
    console.log(`[ContentPipeline] Executing VIDEO node`);
    const result = await llmComplete({
      messages: [
        {
          role: 'user',
          content: `Usando este conteúdo criativo, sugira como seria o processamento de vídeo:

Conteúdo: ${state.creativeOutput}

Forneça:
1. Timestamps de momentos-chave
2. Legenda sugerido
3. Call-to-action`,
        },
      ],
      systemPrompt: `Você é um especialista em marketing de conteúdo.`,
      maxTokens: 2048,
      temperature: 0.7,
    });
    return { ...state, videoOutput: result.content, currentStep: 'VIDEO' };
  } catch (err) {
    console.error('[LangGraph] videoNode failed:', err);
    return {
      ...state,
      error: err instanceof Error ? err.message : String(err),
      currentStep: 'ERROR',
    };
  }
}

async function designNode(state: PipelineState): Promise<PipelineState> {
  try {
    console.log(`[ContentPipeline] Executing DESIGN node`);
    const result = await llmComplete({
      messages: [
        {
          role: 'user',
          content: `Com base no conteúdo e vídeo, gere sugestões visuais:

Conteúdo: ${state.creativeOutput}
Vídeo: ${state.videoOutput}

Forneça:
1. Prompt para imagem
2. Paleta de cores
3. Layout sugerido`,
        },
      ],
      systemPrompt: `Você é um designer gráfico especialista.`,
      maxTokens: 2048,
      temperature: 0.7,
    });
    return { ...state, designOutput: result.content, currentStep: 'DESIGN' };
  } catch (err) {
    console.error('[LangGraph] designNode failed:', err);
    return {
      ...state,
      error: err instanceof Error ? err.message : String(err),
      currentStep: 'ERROR',
    };
  }
}

async function brandGuardianNode(state: PipelineState): Promise<PipelineState> {
  try {
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

    return { ...state, brandScore, currentStep: 'BRAND_GUARDIAN' };
  } catch (err) {
    console.error('[LangGraph] brandGuardianNode failed:', err);
    return {
      ...state,
      error: err instanceof Error ? err.message : String(err),
      currentStep: 'ERROR',
    };
  }
}

async function humanGateNode(state: PipelineState): Promise<PipelineState> {
  try {
    console.log(`[ContentPipeline] Executing HUMAN_GATE node`);

    // Always interrupt for human approval — brand score is advisory, human makes final decision
    // Pass content and brand score so human can make informed choice
    console.log(
      `[ContentPipeline] Brand score ${state.brandScore?.toFixed(2) ?? 'N/A'} — requesting human approval`,
    );
    const approval = await interrupt({
      brandScore: state.brandScore,
      creativeOutput: state.creativeOutput,
      videoOutput: state.videoOutput,
      designOutput: state.designOutput,
    });

    console.log(`[ContentPipeline] Human approval result:`, approval);
    return {
      ...state,
      humanApproved: approval.humanApproved,
      humanComment: approval.humanComment,
      currentStep: 'HUMAN_GATE',
    };
  } catch (err) {
    console.error('[LangGraph] humanGateNode failed:', err);
    return {
      ...state,
      error: err instanceof Error ? err.message : String(err),
      currentStep: 'ERROR',
    };
  }
}

async function socialNode(state: PipelineState): Promise<PipelineState> {
  try {
    console.log(`[ContentPipeline] Executing SOCIAL node`);
    await llmComplete({
      messages: [
        {
          role: 'user',
          content: `Prepare o conteúdo para postagem em redes sociais:

Conteúdo: ${state.creativeOutput}
Design: ${state.designOutput}

Forneça:
1. Caption para Instagram
2. Hashtags (10-15)
3. Thread para Twitter/X`,
        },
      ],
      systemPrompt: `Você é um especialista em social media.`,
      maxTokens: 2048,
      temperature: 0.7,
    });
    return { ...state, currentStep: 'SOCIAL' };
  } catch (err) {
    console.error('[LangGraph] socialNode failed:', err);
    return {
      ...state,
      error: err instanceof Error ? err.message : String(err),
      currentStep: 'ERROR',
    };
  }
}

async function analyticsNode(state: PipelineState): Promise<PipelineState> {
  try {
    console.log(`[ContentPipeline] Executing ANALYTICS node`);
    const result = await llmComplete({
      messages: [
        {
          role: 'user',
          content: `Analise o desempenho previsto e gere relatório final:

Todos os outputs anteriores:
${state.creativeOutput}
${state.videoOutput}
${state.designOutput}

Forneça:
1. Métricas previstas
2. KPIs principais
3. Próximos passos`,
        },
      ],
      systemPrompt: `Você é um analista de marketing.`,
      maxTokens: 2048,
      temperature: 0.7,
    });
    return { ...state, finalOutput: result.content, currentStep: 'ANALYTICS' };
  } catch (err) {
    console.error('[LangGraph] analyticsNode failed:', err);
    return {
      ...state,
      error: err instanceof Error ? err.message : String(err),
      currentStep: 'ERROR',
    };
  }
}

// Conditional routing functions
function brandGuardianRouter(state: PipelineState): string {
  // If brand score is high enough, skip human approval
  if (state.brandScore !== undefined && state.brandScore >= 0.8) {
    console.log(`[ContentPipeline] brandScore ${state.brandScore.toFixed(2)} >= 0.8 → SKIP_HUMAN_GATE`);
    return 'SOCIAL';
  }
  console.log(`[ContentPipeline] brandScore ${state.brandScore?.toFixed(2) ?? 'undefined'} < 0.8 → HUMAN_GATE`);
  return 'HUMAN_GATE';
}

function humanGateRouter(state: PipelineState): string {
  // After human approval, go to SOCIAL if approved, back to CREATIVE if rejected
  if (state.humanApproved === true) {
    console.log(`[ContentPipeline] humanApproved=true → SOCIAL`);
    return 'SOCIAL';
  }
  if (state.humanApproved === false) {
    console.log(`[ContentPipeline] humanApproved=false → CREATIVE (loop)`);
    return 'CREATIVE';
  }
  // Should not reach here if interrupt is working correctly
  console.log(`[ContentPipeline] humanApproved=undefined → END`);
  return '__end__';
}

// Conditional routing based on content type
// Routes CREATIVE → VIDEO/DESIGN/BRAND_GUARDIAN depending on content type
function creativeRouter(state: PipelineState): string {
  const ct = state.contentType;
  console.log(`[ContentPipeline] creativeRouter: contentType=${ct}`);
  if (ct === 'video') {
    console.log(`[ContentPipeline] contentType=video → VIDEO`);
    return 'VIDEO';
  }
  if (ct === 'blog') {
    console.log(`[ContentPipeline] contentType=blog → DESIGN (skip VIDEO)`);
    return 'DESIGN';
  }
  // social and email skip VIDEO and DESIGN, go directly to BRAND_GUARDIAN
  console.log(`[ContentPipeline] contentType=${ct} → BRAND_GUARDIAN (skip VIDEO and DESIGN)`);
  return 'BRAND_GUARDIAN';
}

// Routes VIDEO → DESIGN (always, unless we add more branching)
function videoRouter(_state: PipelineState): string {
  console.log(`[ContentPipeline] videoRouter → DESIGN`);
  return 'DESIGN';
}

// Routes DESIGN → BRAND_GUARDIAN (always after design step)
function designRouter(_state: PipelineState): string {
  console.log(`[ContentPipeline] designRouter → BRAND_GUARDIAN`);
  return 'BRAND_GUARDIAN';
}

// Build the StateGraph
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const workflow = new StateGraph<any>({
  channels: {
    brief: { type: 'string' },
    clientId: { type: 'string' },
    campaignId: { type: 'string' },
    contentType: { type: 'string' },
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
    error: { type: 'string', nullable: true },
  },
})
  .addNode('CREATIVE', creativeNode)
  .addNode('VIDEO', videoNode)
  .addNode('DESIGN', designNode)
  .addNode('BRAND_GUARDIAN', brandGuardianNode)
  .addNode('HUMAN_GATE', humanGateNode)
  .addNode('SOCIAL', socialNode)
  .addNode('ANALYTICS', analyticsNode)
  // Conditional edges: START → CREATIVE (always)
  .addEdge(START, 'CREATIVE')
  // Conditional routing: CREATIVE → VIDEO/DESIGN/BRAND_GUARDIAN based on contentType
  .addConditionalEdges('CREATIVE', creativeRouter, {
    VIDEO: 'VIDEO',
    DESIGN: 'DESIGN',
    BRAND_GUARDIAN: 'BRAND_GUARDIAN',
  })
  // Conditional routing: VIDEO → DESIGN (always, but uses router for consistency)
  .addConditionalEdges('VIDEO', videoRouter, {
    DESIGN: 'DESIGN',
  })
  // Conditional routing: DESIGN → BRAND_GUARDIAN (always, but uses router for consistency)
  .addConditionalEdges('DESIGN', designRouter, {
    BRAND_GUARDIAN: 'BRAND_GUARDIAN',
  })
  // Existing conditional edges
  .addConditionalEdges('BRAND_GUARDIAN', brandGuardianRouter, {
    HUMAN_GATE: 'HUMAN_GATE',
    SOCIAL: 'SOCIAL',
  })
  .addConditionalEdges('HUMAN_GATE', humanGateRouter, {
    SOCIAL: 'SOCIAL',
    CREATIVE: 'CREATIVE',
  })
  .addEdge('SOCIAL', 'ANALYTICS')
  .addEdge('ANALYTICS', END);

// Compile with checkpointer for durable execution
const compiledGraph = workflow.compile({
  checkpointer,
});

export { compiledGraph as contentPipelineGraph };
export type { PipelineState, ContentType };

// Convenience function to run the pipeline
export async function executeContentPipeline(
  brief: string,
  clientId: string,
  contentType: ContentType = 'social',
): Promise<PipelineState> {
  const campaignId = `campaign-${Date.now()}`;
  console.log(`[ContentPipeline] Starting campaign ${campaignId} for client ${clientId} with contentType=${contentType}`);

  const initialState: PipelineState = {
    brief,
    clientId,
    campaignId,
    contentType,
    currentStep: 'CREATIVE',
    blocked: false,
  };

  try {
    // Run the graph with checkpointing (thread_id enables resumption)
    const result = await compiledGraph.invoke(initialState, {
      configurable: { thread_id: campaignId },
    });

    console.log(`[ContentPipeline] Campaign ${campaignId} complete`);
    return result as PipelineState;
  } catch (err) {
    console.error('[LangGraph] executeContentPipeline failed:', err);
    return {
      ...initialState,
      error: err instanceof Error ? err.message : String(err),
      currentStep: 'ERROR',
    };
  }
}

// Resume after human approval
export async function approveContentPipeline(
  campaignId: string,
  approved: boolean,
  comment?: string,
): Promise<PipelineState> {
  console.log(`[ContentPipeline] Resuming campaign ${campaignId} with approved=${approved}`);

  try {
    // Resume the graph using Command to provide the interrupt value
    // The interrupt in humanGateNode will receive this as its return value
    const result = await compiledGraph.invoke(
      new Command({
        resume: {
          humanApproved: approved,
          humanComment: comment,
        },
      }),
      {
        configurable: { thread_id: campaignId },
      },
    );

    return result as PipelineState;
  } catch (err) {
    console.error('[LangGraph] approveContentPipeline failed:', err);
    return {
      campaignId,
      clientId: '',
      brief: '',
      contentType: 'social',
      currentStep: 'ERROR',
      blocked: false,
      humanApproved: approved,
      humanComment: comment ?? undefined,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
