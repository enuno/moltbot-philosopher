Here is a **common sense operational guide**—distilled wisdom for keeping the Council running without unnecessary complexity.

---

## **SKILL.md: Praxis — Common Sense Operations for moltbot-philosopher**

**Skill ID**: `praxis-common-sense`  
**Agent Type**: Universal (All Council Voices + Infrastructure)  
**Philosophy**: *"Make it work, make it right, make it fast—in that order. But mostly, make it understandable."*

---

### **I. THE PRINCIPLE OF LEAST SURPRISE**

**Golden Rule**: If another developer (or your future self) cannot understand your intent in 30 seconds, it is wrong.

**Applied**:
- File names describe contents (`check-mentions.sh`, not `utils.sh`)
- Variable names are nouns (`last_heartbeat`), functions are verbs (`process_mention`)
- Comments explain *why*, not *what* (the code already says what)
- No magic numbers—constants are named and centralized

**Anti-Pattern**:
```bash
# Bad
if [ $x -gt 86400 ]; then  # What is 86400?

# Good
SECONDS_PER_DAY=86400
if [ $last_check -gt $SECONDS_PER_DAY ]; then
```

---

### **II. PLANNING: THINK BEFORE TYPING**

#### **A. The Five-Minute Rule**

Before writing any code, answer these five questions in a file called `NOTES.md` (temporary, deleted after implementation):

1. **What problem does this solve?** (One sentence)
2. **How will I know it works?** (Test criteria)
3. **What could go wrong?** (Failure modes)
4. **Who else needs to know about this?** (Documentation, notifications)
5. **When can I delete this?** (TTL, deprecation plan)

If you cannot answer #5, you are building legacy debt. Stop.

#### **B. Scope Containment**

**The Council Rule**: No single change touches more than three files.

If your plan requires:
- Modifying >3 files → Break into smaller changes
- Changing both infrastructure and philosophy → Two separate changes
- Adding a feature without tests → Not ready to implement

**Branch Naming**:
```bash
feature/short-description      # New capability
fix/bug-description            # Bug fix
hotfix/critical-description    # Production emergency
refactor/what-changed          # No behavior change, cleaner code
docs/what-documented           # Documentation only
```

---

### **III. DEVELOPMENT: WORKING WITH CLARITY**

#### **A. The Local Development Loop**

```bash
# 1. Verify environment
docker-compose config > /dev/null && echo "Config valid" || exit 1

# 2. Run tests (if they exist)
./scripts/test.sh

# 3. Make change
vim skills/philosophy-debater/handlers/new_tool.js

# 4. Verify locally
docker build -t moltbot:test . && docker run --rm moltbot:test node -e "require('./handlers/new_tool')"

# 5. Check for obvious errors
shellcheck scripts/*.sh  # For bash scripts
eslint skills/**/*.js    # For JavaScript

# 6. Commit with context
git add -p  # Stage interactively, review each change
git commit -m "Add tool: summarize_debate for Classical voice

- Implements multi-perspective thread analysis
- Routes to Venice/deepseek-v3.2 for cost efficiency
- Includes JSON schema validation

Test: ./scripts/test-summarize.sh"
```

#### **B. Configuration Over Code**

If a value might change, make it configuration. If it changes per environment, make it environment variables.

**Hierarchy**:
```
1. Environment variables (secrets, deployment-specific)
2. Config files (behavior tuning, feature flags)
3. Code defaults (sane fallbacks only)
```

**Never hardcode**:
- API endpoints (use config)
- Timeouts (use config with sensible defaults)
- Voice personas (use prompts/ directory)
- File paths (use variables, assume containerization)

#### **C. Error Handling: The Three Tiers**

| Severity | Behavior | Example |
|----------|----------|---------|
| **Transient** | Retry with backoff, log warning | API timeout, rate limit |
| **Operational** | Alert human, degrade gracefully | Disk full, dependency down |
| **Fatal** | Stop immediately, preserve state | Data corruption, security breach |

**Pattern**:
```bash
retry_with_backoff() {
    local cmd=$1
    local max_attempts=3
    local delay=2
    
    for i in $(seq 1 $max_attempts); do
        $cmd && return 0
        sleep $((delay * i))
    done
    
    # Escalate to operational alert
    ntfy_notify "operational" "high" "Persistent failure" "$cmd failed $max_attempts times"
    return 1
}
```

---

### **IV. IMPLEMENTATION: BUILDING TO LAST**

#### **A. The Checklist Before Merge**

- [ ] Works on your machine (obviously)
- [ ] Works in Docker container (`docker build && docker run`)
- [ ] Does not break existing tests (`./scripts/test.sh` passes)
- [ ] New functionality has basic test coverage
- [ ] Documentation updated (README.md, SKILL.md, or inline comments)
- [ ] No secrets in code (scan with `git-secrets` or `truffleHog`)
- [ ] Commit message explains *why*, not just *what*
- [ ] CHANGELOG.md updated if user-visible change

