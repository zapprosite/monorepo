// Anti-hardcoded: all config via process.env
// Circuit Breaker Integration Tests — State transitions, half-open, recovery
// Note: Uses fresh skill IDs per test to avoid state pollution
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Import circuit breaker
// ---------------------------------------------------------------------------

import {
  isCallPermitted,
  recordSuccess,
  recordFailure,
  getCircuitBreaker,
  getAllCircuitBreakers,
  resetCircuitBreaker,
  type CircuitBreakerState,
} from '../skills/circuit_breaker.js';

// ---------------------------------------------------------------------------
// Test configuration — use fresh IDs to avoid state pollution
// ---------------------------------------------------------------------------

function freshSkillId(): string {
  return `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

describe('CircuitBreaker — core behavior', () => {
  // Use fresh skill IDs for each test to avoid state pollution
  let skillId: string;

  beforeEach(() => {
    skillId = freshSkillId();
  });

  afterEach(() => {
    // Cleanup: reset the skill we used
    resetCircuitBreaker(skillId);
  });

  // ---------------------------------------------------------------------------
  // Initial state
  // ---------------------------------------------------------------------------

  describe('initial state', () => {
    it('allows calls when no circuit breaker exists', () => {
      const newSkill = freshSkillId();
      expect(isCallPermitted(newSkill)).toBe(true);
      resetCircuitBreaker(newSkill); // cleanup
    });

    it('getCircuitBreaker returns null for unknown skill', () => {
      const unknown = freshSkillId();
      expect(getCircuitBreaker(unknown)).toBeNull();
    });

    it('starts in closed state with zero failures when created via reset', () => {
      resetCircuitBreaker(skillId);
      const cb = getCircuitBreaker(skillId)!;
      expect(cb.state).toBe('closed');
      expect(cb.failureCount).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Closed → Open transition
  // ---------------------------------------------------------------------------

  describe('closed → open transition', () => {
    it('remains closed after 2 failures (below threshold of 3)', () => {
      recordFailure(skillId, 'error 1');
      recordFailure(skillId, 'error 2');

      const cb = getCircuitBreaker(skillId)!;
      expect(cb.state).toBe('closed');
      expect(cb.failureCount).toBe(2);
      expect(isCallPermitted(skillId)).toBe(true);
    });

    it('trips to open after 3 failures (threshold reached)', () => {
      recordFailure(skillId, 'error 1');
      recordFailure(skillId, 'error 2');
      recordFailure(skillId, 'error 3');

      const cb = getCircuitBreaker(skillId)!;
      expect(cb.state).toBe('open');
      expect(cb.failureCount).toBe(3);
      expect(cb.tripReason).toBe('error 3');
    });

    it('rejects calls when circuit is open (within 30s cooldown)', () => {
      recordFailure(skillId, 'error 1');
      recordFailure(skillId, 'error 2');
      recordFailure(skillId, 'error 3');

      expect(isCallPermitted(skillId)).toBe(false);
    });

    it('records failure reason when tripping', () => {
      recordFailure(skillId, 'connection timeout');
      recordFailure(skillId, 'database error');
      recordFailure(skillId, 'final error');

      const cb = getCircuitBreaker(skillId)!;
      expect(cb.tripReason).toBe('final error');
    });
  });

  // ---------------------------------------------------------------------------
  // Half-open state (after cooldown)
  // ---------------------------------------------------------------------------

  describe('half-open state (after cooldown)', () => {
    it('auto-transitions to half_open when 30s cooldown elapses', () => {
      // Trip the circuit
      recordFailure(skillId, 'error 1');
      recordFailure(skillId, 'error 2');
      recordFailure(skillId, 'error 3');

      // Advance time past cooldown (31 seconds)
      const cb = getCircuitBreaker(skillId)!;
      cb.lastFailure = Date.now() - 31_000;

      // isCallPermitted should trigger transition to half_open
      expect(isCallPermitted(skillId)).toBe(true);
      expect(cb.state).toBe('half_open');
      expect(cb.failureCount).toBe(0); // Reset on transition
    });

    it('allows test call in half_open state', () => {
      recordFailure(skillId, 'error');
      recordFailure(skillId, 'error');
      recordFailure(skillId, 'error');

      const cb = getCircuitBreaker(skillId)!;
      cb.lastFailure = Date.now() - 31_000;
      isCallPermitted(skillId); // transitions to half_open

      // Should allow the test call
      expect(isCallPermitted(skillId)).toBe(true);
      expect(cb.state).toBe('half_open');
    });
  });

  // ---------------------------------------------------------------------------
  // Half-open → Closed (success recovery)
  // ---------------------------------------------------------------------------

  describe('half-open → closed recovery on success', () => {
    it('transitions to closed on success in half_open', () => {
      // Trip the circuit
      recordFailure(skillId, 'err1');
      recordFailure(skillId, 'err2');
      recordFailure(skillId, 'err3');

      // Advance time and transition to half_open
      const cb = getCircuitBreaker(skillId)!;
      cb.lastFailure = Date.now() - 31_000;
      isCallPermitted(skillId); // now half_open

      // Record success — should close
      recordSuccess(skillId);

      expect(cb.state).toBe('closed');
      expect(cb.failureCount).toBe(0);
      expect(cb.tripReason).toBeNull();
    });

    it('updates lastSuccess timestamp on recovery', () => {
      resetCircuitBreaker(skillId);
      const before = Date.now();
      recordSuccess(skillId);
      const after = Date.now();

      const cb = getCircuitBreaker(skillId)!;
      expect(cb.lastSuccess).toBeGreaterThanOrEqual(before);
      expect(cb.lastSuccess).toBeLessThanOrEqual(after);
    });
  });

  // ---------------------------------------------------------------------------
  // Half-open → Open (failure in half-open)
  // ---------------------------------------------------------------------------

  describe('half-open → open on failure', () => {
    it('returns to open on failure in half_open state', () => {
      // Trip the circuit
      recordFailure(skillId, 'err1');
      recordFailure(skillId, 'err2');
      recordFailure(skillId, 'err3');

      // Advance time and transition to half_open
      const cb = getCircuitBreaker(skillId)!;
      cb.lastFailure = Date.now() - 31_000;
      isCallPermitted(skillId); // half_open

      // Failure during test — goes back to open
      recordFailure(skillId, 'test failure');

      expect(cb.state).toBe('open');
    });

    it('resets failureCount to 1 when returning to open from half_open', () => {
      recordFailure(skillId, 'err1');
      recordFailure(skillId, 'err2');
      recordFailure(skillId, 'err3');

      const cb = getCircuitBreaker(skillId)!;
      cb.lastFailure = Date.now() - 31_000;
      isCallPermitted(skillId); // half_open (resets failureCount to 0)

      recordFailure(skillId, 'test failure');

      // In half_open, failureCount is reset to 1 before incrementing
      expect(cb.failureCount).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // recordSuccess behavior
  // ---------------------------------------------------------------------------

  describe('recordSuccess', () => {
    it('resets failureCount when in closed state', () => {
      // First create the breaker and add some failures
      recordFailure(skillId, 'err');
      recordFailure(skillId, 'err');

      recordSuccess(skillId);

      const cb = getCircuitBreaker(skillId)!;
      expect(cb.failureCount).toBe(0);
      expect(cb.state).toBe('closed');
    });

    it('is idempotent for truly unknown skill (never created)', () => {
      const neverCreated = freshSkillId();
      expect(() => recordSuccess(neverCreated)).not.toThrow();
      // Note: We don't cleanup neverCreated since we never created it
    });
  });

  // ---------------------------------------------------------------------------
  // getAllCircuitBreakers
  // ---------------------------------------------------------------------------

  describe('getAllCircuitBreakers', () => {
    it('returns array of circuit breakers', () => {
      const all = getAllCircuitBreakers();
      expect(Array.isArray(all)).toBe(true);
    });

    it('includes the skill we reset', () => {
      resetCircuitBreaker(skillId);
      const all = getAllCircuitBreakers();
      const ids = all.map((cb) => cb.skillId);
      expect(ids).toContain(skillId);
    });
  });

  // ---------------------------------------------------------------------------
  // resetCircuitBreaker
  // ---------------------------------------------------------------------------

  describe('resetCircuitBreaker', () => {
    it('resets circuit to closed state', () => {
      // Add some failures first
      recordFailure(skillId, 'err1');
      recordFailure(skillId, 'err2');
      recordFailure(skillId, 'err3');

      resetCircuitBreaker(skillId);

      const cb = getCircuitBreaker(skillId)!;
      expect(cb.state).toBe('closed');
      expect(cb.failureCount).toBe(0);
    });

    it('clears lastFailure and tripReason', () => {
      recordFailure(skillId, 'err1');
      recordFailure(skillId, 'err2');
      recordFailure(skillId, 'err3');

      resetCircuitBreaker(skillId);

      const cb = getCircuitBreaker(skillId)!;
      expect(cb.lastFailure).toBeNull();
      expect(cb.tripReason).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // Per-skill independence
  // ---------------------------------------------------------------------------

  describe('per-skill independence', () => {
    it('each skill has independent circuit breaker', () => {
      const skillA = freshSkillId();
      const skillB = freshSkillId();

      // Trip skill A
      recordFailure(skillA, 'error');
      recordFailure(skillA, 'error');
      recordFailure(skillA, 'error');

      // Skill B should still allow calls
      expect(isCallPermitted(skillB)).toBe(true);

      // Cleanup
      resetCircuitBreaker(skillA);
      resetCircuitBreaker(skillB);
    });
  });

  // ---------------------------------------------------------------------------
  // Recovery timeout configuration
  // ---------------------------------------------------------------------------

  describe('recovery timeout configuration', () => {
    it('respects 60s cooldown when CIRCUIT_BREAKER_RECOVERY_MS=60000', () => {
      const original = process.env['CIRCUIT_BREAKER_RECOVERY_MS'];
      process.env['CIRCUIT_BREAKER_RECOVERY_MS'] = '60000';

      // Trip the circuit
      recordFailure(skillId, 'error');
      recordFailure(skillId, 'error');
      recordFailure(skillId, 'error');

      const cb = getCircuitBreaker(skillId)!;
      // 31 seconds should NOT be enough (threshold is 60)
      cb.lastFailure = Date.now() - 31_000;

      expect(isCallPermitted(skillId)).toBe(false); // Still open
      expect(cb.state).toBe('open');

      process.env['CIRCUIT_BREAKER_RECOVERY_MS'] = original ?? '30000';
    });

    it('allows call after 60s cooldown elapses', () => {
      const original = process.env['CIRCUIT_BREAKER_RECOVERY_MS'];
      process.env['CIRCUIT_BREAKER_RECOVERY_MS'] = '60000';

      recordFailure(skillId, 'error');
      recordFailure(skillId, 'error');
      recordFailure(skillId, 'error');

      const cb = getCircuitBreaker(skillId)!;
      cb.lastFailure = Date.now() - 61_000;

      expect(isCallPermitted(skillId)).toBe(true);
      expect(cb.state).toBe('half_open');

      process.env['CIRCUIT_BREAKER_RECOVERY_MS'] = original ?? '30000';
    });
  });

  // ---------------------------------------------------------------------------
  // Failure threshold configuration
  // ---------------------------------------------------------------------------

  describe('failure threshold configuration', () => {
    it('respects threshold of 5 when CIRCUIT_BREAKER_THRESHOLD=5', () => {
      const original = process.env['CIRCUIT_BREAKER_THRESHOLD'];
      process.env['CIRCUIT_BREAKER_THRESHOLD'] = '5';

      resetCircuitBreaker(skillId);

      // 4 failures should NOT trip (threshold is 5)
      for (let i = 0; i < 4; i++) {
        recordFailure(skillId, `error ${i}`);
      }

      expect(getCircuitBreaker(skillId)!.state).toBe('closed');

      // 5th failure trips
      recordFailure(skillId, 'error 5');
      expect(getCircuitBreaker(skillId)!.state).toBe('open');

      process.env['CIRCUIT_BREAKER_THRESHOLD'] = original ?? '3';
    });
  });
});

// ---------------------------------------------------------------------------
// Integration scenarios — complete lifecycle
// ---------------------------------------------------------------------------

describe('CircuitBreaker — complete lifecycle', () => {
  let skillId: string;

  beforeEach(() => {
    skillId = `test-lifecycle-${Date.now()}`;
  });

  afterEach(() => {
    resetCircuitBreaker(skillId);
  });

  it('closed → open → half_open → closed', () => {
    // 1. Start closed
    expect(isCallPermitted(skillId)).toBe(true);
    expect(getCircuitBreaker(skillId)!.state).toBe('closed');

    // 2. Record some failures
    recordFailure(skillId, 'failure 1');
    recordFailure(skillId, 'failure 2');
    expect(getCircuitBreaker(skillId)!.state).toBe('closed');

    // 3. Third failure trips to open
    recordFailure(skillId, 'failure 3');
    expect(getCircuitBreaker(skillId)!.state).toBe('open');
    expect(isCallPermitted(skillId)).toBe(false);

    // 4. Advance time past cooldown
    const cb = getCircuitBreaker(skillId)!;
    cb.lastFailure = Date.now() - 31_000;

    // 5. Next call transitions to half_open
    expect(isCallPermitted(skillId)).toBe(true);
    expect(getCircuitBreaker(skillId)!.state).toBe('half_open');

    // 6. Success closes the circuit
    recordSuccess(skillId);
    expect(getCircuitBreaker(skillId)!.state).toBe('closed');
    expect(getCircuitBreaker(skillId)!.failureCount).toBe(0);
  });

  it('partial recovery: closed → open → half_open → open (fails) → half_open → closed', () => {
    // Trip the circuit
    recordFailure(skillId, 'err1');
    recordFailure(skillId, 'err2');
    recordFailure(skillId, 'err3');

    // Advance time
    let cb = getCircuitBreaker(skillId)!;
    cb.lastFailure = Date.now() - 31_000;

    // Transition to half_open
    isCallPermitted(skillId);
    expect(cb.state).toBe('half_open');

    // Test call fails
    recordFailure(skillId, 'half-open test failed');
    expect(cb.state).toBe('open');
    expect(cb.failureCount).toBe(1);

    // Must wait for cooldown again
    expect(isCallPermitted(skillId)).toBe(false);

    // Advance time again
    cb.lastFailure = Date.now() - 31_000;

    // Another half-open test
    isCallPermitted(skillId);
    expect(cb.state).toBe('half_open');

    // This time succeeds
    recordSuccess(skillId);
    expect(cb.state).toBe('closed');
  });
});
