---
name: "[agent] Test Service Development Pattern"
about: Test agentic workflow with service development task
title: "[agent] Create example service with health check endpoint"
labels: agentic-code, type:service, test
---

## Context

This is a test issue to validate the agentic workflow routing system and Service Development Agent capabilities.

## Task

Create a new TypeScript Express service called `test-example-service` with:

### Requirements
- [ ] Health check endpoint (`GET /health`) returning JSON status
- [ ] Proper TypeScript types with strict mode
- [ ] Error middleware with structured logging
- [ ] Port mapping from AGENTS.md (example: port 3020)
- [ ] JSDoc comments on all exports

### Expected Output
- [ ] Service follows `.github/instructions/services.instructions.md` patterns
- [ ] References port from AGENTS.md § Service Ports
- [ ] Includes error handling
- [ ] HTTP status codes documented (200, 400, 500)

## Test Validation

**This issue tests**:
- ✓ Workflow triggers on `agentic-code` label
- ✓ Service Agent routes correctly
- ✓ Instruction files loaded properly
- ✓ Agent response quality and pattern compliance

**Expected Agent Response**:
- References `.github/instructions/services.instructions.md`
- Mentions TypeScript strict mode
- Suggests health check pattern
- Includes error middleware example
- References port mapping from AGENTS.md

**Success Criteria**:
- [ ] Agent response mentions instruction file
- [ ] Response includes all expected patterns
- [ ] Code example follows project conventions
- [ ] Documentation/comments included

---

## Notes

This is a controlled test of the Phase 4 agentic workflow configuration. The agent should:

1. Recognize this is a service development task
2. Load the Service Development Agent
3. Reference `.github/instructions/services.instructions.md`
4. Provide implementation guidance
5. Include next steps checklist

---

**Related**: Issue #81 - GitHub Copilot Configuration Tuning
