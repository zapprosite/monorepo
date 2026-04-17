// Anti-hardcoded: all config via process.env
// Hermes Agency Telegram Bot — voice + vision + text multimodal
// Hardened for datacenter: Redis locks/rate-limit, file validation, concurrency limit

import { Telegraf, Input } from 'telegraf';
import { routeToSkill } from '../router/agency_router';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { randomBytes } from 'node:crypto';
import { acquireLock, releaseLock } from './distributed_lock';
import { checkRateLimit, startRateLimitCleanup } from './rate_limiter';
import { validateFile } from './file_validator';

// ── Env vars with fallbacks ─────────────────────────────────────────────────
const BOT_TOKEN = process.env['HERMES_AGENCY_BOT_TOKEN'] ?? '';
const WEBHOOK_URL = process.env['HERMES_AGENCY_WEBHOOK_URL'] ?? '';
const HERMES_GATEWAY_URL = process.env['HERMES_GATEWAY_URL'] ?? 'http://localhost:8642';
const STT_URL = process.env['STT_DIRECT_URL'] ?? 'http://localhost:8204';
const TTS_URL = process.env['TTS_BRIDGE_URL'] ?? 'http://localhost:8013';
const OLLAMA_URL = process.env['OLLAMA_URL'] ?? 'http://localhost:11434';
const GW_KEY = process.env['AI_GATEWAY_FACADE_KEY'] ?? '';
const VISION_MODEL = process.env['HERMES_VISION_MODEL'] ?? 'qwen2.5vl:7b';
const VOICE_DEFAULT = process.env['HERMES_VOICE'] ?? 'pm_santa';

// Admin whitelist for /health (CSV user IDs)
const ADMIN_USER_IDS = (process.env['HERMES_ADMIN_USER_IDS'] ?? '').split(',').filter(Boolean);
const MAX_CONCURRENT_PER_USER = parseInt(process.env['HERMES_MAX_CONCURRENT'] ?? '3', 10);
const CLEANUP_INTERVAL_MS = parseInt(process.env['HERMES_CLEANUP_INTERVAL_MS'] ?? '60000', 10);

// ── Validation (fail fast) ────────────────────────────────────────────────────
const REQUIRED = ['HERMES_AGENCY_BOT_TOKEN'];
for (const key of REQUIRED) {
  if (!process.env[key]) {
    console.error(`[HermesAgencyBot] FATAL: ${key} not set in .env`);
    process.exit(1);
  }
}

// ── Per-user concurrency semaphore ────────────────────────────────────────────
// Prevents flood attacks: max N concurrent uploads per userId
const userSemaphore = new Map<string, number>();

function acquireSemaphore(userId: string): boolean {
  const current = userSemaphore.get(userId) ?? 0;
  if (current >= MAX_CONCURRENT_PER_USER) return false;
  userSemaphore.set(userId, current + 1);
  return true;
}

function releaseSemaphore(userId: string): void {
  const current = userSemaphore.get(userId) ?? 1;
  if (current <= 1) {
    userSemaphore.delete(userId);
  } else {
    userSemaphore.set(userId, current - 1);
  }
}

