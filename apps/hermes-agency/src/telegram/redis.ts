// Anti-hardcoded: all config via process.env
// Hermes Agency — Redis client singleton with graceful memory fallback

import Redis from 'ioredis';

// ── Env vars ────────────────────────────────────────────────────────────────
// REDIS_URL takes priority; fall back to individual components from .env
function buildRedisUrl(): string {
  const url = process.env['REDIS_URL'];
  const password = process.env['REDIS_PASSWORD'];

  if (url) {
    if (password && !url.includes('@')) {
      // Replace redis:// with redis://:password@
      return url.replace('redis://', `redis://:${password}@`);
    }
    return url;
  }

  // fallback logic for individual components
  const host = process.env['REDIS_HOST'] ?? 'localhost';
  const port = process.env['REDIS_PORT'] ?? '6379';
  const authPrefix = password ? `:${password}@` : '';
  return `redis://${authPrefix}${host}:${port}`;
}
const REDIS_URL = buildRedisUrl();
const REDIS_CONNECT_TIMEOUT_MS = parseInt(process.env['REDIS_CONNECT_TIMEOUT_MS'] ?? '5000', 10);
const REDIS_RETRY_DELAY_MS = parseInt(process.env['REDIS_RETRY_DELAY_MS'] ?? '2000', 10);
const REDIS_MAX_RETRIES = parseInt(process.env['REDIS_MAX_RETRIES'] ?? '3', 10);

// ── State ────────────────────────────────────────────────────────────────────
let _redis: Redis | null = null;
let _redisAvailable = false;

// ── Redis client (lazy init) ────────────────────────────────────────────────
function createRedisClient(): Redis {
  const client = new Redis(REDIS_URL, {
    connectTimeout: REDIS_CONNECT_TIMEOUT_MS,
    maxRetriesPerRequest: 1,
    lazyConnect: true,
    enableOfflineQueue: false,
    retryStrategy(times: number) {
      if (times > REDIS_MAX_RETRIES) {
        return null; // stop retrying
      }
      return Math.min(times * REDIS_RETRY_DELAY_MS, 10000);
    },
  });

  client.on('connect', () => {
    console.warn('[HermesAgencyBot] Redis: connected');
    _redisAvailable = true;
  });

  client.on('error', (err: Error) => {
    console.warn(`[HermesAgencyBot] Redis: error — ${err.message}`);
    _redisAvailable = false;
  });

  client.on('close', () => {
    console.warn('[HermesAgencyBot] Redis: connection closed');
    _redisAvailable = false;
  });

  return client;
}

/** Get or create the Redis client (lazy). Returns null if Redis is unavailable. */
export function getRedis(): Redis | null {
  if (_redis !== null) return _redis;
  try {
    _redis = createRedisClient();
    _redis.connect().catch((err: Error) => {
      console.warn(`[HermesAgencyBot] Redis: initial connect failed — ${err.message}. Running in degraded mode (in-memory fallback).`);
      _redisAvailable = false;
    });
    return _redis;
  } catch (err) {
    console.warn(`[HermesAgencyBot] Redis: client creation failed — ${err}. Running in degraded mode.`);
    _redisAvailable = false;
    return null;
  }
}

/** Whether Redis is currently available. Updates on every call by ping. */
export async function isRedisAvailable(): Promise<boolean> {
  const client = getRedis();
  if (!client) return false;
  try {
    const result = await client.ping();
    _redisAvailable = result === 'PONG';
    return _redisAvailable;
  } catch {
    _redisAvailable = false;
    return false;
  }
}

/** Check if Redis is available at startup. Returns true only if ping succeeds. */
export async function waitForRedis(timeoutMs = 5000): Promise<boolean> {
  const client = getRedis();
  if (!client) return false;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const result = await client.ping();
      if (result === 'PONG') {
        _redisAvailable = true;
        return true;
      }
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

/** Close Redis connection gracefully. */
export async function closeRedis(): Promise<void> {
  if (_redis) {
    await _redis.quit().catch(() => {});
    _redis = null;
    _redisAvailable = false;
  }
}
