#!/usr/bin/env npx tsx
/**
 * setup-telegram-webhook.ts
 *
 * Configura webhooks para os bots Telegram do homelab.
 * Suporta configuração individual ou de todos os bots.
 *
 * Uso:
 *   npx tsx scripts/setup-telegram-webhook.ts --bot CEO_REFRIMIX
 *   npx tsx scripts/setup-telegram-webhook.ts --bot ATHLOS
 *   npx tsx scripts/setup-telegram-webhook.ts --bot HOMELAB
 *   npx tsx scripts/setup-telegram-webhook.ts --all
 *   npx tsx scripts/setup-telegram-webhook.ts --verify
 *   npx tsx scripts/setup-telegram-webhook.ts --verify --bot CEO_REFRIMIX
 *   npx tsx scripts/setup-telegram-webhook.ts --delete --bot CEO_REFRIMIX
 */

import * as readline from 'node:readline';

// ── Types ─────────────────────────────────────────────────────────────────────

interface BotConfig {
  name: string;
  envToken: string;
  envWebhookUrl: string;
  webhookPath: string;
  description: string;
}

interface WebhookInfo {
  url: string | null;
  has_custom_certificate: boolean;
  pending_update_count: number;
  max_connections: number;
  is_disabled: boolean;
}

// ── Bot Configurations ────────────────────────────────────────────────────────

const BOT_CONFIGS: Record<string, BotConfig> = {
  CEO_REFRIMIX: {
    name: 'CEO_REFRIMIX',
    envToken: 'TELEGRAM_BOT_TOKEN',
    envWebhookUrl: 'HERMES_GATEWAY_WEBHOOK_URL',
    webhookPath: '/webhook/ceo_refrimix',
    description: 'CEO Refrimix Bot - Agent lider, roteamento de campanhas',
  },
  ATHLOS: {
    name: 'ATHLOS',
    envToken: 'ATHLOS_BOT_TOKEN',
    envWebhookUrl: 'ATHLOS_WEBHOOK_URL',
    webhookPath: '/webhook/athlos_life',
    description: 'Athlos Life Bot - Brand identity Athlos',
  },
  HOMELAB: {
    name: 'HOMELAB',
    envToken: 'HOMELAB_LOGS_BOT_TOKEN',
    envWebhookUrl: 'HOMELAB_LOGS_WEBHOOK_URL',
    webhookPath: '/webhook/homelab_logs',
    description: 'Homelab Logs Bot - System alerts, CI/CD notifications',
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function getBaseUrl(): string {
  return process.env['TELEGRAM_WEBHOOK_BASE_URL'] ?? 'https://hermes.zappro.site';
}

function getToken(config: BotConfig): string {
  const token = process.env[config.envToken];
  if (!token) {
    throw new Error(`Missing ${config.envToken} in environment`);
  }
  return token;
}

function getWebhookUrl(config: BotConfig): string {
  const baseUrl = getBaseUrl();
  // Allow override via env var for flexibility
  const envUrl = process.env[config.envWebhookUrl];
  if (envUrl) {
    return `${envUrl}${config.webhookPath}`;
  }
  return `${baseUrl}${config.webhookPath}`;
}

async function setWebhook(
  token: string,
  webhookUrl: string,
): Promise<{ ok: boolean; description: string }> {
  const url = `https://api.telegram.org/bot${token}/setWebhook`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: webhookUrl,
      max_connections: 100,
      allowed_updates: ['message', 'callback_query', 'inline_query'],
    }),
  });
  return response.json() as Promise<{ ok: boolean; description: string }>;
}

async function getWebhookInfo(token: string): Promise<WebhookInfo> {
  const url = `https://api.telegram.org/bot${token}/getWebhookInfo`;
  const response = await fetch(url);
  return response.json() as Promise<WebhookInfo>;
}

async function deleteWebhook(
  token: string,
): Promise<{ ok: boolean; description: string }> {
  const url = `https://api.telegram.org/bot${token}/deleteWebhook`;
  const response = await fetch(url, { method: 'POST' });
  return response.json() as Promise<{ ok: boolean; description: string }>;
}

