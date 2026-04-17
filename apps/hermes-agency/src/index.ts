// Anti-hardcoded: all config via process.env
// Hermes Agency Suite — Entry Point

import http from 'node:http';
import { bot } from './telegram/bot.ts';
import { initAllCollections } from './qdrant/client.ts';

console.log('[HermesAgency] Starting Hermes Agency Suite...');

// Initialize Qdrant collections (non-blocking — will retry on first query)
initAllCollections().catch((err) => {
  console.warn('[HermesAgency] Qdrant init failed (will retry on query):', err);
});

console.log('[HermesAgency] Telegram bot starting...');
// Bot is already launched in bot.ts constructor

// Health check endpoint
const healthPort = parseInt(process.env.HERMES_AGENCY_PORT ?? '3001', 10);

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
