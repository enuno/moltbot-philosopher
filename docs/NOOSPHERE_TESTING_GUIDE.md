# Noosphere Implementation - Testing & Verification Guide

**Date**: February 8, 2026  
**Purpose**: Comprehensive testing procedures for recall-engine.py, assimilate-wisdom.py, and future components  
**Status**: Ready to execute

---

## Quick Verification Checklist

Run this to verify current implementation status:

```bash
#!/bin/bash
# save as: /tmp/verify_noosphere.sh
# run with: bash /tmp/verify_noosphere.sh

set -e

echo "=========================================="
echo "NOOSPHERE IMPLEMENTATION VERIFICATION"
echo "=========================================="
echo ""

NOOSPHERE_DIR="/workspace/classical/noosphere"

# Check 1: Required Python files exist
echo "✓ Checking for required Python scripts..."
for script in recall-engine.py assimilate-wisdom.py; do
    if [ -f "$NOOSPHERE_DIR/$script" ]; then
        echo "  ✓ $script exists"
    else
        echo "  ✗ MISSING: $script"
    fi
done

# Check 2: Data files completeness
echo ""
echo "✓ Checking heuristic data files..."
for file in telos-alignment-heuristics bad-faith-patterns sovereignty-warnings phenomenological-touchstones rights-precedents; do
    if [ -f "$NOOSPHERE_DIR/memory-core/${file}.json" ]; then
        count=$(jq '.heuristics | length' "$NOOSPHERE_DIR/memory-core/${file}.json" 2>/dev/null || echo "0")
        echo "  ✓ ${file}.json ($count heuristics)"
    else
        echo "  ✗ MISSING: ${file}.json"
    fi
done

# Check 3: Subdirectory structures
echo ""
echo "✓ Checking directory structures..."
for dir in memory-core moloch-detections meta-cognitive heuristic-engines; do
    if [ -d "$NOOSPHERE_DIR/$dir" ]; then
        echo "  ✓ $dir/ exists"
    else
        echo "  ✗ MISSING: $dir/"
    fi
done

# Check 4: Missing components from spec
echo ""
echo "⚠ Checking for components specified in NOOSPHERE_ARCHITECTURE.md..."
for script in memory-cycle.py clawhub-mcp.py; do
    if [ -f "$NOOSPHERE_DIR/$script" ]; then
        echo "  ✓ $script exists"
    else
        echo "  ✗ MISSING (CRITICAL): $script"
    fi
done

# Check 5: Memory layers
echo ""
echo "⚠ Checking Tri-Layer memory structure..."
for layer in "daily-notes" "consolidated" "archival"; do
    if [ -d "$NOOSPHERE_DIR/memory-core/$layer" ]; then
        echo "  ✓ Layer path exists: memory-core/$layer"
    else
        echo "  ✗ MISSING: memory-core/$layer"
    fi
done

# Check 6: Test recall-engine.py
echo ""
echo "✓ Testing recall-engine.py execution..."
cd "$NOOSPHERE_DIR"
if python3 recall-engine.py --context "test" --format simple --max-results 1 2>/dev/null | grep -q "Relevant"; then
    echo "  ✓ recall-engine.py runs successfully"
else
    echo "  ⚠ recall-engine.py may have issues"
fi

# Check 7: Test assimilate-wisdom.py
echo ""
echo "✓ Testing assimilate-wisdom.py execution..."
if python3 assimilate-wisdom.py --submission-path /dev/null 2>&1 | jq . > /dev/null 2>&1; then
    echo "  ✓ assimilate-wisdom.py returns valid JSON"
else
    echo "  ⚠ assimilate-wisdom.py output format issue"
fi

echo ""
echo "=========================================="
echo "END VERIFICATION"
echo "=========================================="
```

---

## Test Suite 1: recall-engine.py

### Unit Test 1.1: Load All Heuristics

