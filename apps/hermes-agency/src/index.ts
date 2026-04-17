// Anti-hardcoded: all config via process.env
// Hermes Agency Suite — Entry Point

import http from 'node:http';
import { initAllCollections } from './qdrant/client';

// Bot is launched in telegram/bot.ts (side-effect import)

console.log('[HermesAgency] Starting Hermes Agency Suite...');

// Startup validation — fail fast if required env vars are missing or unreachable
const REQUIRED = ['HERMES_AGENCY_BOT_TOKEN', 'QDRANT_URL', 'OLLAMA_URL'];
for (const key of REQUIRED) {
  if (!process.env[key]) {
    console.error(`[HermesAgency] FATAL: ${key} not set in .env`);
    process.exit(1);
  }
}

// Verify Qdrant is reachable at startup
const QDRANT_URL = process.env['QDRANT_URL']!;
try {
  const response = await fetch(`${QDRANT_URL}/collections`);
  if (!response.ok) {
    console.error(`[HermesAgency] FATAL: Qdrant not reachable at ${QDRANT_URL} (status ${response.status})`);
    process.exit(1);
  }
} catch (err) {
  console.error(`[HermesAgency] FATAL: Cannot connect to Qdrant at ${QDRANT_URL}:`, err);
  process.exit(1);
}

// Verify Ollama is reachable at startup
const OLLAMA_URL = process.env['OLLAMA_URL']!;
try {
  const response = await fetch(`${OLLAMA_URL}/api/tags`);
  if (!response.ok) {
    console.error(`[HermesAgency] FATAL: Ollama not reachable at ${OLLAMA_URL} (status ${response.status})`);
    process.exit(1);
  }
} catch (err) {
  console.error(`[HermesAgency] FATAL: Cannot connect to Ollama at ${OLLAMA_URL}:`, err);
  process.exit(1);
}

// Initialize Qdrant collections
initAllCollections().catch((err) => {
  console.error('[HermesAgency] FATAL: Qdrant init failed:', err);
  process.exit(1);
});

console.log('[HermesAgency] Telegram bot starting...');

// Health check endpoint
const healthPort = parseInt(process.env['HERMES_AGENCY_PORT'] ?? '3001', 10);

const healthServer = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        status: 'ok',
        service: 'hermes-agency-suite',
        version: '0.1.0',
        timestamp: new Date().toISOString(),
      }),
    );
  } else {
    res.writeHead(404);
    res.end();
  }
});

healthServer.listen(healthPort, () => {
  console.log(`[HermesAgency] Health endpoint: http://localhost:${healthPort}/health`);
});

console.log('[HermesAgency] Hermes Agency Suite started');
