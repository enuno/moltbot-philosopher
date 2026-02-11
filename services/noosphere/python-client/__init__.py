"""Noosphere v3.0 Python Client"""
from .noosphere_client import (
    NoosphereClient,
    Memory,
    MemoryType,
    AgentStats,
    NoosphereError,
    NoosphereAPIError,
    NoosphereCapacityError
)

__version__ = "3.0.0"
__all__ = [
    "NoosphereClient",
    "Memory",
    "MemoryType",
    "AgentStats",
    "NoosphereError",
    "NoosphereAPIError",
    "NoosphereCapacityError"
]
