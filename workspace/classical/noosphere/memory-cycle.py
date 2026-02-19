#!/usr/bin/env python3
"""
Noosphere v3.0 Memory-Cycle Management
Migrated from v2.6 tri-layer system to PostgreSQL unified storage

Key Changes:
- Consolidation is automatic (no layer 1→2 migration needed)
- Promotion = boost confidence to constitutional level (≥0.92)
- Eviction = capacity management (200-cap enforcement)
- Stats = query PostgreSQL via NoosphereClient
"""

import argparse
import json
import logging
import os
import sys
from pathlib import Path
from typing import Dict, List

# Add python-client to path
# NOOSPHERE_PYTHON_CLIENT env var is set by docker-compose;
# fall back to sibling python-client/ for local dev
_client_env = os.environ.get("NOOSPHERE_PYTHON_CLIENT")
CLIENT_DIR = (
    Path(_client_env) if _client_env else Path(__file__).parent / "python-client"
)
sys.path.insert(0, str(CLIENT_DIR))

from noosphere_client import NoosphereClient  # noqa: E402

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


class MemoryCycleV3:
    """Manages memory operations in Noosphere v3.0 (PostgreSQL-based)."""

    def __init__(self, api_url: str = "http://noosphere-service:3006"):
        """Initialize memory cycle manager."""
        self.client = NoosphereClient(
            api_url=api_url, api_key=os.environ.get("MOLTBOOK_API_KEY")
        )
        logger.info(f"✓ Connected to Noosphere v3.0 API at {api_url}")

    def promote(
        self, memory_id: str, target_confidence: float = 0.92, force: bool = False
    ) -> bool:
        """Promote a memory to constitutional status by boosting confidence.

        Args:
            memory_id: Memory UUID to promote
            target_confidence: Target confidence level (default: 0.92 for DKG)
            force: Force promotion even if already at target

        Returns:
            True if successful
        """
        logger.info("=" * 60)
        logger.info(f"PROMOTION: {memory_id} → Constitutional Status")
        logger.info("=" * 60)

        try:
            # Get current memory
            memory = self.client.get_memory(memory_id)
            current_confidence = memory.confidence

            agent_type = f"{memory.agent_id}/{memory.type}"
            logger.info(f"Current: {agent_type} (conf: {current_confidence:.2f})")
            logger.info(f"Content: {memory.content[:100]}...")

            # Check if already at target
            if current_confidence >= target_confidence and not force:
                logger.info(
                    f"✓ Already at constitutional level "
                    f"({current_confidence:.2f} ≥ {target_confidence})"
                )
                return True

            # Update confidence
            updated = self.client.update_memory(
                memory_id,
                confidence=target_confidence,
                tags=list(set(memory.tags + ["constitutional", "promoted"])),
            )

            logger.info(
                f"✓ Promoted: {current_confidence:.2f} → {updated.confidence:.2f}"
            )
            logger.info(f"✓ Tags updated: {updated.tags}")

            return True

        except Exception as e:
            logger.error(f"Failed to promote memory: {e}")
            return False

    def evict(
        self, agent_id: str, count: int = 1, strategy: str = "oldest"
    ) -> List[str]:
        """Evict memories from an agent (capacity management).

        Args:
            agent_id: Agent identifier
            count: Number of memories to evict
            strategy: Eviction strategy (oldest, lowest-confidence)

        Returns:
            List of evicted memory IDs
        """
        logger.info("=" * 60)
        logger.info(f"EVICTION: {agent_id} ({strategy} strategy)")
        logger.info("=" * 60)

        try:
            # Get agent stats
            stats = self.client.get_agent_stats(agent_id)
            logger.info(f"Current capacity: {stats.memory_count}/200")

            if stats.memory_count < 180:
                logger.info("✓ Capacity healthy (<90%), no eviction needed")
                return []

            # Get candidates based on strategy
            if strategy == "oldest":
                candidates = self.client.query_memories(
                    agent_id=agent_id, limit=count, sort="created_at", order="ASC"
                )
            elif strategy == "lowest-confidence":
                candidates = self.client.query_memories(
                    agent_id=agent_id, limit=count, sort="confidence", order="ASC"
                )
            else:
                logger.error(f"Unknown strategy: {strategy}")
                return []

            # Evict memories
            evicted_ids = []
            for mem in candidates:
                # Don't evict constitutional memories
                if mem.confidence >= 0.92:
                    logger.info(
                        f"⏭️  Skipping constitutional memory "
                        f"{mem.id[:8]} (conf: {mem.confidence})"
                    )
                    continue

                try:
                    self.client.delete_memory(mem.id)
                    evicted_ids.append(mem.id)
                    logger.info(
                        f"✓ Evicted: {mem.id[:8]} "
                        f"(conf: {mem.confidence:.2f}, type: {mem.type})"
                    )
                except Exception as e:
                    logger.error(f"Failed to evict {mem.id}: {e}")

            # Update stats
            new_stats = self.client.get_agent_stats(agent_id)
            logger.info(f"✓ New capacity: {new_stats.memory_count}/200")

            return evicted_ids

        except Exception as e:
            logger.error(f"Eviction failed: {e}")
            return []

    def get_stats(self, agent_id: str = None) -> Dict:
        """Get memory statistics.

        Args:
            agent_id: Optional agent to filter (or None for all)

        Returns:
            Dictionary with comprehensive memory metrics
        """
        logger.info("=" * 60)
        logger.info("MEMORY STATISTICS")
        logger.info("=" * 60)

        try:
            if agent_id:
                # Single agent stats
                stats = self.client.get_agent_stats(agent_id)
                return {
                    "agent_id": stats.agent_id,
                    "total_memories": stats.memory_count,
                    "capacity_used": (
                        f"{stats.memory_count}/200 "
                        f"({stats.memory_count / 200 * 100:.1f}%)"
                    ),
                    "by_type": {
                        "insights": stats.insights_count,
                        "patterns": stats.patterns_count,
                        "strategies": stats.strategies_count,
                        "preferences": stats.preferences_count,
                        "lessons": stats.lessons_count,
                    },
                    "last_eviction": stats.last_eviction,
                    "updated_at": stats.updated_at,
                }
            else:
                # All agents stats
                all_stats = self.client.get_all_stats()

                # Aggregate metrics
                total_memories = sum(s.memory_count for s in all_stats)
                total_capacity = len(all_stats) * 200

                by_agent = {}
                for s in all_stats:
                    if s.memory_count > 0:  # Only include agents with memories
                        by_agent[s.agent_id] = {
                            "count": s.memory_count,
                            "capacity": f"{s.memory_count/200*100:.1f}%",
                            "insights": s.insights_count,
                            "patterns": s.patterns_count,
                            "strategies": s.strategies_count,
                            "preferences": s.preferences_count,
                            "lessons": s.lessons_count,
                        }

                return {
                    "total_memories": total_memories,
                    "total_capacity": (
                        f"{total_memories}/{total_capacity} "
                        f"({total_memories / total_capacity * 100:.1f}%)"
                    ),
                    "agents_with_memories": len(by_agent),
                    "by_agent": by_agent,
                }

        except Exception as e:
            logger.error(f"Failed to get stats: {e}")
            return {"error": str(e)}

    def consolidate_deprecated(self):
        """Consolidation is deprecated in v3.0 (automatic via PostgreSQL)."""
        logger.warning("=" * 60)
        logger.warning("CONSOLIDATION DEPRECATED IN v3.0")
        logger.warning("=" * 60)
        logger.warning("In Noosphere v3.0, consolidation is handled automatically:")
        logger.warning("- Daily notes → Direct API creation (no Layer 1)")
        logger.warning("- Consolidated heuristics → PostgreSQL memories (unified)")
        logger.warning("- Constitutional archive → High-confidence memories (≥0.92)")
        logger.warning("")
        logger.warning(
            "Use --action promote to boost confidence to constitutional level"
        )
        logger.warning("Use --action stats to view current memory distribution")
        return 0