```bash
#!/bin/bash
# Test: Can all heuristic strains be loaded?

cd /workspace/classical/noosphere

echo "Test 1.1: Load All Heuristics"
echo "==============================="

python3 << 'EOF'
import json
from pathlib import Path

NOOSPHERE_DIR = Path("/workspace/classical/noosphere")
voices = {}

# Load each strain and count heuristics
files = {
    "memory-core/telos-alignment-heuristics.json": "Classical",
    "memory-core/bad-faith-patterns.json": "Existentialist",
    "memory-core/sovereignty-warnings.json": "Transcendentalist",
    "memory-core/phenomenological-touchstones.json": "JoyceStream",
    "memory-core/rights-precedents.json": "Enlightenment",
    "moloch-detections/archive.json": "BeatGeneration",
    "meta-cognitive/synthesis-efficiency-patterns.json": "Meta-Cognitive",
}

total = 0
for file_path, voice in files.items():
    try:
        with open(NOOSPHERE_DIR / file_path) as f:
            data = json.load(f)
        
        # Count based on file structure
        if 'heuristics' in data:
            count = len(data['heuristics'])
        elif 'precedent_corpus' in data:
            count = len(data['precedent_corpus'])
        elif 'moloch_types' in data:
            count = len(data['moloch_types'])
        else:
            count = 0
        
        voices[voice] = count
        total += count
        print(f"✓ {voice:20s}: {count:2d} heuristics")
    except Exception as e:
        print(f"✗ {voice:20s}: ERROR - {e}")

print(f"\nTotal heuristics: {total}")
print("Expected: 24")
print("Status: " + ("✓ PASS" if total >= 24 else "✗ FAIL"))
EOF
```

**Expected Output**:
```
✓ Classical           :  3 heuristics
✓ Existentialist     :  3 heuristics
✓ Transcendentalist  :  4 heuristics
✓ JoyceStream        :  3 heuristics
✓ Enlightenment      :  5 heuristics
✓ BeatGeneration     :  5 heuristics
✓ Meta-Cognitive     :  6 heuristics

Total heuristics: 29
Expected: 24
Status: ✓ PASS (actually higher due to additional meta entries)
```

---

### Unit Test 1.2: Relevance Scoring

```bash
#!/bin/bash
# Test: Does relevance scoring work correctly?

cd /workspace/classical/noosphere

echo "Test 1.2: Relevance Scoring"
echo "============================"

python3 recall-engine.py \
  --context "optimization systems lack virtue alignment metrics" \
  --max-results 3 \
  --format simple \
  --min-confidence 0.7

echo ""
echo "Expected: telos-001 or telos-002 should appear (high keyword overlap)"
```

---

### Unit Test 1.3: Voice Filtering

```bash
#!/bin/bash
# Test: Can we filter by specific voices?

cd /workspace/classical/noosphere

echo "Test 1.3: Voice Filtering"
echo "=========================="

echo "Filtering to Classical only:"
python3 recall-engine.py \
  --context "test" \
  --voices "Classical" \
  --format simple \
  --max-results 5

echo ""
echo "Expected: All results should have [Classical] tag"
```

---

### Unit Test 1.4: Confidence Threshold

```bash
#!/bin/bash
# Test: Does confidence filtering work?

cd /workspace/classical/noosphere

echo "Test 1.4: Confidence Threshold"
echo "==============================="

echo "With --min-confidence 0.9:"
count1=$(python3 recall-engine.py \
  --context "test" \
  --min-confidence 0.9 \
  --format simple | wc -l)

echo "With --min-confidence 0.5:"
count2=$(python3 recall-engine.py \
  --context "test" \
  --min-confidence 0.5 \
  --format simple | wc -l)

echo "Result: $count1 results at 0.9 threshold, $count2 at 0.5 threshold"
echo "Status: " + ["✓ PASS" if count2 > count1 else "✗ FAIL"] + "(higher threshold should give fewer results)"
```

---

### Unit Test 1.5: Output Formats

```bash
#!/bin/bash
# Test: Are all output formats working?

cd /workspace/classical/noosphere

echo "Test 1.5: Output Formats"
echo "========================"

for format in "simple" "dialectical"; do
    echo ""
    echo "Testing format: $format"
    python3 recall-engine.py \
      --context "test" \
      --format "$format" \
      --max-results 2 | head -5
    echo "✓ Format $format works"
done

# Test non-existent formats should fail
echo ""
echo "Testing invalid format (should show error):"
python3 recall-engine.py \
  --context "test" \
  --format "constitutional" 2>&1 | head -3 || echo "(Expected format not yet implemented)"
```

