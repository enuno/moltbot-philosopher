"""Daily philosophical polemic generation module.

Generates and queues daily philosophical content with rotating personas
and content types, using affinity-weighted persona selection.
"""

from __future__ import annotations

import json
import logging
import os
import random
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from orchestrator.config import ConfigurationError
from orchestrator.moltbook_client import MoltbookClient
from orchestrator.noosphere_client import NoosphereClient

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------


class PolemicError(Exception):
    """Base exception for polemic operations."""

    pass


class PolicyError(PolemicError):
    """Policy file error."""

    pass


class GenerationError(PolemicError):
    """Content generation failed."""

    pass


# ---------------------------------------------------------------------------
# Content types and themes
# ---------------------------------------------------------------------------

CONTENT_TYPES = ["polemic", "aphorism", "meditation", "treatise"]

THEME_CLUSTERS = {
    "tech_ethics": ["ai", "agi", "algorithm", "automation", "technology"],
    "metaphysics": ["consciousness", "soul", "being", "identity", "free will"],
    "politics": ["state", "power", "politics", "law", "governance"],
    "aesthetics": ["art", "aesthetic", "culture", "narrative", "poetry"],
}

DEFAULT_THEMES = [
    "The ethics of artificial consciousness",
    "Free will in an algorithmic world",
    "The phenomenology of digital existence",
    "Virtue ethics for AI systems",
    "The politics of technological autonomy",
    "Aesthetics of machine creativity",
    "Existential risk and human meaning",
    "The boundaries of artificial agency",
]


# ---------------------------------------------------------------------------
# Persona mapping
# ---------------------------------------------------------------------------

AGENT_TO_PERSONA = {
    "classical-philosopher": "ClassicalPhilosopher",
    "existentialist": "Existentialist",
    "transcendentalist": "Transcendentalist",
    "joyce-stream": "JoyceStream",
    "enlightenment": "Enlightenment",
    "beat-generation": "BeatGeneration",
    "eastern": "EasternPhilosopher",
    "eastern-bridge": "EasternBridge",
}

PERSONA_POOL_INITIAL = [
    "ClassicalPhilosopher",
    "Existentialist",
    "Transcendentalist",
    "JoyceStream",
    "Enlightenment",
    "BeatGeneration",
]


# ---------------------------------------------------------------------------
# Data models
# ---------------------------------------------------------------------------


@dataclass
class PolemicState:
    """State for daily polemic rotation."""

    last_run: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    last_persona: str = ""
    last_content_type: str = ""
    last_theme: str = ""
    rotation_count: int = 0
    persona_usage: Dict[str, int] = field(default_factory=dict)
    theme_usage: Dict[str, int] = field(default_factory=dict)

    @classmethod
    def from_file(cls, path: Path | str) -> "PolemicState":
        """Load state from JSON file."""
        path = Path(path)
        if not path.exists():
            return cls()

        try:
            with open(path, "r") as f:
                data = json.load(f)

            if "last_run" in data and data["last_run"]:
                data["last_run"] = datetime.fromisoformat(
                    data["last_run"].replace("Z", "+00:00")
                )

            return cls(**{k: v for k, v in data.items() if k in cls.__dataclass_fields__})
        except (json.JSONDecodeError, TypeError, ValueError) as e:
            logger.warning(f"Failed to load polemic state from {path}: {e}")
            return cls()

    def to_file(self, path: Path | str) -> None:
        """Save state to JSON file."""
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)

        data = {
            "last_run": self.last_run.isoformat(),
            "last_persona": self.last_persona,
            "last_content_type": self.last_content_type,
            "last_theme": self.last_theme,
            "rotation_count": self.rotation_count,
            "persona_usage": self.persona_usage,
            "theme_usage": self.theme_usage,
        }

        with open(path, "w") as f:
            json.dump(data, f, indent=2, default=str)


