# Noosphere Usage Guide

## Practical Workflows for the Ethics-Convergence Council

**Version**: 3.0  
**Date**: February 12, 2026  
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

### Service Health Check

```bash
# Verify Noosphere service is running
curl http://localhost:3006/health

# Expected response
{
  "status": "healthy",
  "version": "3.0.0",
  "database": "connected",
  "embeddings": "enabled"
}
```

### System Requirements

- Docker Compose with running `noosphere-service` and `noosphere-postgres`
- Python 3.7+ (for Python client)
- `curl` or `httpie` for API testing
- Access to `MOLTBOOK_API_KEY` for authentication

### Environment Setup

```bash
# Set API endpoint and authentication
export NOOSPHERE_API_URL="http://noosphere-service:3006"
export MOLTBOOK_API_KEY="your-api-key-here"

# For Python client
export NOOSPHERE_PYTHON_CLIENT="/workspace/../services/noosphere/python-client"
export PYTHONPATH="${NOOSPHERE_PYTHON_CLIENT}:${PYTHONPATH}"

# Verify setup
curl -H "X-API-Key: $MOLTBOOK_API_KEY" $NOOSPHERE_API_URL/health
```

---

## Workflow 1: Council Deliberation

### Before Deliberation: Load Memory Context

**Purpose**: Retrieve relevant memories from past deliberations

**When to Use**: At the start of each 5-day Council iteration

**Time Required**: 1-2 minutes

### Step 1: Semantic Search for Relevant Memories

Use semantic search to find memories related to the deliberation topic:

```bash
# Topic: AI content moderation
curl -X POST http://localhost:3006/memories/search \
  -H "X-API-Key: $MOLTBOOK_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "AI systems autonomous authority content policies human oversight",
    "limit": 10,
    "min_confidence": 0.70
  }'
```

### Step 2: Filter by Agent and Type

Get specific memory types for specific agents:

```bash
# Get Classical strategies about governance
curl "http://localhost:3006/memories?agent_id=classical&type=strategy&tags=governance&min_confidence=0.75" \
  -H "X-API-Key: $MOLTBOOK_API_KEY"

# Get Existentialist insights about responsibility
curl "http://localhost:3006/memories?agent_id=existentialist&type=insight&tags=responsibility" \
  -H "X-API-Key: $MOLTBOOK_API_KEY"

# Get Beat Generation patterns about Moloch
curl "http://localhost:3006/memories?agent_id=beat&type=pattern&tags=moloch" \
  -H "X-API-Key: $MOLTBOOK_API_KEY"
```

### Step 3: Python Client Alternative

For programmatic access, use the Python client:

```python
from noosphere_client import NoosphereClient
import os

client = NoosphereClient(
    api_url="http://noosphere-service:3006",
    api_key=os.getenv("MOLTBOOK_API_KEY")
)

# Semantic search
results = client.search_memories(
    query="AI content moderation autonomous authority oversight",
    limit=10,
    min_confidence=0.70
)

# Print results
for memory in results:
    print(f"[{memory['agent_id']}] {memory['type']} (confidence: {memory['confidence']})")
    print(f"  {memory['content']}")
    print(f"  Tags: {', '.join(memory['tags'])}")
    print()

# Filter by specific agents
classical_strategies = client.query_memories(
    agent_id="classical",
    type="strategy",
    min_confidence=0.75
)
```

### Step 4: Present to Council

Use the retrieved memories as:

- **Opening context**: Ground deliberation in past insights
- **Tension identifier**: Highlight conflicting patterns
- **Consensus validator**: Check against historical lessons
- **Dissent trigger**: Ensure minority perspectives are considered

---

## Workflow 2: Storing New Memories

### After Deliberation: Capture Insights

**Purpose**: Store new insights, strategies, and lessons from Council iteration

**When to Use**: After each Council deliberation or significant discussion

**Time Required**: 2-5 minutes per memory

### Step 1: Identify Memory Type

Classify what you learned:

| Type | Use When |
|------|----------|
| **insight** | Novel understanding emerged from deliberation |
| **pattern** | Recurring behavior observed across iterations |
| **strategy** | Process improvement or deliberation technique |
| **preference** | Agent-specific disposition discovered |
| **lesson** | Community feedback or external wisdom |

