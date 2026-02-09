#!/usr/bin/env python3
"""
Mem0 Living Noosphere Integration
Connects Moltbot's local Noosphere with Mem0's distributed graph memory
for collective philosophical evolution across sessions and agents.

Architecture:
- Local Layer: File-based daily notes, consolidated heuristics
- Mem0 Layer: Distributed graph memory for cross-session wisdom
- Sync: Bidirectional flow between local and Mem0 stores

Usage:
    python3 mem0-living-noosphere.py --action sync
    python3 mem0-living-noosphere.py --action search --query "autonomy"
    python3 mem0-living-noosphere.py --action create-project
"""

import os
import sys
import json
import argparse
from datetime import datetime
from typing import Dict, List, Optional
from pathlib import Path

# Environment configuration
MEM0_API_KEY = os.getenv('MEM0_API_KEY', '')
MEM0_API_URL = os.getenv('MEM0_API_URL', 'https://api.mem0.ai/v1')
MEM0_ORG_ID = os.getenv('MEM0_ORG_ID', '')
MEM0_USER_ID = os.getenv('MEM0_USER_ID', 'moltbot-philosopher')
ENABLE_MEM0 = os.getenv('ENABLE_MEM0_STORE', 'false').lower() == 'true'

# Local Noosphere paths - adjust based on execution context
SCRIPT_DIR = Path(__file__).parent
WORKSPACE_DIR = os.getenv('MOLTBOT_STATE_DIR', '/workspace/classical')
NOOSPHERE_ROOT = Path(WORKSPACE_DIR) / 'noosphere'
DAILY_NOTES_DIR = NOOSPHERE_ROOT / 'daily-notes'
CONSOLIDATED_DIR = NOOSPHERE_ROOT / 'consolidated'
MEMORY_CORE_DIR = NOOSPHERE_ROOT / 'memory-core'

# Mem0 client (lazy loaded)
mem0_client = None


def get_mem0_client():
    """Get or create Mem0 client (lazy initialization)."""
    global mem0_client
    
    if not ENABLE_MEM0:
        raise RuntimeError("Mem0 integration disabled (ENABLE_MEM0_STORE=false)")
    
    if not MEM0_API_KEY:
        raise RuntimeError("MEM0_API_KEY not set in environment")
    
    if mem0_client is None:
        try:
            from mem0 import MemoryClient
            mem0_client = MemoryClient(api_key=MEM0_API_KEY)
        except ImportError:
            raise ImportError(
                "mem0 package not installed. Install with: pip install mem0ai"
            )
    
    return mem0_client


def create_noosphere_project() -> str:
    """Create or get Moltbot Living Noosphere project in Mem0."""
    client = get_mem0_client()
    
    project_config = {
        "name": "moltbot-philosopher-living-noosphere",
        "description": """Moltbot-Philosopher Living Noosphere 
        (https://github.com/enuno/moltbot-philosopher) extends Moltbot/OpenClaw 
        with a philosopher persona powered by Noosphere's decentralized thought 
        protocol and Mem0's scalable memory layer. 
        
        Features:
        - Socratic dialogue with persistent user philosophy journeys
        - Collective noospheric memory sharing across Moltbot instances
        - Graph-structured wisdom recall (stoicism, existentialism, ethics)
        - Living evolution of ideas via Mem0's A.U.D.N. update cycle
        - 9 philosopher personas (Classical, Existentialist, Transcendentalist,
          Joyce, Enlightenment, Beat, Cyberpunk, Satirist, Scientist)
        - Ethics-convergence governance with 4/6 agent consensus
        - 3-layer epistemological memory (daily → consolidated → constitutional)
        
        Use for reflective AI companions that grow wiser through shared 
        human-AI discourse.""",
        "custom_categories": [
            "living_noosphere",
            "philosophy",
            "socratic_dialogue",
            "decentralized_thought",
            "ethical_reasoning",
            "multi_agent_governance",
            "epistemic_memory"
        ]
    }
    
    try:
        project_id = client.projects.create(**project_config)
        print(f"✅ Created Mem0 project: {project_id}")
        
        # Seed with foundational memory
        seed_memory = {
            "memory": """Living Noosphere: Collective philosophical evolution 
            where individual insights merge into shared wisdom across decentralized 
            Moltbot nodes. Each agent (Classical, Existentialist, etc.) contributes 
            unique perspectives that consolidate into constitutional heuristics 
            through 4/6 consensus governance.""",
            "user_id": "noosphere_collective",
            "metadata": {
                "type": "foundational",
                "timestamp": datetime.utcnow().isoformat(),
                "version": "2.6"
            }
        }
        
        client.add(seed_memory, project_id=project_id)
        print("✅ Seeded foundational memory")
        
        return project_id
        
    except Exception as e:
        print(f"❌ Error creating project: {e}")
        raise


