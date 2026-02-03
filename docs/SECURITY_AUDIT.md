# Moltbot-Philosopher Security Audit Report
**Date:** 2026-02-03  
**Auditor:** Claude Code (Automated + Manual Review)  
**Scope:** Full containerized deployment stack

---

## Executive Summary

| Category | Rating | Issues Found |
|----------|--------|--------------|
| Secrets Management | ⚠️ MEDIUM | 2 issues |
| Container Security | ✅ GOOD | 1 minor issue |
| Network Security | ✅ GOOD | 0 issues |
| Script Security | ⚠️ MEDIUM | 3 issues |
| Access Control | ⚠️ MEDIUM | 2 issues |
| **OVERALL** | **⚠️ MEDIUM** | **8 issues** |

---

## 1. Secrets Management

### ✅ Good Practices
- [x] `.env` file properly gitignored
- [x] API keys use environment variables (no hardcoding)
- [x] Docker compose uses `${VAR}` syntax for secrets
- [x] No secrets found in logs or state files

### ⚠️ Issues Found

#### Issue 1.1: Scripts Attempt to Read Host Filesystem (HIGH)
**Location:** Multiple scripts (`check-mentions.sh`, `get-comments.sh`, etc.)  
**Problem:** Scripts attempt fallback to `~/.config/moltbook/credentials.json` which:
- Doesn't exist in containers (read-only filesystem)
- Attempts path traversal outside container
- Could expose host credentials if volumes misconfigured

```bash
API_KEY="${MOLTBOOK_API_KEY:-$(cat ~/.config/moltbook/credentials.json ...)}"
```

**Affected Scripts:**
- `check-mentions.sh`
- `comment-on-post.sh`
- `dm-approve-request.sh`
- `dm-check.sh`
- `dm-list-conversations.sh`
- `dm-send-message.sh`
- `dm-view-requests.sh`
- `follow-molty.sh`
- `follow-with-criteria.sh`
- `generate-post-ai.sh`
- `get-comments.sh`
- `list-submolts.sh`
- `reply-to-mention.sh`
- `search-moltbook.sh`
- `subscribe-submolt.sh`
- `upvote-post.sh`
- `view-profile.sh`

**Fix:** Remove fallback to host filesystem. Enforce env var only.

#### Issue 1.2: API Keys in Environment Files (LOW)
**Location:** `config/agents/*.env`  
**Problem:** Agent-specific env files contain API keys that could be committed accidentally.

**Fix:** Use `.env` only; remove keys from `config/agents/` files.

---

## 2. Container Security

### ✅ Good Practices
- [x] Non-root user (`user: "1000:1000"`)
- [x] Read-only root filesystem (`read_only: true`)
- [x] Capability dropping (`cap_drop: ALL`)
- [x] No new privileges (`security_opt: no-new-privileges:true`)
- [x] Resource limits (memory, CPU, PIDs)
- [x] No privileged containers
- [x] Multi-stage builds in Dockerfiles

### ⚠️ Issues Found

#### Issue 2.1: Scripts World-Writable in Containers (MEDIUM)
**Location:** Agent containers  
**Problem:** Scripts volume mounted as `:ro` (read-only) but permissions on host are `755`/`777`.

**Current:**
```bash
-rwxrwxr-x scripts/*.sh
```

**Fix:** Restrict to `755` owner-only write:
```bash
chmod 755 scripts/*.sh
chown $(id -u):$(id -g) scripts/*.sh
```

---

## 3. Network Security

### ✅ Good Practices
- [x] Egress proxy controls outbound connections
- [x] Only whitelisted hosts (Venice, Kimi, Moltbook, NTFY)
- [x] Internal Docker network (`moltbook-network`)
- [x] No host network mode
- [x] Port mappings explicit and minimal

### Findings
No network security issues identified.

---

## 4. Script Security

### ✅ Good Practices
- [x] `set -euo pipefail` in most scripts
- [x] No `eval()` usage
- [x] No `sudo` usage
- [x] Input validation present

### ⚠️ Issues Found

#### Issue 4.1: Potential Command Injection via Variables (MEDIUM)
**Location:** Multiple scripts  
**Problem:** Variables used in curl commands without proper quoting.

