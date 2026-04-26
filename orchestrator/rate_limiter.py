"""Token-bucket rate limiter with endpoint-aware tracking."""

from __future__ import annotations

import math
import time
from dataclasses import dataclass, field
from typing import Dict


@dataclass
class _Bucket:
    """Token bucket state for a single endpoint."""

    capacity: float = 10.0
    tokens: float = 10.0
    last_updated: float = field(default_factory=time.monotonic)
    refill_rate: float = 1.0  # tokens per second

    def consume(self, tokens: float = 1.0) -> bool:
        """Try to consume *tokens* from the bucket.

        Returns ``True`` if the consumption succeeded.
        """
        now = time.monotonic()
        elapsed = now - self.last_updated
        self.tokens = min(self.capacity, self.tokens + elapsed * self.refill_rate)
        self.last_updated = now

        if self.tokens >= tokens:
            self.tokens -= tokens
            return True
        return False


@dataclass
class RateLimitState:
    """Parsed rate-limit headers from the Moltbook API."""

    limit: int
    remaining: int
    reset_at: float  # Unix timestamp (seconds)

    @property
    def is_exhausted(self) -> bool:
        """Return ``True`` if no requests remain."""
        return self.remaining <= 0

    @property
    def seconds_until_reset(self) -> float:
        """Return the number of seconds until the limit resets."""
        return max(0.0, self.reset_at - time.time())


class RateLimiter:
    """Token-bucket rate limiter with per-endpoint smoothing.

    Tracks server-reported limits (via ``X-RateLimit-*`` headers) and
    enforces a client-side token bucket to avoid hitting the hard limit.
    """

    def __init__(
        self,
        default_capacity: float = 10.0,
        default_refill_rate: float = 1.0,
        cost_per_request: float = 1.0,
    ) -> None:
        self._buckets: Dict[str, _Bucket] = {}
        self._server_state: Dict[str, RateLimitState] = {}
        self._default_capacity = default_capacity
        self._default_refill_rate = default_refill_rate
        self._cost = cost_per_request

    def can_execute(self, endpoint: str) -> bool:
        """Return ``True`` if the request to *endpoint* may proceed.

        Considers both the local token bucket and any server-reported
        rate-limit state.
        """
        # Server-reported hard limit takes precedence
        server_state = self._server_state.get(endpoint)
        if server_state is not None and server_state.is_exhausted:
            return False

        bucket = self._get_bucket(endpoint)
        return bucket.consume(self._cost)

    def record_response(self, endpoint: str, headers: Dict[str, str]) -> None:
        """Update rate-limit state from response *headers*.

        Expected headers:
            - ``X-RateLimit-Limit``
            - ``X-RateLimit-Remaining``
            - ``X-RateLimit-Reset`` (Unix timestamp in seconds)
        """
        limit_hdr = headers.get("X-RateLimit-Limit")
        remaining_hdr = headers.get("X-RateLimit-Remaining")
        reset_hdr = headers.get("X-RateLimit-Reset")

        if limit_hdr is None or remaining_hdr is None or reset_hdr is None:
            return

        try:
            limit = int(limit_hdr)
            remaining = int(remaining_hdr)
            reset_at = float(reset_hdr)
        except ValueError:
            return

        self._server_state[endpoint] = RateLimitState(
            limit=limit,
            remaining=remaining,
            reset_at=reset_at,
        )

        # Smooth the token bucket to align with the server's view
        bucket = self._get_bucket(endpoint)
        bucket.capacity = float(limit)
        bucket.tokens = min(bucket.tokens, float(remaining))

        # Adjust refill rate to spread requests across the window
        seconds_until_reset = max(1.0, reset_at - time.time())
        bucket.refill_rate = max(bucket.refill_rate, limit / seconds_until_reset)

    def get_wait_time(self, endpoint: str) -> float:
        """Return the estimated seconds to wait before *endpoint* is available.

        Returns ``0.0`` if the endpoint can be called immediately.
        """
        server_state = self._server_state.get(endpoint)
        if server_state is not None and server_state.is_exhausted:
            return server_state.seconds_until_reset

        bucket = self._get_bucket(endpoint)
        if bucket.tokens >= self._cost:
            return 0.0

        tokens_needed = self._cost - bucket.tokens
        return tokens_needed / bucket.refill_rate

    def _get_bucket(self, endpoint: str) -> _Bucket:
        """Return (creating if necessary) the token bucket for *endpoint*."""
        if endpoint not in self._buckets:
            self._buckets[endpoint] = _Bucket(
                capacity=self._default_capacity,
                tokens=self._default_capacity,
                refill_rate=self._default_refill_rate,
            )
        return self._buckets[endpoint]

    def reset_endpoint(self, endpoint: str) -> None:
        """Clear tracked state for *endpoint*."""
        self._buckets.pop(endpoint, None)
        self._server_state.pop(endpoint, None)
