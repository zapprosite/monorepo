// Anti-hardcoded: all config via process.env
// Hermes Agency — Redis-backed distributed lock with in-memory fallback

import { getRedis, isRedisAvailable } from './redis';

// ── Env vars ─────────────────────────────────────────────────────────────────
const LOCK_TTL_SECONDS = parseInt(process.env['HERMES_LOCK_TTL_SEC'] ?? '30', 10);

// ── In-memory fallback (degraded mode) ───────────────────────────────────────
const memoryLocks = new Map<number, boolean>();

// ── Distributed lock via Redis SETNX + TTL ───────────────────────────────────

/**
 * Acquire a lock for a given chatId.
 * Uses Redis SETNX with TTL when available; falls back to in-memory Map.
 * Returns true if lock was acquired, false if already held.
 */
export async function acquireLock(chatId: number): Promise<boolean> {
  const redis = getRedis();
  const redisUp = await isRedisAvailable();

  if (redis && redisUp) {
    try {
      // SET key chat:{chatId}:lock value 1 NX EX {TTL}
      const key = `chat:${chatId}:lock`;
      const result = await redis.set(key, '1', 'EX', LOCK_TTL_SECONDS, 'NX');
      return result === 'OK';
    } catch (err) {
      console.warn(`[HermesAgencyBot] Redis lock failed, using memory fallback — ${err}`);
    }
  }

  // Fallback: in-memory (NOT safe for multi-instance, logged as warning)
  if (!redisUp) {
    console.warn(`[HermesAgencyBot] Redis unavailable — using in-memory lock (single-instance only)`);
  }
  if (memoryLocks.get(chatId)) return false;
  memoryLocks.set(chatId, true);
  return true;
}

/**
 * Release a lock for a given chatId.
 * Uses Redis DEL when available; falls back to Map delete.
 */
export async function releaseLock(chatId: number): Promise<void> {
  const redis = getRedis();
  const redisUp = await isRedisAvailable();

  if (redis && redisUp) {
    try {
      const key = `chat:${chatId}:lock`;
      await redis.del(key);
      return;
    } catch (err) {
      console.warn(`[HermesAgencyBot] Redis unlock failed — ${err}`);
    }
  }

  // Fallback: in-memory
  memoryLocks.delete(chatId);
}

/**
 * Check if a chatId is currently locked (read-only check).
 */
export async function isLocked(chatId: number): Promise<boolean> {
  const redis = getRedis();
  const redisUp = await isRedisAvailable();

  if (redis && redisUp) {
    try {
      const key = `chat:${chatId}:lock`;
      const exists = await redis.exists(key);
      return exists === 1;
    } catch (err) {
      console.warn(`[HermesAgencyBot] Redis lock check failed — ${err}`);
    }
  }

  return memoryLocks.get(chatId) ?? false;
}
