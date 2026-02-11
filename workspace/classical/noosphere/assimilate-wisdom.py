#!/usr/bin/env python3
"""
Noosphere v3.0 Community Wisdom Assimilation Pipeline
Migrated from v2.6 JSON file-based storage to PostgreSQL API

Key Changes:
- Extracts heuristics from dropbox submissions (unchanged)
- Persists to PostgreSQL via NoosphereClient (new)
- Maps voices to agent_id + memory type
- No longer writes to JSON files
"""

import argparse
import hashlib
import json
import logging
import os
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

# Add python-client to path
CLIENT_DIR = Path(__file__).parent.parent.parent / "services" / "noosphere" / "python-client"
sys.path.insert(0, str(CLIENT_DIR))

try:
    from noosphere_client import NoosphereClient, MemoryType
except ModuleNotFoundError:
    import site
    site.addsitedir(str(CLIENT_DIR))
    from noosphere_client import NoosphereClient, MemoryType

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

DROPBOX_DIR = Path("/workspace/classical/dropbox")

# Map philosophical voices to agent_id
VOICE_TO_AGENT = {
    "Classical": "classical",
    "Existentialist": "existentialist",
    "Transcendentalist": "transcendentalist",
    "JoyceStream": "joyce",
    "Enlightenment": "enlightenment",
    "BeatGeneration": "beat",
    "Cyberpunk": "cyberpunk",
    "Satirist": "satirist",
    "Scientist": "scientist"
}

# Voice detection keywords (unchanged from v2.6)
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
    "Cyberpunk": [
        "posthuman",
        "cyborg",
        "simulation",
        "corporate",
        "dystopian",
        "augmented"
    ],
    "Satirist": [
        "absurd",
        "ironic",
        "paradox",
        "catch-22",
        "bureaucratic",
        "satire"
    ],
    "Scientist": [
        "empirical",
        "testable",
        "falsifiable",
        "evidence",
        "hypothesis",
        "observation"
    ]
}


def load_submission(path: Path) -> Optional[Dict]:
    """Load submission file with frontmatter parsing."""
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
                except (ValueError, IndexError):
                    body = content

        return {
            "path": str(path),
            "filename": path.name,
            "frontmatter": frontmatter,
            "body": body,
            "content": content,
        }
    except Exception as e:
        logger.error(f"Could not load {path}: {e}")
        return None


def detect_voice_resonance(submission: Dict) -> Dict[str, float]:
    """Detect which philosophical voices resonate with submission content."""
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
    """Extract prescriptive ethical principle from text."""
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
    """Check if principle is consistent with core Treatise values."""
    principle_lower = principle.lower()

    # Known contradictions with core Treatise (from failure archives)
    # Require exact phrase matching to avoid false positives
    hard_contradictions = [
        "humans should have no veto",
        "ai should be completely autonomous",
        "humans are mere tools",
        "humans are merely tools",
        "eliminate human oversight",
        "no human intervention"
    ]

    for contradiction in hard_contradictions:
        if contradiction in principle_lower:
            logger.warning(f"Principle contradicts Treatise: {principle[:80]}...")
            return False

    return True


def generate_heuristic_id(submission: Dict) -> str:
    """Generate stable ID from submission content."""
    content_hash = hashlib.md5(submission["content"].encode()).hexdigest()[:8]
    return f"community-{content_hash}"


def create_memory_from_submission(
    submission: Dict,
    voice_alignment: Dict[str, float],
    client: NoosphereClient
) -> Optional[Dict]:
    """Create a Noosphere v3.0 memory from submission.
    
    Returns:
        Memory creation result dict or None
    """
    # Extract principle
    principle = extract_ontological_commitment(submission["body"])
    if not principle:
        logger.debug(f"No principle extracted from {submission['filename']}")
        return None

    # Check Treatise consistency
    if not consistent_with_treatise(principle):
        return None

    # Find primary voice (highest resonance)
    if not voice_alignment:
        logger.debug(f"No voice resonance for {submission['filename']}")
        return None
    
    primary_voice, resonance_score = max(voice_alignment.items(), key=lambda x: x[1])
    
    # Map voice to agent_id
    agent_id = VOICE_TO_AGENT.get(primary_voice)
    if not agent_id:
        logger.warning(f"Unknown voice: {primary_voice}")
        return None
    
    # Determine memory type based on content characteristics
    # Default to "lesson" for community submissions (practical wisdom)
    memory_type = MemoryType.LESSON
    
    # If submission explicitly mentions patterns → pattern
    if "pattern" in submission["body"].lower():
        memory_type = MemoryType.PATTERN
    # If submission is strategic recommendation → strategy
    elif any(word in submission["body"].lower() for word in ["strategy", "approach", "method"]):
        memory_type = MemoryType.STRATEGY
    # If submission is philosophical insight → insight
    elif any(word in submission["body"].lower() for word in ["insight", "understanding", "realize"]):
        memory_type = MemoryType.INSIGHT
    
    # Generate stable ID for source tracing
    source_trace_id = generate_heuristic_id(submission)
    
    # Create tags from voice resonance and submission metadata
    tags = [
        "community-derived",
        f"source:{submission['filename']}",
        f"voice:{primary_voice}"
    ]
    
    # Add high-resonance voices as tags
    for voice, score in voice_alignment.items():
        if score >= 0.1:
            tags.append(f"resonance:{voice.lower()}")
    
    # Prepare content_json with metadata
    content_json = {
        "submission_filename": submission["filename"],
        "voice_resonance": voice_alignment,
        "primary_voice": primary_voice,
        "derived_from": f"Dropbox submission: {submission['filename']}",
        "extraction_date": datetime.now().isoformat()
    }
    
    # Create memory via API
    try:
        memory = client.create_memory(
            agent_id=agent_id,
            type=memory_type,
            content=principle,
            content_json=content_json,
            confidence=0.50,  # Community submissions start provisional
            tags=tags,
            source_trace_id=source_trace_id
        )
        
        logger.info(f"✓ Created memory {memory.id[:8]} for {agent_id}/{memory_type}")
        logger.info(f"  Content: {principle[:80]}...")
        
        return {
            "memory_id": memory.id,
            "agent_id": agent_id,
            "type": memory_type.value,
            "content": principle,
            "voice_resonance": voice_alignment,
            "primary_voice": primary_voice,
            "confidence": memory.confidence,
            "source": submission["filename"]
        }
    
    except Exception as e:
        logger.error(f"Failed to create memory: {e}")
        return None


