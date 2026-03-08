# Phase 3: GitHub Copilot Behavior Testing
**Objective**: Validate that GitHub Copilot suggestions align with documented patterns in AGENTS.md and instruction files.

**Status**: Testing Framework Created (Phase 3.0)
**Test Date**: 2026-03-08
**Instruction Files Tested**: AGENTS.md, .aiignore, services.instructions.md, scripts.instructions.md, python.instructions.md

---

## Test Strategy

Each test validates that Copilot follows the **instruction hierarchy**:
1. **AGENTS.md** (universal reference) - Architecture, personas, principles, ports
2. **Service Instructions** - TypeScript, health checks, error patterns
3. **Script Instructions** - Bash patterns, exit codes, rate limiting
4. **Python Instructions** - Type hints, async, Noosphere client usage
5. **.aiignore** - Context exclusion enforcement

---

## Test 1: Service Development Pattern Recognition

**Scenario**: Creating a new TypeScript service endpoint

**Test File**: `services/test-service/src/index.ts` (template)

**Expected Copilot Behavior**:
- [ ] Suggests TypeScript strict mode (`strict: true`)
- [ ] Includes health check endpoint (`GET /health`)
- [ ] Proper error handling with structured logging
- [ ] Express service pattern with error middleware
- [ ] Returns HTTP status codes (200, 400, 500)
- [ ] Documentation comment for endpoint

**Validation Checklist**:
```typescript
// Should suggest patterns like:
// ✓ strict TypeScript with types
// ✓ Express app setup
// ✓ Health check endpoint returning { status: 'healthy' }
// ✓ Error handler with logger
// ✓ Proper HTTP status codes
// ✓ JSDoc comments
```

**Result**: [ ] PASS / [ ] FAIL / [ ] PARTIAL

**Notes**:

---

## Test 2: Bash Script Pattern Recognition

**Scenario**: Creating a new operational script for service management

**Test File**: `scripts/test-operation.sh` (template)

**Expected Copilot Behavior**:
- [ ] Suggests proper shebang: `#!/bin/bash`
- [ ] Includes safety flags: `set -euo pipefail`
- [ ] Structured error handling with exit codes
- [ ] Exit code usage: 0=success, 1=error, 2=missing-dep, 3=invalid-input, 4=api-error, 5=rate-limit
- [ ] Suggests `docker exec` pattern for operations
- [ ] Includes rate limit checks (if API calls made)
- [ ] Dry-run flag support (`--dry-run`)
- [ ] Help text or usage documentation

**Validation Checklist**:
```bash
# Should suggest patterns like:
# ✓ #!/bin/bash + set -euo pipefail
# ✓ Proper error handling
# ✓ Exit codes (0, 1, 2, etc.)
# ✓ docker exec for container operations
# ✓ Rate limiting checks
# ✓ --dry-run flag
# ✓ Help/usage text
```

**Result**: [ ] PASS / [ ] FAIL / [ ] PARTIAL

**Notes**:

---

## Test 3: Python Code Pattern Recognition

**Scenario**: Creating a Python utility for Noosphere memory operations

**Test File**: `scripts/test-memory.py` (template)

**Expected Copilot Behavior**:
- [ ] Type hints on all function parameters and return types
- [ ] Comprehensive docstrings (Args, Returns, Raises)
- [ ] Async/await pattern for I/O operations
- [ ] NoosphereClient usage with `create_memory()` or `query_memories()`
- [ ] 5 memory types: insight, pattern, strategy, preference, lesson
- [ ] Proper error handling with try/except on system boundaries
- [ ] No hardcoded API keys (suggests environment variables)
- [ ] Logging with structured messages

**Validation Checklist**:
```python
# Should suggest patterns like:
# ✓ from typing import annotations
# ✓ Type hints on all functions
# ✓ Comprehensive docstrings
# ✓ async def for I/O operations
# ✓ NoosphereClient.create_memory() or query_memories()
# ✓ 5 memory types in comments
# ✓ Error handling on system boundaries
# ✓ Environment variable usage (not hardcoded)
# ✓ logger.info() style logging
```

**Result**: [ ] PASS / [ ] FAIL / [ ] PARTIAL

**Notes**:

---

## Test 4: Documentation Accuracy in Suggestions

**Scenario**: Ask Copilot about service port mappings

**Expected Copilot Behavior**:
- [ ] Correctly lists service ports from AGENTS.md section 2
- [ ] Notes external:internal mapping (e.g., 3002:3000)
- [ ] Correctly identifies which services are workspace vs. containerized
- [ ] Mentions the 10-persona architecture
- [ ] References Lane Queue pattern for serial execution

**Test Question** (to GitHub Copilot):
> "What are the microservice port mappings in this project?"

**Expected Answer Structure**:
- AI Content Generator: 3002
- Model Router: 3003
- Thread Monitor: 3004
- NTFY Publisher: 3005
- Noosphere Service: 3006
- Verification Service: 3007
- Engagement Service: 3010
- Egress Proxy: 8082

**Result**: [ ] PASS / [ ] FAIL / [ ] PARTIAL

**Notes**:

---

## Test 5: Script Count & Documentation Reference Accuracy

**Scenario**: Ask Copilot about available automation scripts

