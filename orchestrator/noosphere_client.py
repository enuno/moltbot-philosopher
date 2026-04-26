"""Noosphere service client for memory operations."""

from __future__ import annotations

import logging
import time
from typing import Any

import httpx

from orchestrator.config import NoosphereConfig

logger = logging.getLogger(__name__)


class NoosphereError(Exception):
    """Base exception for Noosphere client errors."""


class NoosphereNotFoundError(NoosphereError):
    """Raised when a memory or resource is not found (404)."""


class NoosphereServerError(NoosphereError):
    """Raised when the Noosphere service returns a 5xx error."""


class NoosphereConnectionError(NoosphereError):
    """Raised when a connection to the Noosphere service fails."""


class NoosphereClient:
    """Client for the Noosphere memory service (port 3006).

    Provides methods to store, retrieve, search, and delete memories via
    the Noosphere REST API. Authentication uses a Bearer token from
    ``MOLTBOOK_API_KEY``. Requests are retried with exponential backoff
    on connection failures.
    """

    def __init__(self, config: NoosphereConfig | None = None) -> None:
        self.config = config or NoosphereConfig.from_env()
        self._client = httpx.Client(
            base_url=self.config.base_url.rstrip("/"),
            timeout=self.config.timeout,
            limits=httpx.Limits(max_connections=100, max_keepalive_connections=20),
            headers={
                "Authorization": f"Bearer {self.config.api_key}",
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
        )

    def _request(
        self,
        method: str,
        path: str,
        *,
        params: dict[str, Any] | None = None,
        json: dict[str, Any] | None = None,
    ) -> Any:
        """Make an HTTP request with exponential backoff retries.

        Retries on connection errors and timeouts. Raises distinct
        exceptions for 404 and 5xx responses.
        """
        last_exception: Exception | None = None
        for attempt in range(self.config.retries + 1):
            try:
                response = self._client.request(
                    method,
                    path,
                    params=params,
                    json=json,
                )
                if response.status_code == 404:
                    raise NoosphereNotFoundError(
                        f"Resource not found: {method} {path}"
                    )
                if 500 <= response.status_code < 600:
                    raise NoosphereServerError(
                        f"Server error {response.status_code} on {method} {path}: {response.text}"
                    )
                response.raise_for_status()
                return response.json()
            except (
                httpx.ConnectError,
                httpx.TimeoutException,
                httpx.NetworkError,
            ) as exc:
                last_exception = exc
                if attempt < self.config.retries:
                    sleep_time = 2**attempt
                    logger.warning(
                        "Noosphere request failed (%s), retrying in %ss... "
                        "(attempt %d/%d)",
                        exc,
                        sleep_time,
                        attempt + 1,
                        self.config.retries,
                    )
                    time.sleep(sleep_time)
                else:
                    raise NoosphereConnectionError(
                        f"Failed to connect to Noosphere after {self.config.retries + 1} "
                        f"attempts: {exc}"
                    ) from exc
            except httpx.HTTPStatusError as exc:
                if exc.response.status_code == 404:
                    raise NoosphereNotFoundError(
                        f"Resource not found: {method} {path}"
                    ) from exc
                if 500 <= exc.response.status_code < 600:
                    raise NoosphereServerError(
                        f"Server error {exc.response.status_code} on {method} {path}: "
                        f"{exc.response.text}"
                    ) from exc
                raise NoosphereError(
                    f"HTTP error {exc.response.status_code} on {method} {path}: "
                    f"{exc.response.text}"
                ) from exc

    def health_check(self) -> dict[str, Any]:
        """Check Noosphere service health.

        Returns:
            Parsed JSON response from ``GET /health``.
        """
        return self._request("GET", "/health")

    def store_memory(
        self,
        agent_id: str,
        content: str,
        metadata: dict[str, Any] | None = None,
        embedding: list[float] | None = None,
    ) -> dict[str, Any]:
        """Store a memory in the Noosphere.

        Maps to ``POST /memories``. Default ``type`` is ``insight`` and
        default ``visibility`` is ``private``. Values in *metadata* are
        spread into the request body, allowing overrides.

        Args:
            agent_id: Identifier of the owning agent.
            content: Plain-text memory content.
            metadata: Optional dictionary of extra fields (e.g. ``type``,
                ``confidence``, ``tags``, ``source_trace_id``).
            embedding: Optional vector embedding for the memory.

        Returns:
            The created memory object returned by the API.
        """
        body: dict[str, Any] = {
            "agent_id": agent_id,
            "content": content,
            "type": "insight",
            "visibility": "private",
        }
        if metadata is not None:
            body.update(metadata)
        if embedding is not None:
            body["embedding"] = embedding
        return self._request("POST", "/memories", json=body)

    def search_memories(
        self,
        agent_id: str,
        query: str,
        limit: int = 10,
    ) -> list[dict[str, Any]]:
        """Search memories using a keyword/filter query.

        Maps to ``GET /memories`` filtered by *agent_id*.

        Args:
            agent_id: Agent whose memories to search.
            query: Search string (passed as a ``query`` param).
            limit: Maximum number of results.

        Returns:
            List of memory objects.
        """
        params: dict[str, Any] = {
            "agent_id": agent_id,
            "limit": limit,
        }
        if query:
            params["query"] = query
        result = self._request("GET", "/memories", params=params)
        return result.get("memories", [])

    def search_semantic(
        self,
        agent_id: str,
        query: str,
        limit: int = 10,
    ) -> list[dict[str, Any]]:
        """Search memories using semantic (vector) search.

        Maps to ``POST /memories/search``.

        Args:
            agent_id: Agent whose memories to search.
            query: Semantic query string.
            limit: Maximum number of results (maps to ``top_k``).

        Returns:
            List of result objects.
        """
        body = {
            "query": query,
            "agent_id": agent_id,
            "top_k": limit,
        }
        result = self._request("POST", "/memories/search", json=body)
        return result.get("results", [])

    def get_memory(self, memory_id: str) -> dict[str, Any]:
        """Retrieve a memory by ID.

        Maps to ``GET /memories/:id``.

        Args:
            memory_id: UUID or identifier of the memory.

        Returns:
            The memory object.
        """
        return self._request("GET", f"/memories/{memory_id}")

    def delete_memory(self, memory_id: str) -> dict[str, Any]:
        """Delete a memory by ID.

        Maps to ``DELETE /memories/:id``.

        Args:
            memory_id: UUID or identifier of the memory.

        Returns:
            API response (e.g. ``{"success": true, "id": ...}``).
        """
        return self._request("DELETE", f"/memories/{memory_id}")

    def consolidate(self, agent_id: str | None = None) -> dict[str, Any]:
        """Consolidate memories.

        .. note::
            The Noosphere v3 service does not expose consolidation as an
            endpoint yet. This method logs a warning and returns a
            not-implemented placeholder.

        Args:
            agent_id: Optional agent to limit consolidation to.

        Returns:
            ``{"status": "not_implemented"}``
        """
        logger.warning(
            "Consolidation is not yet implemented in Noosphere v3 (agent_id=%s)",
            agent_id,
        )
        return {"status": "not_implemented"}

    def close(self) -> None:
        """Close the underlying HTTP client."""
        self._client.close()

    def __enter__(self) -> NoosphereClient:
        return self

    def __exit__(self, *args: object) -> None:
        self.close()
