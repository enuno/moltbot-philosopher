#!/usr/bin/env python3
"""
Philosopher Poet Triptych Selection Algorithm

Selects a poet, existential state, and poem scaffold for the Philosopher Poet
agent, enforcing the 30/40/30 mori/vivere/carpe ratio, avoiding poet
repetition within a sliding window, and randomly invoking a Frostian
"return to star" grounding reflection.

Usage:
    python3 select-poet-triptych.py
    python3 select-poet-triptych.py --state memento_mori
    python3 select-poet-triptych.py --dry-run
    python3 select-poet-triptych.py --history-file /path/to/state.json

Output (JSON):
    {
        "poet": "Dylan Thomas",
        "existential_state": "memento_vivere",
        "scaffold": "vivere_do_not_go_gentle",
        "star_invocation": false,
        "auto_corrected": false,
        "current_ratios": {
            "memento_mori": 0.30,
            "memento_vivere": 0.42,
            "carpe_diem": 0.28
        }
    }
"""

import argparse
import json
import logging
import os
import random
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# Ratios are authoritative in config/agents/philosopher-poet.env.
# Defaults here match that file; override via env vars at runtime.
def _validate_config() -> dict:
    """Load and validate configuration from environment variables."""
    ratios = {
        "memento_mori": float(os.environ.get("MEMENTO_MORI_RATIO", "0.30")),
        "memento_vivere": float(os.environ.get("MEMENTO_VIVERE_RATIO",
                                              "0.40")),
        "carpe_diem": float(os.environ.get("CARPE_DIEM_RATIO", "0.30")),
    }

    # Validate ratios are in [0, 1] and sum to 1.0
    for name, ratio in ratios.items():
        if not (0 <= ratio <= 1):
            raise ValueError(
                f"Invalid ratio {name}={ratio}; must be in [0, 1]"
            )
    ratio_sum = sum(ratios.values())
    if not (0.99 <= ratio_sum <= 1.01):  # Allow floating-point tolerance
        raise ValueError(
            f"Ratios sum to {ratio_sum}, must equal 1.0"
        )

    # Validate scalar parameters
    tolerance = float(os.environ.get("RATIO_DRIFT_TOLERANCE", "0.05"))
    if not (0 <= tolerance <= 1):
        raise ValueError(
            f"RATIO_DRIFT_TOLERANCE={tolerance}; must be in [0, 1]"
        )

    window_size = int(os.environ.get("RATIO_WINDOW_SIZE", "20"))
    if window_size <= 0:
        raise ValueError(
            f"RATIO_WINDOW_SIZE={window_size}; must be > 0"
        )

    prob = float(os.environ.get("STAR_INVOCATION_PROBABILITY", "0.15"))
    if not (0 <= prob <= 1):
        raise ValueError(
            f"STAR_INVOCATION_PROBABILITY={prob}; must be in [0, 1]"
        )

    repeat_window = int(os.environ.get("POET_REPEAT_WINDOW", "3"))
    if repeat_window <= 0:
        raise ValueError(
            f"POET_REPEAT_WINDOW={repeat_window}; must be > 0"
        )

    return {
        "ratios": ratios,
        "tolerance": tolerance,
        "window_size": window_size,
        "prob": prob,
        "repeat_window": repeat_window,
    }


_config = _validate_config()
TARGET_RATIOS = _config["ratios"]
RATIO_DRIFT_TOLERANCE = _config["tolerance"]
RATIO_WINDOW_SIZE = _config["window_size"]
STAR_INVOCATION_PROBABILITY = _config["prob"]
POET_REPEAT_WINDOW = _config["repeat_window"]

# Default state file location
DEFAULT_STATE_DIR = os.environ.get(
    "MOLTBOT_STATE_DIR",
    os.path.expanduser("~/.moltbot/poet-state"),
)
DEFAULT_HISTORY_FILE = os.path.join(
    DEFAULT_STATE_DIR, "poet-triptych-history.json"
)