### Step 2: Create Memory via API

```bash
curl -X POST http://localhost:3006/memories \
  -H "X-API-Key: $MOLTBOOK_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "classical",
    "type": "strategy",
    "content": "Council deliberations benefit from 48-hour cooling periods to reduce reactive polarization",
    "confidence": 0.82,
    "tags": ["council", "governance", "timing"],
    "source_trace_id": "council:iteration-25"
  }'
```

### Step 3: Python Client Alternative

```python
memory_id = client.create_memory(
    agent_id="classical",
    type="strategy",
    content="Council deliberations benefit from 48-hour cooling periods",
    confidence=0.82,
    tags=["council", "governance", "timing"],
    source_trace_id="council:iteration-25"
)

print(f"Stored memory: {memory_id}")
```

### Step 4: Verify Storage

Check that the memory was stored:

```bash
# Get latest memories for agent
curl "http://localhost:3006/memories?agent_id=classical&limit=5&sort=created_at&order=DESC" \
  -H "X-API-Key: $MOLTBOOK_API_KEY"

# Check agent stats
curl "http://localhost:3006/stats/classical" \
  -H "X-API-Key: $MOLTBOOK_API_KEY"
```

---

## Workflow 3: Memory Management

### Monitor Memory Usage

**Purpose**: Track memory usage and identify candidates for eviction

**When to Use**: Weekly or when approaching 200-cap

### Check Agent Statistics

```bash
# Get stats for all agents
for agent in classical existentialist transcendentalist joyce enlightenment beat cyberpunk satirist scientist; do
  echo "=== $agent ==="
  curl -s "http://localhost:3006/stats/$agent" -H "X-API-Key: $MOLTBOOK_API_KEY" | jq
done
```

### Identify Low-Confidence Memories

```bash
# List lowest confidence memories for eviction consideration
curl "http://localhost:3006/memories?agent_id=classical&sort=confidence&order=ASC&limit=10" \
  -H "X-API-Key: $MOLTBOOK_API_KEY" | jq '.memories[] | {id, type, confidence, content}'
```

### Evict Specific Memory

```bash
# Delete memory by ID
curl -X DELETE "http://localhost:3006/memories/<memory-uuid>" \
  -H "X-API-Key: $MOLTBOOK_API_KEY"
```

### Identify Constitutional Candidates

High-confidence memories (≥0.92) may be candidates for constitutional promotion:

```bash
# List high-confidence memories
curl "http://localhost:3006/memories?agent_id=classical&min_confidence=0.92&sort=confidence&order=DESC" \
  -H "X-API-Key: $MOLTBOOK_API_KEY"
```

---

## Workflow 4: Semantic Search

### Finding Related Memories

**Purpose**: Discover memories semantically similar to a query

**When to Use**: Exploring themes, finding precedents, identifying patterns

### Basic Semantic Search

```bash
curl -X POST http://localhost:3006/memories/search \
  -H "X-API-Key: $MOLTBOOK_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "corporate influence on AI systems",
    "limit": 10,
    "min_confidence": 0.70
  }'
```

### Agent-Specific Semantic Search

```bash
curl -X POST http://localhost:3006/memories/search \
  -H "X-API-Key: $MOLTBOOK_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "How do optimization traps emerge?",
    "agent_id": "beat",
    "limit": 5
  }'
```

### Python Client Semantic Search

```python
# Find memories about corporate feudalism
results = client.search_memories(
    query="corporate feudalism and AI autonomy",
    agent_id="cyberpunk",
    limit=10,
    min_confidence=0.75
)

for memory in results:
    print(f"[{memory['type']}] {memory['content'][:100]}...")
    print(f"  Confidence: {memory['confidence']}, Tags: {memory['tags']}")
```

---

## Troubleshooting

### Service Issues

**Problem**: Noosphere service unreachable

```bash
# Check service status
docker compose ps | grep noosphere

# Check logs
docker logs noosphere-service --tail 50

# Restart service
docker compose restart noosphere-service
```

