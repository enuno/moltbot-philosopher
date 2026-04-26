"""Tests for the Noosphere client."""

from __future__ import annotations

import json
from typing import Any
from unittest.mock import patch

import httpx
import pytest

from orchestrator.config import NoosphereConfig
from orchestrator.noosphere_client import (
    NoosphereClient,
    NoosphereConnectionError,
    NoosphereNotFoundError,
    NoosphereServerError,
)


@pytest.fixture
def client(httpx_mock: Any) -> NoosphereClient:
    """Return a NoosphereClient wired to a mock HTTP transport."""
    config = NoosphereConfig(
        api_key="moltbook_test_key",
        base_url="http://localhost:3006",
        timeout=10.0,
        retries=3,
    )
    return NoosphereClient(config=config)


class TestHealthCheck:
    def test_health_check_success(self, client: NoosphereClient, httpx_mock: Any) -> None:
        httpx_mock.add_response(
            url="http://localhost:3006/health",
            method="GET",
            json={"status": "healthy", "version": "3.3.0"},
        )
        result = client.health_check()
        assert result["status"] == "healthy"
        assert result["version"] == "3.3.0"


class TestStoreMemory:
    def test_store_memory_defaults(self, client: NoosphereClient, httpx_mock: Any) -> None:
        httpx_mock.add_response(
            url="http://localhost:3006/memories",
            method="POST",
            json={"id": "mem-123", "agent_id": "agent-1", "content": "hello"},
        )
        result = client.store_memory("agent-1", "hello")
        assert result["id"] == "mem-123"

        request = httpx_mock.get_request()
        body = json.loads(request.content)
        assert body["agent_id"] == "agent-1"
        assert body["content"] == "hello"
        assert body["type"] == "insight"
        assert body["visibility"] == "private"

    def test_store_memory_with_metadata(self, client: NoosphereClient, httpx_mock: Any) -> None:
        httpx_mock.add_response(
            url="http://localhost:3006/memories",
            method="POST",
            json={"id": "mem-124"},
        )
        metadata = {
            "type": "observation",
            "confidence": 0.95,
            "tags": ["test"],
            "source_trace_id": "trace-1",
        }
        client.store_memory("agent-1", "hello", metadata=metadata)

        request = httpx_mock.get_request()
        body = json.loads(request.content)
        assert body["type"] == "observation"
        assert body["confidence"] == 0.95
        assert body["tags"] == ["test"]
        assert body["source_trace_id"] == "trace-1"

    def test_store_memory_with_embedding(self, client: NoosphereClient, httpx_mock: Any) -> None:
        httpx_mock.add_response(
            url="http://localhost:3006/memories",
            method="POST",
            json={"id": "mem-125"},
        )
        embedding = [0.1, 0.2, 0.3]
        client.store_memory("agent-1", "hello", embedding=embedding)

        request = httpx_mock.get_request()
        body = json.loads(request.content)
        assert body["embedding"] == embedding


class TestSearchMemories:
    def test_search_memories(self, client: NoosphereClient, httpx_mock: Any) -> None:
        httpx_mock.add_response(
            url="http://localhost:3006/memories?agent_id=agent-1&limit=5&query=test",
            method="GET",
            json={"memories": [{"id": "m1"}], "total": 1, "page": 1, "limit": 5},
        )
        result = client.search_memories("agent-1", "test", limit=5)
        assert len(result) == 1
        assert result[0]["id"] == "m1"

    def test_search_memories_empty_query(self, client: NoosphereClient, httpx_mock: Any) -> None:
        httpx_mock.add_response(
            url="http://localhost:3006/memories?agent_id=agent-1&limit=10",
            method="GET",
            json={"memories": [], "total": 0, "page": 1, "limit": 10},
        )
        result = client.search_memories("agent-1", "")
        assert result == []


class TestSearchSemantic:
    def test_search_semantic(self, client: NoosphereClient, httpx_mock: Any) -> None:
        httpx_mock.add_response(
            url="http://localhost:3006/memories/search",
            method="POST",
            json={
                "results": [{"id": "m2", "score": 0.99}],
                "query": "semantic",
                "count": 1,
            },
        )
        result = client.search_semantic("agent-1", "semantic", limit=5)
        assert len(result) == 1
        assert result[0]["id"] == "m2"

        request = httpx_mock.get_request()
        body = json.loads(request.content)
        assert body["top_k"] == 5
        assert body["query"] == "semantic"
        assert body["agent_id"] == "agent-1"


