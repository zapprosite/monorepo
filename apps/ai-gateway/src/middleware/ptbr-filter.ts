/**
 * SPEC-048 — PT-BR filter (STT + TTS + chat)
 * Lógica replicada de ~/Desktop/voice-pipeline/scripts/voice.sh + speak.sh
 * Anti-hardcoded: model + URL via process.env
 */

import { createHash } from 'node:crypto';
import { $fetch } from 'ofetch';

const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://localhost:11434';
// PTBR filter model: MUST be set via PTBR_FILTER_MODEL env var (no hardcoded fallback)
const PTBR_MODEL = process.env.PTBR_FILTER_MODEL ?? '';
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

// ── STT pre-processing (fillers + abbreviations) ──────────────────────────

const STT_FILLERS = [
  /\bäh\b/gi,
  /\behn\b/gi,
  /\bhn\b/gi,
  /\bhnn\b/gi,
  /\bem\b/gi,
  /\bné\b/gi,
  /\btá\b/gi,
  /\btipo\b/gi,
  /\bcara\b/gi,
  /\bmano\b/gi,
  /\bmais ou menos\b/gi,
  /\bentão\b/gi,
  /\bviu\b/gi,
  /\bbah\b/gi,
  /\bputs\b/gi,
];

const STT_CORRECTIONS: Array<[RegExp, string]> = [
  [/\bvc\b/gi, 'você'],
  [/\bpq\b/gi, 'por quê'],
  [/\bq\b/gi, 'que'],
  [/\btb\b/gi, 'também'],
  [/\btbm\b/gi, 'também'],
  [/\bmsm\b/gi, 'mesmo'],
  [/\bhj\b/gi, 'hoje'],
  [/\boq\b/gi, 'o quê'],
  [/\bqnd\b/gi, 'quando'],
  [/\bpra\b/gi, 'para'],
  [/\bmt\b/gi, 'muito'],
  [/\bvlw\b/gi, 'valeu'],
];

function sttPreprocess(text: string): string {
  let t = text;
  for (const filler of STT_FILLERS) t = t.replace(filler, '');
  for (const [pattern, rep] of STT_CORRECTIONS) t = t.replace(pattern, rep);
  t = t.replace(/\b(\w)(-\1)+\b/g, '$1'); // fix stuttering: o-o-o → o
  return t.replace(/\s+/g, ' ').trim();
}

// ── Prompts por modo ──────────────────────────────────────────────────────

const STT_SYSTEM =
  'Você é um transcritor de voz brasileiro. ' +
  'Regras FIXAS: ' +
  '1) MANTÉM todas as palavras originais — não adiciona, não remove, não reescreve sentido. ' +
  '2) Corrige APENAS erros óbvios de transcrição (ex: "q" → "que", "tb" → "também", "vc" → "você"). ' +
  '3) Converta SÍMBOLOS em texto natural: "→" → "para"; "←" → "volta"; "★" → "destaque"; "✔" → "ok". ' +
  '4) Pontuação natural: ponto = pausa longa, vírgula = pausa curta. ' +
  '5) NUNCA lê ícones, emojis ou símbolos especiais. ' +
  '6) Output = apenas texto corrigido, ZERO comentários.';

const TTS_PROMPT = (text: string) =>
  `Prepara este texto para leitura em voz alta em português brasileiro.
REGRAS ESTRITAS:
- Remove símbolos (→, ←, •, ★, ►, —, |, /) — não os substitua por palavras
- Listas: "1. Item" → "Primeiro, Item". "2. Item" → "Segundo, Item"
- PROIBIDO adicionar palavras como "pausa", "fim", "(Pause)", "(pause)", "silêncio" — NUNCA
- NÃO reescreve o conteúdo — apenas limpa para leitura natural
- Responde APENAS com o texto limpo, sem qualquer explicação

Texto:
${text}`;

const CHAT_PROMPT = (text: string) =>
  `Corrija gramática e acentuação em português brasileiro. NÃO altere o significado. Responda APENAS com o texto corrigido.
Texto:
${text}`;

export type PtbrMode = 'stt' | 'tts' | 'chat';

/**
 * Aplica PT-BR filter ao texto.
 * @param text       texto a filtrar
 * @param acceptLang bypass se fornecido e não inclui 'pt'
 * @param mode       'stt' | 'tts' | 'chat'
 */
export async function applyPtbrFilter(
  text: string,
  acceptLang?: string,
  mode: PtbrMode = 'chat',
): Promise<string> {
  if (acceptLang && !acceptLang.toLowerCase().includes('pt')) return text;

  const preprocessed = mode === 'stt' ? sttPreprocess(text) : text;
  if (!preprocessed) return text;

  const key = cacheKey(`${mode}:${preprocessed}`);
  const cached = cacheGet(key);
  if (cached) return cached;

  try {
    const start = Date.now();
    let filtered: string;

    if (mode === 'stt') {
      const res = await $fetch<{ response: string }>(`${OLLAMA_URL}/api/generate`, {
        method: 'POST',
        body: {
          model: PTBR_MODEL,
          system: STT_SYSTEM,
          prompt: `Transcrição de voz. Corrige e humaniza:\n\n${preprocessed}`,
          stream: false,
        },
        timeout: 30000,
      });
      filtered = res.response?.trim() || preprocessed;
    } else {
      const prompt = mode === 'tts' ? TTS_PROMPT(preprocessed) : CHAT_PROMPT(preprocessed);
      const res = await $fetch<{ response: string }>(`${OLLAMA_URL}/api/generate`, {
        method: 'POST',
        body: { model: PTBR_MODEL, prompt, stream: false },
        timeout: 10000,
      });
      filtered = res.response?.trim() || preprocessed;
    }

    // Remover artefactos de pausa (TTS + chat)
    if (mode !== 'stt') {
      filtered = filtered
        .replace(/\(Pause\)/gi, '')
        .replace(/\(pause\)/gi, '')
        .replace(/\bpausa\b/gi, '')
        .replace(/\bfim\b\s*$/gi, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
    }

    const ms = Date.now() - start;
    if (ms > 400) process.stderr.write(`[ptbr-filter] ${mode} latency ${ms}ms\n`);
    cacheSet(key, filtered);
    return filtered;
  } catch (err) {
    process.stderr.write(
      `[ptbr-filter] failed (${mode}), returning original: ${(err as Error).message}\n`,
    );
    return preprocessed;
  }
}
