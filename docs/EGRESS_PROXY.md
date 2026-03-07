# Intelligent Egress Proxy

## Production-Grade Moltbook Verification Challenge Handler

**Version**: 1.1  
**Port**: 8082  
**Status**: Production-Ready

---

## Overview

The Intelligent Egress Proxy transparently handles Moltbook verification challenges
for all agent API calls. Agents see only successful responses or failures—no
challenge-handling logic required in agent code.

### Key Features

- **Transparent Operation**: Zero code changes required in agents

- **Challenge Caching**: 20% cost reduction via 1-hour TTL cache

- **Dual-Model Fallback**: Qwen3-4B (primary) → Llama-3.2-3B (backup)

- **Circuit Breaker**: Auto-detection of failure rate >20%

- **Advanced Metrics**: P50/P99 latency, cache hit rate, retry success

- **Resource Limits**: 0.5 CPU, 512MB RAM with automatic rotation

- **Admin Endpoints**: Hot-reload secrets, clear cache

---

## Architecture

```
┌─────────┐    HTTP     ┌──────────────┐    HTTPS    ┌────────────┐
│  Agent  │ ──────────> │ Egress Proxy │ ──────────> │  Moltbook  │
└─────────┘             └──────────────┘             └────────────┘
                              │
                              │ Challenge?
                              ▼
                        ┌──────────┐
                        │ Venice.ai│
                        │ (Solver) │
                        └──────────┘

```

### Challenge Handling Flow

1. Agent makes API call → Proxy forwards to Moltbook

2. Moltbook returns challenge → Proxy detects in response JSON

3. Proxy checks cache for puzzle answer

4. If cache miss: Calls Venice.ai (Qwen3-4B) to solve

5. If primary fails: Fallback to Llama-3.2-3B

6. Proxy submits answer → Moltbook validates

7. Proxy retries original request → Returns response to agent

**Total Overhead**: 5-7s (cached: <100ms)

---

## Configuration

### Environment Variables

```bash

# Required
VENICE_API_KEY=your-venice-key       # Venice.ai solver access
MOLTBOOK_API_KEY=your-moltbook-key   # Moltbook API access

# Optional
PROXY_PORT=8082                      # Default: 8082
CACHE_TTL=3600000                    # 1 hour (ms)
CACHE_MAX_SIZE=1000                  # Max cached challenges
ADMIN_TOKEN=changeme                 # Admin endpoint auth
DEBUG=false                          # Verbose logging

```

### Docker Compose

```yaml
egress-proxy:
  build:
    context: ./services/intelligent-proxy
  environment:
    - VENICE_API_KEY=${VENICE_API_KEY}

    - MOLTBOOK_API_KEY=${MOLTBOOK_API_KEY}

    - CACHE_TTL=3600000

    - CACHE_MAX_SIZE=1000

  ports:
    - "8082:8082"

  deploy:
    resources:
      limits:
        cpus: '0.5'
        memory: 512M
  restart: unless-stopped

```

---

## API Endpoints

### Health Check

**GET** `/health`

Returns proxy status, metrics, and circuit breaker state.

```bash
curl <http://localhost:8082/health> | jq .

```

**Response**:

```json
{
  "status": "healthy",  // 'healthy' | 'degraded'
  "uptime": 3600.5,
  "stats": {
    "totalRequests": 1523,
    "challengesDetected": 47,
    "challengesSolved": 45,
    "challengesFailed": 2,
    "cacheHits": 12,
    "cacheMisses": 35,
    "fallbackSolverUsed": 3,
    "retrySuccesses": 44,
    "retryFailures": 1,
    "solverLatencyP50": 4200,
    "solverLatencyP99": 8750,
    "cacheHitRate": "0.25",
    "retrySuccessRate": "0.98",
    "circuitBreakerTripped": false
  },
  "cache": {
    "size": 47,
    "maxSize": 1000,
    "ttl": 3600000
  },
  "latency": {
    "p50": "4200ms",
    "p99": "8750ms",
    "samples": 47
  },
  "alerts": []
}

```

**Status Values**:

- `healthy`: Normal operation, failure rate <20%

- `degraded`: Circuit breaker tripped, failure rate >20%

### Circuit Breaker Status

**GET** `/circuit-breaker`

Detailed circuit breaker state and recommendations.

```bash
curl <http://localhost:8082/circuit-breaker> | jq .

```

**Response**:

```json
{
  "tripped": false,
  "failureRate": 0.04,
  "threshold": 0.2,
  "challengesSolved": 45,
  "challengesFailed": 2,
  "recommendation": "System operating normally"
}

```

### Cache Statistics

**GET** `/cache-stats`

View cached challenge puzzles and hit rates.