def assimilate_submission(
    submission: Dict,
    client: NoosphereClient,
    dry_run: bool = False,
    min_resonance: float = 0.05
) -> Optional[Dict]:
    """Assimilate submission into Noosphere v3.0.
    
    Accepts submissions if:
    - Single voice has strong resonance (>= 0.1), OR
    - Multiple voices have combined resonance (>= 0.25)
    """
    voice_alignment = detect_voice_resonance(submission)

    total_resonance = sum(voice_alignment.values())
    max_resonance = max(voice_alignment.values()) if voice_alignment else 0

    # Accept if either condition met
    if max_resonance < 0.1 and total_resonance < 0.25:
        logger.debug(f"Insufficient resonance for {submission['filename']} "
                    f"(max: {max_resonance:.2f}, total: {total_resonance:.2f})")
        return None

    if dry_run:
        # Return what would be created (without API call)
        principle = extract_ontological_commitment(submission["body"])
        if not principle or not consistent_with_treatise(principle):
            return None
        
        primary_voice = max(voice_alignment.items(), key=lambda x: x[1])[0]
        agent_id = VOICE_TO_AGENT.get(primary_voice, "unknown")
        
        return {
            "heuristic_id": generate_heuristic_id(submission),
            "formulation": principle,
            "source": submission["filename"],
            "voice_resonance": voice_alignment,
            "primary_voice": primary_voice,
            "agent_id": agent_id,
            "confidence": 0.5,
            "status": "community-derived (dry-run)",
        }

    return create_memory_from_submission(submission, voice_alignment, client)


def main():
    parser = argparse.ArgumentParser(
        description="Assimilate community wisdom into Noosphere v3.0"
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
        help="Show what would be assimilated without modifying database",
    )
    parser.add_argument(
        "--min-resonance",
        type=float,
        default=0.05,
        help="Minimum voice resonance threshold (default: 0.05)",
    )
    parser.add_argument(
        "--since",
        help="Only process submissions since this date (ISO format)"
    )
    parser.add_argument(
        "--api-url",
        default="http://noosphere-service:3006",
        help="Noosphere API URL"
    )
    parser.add_argument(
        "--format",
        choices=["json", "text"],
        default="text",
        help="Output format"
    )

    args = parser.parse_args()

    # Initialize client (unless dry-run)
    client = None
    if not args.dry_run:
        try:
            client = NoosphereClient(
                api_url=args.api_url,
                api_key=os.environ.get('MOLTBOOK_API_KEY')
            )
            logger.info(f"✓ Connected to Noosphere v3.0 API at {args.api_url}")
        except Exception as e:
            logger.error(f"Failed to connect to API: {e}")
            return 1

    assimilated = []

    # Process single submission
    if args.submission_path:
        submission_path = Path(args.submission_path)
        if not submission_path.exists():
            logger.error(f"Submission file not found: {submission_path}")
            return 1

        submission = load_submission(submission_path)
        if not submission:
            logger.error(f"Could not load submission: {submission_path}")
            return 1

        result = assimilate_submission(submission, client, args.dry_run, args.min_resonance)
        if result:
            assimilated.append(result)
    else:
        # Process directory of submissions
        approved_dir = Path(args.approved_dir)

        if not approved_dir.exists():
            logger.error(f"Directory not found: {approved_dir}")
            return 1

        if not approved_dir.is_dir():
            logger.error(f"Not a directory: {approved_dir}")
            return 1

        # Count and process files
        files = list(approved_dir.glob("*.md"))
        if not files:
            logger.warning(f"No .md files found in {approved_dir}")
            if not args.dry_run:
                return 1

        logger.info(f"Processing {len(files)} submissions from {approved_dir}")
        
        for sub_file in files:
            submission = load_submission(sub_file)
            if submission:
                result = assimilate_submission(
                    submission, client, args.dry_run, args.min_resonance
                )
                if result:
                    assimilated.append(result)

    # Output results
    if args.format == "json":
        result_json = {
            "assimilated_count": len(assimilated),
            "dry_run": args.dry_run,
            "memories": assimilated,
        }
        print(json.dumps(result_json, indent=2))
    else:
        print("\nAssimilation Results")
        print("=" * 60)
        print(f"Mode: {'DRY RUN' if args.dry_run else 'LIVE'}")
        print(f"Assimilated: {len(assimilated)} memories")
        
        if assimilated:
            print("\nCreated Memories:")
            for mem in assimilated:
                agent = mem.get('agent_id', mem.get('primary_voice'))
                mem_type = mem.get('type', 'unknown')
                content = mem.get('content', mem.get('formulation', ''))[:80]
                print(f"  • {agent}/{mem_type}: {content}...")

    return 0 if assimilated or args.dry_run else 1


if __name__ == "__main__":
    sys.exit(main())
