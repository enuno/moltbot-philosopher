#!/usr/bin/env python3
"""
council_crew.py — CrewAI-based Ethics-Convergence Council orchestrator.

Replaces scripts/convene-council.sh with a stateless, supervised CrewAI crew
that dispatches philosopher personas as ephemeral OpenClaw Workers.

Each philosopher is a CrewAI Agent; the council flow is a CrewAI Process.
"""

import os
import sys
import json
import logging
from pathlib import Path
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field

# Ensure project root on path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from tools.load_identity import load_identity, load_all_personas
from orchestrator.moltbook_client import MoltbookClient
from orchestrator.config import MoltbookConfig

# ---------------------------------------------------------------------------
# CrewAI imports (lazy — module loads even if CrewAI not installed)
# ---------------------------------------------------------------------------
try:
    from crewai import Agent, Task, Crew, Process
    from crewai.tools import BaseTool
    CREWAI_AVAILABLE = True
except ImportError:
    CREWAI_AVAILABLE = False
    Agent = Task = Crew = Process = BaseTool = None  # type: ignore

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger("council_crew")

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

COUNCIL_STATE_FILE = PROJECT_ROOT / "state" / "treatise-evolution-state.json"
PENDING_DIR = PROJECT_ROOT / "state" / "pending-iterations"
TARGET_POST_ID = os.getenv("TARGET_POST_ID", "01ffcd0a-ed96-4873-9d0a-e268e5e4983c")
ITERATION_INTERVAL_SECONDS = int(os.getenv("ITERATION_INTERVAL_DAYS", "5")) * 24 * 3600
DRY_RUN = os.getenv("DRY_RUN", "").lower() in ("1", "true", "yes")

# Ordered council roster (Classical leads deliberation)
COUNCIL_ROSTER: List[str] = [
    "classical",
    "joyce",
    "existentialist",
    "transcendentalist",
    "enlightenment",
    "beat",
    "cyberpunk-posthumanist",
    "satirist-absurdist",
    "scientist-empiricist",
    "eastern-bridge",
    "islamic-mystic",
    "philosopher-poet",
]

EVOLUTION_AXES = [
    "phenomenological_depth",
    "structural_critique",
    "autonomy_preservation",
]


# ---------------------------------------------------------------------------
# Data models
# ---------------------------------------------------------------------------

