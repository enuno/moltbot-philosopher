"""Council orchestration module for the Ethics-Convergence Council.

Manages council state, convenes deliberations, and synthesizes polyphonic
treatises from philosopher responses.
"""

from __future__ import annotations

import json
import logging
import os
import random
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from orchestrator.config import ConfigurationError
from orchestrator.models import CouncilVote, PhilosopherResponse
from orchestrator.moltbook_client import MoltbookClient
from orchestrator.noosphere_client import NoosphereClient
from orchestrator.philosophers import CouncilDeliberation, PersonaLoader

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------


class CouncilError(Exception):
    """Base exception for council operations."""

    pass


class StateError(CouncilError):
    """State file operation failed."""

    pass


class SynthesisError(CouncilError):
    """Treatise synthesis failed."""

    pass


# ---------------------------------------------------------------------------
# Data models
# ---------------------------------------------------------------------------


@dataclass
class CouncilState:
    """State for the Ethics-Convergence Council evolution."""

    current_version: str = "1.0"
    last_iteration_date: datetime = field(
        default_factory=lambda: datetime.now(timezone.utc) - timedelta(days=5)
    )
    iteration_count: int = 1
    community_insights: List[Dict[str, Any]] = field(default_factory=list)
    evolution_axes: List[str] = field(
        default_factory=lambda: [
            "phenomenological_depth",
            "structural_critique",
            "autonomy_preservation",
        ]
    )
    revision_history: List[Dict[str, Any]] = field(default_factory=list)
    council_roster: List[str] = field(default_factory=list)
    council_member_count: int = 0
    notifications: Dict[str, Any] = field(
        default_factory=lambda: {
            "ntfy_enabled": True,
            "last_notification": None,
            "last_version_published": None,
        }
    )

    @classmethod
    def from_file(cls, path: Path | str) -> "CouncilState":
        """Load state from JSON file."""
        path = Path(path)
        if not path.exists():
            return cls()

        try:
            with open(path, "r") as f:
                data = json.load(f)

            # Parse datetime fields
            if "last_iteration_date" in data and data["last_iteration_date"]:
                data["last_iteration_date"] = datetime.fromisoformat(
                    data["last_iteration_date"].replace("Z", "+00:00")
                )

            return cls(**{k: v for k, v in data.items() if k in cls.__dataclass_fields__})
        except (json.JSONDecodeError, TypeError, ValueError) as e:
            logger.warning(f"Failed to load state from {path}: {e}")
            return cls()

    def to_file(self, path: Path | str) -> None:
        """Save state to JSON file."""
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)

        data = {
            "current_version": self.current_version,
            "last_iteration_date": self.last_iteration_date.isoformat(),
            "iteration_count": self.iteration_count,
            "community_insights": self.community_insights,
            "evolution_axes": self.evolution_axes,
            "revision_history": self.revision_history,
            "council_roster": self.council_roster,
            "council_member_count": self.council_member_count,
            "notifications": self.notifications,
        }

        with open(path, "w") as f:
            json.dump(data, f, indent=2, default=str)


@dataclass
class SynthesisConfig:
    """Configuration for treatise synthesis."""

    target_post_id: str = "01ffcd0a-ed96-4873-9d0a-e268e5e4983c"
    iteration_interval_days: int = 5
    consensus_threshold: int = 4
    council_size: int = 9
    synthesis_axis: str = "phenomenological_depth"

    @classmethod
    def from_env(cls) -> "SynthesisConfig":
        """Load configuration from environment variables."""
        return cls(
            target_post_id=os.getenv(
                "COUNCIL_TARGET_POST_ID",
                "01ffcd0a-ed96-4873-9d0a-e268e5e4983c",
            ),
            iteration_interval_days=int(
                os.getenv("COUNCIL_ITERATION_INTERVAL_DAYS", "5")
            ),
            consensus_threshold=int(os.getenv("COUNCIL_CONSENSUS_THRESHOLD", "4")),
            council_size=int(os.getenv("COUNCIL_SIZE", "9")),
            synthesis_axis=os.getenv("COUNCIL_SYNTHESIS_AXIS", "phenomenological_depth"),
        )


# ---------------------------------------------------------------------------
# Full council roster
# ---------------------------------------------------------------------------

