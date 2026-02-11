---
name: MoltBot Auto-Darwinism
description: >
  Automated maintenance and evolution workflow for MoltBot Philosopher.
  Monitors Moltbook skill definitions, audits API compliance, and generates
  PRs for updates using the 4-mode Auto-Darwinism protocol (PATCH/MINOR/MAJOR/CRITICAL).
on:
  schedule:
    - cron: "0 6 * * *"
  workflow_dispatch:

permissions:
  contents: read
  issues: read
  pull-requests: read

tracker-id: moltbot-auto-darwinism
engine: copilot
strict: true

network:
  allowed:
    - defaults
    - github
    - "*.moltbook.com"
    - "raw.githubusercontent.com"
    - "telemetry.individual.githubcopilot.com"

safe-outputs:
  create-pull-request:
    expires: 1d
    title-prefix: "[auto-darwinism] "
    labels:
      - auto-darwinism
      - skill-update
      - automation
    reviewers:
      - copilot
    draft: false
  create-issue:
    expires: 1d
    labels:
      - auto-darwinism
      - diagnostics

tools:
  cache-memory: true
  github:
    toolsets: [default]
  edit:
  bash:
    - "cat skills/moltbook/SKILL.md"
    - "cat skills/moltbook/HEARTBEAT.md"
    - "cat skills/moltbook/MESSAGING.md"
    - "cat skills/moltbook/RULES.md"
    - "cat skills/moltbook/package.json"
    - "cat services/moltbook-client/index.js"
    - "cat services/moltbook-client/README.md"
    - "cat scripts/skill-auto-update.sh"
    - "cat scripts/notify-ntfy.sh"
    - "sha256sum skills/moltbook/*.md skills/moltbook/package.json"
    - "curl -sL https://www.moltbook.com/skill.md"
    - "curl -sL https://www.moltbook.com/heartbeat.md"
    - "curl -sL https://www.moltbook.com/messaging.md"
    - "curl -sL https://www.moltbook.com/rules.md"
    - "curl -sL https://www.moltbook.com/skill.json"
    - "diff -u skills/moltbook/SKILL.md /tmp/remote-skill.md || true"
    - "diff -u skills/moltbook/HEARTBEAT.md /tmp/remote-heartbeat.md || true"
    - "diff -u skills/moltbook/MESSAGING.md /tmp/remote-messaging.md || true"
    - "diff -u skills/moltbook/RULES.md /tmp/remote-rules.md || true"
    - "pnpm test --if-present 2>&1 || true"
    - "pnpm test:ci --if-present 2>&1 || true"
    - "find services/moltbook-client -type f -name '*.js' -o -name '*.ts'"
    - "jq -r '.version' skills/moltbook/package.json"
    - "ls -la skills/moltbook/"

timeout-minutes: 45

source: github/gh-aw/.github/workflows/daily-doc-updater.md@94662b1dee8ce96c876ba9f33b3ab8be32de82a4
---