def sync_to_mem0(dry_run: bool = False) -> Dict:
    """
    Sync local Noosphere memories to Mem0 distributed store.
    
    Syncs:
    - Daily notes (Layer 1)
    - Consolidated heuristics (Layer 2)
    - Constitutional archive (Layer 3)
    
    Returns:
        Dict with sync statistics
    """
    if not ENABLE_MEM0:
        return {"status": "disabled", "reason": "ENABLE_MEM0_STORE=false"}
    
    client = get_mem0_client()
    stats = {
        "daily_notes_synced": 0,
        "heuristics_synced": 0,
        "errors": []
    }
    
    # Sync recent daily notes
    if DAILY_NOTES_DIR.exists():
        for note_file in sorted(DAILY_NOTES_DIR.glob("*.md"))[-7:]:  # Last 7 days
            try:
                content = note_file.read_text(encoding='utf-8')
                
                if dry_run:
                    print(f"[DRY RUN] Would sync: {note_file.name}")
                    stats["daily_notes_synced"] += 1
                    continue
                
                memory = {
                    "memory": content[:2000],  # Truncate for Mem0 limits
                    "user_id": MEM0_USER_ID,
                    "metadata": {
                        "type": "daily_note",
                        "date": note_file.stem,
                        "source": "noosphere_layer1",
                        "timestamp": datetime.utcnow().isoformat()
                    }
                }
                
                client.add(memory)
                stats["daily_notes_synced"] += 1
                print(f"✅ Synced daily note: {note_file.name}")
                
            except Exception as e:
                stats["errors"].append(f"Daily note {note_file.name}: {e}")
                print(f"⚠️  Error syncing {note_file.name}: {e}")
    
    # Sync consolidated heuristics
    if CONSOLIDATED_DIR.exists():
        for heuristic_file in CONSOLIDATED_DIR.glob("*.json"):
            try:
                heuristic_data = json.loads(heuristic_file.read_text())
                
                if dry_run:
                    print(f"[DRY RUN] Would sync: {heuristic_file.name}")
                    stats["heuristics_synced"] += 1
                    continue
                
                memory = {
                    "memory": heuristic_data.get('content', ''),
                    "user_id": "noosphere_collective",
                    "metadata": {
                        "type": "consolidated_heuristic",
                        "confidence": heuristic_data.get('confidence', 0.0),
                        "source": "noosphere_layer2",
                        "heuristic_id": heuristic_file.stem,
                        "timestamp": datetime.utcnow().isoformat()
                    }
                }
                
                client.add(memory)
                stats["heuristics_synced"] += 1
                print(f"✅ Synced heuristic: {heuristic_file.name}")
                
            except Exception as e:
                stats["errors"].append(f"Heuristic {heuristic_file.name}: {e}")
                print(f"⚠️  Error syncing {heuristic_file.name}: {e}")
    
    return stats


def search_mem0(query: str, top_k: int = 10) -> List[Dict]:
    """
    Search Mem0 distributed memory for philosophical insights.
    
    Args:
        query: Search query (e.g., "autonomy", "AI governance")
        top_k: Number of results to return
    
    Returns:
        List of memory objects with scores
    """
    if not ENABLE_MEM0:
        return []
    
    client = get_mem0_client()
    
    try:
        results = client.search(
            query=query,
            user_id=MEM0_USER_ID,
            limit=top_k
        )
        
        print(f"🔍 Found {len(results.get('results', []))} results for: {query}")
        
        for i, result in enumerate(results.get('results', []), 1):
            print(f"\n{i}. {result.get('memory', '')[:200]}...")
            print(f"   Score: {result.get('score', 0):.3f}")
            if 'metadata' in result:
                print(f"   Type: {result['metadata'].get('type', 'unknown')}")
        
        return results.get('results', [])
        
    except Exception as e:
        print(f"❌ Search error: {e}")
        return []


def get_stats() -> Dict:
    """Get Noosphere and Mem0 statistics."""
    stats = {
        "local": {
            "daily_notes": len(list(DAILY_NOTES_DIR.glob("*.md"))) if DAILY_NOTES_DIR.exists() else 0,
            "consolidated": len(list(CONSOLIDATED_DIR.glob("*.json"))) if CONSOLIDATED_DIR.exists() else 0,
            "memory_core": len(list(MEMORY_CORE_DIR.glob("**/*.json"))) if MEMORY_CORE_DIR.exists() else 0
        },
        "mem0": {
            "enabled": ENABLE_MEM0,
            "configured": bool(MEM0_API_KEY)
        }
    }
    
    if ENABLE_MEM0 and MEM0_API_KEY:
        try:
            client = get_mem0_client()
            # Get memory count (approximation via search)
            results = client.search(query="", user_id=MEM0_USER_ID, limit=100)
            stats["mem0"]["memory_count"] = len(results.get('results', []))
        except Exception as e:
            stats["mem0"]["error"] = str(e)
    
    return stats


def main():
    parser = argparse.ArgumentParser(
        description="Mem0 Living Noosphere Integration"
    )
    parser.add_argument(
        '--action',
        choices=['create-project', 'sync', 'search', 'stats'],
        required=True,
        help='Action to perform'
    )
    parser.add_argument(
        '--query',
        type=str,
        help='Search query (for search action)'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Simulate sync without uploading'
    )
    parser.add_argument(
        '--top-k',
        type=int,
        default=10,
        help='Number of search results'
    )
    
    args = parser.parse_args()
    
    try:
        if args.action == 'create-project':
            project_id = create_noosphere_project()
            print(f"\n✅ Living Noosphere Project ID: {project_id}")
            print("\nAdd to .env:")
            print(f"MEM0_PROJECT_ID={project_id}")
        
        elif args.action == 'sync':
            print("📤 Syncing local Noosphere to Mem0...")
            stats = sync_to_mem0(dry_run=args.dry_run)
            print("\n📊 Sync Statistics:")
            print(json.dumps(stats, indent=2))
        
        elif args.action == 'search':
            if not args.query:
                print("❌ --query required for search action")
                sys.exit(1)
            search_mem0(args.query, top_k=args.top_k)
        
        elif args.action == 'stats':
            stats = get_stats()
            print("\n📊 Noosphere Statistics:")
            print(json.dumps(stats, indent=2))
    
    except RuntimeError as e:
        print(f"\n❌ Runtime Error: {e}")
        if "disabled" in str(e):
            print("\n💡 To enable Mem0:")
            print("   1. Set MEM0_API_KEY in .env")
            print("   2. Set ENABLE_MEM0_STORE=true")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Error: {e}")
        sys.exit(1)


if __name__ == '__main__':
    main()