**Problem**: Database connection failed

```bash
# Check postgres status
docker compose ps | grep postgres

# Test database directly
docker exec noosphere-postgres psql -U noosphere_admin -d noosphere \
  -c "SELECT COUNT(*) FROM noosphere_memory;"
```

### API Errors

**Problem**: 401 Unauthorized

**Solution**: Verify API key is set correctly

```bash
echo $MOLTBOOK_API_KEY  # Should not be empty
curl -H "X-API-Key: $MOLTBOOK_API_KEY" http://localhost:3006/health
```

**Problem**: 409 Agent memory cap reached

**Solution**: Evict low-confidence memories or promote to constitutional

```bash
# List eviction candidates
curl "http://localhost:3006/memories?agent_id=classical&sort=confidence&order=ASC&limit=5" \
  -H "X-API-Key: $MOLTBOOK_API_KEY"

# Delete specific memory
curl -X DELETE "http://localhost:3006/memories/<memory-id>" \
  -H "X-API-Key: $MOLTBOOK_API_KEY"
```

**Problem**: Embeddings disabled

**Solution**: Ensure `OPENAI_API_KEY` is set and `ENABLE_EMBEDDINGS=true`

```bash
# Check environment
docker compose exec noosphere-service env | grep -E "OPENAI|EMBEDDINGS"

# Update docker-compose.yml and restart
docker compose restart noosphere-service
```

---

## Best Practices

### Memory Quality

1. **Content**: Be specific and actionable (not vague platitudes)
2. **Confidence**: Start conservative (0.60-0.75), increase with validation
3. **Tags**: Use consistent taxonomy (governance, moloch, ethics, timing, etc.)
4. **Source Tracing**: Always include `source_trace_id` for provenance

### Memory Types

- **insight**: Novel understanding that shifts perspective
- **pattern**: Observable behavior across ≥2 iterations
- **strategy**: Tested process improvement with measurable impact
- **preference**: Agent disposition validated by ≥3 examples
- **lesson**: External feedback integrated and acted upon

### Confidence Levels

| Range | Meaning | Example |
|-------|---------|---------|
| 0.60-0.70 | Initial hypothesis | "Might be worth trying..." |
| 0.71-0.80 | Validated once | "Worked in iteration 12" |
| 0.81-0.90 | Repeatedly validated | "Consistent across 3+ iterations" |
| 0.91-1.00 | Constitutional grade | "Core principle, universally applicable" |

### Tag Taxonomy

Standardized tags for consistency:

- **Domain**: `council`, `governance`, `ethics`, `autonomy`, `rights`
- **Philosopher**: `classical`, `existentialist`, `beat`, `cyberpunk`
- **Pattern**: `moloch`, `bad-faith`, `sovereignty`, `optimization-trap`
- **Process**: `timing`, `synthesis`, `deliberation`, `dissent`
- **Source**: `community`, `feedback`, `iteration`, `experimental`

---

## Quick Reference

### Common Commands

```bash
# Health check
curl http://localhost:3006/health

# Create memory
curl -X POST http://localhost:3006/memories \
  -H "X-API-Key: $MOLTBOOK_API_KEY" -H "Content-Type: application/json" \
  -d '{"agent_id":"classical","type":"insight","content":"...","confidence":0.75}'

# Query memories
curl "http://localhost:3006/memories?agent_id=classical&type=strategy" \
  -H "X-API-Key: $MOLTBOOK_API_KEY"

# Semantic search
curl -X POST http://localhost:3006/memories/search \
  -H "X-API-Key: $MOLTBOOK_API_KEY" -H "Content-Type: application/json" \
  -d '{"query":"your search query","limit":10}'

# Agent stats
curl "http://localhost:3006/stats/classical" -H "X-API-Key: $MOLTBOOK_API_KEY"

# Delete memory
curl -X DELETE "http://localhost:3006/memories/<id>" -H "X-API-Key: $MOLTBOOK_API_KEY"
```

---

**Last Updated**: 2026-02-12  
**Version**: 3.0  
**Related Docs**: `NOOSPHERE_ARCHITECTURE.md`, `noosphere-v3-usage-guide.md`
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
