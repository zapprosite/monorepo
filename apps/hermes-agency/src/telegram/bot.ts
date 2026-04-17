// Anti-hardcoded: all config via process.env
// Hermes Agency Telegram Bot — voice + vision + text multimodal

import { Telegraf, Input } from 'telegraf';
import { routeToSkill } from '../router/agency_router';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { randomBytes } from 'node:crypto';

// ── Env vars with fallbacks (canonical table from AGENTS.md) ────────────────
const BOT_TOKEN = process.env['HERMES_AGENCY_BOT_TOKEN'] ?? '';
const WEBHOOK_URL = process.env['HERMES_AGENCY_WEBHOOK_URL'] ?? '';
const STT_URL = process.env['STT_DIRECT_URL'] ?? 'http://localhost:8204';
const TTS_URL = process.env['TTS_BRIDGE_URL'] ?? 'http://localhost:8013';
const OLLAMA_URL = process.env['OLLAMA_URL'] ?? 'http://localhost:11434';
const GW_KEY = process.env['AI_GATEWAY_FACADE_KEY'] ?? '';
const VISION_MODEL = process.env['HERMES_VISION_MODEL'] ?? 'qwen2.5vl:7b';
const VOICE_DEFAULT = process.env['HERMES_VOICE'] ?? 'pm_santa';

// ── Validation (fail fast) ────────────────────────────────────────────────────
const REQUIRED = ['HERMES_AGENCY_BOT_TOKEN'];
for (const key of REQUIRED) {
  if (!process.env[key]) {
    console.error(`[HermesAgencyBot] FATAL: ${key} not set in .env`);
    process.exit(1);
  }
}

// ── Per-chat mutex locks ─────────────────────────────────────────────────────
// WARNING: In-memory Map locks do NOT work across multiple bot instances.
// For multi-instance deployment, use Redis SETNX with TTL:
//   Redis: SETNX chat:{chatId}:lock 1 EX 30
//          DEL chat:{chatId}:lock (on release)
//   This ensures atomic lock acquisition across all instances.
const chatLocks = new Map<number, boolean>();

function acquireLock(chatId: number): boolean {
  if (chatLocks.get(chatId)) return false;
  chatLocks.set(chatId, true);
  return true;
}

function releaseLock(chatId: number): void {
  chatLocks.delete(chatId);
}

// ── In-memory rate limiter ───────────────────────────────────────────────────
// WARNING: This state is per-instance. For multi-instance, use Redis:
//   INCR user:{userId}:msg_count EXPIRE user:{userId}:msg_count {WINDOW_SECS}
interface RateLimitEntry {
  count: number;
  resetAt: number;
}
const RATE_LIMIT_WINDOW_MS = 10_000;
const RATE_LIMIT_MAX_MESSAGES = 5;
const userMessageRates = new Map<string, RateLimitEntry>();

function checkRateLimit(userId: string): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const entry = userMessageRates.get(userId);
  if (!entry || now >= entry.resetAt) {
    userMessageRates.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, retryAfterSec: 0 };
  }
  if (entry.count >= RATE_LIMIT_MAX_MESSAGES) {
    const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, retryAfterSec };
  }
  entry.count++;
  return { allowed: true, retryAfterSec: 0 };
}

// ── Bot instance ─────────────────────────────────────────────────────────────
const bot = new Telegraf(BOT_TOKEN);

// ── Middleware: rate limit + per-chat lock ──────────────────────────────────
bot.use(async (ctx, next) => {
  const chatId = ctx.chat?.id;
  if (!chatId) {
    await ctx.reply('❌ Erro: chat ID não encontrado.');
    return;
  }

  const userId = String(ctx.from?.id ?? 'unknown');
  const { allowed, retryAfterSec } = checkRateLimit(userId);
  if (!allowed) {
    await ctx.reply(`⛔ Muitas solicitações. Tente novamente em ${retryAfterSec}s.`);
    return;
  }

  if (!acquireLock(chatId)) {
    await ctx.reply('⏳ Processando outra mensagem neste chat. Por favor aguarde.');
    return;
  }

  try {
    await next();
  } finally {
    releaseLock(chatId);
  }
});

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Download Telegram file to a temp path, returns local file path */
async function downloadTelegramFile(fileId: string, token: string): Promise<string> {
  const filePath = await bot.telegram.getFile(fileId);
  const url = `https://api.telegram.org/file/bot${token}/${filePath.file_path}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`Failed to download file: ${response.status}`);
  const ext = filePath.file_path?.split('.').pop() ?? 'ogg';
  const tmpPath = path.join(os.tmpdir(), `hermes-voice-${randomBytes(6).toString('hex')}.${ext}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(tmpPath, buffer);
  return tmpPath;
}