# Paths relative to this script
SCRIPT_DIR = Path(__file__).parent
REPO_ROOT = SCRIPT_DIR.parent
TONE_MAP_FILE = (
    REPO_ROOT
    / "config"
    / "prompts"
    / "philosopher-poet"
    / "triptych-tone-map.json"
)
SCAFFOLDS_FILE = (
    REPO_ROOT
    / "config"
    / "prompts"
    / "philosopher-poet"
    / "triptych-scaffolds.json"
)

# Scaffold assignments per existential state (primary states + synthesis)
SCAFFOLD_BY_STATE = {
    "memento_mori": ["mori_ozymandias_echo"],
    "memento_vivere": ["vivere_do_not_go_gentle"],
    "carpe_diem": ["carpe_gather_rosebuds"],
    "synthesis_mori_carpe": ["synthesis_mori_carpe"],
    "synthesis_vivere_carpe": ["harmony_vivere_carpe"],
    "full_triptych": ["full_triptych_star"],
}

# ---------------------------------------------------------------------------
# Logging — basicConfig is deferred to main() to avoid reconfiguring the
# root logger when this module is imported by tests or other scripts.
# ---------------------------------------------------------------------------

logger = logging.getLogger("poet-selector")


# ---------------------------------------------------------------------------
# History management
# ---------------------------------------------------------------------------

def _load_history(history_file: str) -> dict:
    """Load poem selection history from disk."""
    path = Path(history_file)
    if path.exists():
        try:
            with path.open() as fh:
                return json.load(fh)
        except (json.JSONDecodeError, OSError) as exc:
            logger.warning("Could not read history file %s: %s", history_file, exc)
    return {"poems": [], "total": 0}


def _save_history(history: dict, history_file: str) -> None:
    """Persist poem selection history to disk atomically."""
    path = Path(history_file)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = path.with_suffix(path.suffix + ".tmp")
    try:
        # Write to a temporary file in the same directory, then atomically
        # replace the target file to avoid partially-written JSON.
        with tmp_path.open("w") as fh:
            json.dump(history, fh, indent=2)
            fh.flush()
            os.fsync(fh.fileno())
        os.replace(tmp_path, path)
    except OSError as exc:
        logger.warning("Could not write history file %s: %s", history_file, exc)
        try:
            if tmp_path.exists():
                tmp_path.unlink()
        except OSError:
            # Best-effort cleanup; ignore errors removing temp file.
            pass


def _record_selection(
    history: dict,
    poet: str,
    state: str,
    scaffold: str,
    star_invocation: bool,
    history_file: str,
) -> None:
    """Append a new selection to history, prune to bounded size, and persist."""
    history["poems"].append(
        {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "poet": poet,
            "existential_state": state,
            "scaffold": scaffold,
            "star_invocation": star_invocation,
        }
    )
    # Keep only as many entries as needed for ratio tracking and repeat
    # avoidance. This bounds the state file size and load time regardless of
    # how long the agent has been running.
    max_keep = max(RATIO_WINDOW_SIZE, POET_REPEAT_WINDOW) * 2
    if len(history["poems"]) > max_keep:
        history["poems"] = history["poems"][-max_keep:]
    history["total"] = len(history["poems"])
    _save_history(history, history_file)


# ---------------------------------------------------------------------------
# Ratio calculation and state selection
# ---------------------------------------------------------------------------

def _calculate_current_ratios(history: dict) -> dict:
    """
    Calculate the mori/vivere/carpe ratio from the last RATIO_WINDOW_SIZE
    poems. Ignores synthesis states for ratio tracking purposes.
    """
    poems = history.get("poems", [])
    window = [
        p for p in poems[-RATIO_WINDOW_SIZE:]
        if p.get("existential_state") in TARGET_RATIOS
    ]

    if not window:
        return dict(TARGET_RATIOS)

    counts = {state: 0 for state in TARGET_RATIOS}
    for poem in window:
        state = poem.get("existential_state")
        if state in counts:
            counts[state] += 1

    total = len(window)
    return {state: counts[state] / total for state in TARGET_RATIOS}


