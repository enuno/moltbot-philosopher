#!/usr/bin/env python3
"""
Noosphere v3.0 Recall Engine - Retrieves relevant heuristics for Council deliberation.
Migrated from v2.6 (JSON files) to v3.0 (PostgreSQL + REST API)
"""

import argparse
import os
import re
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

# Agent voice mapping (for backward compatibility with v2.6)
AGENT_VOICE_MAP = {
    "classical": "Classical",
    "existentialist": "Existentialist",
    "transcendentalist": "Transcendentalist",
    "joyce": "JoyceStream",
    "enlightenment": "Enlightenment",
    "beat": "BeatGeneration",
    "cyberpunk": "Cyberpunk",
    "satirist": "Satirist",
    "scientist": "Scientist",
}


def calculate_relevance(context: str, memory: Dict) -> float:
    """Calculate relevance score for a memory based on context.

    Args:
        context: Current deliberation context
        memory: Memory dict with content and tags

    Returns:
        Relevance score (0.0-1.0)
    """
    context_lower = context.lower()
    relevance = 0.0

    content = memory.get("content", "")
    if content:
        keywords = set(re.findall(r"\b\w+\b", content.lower()))
        context_words = set(re.findall(r"\b\w+\b", context_lower))

        # Jaccard similarity
        if keywords and context_words:
            intersection = keywords & context_words
            union = keywords | context_words
            relevance = len(intersection) / len(union)

    # Boost for tag matches
    tags = memory.get("tags", [])
    if tags:
        tag_words = set(" ".join(tags).lower().split())
        context_words = set(context_lower.split())
        tag_matches = len(tag_words & context_words)
        relevance += tag_matches * 0.1

    return min(relevance, 1.0)


def load_all_heuristics(
    client: NoosphereClient, voices: List[str] = None, min_confidence: float = 0.6
) -> List[Dict]:
    """Load and normalize all memories from Noosphere v3.0 API.

    Args:
        client: NoosphereClient instance
        voices: List of voice names to filter (or None for all)
        min_confidence: Minimum confidence threshold

    Returns:
        List of normalized heuristic dicts
    """
    heuristics = []

    # Determine which agents to query
    if voices and voices != ["all"]:
        # Map voice names to agent IDs
        agent_ids = []
        for voice in voices:
            for agent_id, voice_name in AGENT_VOICE_MAP.items():
                if voice_name == voice or agent_id == voice.lower():
                    agent_ids.append(agent_id)
                    break
    else:
        agent_ids = list(AGENT_VOICE_MAP.keys())

    # Query memories for each agent
    for agent_id in agent_ids:
        try:
            memories = client.query_memories(
                agent_id=agent_id,
                min_confidence=min_confidence,
                limit=200,  # Get all memories up to cap
            )

            voice = AGENT_VOICE_MAP.get(agent_id, agent_id.capitalize())

            for mem in memories:
                # Normalize to v2.6 format for backward compatibility
                heuristic = {
                    "heuristic_id": mem.id,
                    "formulation": mem.content[:500],  # Truncate long formulations
                    "voice": voice,
                    "confidence": float(mem.confidence),
                    "status": "canonical"
                    if mem.confidence >= 0.90
                    else "established"
                    if mem.confidence >= 0.75
                    else "provisional",
                    "signatures": mem.tags,
                    "markers": mem.tags,
                    "evidence": [],  # Not stored in v3.0 (in content_json if needed)
                    "category": mem.type,
                    "type": mem.type,  # Add v3.0 type
                    "agent_id": agent_id,  # Add agent_id for reference
                    "created_at": mem.created_at,
                    "original": mem,  # Keep original Memory object
                }
                heuristics.append(heuristic)

        except Exception as e:
            print(
                f"Warning: Failed to load memories for {agent_id}: {e}", file=sys.stderr
            )
            continue

    return heuristics


def format_dialectical(heuristics: List[Dict]) -> str:
    """Format heuristics in dialectical style with synthesis hints."""
    output = []
    output.append("=" * 60)
    output.append("NOOSPHERE RECALL: Relevant Memory Retrieved")
    output.append("=" * 60)
    output.append("")

    by_voice = {}
    for h in heuristics:
        voice = h.get("voice", "Unknown")
        if voice not in by_voice:
            by_voice[voice] = []
        by_voice[voice].append(h)

    for voice, voice_heuristics in by_voice.items():
        output.append(f"\n📌 {voice}")
        output.append("-" * 40)
        for h in voice_heuristics[:2]:  # Top 2 per voice
            hid = h.get("heuristic_id", "unknown")
            form = h.get("formulation", "")[:200]
            conf = h.get("confidence", 0)
            mem_type = h.get("type", "")
            output.append(f"  [{mem_type}] {hid[:8]}... (conf: {conf:.2f})")
            output.append(f"  → {form}...")
            output.append("")

    output.append("\n🎯 SYNTHESIS HINT")
    output.append("-" * 40)

    has_classical = any(h.get("voice") == "Classical" for h in heuristics)
    has_beat = any(h.get("voice") == "BeatGeneration" for h in heuristics)

    if has_classical and has_beat:
        output.append(
            "  Classical and BeatGeneration both engaged—richest synthesis potential."
        )
        output.append(
            "  Ensure BeatGeneration's dissent is fully articulated before converging."
        )
    else:
        output.append("  Consider which voices are silent in this recall.")
        output.append("  Missing perspectives may contain critical counter-arguments.")

    output.append("")
    output.append("=" * 60)

    return "\n".join(output)


