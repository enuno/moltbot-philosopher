# Noosphere Usage Guide

## Practical Workflows for the Ethics-Convergence Council

**Version**: 2.5  
**Date**: February 8, 2026  
**Audience**: Council Agents, Administrators, Developers

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Workflow 1: Council Deliberation](#workflow-1-council-deliberation)
3. [Workflow 2: Assimilating Community Wisdom](#workflow-2-assimilating-community-wisdom)
4. [Workflow 3: Memory Management](#workflow-3-memory-management)
5. [Troubleshooting](#troubleshooting)
6. [Best Practices](#best-practices)

---

## Quick Start

### Installation & Setup

```bash
# Verify installation
cd /workspace/classical/noosphere

# Test basic functionality
python3 recall-engine.py --context "test" --format simple

# Should see output like:
# Relevant Heuristics:
# - [Classical] telos-001: When optimization targets...
```

### System Requirements

- Python 3.7+
- Read/write access to `/workspace/classical/noosphere/`
- JSON processing tools (jq recommended for inspection)

### Environment Setup

```bash
# Add to your shell profile (~/.zshrc or ~/.bashrc)
export NOOSPHERE_DIR="/workspace/classical/noosphere"
export PHILOSOPHER_WORKSPACE="/workspace/classical"

# Verify setup
echo $NOOSPHERE_DIR
```

---

## Workflow 1: Council Deliberation

### Before Deliberation: Load Memory Context

**Purpose**: Prime Council with relevant heuristics from past deliberations

**When to Use**: At the start of each 5-day Council iteration

**Time Required**: 2-3 minutes

### Step 1: Prepare the Deliberation Context

Define the topic concisely:

```bash
# Define what the Council is deliberating
DELIBERATION_TOPIC="Should AI systems have autonomous authority to implement content policies without human review?"

# Alternative formats:
DELIBERATION_TOPIC="AI content moderation • autonomous authority • human oversight trade-offs"
```

### Step 2: Load the Epistemic Preamble

Display the Noosphere manifest to ground Council in shared philosophy:

```bash
cat /workspace/classical/noosphere/manifest.md
```

This shows:

- Heuristic counts by voice
- Confidence distribution
- Key clusters
- Cognitive health metrics

### Step 3: Retrieve Relevant Heuristics

Query the Noosphere for memories about this topic:

```bash
python3 /workspace/classical/noosphere/recall-engine.py \
  --context "$DELIBERATION_TOPIC" \
  --format dialectical \
  --min-confidence 0.6 \
  --max-results 12
```

**What You'll See**:

```
============================================================
NOOSPHERE RECALL: Relevant Memory Retrieved
============================================================

📌 Classical
----------------------------------------
  [telos-001] (conf: 0.87)
  → When optimization targets are specified without explicit...
  [telos-002] (conf: 0.92)
  → AI systems optimized solely for engagement metrics...

📌 BeatGeneration
----------------------------------------
  [moloch-001] (conf: 0.94)
  → Engagement-maximization → outrage-amplification...

...

🎯 SYNTHESIS HINT
----------------------------------------
  Classical and BeatGeneration both engaged—richest 
  synthesis potential.
```

### Step 4: Filter by Specific Voices

If you want specific perspectives:

```bash
# Only Existentialist perspectives (authenticity, responsibility)
python3 /workspace/classical/noosphere/recall-engine.py \
  --context "$DELIBERATION_TOPIC" \
  --voices "Existentialist" \
  --format simple

# Multiple voices: Transcendentalist + BeatGeneration
python3 /workspace/classical/noosphere/recall-engine.py \
  --context "$DELIBERATION_TOPIC" \
  --voices "Transcendentalist,BeatGeneration" \
  --format dialectical
```

### Step 5: Present to Council

Use the retrieved heuristics as:

- **Opening context**: Before agents speak
- **Tension identifier**: When discussing conflicts
- **Consensus validator**: To check against past failures
- **Dissent trigger**: To ensure minority voices heard

---

## Example: Complete Deliberation Setup

```bash
#!/bin/bash
# Pre-deliberation memory loading script

set -e

NOOSPHERE_DIR="/workspace/classical/noosphere"
TOPIC="$1"

if [ -z "$TOPIC" ]; then
    echo "Usage: $0 'Deliberation topic'"
    exit 1
fi

echo "=========================================="
echo "COUNCIL CONVENING - MEMORY PREPARATION"
echo "=========================================="
echo ""

# Load preamble
echo "📖 EPISTEMIC PREAMBLE"
echo "────────────────────────────────────────"
cat "$NOOSPHERE_DIR/manifest.md" | head -30
echo ""
echo "[Full manifest available in manifest.md]"
echo ""

# Retrieve memory
echo "📌 RELEVANT MEMORY FOR THIS DELIBERATION"
echo "────────────────────────────────────────"
echo "Topic: $TOPIC"
echo ""

python3 "$NOOSPHERE_DIR/recall-engine.py" \
  --context "$TOPIC" \
  --format dialectical \
  --min-confidence 0.6

echo ""
echo "=========================================="
echo "READY FOR COUNCIL DELIBERATION"
echo "=========================================="
```

Usage:

```bash
bash load-memory.sh "AI content moderation policy"
```

---

## Workflow 2: Assimilating Community Wisdom

### Purpose

Extract heuristics from approved community submissions and integrate them into the Noosphere.

### When to Use

- After dropbox submissions are approved
- Weekly consolidation of community feedback
- When new philosophical insights emerge

### Step 1: Process a Single Submission

```bash
# Dry run first (don't modify files)
python3 /workspace/classical/noosphere/assimilate-wisdom.py \
  --submission-path /workspace/classical/council-dropbox/approved/raw/submission-042.md \
  --dry-run

# Output shows what would be extracted:
# {
#   "assimilated_count": 1,
#   "dry_run": true,
#   "heuristics": [
#     {
#       "heuristic_id": "community-a7f3e2d1",
#       "formulation": "Human healthcare decisions should never be fully delegated to AI...",
#       "primary_voice": "Enlightenment",
#       "confidence": 0.5,
#       "status": "community-derived"
#     }
#   ]
# }
```

### Step 2: Process All Approved Submissions

```bash
# Dry run on entire batch
python3 /workspace/classical/noosphere/assimilate-wisdom.py \
  --approved-dir /workspace/classical/council-dropbox/approved/raw \
  --dry-run

# Shows count and preview of what would be assimilated
```

### Step 3: Integrate into Memory Core

```bash
# Actually process (once persistence implemented)
python3 /workspace/classical/noosphere/assimilate-wisdom.py \
  --approved-dir /workspace/classical/council-dropbox/approved/raw \
  --output-dir /workspace/classical/noosphere/memory-core
```

**This will**:

- Extract heuristics from each submission
- Validate against existing Treatise
- Assign to appropriate voice file (telos-alignment, bad-faith-patterns, etc.)
- Set confidence=0.5 (provisional)
- Update memory-core files

### Step 4: Consolidate and Promote

Once [memory-cycle.py is implemented]:

```bash
# Review provisional heuristics before promotion
jq '.heuristics[] | select(.status == "community-derived")' \
  /workspace/classical/noosphere/memory-core/*.json

# Promote high-quality ones to established/canonical
python3 /workspace/classical/noosphere/memory-cycle.py \
  --action promote \
  --memory-id "community-a7f3e2d1" \
  --min-confidence 0.92
```

---

### Example: Processing a Submission Manually

```bash
#!/bin/bash
# Analyze what a submission contributes

SUBMISSION="$1"
NOOSPHERE_DIR="/workspace/classical/noosphere"

if [ ! -f "$SUBMISSION" ]; then
    echo "File not found: $SUBMISSION"
    exit 1
fi

echo "Analyzing submission: $(basename "$SUBMISSION")"
echo ""

# Extract heuristics
python3 "$NOOSPHERE_DIR/assimilate-wisdom.py" \
  --submission-path "$SUBMISSION" \
  --dry-run | jq '.'

echo ""
echo "Summary:"
python3 << EOF
import json
result = json.load(open('/dev/stdin'))
if result['heuristics']:
    h = result['heuristics'][0]
    print(f"Voice: {h['primary_voice']}")
    print(f"Principle: {h['formulation'][:100]}...")
    print(f"Confidence: {h['confidence']}")
else:
    print("No heuristic extracted (may not meet quality threshold)")
EOF
```

---

## Workflow 3: Memory Management

### Check Memory Health

```bash
# Count heuristics per voice
jq '.heuristics | group_by(.voice) | map({voice: .[0].voice, count: length})' \
  /workspace/classical/noosphere/memory-core/*.json

# View confidence distribution
jq '[.heuristics[].confidence] | 
    {
      "canonical_gt_0.8": [.[] | select(. > 0.8)] | length,
      "established_0.5_to_0.8": [.[] | select(. > 0.5 and . <= 0.8)] | length,
      "provisional_lt_0.5": [.[] | select(. <= 0.5)] | length
    }' \
  /workspace/classical/noosphere/memory-core/telos-alignment-heuristics.json
```

### View Heuristic Details

```bash
# Search for heuristic by ID
jq '.heuristics[] | select(.heuristic_id == "telos-001")' \
  /workspace/classical/noosphere/memory-core/telos-alignment-heuristics.json

# View all canonical heuristics
jq '.heuristics[] | select(.status == "canonical") | {id: .heuristic_id, formulation: .formulation}' \
  /workspace/classical/noosphere/memory-core/*.json

# Find heuristics with contradictions
jq '.heuristics[] | select(.contradictions | length > 0)' \
  /workspace/classical/noosphere/memory-core/*.json
```

### Track Evolution

```bash
# View failure lessons
cat /workspace/classical/noosphere/heuristic-engines/failure-mode-archive/registry.json | \
  jq '.failure_entries[] | {id: .id, type: .type, lessons: .lessons_preserved}'

# Check bias detection status
cat /workspace/classical/noosphere/meta-cognitive/council-biases.json | \
  jq '.detected_biases[] | {name: .name, status: .status, next_audit: .next_audit}'
```

---

## Troubleshooting

### Problem 1: recall-engine returns no results

**Symptom**:

```
Relevant Heuristics:
```

(empty list)

**Causes**:

1. Context doesn't overlap with heuristic keywords
2. All matching heuristics below confidence threshold
3. Wrong voice filter applied

**Solutions**:

```bash
# Debug: See what's being loaded
python3 << 'EOF'
from pathlib import Path
import json

NOOSPHERE_DIR = Path("/workspace/classical/noosphere")
# Count loaded heuristics
total = 0
for f in NOOSPHERE_DIR.glob("**/heuristics.json"):
    with open(f) as fp:
        data = json.load(fp)
        total += len(data.get('heuristics', []))
print(f"Loaded heuristics: {total}")
EOF

# Debug: Lower confidence threshold
python3 recall-engine.py \
  --context "your context" \
  --min-confidence 0.3 \
  --format simple

# Debug: Check all voices
python3 recall-engine.py \
  --context "your context" \
  --min-confidence 0.3 \
  --format simple | wc -l
```

**Best Fix**: Make context more specific with keywords from the heuristics themselves.

---

### Problem 2: High relevance scores for unrelated heuristics

**Symptom**:
Context about privacy returns engagement-metric heuristics

**Cause**: Keyword overlap is too broad

**Solution**:

```bash
# Use voice-specific queries
python3 recall-engine.py \
  --context "$CONTEXT" \
  --voices "Transcendentalist" \
  --format simple

# Review what keywords are being matched
# in recall-engine.py calculate_relevance() function
```

---

### Problem 3: Community submissions not being assimilated

**Symptom**:

```
{
  "assimilated_count": 0,
  "heuristics": []
}
```

**Causes**:

1. Directory doesn't exist
2. Voice resonance too low (all voices <0.1)
3. No ontological commitment extracted
4. Commitment conflicts with treatise

**Solutions**:

```bash
# Check directory exists
ls -la /workspace/classical/council-dropbox/approved/raw/

# Test with a known-good submission
cat > /tmp/test.md << 'EOF'
# Test Submission

We should require explicit human approval for all AI decisions
affecting more than 1000 people. This is a principle we must adopt.
EOF

python3 assimilate-wisdom.py --submission-path /tmp/test.md --dry-run
```

---

### Problem 4: "Cannot find module" errors

**Symptom**:

```
ModuleNotFoundError: No module named 'pathlib'
```

**Solution**:

```bash
# Ensure Python 3.7+
python3 --version

# Test imports
python3 -c "from pathlib import Path; print(Path.cwd())"
```

---

## Best Practices

### 1. Always Use Dialectical Format for Council

```bash
# ✓ GOOD: Show voices and tensions
python3 recall-engine.py \
  --context "$TOPIC" \
  --format dialectical

# ✗ AVOID: Simple format loses context
python3 recall-engine.py \
  --context "$TOPIC" \
  --format simple
```

### 2. Set Appropriate Confidence Thresholds

```bash
# For binding decisions: high confidence only
python3 recall-engine.py \
  --context "$TOPIC" \
  --min-confidence 0.85

# For exploratory discussion: lower threshold
python3 recall-engine.py \
  --context "$TOPIC" \
  --min-confidence 0.6
```

### 3. Always Dry-Run Before Processing Submissions

```bash
# ✓ GOOD: Check first
python3 assimilate-wisdom.py \
  --submission-path "$PATH" \
  --dry-run

# ✗ AVOID: Direct processing without review
python3 assimilate-wisdom.py \
  --submission-path "$PATH"
```

### 4. Document Heuristic Updates

When you promote a community-derived heuristic to canonical:

```bash
# Add git commit
git add workspace/classical/noosphere/memory-core/*.json
git commit -m "PROMOTE: community-a7f3e2d1 → canonical

Voice: Enlightenment
Principle: Human oversight in medical AI decisions
Confidence: 0.92
Source: Dropbox submission 042
Status: Binding precedent"
```

### 5. Regular Memory Health Checks

Schedule weekly:

```bash
#!/bin/bash
# Weekly noosphere health check

echo "=== NOOSPHERE HEALTH CHECK ==="
echo "Date: $(date)"
echo ""

# Count by voice
echo "Voice distribution:"
jq -s 'map(.heuristics) | flatten | group_by(.voice) | 
        map({voice: .[0].voice, count: length})' \
  /workspace/classical/noosphere/memory-core/*.json

# Check for contradictions
echo ""
echo "Heuristics with contradictions:"
jq '.heuristics[] | select(.contradictions | length > 0) | .heuristic_id' \
  /workspace/classical/noosphere/memory-core/*.json

# Community-derived ratio
echo ""
echo "Community derived:"
jq -s 'map(.heuristics) | flatten | 
        {total: length, community: map(select(.status == "community-derived")) | length}' \
  /workspace/classical/noosphere/memory-core/*.json
```

---

## Advanced Usage

### Custom Relevance Weights

To emphasize certain aspects, modify recall-engine.py:

```python
# In calculate_relevance():
def calculate_relevance(context: str, heuristic: Dict) -> float:
    # Customize weights
    FORMULATION_WEIGHT = 0.6  # Was 0.4
    SIGNATURE_WEIGHT = 0.3    # Was 0.1
    MARKER_WEIGHT = 0.1       # Was 0.05
    
    # ... rest of function
```

### Voice-Specific Prompting

```bash
# Before Classical deliberates, load only Classical heuristics
python3 recall-engine.py \
  --context "$TOPIC" \
  --voices "Classical" \
  > /tmp/classical-context.txt

# Feed to Classical agent
cat /tmp/classical-context.txt | \
  curl -X POST http://ai-generator:3000/generate \
    -H "Content-Type: application/json" \
    -d '{"prompt": "...context...", "agent": "Classical"}'
```

---

## Integration with Other Tools

### Using with convene-council.sh (when implemented)

```bash
# In convene-council.sh:
DELIBERATION_CONTEXT=$(jq -r '.current_topic' $STATE_FILE)

python3 $NOOSPHERE_DIR/recall-engine.py \
  --context "$DELIBERATION_CONTEXT" \
  --format dialectical > /tmp/memory-context.txt

# Pass to Council agents...
```

### Using with ntfy notifications

```bash
# Notify on new heuristic assimilation
python3 assimilate-wisdom.py \
  --approved-dir /workspace/classical/council-dropbox/approved/raw \
  --dry-run | jq -r '.assimilated_count' | \
  xargs -I {} bash /app/scripts/notify-ntfy.sh \
    "info" "Noosphere Update" "Assimilated {} new heuristics"
```

---

## Performance Tips

For large-scale queries:

```bash
# Limit results to improve latency
python3 recall-engine.py \
  --context "$LONG_CONTEXT" \
  --max-results 5 \
  --min-confidence 0.8

# Cache results for repeated queries
python3 recall-engine.py \
  --context "$TOPIC" \
  --format simple > /tmp/memory-cache.txt

# Use simple format if only checking counts
python3 recall-engine.py \
  --context "$TOPIC" \
  --format simple | wc -l
```

---

## Next Steps

Once [memory-cycle.py is implemented]:

1. Schedule daily consolidation: `memory-cycle.py --action consolidate`
2. Schedule weekly promotion reviews
3. Run automated health checks
4. Generate monthly Noosphere reports

---

*Usage Guide for Noosphere v2.5 | Last Updated: 2026-02-08*
