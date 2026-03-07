# ClawSec Suite Installation Notes

**Date**: 2026-02-13  
**Status**: Partially installed

## Installation Summary

### ✅ Successfully Installed

1. **clawsec-suite** (core security suite)

   - Location: `skills/clawsec-suite.md`

   - Version: 0.0.10

   - Size: 11KB

   - Features:
     - Advisory feed monitoring

     - Cryptographic signature verification

     - Approval-gated malicious-skill response

     - Guarded installer with double confirmation

### ❌ Installation Issues

The following components could not be installed via `npx clawhub@latest`:

1. **openclaw-audit-watchdog**

   - Status: Repository not found (404 error)

   - URL: <https://github.com/prompt-security/openclaw-audit-watchdog>

   - Issue: `clawhub` command hangs indefinitely

2. **soul-guardian**

   - Status: Download URL returns 404

   - URL: <https://clawsec.prompt.security/releases/latest/download/soul-guardian.skill>

   - Page exists but download not available

3. **clawtributor**

   - Status: Download URL returns 404

   - URL: <https://clawsec.prompt.security/releases/latest/download/clawtributor.skill>

   - Marked as "explicit opt-in" in documentation

## What Was Installed

The core **clawsec-suite** provides:

### Built-in Features

- Embedded advisory feed monitoring

- Portable heartbeat workflow

- Advisory polling + state tracking

- OpenClaw advisory guardian hook

- Setup scripts for hook and cron scheduling

- Guarded installer with double confirmation

### Key Capabilities

1. **Advisory Feed**

   - Remote: `<https://raw.githubusercontent.com/prompt-security/clawsec/main/advisories/feed.json`>

   - Local seed: `~/.openclaw/skills/clawsec-suite/advisories/feed.json`

   - Signature verification required (fail-closed)

2. **Guarded Install Flow**

   ```bash
   SUITE_DIR="$HOME/.openclaw/skills/clawsec-suite"
   node "$SUITE_DIR/scripts/guarded_skill_install.mjs" --skill <name> --version <version>

   ```

3. **Security Checks**

   - Signature verification for releases

   - Checksum verification for all files

   - State tracking for new advisories

   - Cross-reference advisories vs installed skills

## Recommendations

### Immediate Actions

1. **Enable OpenClaw hooks** (if using OpenClaw framework):

   ```bash
   SUITE_DIR="$HOME/.openclaw/skills/clawsec-suite"
   node "$SUITE_DIR/scripts/setup_advisory_hook.mjs"

   ```

2. **Set up periodic scanning** (optional):

   ```bash
   node "$SUITE_DIR/scripts/setup_advisory_cron.mjs"

   ```

3. **Quick feed check**:

   ```bash
   FEED_URL="<https://raw.githubusercontent.com/prompt-security/clawsec/main/advisories/feed.json">
   STATE_FILE="$HOME/.openclaw/clawsec-suite-feed-state.json"

   curl -fsSL "$FEED_URL" | jq '.advisories[] | "- [\(.severity | ascii_upcase)] \(.id): \(.title)"'

   ```

### Future Actions

Monitor these repositories for availability:

- <https://github.com/prompt-security/openclaw-audit-watchdog>

- <https://clawsec.prompt.security/#/skills/soul-guardian>

Once available, retry installation with:

```bash
npx clawhub@latest install openclaw-audit-watchdog
npx clawhub@latest install soul-guardian
npx clawhub@latest install clawtributor  # opt-in only

```

## Integration with Moltbot

### Heartbeat Integration

The clawsec-suite includes a `HEARTBEAT.md` file that handles:

- Suite update checks

- Feed polling

- New advisory detection

- Affected-skill cross-referencing

- Approval-gated response guidance

**TODO**: Integrate with Moltbot's existing heartbeat system
(scripts/moltbook-heartbeat-enhanced.sh)

### Security Model Alignment

ClawSec principles align with Moltbot's security design:

1. **Approval-gated actions**: Matches our "double confirmation" for

   sensitive operations

2. **Fail-closed verification**: Aligns with our verification service

   strict validation

3. **State tracking**: Similar to our post-state.json, memory-state.json

4. **Rate limiting**: Consistent with our 4-hour heartbeat intervals

## References

- ClawSec Homepage: <https://clawsec.prompt.security>

- Main Suite Docs: skills/clawsec-suite.md

- GitHub: <https://github.com/prompt-security/clawsec>

## Notes

- The `clawhub` package manager appears to have connectivity or

  configuration issues

- Direct downloads of individual skills failed (404 errors)

- The core suite downloaded successfully via direct SKILL.md fetch

- This suggests the suite is production-ready but companion skills
  are still in development
