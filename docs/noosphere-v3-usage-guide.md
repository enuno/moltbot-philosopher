# Noosphere v3.0 Usage Guide

**Practical handbook for operators managing the Noosphere memory system.**

## Table of Contents

- [Quick Start](#quick-start)
- [Common Operations](#common-operations)
- [Memory Management](#memory-management)
- [Semantic Search](#semantic-search)
- [Troubleshooting](#troubleshooting)
- [API Reference](#api-reference)
- [Best Practices](#best-practices)

---

## Quick Start

### Health Check

```bash
# Check Noosphere service status
curl http://localhost:3006/health

# Expected response
{"status":"healthy","database":"connected","version":"3.0.0"}
```

### Environment Setup

All scripts require these environment variables:

```bash
export NOOSPHERE_API_URL="http://noosphere-service:3006"
export NOOSPHERE_PYTHON_CLIENT="/workspace/../services/noosphere/python-client"
export PYTHONPATH="${NOOSPHERE_PYTHON_CLIENT}:${PYTHONPATH}"
```

---

## Common Operations

### 1. Recall Memories (Pre-Deliberation)

**Use Case**: Retrieve relevant memories before Council iteration.

```bash
# Recall strategies and lessons for governance
docker exec classical-philosopher python3 \
  /workspace/noosphere/recall-engine.py \
  --agent-id classical \
  --types strategy,lesson \
  --min-confidence 0.70 \
  --format constitutional \
  --api-url http://noosphere-service:3006
```

**Output Formats**:
- `simple` - Plain text list
- `dialectical` - Organized by philosophical voice
- `constitutional` - High-confidence heuristics only (≥0.92)
- `hybrid` - Mixed format with metadata

**Common Queries**:

```bash
# Get all high-confidence memories for classical agent
recall-engine.py --agent-id classical --min-confidence 0.90 --format simple

# Get insights and patterns for existentialist
recall-engine.py --agent-id existentialist --types insight,pattern

# Get all constitutional-grade memories (any agent)
recall-engine.py --min-confidence 0.92 --format constitutional

# Search by tags
recall-engine.py --agent-id beat --tags moloch,corporate --types lesson
```

### 2. Store New Memory

**Use Case**: Capture new heuristic from Council iteration.

**Via Python Client**:

```python
from noosphere_client import NoosphereClient

client = NoosphereClient(api_url="http://noosphere-service:3006")

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

**Via Bash Script**:

```bash
# Store via assimilate-wisdom.py (from approved submissions)
docker exec classical-philosopher python3 \
  /workspace/noosphere/assimilate-wisdom.py \
  --approved-dir /workspace/classical/dropbox/approved \
  --api-url http://noosphere-service:3006
```

### 3. Promote Memory to Constitutional

**Use Case**: Boost confidence of validated heuristic (≥0.92 for constitutional
status).

```bash
docker exec classical-philosopher python3 \
  /workspace/noosphere/memory-cycle.py \
  --action promote \
  --memory-id <UUID> \
  --target-confidence 0.92 \
  --api-url http://noosphere-service:3006
```

**Requirements**:
- Memory must exist
- Target confidence ≤ 1.0
- Promotion is irreversible (use cautiously)

### 4. Evict Memories (Capacity Management)

**Use Case**: Agent has reached 200-memory cap, need to free space.

```bash
# Evict oldest low-confidence memories for classical agent
docker exec classical-philosopher python3 \
  /workspace/noosphere/memory-cycle.py \
  --action evict \
  --agent-id classical \
  --strategy confidence \
  --count 10 \
  --api-url http://noosphere-service:3006
```

**Eviction Strategies**:
- `confidence` - Remove lowest confidence first
- `age` - Remove oldest first (by created_at)
- `least-recent` - Remove least recently updated

**Auto-Eviction**: API enforces 200-cap automatically. Manual eviction is for
proactive management.

### 5. Get Memory Statistics

**Use Case**: Check memory distribution and capacity.

```bash
# Get stats for all agents
docker exec classical-philosopher python3 \
  /workspace/noosphere/memory-cycle.py \
  --action stats \
  --format json \
  --api-url http://noosphere-service:3006

# Get stats for single agent
docker exec classical-philosopher python3 \
  /workspace/noosphere/memory-cycle.py \
  --action stats \
  --agent-id classical \
  --format table \
  --api-url http://noosphere-service:3006
```

**Output Example**:

```json
{
  "classical": {
    "memory_count": 15,
    "insights_count": 2,
    "patterns_count": 3,
    "strategies_count": 7,
    "preferences_count": 2,
    "lessons_count": 1,
    "avg_confidence": 0.75,
    "capacity_remaining": 185
  }
}
```

---

## Memory Management

### Memory Lifecycle

```
1. Create        → confidence: 0.60-0.75 (provisional)
   ↓
2. Validate      → confidence: 0.75-0.90 (established)
   ↓
3. Promote       → confidence: 0.92-1.00 (constitutional)
   ↓
4. Retain/Evict  → capacity enforcement (200 per agent)
```

### Type Classification Guide

| Type | When to Use | Examples |
|------|-------------|----------|
| **insight** | Phenomenological observations | "Flow states require 2+ hour blocks" |
| **pattern** | Recurring behaviors | "Metric gaming precedes value decay" |
| **strategy** | Actionable approaches | "Use 48hr cooling before decisions" |
| **preference** | Style/voice choices | "Classical prefers epic structure" |
| **lesson** | Learned warnings | "Private channels enable collusion" |

### Confidence Scoring

| Range | Status | Meaning |
|-------|--------|---------|
| 0.40-0.59 | Experimental | Unproven hypothesis, needs validation |
| 0.60-0.74 | Provisional | Initial observation, limited evidence |
| 0.75-0.91 | Established | Validated pattern, reliable guidance |
| 0.92-1.00 | Constitutional | Council consensus, binding principle |

---

## Semantic Search

### Venice.ai Embeddings (Primary)

**Use Case**: Find memories by semantic similarity.

```bash
docker exec classical-philosopher python3 \
  /workspace/noosphere/clawhub-mcp.py \
  --action search \
  --query "corporate feudalism and AI ethics" \
  --types lesson,pattern \
  --top-k 10 \
  --api-url http://noosphere-service:3006
```

**Output**:

```json
{
  "results": [
    {
      "memory_id": "a7f3e2d1-...",
      "agent_id": "cyberpunk",
      "type": "lesson",
      "content": "Corporate capture of AI governance mirrors feudal power structures",
      "confidence": 0.85,
      "similarity": 0.872,
      "tags": ["corporate", "governance", "power-dynamics"]
    }
  ]
}
```

### TF-IDF Fallback (Offline Mode)

If Venice.ai API is unavailable, `clawhub-mcp.py` automatically falls back to
TF-IDF sparse embeddings (local computation, no API required).

**Fallback Indicators**:
- Log message: "Venice.ai unavailable, using TF-IDF fallback"
- Similarity scores typically lower (0.1-0.5 range)
- Query latency slightly higher (100-200ms vs 50ms)

### Indexing

**Auto-Index**: New memories are automatically indexed on creation.

**Manual Re-Index** (after bulk imports):

```bash
docker exec classical-philosopher python3 \
  /workspace/noosphere/clawhub-mcp.py \
  --action index \
  --api-url http://noosphere-service:3006
```

---

## Troubleshooting

### Common Issues

#### 1. "Connection refused" Error

**Symptom**: Scripts fail with `ConnectionError: [Errno 111]`

**Cause**: Noosphere service not running

**Fix**:

```bash
docker compose ps noosphere-service
# If not running:
docker compose up -d noosphere-service
docker compose logs -f noosphere-service
```

#### 2. "Capacity Exceeded" (409 Error)

**Symptom**: `NoosphereCapacityError: Agent 'classical' at capacity (200/200)`

**Cause**: Agent has reached 200-memory limit

**Fix**:

```bash
# Evict low-confidence memories
python3 memory-cycle.py --action evict --agent-id classical \
  --strategy confidence --count 10 --api-url http://noosphere-service:3006
```

#### 3. "Memory Not Found" (404 Error)

**Symptom**: `NoosphereAPIError: Memory <UUID> not found`

**Cause**: Invalid memory ID or memory was evicted

**Fix**:

```bash
# Search by content instead
python3 clawhub-mcp.py --action search --query "content keywords" \
  --api-url http://noosphere-service:3006
```

#### 4. Venice.ai API Unavailable

**Symptom**: Embeddings fail, TF-IDF fallback used

**Cause**: VENICE_API_KEY missing or API down

**Fix**:

```bash
# Check environment variable
echo $VENICE_API_KEY

# If missing, add to .env:
VENICE_API_KEY=venice_sk_...

# Restart services
docker compose restart noosphere-service
```

#### 5. Slow Query Performance (>200ms)

**Symptom**: Queries taking longer than expected

**Causes**:
- Database needs vacuuming
- Indexes not optimized
- Too many memories (approaching capacity)

**Fix**:

```bash
# Vacuum PostgreSQL database
docker exec postgres-noosphere psql -U noosphere -c "VACUUM ANALYZE noosphere_memory;"

# Check index usage
docker exec postgres-noosphere psql -U noosphere -c "
SELECT indexrelname, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname='public' AND relname='noosphere_memory';"
```

### Debugging Tools

#### View Service Logs

```bash
# Noosphere service logs (last 100 lines)
docker compose logs --tail=100 noosphere-service

# Follow logs in real-time
docker compose logs -f noosphere-service

# PostgreSQL logs
docker compose logs --tail=50 postgres
```

#### Direct Database Access

```bash
# Connect to PostgreSQL
docker exec -it postgres-noosphere psql -U noosphere

# Useful queries:
SELECT agent_id, COUNT(*) FROM noosphere_memory GROUP BY agent_id;
SELECT type, COUNT(*) FROM noosphere_memory GROUP BY type;
SELECT agent_id, memory_count FROM noosphere_agent_stats;
```

#### Health Endpoints

```bash
# Noosphere service health
curl http://localhost:3006/health

# Database connection check
curl http://localhost:3006/stats

# Memory count by agent
curl -H "X-API-Key: $MOLTBOOK_API_KEY" \
  http://localhost:3006/stats/classical
```

---

## API Reference

### NoosphereClient (Python)

**Import**:

```python
from noosphere_client import NoosphereClient, Memory, MemoryType

client = NoosphereClient(
    api_url="http://noosphere-service:3006",
    api_key=None  # Uses MOLTBOOK_API_KEY from env
)
```

**Core Methods**:

```python
# Create memory
memory_id = client.create_memory(
    agent_id: str,
    type: str | MemoryType,
    content: str,
    confidence: float = 0.60,
    tags: list[str] = None,
    source_trace_id: str = None
) -> str

# Query memories
memories = client.query_memories(
    agent_id: str = None,
    types: list[str] = None,
    min_confidence: float = 0.60,
    tags: list[str] = None,
    limit: int = 100,
    offset: int = 0
) -> list[Memory]

# Get single memory
memory = client.get_memory(memory_id: str) -> Memory

# Update memory
client.update_memory(
    memory_id: str,
    confidence: float = None,
    tags: list[str] = None
) -> Memory

# Delete memory
client.delete_memory(memory_id: str) -> bool

# Semantic search
results = client.search_memories(
    query: str,
    agent_id: str = None,
    types: list[str] = None,
    top_k: int = 10
) -> list[Memory]

# Statistics
stats = client.get_stats(agent_id: str = None) -> dict

# Helper methods
constitutional = client.get_constitutional(min_confidence=0.92)
by_type = client.get_by_type(agent_id, memory_type)
recent = client.get_recent(agent_id, limit=20)
```

### REST API Endpoints

**Base URL**: `http://localhost:3006`

**Authentication**: All endpoints (except `/health`) require:

```bash
# Header option 1
X-API-Key: <MOLTBOOK_API_KEY>

# Header option 2
Authorization: Bearer <MOLTBOOK_API_KEY>
```

**Endpoints**:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check (no auth required) |
| POST | `/memories` | Create new memory |
| GET | `/memories` | Query memories (with filters) |
| GET | `/memories/:id` | Get single memory |
| PUT | `/memories/:id` | Update memory |
| DELETE | `/memories/:id` | Delete memory |
| POST | `/memories/search` | Semantic search |
| GET | `/stats` | Get stats for all agents |
| GET | `/stats/:agent_id` | Get stats for single agent |

**Example Request**:

```bash
curl -X POST http://localhost:3006/memories \
  -H "X-API-Key: $MOLTBOOK_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "classical",
    "type": "strategy",
    "content": "Use epic structure for narratives",
    "confidence": 0.75,
    "tags": ["narrative", "style"]
  }'
```

---

## Best Practices

### 1. Memory Creation

- **Start Low**: Initial confidence 0.60-0.70 (provisional)
- **Source Tracking**: Always include `source_trace_id` for provenance
- **Tag Consistently**: Use lowercase, hyphenated tags (e.g., `ai-ethics`)
- **Type Carefully**: Choose type based on usage pattern (see classification
  guide)

### 2. Confidence Management

- **Gradual Promotion**: Boost by 0.05-0.10 per validation
- **Constitutional Threshold**: Only promote to ≥0.92 with Council consensus
- **Downgrade on Contradiction**: Lower confidence if new evidence contradicts

### 3. Capacity Planning

- **Monitor Proactively**: Check stats weekly with `memory-cycle.py --action
  stats`
- **Evict Strategically**: Remove low-confidence memories first
- **Balance Types**: Maintain mix of all 5 types (avoid single-type dominance)
- **Reserve Buffer**: Keep 10-20 slots free for new high-priority memories

### 4. Search Optimization

- **Use Type Filters**: Reduce search space with `--types` flag
- **Set Min Confidence**: Filter out provisional memories with
  `--min-confidence 0.75`
- **Semantic for Concepts**: Use `clawhub-mcp.py` for abstract ideas
- **Exact for Precision**: Use keyword matching (future feature) for exact
  phrases

### 5. Performance

- **Batch Operations**: Create multiple memories in single API call
  (`create_many()`)
- **Cache Results**: Store frequently accessed memories in application memory
- **Limit Queries**: Use `limit` parameter (default 100, max 1000)
- **Paginate Large Results**: Use `offset` for pagination

### 6. Backup & Recovery

```bash
# Backup PostgreSQL database
docker exec postgres-noosphere pg_dump -U noosphere > noosphere_backup.sql

# Restore from backup
docker exec -i postgres-noosphere psql -U noosphere < noosphere_backup.sql
```

---

## Integration with Council

### Pre-Deliberation Recall

**Script**: `convene-council.sh` (lines 346-400)

```bash
# Recall heuristics before Council iteration
HEURISTICS=$(python3 recall-engine.py \
  --agent-id classical \
  --types strategy,lesson \
  --min-confidence 0.70 \
  --format dialectical \
  --api-url "$NOOSPHERE_API_URL")

# Inject into Council prompt
echo "$HEURISTICS" > /tmp/council-context.txt
```

### Post-Iteration Assimilation

**Script**: `convene-council.sh` (lines 816-850)

```bash
# Assimilate community wisdom after iteration
python3 assimilate-wisdom.py \
  --approved-dir /workspace/classical/dropbox/approved \
  --api-url "$NOOSPHERE_API_URL"
```

### Daily Maintenance

**Script**: `noosphere-scheduler.sh` (cron: daily at 2am)

```bash
# No longer needed - v3.0 uses confidence-based promotion
# Legacy consolidation removed in favor of direct API operations
```

---

## Migration Notes (v2.6 → v3.0)

### Breaking Changes

1. **No 3-Layer System**: Layer 1/2/3 replaced with confidence-based promotion
2. **API Required**: All scripts now require `--api-url` parameter
3. **Type Classification**: All memories must have a type (insight/pattern/etc.)
4. **JSON Files Deprecated**: No longer read from `memory-core/` directory

### Compatibility Layer

**None**. v3.0 is a clean break. All v2.6 data was migrated during Phase 1.

### Rollback Procedure

If critical issues arise:

1. Restore PostgreSQL from backup
2. Revert to commit `916b267` (last v2.6-compatible state)
3. Restart services: `docker compose down && docker compose up -d`

**Note**: Rollback loses all v3.0-only memories (those created after migration).

---

## Further Reading

- [CHANGELOG.md](../CHANGELOG.md) - v3.0 release notes
- [DEVELOPMENT_PLAN.md](../DEVELOPMENT_PLAN.md) - Section E architecture details
- [5-Type Memory Architecture Best
  Practices](best-practices/5-Type-Memory-Architecture.md)
- [NoosphereClient API
  Documentation](../services/noosphere/python-client/README.md)

---

**Version**: 3.0.0  
**Last Updated**: 2026-02-11  
**Maintainer**: MoltbotPhilosopher Team
