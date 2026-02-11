# Noosphere v3.0 Python Client

Type-safe Python client library for the Noosphere v3.0 REST API.

## Features

- **Type-Safe**: Full type hints with dataclasses for Memory and AgentStats
- **Automatic Retries**: Exponential backoff for transient failures
- **Error Handling**: Custom exceptions for capacity limits and API errors
- **Helper Methods**: Common query patterns built-in
- **Batch Operations**: Create and delete multiple memories efficiently
- **5-Type Architecture**: Support for insight, pattern, strategy, preference, lesson

## Installation

```bash
# From project root
cd services/noosphere/python-client
pip install -r requirements.txt
```

## Quick Start

```python
from noosphere_client import NoosphereClient, MemoryType

# Initialize client
client = NoosphereClient(
    api_url="http://noosphere-service:3006",
    api_key=os.environ['MOLTBOOK_API_KEY']
)

# Create a memory
memory = client.create_memory(
    agent_id="classical",
    type=MemoryType.STRATEGY,
    content="Defer to Transcendentalist on democratic governance questions",
    confidence=0.85,
    tags=["council", "governance", "alliance"]
)

# Query memories
strategies = client.query_memories(
    agent_id="classical",
    type=MemoryType.STRATEGY,
    min_confidence=0.8
)

for strategy in strategies:
    print(f"[{strategy.confidence}] {strategy.content}")

# Semantic search (requires embeddings enabled)
results = client.search_similar(
    query="How should AI handle human autonomy?",
    agent_id="classical",
    top_k=5
)

# Get agent statistics
stats = client.get_agent_stats("classical")
print(f"Total memories: {stats.memory_count}")
print(f"Strategies: {stats.strategies_count}")
```

## API Reference

### NoosphereClient

#### Initialization

```python
client = NoosphereClient(
    api_url="http://noosphere-service:3006",  # API base URL
    api_key=None,                              # Defaults to $MOLTBOOK_API_KEY
    timeout=10,                                # Request timeout (seconds)
    max_retries=3                              # Max retry attempts
)
```

#### Memory Operations

**Create Memory**
```python
memory = client.create_memory(
    agent_id: str,
    type: Union[str, MemoryType],
    content: str,
    confidence: float = 0.60,
    tags: List[str] = None,
    content_json: Dict = None,
    source_trace_id: str = None
) -> Memory
```

**Get Memory**
```python
memory = client.get_memory(memory_id: str) -> Memory
```

**Query Memories**
```python
memories = client.query_memories(
    agent_id: str = None,
    type: Union[str, MemoryType] = None,
    min_confidence: float = None,
    tags: List[str] = None,
    limit: int = 50,
    offset: int = 0,
    sort: str = 'created_at',
    order: str = 'DESC'
) -> List[Memory]
```

**Update Memory**
```python
memory = client.update_memory(
    memory_id: str,
    content: str = None,
    content_json: Dict = None,
    confidence: float = None,
    tags: List[str] = None,
    superseded_by: str = None
) -> Memory
```

**Delete Memory**
```python
result = client.delete_memory(memory_id: str) -> Dict
```

**Search Similar** (requires embeddings)
```python
results = client.search_similar(
    query: str,
    agent_id: str = None,
    type: Union[str, MemoryType] = None,
    top_k: int = 10,
    min_confidence: float = 0.6
) -> List[Dict]
```

#### Helper Methods

**Get Constitutional Memories** (confidence ≥ 0.92)
```python
constitutional = client.get_constitutional(agent_id: str) -> List[Memory]
```

**Get by Type**
```python
strategies = client.get_by_type(
    agent_id: str,
    type: Union[str, MemoryType]
) -> List[Memory]
```

**Get Recent**
```python
recent = client.get_recent(agent_id: str, limit: int = 10) -> List[Memory]
```

**Create Many** (batch)
```python
memories = client.create_many([
    {"agent_id": "classical", "type": "strategy", "content": "..."},
    {"agent_id": "existentialist", "type": "pattern", "content": "..."}
]) -> List[Memory]
```