async function getMe(token: string): Promise<{ ok: boolean; result: { username: string; id: number } }> {
  const url = `https://api.telegram.org/bot${token}/getMe`;
  const response = await fetch(url);
  return response.json() as Promise<{ ok: boolean; result: { username: string; id: number } }>;
}

// ── Actions ───────────────────────────────────────────────────────────────────

async function setupBot(botKey: string): Promise<void> {
  const config = BOT_CONFIGS[botKey];
  if (!config) {
    console.error(`❌ Bot desconhecido: ${botKey}`);
    console.error(`   Bots disponíveis: ${Object.keys(BOT_CONFIGS).join(', ')}`);
    process.exit(1);
  }

  console.log(`\n🔧 Configurando ${config.name}`);
  console.log(`   ${config.description}`);

  const token = getToken(config);
  const webhookUrl = getWebhookUrl(config);

  // Verify bot token
  console.log(`\n   Verificando token...`);
  const me = await getMe(token);
  if (!me.ok) {
    console.error(`❌ Token inválido: ${me.description}`);
    process.exit(1);
  }
  console.log(`   ✅ Bot: @${me.result.username}`);

  // Setup webhook
  console.log(`\n   Configurando webhook...`);
  console.log(`   URL: ${webhookUrl}`);
  const result = await setWebhook(token, webhookUrl);
  if (!result.ok) {
    console.error(`❌ Erro ao configurar webhook: ${result.description}`);
    process.exit(1);
  }
  console.log(`   ✅ Webhook configurado`);

  // Verify webhook
  console.log(`\n   Verificando webhook...`);
  const info = await getWebhookInfo(token);
  console.log(`   URL: ${info.url ?? '(none)'}`);
  console.log(`   Pending updates: ${info.pending_update_count}`);
  console.log(`   Max connections: ${info.max_connections}`);
  console.log(`   Disabled: ${info.is_disabled}`);

  if (info.url !== webhookUrl) {
    console.warn(`⚠️  Webhook URL não corresponde ao esperado`);
  }

  console.log(`\n✅ ${config.name} configurado com sucesso!`);
}

async function verifyBot(botKey: string): Promise<void> {
  const config = BOT_CONFIGS[botKey];
  if (!config) {
    console.error(`❌ Bot desconhecido: ${botKey}`);
    process.exit(1);
  }

  console.log(`\n🔍 Verificando ${config.name}...`);

  const token = getToken(config);

  // Verify bot token
  const me = await getMe(token);
  if (!me.ok) {
    console.error(`❌ Token inválido: ${me.description}`);
    process.exit(1);
  }
  console.log(`   Bot: @${me.result.username}`);

  // Get webhook info
  const info = await getWebhookInfo(token);
  console.log(`\n   Webhook Status:`);
  console.log(`   URL: ${info.url ?? '(none)'}`);
  console.log(`   Has certificate: ${info.has_custom_certificate}`);
  console.log(`   Pending updates: ${info.pending_update_count}`);
  console.log(`   Max connections: ${info.max_connections}`);
  console.log(`   Is disabled: ${info.is_disabled}`);

  if (info.url) {
    console.log(`\n✅ Webhook activo para ${config.name}`);
  } else {
    console.log(`\n⚠️  Webhook não está activo para ${config.name}`);
  }
}

async function deleteBotWebhook(botKey: string): Promise<void> {
  const config = BOT_CONFIGS[botKey];
  if (!config) {
    console.error(`❌ Bot desconhecido: ${botKey}`);
    process.exit(1);
  }

  console.log(`\n🗑️  Removendo webhook de ${config.name}...`);

  const token = getToken(config);
  const result = await deleteWebhook(token);

  if (!result.ok) {
    console.error(`❌ Erro ao remover webhook: ${result.description}`);
    process.exit(1);
  }

  console.log(`✅ Webhook removido de ${config.name}`);
}

async function verifyAllBots(): Promise<void> {
  console.log('\n🔍 Verificando todos os bots...\n');

  for (const botKey of Object.keys(BOT_CONFIGS)) {
    try {
      await verifyBot(botKey);
    } catch (err) {
      console.error(`❌ Erro ao verificar ${botKey}:`, err);
    }
    console.log('\n' + '─'.repeat(60));
  }
}

