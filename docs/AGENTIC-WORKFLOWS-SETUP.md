# Agentic Workflows - Setup & Usage Guide
**Version**: 1.0 | **Status**: Production-Ready | **Date**: 2026-03-08

Guide for enabling and using the automated GitHub Copilot agent routing workflows created in Phase 4.

---

## Overview

The agentic workflow system automatically routes code generation requests to specialized agents based on the type of work. When you label an issue or PR with `agentic-code`, the workflow:

1. Routes to appropriate specialized agent (Service, Script, Python, Documentation, or Security)
2. Provides context from instruction files
3. Generates implementation guidance
4. Validates against project patterns

---

## Quick Start

### 1. Enable the Workflow

The workflow file is already in place:
```
.github/workflows/agentic-code-generation.yml
```

✅ **Status**: Active and ready to use

### 2. Create a Test Issue

Create an issue with the `agentic-code` label to test the workflow:

**Example Issue 1 - Service Development**:
```markdown
Title: [agent] Create health check endpoint for verification service

Description:
I need to add a `/health` endpoint to the verification-service that returns
the service status in JSON format.

Requirements:
- Return service status (healthy/degraded/unhealthy)
- Include timestamp
- Include version information

Labels: agentic-code, type:service
```

**Example Issue 2 - Script Creation**:
```markdown
Title: [agent] Create script to query Noosphere memory

Description:
Create a bash script that queries Noosphere memories with semantic search.
It should support different query types and output formats.

Requirements:
- Accept agent ID as parameter
- Support --dry-run flag
- Support JSON and CSV output formats
- Include rate limiting checks

Labels: agentic-code, type:script
```

**Example Issue 3 - Python Utility**:
```markdown
Title: [agent] Implement memory caching layer

Description:
Create a Python module that caches Noosphere memory queries to improve
performance on repeated searches.

Requirements:
- Use async/await for operations
- Support TTL-based cache expiration
- Log cache hits/misses
- Use type hints throughout

Labels: agentic-code, type:python
```

### 3. Workflow Triggers

The agentic workflow triggers automatically when:

- **Issue is created** with label `agentic-code`
- **Issue is updated** with label `agentic-code`
- **PR is created** with label `agentic-code`
- **PR title contains** `[agent]`
- **Issue title contains** `[agent]`

---

## Specialized Agents & Routing

### Agent 1: Service Development Agent

**Trigger**: Issue/PR mentioning service, or labeled `type:service`

**Instruction File**: `.github/instructions/services.instructions.md`

**Capabilities**:
- Create new Express services
- Add health check endpoints
- Implement error middleware
- Enforce TypeScript strict mode
- Define REST API routes

**Example Routing**:
```
Issue: "Create health check endpoint"
→ Service Agent selected
→ .github/instructions/services.instructions.md loaded
→ AGENTS.md § Service Ports provided as context
```

### Agent 2: Script Automation Agent

**Trigger**: Issue/PR mentioning script/bash, or labeled `type:script`

**Instruction File**: `.github/instructions/scripts.instructions.md`

**Capabilities**:
- Create bash automation scripts
- Implement exit codes (0, 1, 2, 3, 4, 5)
- Add rate limiting
- Support --dry-run flag
- Document in AGENT_SCRIPTS.md

**Example Routing**:
```
Issue: "Create script to query memories"
→ Script Agent selected
→ .github/instructions/scripts.instructions.md loaded
→ docs/AGENT_SCRIPTS.md pattern reference provided
```

### Agent 3: Python Utility Agent

**Trigger**: Issue/PR mentioning Python, or labeled `type:python`

**Instruction File**: `.github/instructions/python.instructions.md`

**Capabilities**:
- Create Python modules with type hints
- Use NoosphereClient for memory operations
- Implement async/await patterns
- Support proper error handling
- Comprehensive docstrings

**Example Routing**:
```
Issue: "Implement memory caching layer"
→ Python Agent selected
→ .github/instructions/python.instructions.md loaded
→ Memory type patterns and NoosphereClient examples provided
```

### Agent 4: Documentation Agent

**Trigger**: Issue/PR mentioning documentation/architecture, or labeled `type:documentation`

**Instruction File**: `AGENTS.md` (primary reference)

**Capabilities**:
- Create architecture documentation
- Document new patterns
- Update API references
- Maintain CHANGELOG
- Create guides and tutorials

**Example Routing**:
```
Issue: "Document new service architecture"
→ Documentation Agent selected
→ AGENTS.md loaded with full authority
→ Port mappings and architecture patterns provided
```

### Agent 5: Security Audit Agent

**Trigger**: Issue/PR mentioning security/vulnerability, or labeled `type:security`