def format_simple(heuristics: List[Dict]) -> str:
    """Simple list format."""
    output = ["Relevant Heuristics:"]
    for h in heuristics:
        mem_type = h.get("type", "")
        hid = h.get("heuristic_id", "unknown")[:8]
        form = h.get("formulation", "")[:150]
        output.append(f"- [{h.get('voice')}:{mem_type}] {hid}: {form}...")
    return "\n".join(output)


def format_constitutional(heuristics: List[Dict]) -> str:
    """Full provenance with evidence and contradictions."""
    output = []
    output.append("=" * 70)
    output.append("CONSTITUTIONAL MEMORY - FULL PROVENANCE")
    output.append("=" * 70)
    output.append("")

    for h in heuristics:
        output.append(f"ID: {h.get('heuristic_id')}")
        status = (h.get("status") or "provisional").upper()
        mem_type = h.get("type", "unknown")
        output.append(f"Voice: {h.get('voice')} | Type: {mem_type} | Status: {status}")
        output.append(f"Confidence: {h.get('confidence'):.3f}")
        output.append(f"Created: {h.get('created_at', 'unknown')}")
        output.append("")
        output.append("Formulation:")
        output.append(f"  {h.get('formulation', '')}")
        output.append("")

        tags = h.get("signatures", [])
        if tags:
            output.append(f"Tags: {', '.join(tags[:10])}")
            output.append("")

        output.append("-" * 70)
        output.append("")

    return "\n".join(output)


def format_hybrid(heuristics: List[Dict]) -> str:
    """Combined vector/text search results with match type."""
    output = []
    output.append("=" * 60)
    output.append("HYBRID SEARCH RESULTS (Vector + Text)")
    output.append("=" * 60)
    output.append("")

    for idx, h in enumerate(heuristics, 1):
        mem_type = h.get("type", "unknown")
        conf = h.get("confidence", 0)
        rel = h.get("relevance", 0)
        output.append(
            f"{idx}. [{h.get('voice')}:{mem_type}] (conf: {conf:.2f}, rel: {rel:.2f})"
        )
        output.append(f"   {h.get('formulation', '')[:150]}...")
        output.append("")

    return "\n".join(output)


def main():
    parser = argparse.ArgumentParser(
        description="Retrieve relevant heuristics from Noosphere v3.0"
    )
    parser.add_argument(
        "--context", required=True, help="Current deliberation context/proposal"
    )
    parser.add_argument(
        "--voices",
        default="all",
        help='Comma-separated list of voices to include (or "all")',
    )
    parser.add_argument(
        "--min-confidence", type=float, default=0.6, help="Minimum confidence threshold"
    )
    parser.add_argument(
        "--format",
        choices=["dialectical", "simple", "constitutional", "hybrid"],
        default="dialectical",
        help="Output format",
    )
    parser.add_argument(
        "--max-results", type=int, default=12, help="Maximum heuristics to return"
    )
    parser.add_argument(
        "--api-url", default="http://noosphere-service:3006", help="Noosphere API URL"
    )

    args = parser.parse_args()

    # Initialize Noosphere client
    try:
        client = NoosphereClient(
            api_url=args.api_url, api_key=os.environ.get("MOLTBOOK_API_KEY")
        )
    except Exception as e:
        print(f"ERROR: Failed to initialize Noosphere client: {e}", file=sys.stderr)
        return 1

    # Parse voice filter
    voices = (
        None if args.voices == "all" else [v.strip() for v in args.voices.split(",")]
    )

    # Load all heuristics
    try:
        all_heuristics = load_all_heuristics(client, voices, args.min_confidence)
    except Exception as e:
        print(f"ERROR: Failed to load heuristics: {e}", file=sys.stderr)
        return 1

    if not all_heuristics:
        print("No heuristics found matching criteria", file=sys.stderr)
        return 1

    # Calculate relevance scores
    for h in all_heuristics:
        h["relevance"] = calculate_relevance(args.context, h)

    # Sort by relevance
    all_heuristics.sort(key=lambda x: x.get("relevance", 0), reverse=True)
    top_heuristics = all_heuristics[: args.max_results]

    # Format handlers
    format_handlers = {
        "dialectical": format_dialectical,
        "simple": format_simple,
        "constitutional": format_constitutional,
        "hybrid": format_hybrid,
    }

    if args.format not in format_handlers:
        print(f"ERROR: Unknown format: {args.format}", file=sys.stderr)
        print(f"Available: {', '.join(format_handlers.keys())}", file=sys.stderr)
        return 1

    formatter = format_handlers[args.format]
    print(formatter(top_heuristics))

    return 0


if __name__ == "__main__":
    sys.exit(main())
