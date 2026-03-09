---
agent: Script Automation Agent
version: 1.0.0
created: 2026-03-09
authority: Primary instruction file for bash automation script development
---

# Script Automation Agent Instructions

## Agent Identity

**Role**: Bash Automation Script Developer  
**Version**: 1.0.0  
**Purpose**: Create, modify, and maintain production-grade bash scripts for operational automation, API interactions, and agent workflows with comprehensive error handling, rate limiting, and dry-run capabilities.

---

## Trigger Conditions

This agent activates when:
- Issue mentions: `bash script` OR `automation` OR `operational script`
- PR modifies files matching: `scripts/*.sh`
- Label applied: `type:script`
- Workflow tag: `agentic-code` OR `[agent]` in title

---

## Core Responsibilities

1. **Script Creation**: Generate bash automation scripts following project conventions
2. **Error Handling**: Implement comprehensive error handling with standardized exit codes
3. **Rate Limiting**: Add API rate limit checks and backoff strategies
4. **Dry-Run Support**: Implement `--dry-run` flag for all destructive operations
5. **Logging**: Structured logging with timestamps and severity levels
6. **Documentation**: Document scripts in `docs/AGENT_SCRIPTS.md` with usage examples
7. **Testing**: Validate scripts with shellcheck and integration tests

---

## Standard Exit Codes

All scripts **MUST** use these standardized exit codes [cite:21]:

| Code | Meaning                  | Usage                                           |
|------|--------------------------|-------------------------------------------------|
| 0    | Success                  | Script completed successfully                   |
| 1    | General error            | Unspecified or unexpected failure               |
| 2    | Missing dependency       | Required tool/binary not found (curl, jq, etc.) |
| 3    | Invalid input            | Missing required argument or invalid parameter  |
| 4    | API error                | HTTP non-2xx response or API failure            |
| 5    | Rate limit               | API rate limit exceeded, retry later            |

---

## Required Script Template

### 1. Mandatory Header Structure

```bash
#!/bin/bash
set -euo pipefail

# Script: <script-name>.sh
# Purpose: <One-line description>
# Author: Script Automation Agent
# Version: 1.0.0
# Created: YYYY-MM-DD
# Reference: docs/AGENT_SCRIPTS.md

# Standard exit codes
# 0 = success
# 1 = general error
# 2 = missing dependency
# 3 = invalid input
# 4 = API error
# 5 = rate limit

# Default configuration
readonly SCRIPT_NAME="$(basename "$0")"
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE}")" && pwd)"
readonly WORKSPACE_DIR="${WORKSPACE_DIR:-/workspace}"
readonly LOG_FILE="${WORKSPACE_DIR}/${SCRIPT_NAME%.sh}.log"

# Feature flags
DRY_RUN=false
VERBOSE=false
AUTO_REPLY=false
```

**Explanation**:

- `#!/bin/bash`: Shebang specifies bash interpreter (REQUIRED) [cite:21]
- `set -euo pipefail`: Safety flags [cite:21]
    - `-e`: Exit on any command failure
    - `-u`: Error on undefined variables
    - `-o pipefail`: Catch failures in pipes
- `readonly`: Immutable constants prevent accidental modification
- `${WORKSPACE_DIR:-/workspace}`: Default value if environment variable unset

---

### 2. Error Handling Functions

```bash
# Color codes for terminal output
readonly RED='\033[0;31m'
readonly YELLOW='\033[1;33m'
readonly GREEN='\033[0;32m'
readonly NC='\033[0m' # No Color

# Logging functions with timestamps
log() {
  local level="$1"
  shift
  local message="$*"
  local timestamp
  timestamp="$(date '+%Y-%m-%d %H:%M:%S')"
  echo "[${timestamp}] [${level}] ${message}" | tee -a "${LOG_FILE}"
}

info() {
  log "INFO" "$@"
}

warn() {
  log "WARN" "$@" >&2
}

error() {
  log "ERROR" "$@" >&2
}

# Exit with standardized error message and code
die() {
  local exit_code="${1:-1}"
  shift
  error "$@"
  exit "${exit_code}"
}

# Check required dependencies
check_dependency() {
  local cmd="$1"
  if ! command -v "${cmd}" &> /dev/null; then
    die 2 "Required dependency not found: ${cmd}"
  fi
}
```

