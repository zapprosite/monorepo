"""
Rate Limiter — Sliding window 500 RPM across all agents.
Part of SPEC-POLYMER-006 multi-agent architecture.
"""
import time
import threading
from collections import defaultdict, deque
from dataclasses import dataclass
from typing import Optional


@dataclass
class RateLimiter:
    """
    Sliding window rate limiter for MiniMax API (500 RPM shared).
    
    Usage:
        rl = RateLimiter()
        if rl.acquire("dev", tokens=100):
            # Make API call
        else:
            wait = rl.get_wait_time("dev")
            time.sleep(wait)
    """
    rpm_limit: int = 500
    window_seconds: int = 60
    
    # Per-agent budgets (fraction of total)
    agent_budgets: dict = None
    
    def __post_init__(self):
        self.agent_budgets = {
            "supervisor": 0.20,   # 100 RPM
            "dev": 0.40,           # 200 RPM
            "sre": 0.20,           # 100 RPM
            "docs": 0.10,          # 50 RPM
            "backup": 0.05,        # 25 RPM
            "security": 0.05,       # 25 RPM
        }
        # Sliding window: deque of (timestamp, tokens) per agent
        self._window: dict[str, deque] = defaultdict(lambda: deque(maxlen=self.rpm_limit))
        self._lock = threading.Lock()
        self._last_cleanup = time.time()
    
    def _cleanup_window(self, agent: str) -> None:
        """Remove entries older than window_seconds."""
        now = time.time()
        cutoff = now - self.window_seconds
        window = self._window[agent]
        
        # Remove old entries
        while window and window[0][0] < cutoff:
            window.popleft()
    
    def _get_agent_limit(self, agent: str) -> int:
        """Get RPM limit for specific agent."""
        budget = self.agent_budgets.get(agent, 0.10)
        return int(self.rpm_limit * budget)
    
    def acquire(self, agent: str, tokens: int = 1, timeout: float = 60.0) -> bool:
        """
        Try to acquire rate limit quota for agent.
        
        Args:
            agent: Agent name (e.g., "dev", "sre")
            tokens: Number of tokens/units to acquire (default 1)
            timeout: Max seconds to wait for quota (default 60)
        
        Returns:
            True if acquired, False if timed out
        """
        start = time.time()
        agent_limit = self._get_agent_limit(agent)
        
        while True:
            with self._lock:
                self._cleanup_window(agent)
                window = self._window[agent]
                
                # Calculate current usage
                current_usage = sum(t for _, t in window)
                
                if current_usage + tokens <= agent_limit:
                    # Sufficient quota
                    window.append((time.time(), tokens))
                    return True
                
                # Not enough quota — calculate wait time
                if window:
                    oldest = window[0][0]
                    wait_time = (oldest + self.window_seconds) - time.time()
                else:
                    wait_time = 0.1  # Small wait if window empty
                
                if time.time() - start >= timeout:
                    return False
                
                if wait_time > timeout:
                    return False
            
            # Wait before retrying
            sleep_time = min(wait_time, 0.5)  # Max 500ms between checks
            time.sleep(sleep_time)
    
    def get_wait_time(self, agent: str) -> float:
        """
        Get seconds to wait before agent can make another request.
        
        Returns:
            0.0 if no wait needed, else seconds to wait
        """
        with self._lock:
            self._cleanup_window(agent)
            window = self._window[agent]
            
            if not window:
                return 0.0
            
            agent_limit = self._get_agent_limit(agent)
            current_usage = sum(t for _, t in window)
            
            if current_usage < agent_limit:
                return 0.0
            
            # Calculate time until oldest entry expires
            oldest = window[0][0]
            return max(0.0, (oldest + self.window_seconds) - time.time())
    
    def get_stats(self, agent: str) -> dict:
        """Get current rate limit stats for agent."""
        with self._lock:
            self._cleanup_window(agent)
            window = self._window[agent]
            current_usage = sum(t for _, t in window)
            agent_limit = self._get_agent_limit(agent)
            
            return {
                "agent": agent,
                "limit": agent_limit,
                "used": current_usage,
                "available": max(0, agent_limit - current_usage),
                "window_seconds": self.window_seconds,
                "wait_time": self.get_wait_time(agent),
            }
    
    def get_all_stats(self) -> dict:
        """Get stats for all agents."""
        return {agent: self.get_stats(agent) for agent in self.agent_budgets.keys()}
    
    def reset(self, agent: str = None) -> None:
        """Reset window for agent, or all agents if agent is None."""
        with self._lock:
            if agent:
                self._window[agent].clear()
            else:
                self._window.clear()
    
    def global_usage(self) -> tuple[int, int]:
        """
        Get total RPM usage across all agents.
        
        Returns:
            (current_usage, total_limit)
        """
        with self._lock:
            total = 0
            for window in self._window.values():
                total += sum(t for _, t in window)
            return total, self.rpm_limit


# Singleton instance — shared across all agents
_rate_limiter: Optional[RateLimiter] = None
_rate_limiter_lock = threading.Lock()


def get_rate_limiter() -> RateLimiter:
    """Get singleton RateLimiter instance."""
    global _rate_limiter
    if _rate_limiter is None:
        with _rate_limiter_lock:
            if _rate_limiter is None:
                _rate_limiter = RateLimiter()
    return _rate_limiter


# Convenience functions
def acquire(agent: str, tokens: int = 1, timeout: float = 60.0) -> bool:
    """Acquire rate limit for agent."""
    return get_rate_limiter().acquire(agent, tokens, timeout)


def wait_time(agent: str) -> float:
    """Get wait time for agent."""
    return get_rate_limiter().get_wait_time(agent)


def stats(agent: str = None) -> dict:
    """Get stats for agent or all agents."""
    rl = get_rate_limiter()
    return rl.get_stats(agent) if agent else rl.get_all_stats()
