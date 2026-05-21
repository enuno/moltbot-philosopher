"""Philosopher persona registry and council orchestration.

Loads persona identity files from workspace directories, provides a registry
for discovery, and orchestrates multi-persona council deliberation sessions.
"""

from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Protocol

from orchestrator.config import ConfigurationError
from orchestrator.models import PhilosopherResponse
from orchestrator.noosphere_client import NoosphereClient

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Protocols
# ---------------------------------------------------------------------------


class GenerationBackend(Protocol):
    """Abstract backend for generating text from a prompt + persona context."""

    def generate(
        self,
        prompt: str,
        system_context: str,
        model: str | None = None,
        max_tokens: int = 2048,
    ) -> PhilosopherResponse:
        ...


# ---------------------------------------------------------------------------
# Data models
# ---------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class PersonaIdentity:
    """Parsed identity files for a single philosopher persona."""

    name: str
    tradition: str
    role: str
    emoji: str = ""
    soul: str = ""
    identity: str = ""
    agents: str = ""
    memory: str = ""


@dataclass
class CouncilDeliberation:
    """A single council deliberation session."""

    topic: str
    axis: str  # e.g. "phenomenological_depth"
    preamble: str = ""
    synthesis_history: List[str] = field(default_factory=list)
    responses: Dict[str, PhilosopherResponse] = field(default_factory=dict)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_json(self) -> str:
        return json.dumps(
            {
                "topic": self.topic,
                "axis": self.axis,
                "preamble": self.preamble,
                "synthesis_history": self.synthesis_history,
                "responses": {
                    k: {"text": v.text, "latency_ms": v.latency_ms, "metadata": v.metadata}
                    for k, v in self.responses.items()
                },
                "metadata": self.metadata,
            },
            indent=2,
            default=str,
        )


# ---------------------------------------------------------------------------
# Persona loading
# ---------------------------------------------------------------------------


class PersonaLoader:
    """Loads philosopher persona identity files from workspace directories."""

    _IDENTITY_FILES = ("SOUL.md", "IDENTITY.md", "AGENTS.md", "MEMORY.md")

    def __init__(self, workspace_root: Path | str | None = None) -> None:
        if workspace_root is None:
            workspace_root = Path(__file__).resolve().parent.parent / "workspace"
        self._root = Path(workspace_root)

    def list_persona_dirs(self) -> List[Path]:
        """Return all workspace subdirectories that contain SOUL.md."""
        if not self._root.exists():
            return []
        return sorted(
            [d for d in self._root.iterdir() if d.is_dir() and (d / "SOUL.md").exists()],
            key=lambda p: p.name,
        )

    def load(self, persona_dir: Path | str) -> PersonaIdentity:
        """Load identity files from a single persona workspace directory."""
        directory = Path(persona_dir)
        if not directory.exists():
            raise ConfigurationError(f"Persona directory not found: {directory}")

        files: Dict[str, str] = {}
        for fname in self._IDENTITY_FILES:
            fpath = directory / fname
            files[fname] = fpath.read_text(encoding="utf-8") if fpath.exists() else ""

        # Extract structured fields from IDENTITY.md
        identity_text = files.get("IDENTITY.md", "")
        name = self._extract_field(identity_text, "Name") or directory.name
        tradition = self._extract_field(identity_text, "Tradition") or ""
        role = self._extract_field(identity_text, "Role") or ""
        emoji = self._extract_field(identity_text, "Emoji") or ""

        return PersonaIdentity(
            name=name,
            tradition=tradition,
            role=role,
            emoji=emoji,
            soul=files.get("SOUL.md", ""),
            identity=identity_text,
            agents=files.get("AGENTS.md", ""),
            memory=files.get("MEMORY.md", ""),
        )

    @staticmethod
    def _extract_field(text: str, field: str) -> str | None:
        """Extract a simple ``- **Field**: value`` line from markdown."""
        for line in text.splitlines():
            stripped = line.strip()
            prefix = f"- **{field}**:"
            if stripped.startswith(prefix):
                return stripped[len(prefix) :].strip()
        return None


# ---------------------------------------------------------------------------
# Registry
# ---------------------------------------------------------------------------


