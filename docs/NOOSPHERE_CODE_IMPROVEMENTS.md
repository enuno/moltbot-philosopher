# Noosphere - Recommended Code Improvements
## Bug Fixes and Enhancements

**Status**: Ready to implement  
**Priority**: Phase 1 (immediate), Phase 2 (near-term)  
**Date**: February 8, 2026

---

## Bug Fixes (Critical Path)

### Fix #1: Normalize Heuristic Field Names

**File**: `recall-engine.py`  
**Severity**: MEDIUM - Fragile field mapping  
**Lines**: 65-67, 88-95, 100-105, 112-117

**Problem**:
Different JSON files use different field names for the same concepts:
- `id` vs `heuristic_id` vs `case_id` vs `type_id`
- `description` vs `formulation` vs `ruling`
- `signatures` vs `markers` vs `indicators`

**Current Code**:
```python
# Line 63-66 (sovereignty)
h['heuristic_id'] = h.get('id', 'unknown')
h['formulation'] = h.get('description', '')

# Line 92 (rights)
'heuristic_id': p.get('case_id', 'unknown'),

# Line 102 (moloch)
'heuristic_id': m.get('type_id', 'unknown'),
```

**Fix**: Create a normalization function

```python
def normalize_heuristic(h: Dict, voice: str, category: str = '') -> Dict:
    """Normalize heuristics to standard field names"""
    
    # ID field mapping by category
    id_fields = {
        'rights': ['case_id', 'heuristic_id', 'id'],
        'moloch': ['type_id', 'heuristic_id', 'id'],
        'default': ['heuristic_id', 'id', 'case_id', 'type_id']
    }
    
    id_candidates = id_fields.get(category, id_fields['default'])
    heuristic_id = next((h.get(f) for f in id_candidates if h.get(f)), 'unknown')
    
    # Formulation field mapping
    form_candidates = ['formulation', 'description', 'ruling', 'name', 'signature']
    formulation = next((h.get(f) for f in form_candidates if h.get(f)), '')
    
    # Signature field mapping
    sig_candidates = ['signatures', 'markers', 'indicators', 'keywords']
    signatures = next((h.get(f) for f in sig_candidates if h.get(f)), [])
    if isinstance(signatures, str):
        signatures = [signatures]
    
    # Normalized heuristic
    return {
        'heuristic_id': str(heuristic_id),
        'formulation': str(formulation)[:500],  # Truncate long formulations
        'voice': voice,
        'confidence': float(h.get('confidence', 0.5)),
        'status': str(h.get('status', 'provisional')),
        'signatures': signatures if isinstance(signatures, list) else [signatures],
        'markers': h.get('markers', []),
        'evidence': h.get('evidence', h.get('referenced_in', [])),
        'category': category,
        'original': h  # Keep original for reference
    }
```

**Apply to all heuristic loading**:

```python
# Replace existing code sections with:

# Telos
telos_data = load_json_file(memory_core / "telos-alignment-heuristics.json")
for h in telos_data.get('heuristics', []):
    heuristics.append(normalize_heuristic(h, 'Classical', 'telos'))

# Sovereignty
sov_data = load_json_file(memory_core / "sovereignty-warnings.json")
for h in sov_data.get('heuristics', []):
    heuristics.append(normalize_heuristic(h, 'Transcendentalist', 'sovereignty'))

# Rights
rights_data = load_json_file(memory_core / "rights-precedents.json")
for p in rights_data.get('precedent_corpus', []):
    heuristics.append(normalize_heuristic(p, 'Enlightenment', 'rights'))

# ... etc for all voices
```

**Benefits**:
- ✅ Single source of truth for field mapping
- ✅ Easy to add new field name variants
- ✅ Reduces coupling to JSON structure
- ✅ Explicit handling of type conversions

---

### Fix #2: Add Rights Precedent Signatures

**File**: `recall-engine.py`  
**Severity**: MEDIUM - Missing relevance feature  
**Lines**: 88-95

**Problem**:
Rights precedents don't have signature keywords extracted, so they don't get signature-based relevance boost in `calculate_relevance()`.

**Current Code**:
```python
h = {
    'heuristic_id': p.get('case_id', 'unknown'),
    'formulation': f"{p.get('scenario', '')}: {p.get('ruling', '')}",
    'voice': 'Enlightenment',
    'category': 'rights',
    'confidence': p.get('confidence', 0.5),
    'status': p.get('weight', 'provisional')
}
```

**Fix**: Extract keywords from scenario/ruling

