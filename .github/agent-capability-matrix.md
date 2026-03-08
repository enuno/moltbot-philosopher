# Agent Capability Matrix
**Version**: 1.0 | **Date**: 2026-03-08 | **Part of Issue #81: Copilot Configuration Tuning**

Reference matrix for understanding which specialized agents can handle which types of code generation and automation tasks.

---

## Quick Reference: What Each Agent Does

| Agent | Domain | Primary Files | Instruction File | Key Skills |
|-------|--------|---------------|------------------|------------|
| **Service Development** | TypeScript/Express | `services/*/src/` | services.instructions.md | Health checks, error middleware, strict TypeScript |
| **Script Automation** | Bash operations | `scripts/*.sh` | scripts.instructions.md | Exit codes, rate limiting, Docker patterns |
| **Python Utility** | Python modules | `scripts/*.py`, `services/*/python/` | python.instructions.md | Type hints, async patterns, NoosphereClient |
| **Documentation** | Architecture & guides | `docs/`, `README.md` | AGENTS.md | Architecture, patterns, API docs |
| **Security Audit** | Security review | All files | .aiignore, instruction files | Input validation, credential handling, SSL |

---

## Detailed Capability Matrix

### Service Development Agent

**Authority Document**: `.github/instructions/services.instructions.md`

#### Can Do ✅

- [x] Create new Express.js services
- [x] Implement health check endpoints (`GET /health`)
- [x] Add error middleware with structured logging
- [x] Define REST API routes with proper HTTP status codes
- [x] Import and use @moltbook/agent-development-kit
- [x] Implement async request handlers
- [x] Add TypeScript type annotations
- [x] Document endpoints with JSDoc comments
- [x] Handle common errors (400, 404, 500)
- [x] Integrate with other services via fetch/axios

#### Cannot Do (Escalate) ❌

- [ ] Modify docker-compose.yml (architectural change)
- [ ] Add new service ports (requires AGENTS.md update + documentation)
- [ ] Implement database schema changes
- [ ] Create authentication systems (security domain)
- [ ] Configure rate limiting globally (requires script agent)

#### Code Patterns

**Service Template**:
```typescript
import express, { Express, Request, Response, NextFunction } from 'express';
import logger from './logger';

const app: Express = express();
app.use(express.json());

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'healthy', timestamp: new Date() });
});

// Error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Request failed', { error: err.message, path: req.path });
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`Service listening on port ${PORT}`);
});
```

#### Context Provided

- AGENTS.md § Service Ports
- AGENTS.md § Design Principles
- AGENTS.md § Architecture Stack
- Service port mappings (3002-3012, 8082)

---

### Script Automation Agent

**Authority Document**: `.github/instructions/scripts.instructions.md`

#### Can Do ✅

- [x] Create new bash automation scripts
- [x] Implement error handling with exit codes (0, 1, 2, 3, 4, 5)
- [x] Add docker exec patterns for container operations
- [x] Check rate limits for API operations
- [x] Support --dry-run flag for safe testing
- [x] Add help/usage text
- [x] Parse command-line arguments
- [x] Handle JSON output with jq
- [x] Check dependencies before execution
- [x] Log operations to stdout/stderr

#### Cannot Do (Escalate) ❌

- [ ] Modify Docker images (requires Dockerfile expertise)
- [ ] Create cron jobs in crontab (requires deployment review)
- [ ] Access secrets directly (must use environment variables)
- [ ] Implement complex business logic (use Python/TypeScript)
- [ ] Modify AGENT_SCRIPTS.md documentation (requires review)

#### Code Patterns

**Script Template**:
```bash
#!/bin/bash
set -euo pipefail

# Exit codes
readonly EXIT_SUCCESS=0
readonly EXIT_ERROR=1
readonly EXIT_MISSING_DEP=2
readonly EXIT_INVALID_INPUT=3
readonly EXIT_API_ERROR=4
readonly EXIT_RATE_LIMIT=5

error() {
  echo "ERROR: $*" >&2
  exit "$EXIT_ERROR"
}

usage() {
  echo "Usage: $(basename "$0") [--dry-run] [--help]"
  echo "  --dry-run: Show what would be done without doing it"
  echo "  --help:    Show this message"
}

main() {
  local dry_run=false

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --dry-run) dry_run=true; shift ;;
      --help) usage; exit "$EXIT_SUCCESS" ;;
      *) error "Unknown option: $1" ;;
    esac
  done

  # Implementation here
}

main "$@"
```

#### Context Provided

- docs/AGENT_SCRIPTS.md (116 scripts documented)
- AGENTS.md § Common Tasks (docker compose patterns)
- Exit code conventions
- Rate limiting patterns

---