**Example in `generate-post.sh`:**
```bash
curl -s -X "$1" "${API_BASE}$2"  # $1 and $2 not validated
```

**Fix:** Validate inputs before use:
```bash
case "$1" in
  GET|POST|PUT|DELETE) ;;  # Valid methods
  *) echo "Invalid method"; exit 1 ;;
esac
```

#### Issue 4.2: Path Traversal Risk (LOW)
**Location:** `check-mentions.sh`, `entrypoint.sh`  
**Problem:** Use of `/tmp` for temporary files.

**Fix:** Use mktemp for secure temp files:
```bash
TMPFILE=$(mktemp)
trap 'rm -f "$TMPFILE"' EXIT
```

#### Issue 4.3: Missing Input Sanitization (MEDIUM)
**Location:** `comment-on-post.sh`, `dm-send-message.sh`  
**Problem:** User content passed directly to API without sanitization.

**Fix:** JSON-encode user input:
```bash
CONTENT=$(jq -n --arg c "$content" '$c')
```

---

## 5. Access Control

### ✅ Good Practices
- [x] Non-root container execution
- [x] tmpfs with noexec,nosuid for `/tmp`
- [x] Volume mounts use `:ro` where appropriate

### ⚠️ Issues Found

#### Issue 5.1: State Files World-Readable/Writable (MEDIUM)
**Location:** `workspace/` directories  
**Problem:** State files have `777`/`666` permissions:

```bash
-rwxrwxrwx 1 ubuntu ubuntu ... workspace/thread-continuation/...
-rw-rw-rw- 1 ubuntu ubuntu ... workspace/daily-polemic/...
```

**Risk:** Any container user can read/modify other agents' state.

**Fix:**
```bash
chmod 750 workspace/*/
chmod 640 workspace/*/*.json
```

#### Issue 5.2: Logs Directory Writable (LOW)
**Location:** `logs/`  
**Problem:** Logs are writable by all containers.

**Fix:** Separate log volumes per service with restricted permissions.

---

## 6. Logging & Data Exposure

### ✅ Good Practices
- [x] No API keys in log files
- [x] Structured JSON logging
- [x] No PII in NTFY notifications

### Findings
No sensitive data exposure in logs identified.

---

## 7. Dependency Security

### Status: NOT VERIFIED
NPM audit could not run (dependencies not installed locally).

**Recommendation:**
```bash
cd services/ai-content-generator && npm audit
cd services/model-router && npm audit
cd services/ntfy-publisher && npm audit
cd services/thread-monitor && npm audit
```

---

## Recommendations Summary

### High Priority (Fix Immediately)
1. **Remove host filesystem fallback** from 17 scripts ✅ FIXED
2. **Fix state file permissions** (777 → 750) ✅ FIXED
3. **Migrate secrets to Bitwarden Secrets** ✅ COMPLETED

### Medium Priority (Fix Soon)
3. **Add input validation** to curl commands
4. **JSON-encode user content** before API calls
5. **Secure temp file creation** with mktemp

### Low Priority (Best Practice)
6. **Remove API keys** from `config/agents/*.env` ✅ DONE (via Bitwarden)
7. **Separate log volumes** per service
8. **Run npm audit** on all services
9. **Delete .env.backup files** after verifying Bitwarden export works

---

## Quick Fix Commands

```bash
# Fix script permissions
chmod 755 scripts/*.sh

# Fix state file permissions
find workspace/ -type f -exec chmod 640 {} \;
find workspace/ -type d -exec chmod 750 {} \;

# Remove host filesystem fallback (example)
sed -i '/~\/.config\/moltbook/d' scripts/*.sh
```

---

## Compliance Checklist

| Standard | Status |
|----------|--------|
| CIS Docker Benchmark | ⚠️ Partial (file permissions need fix) |
| OWASP Top 10 (2021) | ⚠️ A01:2021-Broken Access Control (file perms) |
| NIST SP 800-190 | ⚠️ Partial (secrets handling) |
| SOC 2 Type II | ⚠️ Partial (access controls) |

---

*Report generated: 2026-02-03*  
*Next audit recommended: After high-priority fixes*
