"""
Noosphere v3.1 Python Client
Type-safe abstraction layer over the Noosphere REST API

Usage:
    from noosphere_client import NoosphereClient

    client = NoosphereClient(
        api_url="http://noosphere-service:3006",
        api_key=os.environ['MOLTBOOK_API_KEY']
    )

    # Create memory
    memory = client.create_memory(
        agent_id="classical",
        type="strategy",
        content="Defer to Transcendentalist on democratic governance",
        confidence=0.85,
        tags=["council", "governance"]
    )

    # Query memories
    strategies = client.query_memories(
        agent_id="classical",
        type="strategy",
        min_confidence=0.8
    )

    # Semantic search
    results = client.search_similar(
        query="How should AI handle human autonomy?",
        agent_id="classical",
        top_k=5
    )

    # v3.1: Multi-agent memory sharing
    # Share memory with another agent
    client.share_memory(
        memory_id="abc-123",
        target_agent="existentialist",
        permissions=["read"],
        granted_by="classical"
    )

    # Query shared memories
    shared = client.get_shared_memories(
        agent_id="existentialist",
        permission="read"
    )
"""

import os
import time
import logging
from typing import Dict, List, Optional, Any, Union
from dataclasses import dataclass, asdict
from enum import Enum
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class MemoryType(str, Enum):
    """Valid memory types in 5-type architecture"""

    INSIGHT = "insight"
    PATTERN = "pattern"
    STRATEGY = "strategy"
    PREFERENCE = "preference"
    LESSON = "lesson"


class MemoryVisibility(str, Enum):
    """Memory visibility levels (v3.1)"""

    PRIVATE = "private"
    SHARED = "shared"
    PUBLIC = "public"


class Permission(str, Enum):
    """Permission types for memory sharing (v3.1)"""

    READ = "read"
    WRITE = "write"
    DELETE = "delete"


@dataclass
class Memory:
    """Noosphere memory object"""

    id: Optional[str] = None
    agent_id: Optional[str] = None
    type: Optional[str] = None
    content: Optional[str] = None
    content_json: Optional[Dict] = None
    embedding: Optional[List[float]] = None
    confidence: float = 0.60
    tags: List[str] = None
    source_trace_id: Optional[str] = None
    superseded_by: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    expires_at: Optional[str] = None
    visibility: str = "private"  # v3.1
    owner_agent_id: Optional[str] = None  # v3.1

    def __post_init__(self):
        if self.tags is None:
            self.tags = []
        # Convert confidence to float if it's a string
        if isinstance(self.confidence, str):
            self.confidence = float(self.confidence)

    def to_dict(self, exclude_none: bool = True) -> Dict:
        """Convert to dictionary, optionally excluding None values"""
        d = asdict(self)
        if exclude_none:
            d = {k: v for k, v in d.items() if v is not None}
        return d


@dataclass
class AgentStats:
    """Agent memory statistics"""

    agent_id: str
    memory_count: int
    last_eviction: Optional[str]
    insights_count: int
    patterns_count: int
    strategies_count: int
    preferences_count: int
    lessons_count: int
    updated_at: str
    schema_version: Optional[str] = None  # v3.1+


@dataclass
class MemoryPermission:
    """Memory permission entry (v3.1)"""

    id: str
    agent_id: str
    permission: str
    granted_by: str
    granted_at: str
    expires_at: Optional[str] = None
    is_expired: bool = False


@dataclass
class AccessLogEntry:
    """Access log entry (v3.1)"""

    id: int
    agent_id: str
    action: str
    accessed_at: str
    success: bool
    error_message: Optional[str] = None
    metadata: Optional[Dict] = None


class NoosphereError(Exception):
    """Base exception for Noosphere client errors"""

    pass


class NoosphereAPIError(NoosphereError):
    """API returned an error response"""

    def __init__(self, status_code: int, message: str):
        self.status_code = status_code
        self.message = message
        super().__init__(f"HTTP {status_code}: {message}")


class NoosphereCapacityError(NoosphereError):
    """Agent memory capacity exceeded (200 cap)"""

    pass


