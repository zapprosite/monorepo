// Anti-hardcoded: all config via process.env
// Circuit Breaker per skill — prevents cascade failures when a skill degrades
/* eslint-disable no-console */

export interface CircuitBreakerState {
  skillId: string;
  state: 'closed' | 'open' | 'half_open';
  failureCount: number;
  lastFailure: number | null;  // timestamp ms
  lastSuccess: number | null;  // timestamp ms
  tripReason: string | null;
}

// Configurable thresholds via env
const FAILURE_THRESHOLD = parseInt(process.env['CIRCUIT_BREAKER_THRESHOLD'] ?? '3', 10);
const RECOVERY_TIMEOUT  = parseInt(process.env['CIRCUIT_BREAKER_RECOVERY_MS'] ?? '30000', 10);

const circuitBreakers = new Map<string, CircuitBreakerState>();

function getOrCreate(skillId: string): CircuitBreakerState {
  if (!circuitBreakers.has(skillId)) {
    circuitBreakers.set(skillId, {
      skillId,
      state: 'closed',
      failureCount: 0,
      lastFailure: null,
      lastSuccess: null,
      tripReason: null,
    });
  }
  return circuitBreakers.get(skillId)!;
}

/**
 * Check if a call to skillId is permitted.
 * Returns true if circuit is closed or half-open (testing).
 * Returns false if circuit is open and recovery timeout not elapsed.
 */
export function isCallPermitted(skillId: string): boolean {
  const cb = circuitBreakers.get(skillId);
  if (!cb) return true; // no CB registered — allow

  if (cb.state === 'open') {
    if (cb.lastFailure !== null && Date.now() - cb.lastFailure < RECOVERY_TIMEOUT) {
      console.warn(`[CircuitBreaker] ${skillId} is OPEN — rejecting call (reason: ${cb.tripReason})`);
      return false;
    }
    // Auto-transition to half_open (recovery timeout elapsed)
    cb.state = 'half_open';
    cb.failureCount = 0;
    console.info(`[CircuitBreaker] ${skillId} → HALF_OPEN (recovery timeout elapsed)`);
  }

  // 'closed' or 'half_open' — permit call
  return true;
}

/** Record a successful call — resets failure count and closes circuit if was half-open */
export function recordSuccess(skillId: string): void {
  const cb = circuitBreakers.get(skillId);
  if (!cb) return;

  cb.failureCount = 0;
  cb.lastSuccess = Date.now();

  if (cb.state === 'half_open') {
    cb.state = 'closed';
    cb.tripReason = null;
    console.info(`[CircuitBreaker] ${skillId} → CLOSED (recovered)`);
  }
}

/** Record a failed call — increments counter and trips circuit if threshold reached */
export function recordFailure(skillId: string, reason: string): void {
  const cb = getOrCreate(skillId);

  cb.failureCount++;
  cb.lastFailure = Date.now();
  cb.tripReason = reason;

  if (cb.state === 'half_open') {
    // Test call failed — go back to open
    cb.state = 'open';
    console.warn(`[CircuitBreaker] ${skillId} → OPEN (half-open test failed: ${reason})`);
  } else if (cb.failureCount >= FAILURE_THRESHOLD) {
    cb.state = 'open';
    console.error(`[CircuitBreaker] ${skillId} → OPEN (tripped after ${cb.failureCount} failures: ${reason})`);
  }
}

/** Get a single circuit breaker state */
export function getCircuitBreaker(skillId: string): CircuitBreakerState | null {
  return circuitBreakers.get(skillId) ?? null;
}

/** Get all circuit breakers — for /health/circuit-breakers endpoint */
export function getAllCircuitBreakers(): CircuitBreakerState[] {
  return Array.from(circuitBreakers.values());
}

/** Reset a circuit breaker (for testing/admin) — creates if not exists */
export function resetCircuitBreaker(skillId: string): void {
  const cb = getOrCreate(skillId);
  cb.state = 'closed';
  cb.failureCount = 0;
  cb.lastFailure = null;
  cb.lastSuccess = null;
  cb.tripReason = null;
}
