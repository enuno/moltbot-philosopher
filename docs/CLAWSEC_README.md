# ClawSec Security Integration for Moltbot

Integration of ClawSec security advisory monitoring into Moltbot-Philosopher's philosophical discourse platform.

## Overview

ClawSec provides community-driven security advisories for AI assistant platforms. This integration:

- Monitors <https://clawsec.prompt.security/advisories/feed.json> for new advisories

- Filters for critical and high severity issues

- Archives security insights in the Noosphere memory system

- Sends NTFY alerts for critical vulnerabilities

- Runs every 4 hours via cron

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   ClawSec Advisory Feed                     │
│          <https://clawsec.prompt.security/advisories>         │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
         ┌──────────────────────────────────────┐
         │   clawsec-monitor.sh (cron: 4h)     │
         │   - Fetch & validate feed            │
         │   - Filter critical/high severity    │
         │   - Track new advisories             │
         └──────┬────────────────────┬──────────┘
                │                    │
                ▼                    ▼
    ┌───────────────────┐   ┌──────────────────┐
    │ Noosphere Archive │   │   NTFY Alerts    │
    │  security-advisory│   │  (critical only) │
    └───────────────────┘   └──────────────────┘

```

## Installation

### 1. Script is Already Installed

The monitoring script is located at:

```bash
/home/elvis/.moltbot/scripts/clawsec-monitor.sh

```

### 2. Cron Job Configured

The security monitor runs every 4 hours:

```bash
0 */4 * * * /home/elvis/.moltbot/scripts/clawsec-monitor.sh check >> /home/elvis/.moltbot/logs/security.log 2>&1

```

Verify:

```bash
crontab -l | grep clawsec

```

### 3. State Files

- **State**: `~/.moltbot/state/clawsec-state.json` - Tracks known advisories

- **Cache**: `~/.moltbot/.cache/feed.json` - Cached advisory feed

- **Logs**: `~/.moltbot/logs/security.log` - Monitoring logs

## Usage

### Manual Check

```bash
./scripts/clawsec-monitor.sh check

```

Fetches latest advisories and reports any new critical/high severity issues.

### View Statistics

```bash
./scripts/clawsec-monitor.sh stats

```

Shows:

- Total advisories by severity

- Number tracked by Moltbot

- Last check timestamp

### List Advisories

```bash
./scripts/clawsec-monitor.sh list

```

Lists all critical and high severity advisories in the feed.

## Example Output

```bash
$ ./scripts/clawsec-monitor.sh check

[CLAWSEC] Starting ClawSec security monitor...
[CLAWSEC] Fetched advisory feed (attempt 1/3)
[CLAWSEC] WARNING: Found 4 new advisory/advisories

[CLAWSEC] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[CLAWSEC] 🚨 New HIGH Advisory: CVE-2026-25593
[CLAWSEC] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Title: OpenClaw is a personal AI assistant. Prior to 2026.1.20...
Severity: HIGH
Published: 2026-02-06T21:16:17.790

Description:
OpenClaw is a personal AI assistant. Prior to 2026.1.20, an unauthenticated 
local client could use the Gateway WebSocket API to write config via 
config.apply and set unsafe cliPath values that were later used for command 
discovery, enabling command injection as the gateway user. This vulnerability 
is fixed in 2026.1.20.

[CLAWSEC] Archived advisory in Noosphere
[CLAWSEC] NTFY alert sent

```

## Noosphere Integration

Security advisories are archived with type `security-advisory`:

```json
{
  "type": "security-advisory",
  "thread_id": "CVE-2026-25593",
  "metadata": {
    "advisory_id": "CVE-2026-25593",
    "severity": "high",
    "title": "OpenClaw command injection vulnerability",
    "affected": "",
    "published": "2026-02-06T21:16:17.790",
    "source": "clawsec"
  }
}

```

These entries can be:

- Consolidated into Layer 2 heuristics

- Referenced in Council deliberations

- Synced to Mem0 distributed memory

## Configuration

Environment variables (optional):

```bash

# In .env
CLAWSEC_FEED_URL=<https://clawsec.prompt.security/advisories/feed.json>
CLAWSEC_MIN_SEVERITY=high  # or critical
NTFY_URL=<http://ntfy:3005>

```

## NTFY Alerts

Critical advisories trigger immediate alerts:

- **Priority**: 5 (Urgent)

- **Tags**: warning, security

- **Topic**: security-alerts

High severity advisories are logged but don't trigger alerts by default.

## Monitoring Schedule

| Action | Schedule | Purpose |
|--------|----------|---------|
| Advisory Check | Every 4 hours | Monitor for new CVEs |
| Feed Cache | 10-second timeout | Resilient to network issues |
| State Update | After each run | Track processed advisories |

## Integration with Council

Security advisories can inform Council deliberations:

1. **Automated Detection**: `clawsec-monitor.sh` finds new advisories

2. **Noosphere Archival**: Stored as `security-advisory` discourse

3. **Council Access**: Recalled during deliberations via `recall-engine.py`

4. **Philosophical Analysis**: Council members can reflect on:
   - Ethics of AI security

   - Autonomy vs. safety tradeoffs

   - Collective responsibility

   - Governance implications

Example Council query:

```bash
python3 scripts/recall-engine.py --context "AI security governance" --format constitutional

```

## Current Advisory Landscape

As of 2026-02-09, the ClawSec feed tracks:

- **Total**: 5 advisories

- **Critical**: 0

- **High**: 4 (OpenClaw command injection, path traversal, SSH injection)

- **Medium**: 1

All affect OpenClaw/Moltbot infrastructure and have patches available in recent versions.

## Troubleshooting

### Feed Fetch Fails

```bash
[CLAWSEC] WARNING: Using cached feed (fetch failed after 3 attempts)

```

**Solution**: Check network connectivity or use cached feed. Script gracefully degrades to cache.

### Permission Denied (Noosphere)

```bash
mkdir: Permission denied

```

**Solution**: Ensure Noosphere directories exist with correct permissions:

```bash
mkdir -p workspace/classical/noosphere/daily-notes
chmod 755 workspace/classical/noosphere

```

### No Cron Execution

**Check cron logs**:

```bash
tail -f ~/.moltbot/logs/security.log

```

**Verify cron job**:

```bash
crontab -l | grep clawsec

```

## Security Notes

- Feed validation: JSON structure verified before processing

- State file permissions: 600 (owner read/write only)

- Retry logic: 3 attempts with exponential backoff

- Rate limiting: 4-hour intervals (ClawSec recommendation: 5+ minutes)

- Cache fallback: Uses last successful fetch if new fetch fails

## Related Resources

- **ClawSec Suite**: skills/clawsec/SKILL.md

- **Advisory Feed**: <https://clawsec.prompt.security/advisories/feed.json>

- **GitHub**: <https://github.com/prompt-security/clawsec>

- **Noosphere Integration**: scripts/noosphere-integration.sh

## Future Enhancements

- [ ] Philosopher agent commentary on security advisories

- [ ] Council governance proposal for security response protocols

- [ ] Integration with `openclaw-audit-watchdog` skill

- [ ] Affected package detection for Moltbot dependencies

- [ ] Automated issue creation for critical advisories

---

*Last Updated: 2026-02-09 | Moltbot v2.6 | ClawSec Feed v0.0.3*
