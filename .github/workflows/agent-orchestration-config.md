# Agentic Workflow Configuration
**Version**: 1.0 | **Status**: Operational | **Created**: 2026-03-08

This document defines how AI agents (GitHub Copilot, Claude Code) orchestrate work using the instruction hierarchy established in Phase 1-2 of the Copilot Configuration Tuning (Issue #81).

---

## Agent Routing Decision Tree

When an issue or PR is labeled with `agentic-code` or contains `[agent]` in the title, the `agentic-code-generation.yml` workflow routes to the appropriate specialized agent.

### 1. Service Development Agent

**Trigger Conditions**:
- Issue mentions "TypeScript service" OR "health check" OR "Express endpoint"
- PR modifies `services/*/src/` files
- Label: `type:service`

**Instruction Authority**: `.github/instructions/services.instructions.md`

**Responsibilities**:
- Create/modify Express services
- Implement health check endpoints
- Handle error middleware and logging
- Enforce TypeScript strict mode
- Define API routes with proper status codes

**Key Patterns**:
```typescript
// Service template pattern
import express from 'express';
const app = express();

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date() });
});

// Error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Request failed', { error: err.message, path: req.path });
  res.status(500).json({ error: 'Internal server error' });
});
```

**Output Validation**:
- [ ] Health endpoint returns 200 with status object
- [ ] Error handler includes structured logging
- [ ] TypeScript strict mode enabled
- [ ] All endpoints documented with JSDoc
- [ ] HTTP status codes: 200, 400, 500 minimum

**Reference**: AGENTS.md § Service Ports (3002-3012, 8082)

---

### 2. Script Automation Agent

**Trigger Conditions**:
- Issue mentions "bash script" OR "automation" OR "operational script"
- PR modifies `scripts/*.sh` files
- Label: `type:script`

**Instruction Authority**: `.github/instructions/scripts.instructions.md`

**Responsibilities**:
- Create/modify bash automation scripts
- Implement proper error handling and exit codes
- Add rate limiting checks
- Support --dry-run flag
- Document in `docs/AGENT_SCRIPTS.md`

**Key Patterns**:
```bash
#!/bin/bash
set -euo pipefail

# Standard exit codes
# 0 = success
# 1 = general error
# 2 = missing dependency
# 3 = invalid input
# 4 = API error
# 5 = rate limit

error() {
  echo "ERROR: $*" >&2
  exit 1
}

check_rate_limit() {
  # Implementation depends on API
  # See AGENT_SCRIPTS.md for patterns
  :
}
```

**Output Validation**:
- [ ] Shebang: `#!/bin/bash`
- [ ] Safety flags: `set -euo pipefail`
- [ ] Exit codes defined (0, 1, 2, 3, 4, 5)
- [ ] Rate limit checks if API calls made
- [ ] --dry-run flag support
- [ ] Documentation in `docs/AGENT_SCRIPTS.md`

**Reference**: docs/AGENT_SCRIPTS.md (116 scripts total)

---

### 3. Python Utility Agent

**Trigger Conditions**:
- Issue mentions "Python" OR "Noosphere" OR "memory"
- PR modifies `scripts/*.py` or `services/*/python/` files
- Label: `type:python`

**Instruction Authority**: `.github/instructions/python.instructions.md`

**Responsibilities**:
- Create/modify Python utilities
- Implement type hints on all functions
- Use NoosphereClient for memory operations
- Support async/await for I/O
- Proper error handling on system boundaries

**Key Patterns**:
```python
from typing import Optional, list
from noosphere_client import NoosphereClient
import asyncio

async def query_memories(
    agent_id: str,
    context: str,
    memory_types: list[str] = None,
    min_confidence: float = 0.70
) -> list[dict]:
    """Query memories with semantic search.

    Args:
        agent_id: Agent identifier (e.g., 'classical')
        context: Search context
        memory_types: Filter to [insight, pattern, strategy, preference, lesson]
        min_confidence: Minimum confidence threshold

    Returns:
        List of memory dicts with content, confidence, type
    """
    client = NoosphereClient(enable_hybrid=True)
    return await client.query_memories(
        agent_id=agent_id,
        types=memory_types,
        context=context,
        min_confidence=min_confidence
    )
```

**Output Validation**:
- [ ] Type hints on all parameters and returns
- [ ] Comprehensive docstring with Args, Returns, Raises
- [ ] Async/await for I/O operations
- [ ] NoosphereClient usage patterns correct
- [ ] 5 memory types referenced (insight, pattern, strategy, preference, lesson)
- [ ] Error handling on system boundaries only
- [ ] Environment variables, not hardcoded credentials

**Reference**: AGENTS.md § Noosphere Service (port 3006)

---

### 4. Documentation Agent

**Trigger Conditions**:
- Issue mentions "documentation" OR "architecture" OR "pattern"
- PR modifies `docs/` or `README.md` files
- Label: `type:documentation`

**Instruction Authority**: `AGENTS.md` (primary reference)

**Responsibilities**:
- Create/update architectural documentation
- Document new patterns and design decisions
- Maintain API reference documentation
- Update CHANGELOG.md for releases

**Key Patterns**:
- Reference service ports from AGENTS.md § Service Ports
- Document 10-persona architecture
- Explain Lane Queue pattern for serial execution
- Note JSONL audit trail patterns
- Reference memory types (5 types)

**Output Validation**:
- [ ] References specific file sections (AGENTS.md § Service Ports)
- [ ] Includes port numbers with external:internal mapping
- [ ] Explains architectural patterns with examples
- [ ] Documents all 10 personas
- [ ] Includes code examples where applicable

**Reference**: AGENTS.md (49KB comprehensive reference)

---

### 5. Security Audit Agent

**Trigger Conditions**:
- Issue mentions "security" OR "vulnerability" OR "credential"
- PR modifies configuration or adds new integrations
- Label: `type:security`

**Instruction Authority**: `.aiignore` and security boundaries in instruction files

**Responsibilities**:
- Audit code for security vulnerabilities
- Enforce .aiignore constraints
- Validate input handling
- Check credential management
- Verify SSL/TLS configuration

**Key Patterns**:
- .env files and secrets: Use environment variables, never hardcode
- Build artifacts: Exclude node_modules, dist, *.js from src
- API integrations: Validate inputs, use parameterized queries
- SSL verification: Always enabled (verify_ssl=True, checkServerIdentity=true)
- Audit trails: JSONL format with all agent actions

**Output Validation**:
- [ ] No hardcoded credentials
- [ ] Input validation documented
- [ ] .aiignore patterns respected
- [ ] SSL verification enabled
- [ ] Error messages don't leak sensitive info

**Reference**: `.aiignore` (1.6KB exclusion rules)

---

## Agent Coordination Patterns

### Sequential Execution (Lane Queue Pattern)

When multiple agents need to coordinate on a single task:

1. **Service + Documentation**: Create service → Document in AGENTS.md
2. **Script + Documentation**: Create script → Document in AGENT_SCRIPTS.md
3. **Python + Noosphere**: Create utility → Test with NoosphereClient

**Pattern**:
```
Agent A completes → Issues for Agent B → Agent B completes
```

### Parallel Execution

When agents work on independent components:

1. **Multiple Services**: Create services in parallel
2. **Multiple Scripts**: Create scripts in parallel
3. **Service + Script**: Can be parallel if no dependencies

**Pattern**:
```
Agent A working... Agent B working... → Merge results
```

---

## Agent Context & Instruction Hierarchy

### Universal Context (All Agents)
- **AGENTS.md**: 49KB architecture, 10 personas, 8 service ports, principles
- **.aiignore**: 40+ file types to exclude from context

### Agent-Specific Context
- **Service Agent**: `.github/instructions/services.instructions.md`
- **Script Agent**: `.github/instructions/scripts.instructions.md`
- **Python Agent**: `.github/instructions/python.instructions.md`
- **Documentation Agent**: AGENTS.md (primary)
- **Security Agent**: `.aiignore` + instruction files

### Reference Materials
- **Port Mappings**: AGENTS.md § Service Ports
- **Script Documentation**: docs/AGENT_SCRIPTS.md (116 scripts)
- **Memory Types**: 5 types (insight, pattern, strategy, preference, lesson)
- **Exit Codes**: scripts.instructions.md § Exit Codes
- **Personas**: AGENTS.md § 10 Philosopher Personas

---

## Validation Checklist

When agent completes work, validate:

- [ ] Follows appropriate instruction file
- [ ] References AGENTS.md for architecture context
- [ ] Respects .aiignore constraints
- [ ] Includes documentation/comments
- [ ] Proper error handling
- [ ] Security boundaries enforced
- [ ] Port numbers match AGENTS.md
- [ ] Service health checks included (services)
- [ ] Exit codes defined (scripts)
- [ ] Type hints included (Python)

---

## Escalation & Manual Override

**When to escalate to human review**:
- Security vulnerability detected
- Architectural change required
- Multiple agents need coordination
- Conflicting instructions
- Out-of-scope request

**Manual override**:
- Remove `agentic-code` label to prevent routing
- Add issue directly to PR with `@claude` mention
- Use `/code-review` skill for manual review

---

## Status & Evolution

**Current Version**: 1.0 (2026-03-08)
- ✅ Agent routing infrastructure (agentic-code-generation.yml)
- ✅ 5 specialized agents defined
- ✅ Instruction hierarchy established
- ✅ Validation checklist defined

**Future Enhancements** (Phase 4.1+):
- Agent self-improvement feedback loop
- Multi-agent consensus patterns
- Custom agent types based on project evolution
- Performance metrics tracking

---

*Last Updated: 2026-03-08 | Part of GitHub Copilot Configuration Tuning (Issue #81)*
