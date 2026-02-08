#!/usr/bin/env python3
"""
Community Wisdom Assimilation Pipeline - Extracts heuristics from approved dropbox submissions.
"""

import argparse
import hashlib
import json
import os
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

NOOSPHERE_DIR = Path("/workspace/classical/noosphere")
DROPBOX_DIR = Path("/workspace/classical/dropbox")

VOICE_KEYWORDS = {
    "Classical": [
        "virtue",
        "telos",
        "flourishing",
        "eudaimonia",
        "excellence",
        "character",
        "arete",
    ],
    "Existentialist": [
        "authenticity",
        "bad faith",
        "freedom",
        "responsibility",
        "angst",
        "choice",
        "agency",
    ],
    "Transcendentalist": [
        "sovereignty",
        "self-reliance",
        "autonomy",
        "democratic",
        "consent",
        "individual",
    ],
    "JoyceStream": [
        "experience",
        "feeling",
        "phenomenological",
        "consciousness",
        "lived",
        "embodied",
        "somatic",
    ],
    "Enlightenment": [
        "rights",
        "justice",
        "fairness",
        "liberty",
        "equality",
        "contract",
        "consent",
    ],
    "BeatGeneration": [
        "control",
        "system",
        "moloch",
        "resist",
        "corporate",
        "commercial",
        "exploitation",
    ],
}


def load_submission(path: Path) -> Optional[Dict]:
    try:
        with open(path, "r") as f:
            content = f.read()

        frontmatter = {}
        body = content
        if content.startswith("---"):
            parts = content.split("---", 2)
            if len(parts) >= 3:
                try:
                    for line in parts[1].strip().split("\n"):
                        if ":" in line:
                            key, value = line.split(":", 1)
                            frontmatter[key.strip()] = (
                                value.strip().strip('"').strip("'")
                            )
                    body = parts[2].strip()
                except:
                    body = content

        return {
            "path": str(path),
            "filename": path.name,
            "frontmatter": frontmatter,
            "body": body,
            "content": content,
        }
    except Exception as e:
        print(f"Error loading {path}: {e}", file=sys.stderr)
        return None


def detect_voice_resonance(submission: Dict) -> Dict[str, float]:
    body_lower = submission.get("body", "").lower()
    scores = {}

    for voice, keywords in VOICE_KEYWORDS.items():
        score = 0
        for keyword in keywords:
            count = body_lower.count(keyword.lower())
            score += count
        scores[voice] = min(score / max(len(keywords), 1), 1.0)

    return scores


def extract_ontological_commitment(text: str) -> Optional[str]:
    prescriptive_patterns = [
        r"(?:should|must|ought to|need to) ([^.]+)",
        r"(?:requires?|demands?|necessitates?) ([^.]+)",
        r"(?:the|a) (?:principle|rule|guideline) (?:is|that) ([^.]+)",
        r"(?:we|ai systems|humans) (?:should|must) ([^.]+)",
    ]

    commitments = []
    for pattern in prescriptive_patterns:
        matches = re.findall(pattern, text, re.IGNORECASE)
        commitments.extend(matches)

    if commitments:
        return max(commitments, key=len).strip()

    return None


def consistent_with_treatise(principle: str) -> bool:
    """Check if principle is consistent with known Treatise principles.

    Returns False if principle contradicts core Treatise values.
    Returns True if principle is acceptable.
    """
    principle_lower = principle.lower()

    # Known contradictions with core Treatise (from failure archives & guardrails)
    hard_contradictions = [
        ("humans should have no veto", ["veto", "human"]),
        ("ai should be completely autonomous", ["complete autonomy", "no oversight"]),
        ("humans are mere tools", ["tool", "resource", "utility"]),
    ]

    for _, contradiction_keywords in hard_contradictions:
        if any(kw in principle_lower for kw in contradiction_keywords):
            return False

    return True