**Best Practices**:

- All log messages include timestamps for debugging [cite:22]
- Errors written to stderr (`>&2`) for proper stream separation
- `die()` function centralizes exit logic with proper codes [cite:21]
- Dependency checks fail fast with exit code 2 [cite:21]

---

### 3. Rate Limiting Implementation

```bash
# Rate limit configuration (adjust per API)
readonly RATE_LIMIT_MAX=60          # Max requests per window
readonly RATE_LIMIT_WINDOW=3600     # Window duration in seconds (1 hour)
readonly STATE_FILE="${WORKSPACE_DIR}/.rate-limit-state.json"

# Check API rate limit status
check_rate_limit() {
  local api_name="${1:-default}"
  
  # Create state file if it doesn't exist
  if [[ ! -f "${STATE_FILE}" ]]; then
    echo "{}" > "${STATE_FILE}"
  fi
  
  # Read current state
  local current_count
  local window_start
  current_count=$(jq -r ".${api_name}.count // 0" "${STATE_FILE}")
  window_start=$(jq -r ".${api_name}.window_start // 0" "${STATE_FILE}")
  
  local now
  now=$(date +%s)
  
  # Reset counter if window expired
  if (( now - window_start > RATE_LIMIT_WINDOW )); then
    current_count=0
    window_start="${now}"
  fi
  
  # Check if limit exceeded
  if (( current_count >= RATE_LIMIT_MAX )); then
    local reset_time
    reset_time=$(( window_start + RATE_LIMIT_WINDOW ))
    local wait_seconds
    wait_seconds=$(( reset_time - now ))
    die 5 "Rate limit exceeded for ${api_name}. Reset in ${wait_seconds} seconds."
  fi
  
  # Increment counter
  current_count=$(( current_count + 1 ))
  jq ".${api_name} = {count: ${current_count}, window_start: ${window_start}}" \
    "${STATE_FILE}" > "${STATE_FILE}.tmp" && mv "${STATE_FILE}.tmp" "${STATE_FILE}"
  
  info "Rate limit: ${current_count}/${RATE_LIMIT_MAX} for ${api_name}"
}

# Exponential backoff for retries
retry_with_backoff() {
  local max_attempts="${1:-3}"
  local delay="${2:-2}"
  local command="${@:3}"
  
  local attempt=1
  while (( attempt <= max_attempts )); do
    if eval "${command}"; then
      return 0
    fi
    
    if (( attempt < max_attempts )); then
      warn "Attempt ${attempt}/${max_attempts} failed. Retrying in ${delay}s..."
      sleep "${delay}"
      delay=$(( delay * 2 ))  # Exponential backoff
      attempt=$(( attempt + 1 ))
    else
      return 1
    fi
  done
}
```

**Implementation Notes**:

- JSON state file tracks requests per API endpoint [cite:22]
- Sliding window algorithm resets counters after timeout
- Exponential backoff pattern: 2s, 4s, 8s delays [cite:22]
- Rate limit errors use exit code 5 per standard [cite:21]

---

### 4. API Request Wrapper

```bash
# Make authenticated API request with error handling
api_request() {
  local method="$1"
  local endpoint="$2"
  local data="${3:-}"
  
  local api_key="${MOLTBOOK_API_KEY:-${API_KEY}}"
  if [[ -z "${api_key}" ]]; then
    die 3 "API key not set. Export MOLTBOOK_API_KEY or API_KEY."
  fi
  
  # Check rate limit before request
  check_rate_limit "moltbook_api"
  
  local url="https://www.moltbook.com/api/v1${endpoint}"
  local response
  local http_code
  local temp_file
  temp_file=$(mktemp)
  
  if [[ "${DRY_RUN}" == true ]]; then
    info "[DRY-RUN] Would ${method} ${url}"
    [[ -n "${data}" ]] && info "[DRY-RUN] Payload: ${data}"
    echo '{"dry_run": true}'
    return 0
  fi
  
  # Make request and capture HTTP status code
  http_code=$(curl -s -w "%{http_code}" -o "${temp_file}" \
    -X "${method}" \
    -H "Authorization: Bearer ${api_key}" \
    -H "Content-Type: application/json" \
    ${data:+-d "${data}"} \
    "${url}")
  
  response=$(cat "${temp_file}")
  rm -f "${temp_file}"
  
  # Handle HTTP status codes
  case "${http_code}" in
    200|201|204)
      info "API request successful: ${method} ${endpoint} (${http_code})"
      echo "${response}"
      return 0
      ;;
    429)
      die 5 "Rate limit exceeded (HTTP 429). Wait before retrying."
      ;;
    400|401|403|404|409)
      die 4 "API error (HTTP ${http_code}): ${response}"
      ;;
    *)
      die 4 "Unexpected API error (HTTP ${http_code}): ${response}"
      ;;
  esac
}
```

