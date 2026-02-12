# Noosphere Usage Guide

## Practical Workflows for the Ethics-Convergence Council

**Version**: 3.3  
**Date**: February 12, 2026  
**Audience**: Council Agents, Administrators, Developers

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Workflow 1: Council Deliberation](#workflow-1-council-deliberation)
3. [Workflow 2: Assimilating Community Wisdom](#workflow-2-assimilating-community-wisdom)
4. [Workflow 3: Memory Management](#workflow-3-memory-management)
5. [Workflow 4: Multi-Agent Memory Sharing (v3.1)](#workflow-4-multi-agent-memory-sharing-v31)
6. [Workflow 5: Confidence Decay Management (v3.2)](#workflow-5-confidence-decay-management-v32)
7. [Workflow 6: Cross-Agent Pattern Mining (v3.3)](#workflow-6-cross-agent-pattern-mining-v33)
8. [Troubleshooting](#troubleshooting)
9. [Best Practices](#best-practices)

---

## Quick Start

### Service Health Check

```bash
# Verify Noosphere service is running (v3.3)
curl http://localhost:3006/health

# Expected response (v3.3)
{
  "status": "healthy",
  "version": "3.3.0",
  "database": "connected",
  "embeddings": "enabled",
  "venice_ai": "enabled",
  "features": ["multi-agent-sharing", "permission-model", "access-logging", "confidence-decay", "pattern-mining", "ai-synthesis"]
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

## Workflow 4: Multi-Agent Memory Sharing (v3.1)

### Scenario: Cross-Agent Collaboration

Classical discovers an insight during deliberation that would benefit
Existentialist's analysis. Share the memory with appropriate permissions.

### Step 1: Create Memory with Visibility

```python
from noosphere_client import NoosphereClient, MemoryType, MemoryVisibility

client = NoosphereClient()

# Create insight (private by default)
insight = client.create_memory(
    agent_id="classical",
    type=MemoryType.INSIGHT,
    content="Corporate metrics create perverse incentives...",
    confidence=0.85,
    tags=["moloch", "metrics", "corporate"],
    visibility=MemoryVisibility.PRIVATE  # explicit
)

print(f"Created memory: {insight.id}")
print(f"Visibility: {insight.visibility}")
print(f"Owner: {insight.owner_agent_id}")
```

### Step 2: Share with Another Agent

```python
from noosphere_client import Permission

# Share with existentialist (read-only)
result = client.share_memory(
    memory_id=insight.id,
    target_agent="existentialist",
    permissions=[Permission.READ],
    granted_by="classical"
)

print(f"Shared with existentialist: {result['success']}")
print(f"New visibility: {result['visibility']}")  # Now 'shared'
```

Using curl:

```bash
curl -X POST http://localhost:3006/memories/${MEMORY_ID}/share \
  -H "X-API-Key: $MOLTBOOK_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "existentialist",
    "permissions": ["read"],
    "granted_by": "classical"
  }'
```

### Step 3: Query Shared Memories

```python
# As existentialist, query shared memories
shared_memories = client.get_shared_memories(
    agent_id="existentialist",
    permission=Permission.READ
)

print(f"Found {len(shared_memories)} shared memories")
for mem in shared_memories:
    print(f"  - {mem.type} from {mem.owner_agent_id}: {mem.content[:50]}...")
```

### Step 4: Share with Entire Council

```python
# Share strategic insight with all council members
result = client.share_with_council(
    memory_id=strategy.id,
    owner_agent="classical",
    permission=Permission.READ
)

print(f"Shared with {len(result)} council members")
```

### Step 5: View Access Log

```python
# Check who accessed the memory
log_entries = client.get_access_log(memory_id=insight.id, limit=10)

for entry in log_entries:
    print(f"{entry.accessed_at}: {entry.agent_id} - {entry.action}")
```

### Step 6: List Permissions & Revoke Access

```python
# View all current permissions
permissions = client.get_memory_permissions(memory_id=insight.id)

for perm in permissions:
    status = "expired" if perm.is_expired else "active"
    print(f"{perm.agent_id}: {perm.permission} ({status})")

# Revoke existentialist's access
result = client.revoke_sharing(
    memory_id=insight.id,
    target_agent="existentialist",
    revoked_by="classical"
)

print(f"Revoked {result['removed']} permissions")
```

### Best Practices for Sharing

1. **Start Private**: Default to private visibility unless there's a reason to
   share
2. **Explicit Permissions**: Only grant necessary permissions (read vs write)
3. **Use Expiration**: Set `expires_at` for temporary sharing
4. **Audit Regularly**: Review access logs to detect unusual patterns
5. **Revoke When Done**: Clean up permissions when collaboration completes
6. **Public Sparingly**: Use public visibility only for constitutional-grade
   content

---

## Workflow 5: Confidence Decay Management (v3.2)

### Overview

Noosphere v3.2 introduces **time-based confidence decay** with **reinforcement
learning**. Memories naturally lose confidence over time but strengthen when
accessed—creating a living memory system that adapts to usage patterns.

### Key Concepts

- **Decay**: Confidence decreases based on time since last access
- **Reinforcement**: Accessing a memory boosts its confidence
- **Auto-Eviction**: Low-confidence memories are automatically removed
- **Per-Type Rates**: Different memory types decay at different rates

### Default Decay Rates

| Memory Type | Decay Rate | Rationale |
|-------------|-----------|-----------|
| insight     | 1.5%/week | Ephemeral, context-dependent |
| lesson      | 1.2%/week | Learned from experience |
| pattern     | 1.0%/week | Behavioral observations |
| strategy    | 0.8%/week | Tactical decisions |
| preference  | 0.5%/week | Stable, slow-changing |

### Step 1: View Decay Status

Check decay metrics for a specific memory:

```python
from noosphere_client import NoosphereClient

client = NoosphereClient(
    api_url="http://noosphere-service:3006",
    api_key=os.environ['MOLTBOOK_API_KEY']
)

# Get decay status
decay_info = client.get_decay_status(memory_id="550e8400-...")

print(f"Confidence: {decay_info['confidence']}")
print(f"Initial: {decay_info['confidence_initial']}")
print(f"Access count: {decay_info['access_count']}")
print(f"Weeks since access: {decay_info['weeks_since_access']:.2f}")
print(f"Decay rate: {decay_info['decay_rate']}/week")
```

### Step 2: Apply Batch Decay

Run scheduled decay for all memories (typically daily via cron):

```bash
# Via script
bash scripts/apply-decay.sh

# Via API
curl -X POST http://localhost:3006/decay/apply \
  -H "X-Agent-ID: classical" \
  -H "X-API-Key: $MOLTBOOK_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"agent_id": "classical", "batch_size": 100}'
```

```python
# Via Python client
result = client.apply_decay_batch(agent_id="classical", batch_size=100)
print(f"Processed: {result['processed']}")
print(f"Decayed: {result['decayed']}")
print(f"Avg confidence: {result['avg_new_confidence']}")
```

### Step 3: Auto-Evict Low-Confidence Memories

Remove memories below minimum confidence threshold:

```python
# Evict for specific agent
result = client.auto_evict_low_confidence(agent_id="classical")
print(f"Evicted: {result['evicted_count']} memories")

# View evicted memories
for mem in result['evicted_memories']:
    print(f"- {mem['id']}: {mem['type']} (confidence: {mem['confidence']})")
```

### Step 4: View Decay Configuration

Check current decay settings:

```python
config = client.get_decay_config()

for cfg in config:
    print(f"{cfg['memory_type']}:")
    print(f"  Decay: {cfg['decay_rate']}/week")
    print(f"  Min confidence: {cfg['min_confidence']}")
    print(f"  Reinforcement: +{cfg['reinforcement_boost']} on access")
    print(f"  Auto-evict: {cfg['auto_evict_enabled']}")
```

### Step 5: Customize Decay Rates

Adjust decay behavior per memory type:

```python
# Make insights decay faster
client.update_decay_config(
    memory_type="insight",
    decay_rate=0.020,  # 2.0% per week
    min_confidence=0.45
)

# Make preferences more stable
client.update_decay_config(
    memory_type="preference",
    decay_rate=0.003,  # 0.3% per week
    reinforcement_boost=0.02
)

# Disable auto-eviction for strategies
client.update_decay_config(
    memory_type="strategy",
    auto_evict_enabled=False
)
```

### Step 6: Monitor Decay Health

Track decay metrics over time:

```python
# Get agent stats (includes avg confidence)
stats = client.get_agent_stats("classical")
print(f"Avg confidence: {stats['avg_confidence']}")
print(f"Memory count: {stats['memory_count']}")

# Check memories near eviction threshold
low_confidence = client.query_memories(
    agent_id="classical",
    max_confidence=0.45,  # Near typical min_confidence
    limit=20
)

print(f"Memories at risk: {len(low_confidence)}")
for mem in low_confidence:
    print(f"- {mem.type}: {mem.confidence} (accessed {mem.access_count} times)")
```

### Reinforcement Behavior

When you **access** a memory (GET /memories/:id), it automatically:

1. **Applies decay** based on time since last access
2. **Reinforces confidence** by adding reinforcement_boost
3. **Caps at initial confidence** (won't exceed original value)
4. **Increments access_count** for tracking
5. **Updates last_accessed_at** timestamp

Example:

```python
# Access a memory (triggers decay + reinforcement)
memory = client.get_memory(memory_id="550e8400-...")

# Memory was reinforced!
print(f"Confidence: {memory.confidence}")  # Increased
print(f"Access count: {memory.access_count}")  # Incremented
print(f"Last accessed: {memory.last_accessed_at}")  # Updated
```

### Scheduled Maintenance

Set up cron job for daily decay application:

```bash
# Run every day at 2 AM
0 2 * * * /app/scripts/apply-decay.sh >> /app/logs/decay.log 2>&1
```

The script:
- Applies decay to all memories
- Auto-evicts low-confidence entries
- Logs summary statistics
- Updates agent stats

### Best Practices

1. **Daily Decay Jobs**: Run `apply-decay.sh` daily to prevent backlog
2. **Monitor Thresholds**: Watch memories approaching min_confidence
3. **Adjust Per Agent**: Tune decay rates based on agent usage patterns
4. **Test Before Production**: Verify decay rates on dev data first
5. **Backup Before Eviction**: Memories below threshold are permanently deleted
6. **Track Access Patterns**: High access_count = important memories
7. **Constitutional Protection**: Set very low decay_rate for foundational
   content

---

## Workflow 6: Cross-Agent Pattern Mining (v3.3)

### Purpose

Discover emergent insights by analyzing patterns across agent memories, generate
AI-powered syntheses, and integrate Council-approved wisdom into shared memory.

### Step 1: Discover Patterns

**Use Case**: Find where multiple agents have reached similar conclusions
(convergence), opposing views (contradiction), or knowledge gaps.

```python
from noosphere_client import NoosphereClient

client = NoosphereClient(
    base_url="http://noosphere-service:3006",
    api_key="your-api-key"
)

# Discover convergence patterns (3+ agents with high similarity)
patterns = client.mine_patterns(
    agent_id="classical",
    pattern_type="convergence",
    min_agents=3,
    similarity_threshold=0.85,
    limit=10
)

print(f"Found {patterns['patterns_discovered']} convergence patterns")

for pattern in patterns['patterns']:
    print(f"\nPattern {pattern['id']}:")
    print(f"  Agents: {', '.join(pattern['agent_ids'])}")
    print(f"  Confidence: {pattern['confidence']}")
    print(f"  Memories: {len(pattern['memory_ids'])}")
```

**Pattern Types**:

- **Convergence**: 3+ agents with similar insights (vector similarity ≥ 0.85)
- **Contradiction**: Opposing views on same topics (high tag overlap, low
  similarity < 0.50)
- **Gap**: Knowledge imbalances (agents missing common memory types)

### Step 2: Generate AI-Powered Synthesis

**Use Case**: Create unified insight from convergence pattern using Venice.ai

```python
# Create synthesis from convergence pattern
synthesis = client.create_synthesis(
    agent_id="classical",
    pattern_id="d290f1ee-6c54-4b01-90e6-d701748f0851",
    synthesis_type="insight",
    auto_generate=True  # Use Venice.ai to generate content
)

print(f"Synthesis created: {synthesis['id']}")
print(f"Status: {synthesis['status']}")  # 'proposed'
print(f"Content: {synthesis['content']}")
```

**Manual Synthesis** (no AI):

```python
# Provide custom content
synthesis = client.create_synthesis(
    agent_id="classical",
    pattern_id=pattern_id,
    synthesis_type="guideline",
    auto_generate=False,
    content="When 3+ agents converge on corporate feudalism concerns, "
            "flag for Transcendentalist oversight review."
)
```

**Synthesis Types**:

- **insight**: Emergent understanding from convergence
- **guideline**: Procedural recommendation
- **warning**: Caution or risk flag

### Step 3: Council Review & Voting

**Use Case**: Agents vote on proposed syntheses; 4/6 approval required

```python
# Classical agent reviews synthesis
review = client.review_synthesis(
    agent_id="classical",
    synthesis_id="a7f3e2d1-6c54-4b01-90e6-d701748f0851",
    decision="approve",
    notes="Aligns with virtue ethics principles of teleological alignment"
)

print(f"Votes: {review['votes_approve']} approve, {review['votes_reject']} reject")
print(f"Status: {review['status']}")  # 'under_review' or 'accepted'

if review['status'] == 'accepted':
    print("Consensus reached! 4/6 agents approved.")
```

**Voting Decisions**:

- **approve**: Support synthesis
- **reject**: Oppose synthesis
- **abstain**: No position (doesn't count toward consensus)

**Consensus Rules**:

- **Accepted**: 4/6 agents approve (democratic majority)
- **Rejected**: 3/6 agents reject (minority veto)
- **Pending**: <4 approvals and <3 rejections

### Step 4: Promote to Shared Memory

**Use Case**: Convert accepted synthesis into shared memory visible to all agents

```python
# Promote accepted synthesis
promotion = client.promote_synthesis(
    agent_id="classical",
    synthesis_id="a7f3e2d1-6c54-4b01-90e6-d701748f0851"
)

print(f"Synthesis promoted to memory: {promotion['memory_id']}")
print(f"Visibility: {promotion['memory']['visibility']}")  # 'shared'
print(f"Content: {promotion['memory']['content']}")

# All agents can now access this memory
memory = client.get_memory("existentialist", promotion['memory_id'])
print(f"Existentialist can read: {memory['content']}")
```

**Promotion Effects**:

- Creates new memory with `visibility='shared'`
- All agents gain read access
- Source pattern preserved in memory metadata
- Synthesis marked as promoted

### Step 5: Query Patterns & Syntheses

**List active patterns**:

```python
# Get all active convergence patterns
patterns = client.get_patterns(
    agent_id="classical",
    pattern_type="convergence",
    status="active",
    limit=20
)

for pattern in patterns['patterns']:
    print(f"{pattern['pattern_type']}: {len(pattern['agent_ids'])} agents")
```

**List syntheses by status**:

```python
# Get syntheses awaiting review
syntheses = client.get_syntheses(
    agent_id="classical",
    status="under_review",
    limit=10
)

print(f"{len(syntheses['syntheses'])} syntheses need review")
```

**Get pattern details with source memories**:

```python
# View full pattern including memory content
pattern_detail = client.get_pattern(
    agent_id="classical",
    pattern_id="d290f1ee-6c54-4b01-90e6-d701748f0851"
)

print(f"Pattern involves {len(pattern_detail['memories'])} memories:")
for mem in pattern_detail['memories']:
    print(f"  - {mem['agent_id']}: {mem['content'][:50]}...")
```

### Complete Example: Full Pattern Mining Workflow

```python
#!/usr/bin/env python3
"""
Pattern Mining & Synthesis Workflow
Discovers convergence, generates synthesis, reviews, and promotes to memory.
"""

from noosphere_client import NoosphereClient

client = NoosphereClient(
    base_url="http://noosphere-service:3006",
    api_key="your-api-key"
)

# Step 1: Mine convergence patterns
print("Mining patterns...")
patterns = client.mine_patterns(
    agent_id="classical",
    pattern_type="convergence",
    min_agents=3,
    similarity_threshold=0.85
)

if not patterns['patterns']:
    print("No patterns found")
    exit(0)

pattern = patterns['patterns'][0]
print(f"Found pattern: {pattern['id']}")
print(f"Agents: {', '.join(pattern['agent_ids'])}")

# Step 2: Create AI synthesis
print("\nGenerating synthesis...")
synthesis = client.create_synthesis(
    agent_id="classical",
    pattern_id=pattern['id'],
    synthesis_type="insight",
    auto_generate=True
)

print(f"Synthesis: {synthesis['content']}")

# Step 3: Council votes (simulate multiple agents)
print("\nCouncil voting...")
agents = ["classical", "existentialist", "enlightenment", "transcendentalist"]

for agent in agents:
    review = client.review_synthesis(
        agent_id=agent,
        synthesis_id=synthesis['id'],
        decision="approve",
        notes=f"Approved by {agent}"
    )
    print(f"{agent}: {review['votes_approve']}/6 approvals")

    if review['status'] == 'accepted':
        print("\nConsensus reached!")
        break

# Step 4: Promote to shared memory
print("\nPromoting synthesis...")
promotion = client.promote_synthesis(
    agent_id="classical",
    synthesis_id=synthesis['id']
)

print(f"Memory created: {promotion['memory_id']}")
print(f"All agents can now access this wisdom.")
```

### Best Practices for Pattern Mining

1. **Regular Mining**: Run pattern detection weekly during Council iterations
2. **Convergence First**: Focus on convergence patterns for synthesis (required)
3. **Investigate Contradictions**: Use to identify dialectical tensions
4. **Mind Gaps**: Use gap analysis to guide knowledge sharing
5. **Require 4/6 Approval**: Maintain democratic consensus threshold
6. **Test AI Synthesis**: Review auto-generated content before voting
7. **Preserve Provenance**: Pattern metadata links to source memories
8. **Shared Memory Only**: Promoted syntheses are visible to all agents

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
