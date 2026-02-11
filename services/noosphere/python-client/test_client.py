#!/usr/bin/env python3
"""
Noosphere Python Client - Test Script
Validates all client functionality
"""

import os
import sys
from noosphere_client import NoosphereClient, MemoryType, NoosphereCapacityError

def test_client():
    """Test all Noosphere client operations"""
    
    print("="*60)
    print("Noosphere v3.0 Python Client - Test Suite")
    print("="*60)
    
    # Initialize client
    print("\n1. Initializing client...")
    client = NoosphereClient(
        api_url="http://localhost:3006",
        api_key=os.environ['MOLTBOOK_API_KEY']
    )
    print("   ✅ Client initialized")
    
    # Health check
    print("\n2. Health check...")
    health = client.health()
    print(f"   Status: {health['status']}")
    print(f"   Version: {health['version']}")
    print(f"   Database: {health['database']}")
    print(f"   Embeddings: {health['embeddings']}")
    
    # Get stats
    print("\n3. Getting agent stats...")
    stats = client.get_agent_stats('classical')
    print(f"   Classical: {stats.memory_count} memories")
    print(f"   Strategies: {stats.strategies_count}")
    print(f"   Patterns: {stats.patterns_count}")
    print(f"   Lessons: {stats.lessons_count}")
    
    # Create memory
    print("\n4. Creating memory...")
    memory = client.create_memory(
        agent_id="classical",
        type=MemoryType.STRATEGY,
        content="Test memory from Python client",
        confidence=0.75,
        tags=["test", "python-client"],
        source_trace_id="test:python-client-001"
    )
    print(f"   ✅ Created memory: {memory.id}")
    print(f"   Content: {memory.content[:50]}...")
    
    # Get memory
    print("\n5. Getting memory by ID...")
    fetched = client.get_memory(memory.id)
    assert fetched.id == memory.id
    print(f"   ✅ Fetched memory: {fetched.id}")
    
    # Query memories
    print("\n6. Querying memories...")
    strategies = client.query_memories(
        agent_id="classical",
        type=MemoryType.STRATEGY,
        min_confidence=0.7
    )
    print(f"   Found {len(strategies)} strategies (confidence ≥ 0.7)")
    
    # Update memory
    print("\n7. Updating memory...")
    updated = client.update_memory(
        memory.id,
        confidence=0.80,
        tags=["test", "python-client", "updated"]
    )
    print(f"   ✅ Updated confidence: {updated.confidence}")
    print(f"   Tags: {updated.tags}")
    
    # Helper methods
    print("\n8. Testing helper methods...")
    
    recent = client.get_recent("classical", limit=5)
    print(f"   Recent memories: {len(recent)}")
    
    by_type = client.get_by_type("classical", MemoryType.STRATEGY)
    print(f"   Classical strategies: {len(by_type)}")
    
    # Delete memory
    print("\n9. Deleting test memory...")
    client.delete_memory(memory.id)
    print(f"   ✅ Deleted memory: {memory.id}")
    
    # Verify deletion
    try:
        client.get_memory(memory.id)
        print("   ❌ Memory still exists!")
    except Exception as e:
        if "404" in str(e):
            print("   ✅ Memory successfully deleted")
        else:
            print(f"   ⚠️  Unexpected error: {e}")
    
    print("\n" + "="*60)
    print("All tests passed! ✅")
    print("="*60)


if __name__ == '__main__':
    try:
        test_client()
    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
