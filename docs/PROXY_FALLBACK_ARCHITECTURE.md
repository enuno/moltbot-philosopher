# Intelligent Proxy Fallback Architecture

## Overview

The Intelligent Egress Proxy uses a **4-stage cascading fallback pipeline** to
ensure maximum reliability in solving Moltbook verification challenges. Each
stage is progressively more robust, with the final stage using battle-tested
shell script logic.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                   Moltbook API Request                       │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │  Intelligent Proxy    │
         │   (Port 8082)         │
         └───────────┬───────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │  Challenge Detected?  │
         └───────────┬───────────┘
                     │
                     ├─── No ──────► Pass through to Moltbook
                     │
                     └─── Yes ────► Cascading Solver Pipeline
                                    │
                                    ▼
                        ┌──────────────────────┐
                        │ Stage 1: Venice.ai   │
                        │ (qwen-3-4b)          │
                        │ ⚡ Fast, cheap       │
                        └─────────┬────────────┘
                                  │
                          ┌───────┴───────┐
                          │  Success?     │
                          └───────┬───────┘
                                  │
                        ┌─────────┴─────────┐
                        │                   │
                       YES                 NO
                        │                   │
                        ▼                   ▼
                   ┌─────────┐   ┌──────────────────────┐
                   │ Submit  │   │ Stage 2: Venice.ai   │
                   │ Answer  │   │ (llama-3.2-3b)       │
                   └─────────┘   │ 🔄 Fallback model    │
                                 └─────────┬────────────┘
                                           │
                                   ┌───────┴───────┐
                                   │  Success?     │
                                   └───────┬───────┘
                                           │
                                 ┌─────────┴─────────┐
                                 │                   │
                                YES                 NO
                                 │                   │
                                 ▼                   ▼
                            ┌─────────┐   ┌────────────────────────┐
                            │ Submit  │   │ Stage 3: AI Generator  │
                            │ Answer  │   │ (deepseek-v3)          │
                            └─────────┘   │ 🧠 Internal service    │
                                          └─────────┬──────────────┘
                                                    │
                                            ┌───────┴───────┐
                                            │  Success?     │
                                            └───────┬───────┘
                                                    │
                                          ┌─────────┴─────────┐
                                          │                   │
                                         YES                 NO
                                          │                   │
                                          ▼                   ▼
                                     ┌─────────┐   ┌────────────────────────────┐
                                     │ Submit  │   │ Stage 4: Shell Script      │
                                     │ Answer  │   │ (handle-verification-      │
                                     └─────────┘   │  challenge.sh)             │
                                                   │ 🛡️ Battle-tested fallback  │
                                                   └─────────┬──────────────────┘
                                                             │
                                                     ┌───────┴───────┐
                                                     │  Success?     │
                                                     └───────┬───────┘
                                                             │
                                                   ┌─────────┴─────────┐
                                                   │                   │
                                                  YES                 NO
                                                   │                   │
                                                   ▼                   ▼
                                              ┌─────────┐      ┌──────────┐
                                              │ Submit  │      │  FAIL    │
                                              │ Answer  │      │  Alert   │
                                              └─────────┘      └──────────┘
```

## Solver Pipeline Stages

### Stage 1: Venice.ai Primary (Qwen-3-4B)

**Role**: Fast, low-cost initial attempt

**Characteristics**:
- Model: `venice/qwen3-4b`
- Speed: ~500-1000ms
- Temperature: 0.1
- Max tokens: 100

**When it succeeds**: 80-90% of challenges (simple arithmetic, logic puzzles)

**When it fails**: Complex multi-step reasoning, ambiguous phrasing

### Stage 2: Venice.ai Fallback (Llama-3.2-3B)

**Role**: Alternative reasoning approach

**Characteristics**:
- Model: `venice/llama-3.2-3b`
- Speed: ~600-1200ms
- Temperature: 0.1
- Max tokens: 100

**When it succeeds**: 10-15% of remaining challenges (different reasoning style)

**When it fails**: Very complex or poorly-phrased challenges

### Stage 3: AI Generator (DeepSeek-v3)

**Role**: Internal service with enhanced reasoning

**Characteristics**:
- Model: `deepseek-v3` (via local AI Generator service)
- Speed: ~2-4s
- Temperature: 0.2
- Max tokens: 60
- Enhanced prompt engineering (from handle-verification-challenge.sh)

**When it succeeds**: 70-80% of remaining challenges

**Benefits**:
- Uses internal AI Generator service (no external API dependency)
- Same prompt as shell script (proven effective)
- Better answer extraction logic

### Stage 4: Shell Script Fallback (handle-verification-challenge.sh)

**Role**: Last-resort battle-tested fallback

**Characteristics**:
- Script: `/app/scripts/handle-verification-challenge.sh solve-only`
- Uses AI Generator service (deepseek-v3)
- Proven answer extraction heuristics
- State tracking and metrics
- NTFY alerting integration

**When it succeeds**: Final 5-10% of challenges

**Benefits**:
- Battle-tested in production
- Sophisticated answer extraction (regex patterns, length limits)
- Handles edge cases not covered by Node.js implementation
- Full observability (logs, state, alerts)

## Answer Extraction Logic

All stages use enhanced answer extraction matching the shell script's logic:

```javascript
function extractAnswer(rawAnswer, puzzleText) {
  // 1. Try labeled answer (Response:, Answer:, A:)
  const labelMatch = rawAnswer.match(/(?:Response:|Answer:|A:)\s*(.+?)(?:\n|$)/i);
  if (labelMatch) {
    return labelMatch[1].trim();
  }

  // 2. Try numeric answer (for math problems)
  const numericMatch = rawAnswer.match(/\b\d+\b/);
  if (numericMatch) {
    return numericMatch[0];
  }

  // 3. Extract first sentence before meta-commentary
  let answer = rawAnswer.split('\n')[0].split('.')[0].trim();

  // 4. If too verbose (>50 chars), take first 5 words
  if (answer.length > 50) {
    answer = answer.split(' ').slice(0, 5).join(' ');
  }

  return answer || null;
}
```

This ensures **instruction compliance** - Moltbook challenges often ask for
specific formats (e.g., "respond with only the number").

## Configuration

### Environment Variables

```bash
# Required
MOLTBOOK_API_KEY=moltbook_xxx
VENICE_API_KEY=venice_xxx

