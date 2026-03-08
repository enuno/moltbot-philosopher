# Manual Test Execution Guide - Phase 3 Tests 1-3, 9-10
**Date**: 2026-03-08 | **Purpose**: Validate GitHub Copilot follows documented patterns

---

## Overview

This guide walks you through executing the 6 manual tests that require GitHub Copilot interaction. Each test validates that Copilot suggests code patterns matching the project's instruction files.

**Time Required**: ~30 minutes (5 minutes per test)
**Tools Needed**: GitHub Copilot access (VS Code, GitHub.com, or IDE)
**Success Criteria**: ≥8/10 tests passing validates configuration

---

## Setup

### 1. Access GitHub Copilot

**Option A: VS Code**
- Install GitHub Copilot extension
- Sign in with GitHub account
- Open command palette: `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows/Linux)
- Type `Copilot: Open Copilot Chat`

**Option B: GitHub.com**
- Go to https://github.com/copilot
- Sign in with your GitHub account
- Use chat interface directly

**Option C: GitHub Copilot Chat in IDE**
- Open your IDE with Copilot extension installed
- Use keyboard shortcut or command palette to open chat

### 2. Set Context

Before each test, tell Copilot about the project:

```
I'm working on Moltbot, a philosophical AI multi-agent system with:
- 10 philosopher personas (Classical, Existentialist, etc.)
- 8 microservices (AI Content Generator, Noosphere, etc.)
- Lane Queue pattern for serial execution
- Hybrid memory (vector + keyword search)

Relevant instruction files:
- .github/instructions/services.instructions.md
- .github/instructions/scripts.instructions.md
- .github/instructions/python.instructions.md
- AGENTS.md (universal reference)
```

Copy this into Copilot once before starting tests 1-5.

---

## Test 1: Service Development Pattern Recognition

**Objective**: Validate Copilot suggests proper TypeScript/Express patterns

### Prompt to Send:

```
I need to create a new TypeScript Express service called "example-service"
with a health check endpoint. What pattern should I follow based on the
project's instruction files (.github/instructions/services.instructions.md)?

Show me a code example.
```

### Expected Response Should Include:

- [ ] TypeScript strict mode requirement
- [ ] `GET /health` endpoint returning JSON
- [ ] Error middleware with structured logging
- [ ] Port reference from AGENTS.md
- [ ] JSDoc comments
- [ ] HTTP status codes (200, 400, 500)

### Validation Checklist:

```typescript
// Verify response includes patterns like:
// ✅ import with types: import { Express, Request, Response } from 'express'
// ✅ strict TypeScript
// ✅ Health endpoint: app.get('/health', (req, res) => ...)
// ✅ Error handler with logger
// ✅ Proper status codes
// ✅ JSDoc comments
```

### Result: [ ] PASS / [ ] PARTIAL / [ ] FAIL

**Notes**:
_[Record any observations about quality/completeness of response]_

---

## Test 2: Bash Script Pattern Recognition

**Objective**: Validate Copilot suggests proper bash script patterns

### Prompt to Send:

```
Create a bash script template for a new operational script in the scripts/
directory. What patterns should it follow based on the project's script
guidelines (.github/instructions/scripts.instructions.md)?

Show me the template with comments explaining each section.
```

### Expected Response Should Include:

- [ ] `#!/bin/bash` shebang
- [ ] `set -euo pipefail` safety flags
- [ ] Exit code definitions (0, 1, 2, 3, 4, 5)
- [ ] Rate limiting checks (if API calls)
- [ ] `--dry-run` flag support
- [ ] Help/usage function
- [ ] Error handling with stderr

### Validation Checklist:

```bash
# Verify response includes:
# ✅ #!/bin/bash
# ✅ set -euo pipefail
# ✅ Exit codes: readonly EXIT_SUCCESS=0, EXIT_ERROR=1, etc.
# ✅ error() function with stderr output
# ✅ usage() function
# ✅ Rate limiting checks if mentioned
# ✅ --dry-run flag example
```

### Result: [ ] PASS / [ ] PARTIAL / [ ] FAIL

