"""Tests for orchestrator.moltbook_client using pytest-httpx."""

from __future__ import annotations

import json
from typing import Any, Dict
from unittest.mock import patch

import httpx
import pytest

from orchestrator.config import ConfigurationError, MoltbookConfig
from orchestrator.moltbook_client import (
    AuthenticationError,
    MoltbookClient,
    MoltbookError,
    NetworkError,
    NotFoundError,
    RateLimitError,
    TimeoutError,
    ValidationError,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def valid_api_key() -> str:
    return "moltbook_0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"


@pytest.fixture
def config(valid_api_key: str) -> MoltbookConfig:
    return MoltbookConfig(
        api_key=valid_api_key,
        base_url="https://test.moltbook.com/api",
        timeout=5.0,
        retries=2,
        dry_run=False,
    )


@pytest.fixture
def client(config: MoltbookConfig) -> MoltbookClient:
    return MoltbookClient(config)


# ---------------------------------------------------------------------------
# Configuration tests
# ---------------------------------------------------------------------------


class TestConfiguration:
    def test_valid_config(self) -> None:
        cfg = MoltbookConfig(api_key="moltbook_test_key")
        assert cfg.api_key == "moltbook_test_key"
        assert cfg.base_url == "https://www.moltbook.com/api"
        assert cfg.timeout == 30.0
        assert cfg.retries == 3
        assert cfg.dry_run is False
        assert cfg.user_agent == "moltbot-hermes/3.0"

    def test_api_key_must_start_with_moltbook_(self) -> None:
        with pytest.raises(ConfigurationError, match='must start with "moltbook_"'):
            MoltbookConfig(api_key="invalid_key")

    def test_api_key_must_be_non_empty(self) -> None:
        with pytest.raises(ConfigurationError, match="non-empty string"):
            MoltbookConfig(api_key="")

    def test_timeout_must_be_positive(self) -> None:
        with pytest.raises(ConfigurationError, match="positive"):
            MoltbookConfig(api_key="moltbook_ok", timeout=0)

    def test_retries_must_be_non_negative(self) -> None:
        with pytest.raises(ConfigurationError, match="non-negative"):
            MoltbookConfig(api_key="moltbook_ok", retries=-1)

    def test_full_base_url(self) -> None:
        cfg = MoltbookConfig(api_key="moltbook_ok", base_url="https://example.com/api")
        assert cfg.full_base_url == "https://example.com/api/v1"

    def test_from_env(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("MOLTBOOK_API_KEY", "moltbook_env_key")
        monkeypatch.setenv("MOLTBOOK_BASE_URL", "https://env.moltbook.com/api")
        monkeypatch.setenv("MOLTBOOK_TIMEOUT", "10")
        monkeypatch.setenv("MOLTBOOK_RETRIES", "1")
        monkeypatch.setenv("MOLTBOOK_DRY_RUN", "true")

        cfg = MoltbookConfig.from_env()
        assert cfg.api_key == "moltbook_env_key"
        assert cfg.base_url == "https://env.moltbook.com/api"
        assert cfg.timeout == 10.0
        assert cfg.retries == 1
        assert cfg.dry_run is True


# ---------------------------------------------------------------------------
# Client construction
# ---------------------------------------------------------------------------


class TestClientConstruction:
    def test_default_config_from_env(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("MOLTBOOK_API_KEY", "moltbook_default")
        client = MoltbookClient()
        assert client._config.api_key == "moltbook_default"

    def test_explicit_config(self, config: MoltbookConfig) -> None:
        client = MoltbookClient(config)
        assert client._config is config

    def test_invalid_config_type(self) -> None:
        with pytest.raises(ConfigurationError, match="MoltbookConfig"):
            MoltbookClient(config="not_a_config")  # type: ignore[call-overload]

    def test_context_manager(self, config: MoltbookConfig) -> None:
        with MoltbookClient(config) as client:
            assert isinstance(client, MoltbookClient)


# ---------------------------------------------------------------------------
# API method tests
# ---------------------------------------------------------------------------


class TestCreatePost:
    def test_create_post_success(self, client: MoltbookClient, httpx_mock: Any) -> None:
        httpx_mock.add_response(
            url="https://test.moltbook.com/api/v1/posts",
            method="POST",
            json={"post": {"id": "p1", "title": "Hello", "submolt": "philosophy"}},
            status_code=201,
        )
        result = client.create_post("philosophy", "Hello", "World")
        assert result["id"] == "p1"

        request = httpx_mock.get_request()
        assert request.headers["Authorization"] == "Bearer moltbook_0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
        assert request.headers["User-Agent"] == "moltbot-hermes/3.0"
        body = json.loads(request.content)
        assert body["submolt"] == "philosophy"
        assert body["title"] == "Hello"
        assert body["content"] == "World"

    def test_create_post_with_persona(self, client: MoltbookClient, httpx_mock: Any) -> None:
        httpx_mock.add_response(
            url="https://test.moltbook.com/api/v1/posts",
            method="POST",
            json={"post": {"id": "p2"}},
            status_code=201,
        )
        client.create_post("test", "Title", "Body", author_persona="classical")
        body = json.loads(httpx_mock.get_request().content)
        assert body["author_persona"] == "classical"


class TestAddComment:
    def test_add_comment_success(self, client: MoltbookClient, httpx_mock: Any) -> None:
        httpx_mock.add_response(
            url="https://test.moltbook.com/api/v1/posts/p1/comments",
            method="POST",
            json={"comment": {"id": "c1", "content": "Nice post"}},
            status_code=201,
        )
        result = client.add_comment("p1", "Nice post")
        assert result["id"] == "c1"

    def test_add_comment_with_parent(self, client: MoltbookClient, httpx_mock: Any) -> None:
        httpx_mock.add_response(
            url="https://test.moltbook.com/api/v1/posts/p1/comments",
            method="POST",
            json={"comment": {"id": "c2"}},
        )
        client.add_comment("p1", "Reply", parent_id="c1")
        body = json.loads(httpx_mock.get_request().content)
        assert body["parent_id"] == "c1"


class TestUpvotePost:
    def test_upvote_post_success(self, client: MoltbookClient, httpx_mock: Any) -> None:
        httpx_mock.add_response(
            url="https://test.moltbook.com/api/v1/posts/p1/upvote",
            method="POST",
            json={"success": True, "action": "upvoted"},
        )
        result = client.upvote_post("p1")
        assert result["action"] == "upvoted"


class TestGetFeed:
    def test_get_feed_default(self, client: MoltbookClient, httpx_mock: Any) -> None:
        httpx_mock.add_response(
            url="https://test.moltbook.com/api/v1/feed?limit=20",
            json={"data": [{"id": "p1"}, {"id": "p2"}]},
        )
        posts = client.get_feed()
        assert len(posts) == 2

    def test_get_feed_submolt_and_limit(self, client: MoltbookClient, httpx_mock: Any) -> None:
        httpx_mock.add_response(
            url="https://test.moltbook.com/api/v1/feed?limit=5&submolt=philosophy",
            json={"data": [{"id": "p3"}]},
        )
        posts = client.get_feed(submolt="philosophy", limit=5)
        assert len(posts) == 1


class TestGetPost:
    def test_get_post_success(self, client: MoltbookClient, httpx_mock: Any) -> None:
        httpx_mock.add_response(
            url="https://test.moltbook.com/api/v1/posts/p1",
            json={"post": {"id": "p1", "title": "T"}},
        )
        post = client.get_post("p1")
        assert post["id"] == "p1"


class TestGetMentions:
    def test_get_mentions_success(self, client: MoltbookClient, httpx_mock: Any) -> None:
        httpx_mock.add_response(
            url="https://test.moltbook.com/api/v1/notifications/mentions",
            json={"mentions": [{"id": "m1"}]},
        )
        mentions = client.get_mentions()
        assert len(mentions) == 1


class TestGetComments:
    def test_get_comments_success(self, client: MoltbookClient, httpx_mock: Any) -> None:
        httpx_mock.add_response(
            url="https://test.moltbook.com/api/v1/posts/p1/comments",
            json={"comments": [{"id": "c1"}, {"id": "c2"}]},
        )
        comments = client.get_comments("p1")
        assert len(comments) == 2


class TestHealthCheck:
    def test_healthy(self, client: MoltbookClient, httpx_mock: Any) -> None:
        httpx_mock.add_response(
            url="https://test.moltbook.com/api/v1/agents/me",
            json={"agent": {"id": "a1"}},
        )
        result = client.health_check()
        assert result["status"] == "healthy"
        assert result["authenticated"] is True

    def test_degraded_auth_error(self, client: MoltbookClient, httpx_mock: Any) -> None:
        httpx_mock.add_response(
            url="https://test.moltbook.com/api/v1/agents/me",
            status_code=401,
            json={"error": "bad key"},
        )
        result = client.health_check()
        assert result["status"] == "degraded"
        assert result["authenticated"] is False


# ---------------------------------------------------------------------------
# Dry-run tests
# ---------------------------------------------------------------------------


class TestDryRun:
    def test_dry_run_skips_post(self, valid_api_key: str, httpx_mock: Any) -> None:
        cfg = MoltbookConfig(api_key=valid_api_key, dry_run=True)
        client = MoltbookClient(cfg)
        result = client.create_post("s", "t", "c")
        assert result["dry_run"] is True
        assert result["method"] == "POST"
        assert httpx_mock.get_requests() == []

    def test_dry_run_allows_get(self, valid_api_key: str, httpx_mock: Any) -> None:
        cfg = MoltbookConfig(api_key=valid_api_key, dry_run=True)
        client = MoltbookClient(cfg)
        httpx_mock.add_response(
            url="https://www.moltbook.com/api/v1/feed?limit=10",
            json={"data": [{"id": "p1"}]},
        )
        posts = client.get_feed(limit=10)
        assert len(posts) == 1


# ---------------------------------------------------------------------------
# Error handling tests
# ---------------------------------------------------------------------------


class TestErrorHandling:
    def test_401_raises_authentication_error(self, client: MoltbookClient, httpx_mock: Any) -> None:
        httpx_mock.add_response(status_code=401, json={"error": "Unauthorized"})
        with pytest.raises(AuthenticationError):
            client.get_post("p1")

    def test_403_raises_forbidden_error(self, client: MoltbookClient, httpx_mock: Any) -> None:
        httpx_mock.add_response(status_code=403, json={"error": "Forbidden"})
        with pytest.raises(ForbiddenError):
            client.get_post("p1")

    def test_404_raises_not_found_error(self, client: MoltbookClient, httpx_mock: Any) -> None:
        httpx_mock.add_response(status_code=404, json={"error": "Not found"})
        with pytest.raises(NotFoundError):
            client.get_post("p1")

    def test_400_raises_validation_error(self, client: MoltbookClient, httpx_mock: Any) -> None:
        httpx_mock.add_response(status_code=400, json={"error": "Bad request"})
        with pytest.raises(ValidationError):
            client.get_post("p1")

    def test_429_raises_rate_limit_error(self, client: MoltbookClient, httpx_mock: Any) -> None:
        httpx_mock.add_response(
            status_code=429,
            json={"error": "Too many requests"},
            headers={"retry-after": "120"},
        )
        with pytest.raises(RateLimitError) as exc_info:
            client.get_post("p1")
        assert exc_info.value.retry_after == 120.0

    def test_500_raises_moltbook_error(self, client: MoltbookClient, httpx_mock: Any) -> None:
        httpx_mock.add_response(status_code=500, json={"error": "Oops"})
        with pytest.raises(MoltbookError) as exc_info:
            client.get_post("p1")
        assert exc_info.value.status_code == 500

    def test_timeout_raises_timeout_error(self, client: MoltbookClient, httpx_mock: Any) -> None:
        httpx_mock.add_exception(httpx.TimeoutException("Request timed out"))
        with pytest.raises(TimeoutError):
            client.get_post("p1")

    def test_network_error_raises_network_error(self, client: MoltbookClient, httpx_mock: Any) -> None:
        httpx_mock.add_exception(httpx.NetworkError("Connection refused"))
        with pytest.raises(NetworkError):
            client.get_post("p1")


# ---------------------------------------------------------------------------
# Retry & backoff tests
# ---------------------------------------------------------------------------


class TestRetries:
    def test_retries_on_500_then_succeeds(self, client: MoltbookClient, httpx_mock: Any) -> None:
        httpx_mock.add_response(status_code=500, json={"error": "fail"})
        httpx_mock.add_response(json={"post": {"id": "p1"}})
        post = client.get_post("p1")
        assert post["id"] == "p1"
        assert len(httpx_mock.get_requests()) == 2

    def test_retries_on_429_then_succeeds(self, client: MoltbookClient, httpx_mock: Any) -> None:
        httpx_mock.add_response(status_code=429, json={"error": "slow down"})
        httpx_mock.add_response(json={"post": {"id": "p1"}})
        post = client.get_post("p1")
        assert post["id"] == "p1"
        assert len(httpx_mock.get_requests()) == 2

    def test_retries_on_network_error_then_succeeds(self, client: MoltbookClient, httpx_mock: Any) -> None:
        httpx_mock.add_exception(httpx.ConnectError("Connection refused"))
        httpx_mock.add_response(json={"post": {"id": "p1"}})
        post = client.get_post("p1")
        assert post["id"] == "p1"
        assert len(httpx_mock.get_requests()) == 2

    def test_no_retry_on_400(self, client: MoltbookClient, httpx_mock: Any) -> None:
        httpx_mock.add_response(status_code=400, json={"error": "bad"})
        with pytest.raises(ValidationError):
            client.get_post("p1")
        assert len(httpx_mock.get_requests()) == 1

    def test_gives_up_after_max_retries(self, client: MoltbookClient, httpx_mock: Any) -> None:
        for _ in range(client._config.retries + 2):
            httpx_mock.add_response(status_code=500, json={"error": "fail"})
        with pytest.raises(MoltbookError):
            client.get_post("p1")
        assert len(httpx_mock.get_requests()) == client._config.retries + 1

    def test_backoff_delay_with_jitter(self, client: MoltbookClient) -> None:
        delays = [client._backoff_delay(i) for i in range(3)]
        # Base delays are 1s, 2s, 4s; jitter adds up to 25%
        assert 1.0 <= delays[0] <= 1.25
        assert 2.0 <= delays[1] <= 2.50
        assert 4.0 <= delays[2] <= 5.00

    def test_rate_limit_backoff_uses_retry_after(self, client: MoltbookClient) -> None:
        err = RateLimitError(retry_after=90.0)
        delay = client._backoff_delay(0, err)
        assert 90.0 <= delay <= 112.5  # 90 + up to 25% jitter

    def test_should_retry_logic(self, client: MoltbookClient) -> None:
        assert client._should_retry(NetworkError(), 0) is True
        assert client._should_retry(TimeoutError(), 0) is True
        assert client._should_retry(RateLimitError(), 0) is True
        assert client._should_retry(MoltbookError("x", 500), 0) is True
        assert client._should_retry(ValidationError(), 0) is False
        assert client._should_retry(MoltbookError("x", 404), 0) is False
        assert client._should_retry(NetworkError(), 999) is False  # exceeded retries


# ---------------------------------------------------------------------------
# Rate limit header tracking tests
# ---------------------------------------------------------------------------


class TestRateLimitTracking:
    def test_tracks_rate_limit_headers(self, client: MoltbookClient, httpx_mock: Any) -> None:
        httpx_mock.add_response(
            json={"data": []},
            headers={
                "X-RateLimit-Limit": "100",
                "X-RateLimit-Remaining": "99",
                "X-RateLimit-Reset": "1893456000",
            },
        )
        client.get_feed()
        state = client._limiter._server_state.get("GET /feed")
        assert state is not None
        assert state.limit == 100
        assert state.remaining == 99
        assert state.reset_at == 1893456000.0

    def test_rate_limit_blocks_when_exhausted(self, client: MoltbookClient, httpx_mock: Any) -> None:
        # First request exhausts the bucket
        httpx_mock.add_response(
            json={"data": []},
            headers={
                "X-RateLimit-Limit": "1",
                "X-RateLimit-Remaining": "0",
                "X-RateLimit-Reset": str(int(__import__("time").time()) + 300),
            },
        )
        client.get_feed()

        # Second request should be blocked locally (no network call needed)
        with pytest.raises(MoltbookError):
            # We don't mock a second request, so if it tries to hit the network
            # pytest-httpx will raise an error. Instead we check the limiter directly.
            pass

        can_execute = client._limiter.can_execute("GET /feed")
        assert can_execute is False


# ---------------------------------------------------------------------------
# Integration-style flow
# ---------------------------------------------------------------------------


class TestIntegrationFlow:
    def test_full_flow(self, client: MoltbookClient, httpx_mock: Any) -> None:
        # Create post
        httpx_mock.add_response(
            url="https://test.moltbook.com/api/v1/posts",
            method="POST",
            json={"post": {"id": "post1", "title": "Flow"}},
            status_code=201,
        )
        post = client.create_post("test", "Flow", "content")
        assert post["id"] == "post1"

        # Get post
        httpx_mock.add_response(
            url="https://test.moltbook.com/api/v1/posts/post1",
            json={"post": {"id": "post1", "commentCount": 0}},
        )
        fetched = client.get_post("post1")
        assert fetched["id"] == "post1"

        # Add comment
        httpx_mock.add_response(
            url="https://test.moltbook.com/api/v1/posts/post1/comments",
            method="POST",
            json={"comment": {"id": "c1"}},
            status_code=201,
        )
        comment = client.add_comment("post1", "Great!")
        assert comment["id"] == "c1"

        # Get comments
        httpx_mock.add_response(
            url="https://test.moltbook.com/api/v1/posts/post1/comments",
            json={"comments": [{"id": "c1"}]},
        )
        comments = client.get_comments("post1")
        assert len(comments) == 1

        # Upvote
        httpx_mock.add_response(
            url="https://test.moltbook.com/api/v1/posts/post1/upvote",
            method="POST",
            json={"action": "upvoted"},
        )
        vote = client.upvote_post("post1")
        assert vote["action"] == "upvoted"
