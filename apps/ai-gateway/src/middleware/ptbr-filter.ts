/**
 * SPEC-048 — PT-BR filter (TTS + chat opcional)
 * Lógica replicada de ~/Desktop/voice-pipeline/scripts/speak.sh
 * CORRIGIDO: não adicionar marcadores de pausa como texto falado
 * Anti-hardcoded: model + URL via process.env
 */

import { createHash } from 'node:crypto';
import { $fetch } from 'ofetch';

const OLLAMA_URL = process.env['OLLAMA_URL'] ?? 'http://localhost:11434';
const PTBR_MODEL =
  process.env['PTBR_FILTER_MODEL'] ?? 'llama3-portuguese-tomcat-8b-instruct-q8:latest';
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

// Prompt TTS: limpa símbolos, NÃO adiciona palavras de pausa
const TTS_PROMPT = (
  text: string,
) => `Prepara este texto para leitura em voz alta em português brasileiro.
REGRAS ESTRITAS:
- Remove símbolos (→, ←, •, ★, ►, —, |, /) — não os substitua por palavras
- Listas: "1. Item" → "Primeiro, Item". "2. Item" → "Segundo, Item"
- PROIBIDO adicionar palavras como "pausa", "fim", "(Pause)", "(pause)", "silêncio" — NUNCA
- NÃO reescreve o conteúdo — apenas limpa para leitura natural
- Responde APENAS com o texto limpo, sem qualquer explicação

Texto:
${text}`;

// Prompt chat: correcção leve PT-BR
const CHAT_PROMPT = (text: string) =>
  `Corrija gramática e acentuação em português brasileiro. NÃO altere o significado. Responda APENAS com o texto corrigido.
Texto:
${text}`;

/**
 * @param text       texto a filtrar
 * @param mode       'tts' | 'chat'
 * @param acceptLang bypass se não inclui 'pt'
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
    let filtered = res.response?.trim() || text;

    // Segurança extra: remover artefactos de pausa que o LLM possa ainda produzir
    filtered = filtered
      .replace(/\(Pause\)/gi, '')
      .replace(/\(pause\)/gi, '')
      .replace(/\bpausa\b/gi, '')
      .replace(/\bfim\b\s*$/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim();

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