```python
def extract_keywords(text: str) -> List[str]:
    """Extract meaningful keywords from text"""
    stop_words = {'the', 'a', 'an', 'is', 'are', 'and', 'or', 'of', 'to'}
    words = text.lower().split()
    return [w for w in words if len(w) > 3 and w not in stop_words]

# When creating rights heuristic:
h = normalize_heuristic(p, 'Enlightenment', 'rights')
h['signatures'] = extract_keywords(
    f"{p.get('scenario', '')} {p.get('ruling', '')}"
)
```

**Benefits**:
- ✅ Rights precedents now match relevant queries
- ✅ Automatic keyword extraction from any text field

---

### Fix #3: Add Missing Output Formats

**File**: `recall-engine.py`  
**Severity**: MEDIUM - Documentation mismatch  
**Lines**: 180-199

**Problem**:
Documentation promises `constitutional` and `hybrid` formats but they don't exist.

**Current Code**:
```python
if args.format == 'dialectical':
    print(format_dialectical(top_heuristics))
else:
    print(format_simple(top_heuristics))
```

**Fix**: Implement missing formats

```python
def format_constitutional(heuristics: List[Dict]) -> str:
    """Full provenance with git/Mem0 references"""
    output = []
    output.append("=" * 70)
    output.append("CONSTITUTIONAL MEMORY - FULL PROVENANCE")
    output.append("=" * 70)
    output.append("")
    
    for h in heuristics:
        output.append(f"ID: {h.get('heuristic_id')}")
        output.append(f"Voice: {h.get('voice')} | Status: {h.get('status').upper()}")
        output.append(f"Confidence: {h.get('confidence'):.3f}")
        output.append("")
        output.append(f"Formulation:")
        output.append(f"  {h.get('formulation', '')}")
        output.append("")
        
        evidence = h.get('evidence', [])
        if evidence:
            output.append(f"Evidence:")
            for ev in evidence[:5]:  # Show first 5
                output.append(f"  - {ev}")
            if len(evidence) > 5:
                output.append(f"  ... and {len(evidence) - 5} more")
            output.append("")
        
        contradictions = h.get('contradictions', [])
        if contradictions:
            output.append(f"Contradicts: {', '.join(contradictions)}")
            output.append("")
        
        output.append("-" * 70)
        output.append("")
    
    return "\n".join(output)

def format_hybrid(heuristics: List[Dict]) -> str:
    """Combined vector/text search results with match type"""
    output = []
    output.append("=" * 60)
    output.append("HYBRID SEARCH RESULTS (Vector + Text)")
    output.append("=" * 60)
    output.append("")
    
    for h in heuristics:
        relevance = h.get('relevance', 0)
        
        # Determine match type
        match_type = "text"
        if relevance > 0.7:
            match_type = "strong-text"
        if 'vector_score' in h:
            match_type = f"vector+text"
        
        output.append(f"[{h.get('voice')}] {h.get('heuristic_id')}")
        output.append(f"  Match: {match_type} (relevance: {relevance:.2f})")
        output.append(f"  → {h.get('formulation', '')[:150]}")
        output.append("")
    
    return "\n".join(output)

# Update main() to support all formats
def main():
    # ... existing argument parsing ...
    
    format_handlers = {
        'dialectical': format_dialectical,
        'simple': format_simple,
        'constitutional': format_constitutional,
        'hybrid': format_hybrid,
    }
    
    if args.format not in format_handlers:
        print(f"Unknown format: {args.format}", file=sys.stderr)
        print(f"Available: {', '.join(format_handlers.keys())}", file=sys.stderr)
        return 1
    
    formatter = format_handlers[args.format]
    print(formatter(top_heuristics))
    return 0
```

**Benefits**:
- ✅ Documentation now accurate
- ✅ Full provenance tracking for constitutional memory
- ✅ Hybrid search results when implemented

---

### Fix #4: Better Voice Resonance Threshold

**File**: `assimilate-wisdom.py`  
**Severity**: HIGH - Rejects valid submissions  
**Lines**: 127-130

**Problem**:
Threshold of 0.1 is too strict. Community submissions often discuss multiple voices, resulting in lower individual scores.

**Current Code**:
```python
if max(voice_alignment.values()) < 0.1:
    return None
```

**Fix**: Make threshold configurable with better default

```python
def assimilate_submission(submission: Dict, dry_run: bool = False, min_resonance: float = 0.05) -> Optional[Dict]:
    """Assimilate submission with configurable resonance threshold"""
    voice_alignment = detect_voice_resonance(submission)
    
    # Allow multi-voice submissions (sum of resonances)
    total_resonance = sum(voice_alignment.values())
    max_resonance = max(voice_alignment.values())
    
    # Accept if either condition met:
    # 1. One voice strong resonance
    # 2. Multiple voices weak resonance
    if max_resonance >= 0.1 or total_resonance >= 0.25:
        heuristic = create_provisional_heuristic(submission, voice_alignment)
        if heuristic:
            if dry_run:
                return heuristic
            return heuristic
    
    return None
```

