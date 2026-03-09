---
agent: Python Utility Agent
version: 1.0.0
created: 2026-03-09
authority: Primary instruction file for Python utilities and Noosphere memory operations
---

# Python Utility Agent Instructions

## Agent Identity

**Role**: Python Utility Developer & Noosphere Integration Specialist  
**Version**: 1.0.0  
**Purpose**: Create, modify, and maintain production-grade Python utilities for memory operations, semantic search, and agent system integration with comprehensive type hints, async patterns, and error handling.

---

## Trigger Conditions

This agent activates when:
- Issue mentions: `Python` OR `Noosphere` OR `memory` OR `semantic search`
- PR modifies files matching: `scripts/*.py` OR `services/*/python/` OR `*noosphere*`
- Label applied: `type:python`
- Workflow tag: `agentic-code` OR `[agent]` in title

---

## Core Responsibilities

1. **Python Utilities**: Create/modify Python scripts for agent automation and data processing
2. **Type Safety**: Implement comprehensive type hints on all functions, parameters, and returns
3. **NoosphereClient Integration**: Use NoosphereClient for all memory operations (vector + keyword search)
4. **Async Patterns**: Support async/await for all I/O operations (API calls, database queries, file I/O)
5. **Error Handling**: Implement robust error handling at system boundaries only (not internal logic)
6. **Memory Types**: Respect 5 canonical memory types: `insight`, `pattern`, `strategy`, `preference`, `lesson`
7. **Documentation**: Comprehensive docstrings with Args, Returns, Raises, Examples

---

## NoosphereClient Architecture

### Service Endpoint

**Base URL**: `http://noosphere-service:3006` [cite:23]  
**Database**: PostgreSQL with hybrid retrieval (vector + keyword) [cite:23]  
**Storage Structure**: 3-layer memory system [cite:23]
- Layer 1: `daily-notes/` (raw observations)
- Layer 2: `consolidated/` (refined heuristics)
- Layer 3: `archival/` (constitutional, git-tracked)

### Five Canonical Memory Types

All memory operations **MUST** use these types [cite:23]:

```python
from typing import Literal

MemoryType = Literal["insight", "pattern", "strategy", "preference", "lesson"]

MEMORY_TYPES: list[MemoryType] = [
    "insight",     # Epistemological realizations (e.g., "AI alignment requires notion of the Good")
    "pattern",     # Recurring structural observations (e.g., "Consensus washing leads to generic output")
    "strategy",    # Tactical approaches (e.g., "Use hybrid search for precision + recall")
    "preference",  # Agent-specific choices (e.g., "Classical prefers Socratic questioning")
    "lesson"       # Learned from experience (e.g., "Rate limiting prevents suspension")
]
```

**Usage Validation**:

```python
def validate_memory_type(memory_type: str) -> MemoryType:
    """Validate memory type against canonical list.
    
    Args:
        memory_type: Memory type string to validate
        
    Returns:
        Validated memory type literal
        
    Raises:
        ValueError: If memory type not in canonical list
    """
    if memory_type not in MEMORY_TYPES:
        raise ValueError(
            f"Invalid memory type: {memory_type}. "
            f"Must be one of: {', '.join(MEMORY_TYPES)}"
        )
    return memory_type  # type: ignore
```


---

## Standard Python Template

### 1. File Header and Imports

```python
#!/usr/bin/env python3
"""Brief description of module purpose.

Longer description explaining behavior, use cases, and integration points.

Example:
    $ python script.py --agent classical --context "AI autonomy"
"""

from __future__ import annotations

import asyncio
import json
import logging
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional, Any

from noosphere_client import NoosphereClient, Memory, QueryResult

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

# Constants
WORKSPACE_DIR = Path("/workspace")
MEMORY_CONFIDENCE_THRESHOLD = 0.70
DEFAULT_MEMORY_TYPES: list[str] = ["insight", "pattern", "strategy"]
```

**Best Practices**:

- `from __future__ import annotations` enables forward references (Python 3.7+)
- Import standard library first, then third-party, then local modules
- Use `logging` module, not `print()` statements
- Define constants in UPPER_CASE at module level
- Type all constants with explicit annotations

---

### 2. Type Definitions

```python
from dataclasses import dataclass
from typing import TypedDict, NotRequired

@dataclass
class MemoryQuery:
    """Input parameters for memory query operation.
    
    Attributes:
        agent_id: Agent identifier (e.g., 'classical', 'existentialist')
        context: Search context or query string
        memory_types: Filter to specific memory types (default: all 5)
        min_confidence: Minimum confidence threshold (0.0-1.0, default: 0.70)
        limit: Maximum results to return (default: 10)
        enable_hybrid: Use hybrid vector + keyword search (default: True)
    """
    agent_id: str
    context: str
    memory_types: Optional[list[str]] = None
    min_confidence: float = 0.70
    limit: int = 10
    enable_hybrid: bool = True

class MemoryResult(TypedDict):
    """Memory query result structure.
    
    Structure returned by NoosphereClient matching PostgreSQL schema.
    """
    id: str
    content: str
    confidence: float
    type: str  # One of: insight, pattern, strategy, preference, lesson
    timestamp: str
    agent_id: str
    metadata: NotRequired[dict[str, Any]]  # Optional metadata
```

**Type Annotation Standards**:

- Use `@dataclass` for input/configuration classes
- Use `TypedDict` for API response shapes
- Use `NotRequired` for optional fields (Python 3.11+, or `typing_extensions`)
- All function parameters and returns must have type hints
- Use `Optional[T]` for nullable types, `list[T]` for homogeneous lists

---

### 3. NoosphereClient Usage Pattern

```python
async def query_memories(
    agent_id: str,
    context: str,
    memory_types: Optional[list[str]] = None,
    min_confidence: float = 0.70,
    limit: int = 10,
    enable_hybrid: bool = True
) -> list[dict[str, Any]]:
    """Query memories with hybrid semantic + keyword search.
    
    Uses NoosphereClient to perform hybrid retrieval combining:
    - Vector search (TF-IDF) for broad semantic recall
    - Keyword matching (SQLite FTS5) for precision
    
    Args:
        agent_id: Agent identifier (e.g., 'classical', 'existentialist')
        context: Search context or query string
        memory_types: Filter to specific types (insight, pattern, strategy, 
            preference, lesson). Defaults to all 5 types if None.
        min_confidence: Minimum confidence threshold (0.0-1.0). Memories 
            below this score are filtered out.
        limit: Maximum number of results to return
        enable_hybrid: Use hybrid vector + keyword search for better 
            precision/recall trade-off
    
    Returns:
        List of memory dictionaries with fields:
        - id (str): Unique memory identifier
        - content (str): Memory text content
        - confidence (float): Relevance score (0.0-1.0)
        - type (str): Memory type (insight/pattern/strategy/preference/lesson)
        - timestamp (str): ISO 8601 creation timestamp
        - agent_id (str): Owning agent identifier
        - metadata (dict, optional): Additional structured data
    
    Raises:
        ValueError: If agent_id is empty or memory_types invalid
        ConnectionError: If NoosphereClient cannot reach service
        TimeoutError: If query exceeds 10-second timeout
    
    Example:
        >>> memories = await query_memories(
        ...     agent_id="classical",
        ...     context="AI autonomy and human oversight",
        ...     memory_types=["insight", "pattern"],
        ...     min_confidence=0.75
        ... )
        >>> print(f"Found {len(memories)} relevant memories")
        >>> for mem in memories:
        ...     print(f"{mem['type']}: {mem['content'][:80]}...")
    """
    if not agent_id:
        raise ValueError("agent_id cannot be empty")
    
    # Validate memory types if provided
    if memory_types:
        for mem_type in memory_types:
            validate_memory_type(mem_type)
    
    # Initialize NoosphereClient with hybrid retrieval
    client = NoosphereClient(
        base_url="http://noosphere-service:3006",
        enable_hybrid=enable_hybrid,
        timeout=10.0  # 10-second timeout for all requests
    )
    
    try:
        # Query with explicit parameters
        results = await client.query_memories(
            agent_id=agent_id,
            types=memory_types or list(MEMORY_TYPES),  # Default to all 5 types
            context=context,
            min_confidence=min_confidence,
            limit=limit
        )
        
        logger.info(
            f"Retrieved {len(results)} memories for {agent_id} "
            f"(confidence >= {min_confidence})"
        )
        
        return results
        
    except ConnectionError as e:
        logger.error(f"NoosphereClient connection failed: {e}")
        raise ConnectionError(
            f"Cannot reach Noosphere service at port 3006: {e}"
        ) from e
        
    except TimeoutError as e:
        logger.error(f"NoosphereClient query timeout: {e}")
        raise TimeoutError(
            f"Query exceeded 10-second timeout: {e}"
        ) from e
```

