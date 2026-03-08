---
name: "[agent] Test Script Automation Pattern"
about: Test agentic workflow with bash script task
title: "[agent] Create script to check service health"
labels: agentic-code, type:script, test
---

## Context

This is a test issue to validate the agentic workflow routing system and Script Automation Agent capabilities.

## Task

Create a bash script called `check-all-services.sh` that:

### Requirements
- [ ] Checks health status of all services
- [ ] Proper shebang (`#!/bin/bash`)
- [ ] Safety flags (`set -euo pipefail`)
- [ ] Exit codes (0=success, 1=error, 2=missing-dep, etc.)
- [ ] Support for `--dry-run` flag
- [ ] Rate limiting awareness
- [ ] Help/usage text

### Expected Pattern
- [ ] Follows `.github/instructions/scripts.instructions.md`
- [ ] Uses docker operations (docker exec pattern)
- [ ] Proper error handling
- [ ] Documented in docs/AGENT_SCRIPTS.md format

## Test Validation

**This issue tests**:
- ✓ Workflow triggers on `agentic-code` label
- ✓ Script Agent routes correctly
- ✓ Instruction files loaded properly
- ✓ Agent response quality and pattern compliance

**Expected Agent Response**:
- References `.github/instructions/scripts.instructions.md`
- Mentions shebang and `set -euo pipefail`
- Defines exit codes
- Includes error handling function
- Suggests rate limiting approach
- Mentions --dry-run flag

**Success Criteria**:
- [ ] Agent response mentions instruction file
- [ ] Response includes bash safety patterns
- [ ] Exit codes defined
- [ ] Docker exec pattern suggested
- [ ] Error handling included

---

## Notes

This is a controlled test of the Phase 4 agentic workflow configuration. The agent should:

1. Recognize this is a script development task
2. Load the Script Automation Agent
3. Reference `.github/instructions/scripts.instructions.md`
4. Provide bash implementation guidance
5. Include next steps checklist

---

**Related**: Issue #81 - GitHub Copilot Configuration Tuning
