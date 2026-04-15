/**
 * SPEC-047 T200-T202 — PT-BR Llama filter middleware
 * Routes LLM response through local Ollama PT-BR model for normalization.
 * Cache LRU by SHA-256 of content (TTL 15min, max 512 entries).
 * Bypass if Accept-Language does not include 'pt'.
 * Anti-hardcoded: model + URL via process.env.
 */

import { createHash } from 'node:crypto';
import { $fetch } from 'ofetch';

const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://localhost:11434';
const PTBR_MODEL = process.env.PTBR_FILTER_MODEL ?? 'llama3-portuguese-tomcat-8b-instruct-q8';
const CACHE_TTL_MS = 15 * 60 * 1000; // 15min
const CACHE_MAX = 512;

interface CacheEntry {
  value: string;
  expiresAt: number;
}
const cache = new Map<string, CacheEntry>();

function cacheKey(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

function cacheGet(key: string): string | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function cacheSet(key: string, value: string): void {
  if (cache.size >= CACHE_MAX) {
    // Evict oldest
    const first = cache.keys().next().value;
    if (first) cache.delete(first);
  }
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

/** Apply PT-BR normalization filter to text. Returns filtered text. */
export async function applyPtbrFilter(text: string, acceptLanguage?: string): Promise<string> {
  // Bypass if client didn't request pt
  if (acceptLanguage && !acceptLanguage.toLowerCase().includes('pt')) return text;

  const key = cacheKey(text);
  const cached = cacheGet(key);
  if (cached) return cached;

  const prompt = `Você é um normalizador de texto PT-BR. Corrija apenas: gramática, acentuação, pontuação e termos técnicos em inglês (traduzir se houver equivalente natural em PT-BR). NÃO altere o significado, NÃO adicione informação. Responda APENAS com o texto corrigido, sem explicação.

Texto:
${text}`;

  try {
    const start = Date.now();
    const res = await $fetch<{ response: string }>(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      body: { model: PTBR_MODEL, prompt, stream: false },
      timeout: 8000,
    });
    const filtered = res.response?.trim() || text;
    const latency = Date.now() - start;

    if (latency > 400) {
      process.stderr.write(`[ptbr-filter] latency ${latency}ms exceeds 400ms target\n`);
    }

    cacheSet(key, filtered);
    return filtered;
  } catch (err) {
    // Fail open — return original on filter error
    process.stderr.write(
      `[ptbr-filter] filter failed, returning original: ${(err as Error).message}\n`,
    );
    return text;
  }
}