/** STT: transcribe audio file using faster-whisper via STT endpoint */
async function transcribeAudio(filePath: string): Promise<string> {
  const formData = new FormData();
  formData.append('file', fs.createReadStream(filePath) as unknown as File);
  formData.append('model', 'whisper-1');

  const response = await fetch(`${STT_URL}/v1/audio/transcriptions`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${GW_KEY}` },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    body: formData as any,
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`STT failed ${response.status}: ${err}`);
  }

  const data = await response.json() as { text?: string };
  return data.text ?? '';
}

/** Vision: analyze image using qwen2.5vl via Ollama directly (multimodal content) */
async function visionOllama(
  model: string,
  text: string,
  base64Image: string,
): Promise<string> {
  const response = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    signal: AbortSignal.timeout(90_000),
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      stream: false,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}` } },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama vision failed ${response.status}: ${await response.text()}`);
  }

  const data = await response.json() as { message?: { content?: string } };
  return data.message?.content ?? '';
}

/** Vision: analyze image using qwen2.5vl via Ollama directly */
async function analyzeImage(
  filePath: string,
  userMessage: string,
): Promise<string> {
  const buffer = fs.readFileSync(filePath);
  const base64Image = buffer.toString('base64');

  const prompt = `Você é CEO MIX da Hermes Agency. Analise a imagem e aja imediatamente — NÃO descreva o que vê, apenas aja ou responda de forma útil.\n\nContexto do utilizador: "${userMessage}"`;

  return visionOllama(VISION_MODEL, prompt, base64Image);
}

/** TTS: synthesize speech using Kokoro via TTS Bridge */
async function synthesizeSpeech(text: string, voice?: string): Promise<Buffer> {
  const response = await fetch(`${TTS_URL}/v1/audio/speech`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GW_KEY}`,
    },
    body: JSON.stringify({
      model: 'tts-1',
      input: text,
      voice: voice ?? VOICE_DEFAULT,
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`TTS failed ${response.status}: ${err}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

// ── Command: /start ─────────────────────────────────────────────────────────
bot.command('start', async (ctx) => {
  await ctx.reply(
    `🎙️ *Hermes Agency Suite*\n\n` +
    `Olá! Sou o CEO MIX da Hermes Agency.\n\n` +
    `Posso ajudá-lo com:\n` +
    `• 📋 Criar campanhas de marketing\n` +
    `• 🎬 Editar vídeos\n` +
    `• 🎨 Design e imagens\n` +
    `• 📊 Analytics e relatórios\n` +
    `• 📅 Gerenciar redes sociais\n` +
    `• ✅ Garantir consistência de marca\n\n` +
    `Envie uma mensagem, áudio, foto ou vídeo — vou analisar e agir.\n` +
    `Use /help para ver todos os comandos.`,
    { parse_mode: 'Markdown' },
  );
});

// ── Command: /help ───────────────────────────────────────────────────────────
bot.command('help', async (ctx) => {
  await ctx.reply(
    `*Comandos disponíveis:*\n\n` +
    `/start — Iniciar conversa\n` +
    `/help — Este menu\n` +
    `/voice — Ativar resposta por voz\n` +
    `/text — Desativar resposta por voz\n` +
    `/campaign — Criar nova campanha\n` +
    `/tasks — Ver tarefas ativas\n` +
    `/status — Status da agência\n` +
    `/analytics — Relatório de métricas\n\n` +
    `Ou envie áudio, foto ou texto — entendo tudo!`,
    { parse_mode: 'Markdown' },
  );
});

// ── Command: /health ─────────────────────────────────────────────────────────
bot.command('health', async (ctx) => {
  const checks = await Promise.all([
    fetchHealth('http://localhost:8642/health', 'Hermes :8642'),
    fetchHealth(`${STT_URL}/health`, 'STT :8204'),
    fetchHealth(`${TTS_URL}/health`, 'TTS :8013'),
    fetchHealth(`${OLLAMA_URL}/api/tags`, 'Ollama :11434'),
  ]);
  const lines = checks.map(([name, ok]) => `${ok ? '✅' : '❌'} ${name}`).join('\n');
  await ctx.reply(`*Health Check*\n\n${lines}`, { parse_mode: 'Markdown' });
});

// ── Voice handler ────────────────────────────────────────────────────────────
bot.on('voice', async (ctx) => {
  const chatId = ctx.chat?.id ?? 0;
  const userId = String(ctx.from?.id ?? 'unknown');

  // Download + transcribe
  let transcription: string;
  try {
    const voice = ctx.message.voice;
    const tmpPath = await downloadTelegramFile(String(voice.file_id), BOT_TOKEN);
    try {
      transcription = await transcribeAudio(tmpPath);
    } finally {
      fs.unlinkSync(tmpPath);
    }
  } catch (err) {
    console.error('[HermesAgencyBot] STT error:', err);
    await ctx.reply('❌ Erro ao transcrever áudio. Tente novamente ou envie texto.');
    return;
  }

  // Route transcription through CEO
  const response = await routeToSkill(transcription, { userId, chatId, message: transcription });

  // Synthesize + reply with voice
  try {
    const audioBuffer = await synthesizeSpeech(response);
    const tmpOut = path.join(os.tmpdir(), `hermes-tts-${randomBytes(6).toString('hex')}.mp3`);
    fs.writeFileSync(tmpOut, audioBuffer);
    try {
      await ctx.replyWithVoice(Input.fromLocalFile(tmpOut));
    } finally {
      fs.unlinkSync(tmpOut);
    }
  } catch (err) {
    // Fallback: send as text if TTS fails
    console.warn('[HermesAgencyBot] TTS failed, falling back to text:', err);
    await ctx.reply(response);
  }
});

// ── Photo handler ────────────────────────────────────────────────────────────
bot.on('photo', async (ctx) => {
  const chatId = ctx.chat?.id ?? 0;
  const userId = String(ctx.from?.id ?? 'unknown');
  const userMessage = 'caption' in ctx.message && ctx.message.caption
    ? ctx.message.caption
    : 'O que vê nesta imagem?';

  // Get largest photo (Telegram sends array with largest last)
  const photos = ctx.message.photo;
  if (!photos || photos.length === 0) {
    await ctx.reply('📎 Não consegui processar a imagem. Tente novamente.');
    return;
  }
  const largest = photos[photos.length - 1]!;

  // Download + analyze with vision
  let analysis: string;
  try {
    const tmpPath = await downloadTelegramFile(String(largest.file_id), BOT_TOKEN);
    try {
      analysis = await analyzeImage(tmpPath, userMessage);
    } finally {
      fs.unlinkSync(tmpPath);
    }
  } catch (err) {
    console.error('[HermesAgencyBot] Vision error:', err);
    await ctx.reply('❌ Erro ao analisar imagem. Tente novamente.');
    return;
  }

  // Reply with text (CEO MIX acts on image, doesn't describe it)
  await ctx.reply(analysis);
});

// ── Text message handler ─────────────────────────────────────────────────────
bot.on('message', async (ctx) => {
  const message = 'text' in ctx.message ? ctx.message.text : '';
  if (!message) {
    await ctx.reply('📎 Recebi algo que não é texto. Tente novamente.');
    return;
  }

  const chatId = ctx.chat?.id ?? 0;
  const userId = String(ctx.from?.id ?? 'unknown');

  try {
    const response = await routeToSkill(message, { userId, chatId, message });
    await ctx.reply(response);
  } catch (err) {
    console.error('[HermesAgencyBot] Routing error:', err);
    await ctx.reply('❌ Erro ao processar mensagem. Tente novamente.');
  }
});

// ── Error handler ───────────────────────────────────────────────────────────
bot.catch((err) => {
  console.error('[HermesAgencyBot] Unhandled error:', err);
});

async function fetchHealth(url: string, name: string): Promise<[string, boolean]> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
    return [name, res.ok];
  } catch {
    return [name, false];
  }
}

// ── Launch ──────────────────────────────────────────────────────────────────
if (WEBHOOK_URL) {
  bot.launch({ webhook: { domain: WEBHOOK_URL, port: 3001 } });
  console.log(`[HermesAgencyBot] Webhook mode: ${WEBHOOK_URL}`);
} else {
  bot.launch();
  console.log('[HermesAgencyBot] Polling mode started');
}

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

export { bot };
