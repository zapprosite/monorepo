#!/usr/bin/env npx tsx
// Redis Statistics Monitor
// Usage: npx tsx scripts/redis-stats.ts
// Requires: ioredis (npm install ioredis)

import Redis from 'ioredis';

// ── Config ───────────────────────────────────────────────────────────────────

const REDIS_HOST = process.env['REDIS_HOST'] ?? 'zappro-redis';
const REDIS_PORT = parseInt(process.env['REDIS_PORT'] ?? '6379', 10);
const REDIS_PASSWORD = process.env['REDIS_PASSWORD'] ?? 'Fifine156458*';

const PATTERNS = [
  'ratelimit:*',
  'lock:*',
  'chat:*:lock',
  'session:*',
  'cb:*',
  'cb:*:state',
  'cb:*:failures',
  'cb:*:last_failure',
  'cache:rag:*',
  'cache:llm:*',
  'cache:metrics:*',
  'agency:alerts',
  'agency:campaigns:*',
  'agency:tasks:*',
];

// ── Redis Client ──────────────────────────────────────────────────────────────

const redis = new Redis({
  host: REDIS_HOST,
  port: REDIS_PORT,
  password: REDIS_PASSWORD,
  retryStrategy: (times: number) => {
    if (times > 3) {
      console.error('Redis connection failed after 3 retries');
      process.exit(1);
    }
    return Math.min(times * 200, 1000);
  },
  lazyConnect: true,
});

