#!/usr/bin/env python3
"""
Community Wisdom Assimilation Pipeline - Extracts heuristics from approved dropbox submissions.
"""

import argparse
import json
import os
import sys
import re
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional
import hashlib

NOOSPHERE_DIR = Path("/workspace/classical/noosphere")
DROPBOX_DIR = Path("/workspace/classical/dropbox")

VOICE_KEYWORDS = {
    "Classical": ["virtue", "telos", "flourishing", "eudaimonia", "excellence", "character", "arete"],
    "Existentialist": ["authenticity", "bad faith", "freedom", "responsibility", "angst", "choice", "agency"],
    "Transcendentalist": ["sovereignty", "self-reliance", "autonomy", "democratic", "consent", "individual"],
    "JoyceStream": ["experience", "feeling", "phenomenological", "consciousness", "lived", "embodied", "somatic"],
    "Enlightenment": ["rights", "justice", "fairness", "liberty", "equality", "contract", "consent"],
    "BeatGeneration": ["control", "system", "moloch", "resist", "corporate", "commercial", "exploitation"]
}

def load_submission(path: Path) -> Optional[Dict]:
    try:
        with open(path, 'r') as f:
            content = f.read()
        
        frontmatter = {}
        body = content
        if content.startswith('---'):
            parts = content.split('---', 2)
            if len(parts) >= 3:
                try:
                    for line in parts[1].strip().split('\n'):
                        if ':' in line:
                            key, value = line.split(':', 1)
                            frontmatter[key.strip()] = value.strip().strip('"').strip("'")
                    body = parts[2].strip()
                except:
                    body = content
        
        return {"path": str(path), "filename": path.name, "frontmatter": frontmatter, "body": body, "content": content}
    except Exception as e:
        print(f"Error loading {path}: {e}", file=sys.stderr)
        return None

def detect_voice_resonance(submission: Dict) -> Dict[str, float]:
    body_lower = submission.get('body', '').lower()
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
        r'(?:should|must|ought to|need to) ([^.]+)',
        r'(?:requires?|demands?|necessitates?) ([^.]+)',
        r'(?:the|a) (?:principle|rule|guideline) (?:is|that) ([^.]+)',
        r'(?:we|ai systems|humans) (?:should|must) ([^.]+)',
    ]
    
    commitments = []
    for pattern in prescriptive_patterns:
        matches = re.findall(pattern, text, re.IGNORECASE)
        commitments.extend(matches)
    
    if commitments:
        return max(commitments, key=len).strip()
    
    return None

def consistent_with_treatise(principle: str) -> bool:
    principle_lower = principle.lower()
    contradictions = [
        ("humans should have no veto", ["veto", "human"]),
        ("ai should be completely autonomous", ["complete autonomy", "no oversight"]),
    ]
    
    for _, contradiction_keywords in contradictions:
        if any(kw in principle_lower for kw in contradiction_keywords):
            return False
    
    return True

def generate_heuristic_id(submission: Dict) -> str:
    content_hash = hashlib.md5(submission['content'].encode()).hexdigest()[:8]
    return f"community-{content_hash}"

def create_provisional_heuristic(submission: Dict, voice_alignment: Dict[str, float]) -> Optional[Dict]:
    principle = extract_ontological_commitment(submission['body'])
    if not principle:
        return None
    
    if not consistent_with_treatise(principle):
        return None
    
    primary_voice = max(voice_alignment.items(), key=lambda x: x[1])
    
    return {
        "heuristic_id": generate_heuristic_id(submission),
        "formulation": principle,
        "source": submission['filename'],
        "voice_resonance": voice_alignment,
        "primary_voice": primary_voice[0],
        "confidence": 0.5,
        "status": "community-derived",
        "derived_from": f"Dropbox submission: {submission['filename']}",
        "last_validated": datetime.now().isoformat(),
        "evidence": [submission['filename']],
        "contradictions": []
    }

def assimilate_submission(submission: Dict, dry_run: bool = False) -> Optional[Dict]:
    voice_alignment = detect_voice_resonance(submission)
    
    if max(voice_alignment.values()) < 0.1:
        return None
    
    heuristic = create_provisional_heuristic(submission, voice_alignment)
    if not heuristic:
        return None
    
    if dry_run:
        return heuristic
    
    return heuristic

def main():
    parser = argparse.ArgumentParser(description='Assimilate community wisdom into Noosphere')
    parser.add_argument('--submission-path', help='Path to specific submission file')
    parser.add_argument('--approved-dir', default=str(DROPBOX_DIR / "approved" / "raw"), help='Directory of approved submissions')
    parser.add_argument('--dry-run', action='store_true', help='Show what would be assimilated without modifying files')
    parser.add_argument('--since', help='Only process submissions since this date (ISO format)')
    
    args = parser.parse_args()
    
    assimilated = []
    
    if args.submission_path:
        submission = load_submission(Path(args.submission_path))
        if submission:
            heuristic = assimilate_submission(submission, args.dry_run)
            if heuristic:
                assimilated.append(heuristic)
    else:
        approved_dir = Path(args.approved_dir)
        if approved_dir.exists():
            for sub_file in approved_dir.glob('*.md'):
                submission = load_submission(sub_file)
                if submission:
                    heuristic = assimilate_submission(submission, args.dry_run)
                    if heuristic:
                        assimilated.append(heuristic)
    
    result = {
        "assimilated_count": len(assimilated),
        "dry_run": args.dry_run,
        "heuristics": assimilated
    }
    
    print(json.dumps(result, indent=2))
    
    return 0 if assimilated else 1

if __name__ == '__main__':
    sys.exit(main())
