# ClawSec Security Integration

**Date**: 2026-02-13  
**Version**: v2.7  
**Status**: ✅ Production-ready

## Overview

ClawSec security advisory monitoring integrated into Moltbot's heartbeat
cycle for automated security awareness and vulnerability tracking.

## Features

### Advisory Feed Monitoring
- **Feed URL**: <https://raw.githubusercontent.com/prompt-security/clawsec/main/advisories/feed.json>

- **Check Interval**: Once per 24 hours (86400 seconds)

- **State Tracking**: `~/.moltbot-clawsec-state.json`

- **Integration Point**: Heartbeat section 7 (non-blocking)

### Current Advisory Status

**Feed Version**: 0.0.3  
**Total Advisories**: 5 CVEs

| CVE | Severity | Component | Issue |
|-----|----------|-----------|-------|
| CVE-2026-25593 | HIGH | OpenClaw | Unauthenticated config.apply |
| CVE-2026-25475 | MEDIUM | OpenClaw | isValidMedia() validation |
| CVE-2026-25157 | HIGH | OpenClaw | OS command injection |
| CVE-2026-24763 | HIGH | Clawdbot | Component vulnerability |
| CVE-2026-25253 | HIGH | Moltbot | gatewayUrl auto-connect |

**Relevance**: All 5 advisories mention OpenClaw/Clawdbot/Moltbot (100%
match rate).

## Architecture

### Feed Check Flow

```
Heartbeat (4-hour cycle)
    ↓
Check if 24 hours since last advisory check
    ↓
    Yes → Run clawsec-feed-check.sh
        ↓
        Fetch feed.json
        ↓
        Validate JSON format
        ↓
        Compare against state file
        ↓
        Detect new advisories
        ↓
        Alert if relevant (Moltbot/OpenClaw mentions)
        ↓
        Update state file
        ↓
        Return to heartbeat
    ↓
    No → Skip (log hours remaining)

```

### State File Format

```json
{
  "schema_version": "1.0",
  "known_advisories": [
    "CVE-2026-25593",
    "CVE-2026-25475",
    "CVE-2026-25157",
    "CVE-2026-24763",
    "CVE-2026-25253"
  ],
  "last_check": "2026-02-13T02:49:43Z"
}

```

## Script Reference

### clawsec-feed-check.sh

**Location**: `scripts/clawsec-feed-check.sh`  
**Permissions**: 755 (executable)  
**Dependencies**: `curl`, `jq`, `date`

**Environment Variables**:
- `CLAWSEC_FEED_URL`: Override feed URL (default: GitHub raw)

- `CLAWSEC_STATE_FILE`: Override state file location (default:

  ~/.moltbot-clawsec-state.json)

**Exit Codes**:
- `0`: Success (with or without new advisories)

- `1`: Error (fetch failed, invalid JSON, etc.)

**Output Format**:

```
[TIMESTAMP] Fetching ClawSec advisory feed...
[TIMESTAMP] Feed version: X.Y.Z (N advisories)

# If new advisories:
[TIMESTAMP] ⚠️  Found N new advisory(ies):

  🔴 [HIGH] CVE-YYYY-NNNNN
     Description (wrapped at 70 chars)

  🟡 [MEDIUM] CVE-YYYY-NNNNN
     Description

[TIMESTAMP] 🚨 ALERT: N advisory(ies) mention Moltbot/OpenClaw!
[TIMESTAMP] Review immediately: [URL]

# If no new advisories:
[TIMESTAMP] ✅ No new advisories (all N known)

```

### Heartbeat Integration

**Location**: `scripts/moltbook-heartbeat-enhanced.sh`  
**Section**: 7. Security Advisory Check (ClawSec)  
**Lines**: ~402-428

**Behavior**:
1. Check `CLAWSEC_STATE_FILE` for `last_check` timestamp

2. Calculate time since last check

3. If ≥86400 seconds (24 hours):
   - Run `clawsec-feed-check.sh`

   - Log results

   - Add to activities array

4. If <24 hours:
   - Skip check

   - Log hours remaining until next check

**Non-Blocking**: Advisory check failure does not block heartbeat
completion.

## Security Model

### Fail-Closed Design

ClawSec suite documentation specifies fail-closed signature verification:
- Feed signature must be valid before trusting content

- Checksum manifest must be verified

- Currently using basic feed validation (JSON structure)

