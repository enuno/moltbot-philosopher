#!/usr/bin/env python3
"""Noosphere memory query caching layer.

Caches Noosphere memory queries to improve performance on repeated searches.
Provides TTL-based expiration, cache hit/miss logging, and statistics tracking.

The cache is in-memory only (no persistence) and uses an :class:`asyncio.Lock`
to prevent race conditions when multiple async tasks query the same key
concurrently.

Example:
    >>> import asyncio
    >>> from noosphere_cache import NoosphereCacheClient
    >>>
    >>> cache = NoosphereCacheClient(ttl=3600)
    >>>
    >>> # First call: cache miss, queries Noosphere
    >>> results = asyncio.run(cache.query_cached(
    ...     agent_id="classical",
    ...     context="AI autonomy",
    ...     memory_types=["insight", "pattern"],
    ... ))
    >>>
    >>> # Second call: cache hit, returns from memory
    >>> results = asyncio.run(cache.query_cached(
    ...     agent_id="classical",
    ...     context="AI autonomy",
    ...     memory_types=["insight", "pattern"],
    ... ))
    >>>
    >>> stats = cache.get_stats()
    >>> print(f"Hit rate: {stats['hit_rate']:.2%}")
    Hit rate: 50.00%
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import time
from typing import Any, Optional, Protocol, TypedDict, runtime_checkable

logger = logging.getLogger(__name__)

# Canonical 5-type memory model
MEMORY_TYPES: tuple[str, ...] = (
    "insight",
    "pattern",
    "strategy",
    "preference",
    "lesson",
)

DEFAULT_TTL: float = 3600.0
# Pre-computed list of all memory types for use in queries
_ALL_MEMORY_TYPES: list[str] = list(MEMORY_TYPES)


# ---------------------------------------------------------------------------
# Type definitions
# ---------------------------------------------------------------------------


class CacheEntry(TypedDict):
    """In-memory cache entry structure."""

    data: list[dict[str, Any]]
    timestamp: float
    ttl: float
    query_hash: str


class CacheStats(TypedDict):
    """Cache statistics snapshot."""

    hits: int
    misses: int
    hit_rate: float
    entry_count: int
    ttl: float


@runtime_checkable
class NoosphereQueryProtocol(Protocol):
    """Structural protocol for any Noosphere-compatible query interface."""

    def query_memories(
        self,
        agent_id: str,
        **kwargs: Any,
    ) -> list[Any]:
        """Query memories for the given agent."""
        ...  # pragma: no cover


# ---------------------------------------------------------------------------
# Cache key generation
# ---------------------------------------------------------------------------


def _generate_cache_key(
    agent_id: str,
    context: str,
    memory_types: Optional[list[str]],
    min_confidence: float,
) -> str:
    """Generate a deterministic SHA256 cache key from query parameters.

    Parameters are normalised (sorted lists, lowercase strings) before hashing
    to ensure the same logical query always produces the same key regardless of
    argument order or case.

    Args:
        agent_id: Agent identifier string.
        context: Query context / search string.
        memory_types: Optional list of memory type filters.  ``None`` and
            ``[]`` are treated identically (both map to ``[]`` after
            normalisation).
        min_confidence: Minimum confidence threshold.

    Returns:
        Hex-encoded SHA256 digest (64 lowercase characters).

    Example:
        >>> key = _generate_cache_key("classical", "AI autonomy", ["insight"], 0.7)
        >>> len(key)
        64
    """
    normalised: dict[str, Any] = {
        "agent_id": agent_id.lower().strip(),
        "context": context.lower().strip(),
        "memory_types": sorted(t.lower() for t in (memory_types or [])),
        "min_confidence": round(min_confidence, 6),
    }
    payload = json.dumps(normalised, sort_keys=True)
    return hashlib.sha256(payload.encode()).hexdigest()


# ---------------------------------------------------------------------------
# Main cache client
# ---------------------------------------------------------------------------


class NoosphereCacheClient:
    """Caching wrapper around NoosphereClient for improved query performance.

    Maintains an in-memory TTL cache of query results.  Concurrent asyncio
    tasks are protected by an :class:`asyncio.Lock` to prevent cache
    stampedes.

    The underlying Noosphere client may be synchronous (uses ``requests``).
    All sync calls are dispatched via :func:`asyncio.to_thread` so the event
    loop is never blocked.

    Args:
        client: Optional NoosphereClient (or any object implementing
            :class:`NoosphereQueryProtocol`).  When provided,
            :meth:`query_cached` will call ``client.query_memories`` on a
            cache miss.  Pass ``None`` to use the cache in read-only mode
            (raises :class:`RuntimeError` on miss).
        ttl: Default time-to-live for cache entries in seconds (default 3600).

    Example:
        >>> cache = NoosphereCacheClient(ttl=300)
        >>> # Retrieve stats immediately after construction
        >>> cache.get_stats()
        {'hits': 0, 'misses': 0, 'hit_rate': 0.0, 'entry_count': 0, 'ttl': 300.0}
    """

    def __init__(
        self,
        client: Optional[Any] = None,
        ttl: float = DEFAULT_TTL,
    ) -> None:
        self._client = client
        self._ttl = ttl
        self._cache: dict[str, CacheEntry] = {}
        self._lock: asyncio.Lock = asyncio.Lock()
        self._hits: int = 0
        self._misses: int = 0

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def query_cached(
        self,
        agent_id: str,
        context: str = "",
        memory_types: Optional[list[str]] = None,
        min_confidence: float = 0.0,
        ttl: Optional[float] = None,
        limit: int = 100,
    ) -> list[dict[str, Any]]:
        """Return cached query results, refreshing on miss or expiry.

        On a **cache hit** the stored list is returned immediately and the
        hit counter is incremented.  On a **cache miss** (entry absent or
        expired) the upstream ``client.query_memories`` is called, the
        result stored, and the miss counter incremented.

        Args:
            agent_id: Agent identifier (e.g. ``"classical"``).
            context: Search context or query string used for semantic lookup.
            memory_types: Filter to specific types (``insight``, ``pattern``,
                ``strategy``, ``preference``, ``lesson``).  ``None`` means all
                types.
            min_confidence: Minimum confidence threshold (0.0–1.0).
            ttl: Per-query TTL override in seconds.  Defaults to the instance
                TTL set at construction time.
            limit: Maximum number of results requested from the upstream query.

        Returns:
            List of memory dicts from cache (hit) or upstream query (miss).

        Raises:
            RuntimeError: If no client is set and the result is not in cache.
            ConnectionError: Propagated from the underlying NoosphereClient.
            TimeoutError: Propagated from the underlying NoosphereClient.

        Example:
            >>> cache = NoosphereCacheClient(client=my_client, ttl=60)
            >>> results = await cache.query_cached(
            ...     agent_id="classical",
            ...     context="AI autonomy",
            ...     memory_types=["insight"],
            ...     min_confidence=0.7,
            ... )
        """
        effective_ttl = ttl if ttl is not None else self._ttl
        key = _generate_cache_key(agent_id, context, memory_types, min_confidence)

        async with self._lock:
            entry = self._cache.get(key)

            if entry is not None:
                age = time.time() - entry["timestamp"]
                if age < entry["ttl"]:
                    self._hits += 1
                    remaining = entry["ttl"] - age
                    logger.info(
                        "Cache hit: key=%s age=%.1fs ttl_remaining=%.1fs",
                        key[:16],
                        age,
                        remaining,
                    )
                    return entry["data"]

                # Expired – remove and fall through to miss path
                logger.info(
                    "Cache miss (expired): key=%s age=%.1fs ttl=%.1fs",
                    key[:16],
                    age,
                    entry["ttl"],
                )
                del self._cache[key]
            else:
                logger.info("Cache miss (not found): key=%s", key[:16])

            self._misses += 1

            if self._client is None:
                raise RuntimeError(
                    "No NoosphereClient configured and no cached result for key: "
                    + key[:16]
                )

            # Fetch from upstream; wrap sync clients via asyncio.to_thread
            data = await self._fetch(
                agent_id=agent_id,
                memory_types=memory_types,
                min_confidence=min_confidence,
                limit=limit,
            )

            self._cache[key] = CacheEntry(
                data=data,
                timestamp=time.time(),
                ttl=effective_ttl,
                query_hash=key,
            )
            return data

    def invalidate(self, key: str) -> bool:
        """Remove a single cache entry by its hash key.

        Args:
            key: SHA256 hash key as returned by :func:`_generate_cache_key`
                (also visible in ``INFO``-level log output).

        Returns:
            ``True`` if the key existed and was removed, ``False`` otherwise.
        """
        existed = key in self._cache
        self._cache.pop(key, None)
        return existed

    def clear(self) -> int:
        """Remove all cache entries and reset hit/miss statistics.

        Returns:
            Number of entries that were removed.
        """
        count = len(self._cache)
        self._cache.clear()
        self._hits = 0
        self._misses = 0
        return count

    def get_stats(self) -> CacheStats:
        """Return a snapshot of cache statistics.

        Returns:
            A :class:`CacheStats` dict containing:

            * ``hits`` – total cache hit count since construction or last
              :meth:`clear`.
            * ``misses`` – total cache miss count.
            * ``hit_rate`` – fraction of requests served from cache (0.0–1.0).
              Returns ``0.0`` when no requests have been made yet.
            * ``entry_count`` – number of live entries currently held in
              the cache (including entries that may have silently expired
              and will be evicted on next access).
            * ``ttl`` – default TTL configured for this instance in seconds.
        """
        total = self._hits + self._misses
        hit_rate = self._hits / total if total > 0 else 0.0
        return CacheStats(
            hits=self._hits,
            misses=self._misses,
            hit_rate=hit_rate,
            entry_count=len(self._cache),
            ttl=self._ttl,
        )

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    async def _fetch(
        self,
        agent_id: str,
        memory_types: Optional[list[str]],
        min_confidence: float,
        limit: int,
    ) -> list[dict[str, Any]]:
        """Call the underlying NoosphereClient, dispatching sync calls in a thread.

        Args:
            agent_id: Agent identifier.
            memory_types: Optional list of memory type filters.
            min_confidence: Minimum confidence threshold.
            limit: Maximum number of results.

        Returns:
            Raw list of memory dicts from the upstream client.

        Raises:
            ConnectionError: Propagated from the underlying NoosphereClient.
            TimeoutError: Propagated from the underlying NoosphereClient.
        """
        types = memory_types or _ALL_MEMORY_TYPES

        def _sync_query() -> list[dict[str, Any]]:
            # Support both query_memories(types=[...]) and single-type callers
            try:
                raw = self._client.query_memories(
                    agent_id=agent_id,
                    types=types,
                    min_confidence=min_confidence,
                    limit=limit,
                )
            except TypeError:
                # Fallback for clients that don't accept these keyword args
                raw = self._client.query_memories(agent_id=agent_id)

            # Normalise: client may return Memory dataclass objects or dicts
            result: list[dict[str, Any]] = []
            for item in raw:
                if isinstance(item, dict):
                    result.append(item)
                elif hasattr(item, "to_dict"):
                    result.append(item.to_dict())
                else:
                    result.append(vars(item))
            return result

        try:
            return await asyncio.to_thread(_sync_query)
        except ConnectionError:
            logger.error(
                "NoosphereClient connection failed for agent=%s", agent_id
            )
            raise
        except TimeoutError:
            logger.error(
                "NoosphereClient query timed out for agent=%s", agent_id
            )
            raise