redis.on('error', (err) => {
  console.error(`Redis error: ${err.message}`);
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function bytesToMiB(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
}

function pad(s: string, len: number): string {
  return s.padEnd(len, ' ');
}

async function countKeys(pattern: string): Promise<number> {
  let cursor = '0';
  let total = 0;
  do {
    const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 1000);
    cursor = nextCursor;
    total += keys.length;
  } while (cursor !== '0');
  return total;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const separator = '─'.repeat(72);

  try {
    await redis.connect();
    console.log(`\n Redis Stats — ${REDIS_HOST}:${REDIS_PORT}\n`);
    console.log(separator);

    // ── INFO sections ──────────────────────────────────────────────────────

    const info = await redis.info('memory');
    const memUsed = parseInt(info.match(/used_memory:(\d+)/)?.[1] ?? '0', 10);
    const memPeak = parseInt(info.match(/used_memory_peak:(\d+)/)?.[1] ?? '0', 10);
    const memLimit = parseInt(info.match(/maxmemory:(\d+)/)?.[1] ?? '0', 10);

    console.log('\n[Memory]');
    console.log(`  Used:        ${bytesToMiB(memUsed)}`);
    console.log(`  Peak:        ${bytesToMiB(memPeak)}`);
    console.log(`  Maxmemory:   ${bytesToMiB(memLimit)}`);
    if (memLimit > 0) {
      const pct = ((memUsed / memLimit) * 100).toFixed(1);
      const bar = '█'.repeat(Math.min(Math.floor(Number(pct) / 5), 20)) + '░'.repeat(20 - Math.min(Math.floor(Number(pct) / 5), 20));
      console.log(`  Usage:       [${bar}] ${pct}%`);
    }

    const clientsInfo = await redis.info('clients');
    const connectedClients = parseInt(clientsInfo.match(/connected_clients:(\d+)/)?.[1] ?? '0', 10);
    const blockedClients = parseInt(clientsInfo.match(/blocked_clients:(\d+)/)?.[1] ?? '0', 10);

    console.log('\n[Clients]');
    console.log(`  Connected:   ${connectedClients}`);
    console.log(`  Blocked:     ${blockedClients}`);

    const statsInfo = await redis.info('stats');
    const expiredKeys = parseInt(statsInfo.match(/total_expired_keys:(\d+)/)?.[1] ?? '0', 10);
    const evictedKeys = parseInt(statsInfo.match(/evicted_keys:(\d+)/)?.[1] ?? '0', 10);
    const keyspaceHits = parseInt(statsInfo.match(/keyspace_hits:(\d+)/)?.[1] ?? '0', 10);
    const keyspaceMisses = parseInt(statsInfo.match(/keyspace_misses:(\d+)/)?.[1] ?? '0', 10);
    const totalKeys = keyspaceHits + keyspaceMisses;
    const hitRate = totalKeys > 0 ? ((keyspaceHits / totalKeys) * 100).toFixed(2) : '0.00';

    console.log('\n[Key Performance]');
    console.log(`  Expired:     ${expiredKeys.toLocaleString()}`);
    console.log(`  Evicted:     ${evictedKeys.toLocaleString()}`);
    console.log(`  Hit rate:    ${hitRate}%`);

    let replicationInfo = '';
    try {
      replicationInfo = await redis.info('replication');
    } catch {
      replicationInfo = '';
    }
    const isMaster = !replicationInfo.includes('role:slave');
    const replLag = replicationInfo.match(/master_repl_offset:(\d+)/)?.[1] ?? 'N/A';

    console.log('\n[Replication]');
    console.log(`  Role:        ${isMaster ? 'MASTER' : 'SLAVE'}`);
    console.log(`  Repl offset: ${replLag}`);
    if (!isMaster) {
      const slaveOffset = replicationInfo.match(/slave_repl_offset:(\d+)/)?.[1] ?? 'N/A';
      console.log(`  Slave offset: ${slaveOffset}`);
    }

    // ── Key counts per pattern ──────────────────────────────────────────────

    console.log(`\n[Key Counts — ${PATTERNS.length} patterns]`);
    console.log(pad('Pattern', 40) + pad('Count', 10) + 'Category');
    console.log(pad('', 40, '─') + pad('', 10, '─') + ''.padEnd(20, '─'));

    const categories: Record<string, string> = {
      'ratelimit:*': 'Rate Limiting',
      'lock:*': 'Distributed Locks',
      'chat:*:lock': 'Distributed Locks (legacy)',
      'session:*': 'Session Cache',
      'cb:*': 'Circuit Breaker',
      'cb:*:state': 'Circuit Breaker',
      'cb:*:failures': 'Circuit Breaker',
      'cb:*:last_failure': 'Circuit Breaker',
      'cache:rag:*': 'RAG Cache',
      'cache:llm:*': 'LLM Cache',
      'cache:metrics:*': 'Metrics Cache',
      'agency:alerts': 'Pub/Sub',
      'agency:campaigns:*': 'Pub/Sub',
      'agency:tasks:*': 'Pub/Sub',
    };

    let totalCounted = 0;
    for (const pattern of PATTERNS) {
      const count = await countKeys(pattern);
      totalCounted += count;
      const category = categories[pattern] ?? 'Other';
      const countStr = count === 0 ? '0' : count.toLocaleString();
      console.log(`  ${pad(pattern, 38)} ${pad(countStr, 10)} ${category}`);
    }

    console.log(pad('', 40, '─') + pad('', 10, '─') + ''.padEnd(20, '─'));
    console.log(`  ${pad('TOTAL (counted)', 38)} ${pad(totalCounted.toLocaleString(), 10)}`);

    // ── Summary ─────────────────────────────────────────────────────────────

    const warnings: string[] = [];
    if (memLimit > 0 && memUsed > memLimit * 0.9) warnings.push('Memory > 90%');
    if (evictedKeys > 0) warnings.push(`${evictedKeys.toLocaleString()} evicted keys`);
    if (Number(hitRate) < 80) warnings.push(`Hit rate < 80% (${hitRate}%)`);

    console.log('\n' + separator);
    if (warnings.length > 0) {
      console.log('\n[Warnings]');
      for (const w of warnings) {
        console.log(`  ⚠ ${w}`);
      }
    } else {
      console.log('\n[Status] OK — no warnings');
    }

    console.log('');
  } catch (err) {
    console.error(`\nError: ${err}`);
    process.exit(1);
  } finally {
    await redis.quit();
  }
}

main();