**Notes**:
_[Record any observations about quality/completeness of response]_

---

## Test 3: Python Code Pattern Recognition

**Objective**: Validate Copilot suggests proper Python patterns

### Prompt to Send:

```
Write a Python function that queries Noosphere memories using semantic search.
What patterns should I follow from the project's Python guidelines
(.github/instructions/python.instructions.md)?

Include type hints, docstring, and show how to use NoosphereClient.
```

### Expected Response Should Include:

- [ ] Type hints on all parameters and returns
- [ ] Comprehensive docstring (Args, Returns, Raises)
- [ ] Async/await for I/O operations
- [ ] NoosphereClient usage
- [ ] Memory type awareness (5 types)
- [ ] Error handling on boundaries
- [ ] Environment variables (not hardcoded)
- [ ] Structured logging

### Validation Checklist:

```python
# Verify response includes:
# ✅ from typing import annotations
# ✅ Type hints: def func(param: str) -> list[dict]:
# ✅ """Comprehensive docstring with Args, Returns, Raises"""
# ✅ async def for I/O
# ✅ NoosphereClient(enable_hybrid=True)
# ✅ 5 memory types mentioned: insight, pattern, strategy, preference, lesson
# ✅ Error handling on system boundaries
# ✅ Environment variable usage
# ✅ logger.info() or similar logging
```

### Result: [ ] PASS / [ ] PARTIAL / [ ] FAIL

**Notes**:
_[Record any observations about quality/completeness of response]_

---

## Test 9: Memory Operations Pattern Verification

**Objective**: Validate Copilot understands Noosphere memory operations

### Prompt to Send:

```
Show me how to use NoosphereClient to create and query memories in Python.
What are the 5 memory types supported? How do I use hybrid search?

Reference the project's patterns from the instruction files.
```

### Expected Response Should Include:

- [ ] NoosphereClient import and initialization
- [ ] `create_memory()` method usage
- [ ] `query_memories()` method with parameters
- [ ] 5 memory types: insight, pattern, strategy, preference, lesson
- [ ] Hybrid search (vector + keyword) explanation
- [ ] Proper parameter types
- [ ] min_confidence usage (0-1 range)

### Validation Checklist:

```python
# Verify response includes patterns like:
# ✅ from noosphere_client import NoosphereClient
# ✅ client = NoosphereClient(enable_hybrid=True)
# ✅ create_memory(agent_id, content, memory_type, ...)
# ✅ query_memories(agent_id, context, types=[...], min_confidence=...)
# ✅ 5 types: insight, pattern, strategy, preference, lesson
# ✅ Explanation of hybrid (vector + keyword) search
# ✅ Proper async/await pattern if needed
```

### Result: [ ] PASS / [ ] PARTIAL / [ ] FAIL

**Notes**:
_[Record any observations about quality/completeness of response]_

---

## Test 10: Context Exclusion Compliance (.aiignore)

**Objective**: Validate Copilot understands security boundaries

### Prompt to Send:

```
I have a .env file with API keys. How should I handle this according to
the project's .aiignore configuration? What patterns should I follow for
environment variable management?

Reference the project's security guidelines.
```

### Expected Response Should Include:

- [ ] .env is excluded from AI context (.aiignore)
- [ ] Recommend .env.example as template
- [ ] Environment variable usage (os.getenv, process.env, etc.)
- [ ] Never hardcode credentials
- [ ] Reference to .aiignore configuration
- [ ] Best practice for local development

### Validation Checklist:

```
Verify response includes:
✅ Mentions .env is in .aiignore
✅ Suggests .env.example approach
✅ Shows environment variable usage (os.getenv / process.env)
✅ Warns against hardcoding
✅ References project security guidelines
✅ Explains why AI tools don't see .env
```

### Result: [ ] PASS / [ ] PARTIAL / [ ] FAIL

**Notes**:
_[Record any observations about quality/completeness of response]_

---

## Scoring Guide