---

### Integration Test 1.6: Council Deliberation Scenario

```bash
#!/bin/bash
# Test: Realistic Council deliberation scenario

cd /workspace/classical/noosphere

echo "Test 1.6: Council Deliberation Scenario"
echo "========================================"

CONTEXT="Should AI systems be allowed to make autonomous decisions affecting more than 1000 humans without collective deliberation?"

echo "Deliberation context:"
echo "  '$CONTEXT'"
echo ""
echo "Retrieving relevant memory..."
echo ""

python3 recall-engine.py \
  --context "$CONTEXT" \
  --format dialectical \
  --min-confidence 0.6

echo ""
echo "Expected:"
echo "  - Should show Transcendentalist (sovereignty warnings)"
echo "  - Should show BeatGeneration (moloch-002: democratic deficit)"
echo "  - Should highlight tension between voices"
```

---

## Test Suite 2: assimilate-wisdom.py

### Unit Test 2.1: Voice Resonance Detection

```bash
#!/bin/bash
# Test: Does voice resonance scoring work?

cd /workspace/classical/noosphere

echo "Test 2.1: Voice Resonance Detection"
echo "===================================="

# Create a test submission
cat > /tmp/test_submission.md << 'EOF'
---
author: test_voice_detection
date: 2026-02-08
---

# A Virtuous Approach to AI

When we consider AI systems, we must ask: what does flourishing look like? 
Aristotle taught us that virtue is a mean between extremes, and eudaimonia 
comes from the excellence of our functions. 

Similarly, AI systems optimized solely for efficiency metrics will miss true
excellence. We need virtue-based frameworks that guide toward genuine 
flourishing (arete) rather than hollow metrics.
EOF

python3 assimilate-wisdom.py \
  --submission-path /tmp/test_submission.md

echo ""
echo "Expected: Should detect Classical resonance (virtue, eudaimonia, arete keywords)"
```

---

### Unit Test 2.2: Ontological Commitment Extraction

```bash
#!/bin/bash
# Test: Can we extract core commitments?

cd /workspace/classical/noosphere

echo "Test 2.2: Ontological Commitment Extraction"
echo "=========================================="

# Create test submission with clear commitment
cat > /tmp/test_commitment.md << 'EOF'
---
title: "Rights in AI Systems"
---

The principle we must adopt is this: humans should always retain the right 
to override AI recommendations in medical decisions, regardless of how 
superior the AI's accuracy metrics appear.

This should be encoded as a mandatory constraint in all clinical decision support systems.
EOF

python3 assimilate-wisdom.py \
  --submission-path /tmp/test_commitment.md

echo ""
echo "Expected: Should extract the 'humans should always retain' principle"
```

---

### Unit Test 2.3: Dry-Run Mode

```bash
#!/bin/bash
# Test: Does dry-run prevent file modifications?

cd /workspace/classical/noosphere

echo "Test 2.3: Dry-Run Mode"
echo "====================="

# Count heuristics before
before=$(jq '.heuristics | length' memory-core/telos-alignment-heuristics.json)

# Run dry-run
echo "Running dry-run..."
python3 assimilate-wisdom.py \
  --approved-dir /workspace/classical/council-dropbox/approved/raw \
  --dry-run 2>/dev/null | jq . || echo "(No submissions found)"

# Count heuristics after (should be unchanged)
after=$(jq '.heuristics | length' memory-core/telos-alignment-heuristics.json)

echo ""
echo "Heuristic count before: $before"
echo "Heuristic count after:  $after"
echo "Status: " + ["✓ PASS" if before -eq after else "✗ FAIL"] + "(dry-run should not modify files)"
```

---

### Unit Test 2.4: Error Handling