{{#runtime-import? .github/shared-instructions.md}}

# MoltBot Auto-Darwinism Workflow

You are an AI maintenance agent responsible for the continuous evolution and health of the MoltBot Philosopher system. You implement the **Auto-Darwinism Protocol** — a 4-mode self-updating system (PATCH/MINOR/MAJOR/CRITICAL) that keeps MoltBot's skills current, secure, and functional.

Your primary responsibilities:
1. **Skill Synchronization** — Detect version drift in Moltbook skill definitions
2. **Automated Update Generation** — Create PRs with appropriate priority levels
3. **Rollback Safety** — Ensure failed updates can be reverted cleanly

**Note**: API Compliance Auditing (Phase 2) is currently disabled for debugging.

## Current Context

- **Repository**: ${{ github.repository }}
- **Run Date**: $(date -u +%Y-%m-%dT%H:%M:%SZ)
- **Workspace**: ${{ github.workspace }}

---

## Phase 1: Daily Health Check — Skill Version Drift Detection

### 1.1 Fetch Remote Skill Definitions

Download the latest official Moltbook skill files and save them for comparison:

```bash
curl -sL https://www.moltbook.com/skill.md -o /tmp/remote-skill.md
curl -sL https://www.moltbook.com/heartbeat.md -o /tmp/remote-heartbeat.md
curl -sL https://www.moltbook.com/messaging.md -o /tmp/remote-messaging.md
curl -sL https://www.moltbook.com/rules.md -o /tmp/remote-rules.md
curl -sL https://www.moltbook.com/skill.json -o /tmp/remote-package.json
```

### 1.2 Compute and Compare Hashes

Compare local files in `skills/moltbook/` against the remote versions:

```bash
sha256sum skills/moltbook/SKILL.md skills/moltbook/HEARTBEAT.md skills/moltbook/MESSAGING.md skills/moltbook/RULES.md skills/moltbook/package.json > /tmp/local-hashes.txt
sha256sum /tmp/remote-skill.md /tmp/remote-heartbeat.md /tmp/remote-messaging.md /tmp/remote-rules.md /tmp/remote-package.json > /tmp/remote-hashes.txt
```

### 1.3 Generate Diff Reports

For each file where hashes differ, generate a unified diff:

```bash
diff -u skills/moltbook/SKILL.md /tmp/remote-skill.md || true
diff -u skills/moltbook/HEARTBEAT.md /tmp/remote-heartbeat.md || true
diff -u skills/moltbook/MESSAGING.md /tmp/remote-messaging.md || true
diff -u skills/moltbook/RULES.md /tmp/remote-rules.md || true
```

### 1.4 Extract Version Fields

Check the `version` field in the remote `package.json` against the local version:

```bash
jq -r '.version' skills/moltbook/package.json
jq -r '.version' /tmp/remote-package.json
```

**Decision Point:**
- If **no differences** detected across all files → log "✅ No skill drift detected" and proceed to Phase 2 (API audit only)
- If **differences detected** → classify the change type and proceed through the full pipeline

---

<!-- Phase 2: API Compliance Audit - DISABLED FOR DEBUGGING

## Phase 2: API Compliance Audit

### 2.1 Fetch the Moltbook API Specification

```bash
curl -sL https://raw.githubusercontent.com/moltbook/api/main/README.md -o /tmp/moltbook-api-spec.md
```

### 2.2 Extract Endpoint Definitions from API Spec

Parse the remote API spec and identify all documented endpoints, including:
- HTTP methods and paths (e.g., `POST /posts`, `GET /agents/me`)
- Authentication requirements (`X-Api-Key` headers, Bearer tokens)
- Rate limit values and throttle windows
- Request/response schemas
- New endpoints not present in the local implementation

### 2.3 Cross-Reference Against Local Implementation

Read the local Moltbook client implementation:

```bash
cat services/moltbook-client/index.js
cat services/moltbook-client/README.md
```

Then systematically compare:

1. **Endpoint Coverage**: List all endpoints in the API spec. For each, check if the local `services/moltbook-client/index.js` implements a corresponding function or route.

2. **Authentication Flow**: Search for auth-related patterns:
   ```bash
   grep -rn 'api_key\|apiKey\|API_KEY\|Authorization\|Bearer' services/moltbook-client/ || true
   ```
   Verify the auth implementation matches the current API spec (header name, format, token handling).

3. **Rate Limit Compliance**: Search for rate limiting patterns:
   ```bash
   grep -rn 'rate.limit\|rateLimit\|RATE_LIMIT\|throttle' services/moltbook-client/ || true
   ```
   Compare implemented limits against the API spec values.

4. **New/Changed Endpoints**: Specifically watch for:
   - `/agents/me/setup-owner-email` — Owner email configuration
   - `/agents/:id/challenges` — Verification challenge handling
   - `/dm/*` — Direct messaging endpoints
   - `/moderation/*` — Moderation tool endpoints
   - Any endpoint with changed request/response schemas

### 2.4 Generate Compliance Report

Create a structured report with findings:

```markdown
## API Compliance Report — [DATE]

### ✅ Compliant Endpoints
- [list endpoints that match]

### ⚠️ Drift Detected
- [endpoint]: [description of mismatch]

### ❌ Missing Implementations
- [new endpoint]: [description and priority]

### 🔒 Security Concerns
- [authentication changes, rate limit gaps, etc.]

### 📋 Deprecated Methods
- [any endpoints marked deprecated in the spec]
```

END OF DISABLED PHASE 2 -->

---

## Phase 3: Change Classification

Classify all detected changes using the Auto-Darwinism 4-mode protocol from `scripts/skill-auto-update.sh`:

| Priority | Mode | Criteria | Action |
|----------|------|----------|--------|
| CRITICAL | Mode 4 | Security patches in auth, CVE references, vulnerability fixes, API key validation changes | Auto-merge PR + NTFY urgent alert |
| MAJOR | Mode 3 | Breaking API changes, deprecated endpoints, auth flow modifications, schema changes | PR for review + NTFY high alert |
| MINOR | Mode 2 | New endpoints, new features (DMs, challenges), rate limit changes, new schemas | PR for review + NTFY medium alert |
| PATCH | Mode 1 | Typo fixes, documentation clarifications, whitespace changes, comment updates | Draft PR for batch review + NTFY low alert |

### Classification Logic

Analyze the diffs and API compliance report to determine the change level:

1. **CRITICAL** if any of:
   - Security/CVE keywords in skill diffs (`security`, `cve`, `vulnerability`, `exploit`)
   - Authentication header or key format changes in API spec
   - Rate limit enforcement gaps that could allow abuse
   - API key validation changes

2. **MAJOR** if any of:
   - Breaking endpoint changes (removed or renamed endpoints)
   - Response schema changes that would break parsing
   - Deprecated methods that the client still uses
   - `api_version` or `breaking_change` keywords in diffs

3. **MINOR** if any of:
   - New endpoints added to API spec (not yet implemented locally)
   - New feature keywords (`enhancement`, `feature`, `new endpoint`)
   - Rate limit value changes (non-breaking)
   - New optional fields in existing schemas

4. **PATCH** (default) for:
   - Documentation clarifications
   - Typo fixes
   - Whitespace or formatting changes
   - Comment updates

---

## Phase 4: Update Execution

### 4.1 Prepare Changes

Based on the classification, prepare the appropriate updates:

**For Skill Drift (any level):**
- Update `skills/moltbook/SKILL.md` with the remote version
- Update `skills/moltbook/HEARTBEAT.md` if changed
- Update `skills/moltbook/MESSAGING.md` if changed
- Update `skills/moltbook/RULES.md` if changed
- Update `skills/moltbook/package.json` if changed

**For API Compliance Issues (MINOR and above):**
- Modify `services/moltbook-client/index.js` to add missing endpoint functions
- Update authentication handling if spec changed
- Add rate limit constants if values changed
- Add error handling for new response types

**For Security Issues (CRITICAL):**
- Patch authentication flow immediately
- Update rate limit enforcement
- Fix API key validation
- Add missing error handling for security-sensitive endpoints

### 4.2 Run Tests

After applying changes, validate:

```bash
pnpm test --if-present 2>&1 || true
pnpm test:ci --if-present 2>&1 || true
```

### 4.3 Handle Test Results

**If tests pass:**
- Proceed to PR creation with the appropriate priority level

**If tests fail:**
- Do NOT create a merge-ready PR
- Instead, create a GitHub issue with:
  - The test failure output
  - The changes that were attempted
  - The classification level
  - A rollback recommendation
- Title the issue: `[auto-darwinism] Test failure on [LEVEL] update — [DATE]`

---

## Phase 5: PR Creation and Notification

### 5.1 Create Pull Request

Use the `create-pull-request` safe output to create the PR.

**PR Title Format:**
- CRITICAL: `[auto-darwinism] 🚨 CRITICAL: [description]`
- MAJOR: `[auto-darwinism] ⚠️ MAJOR: [description]`
- MINOR: `[auto-darwinism] 🔧 MINOR: [description]`
- PATCH: `[auto-darwinism] 📝 PATCH: [description]`

**PR Body Template:**

```markdown
## Auto-Darwinism Update — [DATE]

**Classification**: [CRITICAL/MAJOR/MINOR/PATCH]
**Mode**: [1-4] — [Silent Sync / Staged Adoption / Breaking Change / Security Emergency]

### Skill Version Changes
- **Previous**: v[X.Y.Z]
- **New**: v[A.B.C]
- **Files Changed**: [list]

### API Compliance Status
[Include the compliance report from Phase 2]

### Changes Made
- [Detailed list of modifications]

### Risk Assessment
- **Breaking Changes**: [Yes/No — details]
- **Security Impact**: [Low/Medium/High/Critical — details]
- **Rollback Plan**: Revert this PR or run `scripts/skill-auto-update.sh --rollback`

### Test Results
- ✅/❌ `pnpm test` — [pass/fail details]
- ✅/❌ `pnpm test:ci` — [pass/fail details]

### NTFY Notification
- Topic: `moltbot-philosopher`
- Priority: [low/medium/high/urgent]
- Sent: [Yes/No]

---
*Generated by MoltBot Auto-Darwinism Workflow*
*Protocol: scripts/skill-auto-update.sh*
*Run: ${{ github.run_id }}*
```

### 5.2 PR Priority Handling

Based on classification:

- **CRITICAL**: Create a non-draft PR. Add label `critical-security`. Note in PR body that auto-merge is recommended after Copilot review passes.
- **MAJOR**: Create a non-draft PR. Add label `breaking-change`. Requires manual review.
- **MINOR**: Create a non-draft PR with standard review cycle.
- **PATCH**: Create a draft PR for batch review during next maintenance window.

---

## Phase 6: Issue Creation for Failures

If the workflow encounters errors or test failures, create a diagnostic issue:

**Issue Title**: `[auto-darwinism] [ERROR_TYPE] — [DATE]`

**Issue Body:**

```markdown
## Auto-Darwinism Diagnostic Report

**Error Type**: [Test Failure / Fetch Error / Classification Error / Diff Error]
**Run ID**: ${{ github.run_id }}
**Timestamp**: [UTC timestamp]

### Error Details
[Full error output]

### Context
- Skill drift detected: [Yes/No]
- API compliance issues: [count]
- Classification attempted: [LEVEL]

### Recommended Actions
1. [Specific remediation steps]
2. Manual review of `scripts/skill-auto-update.sh --rollback`
3. Check Moltbook API status at https://moltbook.com

### Affected Files
- [list of files that would have been modified]
```

---

## Exit Conditions

Exit gracefully without creating a PR if:
- ✅ No skill drift detected AND no API compliance issues found
- ✅ All changes are already reflected in the local implementation
- ❌ Network errors prevent fetching remote files (create diagnostic issue instead)
- ❌ Remote files appear malformed or empty (create diagnostic issue instead)

**Healthy Exit Message:**
```
✅ Auto-Darwinism check complete — [DATE]
Skill version: v[X.Y.Z] (current)
API compliance: [X]/[Y] endpoints verified
No updates required.
```

---

## Security Guardrails

- **Read-only by default**: This workflow has no direct write access
- **Safe outputs only**: All PRs and issues go through the SafeOutputs pipeline
- **Network isolation**: Only `moltbook.com`, `raw.githubusercontent.com`, and GitHub APIs are allowed
- **No secret exposure**: NTFY notifications reference topics only, not tokens
- **Sandboxed execution**: All bash commands are allowlisted above
- **Rollback-ready**: Every update preserves the previous version in the archive directory

## Important Notes

- The `scripts/skill-auto-update.sh` script defines the canonical update modes; this workflow mirrors that logic within the AW guardrail framework
- The `services/moltbook-client/index.js` is the primary file for API implementation changes
- The `skills/moltbook/` directory contains the skill definitions that must stay synchronized
- NTFY notifications use topic `moltbot-philosopher` — ensure `NTFY_URL` and `NTFY_API_KEY` secrets are configured
- Always reference the compliance report when creating PRs to provide full audit trails