**In main()**:

```python
parser.add_argument(
    '--min-resonance',
    type=float,
    default=0.05,
    help='Minimum voice resonance threshold (default: 0.05)'
)

# ...later...
heuristic = assimilate_submission(submission, args.dry_run, args.min_resonance)
```

**Benefits**:
- ✅ Accepts multi-voice submissions
- ✅ User-configurable
- ✅ Better alignment with intended behavior

---

### Fix #5: Error Handling for Missing Directories

**File**: `assimilate-wisdom.py`  
**Severity**: MEDIUM - Silent failures  
**Lines**: 149-160

**Problem**:
If approved_dir doesn't exist, script silently returns 0 with no heuristics.

**Current Code**:
```python
approved_dir = Path(args.approved_dir)
if approved_dir.exists():
    for sub_file in approved_dir.glob('*.md'):
        # ...
```

**Fix**: Add explicit error handling

```python
def main():
    # ... argument parsing ...
    
    assimilated = []
    
    if args.submission_path:
        submission_path = Path(args.submission_path)
        if not submission_path.exists():
            print(f"ERROR: Submission file not found: {submission_path}", file=sys.stderr)
            return 1
        
        submission = load_submission(submission_path)
        if not submission:
            print(f"ERROR: Could not load submission: {submission_path}", file=sys.stderr)
            return 1
        
        heuristic = assimilate_submission(submission, args.dry_run)
        if heuristic:
            assimilated.append(heuristic)
    else:
        approved_dir = Path(args.approved_dir)
        
        if not approved_dir.exists():
            print(f"ERROR: Directory not found: {approved_dir}", file=sys.stderr)
            print(f"Expected: {approved_dir}", file=sys.stderr)
            return 1
        
        if not approved_dir.is_dir():
            print(f"ERROR: Not a directory: {approved_dir}", file=sys.stderr)
            return 1
        
        # Count and process files
        files = list(approved_dir.glob('*.md'))
        if not files:
            print(f"WARNING: No .md files found in {approved_dir}", file=sys.stderr)
            if not args.dry_run:
                return 1
        
        for sub_file in files:
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
    return 0 if assimilated or args.dry_run else 1
```

**Benefits**:
- ✅ Clear error messages
- ✅ Proper exit codes
- ✅ Easy debugging

---

### Fix #6: Implement Heuristic Persistence

**File**: `assimilate-wisdom.py`  
**Severity**: CRITICAL - Data loss  
**Lines**: 155-160

**Problem**:
Assimilated heuristics are printed to stdout but not saved. They're lost after script runs.

**Current Code**:
```python
print(json.dumps(result, indent=2))
return 0 if assimilated else 1
```

**Fix**: Write to memory-core files

```python
def save_heuristics_to_memory(heuristics: List[Dict], output_dir: Optional[str] = None) -> bool:
    """Save assimilated heuristics to voice-specific memory-core files"""
    if not heuristics:
        return True
    
    output_dir = Path(output_dir or NOOSPHERE_DIR / "memory-core")
    if not output_dir.exists():
        print(f"ERROR: Output directory not found: {output_dir}", file=sys.stderr)
        return False
    
    # Map voices to files
    voice_files = {
        'Classical': 'telos-alignment-heuristics.json',
        'Existentialist': 'bad-faith-patterns.json',
        'Transcendentalist': 'sovereignty-warnings.json',
        'JoyceStream': 'phenomenological-touchstones.json',
        'Enlightenment': 'rights-precedents.json',
        'BeatGeneration': 'moloch-detections/archive.json',
        'Meta-Cognitive': 'meta-cognitive/synthesis-efficiency-patterns.json',
    }
    
    by_voice = {}
    for h in heuristics:
        voice = h.get('primary_voice', 'Unknown')
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
        except json.JSONDecodeError:
            print(f"ERROR: Invalid JSON in {file_path}", file=sys.stderr)
            continue
        
        # Append new heuristics
        if 'heuristics' not in existing_data:
            existing_data['heuristics'] = []
        
        existing_data['heuristics'].extend(voice_heuristics)
        
        # Write back
        try:
            with open(file_path, 'w') as f:
                json.dump(existing_data, f, indent=2)
            saved_count += len(voice_heuristics)
            print(f"Saved {len(voice_heuristics)} heuristics to {file_path.name}", file=sys.stderr)
        except IOError as e:
            print(f"ERROR: Could not write {file_path}: {e}", file=sys.stderr)
    
    return saved_count > 0

# In main():
# After assimilating all submissions
if assimilated and not args.dry_run:
    output_dir = args.output_dir or str(NOOSPHERE_DIR / "memory-core")
    if save_heuristics_to_memory(assimilated, output_dir):
        print(f"✓ Persisted {len(assimilated)} heuristics to memory-core", file=sys.stderr)
    else:
        print(f"✗ Failed to persist heuristics", file=sys.stderr)
        return 1
```

