# Noosphere v3.0 Service

5-Type Memory Architecture API for Moltbot Philosopher agents.

## Architecture

**Database**: PostgreSQL 16 + pgvector  
**Memory Types**: insight, pattern, strategy, preference, lesson  
**Cap**: 200 memories per agent  
**Embeddings**: OpenAI ada-002 (optional)

## API Endpoints

### Health
- `GET /health` - Service health check (no auth)

### Memories
- `POST /memories` - Create memory
- `GET /memories` - Query memories (filters: agent_id, type, min_confidence, tags)
- `GET /memories/:id` - Get single memory
- `PUT /memories/:id` - Update memory
- `DELETE /memories/:id` - Delete memory
- `POST /memories/search` - Semantic search (requires embeddings)

### Statistics
- `GET /stats` - All agent statistics
- `GET /stats/:agent_id` - Single agent statistics

## Authentication

All endpoints (except `/health`) require authentication via:
- Header: `X-API-Key: <MOLTBOOK_API_KEY>`
- OR: `Authorization: Bearer <MOLTBOOK_API_KEY>`

## Environment Variables

```bash
PORT=3006
DATABASE_URL=postgresql://user:password@postgres:5432/noosphere
MOLTBOOK_API_KEY=moltbook_xxx
OPENAI_API_KEY=sk-xxx  # Optional
EMBEDDING_MODEL=text-embedding-ada-002
ENABLE_EMBEDDINGS=true
MAX_MEMORIES_PER_AGENT=200
LOG_LEVEL=info
```

## Development

```bash
npm install
npm run dev  # Watch mode
npm start    # Production
```

## Docker

```bash
docker build -t moltbot:noosphere-service .
docker run -p 3006:3006 --env-file .env moltbot:noosphere-service
```

## Example Usage

**Create Memory**:

```bash
curl -X POST http://localhost:3006/memories \
  -H "X-API-Key: $MOLTBOOK_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "classical",
    "type": "strategy",
    "content": "In council deliberations, defer to Transcendentalist on democratic governance questions",
    "confidence": 0.85,
    "tags": ["council", "governance", "alliance"]
  }'
```

**Query Memories**:

```bash
curl "http://localhost:3006/memories?agent_id=classical&type=strategy&min_confidence=0.8" \
  -H "X-API-Key: $MOLTBOOK_API_KEY"
```

**Semantic Search**:

```bash
curl -X POST http://localhost:3006/memories/search \
  -H "X-API-Key: $MOLTBOOK_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "how should we handle AI autonomy debates?",
    "agent_id": "classical",
    "top_k": 5,
    "min_confidence": 0.7
  }'
```

## Migration from v2.6

See Phase 1-3 in `DEVELOPMENT_PLAN.md` for migration strategy from JSON files to PostgreSQL.

---

**Version**: 3.0.0  
**Last Updated**: 2026-02-11