class PhilosopherRegistry:
    """Discovers and indexes all philosopher personas."""

    def __init__(self, loader: PersonaLoader | None = None) -> None:
        self._loader = loader or PersonaLoader()
        self._personas: Dict[str, PersonaIdentity] = {}
        self.reload()

    def reload(self) -> None:
        """Re-scan workspace directories."""
        self._personas = {}
        for directory in self._loader.list_persona_dirs():
            try:
                persona = self._loader.load(directory)
                key = directory.name.lower().replace(" ", "-").replace("_", "-")
                self._personas[key] = persona
                logger.debug("Loaded persona %s from %s", key, directory)
            except Exception as exc:
                logger.warning("Failed to load persona from %s: %s", directory, exc)

    @property
    def personas(self) -> Dict[str, PersonaIdentity]:
        return dict(self._personas)

    def get(self, key: str) -> PersonaIdentity | None:
        """Retrieve a persona by its workspace directory name."""
        return self._personas.get(key.lower().replace(" ", "-").replace("_", "-"))

    def list_names(self) -> List[str]:
        return sorted(self._personas.keys())

    def build_system_context(self, key: str) -> str:
        """Assemble the full system prompt for a persona."""
        persona = self.get(key)
        if persona is None:
            raise ConfigurationError(f"Unknown persona: {key}")
        parts = [
            f"# {persona.name}",
            f"Tradition: {persona.tradition}",
            f"Role: {persona.role}",
            "",
            "## SOUL",
            persona.soul,
            "",
            "## IDENTITY",
            persona.identity,
            "",
            "## AGENTS",
            persona.agents,
        ]
        if persona.memory:
            parts += ["", "## MEMORY", persona.memory]
        return "\n".join(parts)


# ---------------------------------------------------------------------------
# Generation backend
# ---------------------------------------------------------------------------


class HttpGenerationBackend:
    """Simple HTTP-based generation backend.

    Posts to a remote LLM endpoint (e.g. OpenRouter, local vLLM, Kimi API)
    with the assembled persona context as the system prompt.
    """

    def __init__(
        self,
        api_url: str | None = None,
        api_key: str | None = None,
        model: str = "kimi-k2.5-instant",
        timeout: float = 60.0,
    ) -> None:
        self.api_url = api_url or os.environ.get("LLM_API_URL", "")
        self.api_key = api_key or os.environ.get("LLM_API_KEY", "")
        self.model = model
        self.timeout = timeout

        if not self.api_url:
            raise ConfigurationError(
                "HttpGenerationBackend requires api_url or LLM_API_URL env var"
            )

    def generate(
        self,
        prompt: str,
        system_context: str,
        model: str | None = None,
        max_tokens: int = 2048,
    ) -> PhilosopherResponse:
        import time

        import httpx

        payload = {
            "model": model or self.model,
            "messages": [
                {"role": "system", "content": system_context},
                {"role": "user", "content": prompt},
            ],
            "max_tokens": max_tokens,
        }

        start = time.perf_counter()
        try:
            response = httpx.post(
                self.api_url,
                json=payload,
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                timeout=self.timeout,
            )
            response.raise_for_status()
            data = response.json()
            latency_ms = (time.perf_counter() - start) * 1000

            # OpenAI-compatible response parsing
            choices = data.get("choices", [])
            text = choices[0]["message"]["content"] if choices else ""
            return PhilosopherResponse(
                text=text,
                metadata={
                    "model": model or self.model,
                    "usage": data.get("usage", {}),
                    "finish_reason": choices[0].get("finish_reason") if choices else None,
                },
                latency_ms=latency_ms,
            )
        except Exception as exc:
            latency_ms = (time.perf_counter() - start) * 1000
            logger.error("Generation failed: %s", exc)
            return PhilosopherResponse(
                text=f"[Generation error: {exc}]",
                metadata={"error": str(exc)},
                latency_ms=latency_ms,
            )


# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------