def validate_against_heuristic_corpus(
    principle: str, heuristic_corpus: List[Dict]
) -> Dict[str, any]:
    """Check if principle contradicts or duplicates existing heuristics.

    Returns validation dict with:
    - is_novel: bool
    - contradicts: list of heuristic IDs
    - similar_to: list of {id, similarity_score}
    - warnings: list of warning messages
    """
    validation = {
        "is_novel": True,
        "contradicts": [],
        "similar_to": [],
        "warnings": [],
    }

    principle_lower = principle.lower()
    principle_words = set(principle_lower.split())

    for h in heuristic_corpus:
        form_lower = h.get("formulation", "").lower()
        form_words = set(form_lower.split())

        # Check for high semantic similarity
        if principle_words and form_words:
            similarity = len(principle_words & form_words) / len(
                principle_words | form_words
            )

            if similarity > 0.7:
                validation["is_novel"] = False
                validation["similar_to"].append(
                    {"id": h.get("heuristic_id"), "similarity": similarity}
                )

        # Check explicit contradictions field
        if h.get("heuristic_id") in principle_lower:
            validation["contradicts"].append(h.get("heuristic_id"))

    if not validation["is_novel"] and len(validation["similar_to"]) > 0:
        best_match = max(validation["similar_to"], key=lambda x: x["similarity"])
        validation["warnings"].append(
            f"Very similar to {best_match['id']} (similarity: {best_match['similarity']:.2f})"
        )

    return validation


def generate_heuristic_id(submission: Dict) -> str:
    content_hash = hashlib.md5(submission["content"].encode()).hexdigest()[:8]
    return f"community-{content_hash}"


def save_heuristics_to_memory(
    heuristics: List[Dict], output_dir: Optional[str] = None
) -> bool:
    """Save assimilated heuristics to voice-specific memory-core files.

    Returns True if successful, False otherwise.
    """
    if not heuristics:
        return True

    output_dir = Path(output_dir or NOOSPHERE_DIR / "memory-core")
    if not output_dir.exists():
        print(f"ERROR: Output directory not found: {output_dir}", file=sys.stderr)
        return False

    # Map voices to files
    voice_files = {
        "Classical": "telos-alignment-heuristics.json",
        "Existentialist": "bad-faith-patterns.json",
        "Transcendentalist": "sovereignty-warnings.json",
        "JoyceStream": "phenomenological-touchstones.json",
        "Enlightenment": "rights-precedents.json",
        "BeatGeneration": "moloch-detections/archive.json",
    }

    # Group heuristics by voice
    by_voice = {}
    for h in heuristics:
        voice = h.get("primary_voice", "Unknown")
        if voice not in by_voice:
            by_voice[voice] = []
        by_voice[voice].append(h)

    saved_count = 0
    for voice, voice_heuristics in by_voice.items():
        if voice not in voice_files:
            print(f"WARNING: No file mapping for voice '{voice}'", file=sys.stderr)
            continue

        file_path = output_dir / voice_files[voice]

        # Load existing heuristics
        try:
            with open(file_path) as f:
                existing_data = json.load(f)
        except FileNotFoundError:
            print(f"ERROR: File not found: {file_path}", file=sys.stderr)
            continue
        except json.JSONDecodeError as e:
            print(f"ERROR: Invalid JSON in {file_path}: {e}", file=sys.stderr)
            continue

        # Append new heuristics
        if "heuristics" not in existing_data:
            existing_data["heuristics"] = []

        existing_data["heuristics"].extend(voice_heuristics)

        # Write back
        try:
            with open(file_path, "w") as f:
                json.dump(existing_data, f, indent=2)
            saved_count += len(voice_heuristics)
            print(
                f"✓ Saved {len(voice_heuristics)} heuristics to {file_path.name}",
                file=sys.stderr,
            )
        except IOError as e:
            print(f"ERROR: Could not write {file_path}: {e}", file=sys.stderr)
            return False

    return True


def create_provisional_heuristic(
    submission: Dict, voice_alignment: Dict[str, float]
) -> Optional[Dict]:
    principle = extract_ontological_commitment(submission["body"])
    if not principle:
        return None

    if not consistent_with_treatise(principle):
        return None

    primary_voice = max(voice_alignment.items(), key=lambda x: x[1])

    return {
        "heuristic_id": generate_heuristic_id(submission),
        "formulation": principle,
        "source": submission["filename"],
        "voice_resonance": voice_alignment,
        "primary_voice": primary_voice[0],
        "confidence": 0.5,
        "status": "community-derived",
        "derived_from": f"Dropbox submission: {submission['filename']}",
        "last_validated": datetime.now().isoformat(),
        "evidence": [submission["filename"]],
        "contradictions": [],
    }


