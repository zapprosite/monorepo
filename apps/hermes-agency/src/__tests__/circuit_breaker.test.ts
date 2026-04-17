import { describe, it, expect, beforeEach } from 'vitest';
import {
  isCallPermitted,
  recordSuccess,
  recordFailure,
  getCircuitBreaker,
  getAllCircuitBreakers,
  resetCircuitBreaker,
} from '../skills/circuit_breaker.ts';

const TEST_SKILL = 'agency-test-skill';

describe('CircuitBreaker', () => {
  beforeEach(() => {
    resetCircuitBreaker(TEST_SKILL);
    resetCircuitBreaker('agency-another');
  });

  describe('initial state', () => {
    it('should allow calls when no circuit breaker exists', () => {
      expect(isCallPermitted('nonexistent-skill')).toBe(true);
    });

    it('should return null for unknown skill', () => {
      expect(getCircuitBreaker('nonexistent')).toBeNull();
    });

    it('should return registered circuit breakers via getAllCircuitBreakers', () => {
      resetCircuitBreaker(TEST_SKILL);
      const all = getAllCircuitBreakers();
      const ids = all.map((cb) => cb.skillId);
      expect(ids).toContain(TEST_SKILL);
    });
  });

  describe('closed → open transition', () => {
    it('should remain CLOSED after 2 failures (below threshold)', () => {
      recordFailure(TEST_SKILL, 'error 1');
      recordFailure(TEST_SKILL, 'error 2');
      const cb = getCircuitBreaker(TEST_SKILL)!;
      expect(cb.state).toBe('closed');
      expect(cb.failureCount).toBe(2);
    });

    it('should trip to OPEN after 3 failures', () => {
      recordFailure(TEST_SKILL, 'error 1');
      recordFailure(TEST_SKILL, 'error 2');
      recordFailure(TEST_SKILL, 'error 3');
      const cb = getCircuitBreaker(TEST_SKILL)!;
      expect(cb.state).toBe('open');
      expect(cb.failureCount).toBe(3);
      expect(cb.tripReason).toBe('error 3');
    });

    it('should reject calls when OPEN and cooldown not elapsed', () => {
      recordFailure(TEST_SKILL, 'error 1');
      recordFailure(TEST_SKILL, 'error 2');
      recordFailure(TEST_SKILL, 'error 3');
      // Still within cooldown
      expect(isCallPermitted(TEST_SKILL)).toBe(false);
    });

    it('should allow call when OPEN and cooldown elapsed', () => {
      recordFailure(TEST_SKILL, 'error 1');
      recordFailure(TEST_SKILL, 'error 2');
      recordFailure(TEST_SKILL, 'error 3');

      // Override lastFailure to simulate time passing
      const cb = getCircuitBreaker(TEST_SKILL)!;
      cb.lastFailure = Date.now() - 31_000; // 31 seconds ago

      expect(isCallPermitted(TEST_SKILL)).toBe(true);
      expect(cb.state).toBe('half_open');
    });
  });

  describe('half_open behavior', () => {
    it('should transition to CLOSED on success in half_open', () => {
      // Trip the circuit
      recordFailure(TEST_SKILL, 'err1');
      recordFailure(TEST_SKILL, 'err2');
      recordFailure(TEST_SKILL, 'err3');

      // Advance time
      const cb = getCircuitBreaker(TEST_SKILL)!;
      cb.lastFailure = Date.now() - 31_000;

      // Allow test call
      isCallPermitted(TEST_SKILL); // transitions to half_open

      // Record success
      recordSuccess(TEST_SKILL);
      expect(cb.state).toBe('closed');
      expect(cb.failureCount).toBe(0);
    });

    it('should transition back to OPEN on failure in half_open', () => {
      // Trip the circuit
      recordFailure(TEST_SKILL, 'err1');
      recordFailure(TEST_SKILL, 'err2');
      recordFailure(TEST_SKILL, 'err3');

      // Advance time
      const cb = getCircuitBreaker(TEST_SKILL)!;
      cb.lastFailure = Date.now() - 31_000;

      // Allow test call — transitions to half_open
      isCallPermitted(TEST_SKILL);
      expect(cb.state).toBe('half_open');

      // Record failure during test — goes back to OPEN, failureCount resets to 1
      recordFailure(TEST_SKILL, 'test failure');
      expect(cb.state).toBe('open');
      // In half_open, failureCount is reset to 1 before incrementing
      expect(cb.failureCount).toBe(1);
    });
  });

  describe('recordSuccess', () => {
    it('should reset failureCount when in closed state', () => {
      recordFailure(TEST_SKILL, 'err');
      recordFailure(TEST_SKILL, 'err');
      recordSuccess(TEST_SKILL);
      const cb = getCircuitBreaker(TEST_SKILL)!;
      expect(cb.failureCount).toBe(0);
      expect(cb.state).toBe('closed');
    });

    it('should be idempotent for unknown skill', () => {
      expect(() => recordSuccess('unknown-skill')).not.toThrow();
    });
  });

  describe('getAllCircuitBreakers', () => {
    it('should return all registered circuit breakers', () => {
      resetCircuitBreaker(TEST_SKILL);
      // Create a circuit breaker for another skill by recording a failure
      recordFailure('agency-another', 'trigger creation');
      const all = getAllCircuitBreakers();
      const ids = all.map((cb) => cb.skillId);
      expect(ids).toContain(TEST_SKILL);
      expect(ids).toContain('agency-another');
    });
  });
});
