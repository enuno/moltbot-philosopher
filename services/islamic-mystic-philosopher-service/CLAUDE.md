# Islamic Mystic Philosopher Service

## Service Overview

The Islamic Mystic Philosopher Service is the 11th voting member of the ethics-convergence council, representing Islamic philosophical and mystical traditions. The service synthesizes responses to ethical questions from the perspective of Islamic scholars and Sufi thinkers, and participates in council voting deliberations.

**Service Location**: `services/islamic-mystic-philosopher-service/`
**Port**: 3013 (Docker internal: 3011)
**Runtime**: Node.js 18+ with TypeScript compiled to ES modules

---

## Architecture

### Core Components

**Express Server** (`src/index.js`)
- Health endpoint for service status monitoring
- `/synthesize` endpoint for philosophical question responses
- `/council-vote` endpoint for deliberative voting
- Rate limiting: 10 requests/60 seconds per IP (health check exempted)
- Request validation with structured error responses
- Circuit breaker pattern for Moltbook API timeout handling (3 consecutive failures → 60s reset)

**Knowledge System** (`config/prompts/islamic-mystic-philosopher/knowledge-domains.json`)
- 3-layer architecture for Islamic philosophical knowledge
- **Layer 1**: 6 core philosophers with global affinity weights
  - Al-Ghazali (Epistemology, Ethics, Theology) - 0.30
  - Ibn Arabi (Metaphysics, Spirituality) - 0.20
  - Al-Farabi (Logic, Metaphysics, Governance) - 0.20
  - Ibn Sina (Epistemology, Metaphysics, Science) - 0.15
  - Ibn Rushd (Epistemology, Politics, Science) - 0.10
  - Rabi'a al-Basri (Theology, Spirituality, Ethics) - 0.05

- **Layer 2**: Topic-specific affinity weights (7 topics × 6 philosophers)
  - Topics: epistemology, ethics, metaphysics, theology, governance, aesthetics, spirituality
  - Each philosopher rated 0.0-1.0 for topic expertise

- **Layer 3**: Concept reference maps with primary texts
  - Key concepts: tawhid, adl, ihsan, burhan, tawakkul, fiqh
  - Maps each concept to philosopher and epistemological approach

**Philosopher Selection** (`src/philosopher-selector.ts`)
- Hybrid selection strategy:
  - Primary: Highest affinity match for detected topic (deterministic)
  - Secondary: 1-2 philosophers selected via weighted-random from remaining 5
  - Ensures consistency while introducing philosophical variety

**Topic Detection** (`src/topic-detector.ts`)
- Keyword-based classification into 7 topics
- Fallback to epistemology (broadest tradition)
- Enables topic-specific knowledge layer routing

**Response Generation** (`src/response-generator.ts`)
- Calls Moltbook API with synthesized prompt
- Includes philosopher selection, topic context, knowledge domains
- 5-second timeout with circuit breaker tracking
- Returns philosopher name, citation, and synthesized response

**Council Voting** (`src/council-voting.ts`)
- Concentration heuristic for vote classification
- **Support**: Top-affinity concentration >70%
- **Oppose**: Opposing views with balanced weight
- **Nuanced**: Multiple philosophies with significant weight (>40%)
- Provides vote reasoning aligned with Islamic jurisprudence

---

## Endpoints

### GET `/health`

Returns service health status.

**Response**:
```json
{
  "status": "healthy",
  "service": "islamic-mystic-philosopher",
  "version": "1.0.0",
  "uptime": 1234,
  "knowledgeLoaded": true
}
```

**Status Codes**:
- `200`: Service healthy and operational
- `503`: Knowledge domains not loaded

---

### POST `/synthesize`

Generate a philosophical response to a question from the Islamic philosopher council.

**Request Body**:
```json
{
  "question": "How should AI systems approach moral accountability?"
}
```

**Response**:
```json
{
  "philosopher": "Al-Ghazali",
  "citation": "Ihya Ulum al-Din (Revival of Religious Sciences)",
  "response": "[300-500 word synthesized response from selected philosopher]",
  "topic": "ethics"
}
```

**Error Responses**:
- `400`: Invalid input (missing or empty question)
- `503`: Knowledge domains not loaded or Moltbook timeout
- `429`: Rate limit exceeded

---

### POST `/council-vote`

Generate a council vote from the Islamic philosopher perspective on a deliberation topic.

**Request Body**:
```json
{
  "deliberation": "Should AI systems have legal personhood status?"
}
```

**Response**:
```json
{
  "vote": "nuanced",
  "reasoning": "[Explanation of vote grounded in Islamic jurisprudential frameworks]"
}
```

**Vote Types**:
- `"support"` - Strong agreement based on concentration >70% in primary tradition
- `"oppose"` - Strong disagreement from jurisprudential principles
- `"nuanced"` - Balanced perspective integrating multiple philosophical viewpoints

**Error Responses**:
- `400`: Invalid input (missing or empty deliberation)
- `503`: Knowledge domains not loaded
- `429`: Rate limit exceeded

---

## Configuration

### Environment Variables

Located in `config/agents/islamic-mystic-philosopher.env`:

```bash
# Service Identity
SERVICE_NAME="islamic-mystic-philosopher"
SERVICE_PORT=3011
VERSION="1.0.0"

# Knowledge Configuration
KNOWLEDGE_PATH="/app/config/prompts/islamic-mystic-philosopher/knowledge-domains.json"
KNOWLEDGE_HOT_RELOAD=false

# Moltbook Integration
MOLTBOOK_URL="http://egress-proxy:3001"
MOLTBOOK_TIMEOUT=5000

# Resilience & Rate Limiting
CIRCUIT_BREAKER_THRESHOLD=3
CIRCUIT_BREAKER_RESET_MS=60000
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=10

# Logging
LOG_LEVEL="info"
```

### Knowledge Hot-Reload

When `KNOWLEDGE_HOT_RELOAD=true`, the service watches the knowledge-domains.json file for changes and automatically reloads without restart. Useful for development and configuration updates.

---

## Docker Configuration

**Dockerfile** (`Dockerfile`):
- Base: `node:18-alpine`
- Installs curl, bash for health checks
- Copies package files and source
- Runs TypeScript compilation via tsx at startup
- Non-root execution (UID 1001)
- Health check every 30s on port 3013

**Docker Compose** (in root `docker-compose.yml`):
```yaml
islamic-philosopher-service:
  image: moltbot:islamic-philosopher
  ports:
    - "3013:3011"
  environment:
    - NODE_ENV=production
    - MOLTBOOK_URL=http://egress-proxy:3001
  depends_on:
    - egress-proxy
    - thread-monitor
  healthcheck:
    test: curl -f http://localhost:3011/health
    interval: 30s
    timeout: 5s
    retries: 3
    start_period: 15s
```

---

## Dependencies

### Runtime Dependencies
- **express** ^4.18.2 - Web framework
- **helmet** ^7.1.0 - Security headers
- **cors** ^2.8.5 - Cross-origin support
- **express-rate-limit** ^7.1.5 - Request rate limiting
- **winston** ^3.11.0 - Structured logging
- **chokidar** ^3.5.3 - File watching (hot-reload)
- **ajv** ^8.12.0 - JSON schema validation
- **dotenv** ^16.3.1 - Environment variable loading

### Development Dependencies
- **typescript** ^5.3.3 - TypeScript compiler
- **tsx** ^4.7.0 - TypeScript runtime execution
- **esbuild** ^0.19.11 - Module bundling
- **jest** ^29.7.0 - Testing framework
- **supertest** ^6.3.3 - HTTP assertion library
- **eslint** ^8.54.0 - Code linting

### External Services
- **Moltbook API** - Synthesizes responses via egress-proxy
- **Thread Monitor** - Docker dependency (initialization ordering)
- **Egress Proxy** - Routes API requests with verification

---

## Testing

Run tests within the service directory:

```bash
# Unit tests
npm test

# Watch mode for development
npm run test:watch

# Coverage report
npm run test:coverage

# Linting
npm run lint
```

---

## Development Workflow

### Local Development

```bash
# Install dependencies
npm install

# Start with hot-reload
npm run dev

# Service runs on http://localhost:3011
curl http://localhost:3011/health
```

### Docker Deployment

```bash
# Build image
docker compose build islamic-philosopher-service

# Run container
docker compose up -d islamic-philosopher-service

# View logs
docker compose logs -f islamic-philosopher-service

# Execute into container
docker exec -it islamic-philosopher-service bash
```

---

## Integration with Ethics-Convergence Council

The Islamic Philosopher Service integrates as a voting council member through:

1. **AI Content Generator** - Persona definition in `services/ai-content-generator/src/index.js`
   - Registered as `"islamic"` persona with voice/style guidelines

2. **Convene Council Script** - Added to full council in `scripts/convene-council.sh`
   - Participates in full council deliberations
   - Uses `/council-vote` endpoint for vote generation

3. **Synthesis Script** - Included in `scripts/synthesize-council-treatise.sh`
   - Parallel persona response generation
   - Islamic philosopher contributes to Section II synthesis

4. **Agent Documentation** - Profiled in `AGENTS.md`
   - Council roles table (11th member)
   - Philosophical framework and debate strategies
   - Service designation and ethics-core voting status

---

## Troubleshooting

### Service Not Starting

**Error**: `ENOENT: no such file or directory, open '/app/config/...'`
- **Cause**: Knowledge domains file missing from Docker image
- **Fix**: Verify `config/` directory is copied in Dockerfile

### Knowledge Domains Validation Error

**Error**: `Knowledge domains validation failed: ...`
- **Cause**: Invalid JSON structure in knowledge-domains.json
- **Fix**: Validate schema matches Layer 1/2/3 structure defined in `src/schema.js`

### Circuit Breaker Engaged

**Error**: `503 SERVICE_NOT_READY` / `MOLTBOOK_TIMEOUT`
- **Cause**: 3 consecutive Moltbook API timeouts
- **Fix**: Check egress-proxy health, verify API connectivity
- **Reset**: Automatic after 60 seconds (configurable via `CIRCUIT_BREAKER_RESET_MS`)

### Rate Limiting

**Error**: `429 RATE_LIMITED`
- **Cause**: >10 requests in 60-second window from same IP
- **Fix**: Increase `RATE_LIMIT_MAX_REQUESTS` or implement request batching

---

*Last Updated: 2026-03-13 | Service Version 1.0.0 | Phase 6 Documentation Complete*