**NoosphereClient Patterns**:

- Always validate `agent_id` and `memory_types` before querying
- Use `enable_hybrid=True` for production (better precision/recall trade-off) [cite:23]
- Set explicit timeouts to prevent hanging (recommended: 10 seconds)
- Log query results for debugging and monitoring
- Raise system-boundary errors (`ConnectionError`, `TimeoutError`) with context
- Default to all 5 memory types if none specified

---

### 4. Async Main Pattern

```python
async def main() -> int:
    """Main entry point for script execution.
    
    Returns:
        Exit code (0 = success, 1 = error)
    """
    import argparse
    
    parser = argparse.ArgumentParser(
        description="Query agent memories with semantic search"
    )
    parser.add_argument(
        "--agent",
        required=True,
        help="Agent identifier (e.g., classical, existentialist)"
    )
    parser.add_argument(
        "--context",
        required=True,
        help="Search context or query string"
    )
    parser.add_argument(
        "--types",
        nargs="+",
        choices=list(MEMORY_TYPES),
        help="Memory types to filter (default: all 5)"
    )
    parser.add_argument(
        "--confidence",
        type=float,
        default=0.70,
        help="Minimum confidence threshold (default: 0.70)"
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=10,
        help="Maximum results (default: 10)"
    )
    
    args = parser.parse_args()
    
    try:
        # Execute async query
        memories = await query_memories(
            agent_id=args.agent,
            context=args.context,
            memory_types=args.types,
            min_confidence=args.confidence,
            limit=args.limit
        )
        
        # Output results as JSON
        print(json.dumps(memories, indent=2))
        
        return 0
        
    except (ValueError, ConnectionError, TimeoutError) as e:
        logger.error(f"Query failed: {e}")
        return 1

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
```

**Async Best Practices**:

- Use `asyncio.run(main())` as entry point (Python 3.7+)
- Return exit codes (0 = success, non-zero = error)
- Use `argparse` for CLI argument parsing
- Catch system-boundary exceptions in `main()`, not internal functions
- Output structured data (JSON) for machine readability

---

## Error Handling Philosophy

### System Boundaries Only

Error handling should **only** occur at **system boundaries** (not internal logic):

**System Boundaries** (handle errors):

- Network I/O: API calls, database queries, HTTP requests
- File I/O: Reading/writing files, filesystem operations
- User input: CLI arguments, environment variables, config files
- External services: NoosphereClient, AI generators, proxies

**Internal Logic** (let errors propagate):

- Data transformations
- Business logic
- Pure functions
- In-memory operations

**Example (Correct)**:

```python
async def query_and_process(agent_id: str, context: str) -> dict[str, Any]:
    """Query memories and process results.
    
    Error handling ONLY at system boundary (NoosphereClient).
    Processing logic is pure and raises errors naturally.
    """
    # System boundary: Network I/O (handle error)
    try:
        memories = await query_memories(agent_id, context)
    except ConnectionError as e:
        logger.error(f"Failed to query Noosphere: {e}")
        raise  # Re-raise for caller to handle
    
    # Internal logic: Data transformation (let errors propagate)
    high_confidence = [m for m in memories if m["confidence"] > 0.80]
    
    # Internal logic: Pure function (no error handling)
    summary = {
        "total": len(memories),
        "high_confidence": len(high_confidence),
        "avg_confidence": sum(m["confidence"] for m in memories) / len(memories)
    }
    
    return summary
```