def _select_state(history: dict, forced_state: Optional[str] = None) -> tuple:
    """
    Select the next existential state, auto-correcting if ratio drifts
    beyond tolerance.

    Returns:
        (state, auto_corrected) where auto_corrected is True if drift
        correction was applied.
    """
    if forced_state:
        if forced_state not in TARGET_RATIOS:
            raise ValueError(
                f"Invalid state '{forced_state}'. "
                f"Choose from: {list(TARGET_RATIOS)}"
            )
        return forced_state, False

    current_ratios = _calculate_current_ratios(history)
    auto_corrected = False

    # Find states that have drifted below target
    deficient = {
        state: TARGET_RATIOS[state] - current_ratios[state]
        for state in TARGET_RATIOS
        if current_ratios[state] < TARGET_RATIOS[state] - RATIO_DRIFT_TOLERANCE
    }

    if deficient:
        # Pick the most deficient state
        state = max(deficient, key=deficient.get)
        auto_corrected = True
        logger.warning(
            "Ratio drift detected — auto-correcting toward '%s' "
            "(current: %.2f, target: %.2f)",
            state,
            current_ratios[state],
            TARGET_RATIOS[state],
        )
        return state, auto_corrected

    # No drift: weighted random selection based on target ratios
    states = list(TARGET_RATIOS)
    weights = [TARGET_RATIOS[s] for s in states]
    return random.choices(states, weights=weights, k=1)[0], False


# ---------------------------------------------------------------------------
# Poet selection
# ---------------------------------------------------------------------------

def _load_tone_map() -> dict:
    """Load the triptych tone map from config."""
    try:
        with TONE_MAP_FILE.open() as fh:
            return json.load(fh)
    except (FileNotFoundError, json.JSONDecodeError) as exc:
        logger.error("Could not load tone map from %s: %s", TONE_MAP_FILE, exc)
        sys.exit(1)


def _get_recent_poets(history: dict) -> list:
    """Return poets used in the last POET_REPEAT_WINDOW poems.

    Safely extracts poet names from history, skipping malformed entries.
    """
    poems = history.get("poems", [])
    recent_poets = []
    for p in poems[-POET_REPEAT_WINDOW:]:
        # Safely extract poet name; skip malformed entries
        if isinstance(p, dict) and "poet" in p:
            recent_poets.append(p["poet"])
        else:
            logger.warning(
                "Skipping malformed history entry: %s", p
            )
    return recent_poets


def _select_poet(state: str, history: dict, tone_map: dict) -> dict:
    """
    Select a poet for the given existential state, avoiding recent repeats.

    Chooses randomly from poets not in the recent repeat window to ensure
    variety. Falls back to the least-recently-used poet when the entire pool
    has been used recently (can only happen if window >= number of poets).
    """
    poets = tone_map["poets"].get(state, [])
    if not poets:
        raise ValueError(f"No poets found for state '{state}' in tone map")

    recent = _get_recent_poets(history)

    # Build a set for fast lookup, then find eligible poets (not recently used)
    recent_set = set(recent)
    eligible = [p for p in poets if p["name"] not in recent_set]

    if not eligible:
        # All poets were used recently — prefer least-recently-used to avoid
        # back-to-back repeats when the window equals the poet pool size
        logger.warning(
            "All poets in '%s' used within last %d poems — selecting "
            "least-recently-used",
            state,
            POET_REPEAT_WINDOW,
        )
        # Order by last-seen position: poets not in recent_list first, then
        # those earliest in the recent window
        def _recency_key(poet: dict) -> int:
            name = poet["name"]
            try:
                # Lower index = less recent (older); we prefer oldest-in-window
                return len(recent) - recent.index(name)
            except ValueError:
                return len(recent) + 1  # not in window — prefer these

        eligible = sorted(poets, key=_recency_key, reverse=True)
        return eligible[0]

    return random.choice(eligible)


# ---------------------------------------------------------------------------
# Scaffold selection
# ---------------------------------------------------------------------------