// ── Memory cleanup ────────────────────────────────────────────────────────────
// Prevent Map memory leaks in long-running datacenter deployments
function startMemoryCleanup(): ReturnType<typeof setInterval> {
  return setInterval(() => {
    // Cleanup semaphore entries that have been stuck (stale)
    let cleaned = 0;
    for (const [userId, count] of userSemaphore) {
      if (count > MAX_CONCURRENT_PER_USER) {
        userSemaphore.delete(userId);
        cleaned++;
      }
    }
    if (cleaned > 0) {
      console.info(`[HermesAgencyBot] Semaphore cleanup: removed ${cleaned} stale entries`);
    }
  }, CLEANUP_INTERVAL_MS);
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

  // HC-28: Guard — ctx.from is undefined for anonymous channel posts
  if (!ctx.from) {
    await ctx.reply('❌ Não foi possível identificar o remetente.');
    return;
  }

  const userId = String(ctx.from.id);

  // Redis-backed rate limiter (falls back to in-memory)
  const { allowed, retryAfterSec } = await checkRateLimit(userId);
  if (!allowed) {
    // HC-50: Log security event for monitoring
    console.warn('[HermesAgencyBot] Rate limit exceeded', { userId, retryAfterSec });
    await ctx.reply(`⛔ Muitas solicitações. Tente novamente em ${retryAfterSec}s.`);
    return;
  }

  // Redis-backed distributed lock (falls back to in-memory)
  const locked = await acquireLock(chatId);
  if (!locked) {
    // HC-50: Log security event for monitoring
    console.warn('[HermesAgencyBot] Lock busy — concurrent message blocked', { chatId, userId });
    await ctx.reply('⏳ Processando outra mensagem neste chat. Por favor aguarde.');
    return;
  }

  try {
    await next();
  } finally {
    await releaseLock(chatId);
  }
});

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Download Telegram file to a temp path, returns local file path */
async function downloadTelegramFile(fileId: string, token: string): Promise<string> {
  const filePath = await bot.telegram.getFile(fileId);
  const url = `https://api.telegram.org/file/bot${token}/${filePath.file_path}`;

  // HC-26: Validate host to prevent SSRF — only allow Telegram CDN
  const urlObj = new URL(url);
  if (urlObj.hostname !== 'api.telegram.org') {
    throw new Error(`Invalid file host: ${urlObj.hostname}`);
  }

  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`Failed to download file: ${response.status}`);
  const ext = filePath.file_path?.split('.').pop() ?? 'ogg';
  const tmpPath = path.join(os.tmpdir(), `hermes-${randomBytes(6).toString('hex')}.${ext}`);
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
  const userId = String(ctx.from?.id ?? 'unknown');
  const isAdmin = ADMIN_USER_IDS.length === 0 || ADMIN_USER_IDS.includes(userId);

  if (!isAdmin) {
    // Public health — basic status only (no internal ports exposed)
    await ctx.reply('✅ *Hermes Agency Suite*\n\nServiço operacional.', { parse_mode: 'Markdown' });
    return;
  }

  // Admin health — full details including internal services
  const checks = await Promise.all([
    fetchHealth(`${HERMES_GATEWAY_URL}/health`, 'Hermes Gateway'),
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
  const userId = String(ctx.from?.id ?? 0);

  // Concurrency semaphore — prevent flood attacks
  if (!acquireSemaphore(userId)) {
    await ctx.reply('⏳ many uploads in progress. Please wait for them to finish.');
    return;
  }

  let tmpPath: string | null = null;
  try {
    // Download
    const voice = ctx.message.voice;
    tmpPath = await downloadTelegramFile(String(voice.file_id), BOT_TOKEN);

    // File validation: size + MIME magic bytes
    const validation = validateFile(tmpPath);
    if (!validation.valid) {
      // HC-50: Log security event for monitoring
      console.warn('[HermesAgencyBot] Voice file rejected', { userId, reason: validation.reason });
      await ctx.reply(`❌ ${validation.reason}`);
      return;
    }

    // Transcribe
    let transcription: string;
    try {
      transcription = await transcribeAudio(tmpPath);
    } finally {
      fs.unlinkSync(tmpPath);
      tmpPath = null;
    }

    // Route through CEO
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
      console.warn('[HermesAgencyBot] TTS failed, falling back to text:', err);
      await ctx.reply(response);
    }
  } catch (err) {
    console.error('[HermesAgencyBot] Voice error:', err);
    await ctx.reply('❌ Erro ao processar áudio. Tente novamente ou envie texto.');
  } finally {
    if (tmpPath) {
      fs.unlinkSync(tmpPath);
    }
    releaseSemaphore(userId);
  }
});

// ── Photo handler ────────────────────────────────────────────────────────────
bot.on('photo', async (ctx) => {
  const userId = String(ctx.from?.id ?? 0);

  // Concurrency semaphore
  if (!acquireSemaphore(userId)) {
    await ctx.reply('⏳ many uploads in progress. Please wait for them to finish.');
    return;
  }

  const userMessage = 'caption' in ctx.message && ctx.message.caption
    ? ctx.message.caption
    : 'O que vê nesta imagem?';

  const photos = ctx.message.photo;
  if (!photos || photos.length === 0) {
    releaseSemaphore(userId);
    await ctx.reply('📎 Não consegui processar a imagem. Tente novamente.');
    return;
  }
  const largest = photos[photos.length - 1]!;

  let tmpPath: string | null = null;
  try {
    tmpPath = await downloadTelegramFile(String(largest.file_id), BOT_TOKEN);

    // File validation: size + MIME magic bytes
    const validation = validateFile(tmpPath);
    if (!validation.valid) {
      // HC-50: Log security event for monitoring
      console.warn('[HermesAgencyBot] Photo file rejected', { userId, reason: validation.reason });
      await ctx.reply(`❌ ${validation.reason}`);
      return;
    }

    const analysis = await analyzeImage(tmpPath, userMessage);
    await ctx.reply(analysis);
  } catch (err) {
    console.error('[HermesAgencyBot] Vision error:', err);
    await ctx.reply('❌ Erro ao processar imagem. Tente novamente.');
  } finally {
    if (tmpPath) {
      fs.unlinkSync(tmpPath);
    }
    releaseSemaphore(userId);
  }
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

// Start background cleanup tasks
startRateLimitCleanup();
startMemoryCleanup();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

export { bot };