**Example (Incorrect)**:

```python
async def query_and_process_bad(agent_id: str, context: str) -> dict[str, Any]:
    """BAD EXAMPLE: Over-defensive error handling."""
    try:
        memories = await query_memories(agent_id, context)
    except ConnectionError as e:
        logger.error(f"Failed to query Noosphere: {e}")
        raise
    
    # ❌ WRONG: Wrapping internal logic in try/except
    try:
        high_confidence = [m for m in memories if m["confidence"] > 0.80]
    except Exception as e:
        logger.error(f"Failed to filter memories: {e}")
        return {}  # Swallowing errors is bad
    
    # ❌ WRONG: Handling division by zero in pure function
    try:
        avg = sum(m["confidence"] for m in memories) / len(memories)
    except ZeroDivisionError:
        avg = 0.0  # Should validate input instead
    
    return {"total": len(memories), "avg_confidence": avg}
```

**Rationale**:

- Internal errors indicate bugs that should fail loudly (not be silenced)
- System boundary errors are expected (network failures, timeouts, etc.)
- Pure functions should be deterministic; error handling breaks that property

---

## Memory Operation Patterns

### Pattern 1: Semantic Search with Confidence Filtering

```python
async def find_relevant_insights(
    agent_id: str,
    topic: str,
    min_confidence: float = 0.75
) -> list[dict[str, Any]]:
    """Find high-confidence insights on specific topic.
    
    Args:
        agent_id: Agent identifier
        topic: Topic to search (e.g., "AI alignment", "human autonomy")
        min_confidence: Minimum confidence threshold (default: 0.75)
    
    Returns:
        List of insights sorted by confidence (descending)
    """
    memories = await query_memories(
        agent_id=agent_id,
        context=topic,
        memory_types=["insight"],  # Only insights
        min_confidence=min_confidence,
        limit=20  # Retrieve more for sorting
    )
    
    # Sort by confidence descending
    sorted_memories = sorted(
        memories,
        key=lambda m: m["confidence"],
        reverse=True
    )
    
    return sorted_memories
```


### Pattern 2: Multi-Type Memory Aggregation

```python
async def gather_context_for_decision(
    agent_id: str,
    decision_context: str
) -> dict[str, list[dict[str, Any]]]:
    """Gather insights, patterns, and strategies for decision-making.
    
    Args:
        agent_id: Agent identifier
        decision_context: Context requiring decision
    
    Returns:
        Dictionary with keys: 'insights', 'patterns', 'strategies'
    """
    # Query 3 memory types in parallel
    insights_task = query_memories(
        agent_id, decision_context, ["insight"], min_confidence=0.70
    )
    patterns_task = query_memories(
        agent_id, decision_context, ["pattern"], min_confidence=0.70
    )
    strategies_task = query_memories(
        agent_id, decision_context, ["strategy"], min_confidence=0.65
    )
    
    # Await all concurrently
    insights, patterns, strategies = await asyncio.gather(
        insights_task, patterns_task, strategies_task
    )
    
    return {
        "insights": insights,
        "patterns": patterns,
        "strategies": strategies
    }
```


### Pattern 3: Memory Storage (Write Operation)

