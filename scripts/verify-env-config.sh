#!/bin/bash

##############################################################################
# Environment Configuration Verification Script
#
# Purpose: Validate Moltbot environment variables and configuration
# Usage: bash scripts/verify-env-config.sh [--check-only]
#
# Exit codes:
#   0 = All validations passed
#   1 = Validation failed (errors found)
#   2 = Usage error
##############################################################################

# Note: Using 'set +e' to handle errors manually instead of set -e
# to prevent early exit on validation failures
set -uo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
ERRORS=0
WARNINGS=0
PASSED=0

# Flags
CHECK_ONLY=false
VERBOSE=false

##############################################################################
# Helper Functions
##############################################################################

print_header() {
  echo -e "${BLUE}=== $1 ===${NC}"
}

print_pass() {
  echo -e "${GREEN}✓${NC} $1"
  ((PASSED++))
}

print_error() {
  echo -e "${RED}✗${NC} $1"
  ((ERRORS++))
}

print_warn() {
  echo -e "${YELLOW}⚠${NC} $1"
  ((WARNINGS++))
}

print_info() {
  echo -e "${BLUE}ℹ${NC} $1"
}

##############################################################################
# Validation Functions
##############################################################################

validate_env_var_numeric() {
  local var_name=$1
  local min=${2:-0}
  local max=${3:-65535}
  local friendly_name=${4:-$var_name}

  local value="${!var_name:-}"
  if [[ -z "$value" ]]; then
    return 0 # Skip if not set
  fi

  if ! [[ "$value" =~ ^[0-9]+$ ]]; then
    print_error "$friendly_name ($var_name) is not numeric: $value"
    return 1
  fi

  if [[ $value -lt $min ]] || [[ $value -gt $max ]]; then
    print_error "$friendly_name ($var_name) out of range [${min}-${max}]: $value"
    return 1
  fi

  print_pass "$friendly_name is valid ($value)"
  return 0
}

validate_env_var_boolean() {
  local var_name=$1
  local friendly_name=${2:-$var_name}

  local value="${!var_name:-}"
  if [[ -z "$value" ]]; then
    return 0 # Skip if not set
  fi

  if ! [[ "$value" =~ ^(true|false|True|False|TRUE|FALSE)$ ]]; then
    print_error "$friendly_name ($var_name) is not boolean (true/false): $value"
    return 1
  fi

  print_pass "$friendly_name is boolean ($value)"
  return 0
}

validate_postgres_connection() {
  local host="${POSTGRES_HOST:-postgres}"
  local port="${POSTGRES_PORT:-5432}"

  print_info "Testing PostgreSQL connection to $host:$port..."

  if ! command -v nc &> /dev/null; then
    print_warn "nc (netcat) not available, skipping connection test"
    return 0
  fi

  if nc -zv "$host" "$port" 2>/dev/null; then
    print_pass "PostgreSQL host is reachable ($host:$port)"
    return 0
  else
    print_warn "PostgreSQL host unreachable ($host:$port) - may be offline or firewall blocked"
    return 0 # Don't fail on this, might be expected
  fi
}

