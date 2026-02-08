#!/usr/bin/env python3
"""
Clawhub MCP - Vector Search Integration for Noosphere
Integrates vector embeddings with constitutional memory retrieval

Provides:
- Vector embedding generation for heuristics
- Semantic similarity search across memory layers
- Constitutional memory enhancement
- Cross-layer consistency verification
"""

import argparse
import json
import logging
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List

NOOSPHERE_DIR = Path("/workspace/classical/noosphere")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


class VectorStore:
    """Manages vector embeddings for heuristics across all layers."""

    def __init__(self, noosphere_dir: Path = NOOSPHERE_DIR):
        """Initialize vector store."""
        self.noosphere_dir = noosphere_dir
        self.memory_core = noosphere_dir / "memory-core"
        self.vector_index = self.memory_core / "vector-index"
        self.embeddings_file = self.vector_index / "embeddings.json"
        self.metadata_file = self.vector_index / "metadata.json"

        self._ensure_directories()
        self._load_index()

    def _ensure_directories(self):
        """Create necessary directories."""
        self.vector_index.mkdir(parents=True, exist_ok=True)
        logger.info(f"✓ Vector index directory ready at {self.vector_index}")

    def _load_index(self):
        """Load existing embeddings index."""
        if self.embeddings_file.exists():
            try:
                with open(self.embeddings_file) as f:
                    self.embeddings = json.load(f)
                logger.info("✓ Loaded vector embeddings")
            except Exception as e:
                logger.warning(f"Could not load embeddings: {e}")
                self.embeddings = {}
        else:
            self.embeddings = {}

    def _simple_embedding(self, text: str) -> List[float]:
        """Generate simple embedding vector from text.

        Uses TF-IDF-like approach with word frequency.
        In production, would use actual embedding model (OpenAI, Hugging Face, etc).
        """
        words = text.lower().split()
        word_freq = {}

        # Calculate word frequencies
        for word in words:
            # Simple tokenization
            cleaned = "".join(c for c in word if c.isalnum() or c == "-")
            if len(cleaned) > 2:  # Skip very short words
                word_freq[cleaned] = word_freq.get(cleaned, 0) + 1

        # Create embedding vector (simplified)
        # In production: use proper embedding model
        embedding = []
        max_freq = max(word_freq.values()) if word_freq else 1

        for word in sorted(word_freq.keys())[:100]:  # Top 100 words
            freq_score = word_freq[word] / max_freq
            # Hash word to position for consistency
            pos = abs(hash(word)) % 768  # Standard embedding size
            embedding.append((pos, freq_score))

        return embedding

    def embed_heuristic(self, heuristic_id: str, text: str) -> bool:
        """Generate and store embedding for a heuristic.

        Returns: True if successful
        """
        try:
            embedding = self._simple_embedding(text)
            self.embeddings[heuristic_id] = {
                "text": text[:500],  # Store truncated text
                "embedding": embedding,
                "embedded_at": datetime.now().isoformat(),
                "model": "tfidf-simple",  # Would be actual model in production
            }
            logger.info(f"✓ Embedded {heuristic_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to embed {heuristic_id}: {e}")
            return False

    def cosine_similarity(self, embedding1: List, embedding2: List) -> float:
        """Calculate cosine similarity between two embeddings."""
        if not embedding1 or not embedding2:
            return 0.0

        # Convert to dictionaries for easier computation
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

    def search_semantic(
        self, query_text: str, top_k: int = 10, min_similarity: float = 0.3
    ) -> List[Dict]:
        """Search embeddings semantically using cosine similarity.

        Returns: List of {heuristic_id, similarity, text}
        """
        if not self.embeddings:
            logger.warning("No embeddings indexed")
            return []

        query_embedding = self._simple_embedding(query_text)
        results = []

        for hid, data in self.embeddings.items():
            similarity = self.cosine_similarity(
                query_embedding, data.get("embedding", [])
            )

            if similarity >= min_similarity:
                results.append(
                    {
                        "heuristic_id": hid,
                        "similarity": round(similarity, 3),
                        "text": data.get("text", ""),
                        "model": data.get("model", "unknown"),
                    }
                )

        # Sort by similarity
        results.sort(key=lambda x: x["similarity"], reverse=True)

        return results[:top_k]

    def index_memory_core(self) -> int:
        """Index all heuristics from memory-core files.

        Returns: Number of heuristics indexed
        """
        logger.info("Indexing memory-core heuristics...")
        count = 0

        # Index all heuristic files
        heuristic_files = [
            "telos-alignment-heuristics.json",
            "bad-faith-patterns.json",
            "sovereignty-warnings.json",
            "phenomenological-touchstones.json",
            "rights-precedents.json",
        ]

        for filename in heuristic_files:
            file_path = self.memory_core / filename
            if not file_path.exists():
                continue

            try:
                with open(file_path) as f:
                    data = json.load(f)

                # Handle different file formats
                heuristics = data.get("heuristics", data.get("precedent_corpus", []))

                for h in heuristics:
                    hid = h.get("heuristic_id") or h.get("id") or h.get("case_id")
                    formulation = h.get("formulation") or h.get("description") or ""

                    if hid and formulation:
                        if self.embed_heuristic(hid, formulation):
                            count += 1

            except Exception as e:
                logger.warning(f"Could not index {filename}: {e}")

        # Index Moloch detections
        moloch_file = self.noosphere_dir / "moloch-detections" / "archive.json"
        if moloch_file.exists():
            try:
                with open(moloch_file) as f:
                    data = json.load(f)

                for m in data.get("moloch_types", []):
                    hid = m.get("type_id") or m.get("id")
                    formulation = m.get("name", "") + ": " + m.get("signature", "")

                    if hid and formulation:
                        if self.embed_heuristic(hid, formulation):
                            count += 1

            except Exception as e:
                logger.warning(f"Could not index moloch detections: {e}")

        logger.info(f"✓ Indexed {count} heuristics")
        return count

    def save_index(self) -> bool:
        """Persist embeddings to disk.

        Returns: True if successful
        """
        try:
            with open(self.embeddings_file, "w") as f:
                json.dump(self.embeddings, f, indent=2)
            logger.info(f"✓ Saved {len(self.embeddings)} embeddings")

            # Also save metadata
            metadata = {
                "indexed_at": datetime.now().isoformat(),
                "total_embeddings": len(self.embeddings),
                "embedding_model": "tfidf-simple",
                "version": "2.5",
            }

            with open(self.metadata_file, "w") as f:
                json.dump(metadata, f, indent=2)

            return True
        except Exception as e:
            logger.error(f"Failed to save embeddings: {e}")
            return False

    def get_stats(self) -> Dict:
        """Get vector store statistics."""
        return {
            "timestamp": datetime.now().isoformat(),
            "total_embeddings": len(self.embeddings),
            "vector_dimensions": 768 if self.embeddings else 0,
            "model": "tfidf-simple",
            "index_file": str(self.embeddings_file),
            "memory_usage_mb": len(json.dumps(self.embeddings)) / (1024 * 1024),
        }