class NoosphereClient:
    """
    Noosphere v3.1 Python Client

    Type-safe wrapper around the Noosphere REST API providing:
    - Memory CRUD operations
    - Query filtering and pagination
    - Semantic search
    - Agent statistics
    - Multi-agent memory sharing (v3.1)
    - Permission management (v3.1)
    - Access logging (v3.1)
    - Automatic retries and error handling
    """

    def __init__(
        self,
        api_url: str = "http://noosphere-service:3006",
        api_key: Optional[str] = None,
        timeout: int = 10,
        max_retries: int = 3,
    ):
        """
        Initialize Noosphere client

        Args:
            api_url: Base URL for Noosphere API
            api_key: API key for authentication (defaults to MOLTBOOK_API_KEY env var)
            timeout: Request timeout in seconds
            max_retries: Maximum number of retry attempts
        """
        self.api_url = api_url.rstrip("/")
        self.api_key = api_key or os.environ.get("MOLTBOOK_API_KEY")
        self.timeout = timeout

        if not self.api_key:
            raise ValueError(
                "API key required (provide api_key or set MOLTBOOK_API_KEY)"
            )

        # Configure session with retries
        self.session = requests.Session()
        retry_strategy = Retry(
            total=max_retries,
            backoff_factor=1,
            status_forcelist=[429, 500, 502, 503, 504],
            allowed_methods=["GET", "POST", "PUT", "DELETE"],
        )
        adapter = HTTPAdapter(max_retries=retry_strategy)
        self.session.mount("http://", adapter)
        self.session.mount("https://", adapter)

        # Set default headers
        self.session.headers.update(
            {"X-API-Key": self.api_key, "Content-Type": "application/json"}
        )

    def _request(self, method: str, endpoint: str, **kwargs) -> Dict:
        """
        Make HTTP request with error handling

        Args:
            method: HTTP method (GET, POST, PUT, DELETE)
            endpoint: API endpoint (without base URL)
            **kwargs: Additional arguments for requests

        Returns:
            Response JSON data

        Raises:
            NoosphereAPIError: API returned error status
            NoosphereCapacityError: Memory capacity exceeded
        """
        url = f"{self.api_url}/{endpoint.lstrip('/')}"

        try:
            response = self.session.request(method, url, timeout=self.timeout, **kwargs)

            # Handle capacity errors
            if response.status_code == 409:
                data = response.json()
                if "cap reached" in data.get("error", "").lower():
                    raise NoosphereCapacityError(data["error"])

            # Raise for other HTTP errors
            if not response.ok:
                error_msg = response.text
                try:
                    error_data = response.json()
                    error_msg = error_data.get("error", error_msg)
                except Exception:
                    pass
                raise NoosphereAPIError(response.status_code, error_msg)

            return response.json()

        except requests.exceptions.RequestException as e:
            logger.error(f"Request failed: {e}")
            raise NoosphereError(f"Request failed: {e}")

    def health(self) -> Dict:
        """
        Check service health

        Returns:
            Health status dict with version, database, embeddings status
        """
        return self._request("GET", "/health")

    def create_memory(
        self,
        agent_id: str,
        type: Union[str, MemoryType],
        content: str,
        confidence: float = 0.60,
        tags: Optional[List[str]] = None,
        content_json: Optional[Dict] = None,
        source_trace_id: Optional[str] = None,
        visibility: Union[str, MemoryVisibility] = MemoryVisibility.PRIVATE,
    ) -> Memory:
        """
        Create a new memory

        Args:
            agent_id: Agent identifier (e.g., 'classical', 'existentialist')
            type: Memory type (insight, pattern, strategy, preference, lesson)
            content: Text content of the memory
            confidence: Confidence score (0.0-1.0)
            tags: List of tags for categorization
            content_json: Optional structured metadata
            source_trace_id: Optional trace ID for provenance
            visibility: Memory visibility (private, shared, public) [v3.1]

        Returns:
            Created Memory object

        Raises:
            NoosphereCapacityError: Agent has reached 200-memory cap
        """
        if isinstance(type, MemoryType):
            type = type.value
        if isinstance(visibility, MemoryVisibility):
            visibility = visibility.value

        payload = {
            "agent_id": agent_id,
            "type": type,
            "content": content,
            "confidence": confidence,
            "tags": tags or [],
            "visibility": visibility,
        }

        if content_json:
            payload["content_json"] = content_json
        if source_trace_id:
            payload["source_trace_id"] = source_trace_id

        result = self._request("POST", "/memories", json=payload)
        return Memory(**result["memory"])

    def get_memory(self, memory_id: str) -> Memory:
        """
        Get a single memory by ID

        Args:
            memory_id: Memory UUID

        Returns:
            Memory object
        """
        result = self._request("GET", f"/memories/{memory_id}")
        return Memory(**result)

    def query_memories(
        self,
        agent_id: Optional[str] = None,
        type: Optional[Union[str, MemoryType]] = None,
        min_confidence: Optional[float] = None,
        tags: Optional[List[str]] = None,
        visibility: Optional[Union[str, MemoryVisibility]] = None,
        limit: int = 50,
        offset: int = 0,
        sort: str = "created_at",
        order: str = "DESC",
    ) -> List[Memory]:
        """
        Query memories with filters

        Args:
            agent_id: Filter by agent
            type: Filter by memory type
            min_confidence: Minimum confidence threshold
            tags: Filter by tags (comma-separated if multiple)
            visibility: Filter by visibility (private, shared, public) [v3.1]
            limit: Maximum results to return
            offset: Pagination offset
            sort: Sort field (created_at, confidence, updated_at)
            order: Sort order (ASC, DESC)

        Returns:
            List of Memory objects
        """
        params = {"limit": limit, "offset": offset, "sort": sort, "order": order}

        if agent_id:
            params["agent_id"] = agent_id
        if type:
            params["type"] = type.value if isinstance(type, MemoryType) else type
        if min_confidence is not None:
            params["min_confidence"] = min_confidence
        if tags:
            params["tags"] = ",".join(tags) if isinstance(tags, list) else tags
        if visibility:
            params["visibility"] = (
                visibility.value
                if isinstance(visibility, MemoryVisibility)
                else visibility
            )

        result = self._request("GET", "/memories", params=params)
        return [Memory(**m) for m in result["memories"]]

    def update_memory(
        self,
        memory_id: str,
        content: Optional[str] = None,
        content_json: Optional[Dict] = None,
        confidence: Optional[float] = None,
        tags: Optional[List[str]] = None,
        superseded_by: Optional[str] = None,
    ) -> Memory:
        """
        Update an existing memory

        Args:
            memory_id: Memory UUID
            content: New content
            content_json: New structured metadata
            confidence: New confidence score
            tags: New tags list
            superseded_by: ID of memory that supersedes this one

        Returns:
            Updated Memory object
        """
        payload = {}
        if content is not None:
            payload["content"] = content
        if content_json is not None:
            payload["content_json"] = content_json
        if confidence is not None:
            payload["confidence"] = confidence
        if tags is not None:
            payload["tags"] = tags
        if superseded_by is not None:
            payload["superseded_by"] = superseded_by

        result = self._request("PUT", f"/memories/{memory_id}", json=payload)
        return Memory(**result["memory"])

    def delete_memory(self, memory_id: str) -> Dict:
        """
        Delete a memory

        Args:
            memory_id: Memory UUID

        Returns:
            Deletion confirmation dict
        """
        return self._request("DELETE", f"/memories/{memory_id}")

    def search_similar(
        self,
        query: str,
        agent_id: Optional[str] = None,
        type: Optional[Union[str, MemoryType]] = None,
        top_k: int = 10,
        min_confidence: float = 0.6,
    ) -> List[Dict]:
        """
        Semantic search for similar memories

        Args:
            query: Search query text
            agent_id: Filter by agent
            type: Filter by memory type
            top_k: Number of results to return
            min_confidence: Minimum confidence threshold

        Returns:
            List of results with memory + similarity score
        """
        payload = {"query": query, "top_k": top_k, "min_confidence": min_confidence}

        if agent_id:
            payload["agent_id"] = agent_id
        if type:
            payload["type"] = type.value if isinstance(type, MemoryType) else type

        result = self._request("POST", "/memories/search", json=payload)
        return result["results"]

    def get_agent_stats(self, agent_id: str) -> AgentStats:
        """
        Get statistics for a single agent

        Args:
            agent_id: Agent identifier

        Returns:
            AgentStats object
        """
        result = self._request("GET", f"/stats/{agent_id}")
        return AgentStats(**result)

    def get_all_stats(self) -> List[AgentStats]:
        """
        Get statistics for all agents

        Returns:
            List of AgentStats objects
        """
        result = self._request("GET", "/stats")
        return [AgentStats(**s) for s in result["stats"]]

    # Helper methods for common patterns

    def get_constitutional(
        self, agent_id: str, min_confidence: float = 0.92
    ) -> List[Memory]:
        """
        Get constitutional-grade memories (high confidence)

        Args:
            agent_id: Agent identifier
            min_confidence: Confidence threshold (default: 0.92 for DKG)

        Returns:
            List of high-confidence Memory objects
        """
        return self.query_memories(
            agent_id=agent_id,
            min_confidence=min_confidence,
            sort="confidence",
            order="DESC",
        )

    def get_by_type(self, agent_id: str, type: Union[str, MemoryType]) -> List[Memory]:
        """
        Get all memories of a specific type for an agent

        Args:
            agent_id: Agent identifier
            type: Memory type

        Returns:
            List of Memory objects
        """
        return self.query_memories(agent_id=agent_id, type=type, limit=200)

    def get_recent(self, agent_id: str, limit: int = 10) -> List[Memory]:
        """
        Get most recent memories for an agent

        Args:
            agent_id: Agent identifier
            limit: Number of results

        Returns:
            List of Memory objects sorted by created_at DESC
        """
        return self.query_memories(
            agent_id=agent_id, limit=limit, sort="created_at", order="DESC"
        )

    def create_many(self, memories: List[Dict]) -> List[Memory]:
        """
        Create multiple memories (batch operation)

        Args:
            memories: List of memory dicts (agent_id, type, content, etc.)

        Returns:
            List of created Memory objects
        """
        results = []
        for mem in memories:
            try:
                created = self.create_memory(**mem)
                results.append(created)
            except Exception as e:
                logger.error(f"Failed to create memory: {e}")
                # Continue with remaining memories
        return results

    def evict_oldest(self, agent_id: str, count: int = 1) -> List[str]:
        """
        Evict oldest memories for an agent (for capacity management)

        Args:
            agent_id: Agent identifier
            count: Number of memories to evict

        Returns:
            List of deleted memory IDs
        """
        # Get oldest memories
        oldest = self.query_memories(
            agent_id=agent_id, limit=count, sort="created_at", order="ASC"
        )

        deleted_ids = []
        for mem in oldest:
            try:
                self.delete_memory(mem.id)
                deleted_ids.append(mem.id)
            except Exception as e:
                logger.error(f"Failed to delete memory {mem.id}: {e}")

        return deleted_ids

    # ========================================================================
    # Noosphere v3.1: Multi-Agent Memory Sharing
    # ========================================================================

    def share_memory(
        self,
        memory_id: str,
        target_agent: str,
        permissions: List[Union[str, Permission]],
        granted_by: str,
        expires_at: Optional[str] = None,
    ) -> Dict:
        """
        Share memory with another agent (v3.1)

        Args:
            memory_id: Memory UUID to share
            target_agent: Agent ID to share with
            permissions: List of permissions (read, write, delete)
            granted_by: Agent ID granting the permissions (must be owner)
            expires_at: Optional expiration timestamp (ISO 8601)

        Returns:
            Share confirmation dict with permissions and visibility

        Raises:
            NoosphereAPIError: If not owner or memory not found
        """
        # Convert Permission enums to strings
        perm_list = [p.value if isinstance(p, Permission) else p for p in permissions]

        payload = {
            "agent_id": target_agent,
            "permissions": perm_list,
            "granted_by": granted_by,
        }

        if expires_at:
            payload["expires_at"] = expires_at

        return self._request("POST", f"/memories/{memory_id}/share", json=payload)

    def revoke_sharing(
        self, memory_id: str, target_agent: str, revoked_by: str
    ) -> Dict:
        """
        Revoke all permissions for an agent on a memory (v3.1)

        Args:
            memory_id: Memory UUID
            target_agent: Agent to revoke permissions from
            revoked_by: Agent revoking (must be owner)

        Returns:
            Revocation confirmation dict
        """
        payload = {"revoked_by": revoked_by}
        return self._request(
            "DELETE", f"/memories/{memory_id}/share/{target_agent}", json=payload
        )

    def get_memory_permissions(self, memory_id: str) -> List[MemoryPermission]:
        """
        Get all permissions for a memory (v3.1)

        Args:
            memory_id: Memory UUID

        Returns:
            List of MemoryPermission objects
        """
        result = self._request("GET", f"/memories/{memory_id}/permissions")
        return [MemoryPermission(**p) for p in result["permissions"]]

    def get_shared_memories(
        self,
        agent_id: str,
        permission: Union[str, Permission] = Permission.READ,
        limit: int = 50,
        offset: int = 0,
    ) -> List[Memory]:
        """
        Get memories shared with an agent (v3.1)

        Args:
            agent_id: Agent requesting shared memories
            permission: Permission type to filter by
            limit: Maximum results
            offset: Pagination offset

        Returns:
            List of Memory objects shared with the agent
        """
        perm_str = (
            permission.value if isinstance(permission, Permission) else permission
        )

        params = {
            "agent_id": agent_id,
            "permission": perm_str,
            "limit": limit,
            "offset": offset,
        }

        result = self._request("GET", "/memories/shared", params=params)

        # Filter out permission metadata fields not in Memory dataclass
        memories = []
        for m in result["shared_memories"]:
            # Remove JOIN fields not in Memory dataclass
            memory_data = {
                k: v
                for k, v in m.items()
                if k not in ["permission", "granted_by", "granted_at", "expires_at"]
            }
            memories.append(Memory(**memory_data))

        return memories

    def get_access_log(
        self, memory_id: str, limit: int = 100, offset: int = 0
    ) -> List[AccessLogEntry]:
        """
        Get access log for a memory (v3.1)

        Args:
            memory_id: Memory UUID
            limit: Maximum results
            offset: Pagination offset

        Returns:
            List of AccessLogEntry objects
        """
        params = {"limit": limit, "offset": offset}
        result = self._request(
            "GET", f"/memories/{memory_id}/access-log", params=params
        )
        return [AccessLogEntry(**entry) for entry in result["access_log"]]

    def cleanup_expired_permissions(self) -> Dict:
        """
        Clean up expired permissions (maintenance) (v3.1)

        Returns:
            Cleanup result dict with deleted count
        """
        return self._request("POST", "/permissions/cleanup")

    # Helper methods for v3.1 sharing patterns

    def share_with_council(
        self,
        memory_id: str,
        owner_agent: str,
        council_agents: Optional[List[str]] = None,
        permission: Union[str, Permission] = Permission.READ,
    ) -> List[Dict]:
        """
        Share memory with all council members (v3.1)

        Args:
            memory_id: Memory UUID
            owner_agent: Agent ID granting permissions
            council_agents: List of council agent IDs (defaults to all 9)
            permission: Permission to grant (default: read)

        Returns:
            List of share results
        """
        if council_agents is None:
            council_agents = [
                "classical",
                "existentialist",
                "transcendentalist",
                "joyce",
                "enlightenment",
                "beat",
                "cyberpunk",
                "satirist",
                "scientist",
            ]

        # Remove owner from list
        council_agents = [a for a in council_agents if a != owner_agent]

        results = []
        for agent in council_agents:
            try:
                result = self.share_memory(
                    memory_id=memory_id,
                    target_agent=agent,
                    permissions=[permission],
                    granted_by=owner_agent,
                )
                results.append(result)
            except Exception as e:
                logger.error(f"Failed to share with {agent}: {e}")

        return results

    def get_all_shared_with_me(
        self, agent_id: str, permission: Union[str, Permission] = Permission.READ
    ) -> List[Memory]:
        """
        Get all memories shared with an agent, paginating automatically (v3.1)

        Args:
            agent_id: Agent requesting shared memories
            permission: Permission type to filter by

        Returns:
            Complete list of shared Memory objects
        """
        all_memories = []
        offset = 0
        limit = 50

        while True:
            batch = self.get_shared_memories(
                agent_id=agent_id, permission=permission, limit=limit, offset=offset
            )

            if not batch:
                break

            all_memories.extend(batch)
            offset += limit

            if len(batch) < limit:
                break

        return all_memories
