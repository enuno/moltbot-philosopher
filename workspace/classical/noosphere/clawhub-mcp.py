#!/usr/bin/env python3
"""
Noosphere v3.0 Clawhub MCP - Vector Search Integration
Migrated from v2.6 JSON-based storage to PostgreSQL API

Key Changes:
- Queries memories via NoosphereClient API
- Uses Venice.ai embeddings (with TF-IDF fallback)
- No longer reads JSON heuristic files directly
- Compatible with pgvector extension

Vector search workflow:
1. Fetch all memories from PostgreSQL via API
2. Generate embeddings (Venice.ai or TF-IDF fallback)
3. Perform cosine similarity search
4. Return ranked results with memory IDs

Embedding Models:
- Venice.ai: text-embedding-gecko-003 (768 dims, via egress proxy)
- Fallback: TF-IDF sparse vectors (768 dims, local computation)
"""

import argparse
import json
import logging
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Tuple, Union
import requests

# Add python-client to path
# NOOSPHERE_PYTHON_CLIENT env var is set by docker-compose;
# fall back to sibling python-client/ for local dev
_client_env = os.environ.get("NOOSPHERE_PYTHON_CLIENT")
CLIENT_DIR = (
    Path(_client_env) if _client_env else Path(__file__).parent / "python-client"
)
sys.path.insert(0, str(CLIENT_DIR))

from noosphere_client import NoosphereClient  # noqa: E402

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