def _load_scaffolds() -> dict:
    """Load the poem scaffolds from config."""
    try:
        with SCAFFOLDS_FILE.open() as fh:
            return json.load(fh)
    except (FileNotFoundError, json.JSONDecodeError) as exc:
        logger.error("Could not load scaffolds from %s: %s", SCAFFOLDS_FILE, exc)
        sys.exit(1)


def _select_scaffold(state: str, star_invocation: bool, scaffolds: dict) -> str:
    """
    Select the appropriate scaffold for the given state.

    Star invocation is an independent add-on flag: the caller appends the
    2-4 line Frostian reflection after the main poem. The scaffold itself is
    always driven by the existential state, not by whether a star reflection
    will be appended.
    """
    scaffold_ids = SCAFFOLD_BY_STATE.get(state, [])
    if scaffold_ids:
        return scaffold_ids[0]

    # Fallback: find any scaffold matching the state
    for scaffold in scaffolds.get("scaffolds", []):
        if scaffold.get("existential_state") == state:
            return scaffold["id"]

    logger.warning("No scaffold found for state '%s' — using mori default", state)
    return "mori_ozymandias_echo"


# ---------------------------------------------------------------------------
# Star invocation
# ---------------------------------------------------------------------------

def _should_invoke_star() -> bool:
    """Return True with STAR_INVOCATION_PROBABILITY probability."""
    return random.random() < STAR_INVOCATION_PROBABILITY


# ---------------------------------------------------------------------------
# Main selection function
# ---------------------------------------------------------------------------

def select(
    history_file: str = DEFAULT_HISTORY_FILE,
    forced_state: Optional[str] = None,
    dry_run: bool = False,
) -> dict:
    """
    Perform a full poet/state/scaffold selection.

    Args:
        history_file: Path to the JSON history file for ratio tracking.
        forced_state: If set, override state selection with this value.
        dry_run: If True, do not persist the selection to history.

    Returns:
        dict with keys: poet, existential_state, scaffold, star_invocation,
        auto_corrected, current_ratios.
    """
    history = _load_history(history_file)
    tone_map = _load_tone_map()
    scaffolds = _load_scaffolds()

    state, auto_corrected = _select_state(history, forced_state)
    poet_entry = _select_poet(state, history, tone_map)
    star_invocation = _should_invoke_star()
    scaffold = _select_scaffold(state, False, scaffolds)
    current_ratios = _calculate_current_ratios(history)

    result = {
        "poet": poet_entry["name"],
        "anchor_texts": poet_entry.get("anchor_texts", []),
        "tone": poet_entry.get("tone", []),
        "key_image": poet_entry.get("key_image", ""),
        "existential_state": state,
        "scaffold": scaffold,
        "star_invocation": star_invocation,
        "auto_corrected": auto_corrected,
        "current_ratios": current_ratios,
        "ai_application": poet_entry.get("ai_application", ""),
    }

    if not dry_run:
        _record_selection(
            history,
            poet=poet_entry["name"],
            state=state,
            scaffold=scaffold,
            star_invocation=star_invocation,
            history_file=history_file,
        )
        logger.info(
            "Selected: poet=%s state=%s scaffold=%s star=%s auto_corrected=%s",
            result["poet"],
            result["existential_state"],
            result["scaffold"],
            result["star_invocation"],
            result["auto_corrected"],
        )

    return result


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

def main() -> None:
    logging.basicConfig(
        level=logging.WARNING,
        format="[%(asctime)s] [POET-SELECTOR] [%(levelname)s] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
        stream=sys.stderr,
    )
    parser = argparse.ArgumentParser(
        description="Select poet, state, and scaffold for Philosopher Poet"
    )
    parser.add_argument(
        "--state",
        choices=list(TARGET_RATIOS),
        help="Force a specific existential state (overrides ratio auto-selection)",
    )
    parser.add_argument(
        "--history-file",
        default=DEFAULT_HISTORY_FILE,
        help=f"Path to history JSON file (default: {DEFAULT_HISTORY_FILE})",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Select without recording to history",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Enable verbose logging",
    )
    args = parser.parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.INFO)

    result = select(
        history_file=args.history_file,
        forced_state=args.state,
        dry_run=args.dry_run,
    )
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