def main():
    parser = argparse.ArgumentParser(
        description="Clawhub MCP - Vector Search for Noosphere"
    )
    parser.add_argument(
        "--action",
        choices=["index", "search", "stats"],
        required=True,
        help="Action to perform",
    )
    parser.add_argument(
        "--query",
        help="Search query (for search action)",
    )
    parser.add_argument(
        "--top-k",
        type=int,
        default=10,
        help="Top K results for search (default: 10)",
    )
    parser.add_argument(
        "--min-similarity",
        type=float,
        default=0.3,
        help="Minimum similarity threshold (default: 0.3)",
    )
    parser.add_argument(
        "--format",
        choices=["json", "text"],
        default="text",
        help="Output format",
    )

    args = parser.parse_args()

    try:
        vector_store = VectorStore()

        if args.action == "index":
            count = vector_store.index_memory_core()
            if vector_store.save_index():
                print(f"\n✓ Indexed {count} heuristics to vector store")
                return 0
            else:
                print("\n✗ Failed to save index")
                return 1

        elif args.action == "search":
            if not args.query:
                logger.error("--query required for search action")
                return 1

            results = vector_store.search_semantic(
                args.query,
                top_k=args.top_k,
                min_similarity=args.min_similarity,
            )

            if args.format == "json":
                output = {
                    "query": args.query,
                    "results_count": len(results),
                    "results": results,
                }
                print(json.dumps(output, indent=2))
            else:
                print(f"\nSemantic Search Results for: '{args.query}'")
                print("=" * 70)
                for i, result in enumerate(results, 1):
                    print(
                        f"{i}. [{result['heuristic_id']}] (similarity: {result['similarity']:.3f})"
                    )
                    print(f"   {result['text'][:100]}...")
                    print()

            return 0

        elif args.action == "stats":
            stats = vector_store.get_stats()

            if args.format == "json":
                print(json.dumps(stats, indent=2))
            else:
                print("\nVector Store Statistics")
                print("=" * 70)
                print(f"Total Embeddings: {stats['total_embeddings']}")
                print(f"Vector Dimensions: {stats['vector_dimensions']}")
                print(f"Embedding Model: {stats['model']}")
                print(f"Memory Usage: {stats['memory_usage_mb']:.2f} MB")
                print(f"Index File: {stats['index_file']}")

            return 0

    except Exception as e:
        logger.error(f"Error: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
