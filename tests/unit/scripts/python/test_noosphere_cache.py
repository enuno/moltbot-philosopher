"""Unit tests for scripts/noosphere_cache.py

Validates:
- Cache hit returns previously stored data without calling upstream
- Cache miss (not found) calls upstream and stores result
- Cache miss (expired) re-fetches from upstream
- TTL-based expiration with frozen time.time()
- Concurrent asyncio task safety via asyncio.Lock
- SHA256 key generation is deterministic and normalisation-safe
- get_stats() hit_rate calculation
- invalidate() removes single entries
- clear() wipes all entries and resets counters
- RuntimeError when no client is set on cache miss
- ConnectionError and TimeoutError propagate from _fetch
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path
from typing import Any, Optional
from unittest.mock import MagicMock, patch

import pytest

# ---------------------------------------------------------------------------
# Import module under test
# ---------------------------------------------------------------------------

REPO_ROOT = Path(__file__).parents[4]
sys.path.insert(0, str(REPO_ROOT / "scripts"))

from noosphere_cache import (  # noqa: E402
    NoosphereCacheClient,
    _generate_cache_key,
)


# ---------------------------------------------------------------------------
# Helpers / fixtures
# ---------------------------------------------------------------------------


def _make_client(
    memories: Optional[list[dict[str, Any]]] = None,
) -> MagicMock:
    """Return a mock NoosphereClient that returns *memories*."""
    client = MagicMock()
    client.query_memories.return_value = memories or [
        {"id": "1", "content": "test memory", "confidence": 0.9, "type": "insight"}
    ]
    return client


# ---------------------------------------------------------------------------
# _generate_cache_key
# ---------------------------------------------------------------------------


class TestGenerateCacheKey:
    """Deterministic SHA256 key generation."""

    def test_same_inputs_produce_same_key(self) -> None:
        k1 = _generate_cache_key("classical", "AI autonomy", ["insight"], 0.7)
        k2 = _generate_cache_key("classical", "AI autonomy", ["insight"], 0.7)
        assert k1 == k2

    def test_different_agent_produces_different_key(self) -> None:
        k1 = _generate_cache_key("classical", "AI autonomy", ["insight"], 0.7)
        k2 = _generate_cache_key("existentialist", "AI autonomy", ["insight"], 0.7)
        assert k1 != k2

    def test_key_is_64_char_lowercase_hex(self) -> None:
        key = _generate_cache_key("classical", "context", None, 0.5)
        assert len(key) == 64
        assert all(c in "0123456789abcdef" for c in key)

    def test_limit_difference_changes_key(self) -> None:
        k1 = _generate_cache_key("classical", "ctx", None, 0.5, limit=10)
        k2 = _generate_cache_key("classical", "ctx", None, 0.5, limit=100)
        assert k1 != k2

    def test_same_limit_same_key(self) -> None:
        k1 = _generate_cache_key("classical", "ctx", None, 0.5, limit=50)
        k2 = _generate_cache_key("classical", "ctx", None, 0.5, limit=50)
        assert k1 == k2

    def test_normalisation_lowercase(self) -> None:
        k1 = _generate_cache_key("Classical", "AI Autonomy", ["Insight"], 0.7)
        k2 = _generate_cache_key("classical", "ai autonomy", ["insight"], 0.7)
        assert k1 == k2

    def test_normalisation_sorted_types(self) -> None:
        k1 = _generate_cache_key("classical", "ctx", ["pattern", "insight"], 0.5)
        k2 = _generate_cache_key("classical", "ctx", ["insight", "pattern"], 0.5)
        assert k1 == k2

    def test_none_types_same_as_empty_list(self) -> None:
        k_none = _generate_cache_key("classical", "ctx", None, 0.5)
        k_empty = _generate_cache_key("classical", "ctx", [], 0.5)
        assert k_none == k_empty

    def test_confidence_difference_changes_key(self) -> None:
        k1 = _generate_cache_key("classical", "ctx", None, 0.5)
        k2 = _generate_cache_key("classical", "ctx", None, 0.8)
        assert k1 != k2

    def test_context_difference_changes_key(self) -> None:
        k1 = _generate_cache_key("classical", "AI ethics", None, 0.5)
        k2 = _generate_cache_key("classical", "governance", None, 0.5)
        assert k1 != k2


# ---------------------------------------------------------------------------
# Cache miss – not found
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestCacheMiss:
    """Cache miss when no entry exists yet."""

    async def test_miss_calls_upstream(self) -> None:
        client = _make_client()
        cache = NoosphereCacheClient(client=client, ttl=60)
        await cache.query_cached("classical", "AI")
        client.query_memories.assert_called_once()

    async def test_miss_increments_miss_counter(self) -> None:
        cache = NoosphereCacheClient(client=_make_client(), ttl=60)
        await cache.query_cached("classical", "AI")
        stats = cache.get_stats()
        assert stats["misses"] == 1
        assert stats["hits"] == 0

    async def test_miss_stores_entry_in_cache(self) -> None:
        cache = NoosphereCacheClient(client=_make_client(), ttl=60)
        await cache.query_cached("classical", "AI")
        assert cache.get_stats()["entry_count"] == 1

    async def test_miss_returns_upstream_data(self) -> None:
        expected = [{"id": "1", "content": "x", "confidence": 0.9, "type": "insight"}]
        cache = NoosphereCacheClient(client=_make_client(expected), ttl=60)
        result = await cache.query_cached("classical", "AI")
        assert result == expected

    async def test_no_client_raises_runtime_error(self) -> None:
        cache = NoosphereCacheClient(client=None, ttl=60)
        with pytest.raises(RuntimeError, match="No NoosphereClient"):
            await cache.query_cached("classical", "AI")


# ---------------------------------------------------------------------------
# Cache hit
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestCacheHit:
    """Cache hit when a live entry exists."""

    async def test_second_call_is_hit(self) -> None:
        client = _make_client()
        cache = NoosphereCacheClient(client=client, ttl=60)
        await cache.query_cached("classical", "AI")
        await cache.query_cached("classical", "AI")
        # Upstream should only be called once
        client.query_memories.assert_called_once()

    async def test_hit_increments_hit_counter(self) -> None:
        cache = NoosphereCacheClient(client=_make_client(), ttl=60)
        await cache.query_cached("classical", "AI")
        await cache.query_cached("classical", "AI")
        stats = cache.get_stats()
        assert stats["hits"] == 1
        assert stats["misses"] == 1

    async def test_hit_returns_same_data(self) -> None:
        expected = [{"id": "x", "content": "memory", "confidence": 0.8, "type": "pattern"}]
        cache = NoosphereCacheClient(client=_make_client(expected), ttl=60)
        r1 = await cache.query_cached("classical", "ctx")
        r2 = await cache.query_cached("classical", "ctx")
        assert r1 == r2 == expected

    async def test_different_contexts_are_independent(self) -> None:
        client = _make_client()
        cache = NoosphereCacheClient(client=client, ttl=60)
        await cache.query_cached("classical", "topic_a")
        await cache.query_cached("classical", "topic_b")
        # Both are misses (different keys)
        assert client.query_memories.call_count == 2
        # Subsequent calls for both are hits
        await cache.query_cached("classical", "topic_a")
        await cache.query_cached("classical", "topic_b")
        assert client.query_memories.call_count == 2


# ---------------------------------------------------------------------------
# TTL expiration
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestTTLExpiration:
    """TTL-based eviction tests with frozen time.time()."""

    async def test_expired_entry_refetches(self) -> None:
        client = _make_client()
        cache = NoosphereCacheClient(client=client, ttl=10)
        # Populate cache at t=1000
        with patch("noosphere_cache.time.time", return_value=1000.0):
            await cache.query_cached("classical", "AI")
        # Access after TTL has elapsed (t=1015 > 1000+10)
        with patch("noosphere_cache.time.time", return_value=1015.0):
            await cache.query_cached("classical", "AI")
        assert client.query_memories.call_count == 2
        assert cache.get_stats()["misses"] == 2

    async def test_non_expired_entry_is_hit(self) -> None:
        client = _make_client()
        cache = NoosphereCacheClient(client=client, ttl=100)
        with patch("noosphere_cache.time.time", return_value=1000.0):
            await cache.query_cached("classical", "AI")
        with patch("noosphere_cache.time.time", return_value=1050.0):
            await cache.query_cached("classical", "AI")
        assert client.query_memories.call_count == 1
        assert cache.get_stats()["hits"] == 1

    async def test_per_query_ttl_override_shorter(self) -> None:
        client = _make_client()
        cache = NoosphereCacheClient(client=client, ttl=3600)
        # Store with short per-query TTL of 5 s
        with patch("noosphere_cache.time.time", return_value=1000.0):
            await cache.query_cached("classical", "AI", ttl=5)
        # Access after 5 s TTL expires (but before default 3600 s would)
        with patch("noosphere_cache.time.time", return_value=1010.0):
            await cache.query_cached("classical", "AI")
        assert client.query_memories.call_count == 2

    async def test_per_query_ttl_override_longer(self) -> None:
        client = _make_client()
        cache = NoosphereCacheClient(client=client, ttl=5)
        # Store with long per-query TTL of 3600 s
        with patch("noosphere_cache.time.time", return_value=1000.0):
            await cache.query_cached("classical", "AI", ttl=3600)
        # Access after instance TTL (5 s) but within per-query TTL
        with patch("noosphere_cache.time.time", return_value=1010.0):
            await cache.query_cached("classical", "AI")
        assert client.query_memories.call_count == 1


# ---------------------------------------------------------------------------
# Concurrent access
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestConcurrentAccess:
    """asyncio.Lock prevents race conditions under concurrent tasks."""

    async def test_concurrent_miss_calls_upstream_once(self) -> None:
        """When many tasks query the same key concurrently, upstream is called
        exactly once; subsequent tasks are served from cache."""
        call_count = 0

        async def slow_fetch(
            agent_id: str,
            memory_types: Any,
            min_confidence: float,
            limit: int,
        ) -> list[dict[str, Any]]:
            nonlocal call_count
            call_count += 1
            await asyncio.sleep(0.01)
            return [{"id": "1", "content": "c", "confidence": 0.9, "type": "insight"}]

        cache = NoosphereCacheClient(client=_make_client(), ttl=60)
        # Replace internal _fetch with our slow async version
        cache._fetch = slow_fetch  # type: ignore[method-assign]

        tasks = [cache.query_cached("classical", "concurrent") for _ in range(5)]
        results = await asyncio.gather(*tasks)

        assert len(results) == 5
        # Lock serialises access; upstream called once, rest served from cache
        assert call_count == 1

    async def test_independent_keys_fetched_independently(self) -> None:
        client = _make_client()
        cache = NoosphereCacheClient(client=client, ttl=60)
        tasks = [cache.query_cached("classical", f"topic_{i}") for i in range(3)]
        await asyncio.gather(*tasks)
        assert client.query_memories.call_count == 3


# ---------------------------------------------------------------------------
# invalidate() and clear()
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestInvalidateAndClear:
    """Cache invalidation methods."""

    async def test_invalidate_known_key(self) -> None:
        cache = NoosphereCacheClient(client=_make_client(), ttl=60)
        await cache.query_cached("classical", "AI")
        key = _generate_cache_key("classical", "AI", None, 0.0)
        assert await cache.invalidate(key) is True
        assert cache.get_stats()["entry_count"] == 0

    async def test_invalidate_unknown_key_returns_false(self) -> None:
        cache = NoosphereCacheClient(client=_make_client(), ttl=60)
        assert await cache.invalidate("nonexistent_key") is False

    async def test_clear_removes_all_entries(self) -> None:
        client = _make_client()
        cache = NoosphereCacheClient(client=client, ttl=60)
        await cache.query_cached("classical", "ctx1")
        await cache.query_cached("classical", "ctx2")
        removed = await cache.clear()
        assert removed == 2
        assert cache.get_stats()["entry_count"] == 0

    async def test_clear_resets_counters(self) -> None:
        cache = NoosphereCacheClient(client=_make_client(), ttl=60)
        await cache.query_cached("classical", "AI")
        await cache.query_cached("classical", "AI")
        await cache.clear()
        stats = cache.get_stats()
        assert stats["hits"] == 0
        assert stats["misses"] == 0
        assert stats["hit_rate"] == 0.0

    async def test_clear_returns_correct_count(self) -> None:
        client = _make_client()
        cache = NoosphereCacheClient(client=client, ttl=60)
        for i in range(4):
            await cache.query_cached("classical", f"topic_{i}")
        assert await cache.clear() == 4


# ---------------------------------------------------------------------------
# get_stats()
# ---------------------------------------------------------------------------


class TestGetStats:
    """Statistics reporting."""

    def test_initial_stats(self) -> None:
        cache = NoosphereCacheClient(ttl=500)
        stats = cache.get_stats()
        assert stats["hits"] == 0
        assert stats["misses"] == 0
        assert stats["hit_rate"] == 0.0
        assert stats["entry_count"] == 0
        assert stats["ttl"] == 500

    @pytest.mark.asyncio
    async def test_hit_rate_calculation(self) -> None:
        cache = NoosphereCacheClient(client=_make_client(), ttl=60)
        await cache.query_cached("classical", "AI")  # miss
        await cache.query_cached("classical", "AI")  # hit
        await cache.query_cached("classical", "AI")  # hit
        stats = cache.get_stats()
        assert stats["hit_rate"] == pytest.approx(2 / 3)

    @pytest.mark.asyncio
    async def test_hit_rate_zero_with_only_misses(self) -> None:
        cache = NoosphereCacheClient(client=_make_client(), ttl=60)
        await cache.query_cached("classical", "A")
        await cache.query_cached("classical", "B")
        assert cache.get_stats()["hit_rate"] == 0.0

    @pytest.mark.asyncio
    async def test_hit_rate_one_with_only_hits(self) -> None:
        cache = NoosphereCacheClient(client=_make_client(), ttl=60)
        await cache.query_cached("classical", "AI")  # miss
        # Reset counters so subsequent requests look like hits-only
        cache._misses = 0
        cache._hits = 0
        await cache.query_cached("classical", "AI")  # hit (data already cached)
        await cache.query_cached("classical", "AI")  # hit
        assert cache.get_stats()["hit_rate"] == pytest.approx(1.0)


# ---------------------------------------------------------------------------
# Client normalisation (to_dict / vars fallback)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestClientNormalisation:
    """Upstream results are normalised to list[dict] regardless of type."""

    async def test_dataclass_with_to_dict_is_normalised(self) -> None:
        """Client returns objects with a to_dict() method."""

        class MemoryObj:
            def to_dict(self) -> dict[str, Any]:
                return {"id": "42", "content": "wisdom", "type": "insight"}

        client = MagicMock()
        client.query_memories.return_value = [MemoryObj()]
        cache = NoosphereCacheClient(client=client, ttl=60)
        result = await cache.query_cached("classical", "AI")
        assert result == [{"id": "42", "content": "wisdom", "type": "insight"}]

    async def test_arbitrary_object_uses_vars_fallback(self) -> None:
        """Client returns plain objects without to_dict(); vars() is used."""

        class SimpleMem:
            def __init__(self) -> None:
                self.id = "99"
                self.content = "lesson text"

        client = MagicMock()
        client.query_memories.return_value = [SimpleMem()]
        cache = NoosphereCacheClient(client=client, ttl=60)
        result = await cache.query_cached("classical", "AI")
        assert result[0]["id"] == "99"
        assert result[0]["content"] == "lesson text"

    async def test_client_without_keyword_args_uses_fallback(self) -> None:
        """Client raises TypeError on extra kwargs; fallback path is used."""

        class LegacyClient:
            def query_memories(self, agent_id: str, **kwargs: Any) -> list[dict[str, Any]]:
                if kwargs:
                    raise TypeError("unexpected keyword argument")
                return [{"id": "legacy", "content": "data", "type": "lesson"}]

        cache = NoosphereCacheClient(client=LegacyClient(), ttl=60)
        result = await cache.query_cached("classical", "AI")
        assert result == [{"id": "legacy", "content": "data", "type": "lesson"}]


# ---------------------------------------------------------------------------
# Error propagation
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestErrorPropagation:
    """Errors from the upstream client propagate correctly."""

    async def test_connection_error_propagates(self) -> None:
        client = MagicMock()
        client.query_memories.side_effect = ConnectionError("refused")
        cache = NoosphereCacheClient(client=client, ttl=60)
        with pytest.raises(ConnectionError):
            await cache.query_cached("classical", "AI")

    async def test_timeout_error_propagates(self) -> None:
        client = MagicMock()
        client.query_memories.side_effect = TimeoutError("timeout")
        cache = NoosphereCacheClient(client=client, ttl=60)
        with pytest.raises(TimeoutError):
            await cache.query_cached("classical", "AI")
