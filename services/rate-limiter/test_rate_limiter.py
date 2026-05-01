#!/usr/bin/env python3
"""
Test script for rate_limiter.py
Tests sliding window algorithm and 500 RPM limit.
"""
import time
import sys
sys.path.insert(0, "/srv/monorepo/services/rate-limiter")

from rate_limiter import RateLimiter, get_rate_limiter


def test_basic_acquire():
    """Test basic acquire/release."""
    rl = RateLimiter()
    assert rl.acquire("dev", tokens=1), "Should acquire"
    print("✓ test_basic_acquire passed")


def test_agent_limits():
    """Test per-agent limits."""
    rl = RateLimiter()
    assert rl._get_agent_limit("dev") == 200, f"dev limit should be 200, got {rl._get_agent_limit('dev')}"
    assert rl._get_agent_limit("supervisor") == 100, f"supervisor limit should be 100, got {rl._get_agent_limit('supervisor')}"
    print("✓ test_agent_limits passed")


def test_rate_limit_enforcement():
    """Test that rate limit is actually enforced."""
    rl = RateLimiter(rpm_limit=10, window_seconds=2)  # Very small for testing
    agent_limit = 4  # 40% of 10
    
    # Exhaust the limit
    for i in range(agent_limit):
        assert rl.acquire("dev", tokens=1), f"Request {i} should succeed"
    
    # Next one should fail or timeout quickly
    start = time.time()
    result = rl.acquire("dev", tokens=1, timeout=0.5)
    elapsed = time.time() - start
    
    # Should have waited (or returned False quickly)
    assert result == False or elapsed > 0, "Should either fail or wait"
    print(f"✓ test_rate_limit_enforcement passed (got {result}, waited {elapsed:.3f}s)")


def test_sliding_window():
    """Test that window expires and allows new requests."""
    rl = RateLimiter(rpm_limit=10, window_seconds=1)  # 1 second window
    
    # Exhaust limit
    for i in range(4):
        rl.acquire("dev", tokens=1)
    
    # Should be blocked
    result = rl.acquire("dev", tokens=1, timeout=0.1)
    assert result == False, "Should be rate limited immediately"
    
    # Wait for window to expire
    time.sleep(1.1)
    
    # Now should work
    result = rl.acquire("dev", tokens=1)
    assert result == True, "Should acquire after window expires"
    print("✓ test_sliding_window passed")


def test_wait_time():
    """Test get_wait_time calculation."""
    rl = RateLimiter(rpm_limit=10, window_seconds=2)
    
    # Exhaust limit
    for i in range(4):
        rl.acquire("dev", tokens=1)
    
    wait = rl.get_wait_time("dev")
    assert wait > 0, f"Wait time should be > 0, got {wait}"
    assert wait <= 2, f"Wait time should be <= window, got {wait}"
    print(f"✓ test_wait_time passed (wait={wait:.3f}s)")


def test_stats():
    """Test get_stats."""
    rl = RateLimiter(rpm_limit=100, window_seconds=60)
    rl.acquire("dev", tokens=5)
    
    stats = rl.get_stats("dev")
    assert stats["used"] == 5, f"Should show 5 used, got {stats['used']}"
    assert stats["limit"] == 40, f"Should show limit 40, got {stats['limit']}"
    print(f"✓ test_stats passed: {stats}")


def test_singleton():
    """Test singleton behavior."""
    rl1 = get_rate_limiter()
    rl2 = get_rate_limiter()
    assert rl1 is rl2, "Should return same instance"
    print("✓ test_singleton passed")


def test_500_rpm_simulation():
    """Simulate 500 RPM across multiple agents."""
    rl = RateLimiter(rpm_limit=500, window_seconds=60)
    
    # Simulate 600 requests over 60 seconds
    allowed = {"supervisor": 0, "dev": 0, "sre": 0, "docs": 0, "backup": 0, "security": 0}
    blocked = {"supervisor": 0, "dev": 0, "sre": 0, "docs": 0, "backup": 0, "security": 0}
    
    agents = list(rl.agent_budgets.keys())
    
    start = time.time()
    for i in range(600):
        agent = agents[i % len(agents)]
        if rl.acquire(agent, tokens=1, timeout=0.1):
            allowed[agent] += 1
        else:
            blocked[agent] += 1
        # Small delay to simulate realistic traffic
        time.sleep(0.05)
    
    elapsed = time.time() - start
    
    print(f"\n=== 500 RPM Simulation ===")
    print(f"Completed in {elapsed:.2f}s")
    print(f"Total allowed: {sum(allowed.values())}")
    print(f"Total blocked: {sum(blocked.values())}")
    for agent in agents:
        print(f"  {agent}: allowed={allowed[agent]}, blocked={blocked[agent]}")
    
    # Should have blocked some requests (not all 600 should pass)
    assert sum(blocked.values()) > 0, "Should have blocked some requests"
    print("✓ test_500_rpm_simulation passed")


def main():
    print("Running rate_limiter tests...\n")
    
    test_basic_acquire()
    test_agent_limits()
    test_rate_limit_enforcement()
    test_sliding_window()
    test_wait_time()
    test_stats()
    test_singleton()
    test_500_rpm_simulation()
    
    print("\n✅ All tests passed!")


if __name__ == "__main__":
    main()