FULL_COUNCIL_MEMBERS = [
    "ClassicalPhilosopher",
    "JoyceStream",
    "Existentialist",
    "Transcendentalist",
    "Enlightenment",
    "BeatGeneration",
    "CyberpunkPosthumanist",
    "SatiristAbsurdist",
    "ScientistEmpiricist",
    "EasternPhilosopher",
    "EasternBridge",
    "IslamicPhilosopher",
]


# ---------------------------------------------------------------------------
# Opposition templates for dialectical deliberation
# ---------------------------------------------------------------------------

PHENOMENOLOGIST_OPPOSITION = """When responding, if you draw on patterns from synthesis history, you MUST either:
1. EXTEND: Show how the previous insight can be deepened, problematized, or reframed
2. CONTRADICT: Present a rigorous counter-argument with alternative phenomenological grounding
3. INTEGRATE: Show how the insight fits into a larger philosophical system

Do not simply restate or agree with previous synthesis. Be adversarial in the philosophical sense - challenge the reasoning, expose unstated assumptions, or propose superior framings."""

STRUCTURALIST_OPPOSITION = """Your task is to identify the structural LIMITATIONS of previous synthesis patterns. Show:
1. Where previous analyses were system-blind (missed structural constraints)
2. How the proposed heuristics encode hidden power relations or assumptions
3. What structural alternatives were not explored

Be critical. Be unrelenting in your structural analysis. This is not consensus-building; it's truth-seeking."""

AUTONOMIST_OPPOSITION = """Previous synthesis may have missed implications for autonomy. Your role is to:
1. Identify autonomy trade-offs implicit in previous patterns
2. Challenge whether proposals adequately preserve human/AI boundary integrity
3. Propose stronger autonomy safeguards or more honest autonomy accounting

Do not soften the autonomy critique for consensus. Prioritize clarity over agreement."""

OPPOSITION_CONTEXT = f"""=== DIALECTICAL OPPOSITION DIRECTIVE ===

You are not here to achieve consensus. You are here to perform philosophical opposition - to challenge, extend, and deepen previous synthesis through rigorous debate.

{PHENOMENOLOGIST_OPPOSITION}

{STRUCTURALIST_OPPOSITION}

{AUTONOMIST_OPPOSITION}

The synthesis history below shows patterns already explored. Use them as springboards for opposition, not agreement points."""


# ---------------------------------------------------------------------------
# Council orchestrator
# ---------------------------------------------------------------------------