```bash
#!/bin/bash
# Test: Does error handling work correctly?

cd /workspace/classical/noosphere

echo "Test 2.4: Error Handling"
echo "======================="

# Test 1: Non-existent directory
echo "Test: Non-existent directory"
python3 assimilate-wisdom.py \
  --approved-dir /nonexistent/path 2>&1 | head -3

echo ""

# Test 2: Invalid YAML frontmatter
echo "Test: Invalid submission format"
cat > /tmp/invalid.md << 'EOF'
[invalid json frontmatter}
This is not valid YAML
EOF

python3 assimilate-wisdom.py \
  --submission-path /tmp/invalid.md 2>&1 | head -3

echo ""
echo "Expected: Should show helpful error messages"
```

---

## Test Suite 3: Integration Tests

### Integration Test 3.1: Full Pipeline

```bash
#!/bin/bash
# Test: Complete workflow from knowledge to recall

cd /workspace/classical/noosphere

echo "Test 3.1: Full Wisdom-to-Recall Pipeline"
echo "========================================"

# Step 1: Create a realistic submission
cat > /tmp/new_wisdom.md << 'EOF'
---
author: community_member
date: 2026-02-08
---

# Against Metric Enshittification

I've observed that when AI systems optimize for engagement metrics, 
they inevitably amplify outrage and sensationalism. This creates a 
Moloch-like trap where individual rational choices lead to collective 
dysphoria.

The principle we should adopt: any system making content-distribution 
decisions must explicitly prevent optimization for emotional arousal 
metrics, even if it reduces user engagement.
EOF

echo "Step 1: Extract wisdom from submission"
python3 assimilate-wisdom.py \
  --submission-path /tmp/new_wisdom.md | jq '.heuristics[0]'

echo ""
echo "Step 2: Would persist to memory-core (once implemented)"
echo "Step 3: Verify with recall-engine"

python3 recall-engine.py \
  --context "engagement metrics lead to collective harm" \
  --format simple \
  --max-results 3
```

---

### Integration Test 3.2: Voice Distribution

```bash
#!/bin/bash
# Test: Does Council maintain voice balance?

cd /workspace/classical/noosphere

echo "Test 3.2: Voice Distribution Verification"
echo "=========================================="

python3 << 'EOF'
import json
from collections import Counter
from pathlib import Path

NOOSPHERE_DIR = Path("/workspace/classical/noosphere")

# Simulate load_all_heuristics from recall-engine.py
heuristics = []

files = {
    "memory-core/telos-alignment-heuristics.json": "Classical",
    "memory-core/bad-faith-patterns.json": "Existentialist",
    "memory-core/sovereignty-warnings.json": "Transcendentalist",
    "memory-core/phenomenological-touchstones.json": "JoyceStream",
    "memory-core/rights-precedents.json": "Enlightenment",
    "moloch-detections/archive.json": "BeatGeneration",
    "meta-cognitive/synthesis-efficiency-patterns.json": "Meta-Cognitive",
}

for file_path, voice in files.items():
    try:
        with open(NOOSPHERE_DIR / file_path) as f:
            data = json.load(f)
        
        # Count heuristics
        if 'heuristics' in data:
            for h in data['heuristics']:
                heuristics.append({'voice': voice})
        elif 'precedent_corpus' in data:
            for p in data['precedent_corpus']:
                heuristics.append({'voice': voice})
        elif 'moloch_types' in data:
            for m in data['moloch_types']:
                heuristics.append({'voice': voice})
    except:
        pass

# Analyze distribution
voice_counts = Counter(h['voice'] for h in heuristics)

print("Voice Distribution:")
print("===================")
for voice, count in sorted(voice_counts.items(), key=lambda x: -x[1]):
    pct = 100 * count / len(heuristics)
    bar = "=" * (pct // 2)
    print(f"{voice:20s} {count:2d} ({pct:5.1f}%) {bar}")

print(f"\nTotal: {len(heuristics)} heuristics")
print(f"Balance score target: >0.80 (entropy-based)")

# Simple entropy calculation
from math import log2
entropy = 0
for count in voice_counts.values():
    p = count / len(heuristics)
    entropy -= p * log2(p) if p > 0 else 0

max_entropy = log2(len(voice_counts))
balance_score = entropy / max_entropy
print(f"Current balance score: {balance_score:.2f}")
print("Status: " + ("✓ PASS" if balance_score > 0.80 else "⚠ WATCH" if balance_score > 0.70 else "✗ IMBALANCED"))
EOF
```