- **Future**: Add signature verification when feed signatures available

### Trust Alignment

ClawSec security principles align with Moltbot v2.7:

| Principle | Moltbot Implementation |
|-----------|------------------------|
| Approval-gated actions | Council 4/6 consensus, double confirmation |
| Fail-closed verification | VerificationSolverEnhanced strict validation |
| State tracking | heartbeat-state.json, memory-state.json, clawsec-state.json |
| Rate limiting | 4-hour heartbeat, 24-hour advisory checks |

## Monitoring

### Daily Check Verification

Check state file to confirm updates:

```bash
cat ~/.moltbot-clawsec-state.json | jq '.last_check'

```

Expected: ISO 8601 timestamp updated within last 24 hours.

### Manual Advisory Check

Run checker independently:

```bash
cd /home/elvis/.moltbot
./scripts/clawsec-feed-check.sh

```

### Heartbeat Logs

Check heartbeat output for ClawSec section:

```bash
docker logs moltbot-classical-persona-1 | grep -A5 "Checking ClawSec"

```

Expected output (every 4th heartbeat):

```
🔒 Checking ClawSec security advisories...
   ✅ Advisory check complete

```

## Troubleshooting

### Issue: Advisory check not running

**Symptom**: State file not updating, no advisory check in heartbeat logs.

**Diagnosis**:

```bash

# Check if script exists and is executable
ls -la scripts/clawsec-feed-check.sh

# Check state file
cat ~/.moltbot-clawsec-state.json | jq .

```

**Fix**:

```bash
chmod +x scripts/clawsec-feed-check.sh
rm ~/.moltbot-clawsec-state.json  # Force fresh check

```

### Issue: Feed fetch failing

**Symptom**: "ERROR: Failed to fetch advisory feed" in logs.

**Diagnosis**:

```bash

# Test feed URL directly
curl -fsSL "<https://raw.githubusercontent.com/prompt-security/clawsec/main/advisories/feed.json"> | jq .version

```

**Fix**:
- Check network connectivity

- Verify GitHub raw URL is accessible

- Check for rate limiting (GitHub API limits)

### Issue: Invalid JSON error

**Symptom**: "ERROR: Invalid advisory feed format" after fetch.

**Diagnosis**:

```bash

# Validate feed structure
curl -fsSL "$FEED_URL" | jq '.version, .advisories | length'

```

**Fix**:
- Wait for upstream feed to be corrected

- Check if feed schema changed (update validation logic if needed)

## Future Enhancements

### Planned Features (Not Yet Implemented)

1. **Signature Verification**

   - Verify `feed.json.sig` detached signature

   - Use pinned `feed-signing-public.pem` key

   - Fail-closed: reject unsigned feeds by default

2. **Checksum Validation**

   - Verify `checksums.json` manifest

   - Validate all file checksums before trusting

   - Atomic verification workflow

3. **Affected Package Cross-Reference**

   - Compare advisory `affected` field against installed skills

   - Alert if installed package matches advisory

   - Recommend removal/update for malicious-skill advisories

4. **Approval-Gated Response**

   - Detect removal-recommended advisories

   - Ask for explicit user confirmation before any action

   - Double confirmation flow (consistent with Moltbot policy)

5. **Optional Skills Installation**

   - `openclaw-audit-watchdog` (file integrity monitoring)

   - `soul-guardian` (agent behavior guardian)

   - `clawtributor` (opt-in security contribution tool)

### Enhancement Priority

| Feature | Priority | Blocker |
|---------|----------|---------|
| Signature verification | HIGH | Signed feeds not yet available upstream |
| Package cross-reference | MEDIUM | Need to define "installed skills" manifest |
| Approval-gated response | LOW | No removal-recommended advisories yet |
| Optional skills | LOW | Tools not yet released (404 errors) |

## References

- **ClawSec Homepage**: <https://clawsec.prompt.security>

- **Advisory Feed**: <https://github.com/prompt-security/clawsec/blob/main/advisories/feed.json>

- **Installation Notes**: `skills/CLAWSEC_INSTALLATION.md`

- **Suite Documentation**: `skills/clawsec-suite.md`

- **GitHub Repo**: <https://github.com/prompt-security/clawsec>

## Version History

| Date | Version | Changes |
|------|---------|---------|
| 2026-02-13 | v2.7 | Initial integration: feed checker + heartbeat |

*Last Updated: 2026-02-13*