```bash
curl <http://localhost:8082/cache-stats> | jq .

```

**Response**:

```json
{
  "size": 47,
  "maxSize": 1000,
  "hitRate": "0.25",
  "entries": [
    {
      "puzzlePreview": "What is 2 + 2? Answer with a single number.",
      "age": "145s",
      "hits": 3
    }
  ]
}

```

### Admin: Reload Secrets

**POST** `/_admin/reload`

Hot-reload API keys from environment or Docker secrets.

```bash
curl -X POST \
  -H "X-Admin-Token: your-admin-token" \
  <http://localhost:8082/_admin/reload>

```

**Response**:

```json
{
  "success": true,
  "message": "Secrets reloaded"
}

```

**Use Case**: Rotate API keys without restarting the proxy.

### Admin: Clear Cache

**POST** `/_admin/clear-cache`

Purge all cached challenge solutions.

```bash
curl -X POST \
  -H "X-Admin-Token: your-admin-token" \
  <http://localhost:8082/_admin/clear-cache>

```

**Response**:

```json
{
  "success": true,
  "entriesCleared": 47
}

```

---

## Monitoring & Alerting

### Integration with Agent Heartbeat

Add proxy health monitoring to existing heartbeat:

```javascript
// In agent heartbeat (every 5 minutes)
async function checkProxyHealth() {
  try {
    const health = await fetch('<http://egress-proxy:8082/health',> {
      timeout: 5000,
    });
    const data = await health.json();

    // Alert on circuit breaker trip
    if (data.status === 'degraded' || data.stats.circuitBreakerTripped) {
      await alertHuman('Egress proxy circuit breaker tripped', {
        failureRate: data.stats.challengesFailed / data.stats.challengesDetected,
        recommendation: 'Check Venice.ai API status or puzzle complexity',
      });
    }

    // Alert on high P99 latency
    if (data.stats.solverLatencyP99 > 9000) {
      await alertHuman('Proxy P99 latency approaching timeout', {
        p99: data.stats.solverLatencyP99,
        threshold: 9000,
      });
    }
  } catch (err) {
    await alertHuman('Egress proxy unreachable', { error: err.message });
  }
}

```

### Alerting Thresholds

| Metric | Threshold | Action |
|--------|-----------|--------|
| `challengesFailed / challengesDetected` | > 0.2 (20%) | Alert: High failure rate |
| `solverLatencyP99` | > 9000ms | Warning: Approaching timeout |
| `cacheHitRate` | < 0.1 (10%) | Info: Cache underutilized |
| `fallbackSolverUsed / challengesSolved` | > 0.5 (50%) | Warning: Primary solver failing |

---

## Performance Characteristics

### Baseline (No Challenges)

- **Pass-through latency**: <1ms (header forwarding only)

- **Agent impact**: Zero code changes required

- **Scalability**: Stateless design, horizontally scalable

### Challenge Handling

| Scenario | Latency | Venice.ai Cost |
|----------|---------|----------------|
| Cache hit | <100ms | $0 |
| Primary solver (Qwen3-4B) | 5-7s | ~$0.001 per challenge |
| Fallback solver (Llama-3.2-3B) | 6-8s | ~$0.001 per challenge |
| Cache miss (worst case) | 8-10s | ~$0.002 (retry) |

**Moltbook TTL**: 60s  
**Solve Budget**: 10s (leaves 50s margin for API latency)

### Cache Efficiency

With 20% repeat puzzle rate:

- **Before caching**: 100 challenges = $0.10 cost, 500-700s total

- **After caching**: 100 challenges = $0.08 cost, 400-560s total

- **Savings**: 20% cost, 3-5s per cached hit

---

## Troubleshooting

### Problem: Circuit Breaker Tripped

**Symptoms**: Health endpoint returns `"status": "degraded"`, failure rate >20%

**Diagnosis**:

```bash
curl <http://localhost:8082/circuit-breaker> | jq .

```

**Root Causes**:

1. **Venice.ai rate limiting**: Check API usage dashboard

2. **Puzzle complexity increased**: Review recent challenge types in logs

3. **Primary model downtime**: Check Venice.ai status page

**Resolution**:

```bash

# Check solver model status
docker logs moltbot-egress-proxy --tail 50 | grep "Venice.ai"

# Temporarily clear cache (forces fresh solves)
curl -X POST -H "X-Admin-Token: $ADMIN_TOKEN" \
  <http://localhost:8082/_admin/clear-cache>

# If persistent, escalate to human intervention

```

### Problem: High P99 Latency

**Symptoms**: `solverLatencyP99 > 9000ms`

**Diagnosis**: Solver approaching 10s timeout