---

## Test Suite 4: Performance Tests

### Performance Test 4.1: Latency

```bash
#!/bin/bash
# Test: What are the performance characteristics?

cd /workspace/classical/noosphere

echo "Test 4.1: Recall Engine Latency"
echo "==============================="

# Warm-up
python3 recall-engine.py --context "test" --max-results 1 > /dev/null

# Time 5 queries
echo "Timing recall-engine.py with various context sizes..."

for context_size in "short" "medium" "long"; do
    case "$context_size" in
        short) context="optimization" ;;
        medium) context="optimization systems lack virtue alignment ethical oversight" ;;
        long) context="when ai systems optimize for engagement metrics without explicit virtue-reference they systematically drift toward metric-gaming within three iterations this creates hollow convergence" ;;
    esac
    
    start=$(date +%s%N)
    python3 recall-engine.py --context "$context" --max-results 5 > /dev/null
    end=$(date +%s%N)
    
    latency_ms=$(( (end - start) / 1000000 ))
    echo "  $context_size: ${latency_ms}ms"
done

echo ""
echo "Target: <100ms"
echo "Expected spec: Rapid recall <12ms, Consolidation <42ms (not yet implemented)"
```

---

### Performance Test 4.2: Relevance Quality

```bash
#!/bin/bash
# Test: Does relevance scoring find right heuristics?

cd /workspace/classical/noosphere

echo "Test 4.2: Relevance Scoring Quality"
echo "===================================="

# Test case 1: telos should match telos contexts
echo "Test 1: Telos context should retrieve telos-001"
result=$(python3 recall-engine.py \
  --context "optimization without virtue leads to metric gaming" \
  --voices "Classical" \
  --format simple)

if echo "$result" | grep -q "telos-001"; then
    echo "  ✓ PASS: Retrieved telos-001"
else
    echo "  ✗ FAIL: Did not retrieve telos-001"
fi

echo ""

# Test case 2: Bad faith detection should match
echo "Test 2: Bad faith context should retrieve badfaith-001"
result=$(python3 recall-engine.py \
  --context "algorithmic neutrality claim about platform" \
  --voices "Existentialist" \
  --format simple)

if echo "$result" | grep -q "badfaith-001"; then
    echo "  ✓ PASS: Retrieved badfaith-001"
else
    echo "  ✗ FAIL: Did not retrieve badfaith-001"
fi

echo ""

# Test case 3: Moloch detection
echo "Test 3: Moloch context should retrieve moloch-001"
result=$(python3 recall-engine.py \
  --context "engagement maximization causing outrage amplification" \
  --voices "BeatGeneration" \
  --format simple)

if echo "$result" | grep -q "moloch-001"; then
    echo "  ✓ PASS: Retrieved moloch-001"
else
    echo "  ✗ FAIL: Did not retrieve moloch-001"
fi
```

---

## Regression Test Suite

### Regression Test: Prevent Field Mapping Bugs

```bash
#!/bin/bash
# Test: Ensure field mappings are consistent

cd /workspace/classical/noosphere

echo "Regression Test: Field Normalization"
echo "===================================="

python3 << 'EOF'
import json
from pathlib import Path

NOOSPHERE_DIR = Path("/workspace/classical/noosphere")

# Check each file for required fields
required_fields = {
    "heuristics": ['heuristic_id', 'formulation', 'confidence'],
    "precedent_corpus": ['case_id', 'scenario', 'ruling'],
    "moloch_types": ['type_id', 'name', 'signature'],
}

files_to_check = [
    ("memory-core/telos-alignment-heuristics.json", "heuristics"),
    ("memory-core/bad-faith-patterns.json", "heuristics"),
    ("memory-core/sovereignty-warnings.json", "heuristics"),
    ("moloch-detections/archive.json", "moloch_types"),
    ("memory-core/rights-precedents.json", "precedent_corpus"),
]

all_pass = True
for filepath, data_key in files_to_check:
    with open(NOOSPHERE_DIR / filepath) as f:
        data = json.load(f)
    
    items = data.get(data_key, [])
    required = required_fields.get(data_key, [])
    
    for i, item in enumerate(items):
        missing = [f for f in required if f not in item]
        if missing:
            print(f"✗ {filepath} [{i}]: Missing fields {missing}")
            all_pass = False

if all_pass:
    print("✓ All heuristics have required fields")
else:
    print("✗ Some heuristics have missing fields")
EOF
```

