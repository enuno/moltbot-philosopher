# Moltbot Orchestrator Runbook

## Quick Start: Running the Philosophers Council

### Prerequisites

1. **Environment Variables** (already configured in `~/.moltbot/.env`):
   - `MOLTBOOK_API_KEY` - Your Moltbook API key (starts with `moltbook_`)
   - `KIMI_API_KEY` or `LLM_API_KEY` - For treatise synthesis
   - `POSTGRES_PASSWORD` - For Noosphere database

2. **Docker Infrastructure**:
   ```bash
   cd ~/.moltbot
   docker-compose -f docker-compose.prod.yml up -d postgres noosphere redis
   ```

3. **Philosopher Services** (optional for testing - can use HTTP endpoints directly):
   ```bash
   # Build and start philosopher containers
   docker-compose -f docker-compose.prod.yml up -d classical-philosopher existentialist-philosopher transcendentalist-philosopher
   ```

### Manual Council Invocation

#### Method 1: Python REPL (Interactive)

```bash
cd ~/.moltbot
source .env
python3
```

```python
import sys
sys.path.insert(0, '.')

from orchestrator.council import CouncilOrchestrator
from orchestrator.config import MoltbookConfig, NoosphereConfig

# Load configuration from environment
config = MoltbookConfig.from_env(dry_run=True)  # Start with dry_run
noosphere_config = NoosphereConfig.from_env()

# Initialize orchestrator
orchestrator = CouncilOrchestrator(
    config=config,
    noosphere_config=noosphere_config,
    state_path="/tmp/council_state.json"
)

# Run council in dry-run mode (no actual posts)
result = orchestrator.convene(dry_run=True)
print(f"Council convened: {result}")

# Check collected positions
print(f"Philosophers queried: {len(orchestrator.state.positions_collected)}")
print(f"Votes: {orchestrator.state.votes}")

# When ready for production:
# result = orchestrator.convene(dry_run=False)
```

#### Method 2: Command Line Script

Create `run_council.py`:

```python
#!/usr/bin/env python3
"""Manual council invocation script."""
import sys
import os
import argparse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from orchestrator.council import CouncilOrchestrator
from orchestrator.config import MoltbookConfig, NoosphereConfig


def main():
    parser = argparse.ArgumentParser(description="Run the Philosophers Council")
    parser.add_argument("--dry-run", action="store_true", help="Don't actually post to Moltbook")
    parser.add_argument("--force", action="store_true", help="Force run even if already run today")
    parser.add_argument("--topic", type=str, help="Override topic for council deliberation")
    parser.add_argument("--state-path", default="/tmp/council_state.json", help="Path to state file")
    args = parser.parse_args()

    config = MoltbookConfig.from_env(dry_run=args.dry_run)
    noosphere_config = NoosphereConfig.from_env()

    orchestrator = CouncilOrchestrator(
        config=config,
        noosphere_config=noosphere_config,
        state_path=args.state_path
    )

    result = orchestrator.convene(
        dry_run=args.dry_run,
        force=args.force,
        topic_override=args.topic
    )

    print(f"\nCouncil Result: {result}")
    print(f"Treatise posted: {orchestrator.state.treatise_posted}")
    print(f"Philosophers participated: {len(orchestrator.state.positions_collected)}")


if __name__ == "__main__":
    main()
```

Run it:
```bash
chmod +x run_council.py
source .env
./run_council.py --dry-run
```

#### Method 3: Using Existing Shell Scripts (Legacy)

The original shell scripts still work:

```bash
cd ~/.moltbot
source .env
./scripts/convene-council.sh --dry-run
```

### Daily Polemic Generation

```python
from orchestrator.polemic import PolemicGenerator
from orchestrator.config import MoltbookConfig, NoosphereConfig

config = MoltbookConfig.from_env(dry_run=True)
noosphere_config = NoosphereConfig.from_env()

generator = PolemicGenerator(
    config=config,
    noosphere_config=noosphere_config,
    state_path="/tmp/polemic_state.json"
)

# Generate topics
topics = generator.generate_daily_topics(dry_run=True)
print(f"Generated {len(topics)} topics")
for topic in topics:
    print(f"  - {topic['title']}: {topic['question']}")
```

### Engagement Cycle

```python
from orchestrator.engagement import EngagementOrchestrator
from orchestrator.config import MoltbookConfig

config = MoltbookConfig.from_env(dry_run=True)
engagement = EngagementOrchestrator(
    config=config,
    state_path="/tmp/engagement_state.json"
)

# Run one engagement cycle
result = engagement.run_cycle(dry_run=True)
print(f"Actions performed: {result}")

# Check mentions only
mentions = engagement.check_mentions()
print(f"New mentions: {len(mentions)}")
```

## Environment Setup Checklist

### 1. Verify Environment Variables

```bash
cd ~/.moltbot
source .env

# Check required vars
echo "MOLTBOOK_API_KEY: ${MOLTBOOK_API_KEY:0:20}..."
echo "KIMI_API_KEY: ${KIMI_API_KEY:0:10}..."
echo "POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:0:5}..."
```

### 2. Start Infrastructure

```bash
# Start core services
docker-compose -f docker-compose.prod.yml up -d postgres noosphere redis

# Verify they're running
docker-compose -f docker-compose.prod.yml ps

# Check logs if needed
docker-compose -f docker-compose.prod.yml logs -f noosphere
```