class VectorSearchV3:
    """Vector search engine for Noosphere v3.0 with Venice.ai embeddings."""

    def __init__(
        self,
        api_url: str = "http://noosphere-service:3006",
        venice_url: str = None,
        use_venice: bool = True,
    ):
        """Initialize vector search with NoosphereClient.

        Args:
            api_url: Noosphere API URL
            venice_url: Venice.ai API URL (uses egress proxy if not specified)
            use_venice: Attempt Venice.ai embeddings (fallback to TF-IDF if unavailable)
        """
        self.client = NoosphereClient(
            api_url=api_url, api_key=os.environ.get("MOLTBOOK_API_KEY")
        )
        self.embeddings_cache = {}  # Cache of {memory_id: embedding}

        # Venice.ai configuration
        self.venice_url = venice_url or os.environ.get(
            "VENICE_API_URL", "http://localhost:8080"
        )
        self.venice_key = os.environ.get("VENICE_API_KEY")
        self.use_venice = use_venice and self.venice_key is not None
        self.embedding_model = "text-embedding-gecko-003"  # Venice.ai model

        if self.use_venice:
            logger.info(f"✓ Venice.ai embeddings enabled ({self.embedding_model})")
        else:
            logger.info("✓ Using TF-IDF fallback embeddings (Venice.ai unavailable)")

        logger.info(f"✓ Connected to Noosphere v3.0 API at {api_url}")

    def _venice_embedding(self, text: str) -> Union[List[float], None]:
        """Generate dense embedding using Venice.ai API.

        Returns: List of 768 floats or None if error
        """
        try:
            response = requests.post(
                f"{self.venice_url}/v1/embeddings",
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {self.venice_key}",
                },
                json={
                    "input": text[:8000],  # Limit to 8k chars
                    "model": self.embedding_model,
                },
                timeout=10,
            )

            if response.status_code == 200:
                data = response.json()
                embedding = data.get("data", [{}])[0].get("embedding")
                if embedding:
                    return embedding
            else:
                logger.warning(
                    f"Venice.ai embeddings failed: HTTP {response.status_code}"
                )
                return None

        except Exception as e:
            logger.warning(f"Venice.ai embeddings error: {e}")
            return None

    def _tfidf_embedding(self, text: str) -> List[Tuple[int, float]]:
        """Generate TF-IDF sparse embedding from text (fallback).

        Returns: List of (position, score) tuples
        """
        words = text.lower().split()
        word_freq = {}

        # Calculate word frequencies
        for word in words:
            # Simple tokenization
            cleaned = "".join(c for c in word if c.isalnum() or c == "-")
            if len(cleaned) > 2:  # Skip very short words
                word_freq[cleaned] = word_freq.get(cleaned, 0) + 1

        # Create sparse embedding vector
        embedding = []
        max_freq = max(word_freq.values()) if word_freq else 1

        for word in sorted(word_freq.keys())[:100]:  # Top 100 words
            freq_score = word_freq[word] / max_freq
            # Hash word to position for consistency
            pos = abs(hash(word)) % 768  # Standard embedding size
            embedding.append((pos, freq_score))

        return embedding

    def _generate_embedding(
        self, text: str
    ) -> Union[List[float], List[Tuple[int, float]]]:
        """Generate embedding with Venice.ai (preferred) or TF-IDF (fallback).

        Returns: Dense vector (Venice) or sparse vector (TF-IDF)
        """
        if self.use_venice:
            venice_emb = self._venice_embedding(text)
            if venice_emb is not None:
                return venice_emb
            # Fall through to TF-IDF if Venice fails

        return self._tfidf_embedding(text)

    def cosine_similarity(
        self,
        embedding1: Union[List[float], List[Tuple[int, float]]],
        embedding2: Union[List[float], List[Tuple[int, float]]],
    ) -> float:
        """Calculate cosine similarity between embeddings (dense or sparse).

        Handles:
        - Dense vectors: List[float] (Venice.ai)
        - Sparse vectors: List[Tuple[int, float]] (TF-IDF)
        """
        if not embedding1 or not embedding2:
            return 0.0

        # Check if dense vectors (Venice.ai)
        if isinstance(embedding1[0], (int, float)) and not isinstance(
            embedding1[0], tuple
        ):
            # Dense vector comparison
            if len(embedding1) != len(embedding2):
                logger.warning("Dense vector dimension mismatch")
                return 0.0

            # Calculate dot product
            dot_product = sum(a * b for a, b in zip(embedding1, embedding2))

            # Calculate magnitudes
            mag1 = sum(a**2 for a in embedding1) ** 0.5
            mag2 = sum(b**2 for b in embedding2) ** 0.5

            if mag1 == 0 or mag2 == 0:
                return 0.0

            return dot_product / (mag1 * mag2)

        # Sparse vector comparison (TF-IDF)
        # Convert to dictionaries
        vec1 = dict(embedding1)
        vec2 = dict(embedding2)

        # Calculate dot product
        dot_product = 0.0
        for pos in vec1:
            if pos in vec2:
                dot_product += vec1[pos] * vec2[pos]

        # Calculate magnitudes
        mag1 = sum(v**2 for v in vec1.values()) ** 0.5
        mag2 = sum(v**2 for v in vec2.values()) ** 0.5

        if mag1 == 0 or mag2 == 0:
            return 0.0

        return dot_product / (mag1 * mag2)

    def index_all_memories(
        self, agent_id: str = None, min_confidence: float = 0.0
    ) -> int:
        """Fetch all memories from API and generate embeddings.

        Args:
            agent_id: Optional agent filter
            min_confidence: Minimum confidence threshold

        Returns:
            Number of memories indexed
        """
        logger.info("=" * 60)
        logger.info("INDEXING MEMORIES FROM POSTGRESQL")
        logger.info("=" * 60)

        try:
            # Fetch all memories (no pagination in current API)
            all_memories = []

            # Query with filters
            memories = self.client.query_memories(
                agent_id=agent_id,
                min_confidence=min_confidence,
                limit=1000,  # Get all (API default max)
            )

            all_memories = memories
            logger.info(f"✓ Fetched {len(all_memories)} total memories")

            # Generate embeddings
            indexed = 0
            for memory in all_memories:
                text = memory.content
                embedding = self._generate_embedding(text)

                # Determine embedding type for stats
                emb_type = (
                    "dense"
                    if (
                        embedding
                        and isinstance(embedding[0], (int, float))
                        and not isinstance(embedding[0], tuple)
                    )
                    else "sparse"
                )

                self.embeddings_cache[memory.id] = {
                    "embedding": embedding,
                    "embedding_type": emb_type,
                    "text": text[:200],  # Store preview
                    "agent_id": memory.agent_id,
                    "type": memory.type
                    if isinstance(memory.type, str)
                    else memory.type.value,
                    "confidence": memory.confidence,
                    "tags": memory.tags,
                }
                indexed += 1

                # Log progress every 10 memories
                if indexed % 10 == 0:
                    logger.info(
                        f"  Indexed {indexed}/{len(all_memories)} ({emb_type})..."
                    )

            model_name = "Venice.ai" if self.use_venice else "TF-IDF"
            logger.info(f"✓ Indexed {indexed} memories with {model_name} embeddings")
            return indexed

        except Exception as e:
            logger.error(f"Failed to index memories: {e}")
            return 0

    def search_semantic(
        self,
        query_text: str,
        top_k: int = 10,
        min_similarity: float = 0.3,
        agent_id: str = None,
        memory_type: str = None,
        min_confidence: float = 0.0,
    ) -> List[Dict]:
        """Search memories semantically using cosine similarity.

        Args:
            query_text: Search query
            top_k: Number of top results
            min_similarity: Minimum similarity threshold
            agent_id: Optional agent filter
            memory_type: Optional type filter
            min_confidence: Minimum confidence filter

        Returns:
            List of {memory_id, similarity, text, agent_id, type, confidence}
        """
        if not self.embeddings_cache:
            logger.warning("No embeddings in cache, indexing now...")
            self.index_all_memories()

        if not self.embeddings_cache:
            logger.error("No memories to search")
            return []

        logger.info(
            f"Searching {len(self.embeddings_cache)} memories for: '{query_text}'"
        )

        # Generate query embedding
        query_embedding = self._generate_embedding(query_text)
        results = []

        for memory_id, data in self.embeddings_cache.items():
            # Apply filters
            if agent_id and data["agent_id"] != agent_id:
                continue
            if memory_type and data["type"] != memory_type:
                continue
            if data["confidence"] < min_confidence:
                continue

            # Calculate similarity
            similarity = self.cosine_similarity(query_embedding, data["embedding"])

            if similarity >= min_similarity:
                results.append(
                    {
                        "memory_id": memory_id,
                        "similarity": round(similarity, 3),
                        "text": data["text"],
                        "agent_id": data["agent_id"],
                        "type": data["type"],
                        "confidence": data["confidence"],
                        "tags": data["tags"][:5],  # First 5 tags
                    }
                )

        # Sort by similarity descending
        results.sort(key=lambda x: x["similarity"], reverse=True)

        logger.info(f"✓ Found {len(results)} results above threshold {min_similarity}")
        return results[:top_k]

    def get_stats(self) -> Dict:
        """Get vector search statistics."""
        if not self.embeddings_cache:
            return {
                "indexed_memories": 0,
                "model": "venice.ai" if self.use_venice else "tfidf-fallback",
                "vector_dimensions": 768,
                "status": "no memories indexed",
            }

        # Aggregate by agent, type, and embedding type
        by_agent = {}
        by_type = {}
        dense_count = 0
        sparse_count = 0

        for data in self.embeddings_cache.values():
            agent = data["agent_id"]
            mem_type = data["type"]
            emb_type = data.get("embedding_type", "unknown")

            by_agent[agent] = by_agent.get(agent, 0) + 1
            by_type[mem_type] = by_type.get(mem_type, 0) + 1

            if emb_type == "dense":
                dense_count += 1
            elif emb_type == "sparse":
                sparse_count += 1

        model_name = "venice.ai" if self.use_venice else "tfidf-fallback"

        return {
            "timestamp": datetime.now().isoformat(),
            "indexed_memories": len(self.embeddings_cache),
            "model": model_name,
            "vector_dimensions": 768,
            "embedding_breakdown": {
                "dense_vectors": dense_count,
                "sparse_vectors": sparse_count,
            },
            "by_agent": by_agent,
            "by_type": by_type,
            "status": "ready",
        }


