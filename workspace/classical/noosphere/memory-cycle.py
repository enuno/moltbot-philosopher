#!/usr/bin/env python3
"""
Noosphere Memory-Cycle Management
Tri-Layer Memory consolidation and promotion system

Consolidates daily notes → establishes heuristics → promotes to constitutional archive
"""

import argparse
import json
import logging
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict

NOOSPHERE_DIR = Path("/workspace/classical/noosphere")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


class MemoryCycle:
    """Manages tri-layer memory consolidation and promotion."""

    def __init__(self, noosphere_dir: Path = NOOSPHERE_DIR):
        """Initialize memory cycle manager."""
        self.noosphere_dir = noosphere_dir
        self.memory_core = noosphere_dir / "memory-core"
        self.layer_1 = self.memory_core / "daily-notes"
        self.layer_2 = self.memory_core / "consolidated"
        self.layer_3 = self.memory_core / "archival"
        self.state_file = noosphere_dir / "memory-state.json"

        self._ensure_directories()
        self._load_state()

    def _ensure_directories(self):
        """Create necessary directories if they don't exist."""
        for directory in [self.layer_1, self.layer_2, self.layer_3]:
            directory.mkdir(parents=True, exist_ok=True)
        logger.info(f"✓ Memory directories ready at {self.memory_core}")

    def _load_state(self):
        """Load memory state from file."""
        if self.state_file.exists():
            try:
                with open(self.state_file) as f:
                    self.state = json.load(f)
                logger.info("✓ Loaded memory state")
            except Exception as e:
                logger.warning(f"Could not load state file: {e}")
                self.state = self._initialize_state()
        else:
            self.state = self._initialize_state()

    def _initialize_state(self) -> Dict:
        """Create fresh memory state."""
        return {
            "version": "2.5",
            "last_consolidation": None,
            "last_promotion": None,
            "layers": {
                "layer_1": {"entries": 0, "last_updated": None},
                "layer_2": {"entries": 0, "last_updated": None},
                "layer_3": {"entries": 0, "last_updated": None},
            },
            "metrics": {
                "total_heuristics": 0,
                "canonical_heuristics": 0,
                "community_derived": 0,
                "consolidation_lag_hours": 0,
            },
        }

    def _save_state(self):
        """Persist memory state to file."""
        try:
            with open(self.state_file, "w") as f:
                json.dump(self.state, f, indent=2)
            logger.info(f"✓ Saved memory state to {self.state_file.name}")
        except Exception as e:
            logger.error(f"Failed to save state: {e}")

    def consolidate(self, batch_size: int = 100) -> int:
        """Consolidate Layer 1 (daily notes) → Layer 2 (consolidated heuristics).

        Process daily notes and extract patterns that appear multiple times.
        Establish consolidated heuristics with improved confidence scoring.

        Returns: Number of heuristics consolidated
        """
        logger.info("=" * 60)
        logger.info("CONSOLIDATION: Layer 1 → Layer 2")
        logger.info("=" * 60)

        # Find all daily note files
        note_files = list(self.layer_1.glob("*.json"))
        logger.info(f"Found {len(note_files)} daily note files")

        if not note_files:
            logger.info("No daily notes to consolidate")
            return 0

        # Load all notes
        all_notes = []
        for note_file in note_files:
            try:
                with open(note_file) as f:
                    note = json.load(f)
                    all_notes.append(note)
            except Exception as e:
                logger.warning(f"Could not load {note_file.name}: {e}")

        # Extract patterns (heuristics that appear in multiple notes)
        heuristic_frequency = {}
        for note in all_notes:
            for heuristic in note.get("extracted_heuristics", []):
                hid = heuristic.get("heuristic_id")
                if hid not in heuristic_frequency:
                    heuristic_frequency[hid] = {
                        "count": 0,
                        "heuristic": heuristic,
                        "sources": [],
                    }
                heuristic_frequency[hid]["count"] += 1
                heuristic_frequency[hid]["sources"].append(note.get("date", "unknown"))

        # Consolidate: Keep heuristics appearing 2+ times
        consolidated = []
        for hid, data in heuristic_frequency.items():
            if data["count"] >= 2:
                h = data["heuristic"].copy()
                # Boost confidence based on frequency
                original_conf = h.get("confidence", 0.5)
                frequency_boost = min(0.2, data["count"] * 0.05)
                h["confidence"] = min(1.0, original_conf + frequency_boost)
                h["consolidated_from"] = data["sources"]
                h["consolidation_date"] = datetime.now().isoformat()
                h["status"] = "consolidated"
                consolidated.append(h)

        # Save consolidated heuristics
        if consolidated:
            consolidated_file = self.layer_2 / "index.json"
            consolidated_data = {
                "heuristics": consolidated,
                "consolidated_at": datetime.now().isoformat(),
            }
            try:
                with open(consolidated_file, "w") as f:
                    json.dump(consolidated_data, f, indent=2)
                logger.info(f"✓ Consolidated {len(consolidated)} heuristics")
                self.state["last_consolidation"] = datetime.now().isoformat()
                self.state["layers"]["layer_2"]["entries"] = len(consolidated)
                self.state["layers"]["layer_2"]["last_updated"] = (
                    datetime.now().isoformat()
                )
                self._save_state()
            except Exception as e:
                logger.error(f"Failed to save consolidated heuristics: {e}")

        return len(consolidated)

    def promote(
        self,
        heuristic_id: str,
        min_confidence: float = 0.92,
        force: bool = False,
    ) -> bool:
        """Promote a heuristic from Layer 2 → Layer 3 (constitutional archive).

        Requires high confidence and explicit promotion request.
        Creates git-style history entry.

        Returns: True if successful
        """
        logger.info("=" * 60)
        logger.info(f"PROMOTION: {heuristic_id} → Constitutional Archive")
        logger.info("=" * 60)

        # Load from Layer 2
        consolidated_file = self.layer_2 / "index.json"
        if not consolidated_file.exists():
            logger.error("No consolidated heuristics found in Layer 2")
            return False

        try:
            with open(consolidated_file) as f:
                consolidated_data = json.load(f)
        except Exception as e:
            logger.error(f"Could not load Layer 2 data: {e}")
            return False

        # Find heuristic to promote
        heuristic_to_promote = None
        for h in consolidated_data.get("heuristics", []):
            if h.get("heuristic_id") == heuristic_id:
                heuristic_to_promote = h
                break

        if not heuristic_to_promote:
            logger.error(f"Heuristic {heuristic_id} not found in Layer 2")
            return False

        # Check confidence
        confidence = heuristic_to_promote.get("confidence", 0)
        if confidence < min_confidence and not force:
            logger.error(
                f"Confidence {confidence:.2f} below threshold {min_confidence} "
                f"(use --force to override)"
            )
            return False

        # Promote to constitutional archive
        archival_dir = self.layer_3 / "constitutional-memories"
        archival_dir.mkdir(parents=True, exist_ok=True)

        promoted = heuristic_to_promote.copy()
        promoted["status"] = "constitutional"
        promoted["promoted_at"] = datetime.now().isoformat()
        promoted["promotion_confidence"] = confidence

        # Save with unique filename
        archive_file = (
            archival_dir / f"{heuristic_id}-{datetime.now().isoformat()[:10]}.json"
        )
        try:
            with open(archive_file, "w") as f:
                json.dump(promoted, f, indent=2)
            logger.info("✓ Promoted to constitutional archive")

            # Update git history
            git_history_dir = self.layer_3 / "git-history"
            git_history_dir.mkdir(parents=True, exist_ok=True)
            git_log = {
                "heuristic_id": heuristic_id,
                "promoted_at": datetime.now().isoformat(),
                "promotion_confidence": confidence,
                "archive_location": str(archive_file),
                "message": f"PROMOTE: {heuristic_id} → constitutional memory",
            }
            git_file = git_history_dir / f"{heuristic_id}-promotion.json"
            with open(git_file, "w") as f:
                json.dump(git_log, f, indent=2)

            self.state["last_promotion"] = datetime.now().isoformat()
            self.state["layers"]["layer_3"]["entries"] = len(
                list(archival_dir.glob("*.json"))
            )
            self.state["metrics"]["canonical_heuristics"] += 1
            self._save_state()

            return True
        except Exception as e:
            logger.error(f"Failed to promote heuristic: {e}")
            return False

    def get_stats(self) -> Dict:
        """Get memory statistics across all layers.

        Returns: Dictionary with comprehensive memory metrics
        """
        logger.info("=" * 60)
        logger.info("MEMORY STATISTICS")
        logger.info("=" * 60)

        # Count entries in each layer
        layer_1_count = len(list(self.layer_1.glob("*.json")))
        layer_2_count = (
            len(list(self.layer_2.glob("*.json"))) if self.layer_2.exists() else 0
        )
        layer_3_count = (
            len(list(self.layer_3.glob("**/*.json"))) if self.layer_3.exists() else 0
        )

        # Load main heuristic files for stats
        main_files_count = 0
        canonical_count = 0
        community_count = 0
        memory_core = NOOSPHERE_DIR / "memory-core"

        for heuristic_file in memory_core.glob("*.json"):
            try:
                with open(heuristic_file) as f:
                    data = json.load(f)
                    heuristics = data.get("heuristics", [])
                    main_files_count += len(heuristics)
                    canonical_count += len(
                        [h for h in heuristics if h.get("status") == "canonical"]
                    )
                    community_count += len(
                        [
                            h
                            for h in heuristics
                            if h.get("status") == "community-derived"
                        ]
                    )
            except (FileNotFoundError, json.JSONDecodeError):
                pass

        stats = {
            "timestamp": datetime.now().isoformat(),
            "memory_layers": {
                "layer_1_daily_notes": layer_1_count,
                "layer_2_consolidated": layer_2_count,
                "layer_3_constitutional": layer_3_count,
            },
            "heuristic_count": {
                "total": main_files_count,
                "canonical": canonical_count,
                "community_derived": community_count,
                "provisional": main_files_count - canonical_count - community_count,
            },
            "memory_health": {
                "consolidation_lag_days": (
                    (
                        datetime.now()
                        - datetime.fromisoformat(
                            self.state.get(
                                "last_consolidation", datetime.now().isoformat()
                            )
                        )
                    ).days
                    if self.state.get("last_consolidation")
                    else 0
                ),
                "last_consolidation": self.state.get("last_consolidation"),
                "last_promotion": self.state.get("last_promotion"),
            },
            "voice_distribution": self._get_voice_distribution(),
        }

        # Log stats
        logger.info(f"Layer 1 (Daily Notes): {layer_1_count}")
        logger.info(f"Layer 2 (Consolidated): {layer_2_count}")
        logger.info(f"Layer 3 (Constitutional): {layer_3_count}")
        logger.info(f"Total Heuristics: {main_files_count}")
        logger.info(f"  Canonical: {canonical_count}")
        logger.info(f"  Community-Derived: {community_count}")
        logger.info(
            f"  Provisional: {main_files_count - canonical_count - community_count}"
        )

        return stats

    def _get_voice_distribution(self) -> Dict[str, int]:
        """Get distribution of heuristics by voice."""
        voices = {}
        memory_core = NOOSPHERE_DIR / "memory-core"

        voice_files = {
            "Classical": "telos-alignment-heuristics.json",
            "Existentialist": "bad-faith-patterns.json",
            "Transcendentalist": "sovereignty-warnings.json",
            "JoyceStream": "phenomenological-touchstones.json",
            "Enlightenment": "rights-precedents.json",
            "BeatGeneration": "moloch-detections/archive.json",
        }

        for voice, filename in voice_files.items():
            file_path = memory_core / filename
            try:
                if file_path.exists():
                    with open(file_path) as f:
                        data = json.load(f)
                        count = len(
                            data.get("heuristics", data.get("moloch_types", []))
                        )
                        voices[voice] = count
            except (FileNotFoundError, json.JSONDecodeError):
                voices[voice] = 0

        return voices