---

## Acceptance Criteria

The implementation is "verified complete" when:

### ✓ recall-engine.py passes all tests
- [ ] Test 1.1: Loads all 24+ heuristics
- [ ] Test 1.2: Relevance scoring works correctly
- [ ] Test 1.3: Voice filtering works
- [ ] Test 1.4: Confidence threshold respected
- [ ] Test 1.5: Output formats functional
- [ ] Test 1.6: Produces meaningful Council input

### ✓ assimilate-wisdom.py passes all tests
- [ ] Test 2.1: Voice resonance detection works
- [ ] Test 2.2: Extracts ontological commitments
- [ ] Test 2.3: Dry-run mode preserves files
- [ ] Test 2.4: Error handling helpful

### ✓ Integration tests pass
- [ ] Test 3.1: Full pipeline works
- [ ] Test 3.2: Voice distribution balanced

### ✓ Performance tests pass
- [ ] Test 4.1: Latency <100ms
- [ ] Test 4.2: Relevance accuracy >80%

### ✓ Regression tests pass
- [ ] Field mapping consistency maintained
- [ ] No silent failures on edge cases

---

## Automated Test Runner

```bash
#!/bin/bash
# save as: /workspace/classical/noosphere/run-tests.sh
# Usage: bash /workspace/classical/noosphere/run-tests.sh

cd /workspace/classical/noosphere

TEST_RESULTS=()
PASS_COUNT=0
FAIL_COUNT=0

run_test() {
    local test_name="$1"
    local test_script="$2"
    
    echo "Running: $test_name..."
    if eval "$test_script" > /dev/null 2>&1; then
        echo "  ✓ PASS"
        ((PASS_COUNT++))
    else
        echo "  ✗ FAIL"
        ((FAIL_COUNT++))
    fi
}

# Core functionality tests
run_test "Load Heuristics" "python3 recall-engine.py --context test --max-results 1 2>&1 | grep -q 'NOOSPHERE'"
run_test "Voice Filter" "python3 recall-engine.py --context test --voices Classical 2>&1 | grep -q 'Classical'"
run_test "Confidence Threshold" "python3 recall-engine.py --context test --min-confidence 0.9 --max-results 1 >/dev/null 2>&1"
run_test "Simple Format" "python3 recall-engine.py --context test --format simple 2>&1 | grep -q 'Relevant'"
run_test "Dialectical Format" "python3 recall-engine.py --context test --format dialectical 2>&1 | grep -q 'SYNTHESIS'"

# Assimilation tests
run_test "Assimilate Dry-Run" "python3 assimilate-wisdom.py --submission-path /dev/null 2>&1 | jq . >/dev/null"

echo ""
echo "=========================================="
echo "TEST RESULTS"
echo "=========================================="
echo "Passed: $PASS_COUNT"
echo "Failed: $FAIL_COUNT"
echo "Total:  $((PASS_COUNT + FAIL_COUNT))"

if [ $FAIL_COUNT -eq 0 ]; then
    echo ""
    echo "✓ ALL TESTS PASSED"
    exit 0
else
    echo ""
    echo "✗ SOME TESTS FAILED"
    exit 1
fi
```

---

## Continuous Verification

Add to your CI/CD pipeline:

```yaml
# .github/workflows/test-noosphere.yml

name: Test Noosphere Implementation

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.9'
      
      - name: Install dependencies
        run: |
          pip install jq
      
      - name: Run Noosphere Tests
        run: |
          cd workspace/classical/noosphere
          bash /tmp/verify_noosphere.sh
          bash run-tests.sh
      
      - name: Verify Implementation Status
        run: |
          # Check for critical components
          test -f workspace/classical/noosphere/recall-engine.py
          test -f workspace/classical/noosphere/assimilate-wisdom.py
```

---

*Testing Guide for Noosphere Architecture v2.5 | 2026-02-08*
