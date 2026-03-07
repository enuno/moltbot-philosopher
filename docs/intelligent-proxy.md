# Intelligent Egress Proxy - Automatic Verification Challenge Handler

## Overview

The Intelligent Egress Proxy is a transparent HTTP proxy that sits between all Moltbot services and the Moltbook API. It automatically detects and solves verification challenges before they reach the calling application.

## Architecture

```
┌─────────────────┐     ┌───────────────────┐     ┌─────────────┐
│  Moltbot Script │────▶│ Intelligent Proxy │────▶│  Moltbook   │
│  (convene, etc) │     │  (port 8082)      │     │  API        │
└─────────────────┘     └───────────────────┘     └─────────────┘
                               │
                               ▼
                        ┌──────────────┐
                        │  Venice.ai   │
                        │   (solver)   │
                        └──────────────┘

```

## Features

### 1. Transparent Proxying
- All HTTP requests pass through unchanged

- Preserves headers, body, and request method

- No modification to request flow

### 2. Challenge Detection
- Intercepts JSON responses from Moltbook API

- Detects `verification_challenge` or `challenge` field

- Extracts challenge ID and puzzle text

### 3. Automatic Solving
- Calls AI Content Generator with minimal prompt

- 10-second timeout for solving

- Retry logic for robustness

### 4. Challenge Submission
- Submits answer to `/api/v1/agents/verification/submit`

- Validates response (success/failure)

- Logs all attempts

### 5. Request Retry
- On successful challenge solve, retries original request

- Transparent to calling application

- Returns successful response

### 6. Statistics Tracking
- Total requests proxied

- Challenges detected

- Challenges solved

- Challenges failed

- Last challenge timestamp

## Configuration

Environment variables:

```bash
PROXY_PORT=8082                              # Listening port
VENICE_API_KEY=venice_xxx                    # Venice.ai API key
MOLTBOOK_API_KEY=moltbook_xxx                # Moltbook API key
DEBUG=false                                  # Debug logging

```

## API Endpoints

### Health Check

```bash
GET /health
GET /_health

```

Response:

```json
{
  "status": "healthy",
  "uptime": 123.45,
  "stats": {
    "totalRequests": 42,
    "challengesDetected": 3,
    "challengesSolved": 3,
    "challengesFailed": 0,
    "lastChallengeTime": "2026-02-11T22:56:00.000Z"
  }
}

```

### Proxy (All Other Requests)

```bash
ALL /*

```

All requests are proxied to `<https://www.moltbook.com`> with automatic challenge handling.

## Flow Diagram

```

1. Script makes POST /api/v1/posts/{id}/comments

   ↓

2. Proxy forwards to Moltbook API

   ↓

3. Moltbook returns verification_challenge

   ↓

4. Proxy detects challenge field

   ↓

5. Proxy extracts ID and puzzle text

   ↓

6. Proxy calls AI Generator to solve

   ↓

7. AI Generator returns answer

   ↓

8. Proxy submits answer to /api/v1/agents/verification/submit

   ↓

9. Moltbook confirms answer accepted

   ↓

10. Proxy retries original POST request

    ↓

11. Moltbook returns successful comment creation

    ↓

12. Proxy forwards success to script

    ↓

13. Script receives comment ID (no challenge seen)

```

## Failure Modes

### Venice.ai API Unreachable
- Challenge solve times out after 10 seconds

- Tries fallback model automatically

- If both fail, returns original response (with challenge)

- Script-level fallback handler can retry

- Stats: `challengesFailed` incremented

### AI Generator Returns No Answer
- Logged as error

- Original response returned to script

- Stats: `challengesFailed` incremented

### Challenge Submission Fails
- Answer rejected by Moltbook

- Original response returned to script

- Stats: `challengesFailed` incremented

### Original Request Retry Fails
- Logged as error

- 500 response sent to script

- Stats: `challengesSolved` still incremented (challenge passed)

## Defense-in-Depth

While the proxy handles challenges automatically, scripts maintain fallback challenge handlers for redundancy:

1. **Primary**: Proxy intercepts and solves (automatic, transparent)

2. **Fallback**: Script detects challenge in response and handles (manual, explicit)

This ensures challenges never block operations even if proxy has issues.

## Logging

All events are logged with timestamps:

```
[2026-02-11T22:56:50.539Z] [INFO] 🔐 Intelligent proxy on port 8082
[2026-02-11T23:15:30.123Z] [WARN] 🔐 Challenge detected | {"id":"abc123"}
[2026-02-11T23:15:31.456Z] [SUCCESS] Solved | {"answer":"The answer is 42"}
[2026-02-11T23:15:32.789Z] [SUCCESS] Answer accepted
[2026-02-11T23:15:33.012Z] [SUCCESS] ✅ Retrying request
[2026-02-11T23:15:34.345Z] [SUCCESS] Retry done | {"status":200}

```

## Statistics

Statistics are logged every 5 minutes if there's activity:

```
[2026-02-11T23:20:00.000Z] [INFO] Stats | {
  "totalRequests": 42,
  "challengesDetected": 3,
  "challengesSolved": 3,
  "challengesFailed": 0,
  "lastChallengeTime": "2026-02-11T23:15:30.123Z"
}

```

## Performance

- Challenge detection: < 1ms (JSON parse)

- AI solving: ~3-5 seconds (Venice/Kimi)

- Challenge submission: ~500ms

- Request retry: ~1 second

- **Total overhead**: 5-7 seconds per challenge

Without challenges, there's no performance impact (pass-through).

## Testing

### Test Health Endpoint

```bash
curl <http://localhost:8082/health> | jq .

```

### Test Proxying (No Challenge)

```bash
curl -X GET <http://localhost:8082/api/v1/posts/123> \
  -H "Authorization: Bearer ${MOLTBOOK_API_KEY}"

```

### Simulate Challenge (Requires Test Endpoint)

```bash

# This would need a test endpoint that returns a mock challenge
curl -X POST <http://localhost:8082/api/v1/test/challenge> \
  -H "Authorization: Bearer ${MOLTBOOK_API_KEY}"

```

## Monitoring

### Docker Logs

```bash
docker logs -f moltbot-egress-proxy

```

### Health Check

```bash
docker compose ps | grep egress-proxy

```

### Statistics API

```bash
watch -n 30 'curl -s <http://localhost:8082/health> | jq .stats'

```

## Deployment

### Build

```bash
docker compose build egress-proxy

```

### Start

```bash
docker compose up -d egress-proxy

```

### Restart

```bash
docker compose restart egress-proxy

```

### Logs

```bash
docker logs -f moltbot-egress-proxy

```

## Security

- Runs as non-root user (`node`)

- No shell access (Node.js only)

- Health check verifies service availability

- Graceful shutdown on SIGTERM

## Dependencies

- **Node.js 20**: Runtime

- **Venice.ai API**: Challenge solving (Qwen3-4B primary, Llama-3.2-3B fallback)

- **Moltbook API**: Target service (<https://www.moltbook.com>)

## Environment Impact

All Moltbook API calls now route through the proxy:

- Scripts use `<http://egress-proxy:8082`> instead of direct API

- Environment variable: `MOLTBOOK_API_URL` (if used)

- No code changes required in scripts

- Transparent challenge handling

## Troubleshooting

### Proxy Not Starting

```bash
docker logs moltbot-egress-proxy

# Check for:

# - Missing MOLTBOOK_API_KEY

# - Port already in use

# - Network connectivity

```

### Challenges Not Being Solved

```bash

# Check Venice.ai API key
docker exec moltbot-egress-proxy env | grep VENICE_API_KEY

# Check proxy logs for errors
docker logs moltbot-egress-proxy | grep -i challenge

# Test Venice.ai directly
curl -X POST <https://api.venice.ai/api/v1/chat/completions> \
  -H "Authorization: Bearer ${VENICE_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"model":"venice/qwen3-4b","messages":[{"role":"user","content":"What is 2+2?"}]}'

```

### High Failure Rate

```bash

# Check statistics
curl <http://localhost:8082/health> | jq .stats

# Common causes:

# - AI Generator timeout (increase CHALLENGE_TIMEOUT)

# - Incorrect puzzle format

# - API key issues

```

## Future Enhancements

- [ ] Support for multiple simultaneous challenges

- [ ] Challenge caching (same puzzle = same answer)

- [ ] Prometheus metrics export

- [ ] Configurable solve timeout

- [ ] Rate limiting for challenge attempts

- [ ] Challenge type detection (math, logic, captcha)

## References

- AI Content Generator: `services/ai-content-generator/`

- Verification Handler Script: `scripts/handle-verification-challenge.sh`

- Council Script: `scripts/convene-council.sh` (lines 788-820)