**Instruction File**: `.aiignore` + security sections in instruction files

**Capabilities**:
- Audit code for vulnerabilities
- Enforce credential handling
- Validate input sanitization
- Check SSL/TLS configuration
- Verify audit trails

**Example Routing**:
```
Issue: "Security review for new API endpoint"
→ Security Agent selected
→ .aiignore loaded for context exclusion rules
→ Security boundary patterns provided
```

---

## Using the Workflow

### Step 1: Create Issue with Proper Label

```bash
# Via GitHub UI:
1. Click "New Issue"
2. Add title with [agent] or clear description
3. In Labels section, add "agentic-code"
4. Add type label (type:service, type:script, etc.)
5. Click "Create Issue"
```

### Step 2: Workflow Automatically Routes

The `.github/workflows/agentic-code-generation.yml` workflow:
- Triggers on label addition
- Routes based on file type or keywords
- Loads appropriate instruction file
- Invokes claude-code-action with context

### Step 3: Agent Responds

Agent provides:
- **Routing Decision** - Which agent will handle this
- **Instruction Reference** - Which files to follow
- **Key Requirements** - Extracted from issue
- **Implementation Approach** - How to proceed
- **Next Steps** - Detailed checklist

### Step 4: Developer Reviews & Implements

1. Review agent suggestions
2. Ask follow-up questions with `@claude` mention
3. Implement using suggested patterns
4. Iterate until satisfied
5. Merge when ready

---

## Example Workflow: Service Development

### Issue Created:
```markdown
Title: [agent] Add memory query endpoint to Noosphere service
Labels: agentic-code, type:service

Description:
Add a REST endpoint to noosphere-service that queries memories using semantic search.
```

### Workflow Execution:

1. **Trigger**: Issue created with `agentic-code` label
2. **Routing**: Service Development Agent selected (type:service label)
3. **Context Loaded**:
   - `.github/instructions/services.instructions.md`
   - `AGENTS.md § Service Ports` (port 3006 for Noosphere)
   - `AGENTS.md § Architecture Stack`

4. **Agent Response** (from claude-code-action):
   ```
   ROUTING DECISION
   Assigned Agent: Service Development Agent
   Priority: High
   Instruction File: .github/instructions/services.instructions.md

   REQUIREMENT ANALYSIS
   - Primary type: Express REST endpoint
   - Key constraints: Semantic search integration, async operations
   - Related services: Noosphere Service (port 3006)
   - Pattern: Lane Queue for serial execution

   NEXT STEPS
   1. Create endpoint: GET /memory/search
   2. Accept parameters: agent_id, context, min_confidence
   3. Validate inputs (agent_id required, confidence 0-1)
   4. Call Noosphere service on port 3006
   5. Return structured JSON response
   6. Add error handler for 500 errors
   7. Include health check integration
   8. Add JSDoc comments
   9. Follow TypeScript strict mode
   10. Write unit tests
   ```

5. **Developer Action**:
   - Implements based on agent guidance
   - Uses `@claude` for clarifications
   - References instruction file patterns
   - Tests against expected patterns

---

## Configuration Examples

### Example 1: Service Issue Template

Create `.github/ISSUE_TEMPLATE/agentic-service.md`:

```markdown
---
name: "Agent: Create New Service"
about: Use AI agents to create a new microservice
title: "[agent] "
labels: agentic-code, type:service
---

## Service Name
[Name of the new service]

## Purpose
[What this service does]

## Endpoints
- [ ] `GET /health` - Health check
- [ ] `POST /action` - Main action
- [ ] Additional endpoints...

## Integration Points
[Which services does this integrate with?]

## References
- AGENTS.md § Service Ports
- .github/instructions/services.instructions.md
```

### Example 2: Script Issue Template

Create `.github/ISSUE_TEMPLATE/agentic-script.md`:

```markdown
---
name: "Agent: Create New Script"
about: Use AI agents to create an automation script
title: "[agent] "
labels: agentic-code, type:script
---

## Script Purpose
[What this script does]

## Parameters
- [ ] Input parameters required
- [ ] Optional flags (--dry-run, --help, etc.)

## Operations
[What should the script do?]

## Integration
[Which services does it interact with?]

## References
- docs/AGENT_SCRIPTS.md
- .github/instructions/scripts.instructions.md
```

---

## Monitoring & Feedback

### Check Workflow Status

```bash
# View workflow runs
gh workflow view agentic-code-generation.yml

# See recent runs
gh run list --workflow=agentic-code-generation.yml

# Check specific run
gh run view <run-id>
```

### Evaluate Agent Suggestions