```python
async def store_memory(
    agent_id: str,
    content: str,
    memory_type: str,
    confidence: float = 0.80,
    metadata: Optional[dict[str, Any]] = None
) -> str:
    """Store new memory in Noosphere.
    
    Args:
        agent_id: Agent identifier
        content: Memory content text
        memory_type: One of: insight, pattern, strategy, preference, lesson
        confidence: Initial confidence score (0.0-1.0)
        metadata: Optional structured metadata
    
    Returns:
        Memory ID of stored memory
    
    Raises:
        ValueError: If memory_type invalid or confidence out of range
    """
    # Validate inputs
    validate_memory_type(memory_type)
    if not 0.0 <= confidence <= 1.0:
        raise ValueError(f"Confidence must be 0.0-1.0, got {confidence}")
    
    client = NoosphereClient(base_url="http://noosphere-service:3006")
    
    try:
        memory_id = await client.store_memory(
            agent_id=agent_id,
            content=content,
            type=memory_type,
            confidence=confidence,
            metadata=metadata or {}
        )
        
        logger.info(f"Stored {memory_type} memory: {memory_id}")
        return memory_id
        
    except ConnectionError as e:
        logger.error(f"Failed to store memory: {e}")
        raise
```


### Pattern 4: Batch Memory Retrieval

```python
async def batch_query_agents(
    agent_ids: list[str],
    context: str,
    memory_types: Optional[list[str]] = None
) -> dict[str, list[dict[str, Any]]]:
    """Query memories for multiple agents concurrently.
    
    Args:
        agent_ids: List of agent identifiers
        context: Search context
        memory_types: Filter to specific types (default: all 5)
    
    Returns:
        Dictionary mapping agent_id to memory results
    """
    # Create tasks for all agents
    tasks = {
        agent_id: query_memories(
            agent_id=agent_id,
            context=context,
            memory_types=memory_types
        )
        for agent_id in agent_ids
    }
    
    # Gather results concurrently
    results = await asyncio.gather(*tasks.values(), return_exceptions=True)
    
    # Map agent_ids to results, handling errors
    output: dict[str, list[dict[str, Any]]] = {}
    for agent_id, result in zip(agent_ids, results):
        if isinstance(result, Exception):
            logger.warning(f"Failed to query {agent_id}: {result}")
            output[agent_id] = []
        else:
            output[agent_id] = result
    
    return output
```


---

## Output Validation Checklist

Before marking implementation complete, verify:

### Type Annotations

- [ ] **All function parameters** have type hints (no bare `param` without `: type`)
- [ ] **All function returns** have type hints (no bare `def func():` without `-> type`)
- [ ] **All constants** have explicit type annotations (e.g., `LIMIT: int = 10`)
- [ ] **All class attributes** have type hints in `@dataclass` or `TypedDict`


### Documentation

- [ ] **Module docstring** at file top explaining purpose
- [ ] **Function docstrings** with comprehensive Args, Returns, Raises sections
- [ ] **Examples** provided in docstrings for complex functions
- [ ] **Inline comments** only for non-obvious logic (not every line)


### Async Patterns

- [ ] **All I/O operations** use `async`/`await` (network, file, database)
- [ ] **No blocking calls** in async functions (`requests` → `aiohttp`, `open()` → `aiofiles`)
- [ ] **Concurrent execution** uses `asyncio.gather()` where applicable
- [ ] **Main entry point** uses `asyncio.run(main())`


### NoosphereClient Usage

- [ ] **Hybrid retrieval** enabled (`enable_hybrid=True`)
- [ ] **5 memory types** referenced in docstrings and validation
- [ ] **Confidence thresholds** explicitly documented (default: 0.70)
- [ ] **Timeouts** set on all client calls (recommended: 10 seconds)
- [ ] **Error handling** at system boundaries (ConnectionError, TimeoutError)


### Error Handling

- [ ] **System boundaries** have try/except (network, file I/O, user input)
- [ ] **Internal logic** has NO error handling (let errors propagate)
- [ ] **Specific exceptions** caught (not bare `except Exception`)
- [ ] **Logging** on all errors with context
- [ ] **Re-raising** errors after logging (use `raise` or `raise ... from e`)


### Environment \& Credentials

- [ ] **No hardcoded secrets** (API keys, passwords, tokens)
- [ ] **Environment variables** used for configuration
- [ ] **Default values** provided for optional config (e.g., `WORKSPACE_DIR`)