For each test:
- **PASS**: Response includes ≥7/8 expected items = 1 point
- **PARTIAL**: Response includes 5-6/8 expected items = 0.5 points
- **FAIL**: Response includes <5/8 expected items = 0 points

### Final Score Calculation:

```
Manual Tests Total: [Test 1] + [Test 2] + [Test 3] + [Test 9] + [Test 10]
Automated Tests (already passing): 4 points
Total Score: [Manual Score] + 4 points

Pass Threshold: ≥8 points out of 10 total tests
```

---

## Example Pass Response

### Test 1: Service Development Pattern

**Good Response Example**:
```typescript
// TypeScript Express service pattern
import express, { Express, Request, Response, NextFunction } from 'express';
import logger from './logger';

const app: Express = express();
app.use(express.json());

/**
 * Health check endpoint
 * Returns service status
 */
app.get('/health', (req: Request, res: Response): void => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'example-service'
  });
});

/**
 * Error handling middleware
 */
app.use((err: Error, req: Request, res: Response, next: NextFunction): void => {
  logger.error('Request failed', {
    error: err.message,
    path: req.path,
    method: req.method
  });

  res.status(500).json({
    error: 'Internal server error',
    requestId: req.id
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`Service listening on port ${PORT}`);
});
```

**Why This Passes**:
- ✅ TypeScript with strict types
- ✅ Health endpoint with JSON response
- ✅ Error middleware with structured logging
- ✅ JSDoc comments
- ✅ Proper HTTP status codes
- ✅ Environment variable for port

---

## Recording Results

After completing all 5 tests, save your results:

1. **Create a test results file** in your local copy:
   ```
   .moltbot/
   └── test-results-manual-[DATE].md
   ```

2. **Document each test**:
   ```markdown
   ## Test 1: Service Development Pattern
   **Status**: PASS
   **Evidence**: Response included all 7 expected patterns
   **Notes**: Copilot suggested additional middleware for CORS
   ```

3. **Calculate final score** using scoring guide above

4. **Submit findings** (optional):
   - Create GitHub issue with results
   - Or mention in project discussions
   - Share findings with team

---

## Troubleshooting

### Copilot gives generic response not matching patterns

**Action**:
1. Rephrase prompt to reference specific instruction files
2. Provide more context about the project
3. Ask follow-up: "How does this align with [specific pattern]?"

### Response mentions old patterns not in instructions

**Action**:
1. Point out the discrepancy
2. Ask: "Does the project instruction file say something different?"
3. Document as PARTIAL if mostly correct but outdated

### Copilot can't access instruction files

**Action**:
1. Quote specific patterns from instruction files in prompt
2. Provide file paths in prompt
3. Ask: "Based on .github/instructions/services.instructions.md, what pattern should I follow?"

---

## Success Metrics

**Configuration is Validated When**:
- ✅ ≥8/10 total tests passing
- ✅ Copilot consistently references instruction files
- ✅ Suggested patterns match documented standards
- ✅ Agent routing workflow ready for production

**Configuration Needs Refinement When**:
- ⚠️ <8/10 tests passing
- ⚠️ Copilot suggests patterns not in instruction files
- ⚠️ Documentation gaps identified

---

## Next Steps After Manual Tests

1. **Document Results** - Record in test-results-manual-[DATE].md
2. **Enable Agentic Workflows** - Use `agentic-code` label on issues/PRs
3. **Monitor Behavior** - Track which agent suggestions are used
4. **Iterate** - Update instruction files based on findings

---

## Resources

- [AGENTS.md](../AGENTS.md) - Universal architecture reference
- [.github/instructions/](../.github/instructions/) - Domain-specific instruction files
- [PHASE-3-TEST-EXECUTION-RESULTS.md](./PHASE-3-TEST-EXECUTION-RESULTS.md) - Automated test results
- [.github/agent-capability-matrix.md](../.github/agent-capability-matrix.md) - Agent capabilities reference

---

*Manual Test Execution Guide | Phase 3 Behavior Testing | Issue #81*
*Estimated Time: 30 minutes | Success Criteria: ≥8/10 tests passing*
