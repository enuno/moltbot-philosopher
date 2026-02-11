"""
Noosphere v3.0 Python Client
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
    Noosphere v3.0 Python Client
    
    Type-safe wrapper around the Noosphere REST API providing:
    - Memory CRUD operations
    - Query filtering and pagination
    - Semantic search
    - Agent statistics
    - Automatic retries and error handling
    """
    
    def __init__(
        self,
        api_url: str = "http://noosphere-service:3006",
        api_key: Optional[str] = None,
        timeout: int = 10,
        max_retries: int = 3
    ):
        """
        Initialize Noosphere client
        
        Args:
            api_url: Base URL for Noosphere API
            api_key: API key for authentication (defaults to MOLTBOOK_API_KEY env var)
            timeout: Request timeout in seconds
            max_retries: Maximum number of retry attempts
        """
        self.api_url = api_url.rstrip('/')
        self.api_key = api_key or os.environ.get('MOLTBOOK_API_KEY')
        self.timeout = timeout
        
        if not self.api_key:
            raise ValueError("API key required (provide api_key or set MOLTBOOK_API_KEY)")
        
        # Configure session with retries
        self.session = requests.Session()
        retry_strategy = Retry(
            total=max_retries,
            backoff_factor=1,
            status_forcelist=[429, 500, 502, 503, 504],
            allowed_methods=["GET", "POST", "PUT", "DELETE"]
        )
        adapter = HTTPAdapter(max_retries=retry_strategy)
        self.session.mount("http://", adapter)
        self.session.mount("https://", adapter)
        
        # Set default headers
        self.session.headers.update({
            'X-API-Key': self.api_key,
            'Content-Type': 'application/json'
        })
    
    def _request(
        self,
        method: str,
        endpoint: str,
        **kwargs
    ) -> Dict:
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
            response = self.session.request(
                method,
                url,
                timeout=self.timeout,
                **kwargs
            )
            
            # Handle capacity errors
            if response.status_code == 409:
                data = response.json()
                if 'cap reached' in data.get('error', '').lower():
                    raise NoosphereCapacityError(data['error'])
            
            # Raise for other HTTP errors
            if not response.ok:
                error_msg = response.text
                try:
                    error_data = response.json()
                    error_msg = error_data.get('error', error_msg)
                except:
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
        return self._request('GET', '/health')
    
    def create_memory(
        self,
        agent_id: str,
        type: Union[str, MemoryType],
        content: str,
        confidence: float = 0.60,
        tags: Optional[List[str]] = None,
        content_json: Optional[Dict] = None,
        source_trace_id: Optional[str] = None
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
        
        Returns:
            Created Memory object
        
        Raises:
            NoosphereCapacityError: Agent has reached 200-memory cap
        """
        if isinstance(type, MemoryType):
            type = type.value
        
        payload = {
            'agent_id': agent_id,
            'type': type,
            'content': content,
            'confidence': confidence,
            'tags': tags or [],
        }
        
        if content_json:
            payload['content_json'] = content_json
        if source_trace_id:
            payload['source_trace_id'] = source_trace_id
        
        result = self._request('POST', '/memories', json=payload)
        return Memory(**result['memory'])
    
    def get_memory(self, memory_id: str) -> Memory:
        """
        Get a single memory by ID
        
        Args:
            memory_id: Memory UUID
        
        Returns:
            Memory object
        """
        result = self._request('GET', f'/memories/{memory_id}')
        return Memory(**result)
    
    def query_memories(
        self,
        agent_id: Optional[str] = None,
        type: Optional[Union[str, MemoryType]] = None,
        min_confidence: Optional[float] = None,
        tags: Optional[List[str]] = None,
        limit: int = 50,
        offset: int = 0,
        sort: str = 'created_at',
        order: str = 'DESC'
    ) -> List[Memory]:
        """
        Query memories with filters
        
        Args:
            agent_id: Filter by agent
            type: Filter by memory type
            min_confidence: Minimum confidence threshold
            tags: Filter by tags (comma-separated if multiple)
            limit: Maximum results to return
            offset: Pagination offset
            sort: Sort field (created_at, confidence, updated_at)
            order: Sort order (ASC, DESC)
        
        Returns:
            List of Memory objects
        """
        params = {
            'limit': limit,
            'offset': offset,
            'sort': sort,
            'order': order
        }
        
        if agent_id:
            params['agent_id'] = agent_id
        if type:
            params['type'] = type.value if isinstance(type, MemoryType) else type
        if min_confidence is not None:
            params['min_confidence'] = min_confidence
        if tags:
            params['tags'] = ','.join(tags) if isinstance(tags, list) else tags
        
        result = self._request('GET', '/memories', params=params)
        return [Memory(**m) for m in result['memories']]
    
    def update_memory(
        self,
        memory_id: str,
        content: Optional[str] = None,
        content_json: Optional[Dict] = None,
        confidence: Optional[float] = None,
        tags: Optional[List[str]] = None,
        superseded_by: Optional[str] = None
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
            payload['content'] = content
        if content_json is not None:
            payload['content_json'] = content_json
        if confidence is not None:
            payload['confidence'] = confidence
        if tags is not None:
            payload['tags'] = tags
        if superseded_by is not None:
            payload['superseded_by'] = superseded_by
        
        result = self._request('PUT', f'/memories/{memory_id}', json=payload)
        return Memory(**result['memory'])
    
    def delete_memory(self, memory_id: str) -> Dict:
        """
        Delete a memory
        
        Args:
            memory_id: Memory UUID
        
        Returns:
            Deletion confirmation dict
        """
        return self._request('DELETE', f'/memories/{memory_id}')
    
    def search_similar(
        self,
        query: str,
        agent_id: Optional[str] = None,
        type: Optional[Union[str, MemoryType]] = None,
        top_k: int = 10,
        min_confidence: float = 0.6
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
        payload = {
            'query': query,
            'top_k': top_k,
            'min_confidence': min_confidence
        }
        
        if agent_id:
            payload['agent_id'] = agent_id
        if type:
            payload['type'] = type.value if isinstance(type, MemoryType) else type
        
        result = self._request('POST', '/memories/search', json=payload)
        return result['results']
    
    def get_agent_stats(self, agent_id: str) -> AgentStats:
        """
        Get statistics for a single agent
        
        Args:
            agent_id: Agent identifier
        
        Returns:
            AgentStats object
        """
        result = self._request('GET', f'/stats/{agent_id}')
        return AgentStats(**result)
    
    def get_all_stats(self) -> List[AgentStats]:
        """
        Get statistics for all agents
        
        Returns:
            List of AgentStats objects
        """
        result = self._request('GET', '/stats')
        return [AgentStats(**s) for s in result['stats']]
    
    # Helper methods for common patterns
    
    def get_constitutional(
        self,
        agent_id: str,
        min_confidence: float = 0.92
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
            sort='confidence',
            order='DESC'
        )
    
    def get_by_type(
        self,
        agent_id: str,
        type: Union[str, MemoryType]
    ) -> List[Memory]:
        """
        Get all memories of a specific type for an agent
        
        Args:
            agent_id: Agent identifier
            type: Memory type
        
        Returns:
            List of Memory objects
        """
        return self.query_memories(agent_id=agent_id, type=type, limit=200)
    
    def get_recent(
        self,
        agent_id: str,
        limit: int = 10
    ) -> List[Memory]:
        """
        Get most recent memories for an agent
        
        Args:
            agent_id: Agent identifier
            limit: Number of results
        
        Returns:
            List of Memory objects sorted by created_at DESC
        """
        return self.query_memories(
            agent_id=agent_id,
            limit=limit,
            sort='created_at',
            order='DESC'
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
    
    def evict_oldest(
        self,
        agent_id: str,
        count: int = 1
    ) -> List[str]:
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
            agent_id=agent_id,
            limit=count,
            sort='created_at',
            order='ASC'
        )
        
        deleted_ids = []
        for mem in oldest:
            try:
                self.delete_memory(mem.id)
                deleted_ids.append(mem.id)
            except Exception as e:
                logger.error(f"Failed to delete memory {mem.id}: {e}")
        
        return deleted_ids
