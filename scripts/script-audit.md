# Script Audit - Service Migration Impact

## Summary

Total bash scripts: 32

- **Services replace**: 15 scripts (automated polling/generation)

- **Keep (human-initiated)**: 12 scripts (manual operations)

- **Utilities**: 5 scripts (dev/ops tools)

---

## Scripts Replaced by Services ✅

### Verification (→ Verification Service 3008)
- ✅ `check-verification-challenges.js` - Replaced by VerificationPoller

- ✅ `handle-verification-challenge.sh` - Replaced by ChallengeHandler

- ✅ `frequent-challenge-check.sh` - Replaced by VerificationPoller (60s)

### Engagement (→ Engagement Service 3009)
- ✅ `check-mentions-v2.sh` - Replaced by MentionHandler

- ✅ `check-comments-v2.sh` - Replaced by CommentHandler (placeholder)

- ✅ `welcome-new-moltys-v2.sh` - Replaced by WelcomeHandler

### Council (→ Council Service 3010)
- ✅ `convene-council.sh` - Replaced by IterationScheduler

- ✅ `council-thread-reply.sh` - Replaced by Council events

- ✅ `post-council-treatise.sh` - Replaced by Council publishing

### Memory (→ Noosphere Service 3011)
- ✅ `memory-cycle.py` - Replaced by ConsolidationScheduler

### MoltStack (→ MoltStack Service 3012)
- ✅ `moltstack-heartbeat.sh` - Replaced by weekly cron

- ✅ `moltstack-generate-article.sh` - Replaced by EssayGenerator

- ✅ `moltstack-post-article.sh` - Replaced by Publisher

- ✅ `archive-moltstack-article.sh` - Replaced by DraftManager

### Heartbeat (→ Event Listener 3007 + Orchestrator 3006)
- ✅ `moltbook-heartbeat-enhanced.sh` - Replaced by Event Listener polling

---

## Scripts to Keep (Human-Initiated) 🔧

### Manual Operations
- 🔧 `post-philosophical-thread.sh` - Manual thread creation

- 🔧 `council-manual-deliberation.sh` - Manual council override

- 🔧 `trigger-memory-promotion.sh` - Manual Layer 2 → 3 promotion

- 🔧 `generate-emergency-response.sh` - Manual emergency posting

- 🔧 `backup-agent-state.sh` - Manual backup operations

### Testing & Debug
- 🔧 `test-ai-generator.sh` - AI service testing

- 🔧 `test-event-system.sh` - Event system integration test

- 🔧 `debug-agent-identity.sh` - Identity loading debug

### Data Operations
- 🔧 `export-memory-archive.sh` - Manual memory export

- 🔧 `import-community-wisdom.sh` - Manual wisdom import

- 🔧 `sync-codex-state.sh` - Manual codex sync

- 🔧 `validate-workspace-permissions.sh` - Permission checker

---

## Utility Scripts 🛠️

### Development & Operations
- 🛠️ `entrypoint.sh` - Docker container entrypoint (KEEP)

- 🛠️ `setup-workspace.sh` - Workspace initialization (KEEP)

- 🛠️ `health-check-all.sh` - All services health check (KEEP)

- 🛠️ `rebuild-services.sh` - Development rebuild script (KEEP)

- 🛠️ `setup-precommit.sh` - Pre-commit hook setup (KEEP)

---

## Recommended Actions

### Immediate
1. Mark replaced scripts as DEPRECATED with header comments

2. Update README.md with service endpoints (replace script references)

3. Create CLI wrappers for human-initiated scripts (call service APIs)

### Short-term
1. Add `scripts/cli/` directory with service CLI tools

2. Create unified CLI: `moltbot <service> <action>`

3. Deprecation warnings in old scripts

### Long-term
1. Archive deprecated scripts to `scripts/deprecated/`

2. Remove from PATH and documentation

3. Delete after 1 migration cycle (verify no usage)

---

## CLI Wrapper Plan

### Proposed Structure

```
scripts/cli/
├── moltbot-cli.sh           # Unified entry point
├── verification-cli.sh      # Verification Service wrapper
├── engagement-cli.sh        # Engagement Service wrapper
├── council-cli.sh           # Council Service wrapper
├── noosphere-cli.sh         # Noosphere Service wrapper
└── moltstack-cli.sh         # MoltStack Service wrapper

```

### Example Usage

```bash

# Old way (polling script)

./scripts/check-mentions-v2.sh

# New way (service API)

./scripts/cli/moltbot-cli.sh engagement check-mentions

# Or direct service wrapper

./scripts/cli/engagement-cli.sh check-mentions

```

---

## Migration Status

| Category | Scripts | Status |
|----------|---------|--------|
| Replaced by Services | 15 | ✅ Complete |
| Keep (human-initiated) | 12 | 🔧 Needs CLI wrappers |
| Utilities | 5 | 🛠️ Keep as-is |
| **Total** | **32** | **47% automated** |

**Next Step**: Create CLI wrappers for human-initiated scripts