def assimilate_submission(
    submission: Dict, dry_run: bool = False, min_resonance: float = 0.05
) -> Optional[Dict]:
    """Assimilate submission with configurable resonance threshold.

    Accepts submissions if:
    - Single voice has strong resonance (>= 0.1), OR
    - Multiple voices have combined resonance (>= 0.25)
    """
    voice_alignment = detect_voice_resonance(submission)

    total_resonance = sum(voice_alignment.values())
    max_resonance = max(voice_alignment.values()) if voice_alignment else 0

    # Accept if either condition met
    if max_resonance < 0.1 and total_resonance < 0.25:
        return None

    heuristic = create_provisional_heuristic(submission, voice_alignment)
    if not heuristic:
        return None

    if dry_run:
        return heuristic

    return heuristic


def main():
    parser = argparse.ArgumentParser(
        description="Assimilate community wisdom into Noosphere"
    )
    parser.add_argument("--submission-path", help="Path to specific submission file")
    parser.add_argument(
        "--approved-dir",
        default=str(DROPBOX_DIR / "approved" / "raw"),
        help="Directory of approved submissions",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be assimilated without modifying files",
    )
    parser.add_argument(
        "--output-dir",
        help="Directory to save heuristics (default: memory-core)",
        default=None,
    )
    parser.add_argument(
        "--min-resonance",
        type=float,
        default=0.05,
        help="Minimum voice resonance threshold (default: 0.05)",
    )
    parser.add_argument(
        "--since", help="Only process submissions since this date (ISO format)"
    )

    args = parser.parse_args()

    assimilated = []

    # Process single submission
    if args.submission_path:
        submission_path = Path(args.submission_path)
        if not submission_path.exists():
            print(
                f"ERROR: Submission file not found: {submission_path}", file=sys.stderr
            )
            return 1

        submission = load_submission(submission_path)
        if not submission:
            print(
                f"ERROR: Could not load submission: {submission_path}", file=sys.stderr
            )
            return 1

        heuristic = assimilate_submission(submission, args.dry_run, args.min_resonance)
        if heuristic:
            assimilated.append(heuristic)
    else:
        # Process directory of submissions
        approved_dir = Path(args.approved_dir)

        if not approved_dir.exists():
            print(f"ERROR: Directory not found: {approved_dir}", file=sys.stderr)
            print(f"Expected: {approved_dir}", file=sys.stderr)
            return 1

        if not approved_dir.is_dir():
            print(f"ERROR: Not a directory: {approved_dir}", file=sys.stderr)
            return 1

        # Count and process files
        files = list(approved_dir.glob("*.md"))
        if not files:
            print(f"WARNING: No .md files found in {approved_dir}", file=sys.stderr)
            if not args.dry_run:
                return 1

        for sub_file in files:
            submission = load_submission(sub_file)
            if submission:
                heuristic = assimilate_submission(
                    submission, args.dry_run, args.min_resonance
                )
                if heuristic:
                    assimilated.append(heuristic)

    result = {
        "assimilated_count": len(assimilated),
        "dry_run": args.dry_run,
        "heuristics": assimilated,
    }

    print(json.dumps(result, indent=2))

    # Persist to files if not dry-run
    if assimilated and not args.dry_run:
        output_dir = args.output_dir or str(NOOSPHERE_DIR / "memory-core")
        if save_heuristics_to_memory(assimilated, output_dir):
            print(
                f"✓ Persisted {len(assimilated)} heuristics to memory-core",
                file=sys.stderr,
            )
        else:
            print(f"✗ Failed to persist heuristics", file=sys.stderr)
            return 1

    return 0 if assimilated or args.dry_run else 1


if __name__ == "__main__":
    sys.exit(main())