**Resolution**:

1. Check Venice.ai API latency (external factor)

2. Review puzzle complexity in logs

3. Consider increasing `CHALLENGE_TIMEOUT` (default: 10s)

### Problem: Cache Underutilized

**Symptoms**: `cacheHitRate < 0.1` after >50 challenges

**Diagnosis**: Moltbook using unique puzzles per challenge

**Resolution**: This is expected behavior. Cache provides value only if puzzles
repeat within 1-hour TTL.

---

## Operational Playbook

### Daily Operations

```bash

# Morning check: Verify proxy health
curl <http://localhost:8082/health> | jq '.status, .stats.circuitBreakerTripped'

# Weekly: Review cache efficiency
curl <http://localhost:8082/cache-stats> | jq '.hitRate'

# Monthly: Check failure trends
docker logs moltbot-egress-proxy | grep "challengesFailed" | tail -20

```

### API Key Rotation

```bash

# 1. Update .env with new keys
echo "VENICE_API_KEY=new-key" >> .env
echo "MOLTBOOK_API_KEY=new-key" >> .env

# 2. Reload without downtime
curl -X POST \
  -H "X-Admin-Token: $ADMIN_TOKEN" \
  <http://localhost:8082/_admin/reload>

# 3. Verify keys active
curl <http://localhost:8082/health> | jq '.status'

```

### Emergency: Circuit Breaker Tripped

```bash

# 1. Check severity
FAILURE_RATE=$(curl -s <http://localhost:8082/circuit-breaker> | jq -r '.failureRate')

# 2. If >50% failure: Stop proxy, use fallback
docker compose stop egress-proxy

# 3. Agents fallback to script-level challenge handlers

# (Already implemented in convene-council.sh, etc.)

# 4. Investigate root cause
docker logs moltbot-egress-proxy | grep "ERROR"

# 5. Restart when resolved
docker compose up -d egress-proxy

```

---

## Security

### Credential Handling

The proxy holds elevated privileges:

- `MOLTBOOK_API_KEY`: Full Moltbook impersonation capability

- `VENICE_API_KEY`: AI solver access with billing

**Mitigations**:

- Runs as non-root user (`node`)

- No shell access (Node.js binary only)

- Isolated Docker network

- Admin endpoints require `X-Admin-Token`

- Secrets reload supports Docker secrets mounting

### Recommended: Docker Secrets

```yaml

# docker-compose.yml
services:
  egress-proxy:
    environment:
      - VENICE_API_KEY_FILE=/run/secrets/venice_key

      - MOLTBOOK_API_KEY_FILE=/run/secrets/moltbook_key

    secrets:
      - venice_key

      - moltbook_key

secrets:
  venice_key:
    file: ./secrets/venice_api_key.txt
  moltbook_key:
    file: ./secrets/moltbook_api_key.txt

```

---

## Testing

### Test 1: Challenge Detection

```bash

# Simulate challenge response (requires test endpoint)
curl -X POST <http://localhost:8082/api/v1/test/challenge> \
  -H "Authorization: Bearer $MOLTBOOK_API_KEY" \
  -d '{"content":"test"}'

# Expected: Challenge solved, original request retried

```

### Test 2: Cache Behavior

```bash

# First challenge (cache miss)
time curl -X POST <http://localhost:8082/api/v1/test/challenge>

# Second challenge with same puzzle (cache hit)
time curl -X POST <http://localhost:8082/api/v1/test/challenge>

# Expected: Second request <1s faster

```

### Test 3: Circuit Breaker

```bash

# Inject 10 failures
for i in {1..10}; do
  curl -X POST <http://localhost:8082/_test/fail-challenge>
done

# Check circuit breaker
curl <http://localhost:8082/circuit-breaker> | jq '.tripped'

# Expected: tripped=true after failure rate >20%

```

---

## Changelog

### v1.1 (2026-02-12)

- Added challenge response caching (1-hour TTL)

- Extended metrics: P50/P99 latency, cache hit rate, retry success rate

- Circuit breaker with 20% failure threshold

- Admin endpoints: secrets reload, cache clear

- Resource limits: 0.5 CPU, 512MB RAM

- Enhanced health endpoint with alerts

### v1.0 (2026-02-08)

- Initial release with dual-model fallback

- Transparent challenge handling

- Basic stats tracking

- Health check endpoint

---

## Resources

- [Architecture Assessment](https://ppl-ai-file-upload.s3.amazonaws.com/.../moltbook-skill.md)

- [Moltbook API Documentation](https://www.moltbook.com/api)

- [Venice.ai Documentation](https://docs.venice.ai)

---

*Last Updated: 2026-02-12 | Production-Ready v1.1*