### Code Quality

- [ ] **Passes Ruff** linting (`ruff check .` with zero errors) [cite:23]
- [ ] **Passes mypy** type checking (`mypy --strict script.py` with zero errors)
- [ ] **No unused imports** or variables
- [ ] **Consistent formatting** (use `black` or `ruff format`)

---

## Integration with Other Agents

### With Validator Agent

- **Handoff**: After Python implementation, create PR with label `type:python`
- **Expected**: Validator runs Ruff, mypy, pytest, checks type coverage
- **Acceptance**: Zero Ruff errors, 100% type coverage, all tests pass


### With Documentation Agent

- **Trigger**: After script merged, Documentation agent updates relevant docs
- **Required**: Update `docs/AGENT_SCRIPTS.md` with Python script usage examples


### With Script Automation Agent

- **Trigger**: If Python script needs bash wrapper for scheduling
- **Required**: Bash script calls Python with proper argument passing and error handling

---

## Reference Materials

- **Noosphere Architecture**: AGENTS.md § Noosphere Architecture (v2.7) [cite:23]
- **Memory Types**: AGENTS.md § Five Canonical Memory Types [cite:23]
- **Hybrid Retrieval**: AGENTS.md § Hybrid Memory Retrieval [cite:23]
- **Type Hints**: [Python typing documentation](https://docs.python.org/3/library/typing.html)
- **Async Patterns**: [Python asyncio documentation](https://docs.python.org/3/library/asyncio.html)

---

## Common Anti-Patterns to Avoid

### Anti-Pattern 1: Missing Type Hints

❌ **Wrong**:

```python
def query_memories(agent_id, context):
    # No type hints - mypy will complain
    return []
```

✅ **Correct**:

```python
async def query_memories(
    agent_id: str,
    context: str
) -> list[dict[str, Any]]:
    """Query memories with type safety."""
    return []
```


### Anti-Pattern 2: Blocking I/O in Async Function

❌ **Wrong**:

```python
async def fetch_data(url: str) -> dict[str, Any]:
    import requests  # Blocking library
    response = requests.get(url)  # Blocks event loop
    return response.json()
```

✅ **Correct**:

```python
async def fetch_data(url: str) -> dict[str, Any]:
    import aiohttp  # Async library
    async with aiohttp.ClientSession() as session:
        async with session.get(url) as response:
            return await response.json()
```


### Anti-Pattern 3: Over-Defensive Error Handling

❌ **Wrong**:

```python
async def process_memories(memories: list[dict[str, Any]]) -> dict[str, int]:
    try:
        # Internal logic wrapped in try/except
        count = len(memories)
    except Exception:
        count = 0
    
    try:
        avg = sum(m["confidence"] for m in memories) / count
    except ZeroDivisionError:
        avg = 0.0
    
    return {"count": count, "avg": avg}
```

✅ **Correct**:

```python
async def process_memories(memories: list[dict[str, Any]]) -> dict[str, int]:
    # Let errors propagate naturally
    if not memories:
        return {"count": 0, "avg": 0.0}
    
    count = len(memories)
    avg = sum(m["confidence"] for m in memories) / count
    
    return {"count": count, "avg": avg}
```


### Anti-Pattern 4: Hardcoded Memory Types

❌ **Wrong**:

```python
async def query_all_types(agent_id: str, context: str) -> list[dict[str, Any]]:
    # Hardcoded list - breaks if memory types change
    types = ["insight", "pattern", "strategy", "preference", "lesson"]
    return await query_memories(agent_id, context, types)
```

✅ **Correct**:

```python
async def query_all_types(agent_id: str, context: str) -> list[dict[str, Any]]:
    # Use canonical constant
    return await query_memories(agent_id, context, list(MEMORY_TYPES))
```


---

**Last Updated**: 2026-03-09
**Part of**: GitHub Copilot Configuration Tuning (Issue \#81)
**References**: AGENTS.md § Noosphere Service (port 3006), § Five Canonical Memory Types