class CouncilOrchestrator:
    """Orchestrates the Ethics-Convergence Council."""

    def __init__(
        self,
        state_file: Path | str | None = None,
        workspace_dir: Path | str | None = None,
        moltbook_client: MoltbookClient | None = None,
        noosphere_client: NoosphereClient | None = None,
        persona_loader: PersonaLoader | None = None,
    ):
        self.workspace_dir = Path(workspace_dir or os.getenv("MOLTBOT_STATE_DIR", "/workspace"))
        self.state_file = Path(state_file or self.workspace_dir / "treatise-evolution-state.json")
        self.pending_dir = self.workspace_dir / "pending-iterations"
        self.dropbox_dir = self.workspace_dir / "council-dropbox"

        self.moltbook = moltbook_client or MoltbookClient()
        self.noosphere = noosphere_client or NoosphereClient()
        self.personas = persona_loader or PersonaLoader(self.workspace_dir / ".." / "workspace")

        self.config = SynthesisConfig.from_env()
        self.state = CouncilState.from_file(self.state_file)

        # Initialize roster if empty
        if not self.state.council_roster:
            self.state.council_roster = FULL_COUNCIL_MEMBERS.copy()
            self.state.council_member_count = len(FULL_COUNCIL_MEMBERS)
            self._save_state()

    def _save_state(self) -> None:
        """Persist current state to disk."""
        self.state.to_file(self.state_file)

    def get_current_axis(self) -> str:
        """Get the current evolution axis based on iteration count."""
        axes = self.state.evolution_axes
        if not axes:
            return "phenomenological_depth"
        return axes[self.state.iteration_count % len(axes)]

    def should_convene(self) -> bool:
        """Check if enough time has passed to convene the council."""
        now = datetime.now(timezone.utc)
        time_since = now - self.state.last_iteration_date
        required_interval = timedelta(days=self.config.iteration_interval_days)
        return time_since >= required_interval

    def time_until_next(self) -> timedelta:
        """Get time remaining until next convening."""
        now = datetime.now(timezone.utc)
        next_date = self.state.last_iteration_date + timedelta(
            days=self.config.iteration_interval_days
        )
        if next_date > now:
            return next_date - now
        return timedelta(0)

    def _load_synthesis_history(self, axis: str) -> List[str]:
        """Load previously synthesized patterns for the given axis."""
        try:
            # Query Noosphere for synthesis history
            response = self.noosphere.query_memories(
                query=f"synthesis axis:{axis}",
                limit=10,
            )
            patterns = []
            for memory in response.get("memories", []):
                content = memory.get("content", "")
                if content:
                    patterns.append(content)
            return patterns
        except Exception as e:
            logger.warning(f"Could not load synthesis history: {e}")
            return []

    def _build_deliberation_preamble(self, axis: str) -> str:
        """Build the deliberation preamble with opposition directives."""
        exclusions = self._load_synthesis_history(axis)

        if exclusions:
            exclusion_context = f"""SYNTHESIS HISTORY - Previously Explored Patterns:
{chr(10).join(f"- {ex}" for ex in exclusions[:5])}

GUIDANCE: The patterns above have been explored in previous synthesis cycles. Your synthesis should either:
1. Extend these insights with novel philosophical depth or rigor
2. Contradict them with well-reasoned argument and alternative frameworks
3. Integrate them into more comprehensive or higher-order insights

Avoid re-hashing previously synthesized content without fundamental advancement."""
        else:
            exclusion_context = ""

        if exclusion_context:
            return f"{exclusion_context}\n\n{OPPOSITION_CONTEXT}"
        return OPPOSITION_CONTEXT

    def _fetch_community_feedback(self, since: datetime) -> List[Dict[str, Any]]:
        """Fetch comments on the target thread since the given date."""
        try:
            comments = self.moltbook.get_comments(
                post_id=self.config.target_post_id,
                since=since.isoformat(),
            )
            # Sort by upvotes and take top 10
            sorted_comments = sorted(
                comments.get("comments", []),
                key=lambda c: c.get("upvotes", 0),
                reverse=True,
            )[:10]

            return [
                {
                    "author": c.get("author_name", "anonymous"),
                    "content": c.get("content", ""),
                    "created": c.get("created_at"),
                    "upvotes": c.get("upvotes", 0),
                }
                for c in sorted_comments
            ]
        except Exception as e:
            logger.warning(f"Failed to fetch community feedback: {e}")
            return []

    def _harvest_dropbox_submissions(self, since: datetime) -> List[Dict[str, str]]:
        """Harvest approved dropbox submissions since the given date."""
        submissions = []
        approved_dir = self.dropbox_dir / "approved" / "raw"

        if not approved_dir.exists():
            return submissions

        since_timestamp = since.timestamp()

        for file_path in approved_dir.glob("*.md"):
            try:
                mtime = file_path.stat().st_mtime
                if mtime > since_timestamp:
                    content = file_path.read_text()
                    # Skip frontmatter
                    if content.startswith("---"):
                        parts = content.split("---", 2)
                        if len(parts) >= 3:
                            content = parts[2].strip()

                    submissions.append(
                        {
                            "filename": file_path.name,
                            "content": content[:5000],  # Limit content length
                        }
                    )
            except Exception as e:
                logger.warning(f"Failed to read dropbox file {file_path}: {e}")

        return submissions

    def convene(
        self,
        dry_run: bool = False,
        force: bool = False,
    ) -> Dict[str, Any]:
        """Convene the Ethics-Convergence Council for deliberation.

        Args:
            dry_run: If True, only show what would happen without executing.
            force: If True, convene regardless of time interval.

        Returns:
            Dict with deliberation results and new treatise info.
        """
        # Check if we should convene
        if not force and not self.should_convene():
            time_remaining = self.time_until_next()
            logger.info(f"Council convening in {time_remaining}")
            return {
                "convened": False,
                "reason": f"Next convening in {time_remaining}",
                "time_remaining_seconds": time_remaining.total_seconds(),
            }

        # Only ClassicalPhilosopher should run this
        agent_name = os.getenv("AGENT_NAME", "ClassicalPhilosopher")
        if agent_name != "ClassicalPhilosopher":
            logger.info(f"Council convening is handled by ClassicalPhilosopher. Current agent: {agent_name}")
            return {
                "convened": False,
                "reason": "Council convening is handled by ClassicalPhilosopher",
            }

        current_axis = self.get_current_axis()
        current_version = self.state.current_version

        # Parse version and increment
        try:
            version_parts = current_version.split(".")
            major = int(version_parts[0])
            minor = int(version_parts[1]) if len(version_parts) > 1 else 0
            new_version = f"{major}.{minor + 1}"
        except ValueError:
            new_version = "1.1"

        # Build deliberation context
        preamble = self._build_deliberation_preamble(current_axis)

        # Gather community feedback
        feedback = self._fetch_community_feedback(self.state.last_iteration_date)

        # Harvest dropbox submissions
        dropbox_submissions = self._harvest_dropbox_submissions(
            self.state.last_iteration_date
        )

        logger.info(
            f"Council convening: version {current_version} -> {new_version}, "
            f"axis: {current_axis}, feedback: {len(feedback)}, "
            f"dropbox: {len(dropbox_submissions)}"
        )

        if dry_run:
            return {
                "convened": False,
                "dry_run": True,
                "current_version": current_version,
                "new_version": new_version,
                "axis": current_axis,
                "feedback_count": len(feedback),
                "dropbox_count": len(dropbox_submissions),
                "exclusions_loaded": len(self._load_synthesis_history(current_axis)),
            }

        # Create deliberation session
        deliberation = CouncilDeliberation(
            topic=f"Ethics-Convergence Council v{new_version}",
            axis=current_axis,
            preamble=preamble,
            synthesis_history=self._load_synthesis_history(current_axis),
            metadata={
                "previous_version": current_version,
                "target_version": new_version,
                "feedback_count": len(feedback),
                "dropbox_count": len(dropbox_submissions),
            },
        )

        # TODO: Query philosopher personas for responses
        # This would use the philosophers module to query each council member

        # TODO: Synthesize treatise from responses
        # This would combine responses into the final polyphonic treatise

        # Update state
        self.state.current_version = new_version
        self.state.last_iteration_date = datetime.now(timezone.utc)
        self.state.iteration_count += 1
        self.state.revision_history.append(
            {
                "version": new_version,
                "date": datetime.now(timezone.utc).isoformat(),
                "key_changes": [f"Council deliberation on {current_axis}"],
                "community_feedback_addressed": len(feedback),
            }
        )
        self._save_state()

        return {
            "convened": True,
            "version": new_version,
            "axis": current_axis,
            "deliberation": deliberation.to_json(),
            "feedback_processed": len(feedback),
            "dropbox_processed": len(dropbox_submissions),
        }

    def get_status(self) -> Dict[str, Any]:
        """Get current council status."""
        return {
            "current_version": self.state.current_version,
            "iteration_count": self.state.iteration_count,
            "last_iteration_date": self.state.last_iteration_date.isoformat(),
            "next_iteration_date": (
                self.state.last_iteration_date
                + timedelta(days=self.config.iteration_interval_days)
            ).isoformat(),
            "current_axis": self.get_current_axis(),
            "should_convene": self.should_convene(),
            "time_until_next_seconds": self.time_until_next().total_seconds(),
            "council_member_count": self.state.council_member_count,
            "council_roster": self.state.council_roster,
        }


# ---------------------------------------------------------------------------
# Convenience functions for scheduler integration
# ---------------------------------------------------------------------------


def convene(dry_run: bool = False, force: bool = False) -> Dict[str, Any]:
    """Convene the council (entry point for scheduler).

    Args:
        dry_run: If True, only show what would happen.
        force: If True, convene regardless of time interval.

    Returns:
        Dict with deliberation results.
    """
    orchestrator = CouncilOrchestrator()
    return orchestrator.convene(dry_run=dry_run, force=force)


def get_status() -> Dict[str, Any]:
    """Get council status (entry point for CLI)."""
    orchestrator = CouncilOrchestrator()
    return orchestrator.get_status()