def main():
    parser = argparse.ArgumentParser(
        description="Noosphere Memory-Cycle Management - Consolidation and Promotion"
    )
    parser.add_argument(
        "--action",
        choices=["consolidate", "promote", "stats"],
        required=True,
        help="Action to perform",
    )
    parser.add_argument(
        "--memory-id",
        help="Heuristic ID for promotion action",
    )
    parser.add_argument(
        "--min-confidence",
        type=float,
        default=0.92,
        help="Minimum confidence for promotion (default: 0.92)",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Force promotion even if below confidence threshold",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=100,
        help="Batch size for consolidation (default: 100)",
    )
    parser.add_argument(
        "--format",
        choices=["json", "text"],
        default="text",
        help="Output format for stats",
    )

    args = parser.parse_args()

    try:
        memory_cycle = MemoryCycle()

        if args.action == "consolidate":
            count = memory_cycle.consolidate(batch_size=args.batch_size)
            print(f"\nConsolidation complete: {count} heuristics consolidated")
            return 0

        elif args.action == "promote":
            if not args.memory_id:
                logger.error("--memory-id required for promote action")
                return 1
            success = memory_cycle.promote(
                args.memory_id,
                min_confidence=args.min_confidence,
                force=args.force,
            )
            return 0 if success else 1

        elif args.action == "stats":
            stats = memory_cycle.get_stats()
            if args.format == "json":
                print(json.dumps(stats, indent=2))
            else:
                print("\nMemory Health Report")
                print("=" * 60)
                for layer, count in stats["memory_layers"].items():
                    print(f"{layer}: {count}")
                print()
                for htype, count in stats["heuristic_count"].items():
                    print(f"{htype}: {count}")
                print()
                print("Voice Distribution:")
                for voice, count in stats["voice_distribution"].items():
                    print(f"  {voice}: {count}")
            return 0

    except Exception as e:
        logger.error(f"Error: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