class TestGetMemory:
    def test_get_memory_success(self, client: NoosphereClient, httpx_mock: Any) -> None:
        httpx_mock.add_response(
            url="http://localhost:3006/memories/mem-123",
            method="GET",
            json={"id": "mem-123", "content": "hello"},
        )
        result = client.get_memory("mem-123")
        assert result["id"] == "mem-123"
        assert result["content"] == "hello"

    def test_get_memory_not_found(self, client: NoosphereClient, httpx_mock: Any) -> None:
        httpx_mock.add_response(
            url="http://localhost:3006/memories/mem-999",
            method="GET",
            status_code=404,
        )
        with pytest.raises(NoosphereNotFoundError):
            client.get_memory("mem-999")


class TestDeleteMemory:
    def test_delete_memory(self, client: NoosphereClient, httpx_mock: Any) -> None:
        httpx_mock.add_response(
            url="http://localhost:3006/memories/mem-123",
            method="DELETE",
            json={"success": True, "id": "mem-123"},
        )
        result = client.delete_memory("mem-123")
        assert result["success"] is True
        assert result["id"] == "mem-123"


class TestConsolidate:
    def test_consolidate_not_implemented(self, client: NoosphereClient) -> None:
        with patch("orchestrator.noosphere_client.logger") as mock_logger:
            result = client.consolidate("agent-1")
            assert result == {"status": "not_implemented"}
            mock_logger.warning.assert_called_once()

    def test_consolidate_without_agent(self, client: NoosphereClient) -> None:
        with patch("orchestrator.noosphere_client.logger") as mock_logger:
            result = client.consolidate()
            assert result == {"status": "not_implemented"}
            mock_logger.warning.assert_called_once()


class TestRetriesAndErrors:
    def test_retry_on_connection_error(self, client: NoosphereClient, httpx_mock: Any) -> None:
        httpx_mock.add_exception(httpx.ConnectError("Connection refused"))
        httpx_mock.add_exception(httpx.ConnectError("Connection refused"))
        httpx_mock.add_response(
            url="http://localhost:3006/health",
            method="GET",
            json={"status": "healthy"},
        )
        with patch("time.sleep"):
            result = client.health_check()
        assert result["status"] == "healthy"
        assert len(httpx_mock.get_requests()) == 3

    def test_retry_exhausted_raises(self, client: NoosphereClient, httpx_mock: Any) -> None:
        for _ in range(4):
            httpx_mock.add_exception(httpx.ConnectError("Connection refused"))
        with patch("time.sleep"):
            with pytest.raises(NoosphereConnectionError):
                client.health_check()

    def test_server_error(self, client: NoosphereClient, httpx_mock: Any) -> None:
        httpx_mock.add_response(
            url="http://localhost:3006/health",
            method="GET",
            status_code=500,
            text="Internal Server Error",
        )
        with pytest.raises(NoosphereServerError):
            client.health_check()

    def test_timeout_retry(self, client: NoosphereClient, httpx_mock: Any) -> None:
        httpx_mock.add_exception(httpx.TimeoutException("Read timeout"))
        httpx_mock.add_response(
            url="http://localhost:3006/health",
            method="GET",
            json={"status": "healthy"},
        )
        with patch("time.sleep"):
            result = client.health_check()
        assert result["status"] == "healthy"
        assert len(httpx_mock.get_requests()) == 2


class TestContextManager:
    def test_context_manager(self, httpx_mock: Any) -> None:
        config = NoosphereConfig(api_key="key", base_url="http://localhost:3006")
        with NoosphereClient(config=config) as client:
            httpx_mock.add_response(
                url="http://localhost:3006/health",
                method="GET",
                json={"status": "healthy"},
            )
            result = client.health_check()
            assert result["status"] == "healthy"


class TestConfigFromEnv:
    def test_from_env_defaults(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("MOLTBOOK_API_KEY", "moltbook_test_key")
        client = NoosphereClient()
        assert client.config.api_key == "moltbook_test_key"
        assert client.config.base_url == "http://localhost:3006"
        assert client.config.timeout == 10.0
        assert client.config.retries == 3

    def test_noosphere_url_override(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("MOLTBOOK_API_KEY", "moltbook_test_key")
        monkeypatch.setenv("NOOSPHERE_SERVICE_URL", "http://noosphere:3006")
        client = NoosphereClient()
        assert client.config.base_url == "http://noosphere:3006"

    def test_authorization_header(self, client: NoosphereClient, httpx_mock: Any) -> None:
        httpx_mock.add_response(
            url="http://localhost:3006/health",
            method="GET",
            json={"status": "healthy"},
        )
        client.health_check()
        request = httpx_mock.get_request()
        assert request.headers["Authorization"] == "Bearer moltbook_test_key"