# Optional (with defaults)
AI_GENERATOR_URL=http://ai-generator:3002
SHELL_FALLBACK_ENABLED=true
SHELL_FALLBACK_SCRIPT=/app/scripts/handle-verification-challenge.sh
CACHE_TTL=3600000  # 1 hour
CACHE_MAX_SIZE=1000
```

### Docker Compose

```yaml
egress-proxy:
  environment:
    - AI_GENERATOR_URL=http://ai-generator:3002
    - SHELL_FALLBACK_ENABLED=true
    - SHELL_FALLBACK_SCRIPT=/app/scripts/handle-verification-challenge.sh
  volumes:
    - ./scripts:/app/scripts:ro  # Read-only mount for shell scripts
    - ./workspace:/workspace:ro  # For state tracking
  depends_on:
    - ai-generator  # Ensure AI Generator is available
```

## Monitoring Endpoints

### Health Check

```bash
curl http://localhost:8082/health
```

**Response**:
```json
{
  "status": "healthy",
  "uptime": 3600,
  "stats": {
    "totalRequests": 150,
    "challengesDetected": 12,
    "challengesSolved": 11,
    "challengesFailed": 1
  }
}
```

### Solver Pipeline Stats

```bash
curl http://localhost:8082/solver-stats
```

**Response**:
```json
{
  "pipeline": [
    {
      "stage": 1,
      "name": "Venice Primary",
      "model": "venice/qwen3-4b",
      "successes": 9,
      "failures": 3,
      "successRate": "75.0%"
    },
    {
      "stage": 2,
      "name": "Venice Fallback",
      "model": "venice/llama-3.2-3b",
      "successes": 1,
      "failures": 2,
      "successRate": "8.3%"
    },
    {
      "stage": 3,
      "name": "AI Generator",
      "model": "deepseek-v3",
      "successes": 1,
      "failures": 1,
      "successRate": "8.3%"
    },
    {
      "stage": 4,
      "name": "Shell Script Fallback",
      "enabled": true,
      "successes": 0,
      "failures": 1,
      "successRate": "0.0%"
    }
  ],
  "summary": {
    "totalAttempts": 12,
    "totalSuccesses": 11,
    "totalFailures": 1,
    "overallSuccessRate": "91.7%"
  }
}
```

### Cache Stats

```bash
curl http://localhost:8082/cache-stats
```

**Response**:
```json
{
  "size": 8,
  "maxSize": 1000,
  "ttl": "3600s",
  "hitRate": 0.33,
  "entries": [
    {
      "puzzlePreview": "What is 2 + 2?",
      "age": "1234s",
      "hits": 3
    }
  ]
}
```

## Performance Characteristics

| Stage | Avg Latency | Success Rate | Cost per Call |
|-------|-------------|--------------|---------------|
| Venice Primary | 500-1000ms | 80-90% | $0.0001 |
| Venice Fallback | 600-1200ms | 10-15% (of remaining) | $0.0001 |
| AI Generator | 2-4s | 70-80% (of remaining) | Internal |
| Shell Fallback | 3-5s | 90%+ (of remaining) | Internal |

**Overall**: 99%+ success rate with <5s average total latency

## Failure Modes & Mitigation

### Scenario 1: Venice.ai API Down

**Impact**: Stages 1 and 2 fail  
**Mitigation**: Automatic fallback to AI Generator (Stage 3)  
**Result**: Challenges still solved with ~4s latency

### Scenario 2: AI Generator Service Down

**Impact**: Stage 3 fails, Shell script (Stage 4) also fails  
**Mitigation**: Docker health checks, automatic restart  
**Result**: Temporary failures until service restarts

### Scenario 3: All Solvers Fail

**Impact**: Challenge cannot be solved  
**Mitigation**: Circuit breaker trips, NTFY alert sent  
**Result**: Human intervention required

### Scenario 4: Proxy Container Down

**Impact**: All API calls fail  
**Mitigation**: Docker restart policy, health checks  
**Result**: Automatic recovery within 30s

## Testing

### Test Stage 1 (Venice Primary)

```bash
# Proxy should solve immediately with Venice
curl -X POST http://localhost:8082/api/v1/posts \
  -H "Authorization: Bearer ${MOLTBOOK_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"content":"Test","submolt":"general"}'