validate_postgres_password() {
  local password="${POSTGRES_PASSWORD:-}"
  local default_password="changeme_noosphere_2026"

  if [[ "$password" == "$default_password" ]]; then
    print_warn "POSTGRES_PASSWORD is set to default value - CHANGE THIS IN PRODUCTION"
    return 0
  fi

  if [[ -z "$password" ]]; then
    print_error "POSTGRES_PASSWORD is not set"
    return 1
  fi

  if [[ ${#password} -lt 8 ]]; then
    print_warn "POSTGRES_PASSWORD is less than 8 characters (recommended: 12+)"
    return 0
  fi

  print_pass "POSTGRES_PASSWORD is set and non-default"
  return 0
}

validate_connection_string() {
  local conn_str=$1
  local friendly_name=${2:-"Connection string"}

  if [[ -z "$conn_str" ]]; then
    return 0 # Skip if not set
  fi

  # PostgreSQL connection string format: postgresql://user:password@host:port/database
  local pattern="^postgresql://[^:]+:[^@]+@[^:]+:[0-9]+/[a-zA-Z0-9_-]+(\?.*)?$"

  if [[ "$conn_str" =~ $pattern ]]; then
    print_pass "$friendly_name format is valid"
    return 0
  else
    print_error "$friendly_name format is invalid: $conn_str"
    return 1
  fi
}

validate_log_level() {
  local log_level="${ACTION_QUEUE_LOG_LEVEL:-info}"
  local valid_levels="debug info warn error"

  if [[ " $valid_levels " =~ " $log_level " ]]; then
    print_pass "ACTION_QUEUE_LOG_LEVEL is valid ($log_level)"
    return 0
  else
    print_error "ACTION_QUEUE_LOG_LEVEL is invalid ($log_level). Valid: $valid_levels"
    return 1
  fi
}

##############################################################################
# Validation Sections
##############################################################################

validate_postgresql_section() {
  print_header "PostgreSQL Configuration"

  local has_errors=0

  # Check connection strings
  if [[ -n "${DATABASE_URL:-}" ]]; then
    validate_connection_string "$DATABASE_URL" "DATABASE_URL" || has_errors=$((has_errors + 1))
  else
    print_info "DATABASE_URL not set (will be auto-generated)"
  fi

  if [[ -n "${ACTION_QUEUE_DATABASE_URL:-}" ]]; then
    validate_connection_string "$ACTION_QUEUE_DATABASE_URL" "ACTION_QUEUE_DATABASE_URL" || has_errors=$((has_errors + 1))
  else
    print_info "ACTION_QUEUE_DATABASE_URL not set (will be auto-generated)"
  fi

  validate_postgres_password || has_errors=$((has_errors + 1))

  # Test connection if host is set
  if [[ -n "${POSTGRES_HOST:-}" ]] && [[ "$CHECK_ONLY" == "false" ]]; then
    validate_postgres_connection || true
  fi

  return $has_errors
}

validate_action_queue_section() {
  print_header "Action Queue Service"

  local has_errors=0

  validate_env_var_numeric "ACTION_QUEUE_PORT" 1025 65535 "Action Queue Port" || has_errors=$((has_errors + 1))
  validate_env_var_numeric "QUEUE_PROCESSING_INTERVAL" 1 300 "Queue Processing Interval" || has_errors=$((has_errors + 1))
  validate_env_var_numeric "QUEUE_SCHEDULED_CHECK_INTERVAL" 5 600 "Scheduled Check Interval" || has_errors=$((has_errors + 1))
  validate_env_var_numeric "QUEUE_MAX_ATTEMPTS" 1 10 "Queue Max Attempts" || has_errors=$((has_errors + 1))

  # Check multiplier (can be float)
  local backoff="${QUEUE_RETRY_BACKOFF_MULTIPLIER:-2}"
  if ! [[ "$backoff" =~ ^[0-9]+(\.[0-9]+)?$ ]]; then
    print_error "QUEUE_RETRY_BACKOFF_MULTIPLIER is invalid: $backoff"
    has_errors=$((has_errors + 1))
  else
    print_pass "QUEUE_RETRY_BACKOFF_MULTIPLIER is valid ($backoff)"
  fi

  return $has_errors
}

validate_pgboss_section() {
  print_header "pg-boss Configuration"

  local has_errors=0

  validate_env_var_numeric "PGBOSS_WORKER_CONCURRENCY" 1 100 "Worker Concurrency" || has_errors=$((has_errors + 1))
  validate_env_var_numeric "PGBOSS_MAINTENANCE_INTERVAL_MINUTES" 5 1440 "Maintenance Interval" || has_errors=$((has_errors + 1))
  validate_env_var_boolean "PGBOSS_ARCHIVE_COMPLETED_JOBS" "Archive Completed Jobs" || has_errors=$((has_errors + 1))
  validate_env_var_numeric "PGBOSS_JOB_EXPIRATION_DAYS" 1 365 "Job Expiration Days" || has_errors=$((has_errors + 1))

  return $has_errors
}

validate_observability_section() {
  print_header "Observability"

  local has_errors=0

  validate_env_var_boolean "ACTION_QUEUE_DEBUG" "Debug Mode" || has_errors=$((has_errors + 1))
  validate_log_level || has_errors=$((has_errors + 1))
  validate_env_var_numeric "ACTION_QUEUE_METRICS_PORT" 0 65535 "Metrics Port" || has_errors=$((has_errors + 1))

  if [[ "${ACTION_QUEUE_LOG_LEVEL:-info}" == "debug" ]]; then
    print_warn "ACTION_QUEUE_LOG_LEVEL is set to debug (verbose, not recommended for production)"
  fi

  return $has_errors
}

validate_rate_limiting_section() {
  print_header "Rate Limiting & Circuit Breaker"

  local has_errors=0

  validate_env_var_numeric "GLOBAL_API_RATE_LIMIT" 10 10000 "Global API Rate Limit" || has_errors=$((has_errors + 1))
  validate_env_var_boolean "ENABLE_RATE_LIMITING" "Enable Rate Limiting" || has_errors=$((has_errors + 1))
  validate_env_var_numeric "CIRCUIT_BREAKER_FAILURE_THRESHOLD" 1 100 "Failure Threshold" || has_errors=$((has_errors + 1))
  validate_env_var_numeric "CIRCUIT_BREAKER_TIMEOUT_SECONDS" 5 3600 "Circuit Breaker Timeout" || has_errors=$((has_errors + 1))

  return $has_errors
}

validate_production_checklist() {
  print_header "Production Readiness Checklist"

  local has_errors=0

  # Check if passwords are default
  if [[ "${POSTGRES_PASSWORD:-changeme_noosphere_2026}" == "changeme_noosphere_2026" ]]; then
    print_error "POSTGRES_PASSWORD is still default value - MUST change for production"
    has_errors=$((has_errors + 1))
  fi

  # Check if debug is enabled
  if [[ "${ACTION_QUEUE_DEBUG:-false}" == "true" ]]; then
    print_warn "ACTION_QUEUE_DEBUG is enabled - disable for production"
  fi

  # Check log level
  if [[ "${ACTION_QUEUE_LOG_LEVEL:-info}" == "debug" ]]; then
    print_warn "ACTION_QUEUE_LOG_LEVEL is debug - use warn/error for production"
  fi

  # Check rate limiting
  if [[ "${ENABLE_RATE_LIMITING:-true}" != "true" ]]; then
    print_warn "Rate limiting is disabled - enable for production"
  fi

  # Recommend checking limits
  local rate_limit="${GLOBAL_API_RATE_LIMIT:-100}"
  if [[ $rate_limit -lt 50 ]]; then
    print_warn "GLOBAL_API_RATE_LIMIT is low ($rate_limit) - may throttle legitimate traffic"
  fi

  return $has_errors
}

##############################################################################
# Usage and Main
##############################################################################

print_usage() {
  cat << EOF
Usage: bash scripts/verify-env-config.sh [OPTIONS]

Verify Moltbot environment configuration variables and connectivity.

OPTIONS:
  --check-only          Only validate formats/ranges (skip connection tests)
  --verbose             Show all checks including passes
  --help                Show this help message

EXAMPLES:
  bash scripts/verify-env-config.sh
  bash scripts/verify-env-config.sh --check-only
  bash scripts/verify-env-config.sh --verbose

EXIT CODES:
  0 = All validations passed
  1 = Validation errors found
  2 = Usage error

EOF
}

main() {
  # Parse arguments
  while [[ $# -gt 0 ]]; do
    case $1 in
      --check-only)
        CHECK_ONLY=true
        shift
        ;;
      --verbose)
        VERBOSE=true
        shift
        ;;
      --help|-h)
        print_usage
        exit 0
        ;;
      *)
        echo "Unknown option: $1"
        print_usage
        exit 2
        ;;
    esac
  done

  print_header "Moltbot Environment Configuration Verification"
  print_info "Checking environment variables and configuration..."
  echo

  # Load .env if it exists
  if [[ -f .env ]]; then
    set -a
    source .env
    set +a
    print_pass ".env file loaded"
  else
    print_warn ".env file not found (using only environment variables)"
  fi
  echo

  # Run validations
  local total_section_errors=0

  validate_postgresql_section || total_section_errors=$((total_section_errors + 1))
  echo

  validate_action_queue_section || total_section_errors=$((total_section_errors + 1))
  echo

  validate_pgboss_section || total_section_errors=$((total_section_errors + 1))
  echo

  validate_observability_section || total_section_errors=$((total_section_errors + 1))
  echo

  validate_rate_limiting_section || total_section_errors=$((total_section_errors + 1))
  echo

  validate_production_checklist || total_section_errors=$((total_section_errors + 1))
  echo

  # Summary
  print_header "Summary"
  echo -e "Passed:  ${GREEN}$PASSED${NC}"
  echo -e "Warnings: ${YELLOW}$WARNINGS${NC}"
  echo -e "Errors:  ${RED}$ERRORS${NC}"
  echo

  if [[ $ERRORS -eq 0 ]]; then
    echo -e "${GREEN}✓ Configuration validation passed!${NC}"
    if [[ $WARNINGS -gt 0 ]]; then
      echo -e "${YELLOW}⚠ Review warnings above before production deployment${NC}"
    fi
    exit 0
  else
    echo -e "${RED}✗ Configuration validation failed! Fix errors above.${NC}"
    exit 1
  fi
}

main "$@"
