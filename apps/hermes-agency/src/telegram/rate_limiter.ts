// Anti-hardcoded: all config via process.env
// Hermes Agency — Redis-backed sliding-window rate limiter with in-memory fallback

import { getRedis, isRedisAvailable } from './redis';

// ── Env vars ─────────────────────────────────────────────────────────────────
const RATE_LIMIT_WINDOW_MS = parseInt(process.env['HERMES_RATE_WINDOW_MS'] ?? '10000', 10);
const RATE_LIMIT_MAX_MESSAGES = parseInt(process.env['HERMES_RATE_MAX_MSGS'] ?? '5', 10);

// ── In-memory fallback ────────────────────────────────────────────────────────
interface RateLimitEntry {
  count: number;
  resetAt: number;
}
const memoryRateLimit = new Map<string, RateLimitEntry>();

// ── Sliding window rate limiter ──────────────────────────────────────────────

/**
 * Check if a user is within rate limits using Redis sliding window.
 * Uses Redis INCR + EXPIRE when available; falls back to in-memory Map.
 *
 * @returns { allowed: boolean, retryAfterSec: number }
 */
export async function checkRateLimit(userId: string): Promise<{ allowed: boolean; retryAfterSec: number }> {
  const redis = getRedis();
  const redisUp = await isRedisAvailable();
  const now = Date.now();
  const key = `ratelimit:${userId}`;

  if (redis && redisUp) {
    try {
      const pipeline = redis.pipeline();
      pipeline.incr(key);
      pipeline.pttl(key);
      const results = await pipeline.exec();

      if (!results) throw new Error('pipeline returned null');

      const incrResult = results[0];
      const pttlResult = results[1];

      if (!incrResult || !pttlResult) throw new Error('pipeline result missing');

      const count = (incrResult[1] as number) ?? 1;
      const ttl = (pttlResult[1] as number) ?? RATE_LIMIT_WINDOW_MS;

      // First request in this window — set expiry
      if (count === 1) {
        await redis.pexpire(key, RATE_LIMIT_WINDOW_MS);
      }

      if (count > RATE_LIMIT_MAX_MESSAGES) {
        const retryAfterSec = Math.ceil(ttl / 1000);
        return { allowed: false, retryAfterSec: Math.max(retryAfterSec, 1) };
      }

      return { allowed: true, retryAfterSec: 0 };
    } catch (err) {
      console.warn(`[HermesAgencyBot] Redis rate limit failed, using memory fallback — ${err}`);
    }
  }

  // Fallback: in-memory sliding window
  if (!redisUp) {
    console.warn(`[HermesAgencyBot] Redis unavailable — using in-memory rate limiter (single-instance only)`);
  }

  const entry = memoryRateLimit.get(userId);
  if (!entry || now >= entry.resetAt) {
    memoryRateLimit.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, retryAfterSec: 0 };
  }

  if (entry.count >= RATE_LIMIT_MAX_MESSAGES) {
    const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, retryAfterSec: Math.max(retryAfterSec, 1) };
  }

  entry.count++;
  return { allowed: true, retryAfterSec: 0 };
}

/**
 * Periodic cleanup of expired in-memory rate limit entries.
 * Call this via setInterval to prevent memory growth.
 * Only affects the in-memory fallback; Redis handles its own TTL.
 */
export function cleanupExpiredRateLimitEntries(): void {
  const now = Date.now();
  let cleaned = 0;
  for (const [userId, entry] of memoryRateLimit) {
    if (now >= entry.resetAt + RATE_LIMIT_WINDOW_MS) {
      memoryRateLimit.delete(userId);
      cleaned++;
    }
  }
  if (cleaned > 0) {
    console.info(`[HermesAgencyBot] Rate limiter cleanup: removed ${cleaned} expired entries (in-memory fallback mode)`);
  }
}

/**
 * Start periodic cleanup of expired rate limit entries.
 * Runs every RATE_LIMIT_WINDOW_MS * 2.
 */
export function startRateLimitCleanup(): ReturnType<typeof setInterval> {
  return setInterval(cleanupExpiredRateLimitEntries, RATE_LIMIT_WINDOW_MS * 2);
}
