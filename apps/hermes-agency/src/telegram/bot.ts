// Anti-hardcoded: all config via process.env
// Hermes Agency Telegram Bot

import { Telegraf } from 'telegraf';
import { routeToSkill } from '../router/agency_router.ts';

const BOT_TOKEN = process.env.HERMES_AGENCY_BOT_TOKEN ?? '';
const WEBHOOK_URL = process.env.HERMES_AGENCY_WEBHOOK_URL ?? '';

// Per-chat mutex locks (in-memory for simplicity — use Redis for production)
const chatLocks = new Map<number, boolean>();

function acquireLock(chatId: number): boolean {
  if (chatLocks.get(chatId)) {
    return false; // Already locked
  }
  chatLocks.set(chatId, true);
  return true;
}

function releaseLock(chatId: number): void {
  chatLocks.delete(chatId);
}

if (!BOT_TOKEN) {
  console.error('[HermesAgencyBot] HERMES_AGENCY_BOT_TOKEN not set in .env');
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

// Middleware: per-chat lock
bot.use(async (ctx, next) => {
  const chatId = ctx.chat?.id;
  if (!chatId) {
    await ctx.reply('❌ Erro: chat ID não encontrado.');
    return;
  }

  if (!acquireLock(chatId)) {
    await ctx.reply('⏳ Procesando outra mensagem neste chat. Por favor aguarde.');
    return;
  }

  try {
    await next();
  } finally {
    releaseLock(chatId);
  }
});

// Command: /start
bot.command('start', async (ctx) => {
  await ctx.reply(
    `🎙️ *Hermes Agency Suite*

Olá! Sou o CEO MIX da Hermes Agency.

Posso ajudá-lo com:
• 📋 Criar campanhas de marketing
• 🎬 Editar vídeos
• 🎨 Design e imagens
• 📊 Analytics e relatórios
• 📅 Gerenciar redes sociais
• ✅ Garantir consistência de marca

Digite sua mensagem ou use /help para ver todos os comandos.`,
    { parse_mode: 'Markdown' },
  );
});

// Command: /help
bot.command('help', async (ctx) => {
  await ctx.reply(
    `*Comandos disponíveis:*

/start — Iniciar conversa
/help — Este menu
/campaign — Criar nova campanha
/tasks — Ver tarefas ativas
/status — Status da agência
/analytics — Relatório de métricas

Ou apenas descreva o que você precisa!`,
    { parse_mode: 'Markdown' },
  );
});

// Command: /health
bot.command('health', async (ctx) => {
  const checks = await Promise.all([
    fetchHealth('http://localhost:8642/health', 'Hermes :8642'),
    fetchHealth('http://localhost:6333/collections', 'Qdrant :6333'),
    fetchHealth('http://localhost:11434/api/tags', 'Ollama :11434'),
    fetchHealth('http://localhost:4000/health', 'LiteLLM :4000'),
  ]);

  const lines = checks.map(([name, ok]) => `${ok ? '✅' : '❌'} ${name}`).join('\n');
  await ctx.reply(`*Health Check*\n\n${lines}`, { parse_mode: 'Markdown' });
});

// Message handler — main routing
bot.on('message', async (ctx) => {
  const message = 'text' in ctx.message ? ctx.message.text : '';
  if (!message) {
    await ctx.reply('📎 Recebi algo que não é texto. Tente novamente.');
    return;
  }

  const chatId = ctx.chat?.id ?? 0;
  const userId = String(ctx.from?.id ?? 'unknown');

  try {
    const response = await routeToSkill(message, {
      skillId: 'agency-ceo',
      userId,
      chatId,
      message,
    });

    await ctx.reply(response);
  } catch (err) {
    console.error('[HermesAgencyBot] Routing error:', err);
    await ctx.reply('❌ Erro ao processar mensagem. Tente novamente.');
  }
});

// Error handler
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

// Start bot
if (WEBHOOK_URL) {
  bot.launch({ webhook: { domain: WEBHOOK_URL, port: 3001 } });
  console.log(`[HermesAgencyBot] Webhook mode: ${WEBHOOK_URL}`);
} else {
  bot.launch({ polling: { timeout: 30, limit: 100 } });
  console.log('[HermesAgencyBot] Polling mode started');
}

// Graceful shutdown
process.once('SIGINT', () => {
  bot.stop('SIGINT');
});
process.once('SIGTERM', () => {
  bot.stop('SIGTERM');
});

export { bot };
