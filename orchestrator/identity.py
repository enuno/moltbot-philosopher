"""Stateless identity helpers for philosopher sub-agents.

Provides a simple ``load_identity()`` interface that wraps the
:class:`~orchestrator.philosophers.PersonaLoader` registry so sub-agents
can fetch their persona context without instantiating any class or
reading any state file.

Usage (sub-agent entrypoint)::

    from orchestrator.identity import load_identity

    persona = load_identity("beat")
    system_context = build_system_context(persona)
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

# Re-export the frozen dataclass so callers don't need two imports.
from orchestrator.philosophers import PersonaIdentity, PersonaLoader

__all__ = [
    "PersonaFiles",
    "get_persona_dir",
    "get_persona_files",
    "load_identity",
]


# ---------------------------------------------------------------------------
# Helper data structures
# ---------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class PersonaFiles:
    """Absolute paths to the persona's identity documents.

    Sub-agents use these paths to inject content into their own system
    prompts or to stream-read large files without caching them in memory.
    """

    root: Path
    soul: Path
    identity: Path
    agents: Path
    memory: Path

    @property
    def all_markdown(self) -> list[Path]:
        """Paths that exist and have non-zero size."""
        return [p for p in (self.soul, self.identity, self.agents, self.memory) if p.exists()]


# ---------------------------------------------------------------------------
# Module-level cache — lives for the lifetime of the Python process
# ---------------------------------------------------------------------------

_WORKSPACE_ROOT: Optional[Path] = None
_LOADER: Optional[PersonaLoader] = None


def _resolve_workspace() -> Path:
    """Return the workspace root, following the same convention as PersonaLoader."""
    if _WORKSPACE_ROOT is not None:
        return _WORKSPACE_ROOT
    # Default: <repo-root>/workspace
    repo_root = Path(__file__).resolve().parent.parent
    ws = os.environ.get("MOLTBOT_WORKSPACE_ROOT")
    return Path(ws) if ws else (repo_root / "workspace")


def _get_loader() -> PersonaLoader:
    global _LOADER
    if _LOADER is None:
        _LOADER = PersonaLoader(_resolve_workspace())
    return _LOADER


def _make_key(key: str) -> str:
    """Normalise a persona key to its registry lookup form."""
    return key.lower().replace(" ", "-").replace("_", "-")


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def load_identity(persona: str) -> PersonaIdentity:
    """Load the full identity for one persona by key.

    Args:
        persona: Directory name of the persona, e.g. ``"beat"``,
            ``"classical"``, ``"eastern"``.

    Returns:
        A :class:`PersonaIdentity` frozen dataclass with all four
        persona documents (``SOUL.md``, ``IDENTITY.md``, ``AGENTS.md``,
        ``MEMORY.md``) loaded as strings.

    Raises:
        ConfigurationError: The persona directory or ``SOUL.md`` does not
            exist inside the workspace root.

    Example::

        beat = load_identity("beat")
        print(beat.name)       # "Beat Generation"
        print(beat.emoji)      # "✊"
        print(beat.soul[:80])  # first 80 chars of SOUL.md

    """
    loader = _get_loader()
    identity = loader.load(get_persona_dir(persona))
    return identity


def get_persona_dir(persona: str) -> Path:
    """Return the absolute path to a persona's workspace directory.

    Args:
        persona: Directory name of the persona.

    Returns:
        Absolute :class:`Path` to the persona directory.

    Raises:
        ConfigurationError: No matching directory found.
    """
    loader = _get_loader()
    for directory in loader.list_persona_dirs():
        if directory.name.lower().replace("_", "-") == _make_key(persona):
            return directory
    from orchestrator.config import ConfigurationError
    raise ConfigurationError(f"No persona directory found for key: {persona}")


def get_persona_files(persona: str) -> PersonaFiles:
    """Return structured paths to a persona's identity documents.

    Args:
        persona: Directory name of the persona.

    Returns:
        A :class:`PersonaFiles` dataclass with :attr:`root`,
        :attr:`soul`, :attr:`identity`, :attr:`agents`, and
        :attr:`memory` paths — each absolute and pointing directly
        into the persona workspace directory.

    Example::

        files = get_persona_files("existentialist")
        if files.memory.exists():
            memory_text = files.memory.read_text(encoding="utf-8")

    """
    root = get_persona_dir(persona)
    return PersonaFiles(
        root=root,
        soul=root / "SOUL.md",
        identity=root / "IDENTITY.md",
        agents=root / "AGENTS.md",
        memory=root / "MEMORY.md",
    )


def set_workspace_root(path: str | Path) -> None:
    """Override the workspace root for all subsequent calls.

    Intended for testing or for single-process deployments that want to
    point at an alternate workspace directory.  Calling this resets the
    cached :class:`PersonaLoader` so the new root is used immediately.

    Args:
        path: Absolute path to the new workspace root directory.
    """
    global _LOADER, _WORKSPACE_ROOT
    _WORKSPACE_ROOT = Path(path).resolve()
    _LOADER = PersonaLoader(_WORKSPACE_ROOT)