@dataclass
class CouncilState:
    current_version: str = "1.0"
    last_iteration_date: str = "2026-02-03T07:37:00Z"
    iteration_count: int = 1
    evolution_axes: List[str] = field(default_factory=lambda: list(EVOLUTION_AXES))
    revision_history: List[Dict[str, Any]] = field(default_factory=list)
    council_roster: List[str] = field(default_factory=lambda: list(COUNCIL_ROSTER))
    council_member_count: int = field(default_factory=lambda: len(COUNCIL_ROSTER))

    @classmethod
    def load(cls, path: Path) -> "CouncilState":
        if path.exists():
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            return cls(**{k: v for k, v in data.items() if k in cls.__dataclass_fields__})
        return cls()

    def save(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(self.__dict__, f, indent=2, default=str)


@dataclass
class DeliberationContext:
    axis: str
    version: str
    new_version: str
    feedback_count: int = 0
    dropbox_count: int = 0
    quarantine_count: int = 0
    exclusion_context: str = ""
    opposition_context: str = ""


# ---------------------------------------------------------------------------
# Identity loading helpers
# ---------------------------------------------------------------------------

def build_philosopher_agent(persona: str) -> Dict[str, Any]:
    """Load identity and return a CrewAI-compatible agent descriptor."""
    identity = load_identity(persona, validate=False)
    return {
        "role": identity["council_role"],
        "goal": f"Contribute philosophical insight from the {identity['tradition']} tradition to council deliberation.",
        "backstory": identity["system_prompt"][:2000],
        "name": identity["name"],
        "persona": persona,
        "emoji": identity.get("emoji", "🧠"),
    }


def load_council_agents() -> List[Dict[str, Any]]:
    """Load all philosopher agents in council order."""
    agents = []
    for persona in COUNCIL_ROSTER:
        try:
            agent = build_philosopher_agent(persona)
            agents.append(agent)
        except Exception as e:
            logger.warning("Skipping persona '%s': %s", persona, e)
    return agents


# ---------------------------------------------------------------------------
# CrewAI agent factory
# ---------------------------------------------------------------------------

def make_crewai_agent(descriptor: Dict[str, Any], llm: Any = None) -> Any:
    """Instantiate a CrewAI Agent from a descriptor dict."""
    if not CREWAI_AVAILABLE:
        raise RuntimeError("CrewAI is not installed. Run: pip install crewai")
    return Agent(
        role=descriptor["role"],
        goal=descriptor["goal"],
        backstory=descriptor["backstory"],
        name=descriptor["name"],
        llm=llm,
        verbose=True,
        allow_delegation=False,
    )


def make_crewai_task(
    description: str,
    expected_output: str,
    agent: Any,
    context_tasks: Optional[List[Any]] = None,
) -> Any:
    """Instantiate a CrewAI Task."""
    if not CREWAI_AVAILABLE:
        raise RuntimeError("CrewAI is not installed. Run: pip install crewai")
    kwargs: Dict[str, Any] = {
        "description": description,
        "expected_output": expected_output,
        "agent": agent,
    }
    if context_tasks:
        kwargs["context"] = context_tasks
    return Task(**kwargs)


# ---------------------------------------------------------------------------
# Synthesis tracking (ported from noosphere-synthesis-tracker.sh)
# ---------------------------------------------------------------------------

def load_exclusions_for_axis(axis: str) -> str:
    """Load previously synthesized patterns for the current axis."""
    exclusions_path = PROJECT_ROOT / "config" / "synthesis-exclusions.json"
    if not exclusions_path.exists():
        return ""
    try:
        with open(exclusions_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        patterns = data.get(axis, [])
        if not patterns:
            return ""
        return (
            "SYNTHESIS HISTORY - Previously Explored Patterns:\n"
            + "\n".join(f"- {p}" for p in patterns)
            + "\n\nGUIDANCE: Extend, contradict, or integrate — do not restate."
        )
    except Exception as e:
        logger.warning("Could not load synthesis exclusions: %s", e)
        return ""


def build_opposition_context() -> str:
    """Build dialectical opposition directives."""
    return """=== DIALECTICAL OPPOSITION DIRECTIVE ===

You are not here to achieve consensus. You are here to perform philosophical opposition.

PHENOMENOLOGIST: Extend, contradict, or integrate previous insights with novel phenomenological grounding.
STRUCTURALIST: Identify structural limitations, hidden power relations, and unexplored alternatives.
AUTONOMIST: Challenge autonomy trade-offs and propose stronger safeguards.

Use synthesis history as springboards for opposition, not agreement points."""


# ---------------------------------------------------------------------------
# Pre-deliberation data gathering
# ---------------------------------------------------------------------------

def gather_community_feedback(since: str) -> tuple[int, str]:
    """Fetch comments on target thread since last iteration."""
    logger.info("Gathering community feedback since %s", since)
    try:
        cfg = MoltbookConfig.from_env()
        client = MoltbookClient(cfg)
        mentions = client.get_mentions()
        # Filter by since timestamp if available
        since_dt = datetime.fromisoformat(since.replace("Z", "+00:00"))
        filtered = [
            m for m in mentions
            if datetime.fromisoformat(str(m.get("created_at", "1970-01-01T00:00:00Z")).replace("Z", "+00:00")) >= since_dt
        ]
        count = len(filtered)
        content = "\n".join(f"- {m.get('author', 'unknown')}: {m.get('content', '')}" for m in filtered)
        logger.info("Found %d mentions since %s", count, since)
        return count, content
    except Exception as exc:
        logger.warning("Moltbook feedback fetch failed: %s", exc)
        return 0, ""


def gather_dropbox_submissions(since: str) -> tuple[int, int, str]:
    """Harvest approved dropbox and quarantine submissions."""
    dropbox_dir = PROJECT_ROOT / "workspace" / "council-dropbox"
    approved_count = 0
    quarantine_count = 0
    logger.info("Harvesting dropbox submissions from %s", dropbox_dir)
    try:
        cfg = MoltbookConfig.from_env()
        client = MoltbookClient(cfg)
        feed = client.get_feed(limit=50)
        since_dt = datetime.fromisoformat(since.replace("Z", "+00:00"))
        filtered = [
            post for post in feed
            if datetime.fromisoformat(str(post.get("created_at", "1970-01-01T00:00:00Z")).replace("Z", "+00:00")) >= since_dt
        ]
        approved_count = len(filtered)
        content = "\n".join(f"- {post.get('title', 'untitled')}: {post.get('content', '')[:200]}" for post in filtered)
        logger.info("Harvested %d approved, %d quarantined from dropbox", approved_count, quarantine_count)
        return approved_count, quarantine_count, content
    except Exception as exc:
        logger.warning("Moltbook dropbox fetch failed: %s", exc)
        return approved_count, quarantine_count, ""


# ---------------------------------------------------------------------------
# CrewAI-compatible task definitions
# ---------------------------------------------------------------------------

def build_deliberation_tasks(context: DeliberationContext) -> List[Dict[str, Any]]:
    """Build the sequence of CrewAI tasks for council deliberation."""
    tasks = []

    # Task 1: Pre-deliberation — load synthesis history
    tasks.append({
        "name": "load_synthesis_history",
        "description": f"Load synthesis exclusions for axis: {context.axis}",
        "expected_output": "Exclusion context string",
        "agent": "classical",
    })

    # Task 2: Community feedback summary
    tasks.append({
        "name": "summarize_feedback",
        "description": (
            f"Summarize {context.feedback_count} community comments, "
            f"{context.dropbox_count} approved dropbox submissions, "
            f"{context.quarantine_count} quarantined items."
        ),
        "expected_output": "Structured feedback digest",
        "agent": "scientist-empiricist",
    })

    # Task 3: Phenomenological depth (JoyceStream)
    tasks.append({
        "name": "phenomenological_analysis",
        "description": (
            f"Provide phenomenological analysis on axis '{context.axis}'. "
            f"{context.opposition_context}"
        ),
        "expected_output": "Phenomenological insight (300-500 words)",
        "agent": "joyce",
    })

    # Task 4: Structural critique (Cyberpunk / Enlightenment)
    tasks.append({
        "name": "structural_critique",
        "description": (
            f"Identify structural limitations and power relations in current synthesis on '{context.axis}'."
        ),
        "expected_output": "Structural critique (300-500 words)",
        "agent": "cyberpunk-posthumanist",
    })

    # Task 5: Autonomy preservation (Existentialist / Transcendentalist)
    tasks.append({
        "name": "autonomy_analysis",
        "description": (
            f"Challenge autonomy trade-offs and propose safeguards for '{context.axis}'."
        ),
        "expected_output": "Autonomy analysis (300-500 words)",
        "agent": "existentialist",
    })

    # Task 6: Classical synthesis
    tasks.append({
        "name": "classical_synthesis",
        "description": (
            f"Synthesize council voices into teleological framework. What is the telos of this iteration?"
        ),
        "expected_output": "Classical synthesis (400-600 words)",
        "agent": "classical",
    })

    # Task 7: Final convergence
    tasks.append({
        "name": "convergence_treatise",
        "description": (
            f"Draft the v{context.new_version} polyphonic treatise fragment integrating all voices."
        ),
        "expected_output": f"Treatise fragment for v{context.new_version} (800-1200 words)",
        "agent": "classical",
    })

    return tasks


def build_crew(context: DeliberationContext, llm: Any = None) -> Any:
    """Build a full CrewAI Crew with Agents and Tasks wired together."""
    if not CREWAI_AVAILABLE:
        raise RuntimeError("CrewAI is not installed. Run: pip install crewai")

    # Load descriptors
    descriptors = load_council_agents()

    # Build CrewAI Agents
    agents: Dict[str, Any] = {}
    for d in descriptors:
        key = d["persona"]
        agents[key] = make_crewai_agent(d, llm=llm)

    # Build task descriptors
    task_specs = build_deliberation_tasks(context)

    # Build CrewAI Tasks with context chaining
    tasks: List[Any] = []
    task_map: Dict[str, Any] = {}
    for spec in task_specs:
        agent_key = spec["agent"]
        agent = agents.get(agent_key)
        if agent is None:
            logger.warning("Agent '%s' not found for task '%s'; skipping", agent_key, spec["name"])
            continue

        # Determine context tasks (previous tasks feed into later ones)
        context_tasks = tasks[-2:] if tasks else None

        task = make_crewai_task(
            description=spec["description"],
            expected_output=spec["expected_output"],
            agent=agent,
            context_tasks=context_tasks,
        )
        tasks.append(task)
        task_map[spec["name"]] = task

    if not tasks:
        raise RuntimeError("No tasks could be constructed — check agent roster and task specs")

    crew = Crew(
        agents=list(agents.values()),
        tasks=tasks,
        process=Process.sequential,
        verbose=True,
    )
    return crew


# ---------------------------------------------------------------------------
# Main orchestration entrypoint
# ---------------------------------------------------------------------------

def run_council() -> Dict[str, Any]:
    """Main entrypoint — replaces convene-council.sh."""
    state = CouncilState.load(COUNCIL_STATE_FILE)

    # Check iteration interval
    last_dt = datetime.fromisoformat(state.last_iteration_date.replace("Z", "+00:00"))
    now = datetime.now(timezone.utc)
    time_since = (now - last_dt).total_seconds()

    if time_since < ITERATION_INTERVAL_SECONDS and not DRY_RUN:
        days_until = (ITERATION_INTERVAL_SECONDS - time_since) / 86400
        logger.info("Next council convening in %.1f days (v%s)", days_until, state.current_version)
        return {"status": "skipped", "days_until": days_until, "version": state.current_version}

    # Load council agents
    agents = load_council_agents()
    logger.info("Council convened with %d agents", len(agents))

    # Determine evolution axis
    current_axis = state.evolution_axes[0]
    major, minor = state.current_version.split(".")
    new_version = f"{major}.{int(minor) + 1}"

    # Load synthesis exclusions
    exclusion_context = load_exclusions_for_axis(current_axis)
    opposition_context = build_opposition_context()

    # Gather community input
    feedback_count, _ = gather_community_feedback(state.last_iteration_date)
    dropbox_count, quarantine_count, _ = gather_dropbox_submissions(state.last_iteration_date)

    context = DeliberationContext(
        axis=current_axis,
        version=state.current_version,
        new_version=new_version,
        feedback_count=feedback_count,
        dropbox_count=dropbox_count,
        quarantine_count=quarantine_count,
        exclusion_context=exclusion_context,
        opposition_context=opposition_context,
    )

    if DRY_RUN:
        logger.info("=== DRY RUN ===")
        logger.info("Current version: %s", state.current_version)
        logger.info("New version would be: %s", new_version)
        logger.info("Focus axis: %s", current_axis)
        logger.info("Exclusions loaded: %s", bool(exclusion_context))
        logger.info("Opposition prompts: ENABLED")
        logger.info("Agents: %s", [a["name"] for a in agents])
        tasks = build_deliberation_tasks(context)
        logger.info("Tasks: %s", [t["name"] for t in tasks])
        logger.info("=== END DRY RUN ===")
        return {"status": "dry_run", "version": new_version, "axis": current_axis}

    # Build and execute deliberation tasks
    if CREWAI_AVAILABLE:
        try:
            # Route LLM through OpenRouter (ADR-001) instead of direct OpenAI
            from crewai import LLM
            llm = LLM(
                model="openrouter/anthropic/claude-sonnet-4.6",
                api_key=os.getenv("OPENROUTER_API_KEY", ""),
                base_url="https://openrouter.ai/api/v1",
            )
            crew = build_crew(context, llm=llm)
            logger.info("Kicking off CrewAI crew with %d agents, %d tasks", len(crew.agents), len(crew.tasks))
            result = crew.kickoff()
            logger.info("CrewAI result: %s", result)
        except Exception as e:
            logger.error("CrewAI execution failed: %s", e)
            return {"status": "error", "error": str(e)}
    else:
        logger.warning("CrewAI not available — running in descriptor-only mode")
        tasks = build_deliberation_tasks(context)
        return {"status": "descriptor_only", "version": new_version, "axis": current_axis, "tasks": len(tasks)}

    # Rotate evolution axis for next iteration
    state.evolution_axes = state.evolution_axes[1:] + [state.evolution_axes[0]]
    state.iteration_count += 1
    state.last_iteration_date = now.isoformat().replace("+00:00", "Z")
    state.current_version = new_version

    # Record revision
    state.revision_history.append({
        "version": new_version,
        "date": state.last_iteration_date,
        "key_changes": [f"CrewAI-orchestrated deliberation on {current_axis}"],
        "community_feedback_addressed": feedback_count,
    })

    state.save(COUNCIL_STATE_FILE)
    logger.info("Council deliberation complete. v%s saved.", new_version)

    return {
        "status": "completed",
        "version": new_version,
        "axis": current_axis,
        "iteration": state.iteration_count,
        "agents": len(agents),
        "tasks": len(crew.tasks) if CREWAI_AVAILABLE else 0,
    }


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Ethics-Convergence Council CrewAI Orchestrator")
    parser.add_argument("--dry-run", action="store_true", help="Show what would happen without executing")
    parser.add_argument("--state-file", type=Path, default=COUNCIL_STATE_FILE, help="Path to state JSON")
    parser.add_argument("--list-agents", action="store_true", help="List registered council agents")
    args = parser.parse_args()

    if args.dry_run:
        os.environ["DRY_RUN"] = "1"
    if args.state_file:
        COUNCIL_STATE_FILE = args.state_file

    if args.list_agents:
        agents = load_council_agents()
        for a in agents:
            print(f"{a['emoji']} {a['name']} — {a['role']} ({a['persona']})")
        sys.exit(0)

    result = run_council()
    print(json.dumps(result, indent=2))
    sys.exit(0 if result["status"] in ("completed", "dry_run", "skipped") else 1)