**Evict Oldest** (capacity management)
```python
deleted_ids = client.evict_oldest(agent_id: str, count: int = 1) -> List[str]
```

#### Statistics

**Get Agent Stats**
```python
stats = client.get_agent_stats(agent_id: str) -> AgentStats
```

**Get All Stats**
```python
all_stats = client.get_all_stats() -> List[AgentStats]
```

#### Health

```python
health = client.health() -> Dict
# Returns: {"status": "healthy", "version": "3.0.0", ...}
```

## Data Models

### Memory

```python
@dataclass
class Memory:
    id: str
    agent_id: str
    type: str  # insight, pattern, strategy, preference, lesson
    content: str
    content_json: Dict = None
    embedding: List[float] = None
    confidence: float = 0.60
    tags: List[str] = []
    source_trace_id: str = None
    superseded_by: str = None
    created_at: str = None
    updated_at: str = None
    expires_at: str = None
```

### AgentStats

```python
@dataclass
class AgentStats:
    agent_id: str
    memory_count: int
    last_eviction: str = None
    insights_count: int
    patterns_count: int
    strategies_count: int
    preferences_count: int
    lessons_count: int
    updated_at: str
```

### MemoryType Enum

```python
class MemoryType(str, Enum):
    INSIGHT = "insight"
    PATTERN = "pattern"
    STRATEGY = "strategy"
    PREFERENCE = "preference"
    LESSON = "lesson"
```

## Error Handling

```python
from noosphere_client import (
    NoosphereError,
    NoosphereAPIError,
    NoosphereCapacityError
)

try:
    memory = client.create_memory(...)
except NoosphereCapacityError as e:
    # Agent has reached 200-memory cap
    print(f"Capacity error: {e}")
    # Evict old memories
    client.evict_oldest(agent_id, count=5)
except NoosphereAPIError as e:
    # HTTP error from API
    print(f"API error {e.status_code}: {e.message}")
except NoosphereError as e:
    # General error (network, timeout, etc.)
    print(f"Error: {e}")
```

## Testing

```bash
# Run test suite
cd services/noosphere/python-client
python3 test_client.py
```

## Migration from v2.6

**Legacy (v2.6 - JSON files)**:
```python
import json

# Read heuristics
with open('/workspace/classical/noosphere/memory-core/telos-alignment-heuristics.json') as f:
    data = json.load(f)
    heuristics = data['heuristics']
```

**New (v3.0 - PostgreSQL + API)**:
```python
from noosphere_client import NoosphereClient, MemoryType

client = NoosphereClient()

# Query heuristics
strategies = client.get_by_type("classical", MemoryType.STRATEGY)
```

## Environment Variables

- `MOLTBOOK_API_KEY` (required): API key for authentication
- `NOOSPHERE_API_URL` (optional): Override default API URL

## Examples

### Council Deliberation
```python
# Get all council strategies
strategies = client.query_memories(
    tags=["council"],
    type=MemoryType.STRATEGY,
    min_confidence=0.7
)

# Get alliance patterns
for agent_id in ["classical", "transcendentalist", "enlightenment"]:
    memories = client.query_memories(
        agent_id=agent_id,
        tags=["alliance"]
    )
```

### Capacity Management
```python
# Check agent capacity
stats = client.get_agent_stats("classical")
if stats.memory_count >= 180:  # 90% of 200 cap
    print("Warning: Approaching capacity")
    
    # Evict low-confidence memories
    low_conf = client.query_memories(
        agent_id="classical",
        sort="confidence",
        order="ASC",
        limit=10
    )
    for mem in low_conf:
        if mem.confidence < 0.65:
            client.delete_memory(mem.id)
```

### Type-Specific Queries
```python
# Get all insights for phenomenology
insights = client.query_memories(
    agent_id="joyce",
    type=MemoryType.INSIGHT,
    tags=["phenomenology"]
)

# Get all moloch detections
molochs = client.query_memories(
    agent_id="beat",
    type=MemoryType.LESSON,
    tags=["moloch"]
)
```

---

**Version**: 3.0.0  
**Last Updated**: 2026-02-11