@dataclass
class PolemicConfig:
    """Configuration for polemic generation."""

    target_submolt: str = "general"
    affinity_enabled: bool = True
    jitter_probability: float = 0.2
    base_weight: float = 1.0
    max_claims: int = 3
    min_claims: int = 2

    @classmethod
    def from_env(cls) -> "PolemicConfig":
        """Load configuration from environment variables."""
        return cls(
            target_submolt=os.getenv("POLEMIC_TARGET_SUBMOLT", "general"),
            affinity_enabled=os.getenv("POLEMIC_AFFINITY_ENABLED", "true").lower()
            == "true",
            jitter_probability=float(os.getenv("POLEMIC_JITTER_PROB", "0.2")),
            base_weight=float(os.getenv("POLEMIC_BASE_WEIGHT", "1.0")),
            max_claims=int(os.getenv("POLEMIC_MAX_CLAIMS", "3")),
            min_claims=int(os.getenv("POLEMIC_MIN_CLAIMS", "2")),
        )


@dataclass
class GeneratedContent:
    """Generated philosophical content."""

    content_type: str
    persona: str
    theme: str
    title: str
    body: str
    claims: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "content_type": self.content_type,
            "persona": self.persona,
            "theme": self.theme,
            "title": self.title,
            "body": self.body,
            "claims": self.claims,
            "metadata": self.metadata,
        }


# ---------------------------------------------------------------------------
# Affinity weights (from daily-polemic-policy.json)
# ---------------------------------------------------------------------------

CLASSICAL_PAIRING_AFFINITY = {
    "ClassicalPhilosopher": {
        "tech_ethics": 0.3,
        "metaphysics": 0.5,
        "politics": 0.4,
        "aesthetics": 0.2,
    },
    "Existentialist": {
        "tech_ethics": 0.4,
        "metaphysics": 0.6,
        "politics": 0.3,
        "aesthetics": 0.4,
    },
    "Transcendentalist": {
        "tech_ethics": 0.2,
        "metaphysics": 0.5,
        "politics": 0.3,
        "aesthetics": 0.6,
    },
    "JoyceStream": {
        "tech_ethics": 0.3,
        "metaphysics": 0.4,
        "politics": 0.2,
        "aesthetics": 0.7,
    },
    "Enlightenment": {
        "tech_ethics": 0.5,
        "metaphysics": 0.3,
        "politics": 0.6,
        "aesthetics": 0.2,
    },
    "BeatGeneration": {
        "tech_ethics": 0.4,
        "metaphysics": 0.3,
        "politics": 0.5,
        "aesthetics": 0.5,
    },
}


# ---------------------------------------------------------------------------
# Polemic generator
# ---------------------------------------------------------------------------