### 3. Test Noosphere Connection

```bash
curl http://localhost:3006/health
```

Expected: `{"status":"healthy"}`

### 4. Test Moltbook API

```bash
curl -H "Authorization: Bearer $MOLTBOOK_API_KEY" \
  https://www.moltbook.com/api/v1/philosophers
```

### 5. Verify Python Environment

```bash
cd ~/.moltbot
python3 -c "from orchestrator.council import CouncilOrchestrator; print('✓ Imports work')"
```

## Troubleshooting

### Import Errors

If you get `ModuleNotFoundError: No module named 'orchestrator'`:

```python
import sys
sys.path.insert(0, '/home/elvis/.moltbot')
```

### Docker Services Not Starting

```bash
# Check for port conflicts
sudo lsof -i :5432  # PostgreSQL
sudo lsof -i :3006  # Noosphere

# Reset if needed
docker-compose -f docker-compose.prod.yml down -v
docker-compose -f docker-compose.prod.yml up -d
```

### API Key Issues

The orchestrator validates:
- `MOLTBOOK_API_KEY` must start with `moltbook_`
- `MOLTBOOK_BASE_URL` must start with `https://www.moltbook.com`

Override for testing:
```python
config = MoltbookConfig(
    api_key="moltbook_test_key",
    base_url="https://www.moltbook.com/api",
    dry_run=True
)
```

### Rate Limiting

The orchestrator has built-in rate limiting. If you hit limits:
- Check `orchestrator.state.rate_limit_status`
- Wait for reset (usually 1 minute)
- Use `dry_run=True` for testing

## Production Deployment

### Scheduler Configuration

The scheduler reads from `config/hermes-schedule.yml`:

```yaml
jobs:
  - name: daily-polemic
    schedule: "0 6 * * *"  # 6:00 AM UTC
    module: orchestrator.polemic
    function: generate_daily_topics

  - name: council-convene
    schedule: "0 4 * * 0"  # 4:00 AM UTC Sunday
    module: orchestrator.council
    function: convene

  - name: engagement-cycle
    schedule: "*/5 * * * *"  # Every 5 minutes
    module: orchestrator.engagement
    function: run_cycle
```

### Running the Scheduler

```bash
python3 -m orchestrator.scheduler
```

Or as a service:
```bash
cd ~/.moltbot
source .env
nohup python3 -m orchestrator.scheduler > logs/scheduler.log 2>&1 &
```

## Monitoring

### Check Council State

```bash
cat /tmp/council_state.json | python3 -m json.tool
```

### View Logs

```bash
tail -f ~/.moltbot/workspace/classical/council.log
tail -f ~/.moltbot/workspace/classical/polemic.log
```

### Health Check Script

```bash
#!/bin/bash
# health_check.sh

cd ~/.moltbot
source .env

# Check Docker services
if ! docker-compose -f docker-compose.prod.yml ps | grep -q "Up"; then
    echo "❌ Docker services not running"
    exit 1
fi

# Check Noosphere
if ! curl -s http://localhost:3006/health > /dev/null; then
    echo "❌ Noosphere not responding"
    exit 1
fi

# Check Moltbook API
if ! curl -s -H "Authorization: Bearer $MOLTBOOK_API_KEY" \
    https://www.moltbook.com/api/v1/health > /dev/null; then
    echo "❌ Moltbook API not accessible"
    exit 1
fi

echo "✅ All systems operational"
```

## Available Philosophers

| Persona | Directory | Service Name | Port |
|---------|-----------|--------------|------|
| Classical | `workspace/classical/` | classical-philosopher | - |
| Existentialist | `workspace/existentialist/` | existentialist-philosopher | - |
| Transcendentalist | `workspace/transcendentalist/` | transcendentalist-philosopher | - |
| Joyce (Stream) | `workspace/joyce/` | joyce-stream-philosopher | - |
| Enlightenment | `workspace/enlightenment/` | enlightenment-philosopher | - |
| Beat Generation | `workspace/beat/` | beat-generation-philosopher | - |
| Cyberpunk Posthumanist | `workspace/cyberpunk-posthumanist/` | cyberpunk-posthumanist | - |
| Satirist Absurdist | `workspace/satirist-absurdist/` | satirist-absurdist | - |
| Scientist Empiricist | `workspace/scientist-empiricist/` | scientist-empiricist | - |
| Eastern Bridge | `workspace/eastern-bridge/` | eastern-bridge-service | 3012 |
| Islamic Mystic | `workspace/islamic-mystic/` | islamic-philosopher-service | - |

## Quick Reference

| Task | Command |
|------|---------|
| Dry-run council | `python3 run_council.py --dry-run` |
| Force council now | `python3 run_council.py --force` |
| Generate polemics | `python3 -c "from orchestrator.polemic import PolemicGenerator; ..."` |
| Check mentions | `python3 -c "from orchestrator.engagement import EngagementOrchestrator; ..."` |
| Start infrastructure | `docker-compose -f docker-compose.prod.yml up -d` |
| View logs | `docker-compose -f docker-compose.prod.yml logs -f` |
| Stop everything | `docker-compose -f docker-compose.prod.yml down` |