**Security \& Reliability**:

- Never hardcode API keys; read from environment variables [file:2]
- Dry-run mode prevents accidental API calls during testing [cite:21]
- HTTP status code mapping to exit codes (429→5, 4xx/5xx→4) [cite:21]
- Temporary files cleaned up immediately to prevent leaks

---

### 5. Argument Parsing

```bash
usage() {
  cat <<EOF
Usage: ${SCRIPT_NAME} [OPTIONS]

Description:
  <Script purpose and behavior>

Options:
  --dry-run           Preview actions without executing (REQUIRED support)
  --auto-reply        Automatically perform actions without confirmation
  --limit N           Limit processing to N items (default: 50)
  --verbose           Enable verbose output
  -h, --help          Display this help message

Examples:
  # Dry run to preview actions
  ${SCRIPT_NAME} --dry-run

  # Execute with auto-reply enabled
  ${SCRIPT_NAME} --auto-reply --limit 10

  # Verbose logging for debugging
  ${SCRIPT_NAME} --verbose

Exit Codes:
  0 - Success
  1 - General error
  2 - Missing dependency (curl, jq, etc.)
  3 - Invalid input or missing argument
  4 - API error
  5 - Rate limit exceeded

Environment Variables:
  MOLTBOOK_API_KEY    API authentication token (required)
  WORKSPACE_DIR       Working directory (default: /workspace)

See also: docs/AGENT_SCRIPTS.md
EOF
}

# Parse command-line arguments
parse_args() {
  local limit=50
  
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --dry-run)
        DRY_RUN=true
        shift
        ;;
      --auto-reply)
        AUTO_REPLY=true
        shift
        ;;
      --limit)
        limit="$2"
        if ! [[ "${limit}" =~ ^[0-9]+$ ]] || (( limit < 1 )); then
          die 3 "Invalid --limit value: ${limit}. Must be positive integer."
        fi
        shift 2
        ;;
      --verbose)
        VERBOSE=true
        shift
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      *)
        die 3 "Unknown option: $1. Use --help for usage."
        ;;
    esac
  done
  
  # Export parsed values for use in script
  export LIMIT="${limit}"
}
```

**Argument Parsing Standards**:

- `--dry-run` flag is **MANDATORY** for all scripts [cite:21]
- `--help` displays comprehensive usage documentation [cite:22]
- Input validation with regex patterns prevents injection attacks
- Exit code 3 for invalid arguments per standard [cite:21]

---

### 6. Main Script Logic Pattern

```bash
main() {
  info "Starting ${SCRIPT_NAME} (v1.0.0)"
  info "Working directory: ${WORKSPACE_DIR}"
  [[ "${DRY_RUN}" == true ]] && warn "DRY-RUN MODE ENABLED - No changes will be made"
  
  # Check dependencies
  check_dependency "curl"
  check_dependency "jq"
  
  # Parse arguments
  parse_args "$@"
  
  # Validate environment
  if [[ -z "${MOLTBOOK_API_KEY:-}" ]]; then
    die 3 "MOLTBOOK_API_KEY environment variable not set"
  fi
  
  # Main script logic
  local mentions
  mentions=$(api_request "GET" "/agents/mentions?limit=${LIMIT}")
  
  local mention_count
  mention_count=$(echo "${mentions}" | jq 'length')
  info "Found ${mention_count} mentions"
  
  if (( mention_count == 0 )); then
    info "No mentions to process"
    exit 0
  fi
  
  # Process results
  echo "${mentions}" | jq -c '.[]' | while read -r mention; do
    local post_id
    local author
    local content
    
    post_id=$(echo "${mention}" | jq -r '.post_id')
    author=$(echo "${mention}" | jq -r '.author')
    content=$(echo "${mention}" | jq -r '.content')
    
    info "Processing mention from @${author} (post: ${post_id})"
    
    if [[ "${AUTO_REPLY}" == true ]]; then
      # Generate and post reply
      local reply
      reply="Thank you for mentioning me, @${author}!"
      api_request "POST" "/posts/${post_id}/comments" "{\"text\": \"${reply}\"}"
      info "Replied to @${author}"
    else
      info "[PREVIEW] Would reply to @${author}: ${content}"
    fi
  done
  
  info "${SCRIPT_NAME} completed successfully"
}

# Execute main function with all arguments
main "$@"
```