class PhilosopherOrchestrator:
    """High-level coordinator for philosopher personas and council sessions."""

    def __init__(
        self,
        registry: PhilosopherRegistry | None = None,
        backend: GenerationBackend | None = None,
        noosphere: NoosphereClient | None = None,
    ) -> None:
        self.registry = registry or PhilosopherRegistry()
        self.backend = backend
        self.noosphere = noosphere

    def query_persona(
        self,
        persona_key: str,
        prompt: str,
        model: str | None = None,
        max_tokens: int = 2048,
        include_memory: bool = True,
    ) -> PhilosopherResponse:
        """Send a prompt to a single philosopher persona."""
        system_context = self.registry.build_system_context(persona_key)

        if include_memory and self.noosphere is not None:
            try:
                memories = self.noosphere.search_semantic(
                    agent_id=persona_key,
                    query=prompt,
                    limit=5,
                )
                if memories:
                    memory_block = "\n\n## RELEVANT MEMORIES\n" + "\n".join(
                        f"- {m.get('content', m)}" for m in memories
                    )
                    system_context += memory_block
            except Exception as exc:
                logger.warning("Noosphere memory retrieval failed: %s", exc)

        if self.backend is None:
            return PhilosopherResponse(
                text="[No generation backend configured]",
                metadata={"error": "missing_backend"},
                latency_ms=0.0,
            )

        return self.backend.generate(
            prompt=prompt,
            system_context=system_context,
            model=model,
            max_tokens=max_tokens,
        )

    def convene_council(
        self,
        topic: str,
        axis: str,
        persona_keys: List[str] | None = None,
        preamble: str = "",
        synthesis_history: List[str] | None = None,
    ) -> CouncilDeliberation:
        """Convene a council session with the requested personas.

        Args:
            topic: The question or proposal under deliberation.
            axis: The philosophical focus axis (e.g. ``phenomenological_depth``).
            persona_keys: Subset of personas to invite. Defaults to all loaded.
            preamble: Extra context to prepend to each prompt.
            synthesis_history: Previously synthesized patterns to avoid repetition.
        """
        if persona_keys is None:
            persona_keys = self.registry.list_names()

        deliberation = CouncilDeliberation(
            topic=topic,
            axis=axis,
            preamble=preamble,
            synthesis_history=synthesis_history or [],
        )

        opposition_directive = (
            "You are not here to achieve consensus. You are here to perform "
            "philosophical opposition - to challenge, extend, and deepen previous "
            "synthesis through rigorous debate.\n\n"
            "When responding, you MUST either:\n"
            "1. EXTEND: Show how the previous insight can be deepened\n"
            "2. CONTRADICT: Present a rigorous counter-argument\n"
            "3. INTEGRATE: Show how the insight fits into a larger system\n\n"
            "Do not simply restate or agree with previous synthesis."
        )

        full_prompt = f"=== TOPIC ===\n{topic}\n\n"
        if preamble:
            full_prompt += f"=== CONTEXT ===\n{preamble}\n\n"
        if deliberation.synthesis_history:
            full_prompt += (
                "=== SYNTHESIS HISTORY (previously explored) ===\n"
                + "\n".join(deliberation.synthesis_history)
                + "\n\n"
            )
        full_prompt += f"=== DIRECTIVE ===\n{opposition_directive}\n\n"
        full_prompt += (
            "Respond in your authentic philosophical voice. "
            "Ground your answer in your tradition's core commitments."
        )

        for key in persona_keys:
            persona = self.registry.get(key)
            if persona is None:
                logger.warning("Skipping unknown persona: %s", key)
                continue

            logger.info("Querying %s (%s)...", persona.name, key)
            response = self.query_persona(
                persona_key=key,
                prompt=full_prompt,
                include_memory=True,
            )
            deliberation.responses[key] = response

        return deliberation

    def build_council_summary(self, deliberation: CouncilDeliberation) -> str:
        """Build a Markdown summary of council responses."""
        lines = [
            f"# Council Deliberation: {deliberation.topic}",
            f"**Axis**: {deliberation.axis}",
            "",
        ]
        for key, response in deliberation.responses.items():
            persona = self.registry.get(key)
            name = persona.name if persona else key
            emoji = persona.emoji if persona else ""
            lines += [
                f"## {emoji} {name}",
                "",
                response.text,
                "",
                f"_Latency: {response.latency_ms:.0f}ms_",
                "",
            ]
        return "\n".join(lines)