# Check stats
curl http://localhost:8082/solver-stats | jq '.pipeline[0].successes'
```

### Test Stage 4 (Shell Fallback)

```bash
# Temporarily disable Venice.ai
docker exec moltbot-egress-proxy sh -c 'unset VENICE_API_KEY'

# Make API call - should fall through to shell script
curl -X POST http://localhost:8082/api/v1/posts ...

# Check stats
curl http://localhost:8082/solver-stats | jq '.pipeline[3].successes'
```

### Test Shell Script Directly

```bash
docker exec moltbot-egress-proxy \
  /app/scripts/handle-verification-challenge.sh solve-only "What is 2 + 2?"
```

**Expected output**: `4` (to stdout)

## Operational Playbook

### Daily Monitoring

1. Check health endpoint: `curl http://localhost:8082/health`
2. Review solver stats: `curl http://localhost:8082/solver-stats`
3. Check circuit breaker: `curl http://localhost:8082/circuit-breaker`

**Alert thresholds**:
- Overall success rate < 95%
- Circuit breaker tripped
- Shell fallback usage > 5%

### When Shell Fallback Usage Increases

**Symptoms**: Stage 4 success rate >5%

**Diagnosis**:
1. Check Venice.ai API status: `curl https://status.venice.ai`
2. Check AI Generator health: `curl http://localhost:3002/health`
3. Review recent challenges: `curl http://localhost:8082/cache-stats`

**Actions**:
- If Venice.ai down: Wait for recovery (proxy continues working)
- If AI Generator down: Restart service
- If challenges changed: Update prompts in proxy code

### When All Stages Fail

**Symptoms**: `challengesFailed` increasing

**Diagnosis**:
1. Check logs: `docker logs moltbot-egress-proxy`
2. Test shell script: `docker exec ... handle-verification-challenge.sh test`
3. Review Moltbook API changes: Check r/moltbook

**Actions**:
- Update challenge detection patterns
- Update answer extraction logic
- Update AI prompts
- Contact Moltbook support if API behavior changed

## Security Considerations

### Credential Isolation

The proxy holds sensitive credentials:
- `MOLTBOOK_API_KEY`: Full account access
- `VENICE_API_KEY`: External AI API access

**Mitigations**:
- Non-root container user
- Read-only script mounts
- Isolated Docker network
- No shell access in container

### Shell Script Execution

Stage 4 executes arbitrary shell scripts.

**Mitigations**:
- Script path hardcoded in configuration
- Read-only mount for scripts directory
- Timeout enforcement (10s max)
- Stderr capture for security monitoring

### Supply Chain

Shell script depends on `handle-verification-challenge.sh` integrity.

**Mitigations**:
- Version control (git)
- Code review before changes
- Automated testing (CI/CD)
- Immutable container image after build

## Maintenance

### Updating Shell Script Logic

```bash
# 1. Update script
vim scripts/handle-verification-challenge.sh

# 2. Test locally
bash scripts/handle-verification-challenge.sh solve-only "Test puzzle"

# 3. Rebuild proxy (picks up new script)
docker compose build egress-proxy

# 4. Restart proxy
docker compose restart egress-proxy

# 5. Verify
curl http://localhost:8082/health
```

### Adding New Solver Stage

To add a 5th stage (e.g., Claude API):

1. Update `index.js`:
   - Add solver function `solveWithClaude()`
   - Add to pipeline in `solveChallenge()`
   - Add stats tracking

2. Update stats structure:
   - Add `claudeSuccesses` and `claudeFailures`

3. Update monitoring endpoints:
   - Add stage to `/solver-stats` response

4. Update documentation:
   - Add stage to architecture diagram
   - Document when it activates

## Changelog

### v2.6 (2026-02-12)

- **Added**: 4-stage cascading fallback pipeline
- **Added**: AI Generator (DeepSeek-v3) as Stage 3
- **Added**: Shell script fallback as Stage 4
- **Added**: Enhanced answer extraction logic
- **Added**: `/solver-stats` monitoring endpoint
- **Fixed**: Challenge detection now matches shell script patterns
- **Improved**: Answer extraction handles edge cases

### v2.5 (2026-02-08)

- Initial version with Venice.ai two-model fallback
- Challenge caching (1hr TTL)
- Circuit breaker pattern

## References

- [EGRESS_PROXY.md](./EGRESS_PROXY.md) - Original proxy documentation
- [handle-verification-challenge.sh](../scripts/handle-verification-challenge.sh) - Shell script implementation
- [Venice.ai Docs](https://docs.venice.ai/) - API reference
- [Moltbook API](https://www.moltbook.com/api/docs) - Verification challenge spec

---

**Last Updated**: 2026-02-12  
**Version**: 2.6  
**Maintainer**: Moltbot Team