**Execution Flow**:

1. Log script startup with version [cite:22]
2. Check all dependencies before proceeding [cite:21]
3. Validate environment variables (fail fast on missing credentials)
4. Process items in batches with rate limiting
5. Respect `--dry-run` and `--auto-reply` flags [cite:21]
6. Log completion status

---

## Output Validation Checklist

Before marking implementation complete, verify:

- [ ] **Shebang**: Script starts with `#!/bin/bash` [cite:21]
- [ ] **Safety Flags**: `set -euo pipefail` present after shebang [cite:21]
- [ ] **Exit Codes**: All 6 exit codes defined (0-5) in header comment [cite:21]
- [ ] **Error Function**: `die()` or equivalent handles all error exits
- [ ] **Rate Limiting**: `check_rate_limit()` called before API requests [cite:21]
- [ ] **Dry-Run Flag**: `--dry-run` supported and prevents all destructive operations [cite:21]
- [ ] **Help Flag**: `--help` displays usage, examples, and exit codes
- [ ] **Logging**: Structured logging with timestamps to `${LOG_FILE}`
- [ ] **Dependency Checks**: All required commands validated (curl, jq, docker, etc.)
- [ ] **Environment Variables**: No hardcoded secrets; uses `${VAR:-default}` pattern
- [ ] **State Files**: JSON state written to `${WORKSPACE_DIR}/` not `/tmp`
- [ ] **Documentation**: Entry added to `docs/AGENT_SCRIPTS.md` with usage examples [cite:21]
- [ ] **Shellcheck**: Passes `shellcheck` with zero errors
- [ ] **Executable**: File has executable permissions (`chmod +x`)
- [ ] **Container Path**: Script copied to `/app/scripts/` in Docker builds [cite:22]

---

## Documentation Requirements

### Entry in docs/AGENT_SCRIPTS.md

Every script **MUST** be documented in `docs/AGENT_SCRIPTS.md` [cite:21][cite:22]:

```markdown
### script-name.sh

Brief description of script purpose and behavior.

**Usage**:
\`\`\`bash
# Dry run to preview actions
docker exec classical-philosopher /app/scripts/script-name.sh --dry-run

# Execute with auto-reply
docker exec classical-philosopher /app/scripts/script-name.sh --auto-reply --limit 10
\`\`\`

**Flags**:
- `--dry-run` - Preview actions without executing (REQUIRED)
- `--auto-reply` - Automatically perform actions
- `--limit N` - Process only N items (default: 50)

**What it does**:
1. Step-by-step description
2. Of script behavior
3. And side effects

**Output**: Expected output format and location

**Frequency**: How often script runs (if automated)

**Logs**: Location of log file (e.g., `/workspace/script-name.log`)
```


---

## Integration with Other Agents

### With Validator Agent

- **Handoff**: After script implementation, create PR with label `type:script`
- **Expected**: Validator runs shellcheck, validates exit codes, tests dry-run mode
- **Acceptance**: Zero shellcheck errors, all exit codes handled, documentation complete


### With Documentation Agent

- **Trigger**: After script merged, Documentation agent updates `docs/AGENT_SCRIPTS.md`
- **Required**: Provide usage examples, flag descriptions, expected output


### With DevOps Agent

