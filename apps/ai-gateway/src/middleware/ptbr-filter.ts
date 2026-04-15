/**
 * SPEC-048 — PT-BR filter (TTS + chat opcional)
 * Lógica replicada de ~/Desktop/voice-pipeline/scripts/speak.sh (preprocess_for_tts)
 * Original speak.sh fica intacto — esta é a versão API do mesmo pipeline.
 * Anti-hardcoded: model + URL via process.env
 */

import { createHash } from 'node:crypto';
import { $fetch } from 'ofetch';

const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://localhost:11434';
const PTBR_MODEL =
  process.env.PTBR_FILTER_MODEL ?? 'llama3-portuguese-tomcat-8b-instruct-q8:latest';
const CACHE_TTL_MS = 15 * 60 * 1000;
const CACHE_MAX = 512;

interface CacheEntry {
  value: string;
  expiresAt: number;
}
const cache = new Map<string, CacheEntry>();

function cacheKey(content: string) {
  return createHash('sha256').update(content).digest('hex');
}
function cacheGet(key: string): string | null {
  const e = cache.get(key);
  if (!e) return null;
  if (Date.now() > e.expiresAt) {
    cache.delete(key);
    return null;
  }
  return e.value;
}
function cacheSet(key: string, value: string) {
  if (cache.size >= CACHE_MAX) {
    const first = cache.keys().next().value;
    if (first) cache.delete(first);
  }
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

// Prompt espelha lógica de preprocess_for_tts em speak.sh
const TTS_PROMPT = (
  text: string,
) => `Lê este texto em voz alta, como se fosse um livro para alguém, em português brasileiro natural.
Regras:
- Remove símbolos (→, ←, •, ★, ►, —, /, |) ou substitui por palavras naturais
- Listas numeradas: "1. Item" vira "Primeiro, Item"
- Títulos (MAIÚSCULAS ou linha curta sozinha) adiciona pausa antes
- Texto misto PT/EN: mantém PT-BR mas não traduz termos técnicos
- NÃO reescreve o conteúdo — apenas formata para fala natural
- Responde APENAS com o texto formatado, sem explicação
Texto:
${text}`;

// Prompt para correcção de PT-BR em respostas de chat
const CHAT_PROMPT = (
  text: string,
) => `Corrija apenas gramática, acentuação e pontuação em português brasileiro. NÃO altere o significado. Responda APENAS com o texto corrigido, sem explicação.
Texto:
${text}`;

/**
 * @param text     texto a filtrar
 * @param mode     'tts' (para fala — limpa símbolos) | 'chat' (correcção PT-BR leve)
 * @param acceptLang  bypass se não inclui 'pt'
 */
export async function applyPtbrFilter(
  text: string,
  acceptLang?: string,
  mode: 'tts' | 'chat' = 'chat',
): Promise<string> {
  if (acceptLang && !acceptLang.toLowerCase().includes('pt')) return text;

  const key = cacheKey(`${mode}:${text}`);
  const cached = cacheGet(key);
  if (cached) return cached;

  const prompt = mode === 'tts' ? TTS_PROMPT(text) : CHAT_PROMPT(text);

  try {
    const start = Date.now();
    const res = await $fetch<{ response: string }>(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      body: { model: PTBR_MODEL, prompt, stream: false },
      timeout: 10000,
    });
    const filtered = res.response?.trim() || text;
    const ms = Date.now() - start;
    if (ms > 400) process.stderr.write(`[ptbr-filter] ${mode} latency ${ms}ms\n`);
    cacheSet(key, filtered);
    return filtered;
  } catch (err) {
    process.stderr.write(
      `[ptbr-filter] failed (${mode}), returning original: ${(err as Error).message}\n`,
    );
    return text;
  }
}