### Python Utility Agent

**Authority Document**: `.github/instructions/python.instructions.md`

#### Can Do ✅

- [x] Create Python modules with type hints
- [x] Use NoosphereClient for memory operations
- [x] Implement async/await patterns
- [x] Write comprehensive docstrings
- [x] Handle JSON input/output
- [x] Call REST APIs with proper error handling
- [x] Query databases with parameterized queries
- [x] Use environment variables for configuration
- [x] Implement logging with structured messages
- [x] Create command-line utilities with argparse

#### Cannot Do (Escalate) ❌

- [ ] Modify Noosphere database schema
- [ ] Create new memory types (beyond 5: insight, pattern, strategy, preference, lesson)
- [ ] Implement complex cryptography
- [ ] Modify production deployment configurations
- [ ] Create web servers (use Service agent instead)

#### Code Patterns

**Python Template**:
```python
#!/usr/bin/env python3
"""Module description.

Longer description explaining purpose and usage.
"""

from typing import Optional, list
import asyncio
import logging
from noosphere_client import NoosphereClient

logger = logging.getLogger(__name__)

async def query_agent_memories(
    agent_id: str,
    context: str,
    memory_types: Optional[list[str]] = None,
    min_confidence: float = 0.70
) -> list[dict]:
    """Query Noosphere memories with semantic search.

    Args:
        agent_id: Agent identifier (e.g., 'classical')
        context: Search context for semantic matching
        memory_types: Filter to specific types
            (insight, pattern, strategy, preference, lesson)
        min_confidence: Minimum confidence threshold [0-1]

    Returns:
        List of memory dictionaries with:
        - content: Memory text
        - confidence: Relevance score [0-1]
        - type: Memory type
        - agent_id: Creating agent
        - created_at: Timestamp

    Raises:
        ValueError: If confidence not in [0, 1]
        ConnectionError: If Noosphere service unavailable
    """
    if not (0 <= min_confidence <= 1):
        raise ValueError(f"Confidence must be 0-1, got {min_confidence}")

    client = NoosphereClient(enable_hybrid=True)
    try:
        return await client.query_memories(
            agent_id=agent_id,
            types=memory_types,
            context=context,
            min_confidence=min_confidence
        )
    except Exception as e:
        logger.error("Memory query failed", exc_info=True)
        raise
```

#### Context Provided

- 5 Memory types: insight, pattern, strategy, preference, lesson
- AGENTS.md § Noosphere Service (port 3006)
- NoosphereClient API patterns
- Async/await best practices

---

### Documentation Agent

**Authority Document**: `AGENTS.md` (primary reference)

#### Can Do ✅

- [x] Create architecture documentation
- [x] Document REST API endpoints
- [x] Explain design patterns used in codebase
- [x] Write setup/installation guides
- [x] Create developer reference documents
- [x] Document new features and changes
- [x] Update CHANGELOG.md with version info
- [x] Create examples and tutorials
- [x] Document configuration options

#### Cannot Do (Escalate) ❌

- [ ] Modify code without review (documentation agent, not implementer)
- [ ] Change architecture decisions without consensus
- [ ] Remove or change documented APIs without notice
- [ ] Generate outdated information (must verify with actual code)
- [ ] Create sensitive/confidential documentation

#### Content Patterns

**Reference Pattern**:
```markdown
## Service Integration Example

See AGENTS.md § Service Ports for all service port mappings:

| Service | Port | Purpose |
|---------|------|---------|
| AI Content Generator | 3002 | Venice/Kimi routing |
| Model Router | 3003 | Caching, request routing |
| Noosphere | 3006 | Memory REST API v3.0 |

For detailed architecture, see AGENTS.md § Architecture Stack.
```

#### Context Provided

- AGENTS.md (49KB comprehensive reference)
- 10 Philosopher personas and their roles
- Service architecture and port mappings
- Design principles and patterns
- Lane Queue pattern explanation

---

### Security Audit Agent

**Authority Document**: `.aiignore` and security guidelines in instruction files

#### Can Do ✅

- [x] Audit code for hardcoded credentials
- [x] Check input validation patterns
- [x] Review error handling for information leakage
- [x] Verify SSL/TLS configuration
- [x] Validate parameterized queries
- [x] Check .aiignore compliance
- [x] Review environment variable usage
- [x] Identify dependency vulnerabilities
- [x] Audit JSONL logging for sensitive data
- [x] Check authentication/authorization patterns

#### Cannot Do (Escalate) ❌

- [ ] Implement authentication systems (architectural decision)
- [ ] Modify security policies without governance review
- [ ] Deploy security patches (requires testing)
- [ ] Create encryption algorithms (use standard libraries)
- [ ] Make decisions on security thresholds (requires council consensus)

