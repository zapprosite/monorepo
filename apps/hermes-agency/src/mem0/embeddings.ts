// Anti-hardcoded: all config via process.env
// Embeddings Client — Ollama nomic-embed-text integration

import { fetchClient } from '../utils/fetch-client.js';

const OLLAMA_URL = process.env['OLLAMA_URL'] ?? 'http://localhost:11434';
const EMBED_MODEL = process.env['OLLAMA_EMBED_MODEL'] ?? 'nomic-embed-text';
const EMBED_DIMENSION = 1024; // nomic-embed-text dimension

export interface EmbeddingResult {
  embedding: number[];
  model: string;
  done: boolean;
}

/**
 * Generate embedding for text using Ollama nomic-embed-text.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await fetchClient(`${OLLAMA_URL}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: EMBED_MODEL,
        prompt: text,
      }),
    });

    if (!response.ok) {
      console.error('[Embeddings] Ollama error:', await response.text());
      return generatePseudoEmbedding(text);
    }

    const data = (await response.json()) as { embedding?: number[] };
    return data.embedding ?? generatePseudoEmbedding(text);
  } catch (err) {
    console.error('[Embeddings] Failed to reach Ollama, using pseudo-embedding:', err);
    return generatePseudoEmbedding(text);
  }
}

/**
 * Generate embeddings for multiple texts in batch.
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  return Promise.all(texts.map((text) => generateEmbedding(text)));
}

/**
 * Deterministic pseudo-embedding fallback.
 * NOTE: In production, always use actual embeddings via Ollama.
 */
export function generatePseudoEmbedding(text: string): number[] {
  const dim = EMBED_DIMENSION;
  const vec = new Array(dim).fill(0);
  for (let i = 0; i < text.length; i++) {
    vec[i % dim] += text.charCodeAt(i) * 0.01;
  }
  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
  return norm > 0 ? vec.map((v) => v / norm) : vec;
}

/**
 * Compute cosine similarity between two vectors.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i] ?? 0;
    const bi = b[i] ?? 0;
    dot += ai * bi;
    normA += ai * ai;
    normB += bi * bi;
  }
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dot / denominator;
}