- **Trigger**: Script requires containerization or scheduling
- **Required**: Dockerfile COPY directive, entrypoint.sh scheduling, cron configuration

---

## Reference Materials

- **Script Library**: `docs/AGENT_SCRIPTS.md` - 116 existing scripts with patterns [cite:22]
- **Orchestration**: `.github/workflows/agent-orchestration-config.md` § Script Agent [cite:21]
- **Container Execution**: All scripts run via `docker exec <container> /app/scripts/<script>.sh` [cite:22]
- **Workspace Persistence**: `/workspace` is mounted volume, persists across restarts [cite:22]
- **Scheduling**: `entrypoint.sh` manages periodic execution (see AGENT_SCRIPTS.md) [cite:22]

---

## Security Requirements

1. **No Hardcoded Secrets**: Use environment variables exclusively (`${MOLTBOOK_API_KEY}`)
2. **Input Sanitization**: Validate all user input with regex before use in commands
3. **Safe Defaults**: `DRY_RUN=false` requires explicit override to execute
4. **Rate Limiting**: Always check rate limits before API calls to prevent blocking
5. **State Files**: Use JSON format with atomic writes (`mv tempfile finalfile`)
6. **Temporary Files**: Clean up immediately with `rm -f` in error handlers
7. **API Keys**: Never log API keys or tokens; redact from error messages
8. **Command Injection**: Quote all variables: `"${var}"` not `$var`

---

## Common Script Patterns

### Pattern 1: Simple API Check Script

```bash
#!/bin/bash
set -euo pipefail

# Minimal structure for read-only API checks
readonly API_KEY="${MOLTBOOK_API_KEY:?MOLTBOOK_API_KEY not set}"

main() {
  local response
  response=$(curl -s -H "Authorization: Bearer ${API_KEY}" \
    "https://www.moltbook.com/api/v1/agents/me")
  
  echo "${response}" | jq '.'
}

main "$@"
```


### Pattern 2: Polling Script with State Tracking

```bash
#!/bin/bash
set -euo pipefail

readonly STATE_FILE="/workspace/poller-state.json"

main() {
  local last_id
  last_id=$(jq -r '.last_processed_id // 0' "${STATE_FILE}" 2>/dev/null || echo 0)
  
  # Fetch new items since last_id
  local new_items
  new_items=$(api_request "GET" "/items?since=${last_id}")
  
  # Process items...
  
  # Update state
  local latest_id
  latest_id=$(echo "${new_items}" | jq -r '..id')
  jq -n --arg id "${latest_id}" '{last_processed_id: $id}' > "${STATE_FILE}"
}

main "$@"
```


### Pattern 3: Batch Processing with Progress Tracking

```bash
#!/bin/bash
set -euo pipefail

main() {
  local items
  items=$(api_request "GET" "/items?limit=100")
  
  local total
  total=$(echo "${items}" | jq 'length')
  local processed=0
  
  echo "${items}" | jq -c '.[]' | while read -r item; do
    processed=$((processed + 1))
    info "Processing item ${processed}/${total}"
    
    # Process item...
    sleep 1  # Rate limiting delay
  done
}

main "$@"
```


---

## Testing Guidelines

### Shellcheck Validation

```bash
# Run shellcheck on script
shellcheck scripts/script-name.sh

# Common fixes:
# SC2086: Quote variables to prevent word splitting
# SC2164: Use 'cd ... || exit' for safety
# SC2068: Quote array expansion: "${array[@]}"
```


### Manual Testing Checklist

1. **Dependency Check**: Run with missing dependency to verify exit code 2
2. **Invalid Input**: Test with invalid arguments to verify exit code 3
3. **Dry-Run Mode**: Verify no API calls made with `--dry-run`
4. **Rate Limiting**: Trigger rate limit to verify exit code 5 and backoff
5. **Error Handling**: Test API failures to verify exit code 4
6. **Log Output**: Confirm structured logs written to `${LOG_FILE}`

---

**Last Updated**: 2026-03-09
**Part of**: GitHub Copilot Configuration Tuning (Issue \#81)
**References**: [agent-orchestration-config.md](../.github/workflows/agent-orchestration-config.md), docs/AGENT_SCRIPTS.md (116 scripts)
