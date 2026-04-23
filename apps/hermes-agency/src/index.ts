// Anti-hardcoded: all config via process.env
// Hermes Agency Suite — Entry Point
/* eslint-disable no-console */

import http from 'node:http';
import { initAllCollections } from './qdrant/client';
import { getAllCircuitBreakers } from './skills/circuit_breaker.js';

// Bot is launched in telegram/bot.ts (side-effect import)

console.log('[HermesAgency] Starting Hermes Agency Suite...');

// HC-37: Startup validation — fail fast only for secrets (not for services)
const REQUIRED = ['HERMES_AGENCY_BOT_TOKEN', 'AI_GATEWAY_FACADE_KEY', 'QDRANT_URL', 'OLLAMA_URL'];
for (const key of REQUIRED) {
  if (!process.env[key]) {
    console.error(`[HermesAgency] FATAL: ${key} not set in .env`);
    process.exit(1);
  }
}

// HC-39: Non-blocking connectivity checks — warn only, do not block startup
// Services may be temporarily unavailable during rolling deployments
const QDRANT_URL = process.env['QDRANT_URL']!;
fetch(`${QDRANT_URL}/collections`, { signal: AbortSignal.timeout(3000) })
  .then((r) => {
    if (!r.ok) console.warn(`[HermesAgency] WARN: Qdrant at ${QDRANT_URL} returned ${r.status}`);
    else console.log('[HermesAgency] Qdrant: reachable');
  })
  .catch(() =>
    console.warn(`[HermesAgency] WARN: Qdrant not reachable at ${QDRANT_URL} — degraded mode`),
  );

const OLLAMA_URL = process.env['OLLAMA_URL']!;
fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(3000) })
  .then((r) => {
    if (!r.ok) console.warn(`[HermesAgency] WARN: Ollama at ${OLLAMA_URL} returned ${r.status}`);
    else console.log('[HermesAgency] Ollama: reachable');
  })
  .catch(() =>
    console.warn(`[HermesAgency] WARN: Ollama not reachable at ${OLLAMA_URL} — degraded mode`),
  );

// Initialize Qdrant collections
initAllCollections().catch((err) => {
  console.error('[HermesAgency] FATAL: Qdrant init failed:', err);
  process.exit(1);
});

console.log('[HermesAgency] Telegram bot starting...');

// Health check endpoint
const healthPort = parseInt(process.env['HERMES_AGENCY_PORT'] ?? '3001', 10);

// Rate limit config (duplicated from rate_limiter.ts for self-contained health endpoint)
const RATE_LIMIT_WINDOW_MS = parseInt(process.env['HERMES_RATE_WINDOW_MS'] ?? '10000', 10);
const RATE_LIMIT_MAX_MESSAGES = parseInt(process.env['HERMES_RATE_MAX_MSGS'] ?? '5', 10);

/**
 * Extract Bearer token from Authorization header.
 */
function getBearerToken(req: http.IncomingMessage): string | null {
  const auth = req.headers['authorization'];
  if (!auth?.startsWith('Bearer ')) return null;
  return auth.slice(7);
}

/**
 * Validate API key — returns true if valid.
 */
function validateApiKey(req: http.IncomingMessage): boolean {
  const key = process.env['HERMES_API_KEY'];
  if (!key) return false;
  const token = getBearerToken(req);
  return token === key;
}

/**
 * Get rate limit metrics for display.
 */
async function getRateLimitMetrics(): Promise<{
  windowMs: number;
  maxMessages: number;
  redisAvailable: boolean;
}> {
  try {
    const { isRedisAvailable } = await import('./telegram/redis');
    const redisUp = await isRedisAvailable();
    return {
      windowMs: RATE_LIMIT_WINDOW_MS,
      maxMessages: RATE_LIMIT_MAX_MESSAGES,
      redisAvailable: redisUp,
    };
  } catch {
    return {
      windowMs: RATE_LIMIT_WINDOW_MS,
      maxMessages: RATE_LIMIT_MAX_MESSAGES,
      redisAvailable: false,
    };
  }
}

const healthServer = http.createServer(async (req, res) => {
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
  } else if (req.url === '/ready') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ready: true, timestamp: new Date().toISOString() }));
  } else if (req.url === '/health/authenticated') {
    // Authenticated health — requires Bearer token
    if (!validateApiKey(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json', 'WWW-Authenticate': 'Bearer' });
      res.end(JSON.stringify({ error: 'Unauthorized — valid API key required' }));
      return;
    }
    const breakers = getAllCircuitBreakers();
    const rateLimitMetrics = await getRateLimitMetrics();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        status: 'ok',
        service: 'hermes-agency-suite',
        version: '0.1.0',
        timestamp: new Date().toISOString(),
        circuitBreakers: breakers,
        rateLimits: {
          windowMs: rateLimitMetrics.windowMs,
          maxMessages: rateLimitMetrics.maxMessages,
          redisAvailable: rateLimitMetrics.redisAvailable,
        },
      }),
    );
  } else if (req.url === '/health/circuit-breakers') {
    // HC-36: Circuit breaker status — admin only
    const adminIds = (process.env['HERMES_ADMIN_USER_IDS'] ?? '').split(',').filter(Boolean);
    const queryParams = new URL(req.url ?? '', 'http://localhost').searchParams;
    const userId = queryParams.get('userId');
    if (!userId || !adminIds.includes(userId)) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Forbidden — admin only' }));
      return;
    }
    const breakers = getAllCircuitBreakers();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ circuitBreakers: breakers, timestamp: new Date().toISOString() }));
  } else {
    res.writeHead(404);
    res.end();
  }
});

healthServer.listen(healthPort, () => {
  console.log(`[HermesAgency] Health endpoint: http://localhost:${healthPort}/health`);
});

// HC-38: Graceful shutdown — close HTTP server on container signals
// Note: bot.ts handles SIGINT/SIGTERM for the Telegraf bot (polling stop)
const shutdown = () => {
  console.log('[HermesAgency] Shutdown signal received — closing health server');
  healthServer.close(() => {
    console.log('[HermesAgency] Health server closed');
  });
};
process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);

console.log('[HermesAgency] Hermes Agency Suite started');