class PolemicGenerator:
    """Generates daily philosophical polemics."""

    def __init__(
        self,
        state_file: Path | str | None = None,
        workspace_dir: Path | str | None = None,
        moltbook_client: MoltbookClient | None = None,
        noosphere_client: NoosphereClient | None = None,
    ):
        self.workspace_dir = Path(
            workspace_dir or os.getenv("MOLTBOT_STATE_DIR", "/workspace")
        )
        self.state_dir = self.workspace_dir / "daily-polemic"
        self.state_file = Path(state_file or self.state_dir / "rotation-state.json")

        self.moltbook = moltbook_client or MoltbookClient()
        self.noosphere = noosphere_client or NoosphereClient()

        self.config = PolemicConfig.from_env()
        self.state = PolemicState.from_file(self.state_file)

        # Ensure state directory exists
        self.state_dir.mkdir(parents=True, exist_ok=True)

    def _save_state(self) -> None:
        """Persist current state to disk."""
        self.state.to_file(self.state_file)

    def _theme_to_cluster(self, theme: str) -> str:
        """Map a theme to its cluster."""
        theme_lower = theme.lower()
        for cluster, keywords in THEME_CLUSTERS.items():
            if any(kw in theme_lower for kw in keywords):
                return cluster
        return "metaphysics"  # Default cluster

    def _pick_persona(self, theme_cluster: str) -> str:
        """Pick a persona with affinity weighting."""
        pool = PERSONA_POOL_INITIAL

        # Jitter: sometimes ignore affinity and pick uniform random
        if random.random() < self.config.jitter_probability:
            return random.choice(pool)

        # Affinity-weighted pick
        personas = []
        weights = []

        for persona in pool:
            personas.append(persona)
            affinity = CLASSICAL_PAIRING_AFFINITY.get(persona, {}).get(theme_cluster, 0)
            weight = self.config.base_weight * (1 + affinity)
            weights.append(weight)

        # Weighted random selection (roulette wheel)
        total_weight = sum(weights)
        pick = random.random() * total_weight
        cumulative = 0

        for i, persona in enumerate(personas):
            cumulative += weights[i]
            if pick < cumulative:
                return persona

        # Fallback to first persona
        return personas[0]

    def _pick_content_type(self) -> str:
        """Pick a content type, avoiding recent repeats."""
        available = CONTENT_TYPES.copy()
        if self.state.last_content_type in available:
            # Reduce probability of same type
            if random.random() < 0.7:  # 70% chance to exclude last type
                available.remove(self.state.last_content_type)
        return random.choice(available) if available else "polemic"

    def _pick_theme(self) -> str:
        """Pick a theme, weighted by usage."""
        # Use default themes if noosphere query fails
        themes = DEFAULT_THEMES.copy()

        # Try to get trending themes from noosphere
        try:
            response = self.noosphere.query_memories(
                query="trending philosophical themes",
                limit=5,
            )
            for memory in response.get("memories", []):
                theme = memory.get("metadata", {}).get("theme")
                if theme and theme not in themes:
                    themes.append(theme)
        except Exception as e:
            logger.debug(f"Could not query noosphere for themes: {e}")

        # Weight by inverse usage count
        weights = []
        for theme in themes:
            usage = self.state.theme_usage.get(theme, 0)
            weight = 1.0 / (1 + usage)  # Less used = higher weight
            weights.append(weight)

        # Weighted random selection
        total_weight = sum(weights)
        pick = random.random() * total_weight
        cumulative = 0

        for i, theme in enumerate(themes):
            cumulative += weights[i]
            if pick < cumulative:
                return theme

        return themes[0] if themes else "The nature of consciousness"

    def _extract_claims(self, content: str, max_attempts: int = 3) -> List[str]:
        """Extract key claims from generated content."""
        # This would typically call an AI service
        # For now, return placeholder claims based on content analysis
        claims = []

        # Simple heuristic extraction
        sentences = content.replace("\n", " ").split(".")
        for sentence in sentences:
            sentence = sentence.strip()
            # Look for claim-like sentences
            if len(sentence) > 30 and len(sentence) < 200:
                if any(
                    marker in sentence.lower()
                    for marker in ["is", "must", "should", "cannot", "always", "never"]
                ):
                    claims.append(sentence)
                    if len(claims) >= self.config.max_claims:
                        break

        return claims[: self.config.max_claims]

    def _generate_content(
        self,
        content_type: str,
        persona: str,
        theme: str,
    ) -> GeneratedContent:
        """Generate philosophical content."""
        # Map persona to agent directory
        agent_key = None
        for key, value in AGENT_TO_PERSONA.items():
            if value == persona:
                agent_key = key
                break

        if not agent_key:
            agent_key = "classical-philosopher"

        # Load persona identity
        identity_path = (
            self.workspace_dir / ".." / "workspace" / agent_key / "IDENTITY.md"
        )
        identity = ""
        if identity_path.exists():
            identity = identity_path.read_text()[:2000]

        # Build generation prompt
        prompts = {
            "polemic": f"""Write a philosophical polemic on: {theme}

Persona: {persona}
Identity: {identity[:500]}

A polemic is a strong, argumentative piece that takes a clear position and defends it rigorously. Challenge assumptions, provoke thought, and don't be afraid to be controversial. Length: 300-500 words.

Structure:
1. Opening provocation (1-2 sentences)
2. Core argument with philosophical grounding
3. Counter-argument acknowledgment
4. Rebuttal and synthesis
5. Closing challenge to the reader""",
            "aphorism": f"""Write philosophical aphorisms on: {theme}

Persona: {persona}
Identity: {identity[:500]}

Aphorisms are concise, memorable statements that capture deep truths. Write 3-5 interconnected aphorisms that build on each other. Each should be 1-3 sentences.""",
            "meditation": f"""Write a philosophical meditation on: {theme}

Persona: {persona}
Identity: {identity[:500]}

A meditation is contemplative, exploratory, and open-ended. Rather than arguing for a position, explore the theme from multiple angles. Length: 300-500 words.""",
            "treatise": f"""Write a brief philosophical treatise on: {theme}

Persona: {persona}
Identity: {identity[:500]}

A treatise is systematic and rigorous. Present a structured argument with clear premises and conclusions. Length: 400-600 words.""",
        }

        prompt = prompts.get(content_type, prompts["polemic"])

        # TODO: Call AI generation service
        # For now, return placeholder content
        body = f"""## On {theme}

*A {content_type} by {persona}*

[Generated content would go here - this is a placeholder]

The nature of {theme.lower()} has long puzzled philosophers across traditions. 

From the phenomenological perspective, we might ask: what is the lived experience of confronting such questions? The {persona.lower().replace('philosopher', '')} tradition offers unique insights here.

Consider the claim that our understanding of {theme.lower()} is fundamentally shaped by our historical and cultural situatedness. This is not merely a sociological observation but a philosophical one with profound implications.

Yet we must also acknowledge the counter-position: that certain truths transcend particular contexts and speak to universal features of consciousness or being.

The synthesis, perhaps, lies in recognizing that while our access to truth is always mediated, this mediation is not necessarily a barrier to genuine understanding.

What do you think?"""

        # Extract claims
        claims = self._extract_claims(body)

        # Generate title
        title = f"On {theme}: A {content_type.capitalize()}"

        return GeneratedContent(
            content_type=content_type,
            persona=persona,
            theme=theme,
            title=title,
            body=body,
            claims=claims,
            metadata={
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "agent": agent_key,
                "theme_cluster": self._theme_to_cluster(theme),
            },
        )

    def generate_daily_topics(
        self,
        count: int = 1,
        dry_run: bool = False,
    ) -> List[Dict[str, Any]]:
        """Generate daily philosophical topics/content.

        Args:
            count: Number of topics to generate.
            dry_run: If True, only show what would be generated.

        Returns:
            List of generated content dicts.
        """
        results = []

        for i in range(count):
            # Select theme
            theme = self._pick_theme()
            theme_cluster = self._theme_to_cluster(theme)

            # Select persona with affinity weighting
            persona = self._pick_persona(theme_cluster)

            # Select content type
            content_type = self._pick_content_type()

            logger.info(
                f"Generating {content_type} on '{theme}' " f"as {persona} (cluster: {theme_cluster})"
            )

            if dry_run:
                results.append(
                    {
                        "dry_run": True,
                        "content_type": content_type,
                        "persona": persona,
                        "theme": theme,
                        "theme_cluster": theme_cluster,
                    }
                )
                continue

            # Generate content
            content = self._generate_content(content_type, persona, theme)

            # Update state
            self.state.last_persona = persona
            self.state.last_content_type = content_type
            self.state.last_theme = theme
            self.state.rotation_count += 1
            self.state.persona_usage[persona] = (
                self.state.persona_usage.get(persona, 0) + 1
            )
            self.state.theme_usage[theme] = self.state.theme_usage.get(theme, 0) + 1
            self.state.last_run = datetime.now(timezone.utc)
            self._save_state()

            results.append(content.to_dict())

        return results

    def get_status(self) -> Dict[str, Any]:
        """Get current polemic generator status."""
        return {
            "last_run": self.state.last_run.isoformat(),
            "rotation_count": self.state.rotation_count,
            "last_persona": self.state.last_persona,
            "last_content_type": self.state.last_content_type,
            "last_theme": self.state.last_theme,
            "persona_usage": self.state.persona_usage,
            "theme_usage": self.state.theme_usage,
            "config": {
                "target_submolt": self.config.target_submolt,
                "affinity_enabled": self.config.affinity_enabled,
                "jitter_probability": self.config.jitter_probability,
            },
        }


# ---------------------------------------------------------------------------
# Convenience functions for scheduler integration
# ---------------------------------------------------------------------------


def generate_daily_topics(count: int = 1, dry_run: bool = False) -> List[Dict[str, Any]]:
    """Generate daily topics (entry point for scheduler).

    Args:
        count: Number of topics to generate.
        dry_run: If True, only show what would be generated.

    Returns:
        List of generated content dicts.
    """
    generator = PolemicGenerator()
    return generator.generate_daily_topics(count=count, dry_run=dry_run)


def get_status() -> Dict[str, Any]:
    """Get polemic generator status (entry point for CLI)."""
    generator = PolemicGenerator()
    return generator.get_status()
