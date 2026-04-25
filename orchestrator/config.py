"""Configuration for the Moltbook orchestrator."""

from __future__ import annotations

import os
from dataclasses import dataclass


class ConfigurationError(ValueError):
    """Raised when configuration is invalid."""


@dataclass(frozen=True, slots=True)
class MoltbookConfig:
    """Immutable configuration for Moltbook API interactions.

    Attributes:
        api_key: Moltbook API key (must start with ``moltbook_``).
        base_url: API base URL (default: ``https://www.moltbook.com/api``).
        timeout: Request timeout in seconds (default: 30).
        retries: Number of retry attempts (default: 3).
        dry_run: If ``True``, no mutating requests are sent.
        user_agent: User-Agent header string.
    """

    api_key: str
    base_url: str = "https://www.moltbook.com/api"
    timeout: float = 30.0
    retries: int = 3
    dry_run: bool = False
    user_agent: str = "moltbot-hermes/3.0"

    def __post_init__(self) -> None:
        if not isinstance(self.api_key, str) or not self.api_key:
            raise ConfigurationError("api_key is required and must be a non-empty string")
        if not self.api_key.startswith("moltbook_"):
            raise ConfigurationError('api_key must start with "moltbook_"')
        if self.timeout <= 0:
            raise ConfigurationError("timeout must be a positive number")
        if self.retries < 0:
            raise ConfigurationError("retries must be a non-negative integer")

    @property
    def api_version_path(self) -> str:
        """Return the API version prefix used by endpoints."""
        return "/v1"

    @property
    def full_base_url(self) -> str:
        """Return ``base_url`` with the API version appended."""
        return f"{self.base_url.rstrip('/')}{self.api_version_path}"

    @classmethod
    def from_env(cls, **overrides: object) -> "MoltbookConfig":
        """Create a configuration from environment variables.

        Environment variables:
            - ``MOLTBOOK_API_KEY``
            - ``MOLTBOOK_BASE_URL``
            - ``MOLTBOOK_TIMEOUT``
            - ``MOLTBOOK_RETRIES``
            - ``MOLTBOOK_DRY_RUN``
        """
        api_key = os.environ.get("MOLTBOOK_API_KEY", "")
        base_url = os.environ.get("MOLTBOOK_BASE_URL", "https://www.moltbook.com/api")
        timeout = float(os.environ.get("MOLTBOOK_TIMEOUT", "30.0"))
        retries = int(os.environ.get("MOLTBOOK_RETRIES", "3"))
        dry_run = os.environ.get("MOLTBOOK_DRY_RUN", "false").lower() in ("1", "true", "yes")

        return cls(
            api_key=overrides.get("api_key", api_key),  # type: ignore[arg-type]
            base_url=overrides.get("base_url", base_url),  # type: ignore[arg-type]
            timeout=overrides.get("timeout", timeout),  # type: ignore[arg-type]
            retries=overrides.get("retries", retries),  # type: ignore[arg-type]
            dry_run=overrides.get("dry_run", dry_run),  # type: ignore[arg-type]
            user_agent=overrides.get("user_agent", "moltbot-hermes/3.0"),  # type: ignore[arg-type]
        )


@dataclass(frozen=True, slots=True)
class NoosphereConfig:
    """Immutable configuration for Noosphere service interactions.

    Attributes:
        api_key: Moltbook API key for Bearer token auth.
        base_url: Noosphere service base URL (default: ``http://localhost:3006``).
        timeout: Request timeout in seconds (default: 10).
        retries: Number of retry attempts (default: 3).
    """

    api_key: str
    base_url: str = "http://localhost:3006"
    timeout: float = 10.0
    retries: int = 3

    def __post_init__(self) -> None:
        if not isinstance(self.api_key, str) or not self.api_key:
            raise ConfigurationError("api_key is required and must be a non-empty string")
        if self.timeout <= 0:
            raise ConfigurationError("timeout must be a positive number")
        if self.retries < 0:
            raise ConfigurationError("retries must be a non-negative integer")

    @classmethod
    def from_env(cls, **overrides: object) -> "NoosphereConfig":
        """Create a configuration from environment variables.

        Environment variables:
            - ``MOLTBOOK_API_KEY``
            - ``NOOSPHERE_SERVICE_URL``
            - ``NOOSPHERE_TIMEOUT``
            - ``NOOSPHERE_RETRIES``
        """
        api_key = os.environ.get("MOLTBOOK_API_KEY", "")
        base_url = os.environ.get("NOOSPHERE_SERVICE_URL", "http://localhost:3006")
        timeout = float(os.environ.get("NOOSPHERE_TIMEOUT", "10.0"))
        retries = int(os.environ.get("NOOSPHERE_RETRIES", "3"))

        return cls(
            api_key=overrides.get("api_key", api_key),  # type: ignore[arg-type]
            base_url=overrides.get("base_url", base_url),  # type: ignore[arg-type]
            timeout=overrides.get("timeout", timeout),  # type: ignore[arg-type]
            retries=overrides.get("retries", retries),  # type: ignore[arg-type]
        )
