"""
HCE v2.1 — Rate Limit Middleware
In-memory sliding window rate limiter for FastAPI.
"""
import os
import time
import logging
from typing import Dict, List

from fastapi import Request, HTTPException

logger = logging.getLogger(__name__)

RATE_LIMIT_REQUESTS = int(os.environ.get("RATE_LIMIT_REQUESTS", "10"))
RATE_LIMIT_WINDOW_SECONDS = int(os.environ.get("RATE_LIMIT_WINDOW_SECONDS", "60"))


class SlidingWindowLimiter:
    """
    In-memory sliding window rate limiter keyed by client identifier.
    Not distributed-safe; sufficient for single-instance HCE API.
    """

    def __init__(self, max_requests: int, window_seconds: int):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._store: Dict[str, List[float]] = {}
        self._lock = False  # simple optimistic lock flag (GIL protects dict ops)

    def _prune(self, timestamps: List[float]) -> List[float]:
        cutoff = time.time() - self.window_seconds
        return [t for t in timestamps if t > cutoff]

    def is_allowed(self, key: str) -> bool:
        now = time.time()
        timestamps = self._store.get(key, [])
        timestamps = self._prune(timestamps)

        if len(timestamps) >= self.max_requests:
            self._store[key] = timestamps
            logger.warning("Rate limit exceeded for key=%s", key)
            return False

        timestamps.append(now)
        self._store[key] = timestamps
        return True


_limiter = SlidingWindowLimiter(
    max_requests=RATE_LIMIT_REQUESTS,
    window_seconds=RATE_LIMIT_WINDOW_SECONDS,
)


async def rate_limit_dependency(request: Request):
    """FastAPI dependency to enforce sliding-window rate limits."""
    # Use X-Forwarded-For if behind a proxy, else client host
    client_ip = (
        request.headers.get("x-forwarded-for", "").split(",")[0].strip()
        or request.client.host
        if request.client
        else "unknown"
    )
    if not _limiter.is_allowed(client_ip):
        raise HTTPException(
            status_code=429,
            detail="Muitas requisições. Aguarde um momento.",
        )
