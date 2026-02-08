#!/usr/bin/env python3
"""
Noosphere Recall Engine - Retrieves relevant heuristics for Council deliberation.
"""

import argparse
import json
import os
import re
import sys
from pathlib import Path
from typing import Any, Dict, List

NOOSPHERE_DIR = Path("/workspace/classical/noosphere")


def normalize_heuristic(h: Dict, voice: str, category: str = "") -> Dict:
    """Normalize heuristics to standard field names across different JSON sources.

    Handles varying field name conventions across different heuristic strains.
    """
    # ID field mapping by category
    id_fields = {
        "rights": ["case_id", "heuristic_id", "id"],
        "moloch": ["type_id", "heuristic_id", "id"],
        "default": ["heuristic_id", "id", "case_id", "type_id"],
    }

    id_candidates = id_fields.get(category, id_fields["default"])
    heuristic_id = next((h.get(f) for f in id_candidates if h.get(f)), "unknown")

    # Formulation field mapping
    form_candidates = [
        "formulation",
        "description",
        "ruling",
        "name",
        "signature",
        "pattern",
    ]
    formulation = next((h.get(f) for f in form_candidates if h.get(f)), "")

    # Signature field mapping
    sig_candidates = ["signatures", "markers", "indicators", "keywords"]
    signatures = next((h.get(f) for f in sig_candidates if h.get(f)), [])
    if isinstance(signatures, str):
        signatures = [signatures]
    elif not isinstance(signatures, list):
        signatures = []

    # Normalized heuristic with standard fields
    return {
        "heuristic_id": str(heuristic_id),
        "formulation": str(formulation)[:500],  # Truncate long formulations
        "voice": voice,
        "confidence": float(h.get("confidence", 0.5)),
        "status": str(h.get("status", "provisional")),
        "signatures": signatures,
        "markers": h.get("markers", []),
        "evidence": h.get("evidence", h.get("referenced_in", [])),
        "category": category,
        "original": h,  # Keep original for reference
    }


def load_json_file(path: Path) -> Dict:
    try:
        with open(path, "r") as f:
            return json.load(f)
    except Exception:
        return {}


def calculate_relevance(context: str, heuristic: Dict) -> float:
    context_lower = context.lower()
    relevance = 0.0

    formulation = heuristic.get("formulation", "")
    if formulation:
        keywords = set(re.findall(r"\b\w+\b", formulation.lower()))
        context_words = set(re.findall(r"\b\w+\b", context_lower))
        overlap = len(keywords & context_words)
        relevance += (overlap / max(len(keywords), 1)) * 0.4

    signatures = heuristic.get("signatures", []) or heuristic.get("indicators", [])
    for sig in signatures:
        if any(word in context_lower for word in sig.lower().split()):
            relevance += 0.1

    markers = heuristic.get("markers", [])
    for marker in markers:
        if any(word in context_lower for word in marker.lower().split()):
            relevance += 0.05

    return min(relevance, 1.0)


def load_all_heuristics() -> List[Dict]:
    """Load and normalize all heuristics from memory-core files."""
    heuristics = []
    memory_core = NOOSPHERE_DIR / "memory-core"
    moloch_dir = NOOSPHERE_DIR / "moloch-detections"
    meta_dir = NOOSPHERE_DIR / "meta-cognitive"

    # Load telos heuristics
    telos_data = load_json_file(memory_core / "telos-alignment-heuristics.json")
    for h in telos_data.get("heuristics", []):
        heuristics.append(normalize_heuristic(h, "Classical", "telos"))

    # Load bad-faith heuristics
    badfaith_data = load_json_file(memory_core / "bad-faith-patterns.json")
    for h in badfaith_data.get("heuristics", []):
        heuristics.append(normalize_heuristic(h, "Existentialist", "badfaith"))

    # Load sovereignty heuristics
    sov_data = load_json_file(memory_core / "sovereignty-warnings.json")
    for h in sov_data.get("heuristics", []):
        heuristics.append(normalize_heuristic(h, "Transcendentalist", "sovereignty"))

    # Load phenomenological heuristics
    phenom_data = load_json_file(memory_core / "phenomenological-touchstones.json")
    for h in phenom_data.get("heuristics", []):
        heuristics.append(normalize_heuristic(h, "JoyceStream", "phenomenological"))

    # Load rights precedents with signature extraction
    rights_data = load_json_file(memory_core / "rights-precedents.json")
    for p in rights_data.get("precedent_corpus", []):
        h = normalize_heuristic(p, "Enlightenment", "rights")
        # Extract keywords from scenario/ruling for better relevance matching
        scenario = p.get("scenario", "")
        ruling = p.get("ruling", "")
        text_for_keywords = f"{scenario} {ruling}".lower()
        keywords = [w for w in text_for_keywords.split() if len(w) > 3]
        h["signatures"] = keywords[:10]  # Top 10 keywords
        heuristics.append(h)

    # Load Moloch detections
    moloch_data = load_json_file(moloch_dir / "archive.json")
    for m in moloch_data.get("moloch_types", []):
        heuristics.append(normalize_heuristic(m, "BeatGeneration", "moloch"))

    # Load meta-cognitive heuristics
    meta_data = load_json_file(meta_dir / "synthesis-efficiency-patterns.json")
    for h in meta_data.get("heuristics", []):
        heuristics.append(normalize_heuristic(h, "Meta-Cognitive", "meta"))

    return heuristics


def format_dialectical(heuristics: List[Dict]) -> str:
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
        for h in voice_heuristics[:2]:
            hid = h.get("heuristic_id", "unknown")
            form = h.get("formulation", "")[:200]
            conf = h.get("confidence", 0)
            output.append(f"  [{hid}] (conf: {conf:.2f})")
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
    output = ["Relevant Heuristics:"]
    for h in heuristics:
        output.append(
            f"- [{h.get('voice')}] {h.get('heuristic_id')}: {h.get('formulation', '')[:150]}..."
        )
    return "\n".join(output)


def main():
    parser = argparse.ArgumentParser(
        description="Retrieve relevant heuristics from Noosphere"
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
        choices=["dialectical", "simple"],
        default="dialectical",
        help="Output format",
    )
    parser.add_argument(
        "--max-results", type=int, default=12, help="Maximum heuristics to return"
    )

    args = parser.parse_args()

    all_heuristics = load_all_heuristics()
    filtered = [
        h for h in all_heuristics if h.get("confidence", 0) >= args.min_confidence
    ]

    if args.voices != "all":
        voice_list = [v.strip() for v in args.voices.split(",")]
        filtered = [h for h in filtered if h.get("voice") in voice_list]

    for h in filtered:
        h["relevance"] = calculate_relevance(args.context, h)

    filtered.sort(key=lambda x: x.get("relevance", 0), reverse=True)
    top_heuristics = filtered[: args.max_results]

    if args.format == "dialectical":
        print(format_dialectical(top_heuristics))
    else:
        print(format_simple(top_heuristics))

    return 0


if __name__ == "__main__":
    sys.exit(main())
