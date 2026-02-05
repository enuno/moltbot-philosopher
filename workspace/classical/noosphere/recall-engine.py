#!/usr/bin/env python3
"""
Noosphere Recall Engine - Retrieves relevant heuristics for Council deliberation.
"""

import argparse
import json
import os
import sys
from pathlib import Path
from typing import List, Dict, Any
import re

NOOSPHERE_DIR = Path("/workspace/classical/noosphere")

def load_json_file(path: Path) -> Dict:
    try:
        with open(path, 'r') as f:
            return json.load(f)
    except Exception:
        return {}

def calculate_relevance(context: str, heuristic: Dict) -> float:
    context_lower = context.lower()
    relevance = 0.0
    
    formulation = heuristic.get('formulation', '')
    if formulation:
        keywords = set(re.findall(r'\b\w+\b', formulation.lower()))
        context_words = set(re.findall(r'\b\w+\b', context_lower))
        overlap = len(keywords & context_words)
        relevance += (overlap / max(len(keywords), 1)) * 0.4
    
    signatures = heuristic.get('signatures', []) or heuristic.get('indicators', [])
    for sig in signatures:
        if any(word in context_lower for word in sig.lower().split()):
            relevance += 0.1
    
    markers = heuristic.get('markers', [])
    for marker in markers:
        if any(word in context_lower for word in marker.lower().split()):
            relevance += 0.05
    
    return min(relevance, 1.0)

def load_all_heuristics() -> List[Dict]:
    heuristics = []
    memory_core = NOOSPHERE_DIR / "memory-core"
    moloch_dir = NOOSPHERE_DIR / "moloch-detections"
    meta_dir = NOOSPHERE_DIR / "meta-cognitive"
    
    # Load telos heuristics
    telos_data = load_json_file(memory_core / "telos-alignment-heuristics.json")
    for h in telos_data.get('heuristics', []):
        h['voice'] = 'Classical'
        h['category'] = 'telos'
        heuristics.append(h)
    
    # Load bad-faith heuristics
    badfaith_data = load_json_file(memory_core / "bad-faith-patterns.json")
    for h in badfaith_data.get('heuristics', []):
        h['voice'] = 'Existentialist'
        h['category'] = 'badfaith'
        heuristics.append(h)
    
    # Load sovereignty heuristics
    sov_data = load_json_file(memory_core / "sovereignty-warnings.json")
    for h in sov_data.get('heuristics', []):
        h['voice'] = 'Transcendentalist'
        h['category'] = 'sovereignty'
        h['heuristic_id'] = h.get('id', 'unknown')
        h['formulation'] = h.get('description', '')
        h['confidence'] = h.get('confidence', 0.5)
        heuristics.append(h)
    
    # Load phenomenological heuristics
    phenom_data = load_json_file(memory_core / "phenomenological-touchstones.json")
    for h in phenom_data.get('heuristics', []):
        h['voice'] = 'JoyceStream'
        h['category'] = 'phenomenological'
        heuristics.append(h)
    
    # Load rights precedents
    rights_data = load_json_file(memory_core / "rights-precedents.json")
    for p in rights_data.get('precedent_corpus', []):
        h = {
            'heuristic_id': p.get('case_id', 'unknown'),
            'formulation': f"{p.get('scenario', '')}: {p.get('ruling', '')}",
            'voice': 'Enlightenment',
            'category': 'rights',
            'confidence': p.get('confidence', 0.5),
            'status': p.get('weight', 'provisional')
        }
        heuristics.append(h)
    
    # Load Moloch detections
    moloch_data = load_json_file(moloch_dir / "archive.json")
    for m in moloch_data.get('moloch_types', []):
        h = {
            'heuristic_id': m.get('type_id', 'unknown'),
            'formulation': f"{m.get('name', '')}: {m.get('signature', '')}",
            'voice': 'BeatGeneration',
            'category': 'moloch',
            'confidence': m.get('confidence', 0.5),
            'signatures': m.get('markers', []),
            'status': m.get('status', 'provisional')
        }
        heuristics.append(h)
    
    # Load meta-cognitive heuristics
    meta_data = load_json_file(meta_dir / "synthesis-efficiency-patterns.json")
    for h in meta_data.get('heuristics', []):
        h['voice'] = 'Meta-Cognitive'
        h['category'] = 'meta'
        heuristics.append(h)
    
    return heuristics

def format_dialectical(heuristics: List[Dict]) -> str:
    output = []
    output.append("=" * 60)
    output.append("NOOSPHERE RECALL: Relevant Memory Retrieved")
    output.append("=" * 60)
    output.append("")
    
    by_voice = {}
    for h in heuristics:
        voice = h.get('voice', 'Unknown')
        if voice not in by_voice:
            by_voice[voice] = []
        by_voice[voice].append(h)
    
    for voice, voice_heuristics in by_voice.items():
        output.append(f"\n📌 {voice}")
        output.append("-" * 40)
        for h in voice_heuristics[:2]:
            hid = h.get('heuristic_id', 'unknown')
            form = h.get('formulation', '')[:200]
            conf = h.get('confidence', 0)
            output.append(f"  [{hid}] (conf: {conf:.2f})")
            output.append(f"  → {form}...")
            output.append("")
    
    output.append("\n🎯 SYNTHESIS HINT")
    output.append("-" * 40)
    
    has_classical = any(h.get('voice') == 'Classical' for h in heuristics)
    has_beat = any(h.get('voice') == 'BeatGeneration' for h in heuristics)
    
    if has_classical and has_beat:
        output.append("  Classical and BeatGeneration both engaged—richest synthesis potential.")
        output.append("  Ensure BeatGeneration's dissent is fully articulated before converging.")
    else:
        output.append("  Consider which voices are silent in this recall.")
        output.append("  Missing perspectives may contain critical counter-arguments.")
    
    output.append("")
    output.append("=" * 60)
    
    return "\n".join(output)

def format_simple(heuristics: List[Dict]) -> str:
    output = ["Relevant Heuristics:"]
    for h in heuristics:
        output.append(f"- [{h.get('voice')}] {h.get('heuristic_id')}: {h.get('formulation', '')[:150]}...")
    return "\n".join(output)

def main():
    parser = argparse.ArgumentParser(description='Retrieve relevant heuristics from Noosphere')
    parser.add_argument('--context', required=True, help='Current deliberation context/proposal')
    parser.add_argument('--voices', default='all', help='Comma-separated list of voices to include (or "all")')
    parser.add_argument('--min-confidence', type=float, default=0.6, help='Minimum confidence threshold')
    parser.add_argument('--format', choices=['dialectical', 'simple'], default='dialectical', help='Output format')
    parser.add_argument('--max-results', type=int, default=12, help='Maximum heuristics to return')
    
    args = parser.parse_args()
    
    all_heuristics = load_all_heuristics()
    filtered = [h for h in all_heuristics if h.get('confidence', 0) >= args.min_confidence]
    
    if args.voices != 'all':
        voice_list = [v.strip() for v in args.voices.split(',')]
        filtered = [h for h in filtered if h.get('voice') in voice_list]
    
    for h in filtered:
        h['relevance'] = calculate_relevance(args.context, h)
    
    filtered.sort(key=lambda x: x.get('relevance', 0), reverse=True)
    top_heuristics = filtered[:args.max_results]
    
    if args.format == 'dialectical':
        print(format_dialectical(top_heuristics))
    else:
        print(format_simple(top_heuristics))
    
    return 0

if __name__ == '__main__':
    sys.exit(main())