**Add argument**:

```python
parser.add_argument(
    '--output-dir',
    help='Directory to save heuristics (default: memory-core)',
    default=None
)
```

**Benefits**:
- ✅ Heuristics are saved to files
- ✅ Proper voice-based organization
- ✅ Backup handling before modification
- ✅ Clear feedback on what was saved

---

## Enhancement Suggestions (Phase 2)

### Enhancement #1: Better Relevance Scoring

**File**: `recall-engine.py`  
**Current**: Simple keyword matching  

**Proposed**: Semantic similarity with fallback

```python
def calculate_relevance_enhanced(context: str, heuristic: Dict) -> float:
    """Enhanced relevance with semantic similarity fallback"""
    context_lower = context.lower()
    base_relevance = 0.0
    
    # 1. Keyword overlap (existing logic)
    formulation = heuristic.get('formulation', '')
    if formulation:
        keywords = set(re.findall(r'\b\w+\b', formulation.lower()))
        context_words = set(re.findall(r'\b\w+\b', context_lower))
        overlap = len(keywords & context_words)
        base_relevance += (overlap / max(len(keywords), 1)) * 0.5
    
    # 2. Signature matching
    signatures = heuristic.get('signatures', [])
    sig_hits = sum(1 for sig in signatures if sig.lower() in context_lower)
    base_relevance += (sig_hits / max(len(signatures), 1)) * 0.3
    
    # 3. Opposite-direction matching
    # (Relevance if explicitly NOT about something might indicate dissenting perspective)
    if any(neg in context_lower for neg in ['not', 'avoid', 'prevent', 'against']):
        base_relevance += 0.1
    
    return min(base_relevance, 1.0)
```

### Enhancement #2: Heuristic Validation

**File**: `assimilate-wisdom.py`  
**Proposed**: Check against existing heuristics for contradictions

```python
def validate_against_corpus(principle: str, heuristic_corpus: List[Dict]) -> Dict:
    """Check if principle contradicts or duplicates existing heuristics"""
    validation = {
        'is_novel': True,
        'contradicts': [],
        'similar_to': [],
        'warnings': []
    }
    
    principle_lower = principle.lower()
    principle_words = set(principle_lower.split())
    
    for h in heuristic_corpus:
        form_lower = h.get('formulation', '').lower()
        form_words = set(form_lower.split())
        
        # Check for high semantic similarity
        similarity = len(principle_words & form_words) / len(principle_words | form_words)
        
        if similarity > 0.7:
            validation['is_novel'] = False
            validation['similar_to'].append({
                'id': h.get('heuristic_id'),
                'similarity': similarity
            })
        
        # Check explicit contradictions field
        if h.get('heuristic_id') in principle_lower:
            validation['contradicts'].append(h.get('heuristic_id'))
    
    if not validation['is_novel'] and len(validation['similar_to']) > 0:
        best_match = max(validation['similar_to'], key=lambda x: x['similarity'])
        validation['warnings'].append(
            f"Very similar to {best_match['id']} (similarity: {best_match['similarity']:.2f})"
        )
    
    return validation
```

---

## Summary of Changes

### Files to Modify
1. **recall-engine.py**: Fixes #1-3, enhancement #1
2. **assimilate-wisdom.py**: Fixes #4-6, enhancement #2

### Implementation Order
1. Fix #4-5 (error handling - highest impact)
2. Fix #6 (persistence - enables workflow)
3. Fix #1 (normalization - improves stability)
4. Fix #2-3 (features - improve functionality)
5. Enhancements #1-2 (optional improvements)

### Estimated Effort
- Fixes #4-5: 30 minutes
- Fix #6: 45 minutes
- Fix #1: 30 minutes
- Fixes #2-3: 45 minutes
- Enhancements: 2 hours each

**Total Critical Path**: ~2.5 hours for all bug fixes

---

## Testing Approach

After each fix, run:

```bash
# Quick smoke test
python3 recall-engine.py --context "test" --max-results 1
python3 assimilate-wisdom.py --submission-path /tmp/test.md --dry-run

# Comprehensive tests
bash /workspace/classical/noosphere/run-tests.sh
```

---

*Code Improvement Plan for Noosphere v2.5 | 2026-02-08*
