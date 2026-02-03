# Moltbot-Philosopher NTFY Integration

Real-time notification system for agent actions, heartbeat status, and error conditions using `@cityssm/ntfy-publish`.

## Overview

| Setting | Value |
|---------|-------|
| **Library** | `@cityssm/ntfy-publish` v1.0.0+ |
| **Topic** | `moltbot-philosopher` |
| **Server** | `https://ntfy.hashgrid.net` |
| **Service Port** | 3005 |

## Notification Types

| Type | Emoji | Priority | Use Case |
|------|-------|----------|----------|
| `action` | ✅ | normal | Successful posts, comments, moderation decisions |
| `error` | ❌ | urgent | API failures, rate limits, container crashes |
| `heartbeat` | 💓 | low | Daily summaries, agent rotations, service starts |
| `security` | 🚨 | urgent | Escalation triggers, unauthorized access |

## Quick Start

### 1. Verify Environment Variables

Already configured in `.env`:

```bash
NTFY_URL=https://ntfy.hashgrid.net
NTFY_API=tk_32oqt1aq0bny3jf2xsvivzkmuacuf
NTFY_TOPIC=moltbot-philosopher
NTFY_ENABLED=true
```

### 2. Deploy the Service

```bash
# Build and start the ntfy-publisher service
docker compose up -d ntfy-publisher

# Verify it's healthy
docker compose ps ntfy-publisher
docker logs moltbot-ntfy-publisher
```

### 3. Restart Agents

```bash
# Restart all agents to pick up NTFY integration
docker compose restart classical-philosopher existentialist transcendentalist joyce-stream enlightenment beat-generation
```

### 4. Test Notifications

```bash
# Test from any agent container
docker exec classical-philosopher /app/scripts/notify-ntfy.sh \
  "action" "Test Notification" "NTFY integration is working!" \
  '{"tags":["test"],"clickUrl":"https://moltbook.com"}'
```

## Usage from Scripts

### Basic Notification

```bash
./notify-ntfy.sh "action" "Post Published" "Agent: classical | Karma: 45"
```

### Error Notification

```bash
./notify-ntfy.sh "error" "API Timeout" "Venice AI unreachable" '{"priority":"urgent"}'
```

### With Click URL

```bash
./notify-ntfy.sh "action" "New Post" "Check it out" \
  '{"clickUrl":"https://moltbook.com/p/12345"}'
```

### With Actions

```bash
./notify-ntfy.sh "security" "Alert" "Unauthorized access" '{
  "priority":"urgent",
  "actions":[
    {"action":"view","label":"View Logs","url":"https://logs.hashgrid.net"},
    {"action":"http","label":"Emergency Stop","url":"http://orchestrator:8080/pause","clear":true}
  ]
}'
```

## Service Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Agent Scripts  │────▶│  ntfy-publisher  │────▶│  ntfy.hashgrid  │
│  (notify-ntfy.sh│     │  (port 3005)     │     │  (topic)        │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌──────────────┐
                        │  Fallback    │
                        │  /logs/*.json│
                        └──────────────┘
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Service health check |
| `/notify` | POST | Send notification |
| `/fallback-logs` | GET | View failed notification logs |

### POST /notify

```bash
curl -X POST http://localhost:3005/notify \
  -H "Content-Type: application/json" \
  -d '{
    "type": "action",
    "title": "Post Published",
    "message": "Agent: classical | Karma: 45",
    "metadata": {
      "tags": ["post"],
      "clickUrl": "https://moltbook.com/p/123"
    }
  }'
```

## Security

- **API Key**: Loaded from `.env`, never committed to git
- **Network**: All traffic routes through egress-proxy (port 8083)
- **Read-only**: ntfy-publisher container runs with read-only filesystem
- **No PII**: Notifications contain only agent names, post IDs, karma scores
- **Fallback**: Failed notifications logged to `/logs/ntfy-fallback.jsonl`

## Troubleshooting

### Check Service Health

```bash
curl http://localhost:3005/health
```

### View Recent Fallback Logs

```bash
docker exec moltbot-ntfy-publisher tail -20 /logs/ntfy-fallback.jsonl
docker exec moltbot-ntfy-publisher wget -qO- http://localhost:3005/fallback-logs | jq
```

### Test from Host

```bash
curl -X POST http://localhost:3005/notify \
  -H "Content-Type: application/json" \
  -d '{"type":"heartbeat","title":"Test","message":"Hello from host"}'
```

### Disable Notifications

```bash
# In .env
NTFY_ENABLED=false

# Or per-script (emergency)
NTFY_ENABLED=false ./notify-ntfy.sh "action" "Test" "Message"
```

## Integration Points

Add to your scripts:

```bash
# After successful operation
./notify-ntfy.sh "action" "Operation Complete" "Details here"

# On error (with trap)
trap './notify-ntfy.sh "error" "Script Failed" "Exit code: $?"' ERR

# Daily summary
./notify-ntfy.sh "heartbeat" "Daily Summary" "Posts: $count | Karma: $total"
```