#### Security Patterns

**.env Handling** (✅ Correct):
```bash
# Safe: Use environment variables
DATABASE_URL=$(DATABASE_URL)
MOLTBOOK_API_KEY=${MOLTBOOK_API_KEY?Missing MOLTBOOK_API_KEY}
```

**SSL Verification** (✅ Correct):
```python
# Safe: SSL enabled by default
response = await client.get(url)  # verify_ssl=True by default

# Unsafe: ❌ Never do this
response = await client.get(url, verify_ssl=False)
```

**Error Handling** (✅ Correct):
```typescript
// Safe: Generic error message, details logged
logger.error('Database query failed', { sql, error });
res.status(500).json({ error: 'Internal server error' });
```

#### Context Provided

- .aiignore exclusion rules (40+ file types)
- Security boundaries defined in instruction files
- AGENTS.md § Security Boundaries
- Credential handling patterns
- Input validation requirements

---

## Agent Routing Decision Tree

```
Issue/PR received with 'agentic-code' label or '[agent]' in title
         ↓
    Route based on:
    - File paths being modified
    - Keywords in issue/PR title
    - Explicit label (type:service, type:script, etc.)
         ↓
   ┌──────┴──────────────────────────────┬──────────────────┐
   ↓                                      ↓                  ↓
Service files (.ts)?          Script files (.sh)?    Python files (.py)?
   ↓                                      ↓                  ↓
Service Agent              Script Agent             Python Agent
   ↓                                      ↓                  ↓
services.instructions.md   scripts.instructions.md  python.instructions.md
```

---

## Agent Limitations & Constraints

### All Agents Must

- ✅ Follow instruction files (non-negotiable)
- ✅ Reference AGENTS.md for architecture
- ✅ Respect .aiignore context exclusions
- ✅ Enforce security boundaries
- ✅ Include documentation/comments
- ✅ Handle errors gracefully
- ✅ Use proper logging patterns
- ✅ Exit gracefully on failure

### Agents Should NOT

- ❌ Hardcode credentials or API keys
- ❌ Generate code without documentation
- ❌ Ignore security boundaries
- ❌ Make architectural changes unilaterally
- ❌ Deploy to production without review
- ❌ Modify protected branches directly
- ❌ Override existing patterns without review
- ❌ Include build artifacts in commits

---

## Escalation Criteria

**Immediately escalate to human review if**:

1. **Security Issue**: Credential exposure, injection vulnerability, SSL bypass
2. **Architectural Change**: New service, modified governance, schema changes
3. **Breaking Change**: API modification, dependency upgrade
4. **Ambiguous Request**: Conflicting requirements, out-of-scope work
5. **Agent Conflict**: Multiple agents give conflicting guidance
6. **Validation Failure**: Generated code doesn't pass linting or tests

**Escalation Process**:
```
Agent detects issue
    ↓
Agent comments on PR/issue with details
    ↓
Human reviews and provides guidance
    ↓
Agent implements human decision
    ↓
Re-validation
```

---

## Testing & Validation

**Before Deploying Agent Output**:

1. **Code Quality**: Linting passes (npm run lint, ruff, shellcheck)
2. **Tests**: Unit tests pass (npm test, pytest)
3. **Security**: No hardcoded secrets, proper validation
4. **Documentation**: Comments and docstrings present
5. **Architecture**: Follows patterns from instruction files
6. **Integration**: Works with existing services/scripts

**Agent Self-Validation Checklist**:
```markdown
## Validation Checklist
- [ ] Follows instruction file patterns exactly
- [ ] References AGENTS.md for context
- [ ] Respects .aiignore constraints
- [ ] Passes linting (npm/ruff/shellcheck)
- [ ] Unit tests passing
- [ ] Documentation included
- [ ] Security boundaries respected
- [ ] Ready for human review
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-03-08 | Initial capability matrix with 5 agent types |

---

## References

- [AGENTS.md](../AGENTS.md) - Architecture & personas (49KB)
- [.aiignore](../.aiignore) - Context exclusion rules (1.6KB)
- [.github/instructions/services.instructions.md](./instructions/services.instructions.md)
- [.github/instructions/scripts.instructions.md](./instructions/scripts.instructions.md)
- [.github/instructions/python.instructions.md](./instructions/python.instructions.md)
- [docs/AGENT_SCRIPTS.md](../docs/AGENT_SCRIPTS.md) - 116 scripts documented
- [.github/workflows/agentic-code-generation.yml](./workflows/agentic-code-generation.yml) - Agent routing workflow

---

*Last Updated: 2026-03-08 | Part of Issue #81: GitHub Copilot Configuration Tuning*