async function setupAllBots(): Promise<void> {
  console.log('\n🔧 Configurando todos os bots...\n');

  for (const botKey of Object.keys(BOT_CONFIGS)) {
    try {
      await setupBot(botKey);
    } catch (err) {
      console.error(`❌ Erro ao configurar ${botKey}:`, err);
    }
    console.log('\n' + '─'.repeat(60));
  }
}

// ── CLI Parser ────────────────────────────────────────────────────────────────

function parseArgs(): { action: string; bot?: string } {
  const args = process.argv.slice(2);
  let action = 'setup';
  let bot: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!.toLowerCase();
    if (arg === '--bot' || arg === '-b') {
      bot = args[++i]?.toUpperCase();
    } else if (arg === '--all' || arg === '-a') {
      action = 'all';
    } else if (arg === '--verify' || arg === '-v') {
      action = 'verify';
    } else if (arg === '--delete' || arg === '-d') {
      action = 'delete';
    } else if (arg === '--help' || arg === '-h') {
      action = 'help';
    } else if (arg.startsWith('--')) {
      console.warn(`⚠️  Opção desconhecida: ${arg}`);
    } else {
      // Positional argument
      bot = arg.toUpperCase();
    }
  }

  return { action, bot };
}

function showHelp(): void {
  console.log(`
🤖 Homelab — Telegram Bot Webhook Setup

USO
  npx tsx scripts/setup-telegram-webhook.ts [OPÇÕES]

OPÇÕES
  --bot, -b <NOME>     Configurar bot específico (requer nome)
  --all, -a            Configurar todos os bots
  --verify, -v         Verificar webhook(s) activo(s)
  --delete, -d         Remover webhook (voltar a polling)
  --help, -h           Mostrar esta ajuda

BOTS DISPONÍVEIS
  CEO_REFRIMIX     @CEO_REFRIMIX_bot — Agent lider
  ATHLOS           @Athlos_Life_bot — Athlos brand
  HOMELAB          @HOMELAB_LOGS_bot — Homelab alerts

EXEMPLOS
  # Configurar webhook para CEO bot
  npx tsx scripts/setup-telegram-webhook.ts --bot CEO_REFRIMIX

  # Configurar todos os bots
  npx tsx scripts/setup-telegram-webhook.ts --all

  # Verificar webhook de todos os bots
  npx tsx scripts/setup-telegram-webhook.ts --verify

  # Verificar webhook de bot específico
  npx tsx scripts/setup-telegram-webhook.ts --verify --bot HOMELAB

  # Remover webhook (voltar a polling)
  npx tsx scripts/setup-telegram-webhook.ts --delete --bot CEO_REFRIMIX

VARIÁVEIS DE AMBIENTE
  TELEGRAM_WEBHOOK_BASE_URL      Base URL para webhooks (default: https://hermes.zappro.site)
  TELEGRAM_BOT_TOKEN            Token do CEO bot (@CEO_REFRIMIX_bot)
  ATHLOS_BOT_TOKEN               Token do Athlos bot
  HOMELAB_LOGS_BOT_TOKEN         Token do Homelab bot

  # Override de URLs específicas
  HERMES_GATEWAY_WEBHOOK_URL
  ATHLOS_WEBHOOK_URL
  HOMELAB_LOGS_WEBHOOK_URL
`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const { action, bot } = parseArgs();

  // Validate bot argument for non-all actions
  if (action !== 'all' && action !== 'help' && !bot) {
    console.error('❌ Erro: --bot é obrigatório');
    console.error('   Use --help para ajuda');
    process.exit(1);
  }

  if (action === 'help') {
    showHelp();
    return;
  }

  if (action === 'all') {
    await setupAllBots();
    return;
  }

  if (action === 'verify') {
    if (bot) {
      await verifyBot(bot);
    } else {
      await verifyAllBots();
    }
    return;
  }

  if (action === 'delete') {
    if (bot) {
      await deleteBotWebhook(bot);
    } else {
      console.error('❌ Erro: --bot é obrigatório para --delete');
      process.exit(1);
    }
    return;
  }

  // Default: setup
  if (bot) {
    await setupBot(bot);
  } else {
    console.error('❌ Erro: --bot é obrigatório');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('❌ Erro fatal:', err);
  process.exit(1);
});
