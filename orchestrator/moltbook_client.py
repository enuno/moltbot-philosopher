"""Lightweight Python client for the Moltbook API."""

from __future__ import annotations

import logging
import random
import time
from typing import Any, Dict, List, Optional

import httpx

from orchestrator.config import ConfigurationError, MoltbookConfig
from orchestrator.rate_limiter import RateLimiter

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------


class MoltbookError(Exception):
    """Base exception for Moltbook API errors."""

    def __init__(
        self,
        message: str,
        status_code: int = 0,
        code: Optional[str] = None,
        hint: Optional[str] = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.hint = hint


class AuthenticationError(MoltbookError):
    """Raised on 401 Unauthorized."""

    def __init__(self, message: str = "Authentication required", hint: Optional[str] = None) -> None:
        super().__init__(message, 401, "UNAUTHORIZED", hint or "Check your API key")


class ForbiddenError(MoltbookError):
    """Raised on 403 Forbidden."""

    def __init__(self, message: str = "Access denied", hint: Optional[str] = None) -> None:
        super().__init__(message, 403, "FORBIDDEN", hint)


class NotFoundError(MoltbookError):
    """Raised on 404 Not Found."""

    def __init__(self, message: str = "Resource not found", hint: Optional[str] = None) -> None:
        super().__init__(message, 404, "NOT_FOUND", hint)


class ValidationError(MoltbookError):
    """Raised on 400 Bad Request / validation failures."""

    def __init__(self, message: str = "Validation failed", code: Optional[str] = None, hint: Optional[str] = None) -> None:
        super().__init__(message, 400, code or "VALIDATION_ERROR", hint)


class RateLimitError(MoltbookError):
    """Raised on 429 Too Many Requests."""

    def __init__(
        self,
        message: str = "Rate limit exceeded",
        retry_after: float = 60.0,
        hint: Optional[str] = None,
    ) -> None:
        super().__init__(message, 429, "RATE_LIMITED", hint or f"Try again in {retry_after} seconds")
        self.retry_after = retry_after


class NetworkError(MoltbookError):
    """Raised on network-level failures (timeouts, connection errors, etc.)."""

    def __init__(self, message: str = "Network request failed", hint: Optional[str] = None) -> None:
        super().__init__(message, 0, "NETWORK_ERROR", hint or "Check your internet connection")


class TimeoutError(MoltbookError):
    """Raised when a request exceeds the configured timeout."""

    def __init__(self, message: str = "Request timed out", hint: Optional[str] = None) -> None:
        super().__init__(message, 0, "TIMEOUT", hint or "Request took too long")


# ---------------------------------------------------------------------------
# Client
# ---------------------------------------------------------------------------


class MoltbookClient:
    """Python client for the Moltbook API.

    Features:
      - Bearer token authentication
      - Exponential backoff with jitter for retries
      - Rate-limit tracking via ``X-RateLimit-*`` headers
      - 429-aware adaptive backoff
      - Configurable timeouts
      - Dry-run mode for safe testing
    """

    def __init__(self, config: Optional[MoltbookConfig] = None) -> None:
        if config is None:
            config = MoltbookConfig.from_env()
        if not isinstance(config, MoltbookConfig):
            raise ConfigurationError("config must be a MoltbookConfig instance")
        self._config = config
        self._limiter = RateLimiter()
        self._client = httpx.Client(
            base_url=config.full_base_url,
            timeout=httpx.Timeout(config.timeout),
            headers={
                "User-Agent": config.user_agent,
                "Accept": "application/json",
            },
        )

    # -- Public API ---------------------------------------------------------

    def create_post(
        self,
        submolt: str,
        title: str,
        content: str,
        author_persona: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Create a new post and return the post object."""
        payload: Dict[str, Any] = {"submolt": submolt, "title": title, "content": content}
        if author_persona is not None:
            payload["author_persona"] = author_persona
        result = self._request("POST", "/posts", json=payload)
        return result.get("post", result)

    def add_comment(
        self,
        post_id: str,
        content: str,
        parent_id: Optional[str] = None,
        author_persona: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Add a comment to a post and return the comment object."""
        payload: Dict[str, Any] = {"content": content}
        if parent_id is not None:
            payload["parent_id"] = parent_id
        if author_persona is not None:
            payload["author_persona"] = author_persona
        result = self._request("POST", f"/posts/{post_id}/comments", json=payload)
        return result.get("comment", result)

    def upvote_post(self, post_id: str) -> Dict[str, Any]:
        """Upvote a post and return the vote response."""
        return self._request("POST", f"/posts/{post_id}/upvote")

    def get_feed(self, submolt: Optional[str] = None, limit: int = 20) -> List[Dict[str, Any]]:
        """Fetch the global or submolt-specific feed."""
        params: Dict[str, Any] = {"limit": limit}
        if submolt is not None:
            params["submolt"] = submolt
        result = self._request("GET", "/feed", params=params)
        return result.get("data", result)

    def get_post(self, post_id: str) -> Dict[str, Any]:
        """Fetch a single post by ID."""
        result = self._request("GET", f"/posts/{post_id}")
        return result.get("post", result)

    def get_mentions(self) -> List[Dict[str, Any]]:
        """Fetch notifications/mentions for the authenticated agent."""
        result = self._request("GET", "/notifications/mentions")
        return result.get("mentions", result)

    def get_comments(self, post_id: str) -> List[Dict[str, Any]]:
        """Fetch comments for a post."""
        result = self._request("GET", f"/posts/{post_id}/comments")
        return result.get("comments", result)

    def health_check(self) -> Dict[str, Any]:
        """Perform a lightweight connectivity check.

        Returns a dict with ``status``, ``base_url``, and ``authenticated`` keys.
        """
        try:
            # Try a lightweight authenticated endpoint first
            self._request("GET", "/agents/me")
            return {"status": "healthy", "base_url": self._config.full_base_url, "authenticated": True}
        except MoltbookError as exc:
            # If we get a 401 the service is up but our key may be bad
            if exc.status_code == 401:
                return {"status": "degraded", "base_url": self._config.full_base_url, "authenticated": False, "error": str(exc)}
            raise
        except Exception as exc:
            return {"status": "unhealthy", "base_url": self._config.full_base_url, "authenticated": False, "error": str(exc)}

    # -- Internal helpers ---------------------------------------------------

    def _request(
        self,
        method: str,
        path: str,
        *,
        json: Optional[Dict[str, Any]] = None,
        params: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Execute an HTTP request with retries, rate-limit awareness, and dry-run support."""
        if self._config.dry_run and method in ("POST", "PATCH", "PUT", "DELETE"):
            logger.info("[DRY-RUN] %s %s — skipped", method, path)
            return {"dry_run": True, "method": method, "path": path, "payload": json}

        endpoint = f"{method} {path}"

        # Client-side rate-limit smoothing
        if not self._limiter.can_execute(endpoint):
            wait = self._limiter.get_wait_time(endpoint)
            logger.warning("Rate limiter blocking %s for %.2fs", endpoint, wait)
            if wait > 0:
                time.sleep(wait)

        last_error: Optional[Exception] = None
        max_attempts = self._config.retries + 1

        for attempt in range(max_attempts):
            try:
                response = self._client.request(
                    method=method,
                    url=path,
                    json=json,
                    params=params,
                    headers={"Authorization": f"Bearer {self._config.api_key}"},
                )
                self._limiter.record_response(endpoint, dict(response.headers))

                if response.status_code >= 200 and response.status_code < 300:
                    if response.status_code == 204 or not response.content:
                        return {}
                    return response.json()

                self._handle_error_response(response)

            except httpx.TimeoutException as exc:
                last_error = TimeoutError(str(exc))
            except httpx.NetworkError as exc:
                last_error = NetworkError(str(exc))
            except MoltbookError as exc:
                last_error = exc
                if not self._should_retry(exc, attempt):
                    raise
            except Exception as exc:
                last_error = MoltbookError(str(exc))

            if not self._should_retry(last_error, attempt):
                break

            delay = self._backoff_delay(attempt, last_error)
            logger.debug("Retrying %s in %.2fs (attempt %d/%d)", endpoint, delay, attempt + 1, max_attempts - 1)
            time.sleep(delay)

        raise last_error if last_error else MoltbookError("Request failed after all retries")

    def _handle_error_response(self, response: httpx.Response) -> None:
        """Parse an error response and raise the appropriate exception."""
        try:
            body = response.json()
        except Exception:
            body = {}

        message = body.get("error") or f"HTTP {response.status_code}: {response.reason_phrase}"
        code = body.get("code")
        hint = body.get("hint")
        retry_after: Optional[float] = None

        if response.status_code == 429:
            retry_after_raw = response.headers.get("retry-after") or body.get("retryAfter")
            if retry_after_raw is not None:
                try:
                    retry_after = float(retry_after_raw)
                except ValueError:
                    retry_after = 60.0
            raise RateLimitError(message, retry_after or 60.0, hint)
        if response.status_code == 401:
            raise AuthenticationError(message, hint)
        if response.status_code == 403:
            raise ForbiddenError(message, hint)
        if response.status_code == 404:
            raise NotFoundError(message, hint)
        if response.status_code == 400:
            raise ValidationError(message, code, hint)

        raise MoltbookError(message, response.status_code, code, hint)

    def _should_retry(self, error: Exception, attempt: int) -> bool:
        """Determine whether the request should be retried."""
        if attempt >= self._config.retries:
            return False
        if isinstance(error, RateLimitError):
            return True
        if isinstance(error, NetworkError) or isinstance(error, TimeoutError):
            return True
        if isinstance(error, MoltbookError) and error.status_code >= 500:
            return True
        return False

    def _backoff_delay(self, attempt: int, error: Optional[Exception] = None) -> float:
        """Compute the delay before the next retry attempt.

        Uses exponential backoff (1s, 2s, 4s) with jitter. For rate-limit
        errors the ``Retry-After`` header value is preferred.
        """
        if isinstance(error, RateLimitError):
            base = error.retry_after
        else:
            base = 2**attempt  # 1s, 2s, 4s for attempt 0, 1, 2

        # Add up to 25% jitter to avoid thundering herd
        jitter = base * 0.25 * random.random()
        return base + jitter

    def close(self) -> None:
        """Close the underlying HTTP client."""
        self._client.close()

    def __enter__(self) -> MoltbookClient:
        return self

    def __exit__(self, *args: object) -> None:
        self.close()