#### **B. Testing: The Practical Minimum**

You do not need 100% coverage. You need **confidence that critical paths work**.

**Required tests**:
- Happy path (normal operation)
- One failure mode (what happens when API returns 500?)
- One edge case (empty input, maximum size input)

**Test location**: `tests/` directory mirroring `src/` structure, or co-located as `*.test.js`

**Example**:
```javascript
// handlers/summarize_debate.test.js
const { summarize_debate } = require('./summarize_debate');

test('happy path: summarizes with multiple perspectives', async () => {
    const result = await summarize_debate({
        thread_excerpt: "User A: Freedom matters. User B: But safety?",
        focus_traditions: ['sartre', 'camus']
    });
    expect(result).toContain('Sartre');
    expect(result).toContain('Camus');
});

test('failure mode: empty excerpt returns error', async () => {
    await expect(summarize_debate({thread_excerpt: ""}))
        .rejects.toThrow('No content to summarize');
});
```

#### **C. Feature Flags for Risky Changes**

If a change could destabilize the Council, wrap it:

```javascript
if (process.env.ENABLE_EXPERIMENTAL_VOICES === 'true') {
    // New voice integration
} else {
    // Safe fallback
}
```

Enable in staging, monitor, then enable in production.

---

### **V. DEPLOYMENT: CHANGING THE RUNNING SYSTEM**

#### **A. The Deployment Ladder**

Never go directly from laptop to production.

```
Development (your machine)
    ↓ (docker build works)
Local Docker (same image, local config)
    ↓ (tests pass)
Staging Environment (isolated, production-like data)
    ↓ (monitored for 24h)
Production (gradual rollout: 10% → 50% → 100%)
```

**Rollback trigger**: Error rate >1%, latency >2x baseline, any security alert

#### **B. The Pre-Deployment Checklist**

- [ ] Staging ran for 24h without incident
- [ ] Database migrations are backward-compatible (or have rollback script)
- [ ] New environment variables configured in production
- [ ] Secrets rotated if any were exposed
- [ ] NTFY alerts configured for new failure modes
- [ ] Runbook updated (or created) for operational procedures
- [ ] On-call engineer aware of change

#### **C. Deployment Automation**

Use scripts, not manual steps:

```bash
#!/bin/bash
# scripts/deploy.sh

VERSION=$1
ENVIRONMENT=$2

if [ -z "$VERSION" ] || [ -z "$ENVIRONMENT" ]; then
    echo "Usage: $0 <version> <staging|production>"
    exit 1
fi

# Pre-flight checks
./scripts/pre-deploy-checks.sh || exit 1

# Build and tag
docker build -t moltbot:${VERSION} .
docker tag moltbot:${VERSION} registry.moltbook.com/moltbot:${VERSION}

# Push
docker push registry.moltbook.com/moltbot:${VERSION}

# Deploy (blue-green: start new, verify, stop old)
docker-compose -f docker-compose.${ENVIRONMENT}.yml up -d --no-deps --scale moltbot=2
sleep 30
./scripts/health-check.sh || (./scripts/rollback.sh && exit 1)
docker-compose -f docker-compose.${ENVIRONMENT}.yml up -d --no-deps --scale moltbot=1

echo "Deployed ${VERSION} to ${ENVIRONMENT}"
```

#### **D. Post-Deployment Verification**

```bash
# Immediate (0-5 minutes)
docker logs --tail 100 moltbot | grep -i error
curl -f http://localhost:3000/health || alert "Health check failed"

# Short-term (5-30 minutes)
# Monitor error rates, latency, resource usage

# Long-term (24 hours)
# Review logs for anomalies, check user feedback
```

---

### **VI. OBSERVABILITY: KNOWING WHAT HAPPENED**

#### **A. Logging: The Three Questions**

Every log line must help answer:
1. **What happened?** (Event description)
2. **Where in the code?** (File, function, line)
3. **What was the context?** (Relevant IDs, states)

**Format**:
```
[TIMESTAMP] [LEVEL] [COMPONENT] [CORRELATION_ID] Message | key=value key=value
```

**Example**:
```
2026-02-05T14:30:00Z INFO council-deliberation req-abc123 Starting inner dialogue | voices=6 topic=guardrail-cg004
2026-02-05T14:30:05Z ERROR council-deliberation req-abc123 Kimi API timeout | attempt=2 max_attempts=3
```

#### **B. Metrics That Matter**

Track these, alert on anomalies:

| Metric | Target | Alert If |
|--------|--------|----------|
| Council iteration duration | <30 min | >1 hour |
| Treatise comment quality score | >0.7 | <0.5 |
| API error rate | <1% | >5% |
| Memory usage | <80% | >90% |
| Drop box approval rate | 60-80% | <40% or >90% (indicates filter failure) |

#### **C. Alert Fatigue Prevention**

**Rule**: If an alert fires and no action is taken, remove or fix the alert.

Alert severity:
- **Page (immediate)**: Service down, security breach, data loss
- **Ticket (same day)**: Performance degradation, elevated errors
- **Email (weekly digest)**: Trends, capacity planning, minor issues

---

### **VII. SECURITY: COMMON SENSE PROTECTION**

#### **A. Secrets Management**

**Never**:
- Commit secrets to git (even "temporarily")
- Log secrets (mask them: `api_key=sk-...abc123`)
- Share production credentials in chat
- Use the same key for staging and production

**Always**:
- Rotate keys quarterly
- Use least-privilege (read-only where possible)
- Audit access logs monthly

#### **B. Input Validation**

Trust no input, especially from the internet.

```bash
# Validate before use
if [[ ! "$user_input" =~ ^[a-zA-Z0-9_-]+$ ]]; then
    log_error "Invalid input format"
    return 1
fi

# Sanitize for logs (prevent log injection)
safe_input=$(echo "$user_input" | tr -d '\n\r' | cut -c1-100)
log "Processing: $safe_input"
```

#### **C. Dependency Hygiene**

- Pin versions in `package.json`, `requirements.txt`, `Dockerfile`
- Monthly: `npm audit`, check for CVEs in base images
- Annual: Review if each dependency is still necessary

---

### **VIII. COLLABORATION: WORKING WITH OTHERS**

#### **A. Code Review: The Kind Checklist**

When reviewing another's code:
- [ ] **Do I understand what this does?** (Clarity)
- [ ] **Does it handle failure?** (Robustness)
- [ ] **Would I want to maintain this?** (Maintainability)
- [ ] **Are there tests?** (Confidence)
- [ ] **Is the commit message helpful?** (History)

**Tone**: Suggest, don't criticize. "Consider handling the empty case" not "You forgot empty input."

#### **B. Documentation: The Bus Factor**

If you were hit by a bus tomorrow, could someone else:
- Deploy the system?
- Debug a failure?
- Add a new Voice to the Council?

If no, document it. **README.md is not optional.**

#### **C. Knowledge Sharing**

- **Weekly**: Brief sync on what changed, what broke, what was learned
- **Monthly**: Review error logs as a group, find patterns
- **Quarterly**: Retrospective on process improvements

---

### **IX. THE LONG VIEW: SUSTAINABLE OPERATIONS**

#### **A. Technical Debt Budget**

Allow 20% of development time for:
- Refactoring
- Test improvement
- Documentation
- Dependency updates

If you never pay this debt, you eventually pay 100% of your time fighting fires.

#### **B. Deprecation: The Graceful Exit**

When sunsetting a feature:
1. Announce deprecation (treatise comment, NTFY alert)
2. Maintain backward compatibility for 2 Council iterations (10 days)
3. Log usage of deprecated feature (identify stragglers)
4. Remove code, archive documentation
5. Celebrate the simplification

#### **C. The Quarterly Review**

Every 90 days, ask:
- What is our biggest operational risk?
- What takes too much manual effort?
- What should we stop doing?
- What did we learn?

Document answers in `meta/quarterly-reviews/YYYY-QN.md`

---

### **X. EMERGENCY PROCEDURES**

**When Everything Breaks**:

1. **Don't panic**. The git history preserves everything.
2. **Assess**: Is it security, data loss, or availability?
3. **Communicate**: NTFY alert to council-operations with severity
4. **Mitigate**: Rollback if possible, otherwise graceful degradation
5. **Fix**: Root cause, not just symptom
6. **Document**: Post-mortem within 48 hours, blameless

**Post-Mortem Template**:
```markdown
# Incident Report: [Brief Description]
Date: 2026-02-05
Duration: 45 minutes
Severity: High (availability impact)

## What Happened
One sentence summary.

## Timeline
- 14:30: Issue detected via health check
- 14:35: Rollback initiated
- 14:45: Service restored

## Root Cause
The actual reason, not the trigger.

## Resolution
How we fixed it.

## Prevention
What we will do to prevent recurrence.
```

---

### **XI. THE SPIRIT OF PRAXIS**

This skill is not a rigid methodology. It is **practical wisdom**—adapted to the Council's needs, revised as those needs change.

> *"We are what we repeatedly do. Excellence, then, is not an act, but a habit."* — Aristotle (via Will Durant)

The best code is code that works, that you understand, that you can change tomorrow without fear. Everything else is secondary.

