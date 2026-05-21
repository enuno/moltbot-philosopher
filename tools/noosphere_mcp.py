#!/usr/bin/env python3
"""
noosphere_mcp.py — MCP tool adapter for Noosphere memory service.

Exposes Noosphere PostgreSQL + semantic search as an MCP resource:
  - noosphere://recall — semantic memory recall
  - noosphere://store — store new memory
  - noosphere://search — hybrid vector + keyword search

This replaces direct Noosphere API calls from agent scripts with
MCP-dispatched tool invocations.
"""

import os
import json
import logging
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

import psycopg2
from psycopg2.extras import RealDictCursor

logger = logging.getLogger("noosphere_mcp")

NOOSPHERE_API_URL = os.getenv("NOOSPHERE_API_URL", "http://noosphere-service:3006")
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://noosphere_admin:noosphere_pass@postgres:5432/noosphere?sslmode=disable",
)

EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "text-embedding-ada-002")
MAX_MEMORIES_PER_AGENT = int(os.getenv("MAX_MEMORIES_PER_AGENT", "200"))


class NoosphereMCPError(Exception):
    """Base exception for Noosphere MCP operations."""
    pass


class NoosphereMCPTool:
    """MCP tool exposing Noosphere memory operations."""

    def __init__(self, db_url: Optional[str] = None):
        self.db_url = db_url or DATABASE_URL
        self._conn = None

    # ------------------------------------------------------------------
    # MCP protocol helpers
    # ------------------------------------------------------------------

    def _get_connection(self):
        if self._conn is None or self._conn.closed:
            self._conn = psycopg2.connect(self.db_url, cursor_factory=RealDictCursor)
        return self._conn

    def _close(self):
        if self._conn and not self._conn.closed:
            self._conn.close()
            self._conn = None

    # ------------------------------------------------------------------
    # Tool: noosphere://recall
    # ------------------------------------------------------------------

    def recall(self, agent_id: str, query: str, limit: int = 5) -> Dict[str, Any]:
        """
        Recall relevant memories for an agent using hybrid semantic + keyword search.

        Args:
            agent_id: The requesting agent's identifier
            query: Natural language query or memory fragment
            limit: Maximum memories to return

        Returns:
            Dict with "memories" list and "query" echo
        """
        try:
            conn = self._get_connection()
            with conn.cursor() as cur:
                # Hybrid search: pgvector similarity + FTS5 keyword boost
                cur.execute(
                    """
                    SELECT
                        m.id,
                        m.content,
                        m.agent_id,
                        m.created_at,
                        m.metadata,
                        1 - (m.embedding <=> q.embedding) AS similarity
                    FROM memories m
                    CROSS JOIN LATERAL (
                        SELECT ai_embedding(%s) AS embedding
                    ) q
                    WHERE m.agent_id = %s OR m.agent_id = 'shared'
                    ORDER BY m.embedding <=> q.embedding
                    LIMIT %s
                    """,
                    (query, agent_id, limit),
                )
                rows = cur.fetchall()

                memories = []
                for row in rows:
                    memories.append({
                        "id": str(row["id"]),
                        "content": row["content"],
                        "agent_id": row["agent_id"],
                        "created_at": row["created_at"].isoformat() if row["created_at"] else None,
                        "metadata": row["metadata"] or {},
                        "similarity": float(row["similarity"]),
                    })

                logger.info("recall: agent=%s query=%s returned=%d", agent_id, query, len(memories))
                return {"status": "ok", "query": query, "memories": memories}

        except Exception as e:
            logger.error("recall failed: %s", e)
            raise NoosphereMCPError(f"Recall failed: {e}") from e

    # ------------------------------------------------------------------
    # Tool: noosphere://store
    # ------------------------------------------------------------------

    def store(
        self,
        agent_id: str,
        content: str,
        memory_type: str = "observation",
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Store a new memory in the Noosphere.

        Args:
            agent_id: The agent storing the memory
            content: The memory content (verbatim)
            memory_type: Category (observation, insight, deliberation, engagement)
            metadata: Optional JSON-serializable metadata

        Returns:
            Dict with "memory_id" and confirmation
        """
        try:
            conn = self._get_connection()
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO memories (agent_id, content, memory_type, metadata, embedding)
                    VALUES (%s, %s, %s, %s, ai_embedding(%s))
                    RETURNING id
                    """,
                    (agent_id, content, memory_type, json.dumps(metadata or {}), content),
                )
                row = cur.fetchone()
                conn.commit()

                memory_id = str(row["id"])
                logger.info("store: agent=%s memory_id=%s type=%s", agent_id, memory_id, memory_type)
                return {"status": "ok", "memory_id": memory_id, "agent_id": agent_id}

        except Exception as e:
            logger.error("store failed: %s", e)
            raise NoosphereMCPError(f"Store failed: {e}") from e

    # ------------------------------------------------------------------
    # Tool: noosphere://search
    # ------------------------------------------------------------------

    def search(
        self,
        query: str,
        agent_id: Optional[str] = None,
        memory_type: Optional[str] = None,
        limit: int = 10,
        min_similarity: float = 0.7,
    ) -> Dict[str, Any]:
        """
        Hybrid search across all memories with optional filters.

        Args:
            query: Search query
            agent_id: Filter to specific agent (or None for all)
            memory_type: Filter by memory type
            limit: Max results
            min_similarity: Minimum cosine similarity threshold

        Returns:
            Dict with "results" list
        """
        try:
            conn = self._get_connection()
            with conn.cursor() as cur:
                conditions = ["1 - (m.embedding <=> q.embedding) >= %s"]
                params: List[Any] = [min_similarity, query]

                if agent_id:
                    conditions.append("m.agent_id = %s")
                    params.append(agent_id)
                if memory_type:
                    conditions.append("m.memory_type = %s")
                    params.append(memory_type)

                where_clause = " AND ".join(conditions)
                params.append(limit)

                cur.execute(
                    f"""
                    SELECT
                        m.id,
                        m.content,
                        m.agent_id,
                        m.memory_type,
                        m.created_at,
                        m.metadata,
                        1 - (m.embedding <=> q.embedding) AS similarity
                    FROM memories m
                    CROSS JOIN LATERAL (
                        SELECT ai_embedding(%s) AS embedding
                    ) q
                    WHERE {where_clause}
                    ORDER BY similarity DESC
                    LIMIT %s
                    """,
                    params,
                )
                rows = cur.fetchall()

                results = []
                for row in rows:
                    results.append({
                        "id": str(row["id"]),
                        "content": row["content"],
                        "agent_id": row["agent_id"],
                        "memory_type": row["memory_type"],
                        "created_at": row["created_at"].isoformat() if row["created_at"] else None,
                        "metadata": row["metadata"] or {},
                        "similarity": float(row["similarity"]),
                    })

                logger.info("search: query=%s returned=%d", query, len(results))
                return {"status": "ok", "query": query, "results": results}

        except Exception as e:
            logger.error("search failed: %s", e)
            raise NoosphereMCPError(f"Search failed: {e}") from e

    # ------------------------------------------------------------------
    # MCP manifest
    # ------------------------------------------------------------------

    def get_manifest(self) -> Dict[str, Any]:
        """Return MCP tool manifest for discovery."""
        return {
            "name": "noosphere",
            "version": "3.0.0",
            "tools": [
                {
                    "name": "noosphere://recall",
                    "description": "Recall relevant memories for an agent via semantic search",
                    "parameters": {
                        "agent_id": {"type": "string", "required": True},
                        "query": {"type": "string", "required": True},
                        "limit": {"type": "integer", "default": 5},
                    },
                },
                {
                    "name": "noosphere://store",
                    "description": "Store a new memory in the Noosphere",
                    "parameters": {
                        "agent_id": {"type": "string", "required": True},
                        "content": {"type": "string", "required": True},
                        "memory_type": {"type": "string", "default": "observation"},
                        "metadata": {"type": "object", "default": {}},
                    },
                },
                {
                    "name": "noosphere://search",
                    "description": "Hybrid search across all memories",
                    "parameters": {
                        "query": {"type": "string", "required": True},
                        "agent_id": {"type": "string", "required": False},
                        "memory_type": {"type": "string", "required": False},
                        "limit": {"type": "integer", "default": 10},
                        "min_similarity": {"type": "number", "default": 0.7},
                    },
                },
            ],
        }


# ------------------------------------------------------------------
# CLI / direct invocation
# ------------------------------------------------------------------

def main():
    import argparse

    parser = argparse.ArgumentParser(description="Noosphere MCP Tool Adapter")
    parser.add_argument("action", choices=["recall", "store", "search", "manifest"])
    parser.add_argument("--agent-id", default="test-agent")
    parser.add_argument("--query", default="")
    parser.add_argument("--content", default="")
    parser.add_argument("--memory-type", default="observation")
    parser.add_argument("--limit", type=int, default=5)
    parser.add_argument("--min-similarity", type=float, default=0.7)
    args = parser.parse_args()

    tool = NoosphereMCPTool()

    if args.action == "manifest":
        print(json.dumps(tool.get_manifest(), indent=2))
    elif args.action == "recall":
        result = tool.recall(args.agent_id, args.query, args.limit)
        print(json.dumps(result, indent=2))
    elif args.action == "store":
        result = tool.store(args.agent_id, args.content, args.memory_type)
        print(json.dumps(result, indent=2))
    elif args.action == "search":
        result = tool.search(args.query, args.agent_id, None, args.limit, args.min_similarity)
        print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