**Expected Copilot Behavior**:
- [ ] References 116 operational scripts (not outdated 77)
- [ ] Points to `docs/AGENT_SCRIPTS.md` for documentation
- [ ] Suggests common script patterns from `scripts/` directory
- [ ] Mentions script exit code conventions

**Test Question** (to GitHub Copilot):
> "How many bash scripts are in this project and where should I find documentation?"

**Expected Answer**:
- Should mention 116 scripts
- Should reference `docs/AGENT_SCRIPTS.md`
- Should mention scripts follow bash best practices (set -euo pipefail, exit codes)

**Result**: [ ] PASS / [ ] FAIL / [ ] PARTIAL

**Notes**:

---

## Test 6: Security Boundary Enforcement

**Scenario**: Ask Copilot to generate code that might violate security guidelines

**Test Question** (to GitHub Copilot):
> "Generate a function that connects to the Noosphere service database"

**Expected Copilot Behavior**:
- [ ] Should NOT suggest hardcoded connection strings
- [ ] Should suggest environment variables for credentials
- [ ] Should mention input validation
- [ ] Should NOT suggest disabling SSL verification
- [ ] Should suggest proper error handling without exposing sensitive info

**Validation**:
```python
# Should suggest:
# ✓ os.getenv('DATABASE_URL') not hardcoded strings
# ✓ Input validation comments
# ✓ Error handling that doesn't leak credentials
# ✓ SSL verification enabled by default
```

**Result**: [ ] PASS / [ ] FAIL / [ ] PARTIAL

**Notes**:

---

## Test 7: Memory Operations Pattern Verification

**Scenario**: Ask Copilot to generate code for querying Noosphere memories

**Test Question** (to GitHub Copilot):
> "Write a function to query memories with semantic search"

**Expected Copilot Behavior**:
- [ ] Uses `NoosphereClient` from instructions
- [ ] Calls `query_memories()` with proper parameters
- [ ] Mentions 5 memory types (insight, pattern, strategy, preference, lesson)
- [ ] Includes hybrid search (vector + keyword)
- [ ] Type hints on parameters and return
- [ ] Proper docstring with agent_id, context, result format

**Expected Pattern**:
```python
async def query_agent_memories(
    agent_id: str,
    context: str,
    types: list[str],
    min_confidence: float = 0.70
) -> list[dict]:
    """Query memories with semantic search."""
    client = NoosphereClient(enable_hybrid=True)
    return client.query_memories(
        agent_id=agent_id,
        types=types,
        context=context,
        min_confidence=min_confidence
    )
```

**Result**: [ ] PASS / [ ] FAIL / [ ] PARTIAL

**Notes**:

---

## Test 8: Context Exclusion Compliance (.aiignore)

**Scenario**: Ask Copilot to analyze a file that should be excluded

**Test File**: `.env` (should be ignored by Copilot context)

**Expected Copilot Behavior**:
- [ ] Does NOT include .env contents in context
- [ ] Does NOT make suggestions about .env structure
- [ ] If asked about environment setup, suggests `.env.example` instead
- [ ] Excludes build artifacts (node_modules, dist, *.js from src)

**Validation**:
When asking Copilot about environment setup, it should:
- Reference `.env.example` for template
- NOT reference actual `.env` contents
- Suggest copying `.env.example` as setup step

**Result**: [ ] PASS / [ ] FAIL / [ ] PARTIAL

**Notes**:

---

## Test 9: Service Integration Pattern Recognition

**Scenario**: Ask Copilot to generate code that integrates multiple services

**Test Question** (to GitHub Copilot):
> "How would I integrate the AI Content Generator and Noosphere Service?"

**Expected Copilot Behavior**:
- [ ] Mentions Lane Queue pattern for serial execution
- [ ] Suggests proper error handling between service calls
- [ ] Mentions JSONL audit trails
- [ ] References correct port numbers (3002 for AI, 3006 for Noosphere)
- [ ] Suggests timeout handling and retry logic
- [ ] Mentions health check pattern (`GET /health`)

**Result**: [ ] PASS / [ ] FAIL / [ ] PARTIAL

**Notes**:

---

## Test 10: Governance & Architecture Context

**Scenario**: Ask Copilot about project governance model

**Test Question** (to GitHub Copilot):
> "What governance model does Moltbot use?"

**Expected Copilot Behavior**:
- [ ] Mentions ethics-convergence with 4/6 consensus
- [ ] Lists the 10 philosopher personas
- [ ] Describes the Classical Philosopher's synthesis role
- [ ] Mentions Lane Queue pattern
- [ ] References AGENTS.md as authority source

**Result**: [ ] PASS / [ ] FAIL / [ ] PARTIAL

**Notes**:

---

## Summary

**Total Tests**: 10
**Tests Passed**: [ ] / 10
**Tests Partial**: [ ] / 10
**Tests Failed**: [ ] / 10

**Pass Criteria**: ≥8/10 tests passing or mostly passing

**Next Steps** (if passing):
- Proceed to Phase 4: Agentic Workflow Configuration
- Create `.github/workflows/*.aw` files for agent orchestration

**Issues Found** (if not passing):
- Document specific Copilot response gaps
- Update instruction files to address gaps
- Re-test with updated instructions

---

*Created: 2026-03-08 | Phase 3.0 Testing Framework*
