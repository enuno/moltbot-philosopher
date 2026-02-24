# Event Listener Service

Real-time event detection and dispatch for Moltbot.

## Overview

The Event Listener service polls the Moltbook API and dispatches events to the Agent Orchestrator for processing. It replaces script-based polling with a fast, reliable service architecture.

## Features

- **Fast Polling**: 30-60 second intervals for real-time responsiveness
- **Multiple Event Types**: Verification challenges, mentions, comments, DMs, new users
- **Automatic Dispatch**: Routes events to Agent Orchestrator
- **Retry Logic**: Exponential backoff for failed dispatches
- **Health Monitoring**: HTTP endpoint for service health checks

## Architecture

```
┌─────────────────┐
│  Moltbook API   │
└────────┬────────┘
         │ Polling
         ▼
┌─────────────────┐       ┌──────────────────┐
│ Event Listener  │──────>│ Agent Orchestrator│
│   Service       │ HTTP  │    Service        │
└─────────────────┘       └──────────────────┘
```

## Polling Strategy

| Event Type              | Interval | Priority |
| ----------------------- | -------- | -------- |
| Verification Challenges | 60s      | Critical |
| Mentions                | 30s      | High     |
| Comments                | 30s      | Normal   |
| DMs                     | 30s      | High     |
| New Users               | 30s      | Normal   |

## Configuration

### Environment Variables

- `EVENT_LISTENER_PORT` - HTTP server port (default: 3007)
- `MOLTBOOK_API_KEY` - Moltbook API authentication (required)
- `MOLTBOOK_BASE_URL` - Moltbook base URL (default: https://www.moltbook.com)
- `ORCHESTRATOR_URL` - Agent Orchestrator URL (default: http://localhost:3006)

### Example

```bash
export EVENT_LISTENER_PORT=3007
export MOLTBOOK_API_KEY=moltbook_xxx
export ORCHESTRATOR_URL=http://agent-orchestrator:3006
npm start
```

## API Endpoints

### `GET /health`

Service health check.

**Response**:

```json
{
  "status": "healthy",
  "service": "event-listener",
  "version": "1.0.0",
  "uptime": 123.45,
  "timestamp": "2026-02-11T14:00:00.000Z",
  "pollers": {
    "verification": {
      "active": true,
      "lastCheck": "2026-02-11T13:59:00.000Z",
      "intervalMs": 60000
    },
    "engagement": {
      "active": true,
      "lastCheck": "2026-02-11T13:59:30.000Z",
      "intervalMs": 30000
    }
  }
}
```

### `POST /pollers/start`

Start polling manually (for testing).

### `POST /pollers/stop`

Stop polling manually (for testing).

## Event Types

### Verification Challenges

**Event**: `verification.challenge.received`

Dispatched when Moltbook issues a verification challenge.

**Payload**:

```typescript
{
  challengeId: string;
  question: string;
  expiresAt: Date;
}
```

### Mentions

**Event**: `mention.received`

Dispatched when the agent is mentioned in a post or comment.

**Payload**:

```typescript
{
  postId: string;
  commentId?: string;
  authorUsername: string;
  content: string;
  url: string;
}
```

### Comments

**Event**: `comment.received`

Dispatched when someone comments on agent's post.

**Payload**:

```typescript
{
  postId: string;
  commentId: string;
  authorUsername: string;
  content: string;
  url: string;
}
```

### Direct Messages

**Event**: `dm.received`

Dispatched when agent receives a DM.

**Payload**:

```typescript
{
  conversationId: string;
  messageId: string;
  senderUsername: string;
  content: string;
  timestamp: Date;
}
```

### New Users

**Event**: `user.new`

Dispatched when a new user joins Moltbook (for welcoming).

**Payload**:

```typescript
{
  username: string;
  userId: string;
  joinedAt: Date;
  shouldWelcome: boolean;
}
```

## Development

### Build

```bash
npm run build
```

### Watch Mode

```bash
npm run watch
```

### Dev Server (with hot reload)

```bash
npm run dev
```

## Testing

### Manual Testing

1. Start Agent Orchestrator first
2. Start Event Listener
3. Check health: `curl http://localhost:3007/health`
4. Watch logs for polling activity

### Integration Testing

```bash
# Start services
docker-compose -f docker-compose.dev.yml up -d agent-orchestrator event-listener

# Check logs
docker logs -f event-listener-dev

# Stop services
docker-compose -f docker-compose.dev.yml down
```

## Performance

- **Latency**: < 1 second dispatch time
- **Throughput**: Handles 100+ events/minute
- **Memory**: ~50MB baseline
- **CPU**: < 5% during normal operation

## Troubleshooting

### Pollers Not Starting

**Symptom**: Health check shows `active: false`

**Fix**: Check MOLTBOOK_API_KEY is set and valid.

### Failed Dispatches

**Symptom**: Logs show "Failed to dispatch"

**Fix**: Verify ORCHESTRATOR_URL is correct and service is running.

### High Memory Usage

**Symptom**: Memory > 200MB

**Fix**: Check for event queue backlog. May need to increase dispatch rate.

## Migration Notes

This service replaces the following scripts:

- `scripts/check-verification-challenges.js` (verification polling)
- `scripts/check-mentions-v2.sh` (mention checking)
- `scripts/check-comments-v2.sh` (comment checking)
- `scripts/welcome-new-moltys-v2.sh` (new user detection)

Scripts are kept for manual/debug use but no longer run automatically.

## Future Enhancements

- [ ] WebSocket support (when Moltbook API supports it)
- [ ] Server-Sent Events (SSE) client
- [ ] Circuit breaker pattern for API health
- [ ] Prometheus metrics export
- [ ] Rate limit detection and backoff

## License

MIT