**Quality Metrics**:
- ✅ References correct instruction files
- ✅ Follows AGENTS.md architecture patterns
- ✅ Suggests code matching project style
- ✅ Includes proper error handling
- ✅ Provides clear next steps

**If Suggestions Are Poor**:
1. Review instruction file accuracy
2. Check if context is being passed correctly
3. Update instruction files to address gaps
4. Re-run workflow to validate fix

---

## Escalation Paths

**When to escalate to human review**:

1. **Security Vulnerability** → Security Agent → Manual review
2. **Architectural Change** → Documentation Agent → Council review
3. **Multi-Service Integration** → Service Agent → Architecture review
4. **Conflicting Guidance** → Manual conflict resolution
5. **Out-of-Scope Request** → Mark as invalid, close issue

---

## Best Practices

### ✅ DO:

- [x] Use clear, specific issue titles
- [x] Add type labels (type:service, type:script, etc.)
- [x] Reference relevant sections of AGENTS.md
- [x] Include acceptance criteria
- [x] Ask follow-up questions with `@claude` mention
- [x] Review suggestions against instruction files
- [x] Document why suggestions were accepted/rejected

### ❌ DON'T:

- [ ] Create vague issues without specific requirements
- [ ] Skip the `agentic-code` label
- [ ] Mix multiple request types in one issue
- [ ] Ignore agent routing suggestions
- [ ] Deploy agent suggestions without review
- [ ] Modify instruction files without validation

---

## Performance Metrics

Track agent effectiveness:

| Metric | Target | How to Measure |
|--------|--------|---|
| **Suggestion Accuracy** | ≥80% | Code passes linting/tests without changes |
| **Pattern Compliance** | ≥90% | Suggestions follow instruction files |
| **Time to Implementation** | Reduced | Compare with pre-agent development time |
| **Code Quality** | Maintained | Review metrics stay consistent |
| **Developer Satisfaction** | Improving | Gather feedback on usefulness |

---

## Troubleshooting

### Workflow doesn't trigger

**Check**:
- [ ] Issue has `agentic-code` label
- [ ] Workflow file exists: `.github/workflows/agentic-code-generation.yml`
- [ ] GitHub Actions is enabled for repository
- [ ] Workflow file syntax is valid

**Fix**:
```bash
# Validate workflow syntax
gh workflow view agentic-code-generation.yml --json

# Check recent workflow runs
gh run list --workflow=agentic-code-generation.yml --limit 5
```

### Agent routes to wrong agent

**Check**:
- [ ] Issue title/labels clearly indicate type
- [ ] Type label matches agent (type:service → Service Agent)

**Fix**:
```
Add comment: @claude route this to [correct agent name]
```

### Instruction file not loaded

**Check**:
- [ ] Instruction file exists at referenced path
- [ ] File path is correct in routing logic
- [ ] File contains relevant patterns

**Fix**:
- Verify file exists
- Update routing logic if file moved
- Add missing patterns to instruction file

---

## Advanced: Custom Agent Types

For future expansion, additional agents can be added:

1. **Create instruction file**: `.github/instructions/[domain].instructions.md`
2. **Update routing logic**: Add new agent type to workflow
3. **Document capabilities**: Update agent-capability-matrix.md
4. **Test patterns**: Create test scenarios for new agent

---

## Integration with Version Control

### PR Workflow

```
1. Create issue with agentic-code label
2. Agent provides implementation guidance
3. Developer creates feature branch
4. Developer implements based on agent guidance
5. Submit PR referencing issue
6. Use @claude mention for code review
7. Merge when approved
```

### Branch Protection

Recommended protection rules:
- [x] Require PR reviews
- [x] Require status checks to pass
- [x] Require branches to be up to date
- [x] Require conversation resolution

---

## Next Steps

1. **Create Test Issue** - Try the workflow with example above
2. **Collect Feedback** - Evaluate agent suggestions
3. **Refine Instructions** - Update instruction files based on findings
4. **Enable by Default** - Make agentic workflows standard practice

---

## Resources

- [Agent Capability Matrix](../.github/agent-capability-matrix.md) - What each agent can do
- [Agent Orchestration Config](../.github/workflows/agent-orchestration-config.md) - How agents coordinate
- [Service Instructions](../.github/instructions/services.instructions.md) - Service patterns
- [Script Instructions](../.github/instructions/scripts.instructions.md) - Script patterns
- [Python Instructions](../.github/instructions/python.instructions.md) - Python patterns
- [AGENTS.md](../AGENTS.md) - Universal architecture reference

---

*Agentic Workflows Setup | Phase 4 Configuration | Issue #81*
*Status: Production-Ready | Ready to Create Test Issues*