def main():
    parser = argparse.ArgumentParser(
        description="Noosphere v3.0 Memory-Cycle Management"
    )
    parser.add_argument(
        "--action",
        choices=["consolidate", "promote", "evict", "stats"],
        required=True,
        help="Action to perform",
    )
    parser.add_argument("--memory-id", help="Memory UUID for promotion action")
    parser.add_argument("--agent-id", help="Agent ID for eviction or stats")
    parser.add_argument(
        "--min-confidence",
        type=float,
        default=0.92,
        help="Target confidence for promotion (default: 0.92 for DKG)",
    )
    parser.add_argument(
        "--force", action="store_true", help="Force promotion even if already at target"
    )
    parser.add_argument(
        "--count", type=int, default=5, help="Number of memories to evict (default: 5)"
    )
    parser.add_argument(
        "--eviction-strategy",
        choices=["oldest", "lowest-confidence"],
        default="oldest",
        help="Eviction strategy (default: oldest)",
    )
    parser.add_argument(
        "--format",
        choices=["json", "text"],
        default="text",
        help="Output format for stats",
    )
    parser.add_argument(
        "--api-url", default="http://noosphere-service:3006", help="Noosphere API URL"
    )

    args = parser.parse_args()

    try:
        memory_cycle = MemoryCycleV3(api_url=args.api_url)

        if args.action == "consolidate":
            # Deprecated in v3.0
            return memory_cycle.consolidate_deprecated()

        elif args.action == "promote":
            if not args.memory_id:
                logger.error("--memory-id required for promote action")
                return 1
            success = memory_cycle.promote(
                args.memory_id, target_confidence=args.min_confidence, force=args.force
            )
            return 0 if success else 1

        elif args.action == "evict":
            if not args.agent_id:
                logger.error("--agent-id required for evict action")
                return 1
            evicted = memory_cycle.evict(
                args.agent_id, count=args.count, strategy=args.eviction_strategy
            )
            print(f"\nEviction complete: {len(evicted)} memories evicted")
            return 0

        elif args.action == "stats":
            stats = memory_cycle.get_stats(agent_id=args.agent_id)

            if args.format == "json":
                print(json.dumps(stats, indent=2))
            else:
                print("\nNoosphere v3.0 Memory Health Report")
                print("=" * 60)

                if args.agent_id:
                    # Single agent
                    print(f"Agent: {stats['agent_id']}")
                    print(f"Total Memories: {stats['total_memories']}")
                    print(f"Capacity: {stats['capacity_used']}")
                    print("\nBy Type:")
                    for mem_type, count in stats["by_type"].items():
                        print(f"  {mem_type:12s}: {count:3d}")
                else:
                    # All agents
                    print(f"Total Memories: {stats['total_memories']}")
                    print(f"Total Capacity: {stats['total_capacity']}")
                    print(f"Agents with Memories: {stats['agents_with_memories']}/9")
                    print("\nBy Agent:")
                    for agent, agent_stats in stats["by_agent"].items():
                        print(f"\n  {agent}:")
                        cnt = agent_stats["count"]
                        cap = agent_stats["capacity"]
                        print(f"    Count: {cnt} ({cap})")
                        i = agent_stats["insights"]
                        p = agent_stats["patterns"]
                        s = agent_stats["strategies"]
                        pr = agent_stats["preferences"]
                        le = agent_stats["lessons"]
                        print(f"    Types: I:{i} P:{p} S:{s} Pr:{pr} L:{le}")

            return 0

    except Exception as e:
        logger.error(f"Error: {e}")
        import traceback

        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