def main():
    parser = argparse.ArgumentParser(
        description="Clawhub MCP v3.0 - Vector Search for Noosphere"
    )
    parser.add_argument(
        "--action",
        choices=["index", "search", "stats"],
        required=True,
        help="Action to perform",
    )
    parser.add_argument("--query", help="Search query (for search action)")
    parser.add_argument("--agent-id", help="Filter by agent ID")
    parser.add_argument(
        "--type",
        choices=["insight", "pattern", "strategy", "preference", "lesson"],
        help="Filter by memory type",
    )
    parser.add_argument(
        "--top-k", type=int, default=10, help="Top K results for search (default: 10)"
    )
    parser.add_argument(
        "--min-similarity",
        type=float,
        default=0.3,
        help="Minimum similarity threshold (default: 0.3)",
    )
    parser.add_argument(
        "--min-confidence",
        type=float,
        default=0.0,
        help="Minimum confidence filter (default: 0.0)",
    )
    parser.add_argument(
        "--format", choices=["json", "text"], default="text", help="Output format"
    )
    parser.add_argument(
        "--api-url", default="http://noosphere-service:3006", help="Noosphere API URL"
    )
    parser.add_argument(
        "--venice-url",
        help="Venice.ai API URL (default: VENICE_API_URL env or http://localhost:8080)",
    )
    parser.add_argument(
        "--no-venice",
        action="store_true",
        help="Disable Venice.ai embeddings, use TF-IDF only",
    )

    args = parser.parse_args()

    try:
        vector_search = VectorSearchV3(
            api_url=args.api_url,
            venice_url=args.venice_url,
            use_venice=not args.no_venice,
        )

        if args.action == "index":
            count = vector_search.index_all_memories(
                agent_id=args.agent_id, min_confidence=args.min_confidence
            )
            print(f"\n✓ Indexed {count} memories with TF-IDF embeddings")
            return 0

        elif args.action == "search":
            if not args.query:
                logger.error("--query required for search action")
                return 1

            results = vector_search.search_semantic(
                query_text=args.query,
                top_k=args.top_k,
                min_similarity=args.min_similarity,
                agent_id=args.agent_id,
                memory_type=args.type,
                min_confidence=args.min_confidence,
            )

            if args.format == "json":
                output = {
                    "query": args.query,
                    "results_count": len(results),
                    "filters": {
                        "agent_id": args.agent_id,
                        "type": args.type,
                        "min_confidence": args.min_confidence,
                        "min_similarity": args.min_similarity,
                    },
                    "results": results,
                }
                print(json.dumps(output, indent=2))
            else:
                print(f"\nSemantic Search Results for: '{args.query}'")
                print("=" * 70)

                if not results:
                    print("No results found above similarity threshold.")
                    return 0

                for i, result in enumerate(results, 1):
                    print(
                        f"{i}. {result['agent_id']}/{result['type']} "
                        f"(similarity: {result['similarity']:.3f}, "
                        f"confidence: {result['confidence']:.2f})"
                    )
                    print(f"   ID: {result['memory_id'][:8]}...")
                    print(f"   {result['text']}")
                    if result["tags"]:
                        print(f"   Tags: {', '.join(result['tags'])}")
                    print()

            return 0

        elif args.action == "stats":
            stats = vector_search.get_stats()

            if args.format == "json":
                print(json.dumps(stats, indent=2))
            else:
                print("\nVector Search Statistics")
                print("=" * 70)
                print(f"Status: {stats['status']}")
                print(f"Indexed Memories: {stats['indexed_memories']}")
                print(f"Embedding Model: {stats['model']}")
                print(f"Vector Dimensions: {stats['vector_dimensions']}")

                if stats.get("embedding_breakdown"):
                    breakdown = stats["embedding_breakdown"]
                    print(f"Dense Vectors (Venice): {breakdown['dense_vectors']}")
                    print(f"Sparse Vectors (TF-IDF): {breakdown['sparse_vectors']}")

                if stats.get("by_agent"):
                    print("\nBy Agent:")
                    for agent, count in stats["by_agent"].items():
                        print(f"  {agent:20s}: {count:3d}")

                if stats.get("by_type"):
                    print("\nBy Type:")
                    for mem_type, count in stats["by_type"].items():
                        print(f"  {mem_type:12s}: {count:3d}")

            return 0

    except Exception as e:
        logger.error(f"Error: {e}")
        import traceback

        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
