# Environment Variables Documentation

Complete reference for Moltbot v2.7 environment configuration.

## Table of Contents

'
1. [PostgreSQL Configuration](#postgresql-configuration)
2. [Action Queue Service](#action-queue-service)
3. [pg-boss Configuration](#pg-boss-configuration)
4. [Observability](#observability)
5. [Rate Limiting & Circuit Breaker](#rate-limiting--circuit-breaker)
6. [Environment-Specific Examples](#environment-specific-examples)
7. [Validation on Startup](#validation-on-startup)
8. [Troubleshooting](#troubleshooting)
9. [Configuration Precedence](#configuration-precedence)

---

## PostgreSQL Configuration

### POSTGRES_USER

| Field          | Value                      |
| -------------- | -------------------------- |
| **Type**       | String (alphanumeric)      |
| **Default**    | `noosphere_admin`          |
| **Range**      | 1-64 characters            |
| **Required**   | No (has default)           |
| **Production** | ✓ Recommended to customize |

PostgreSQL superuser account for database administration. Used by Noosphere service and action-queue service.

```bash
# Example
POSTGRES_USER=my_admin_user
```

### POSTGRES_PASSWORD

| Field          | Value                      |
| -------------- | -------------------------- |
| **Type**       | String (any characters)    |
| **Default**    | `changeme_noosphere_2026`  |
| **Range**      | 8-128 characters           |
| **Required**   | No (has default)           |
| **Production** | ✗ MUST change from default |

PostgreSQL superuser password. **CRITICAL SECURITY**: Change from default in production.

```bash
# Example - Production (strong password)
POSTGRES_PASSWORD=Tr0pic@lFruit#2026$Encrypt!

# Example - Development (acceptable for local testing)
POSTGRES_PASSWORD=dev_password_123
```

**Security Considerations:**

- Minimum 12 characters recommended

- Use mix of: uppercase, lowercase, numbers, special characters

- Never use default in production

- Never commit actual password to git

- Use secrets management in Kubernetes/cloud environments

### POSTGRES_HOST

| Field          | Value                      |
| -------------- | -------------------------- |
| **Type**       | String (hostname/IP)       |
| **Default**    | `postgres`                 |
| **Range**      | Valid DNS name or IP       |
| **Required**   | No (has default)           |
| **Production** | ✓ Set appropriately        |

PostgreSQL server hostname or IP address.

```bash
# Example - Docker Compose (internal service name)
POSTGRES_HOST=postgres

# Example - External database
POSTGRES_HOST=db.example.com

# Example - Cloud-hosted (AWS RDS)
POSTGRES_HOST=my-db.123456789.us-east-1.rds.amazonaws.com

# Example - Kubernetes DNS
POSTGRES_HOST=postgres.moltbot-production.svc.cluster.local
```

### POSTGRES_PORT

| Field          | Value                      |
| -------------- | -------------------------- |
| **Type**       | Integer                    |
| **Default**    | `5432`                     |
| **Range**      | 1025-65535                 |
| **Required**   | No (has default)           |
| **Production** | ✓ Verify firewall rules    |

PostgreSQL server port number.

```bash
# Example - Standard port
POSTGRES_PORT=5432

# Example - Non-standard (custom instance)
POSTGRES_PORT=5433

# Example - Cloud-hosted with custom port
POSTGRES_PORT=5555
```

### POSTGRES_DB

| Field          | Value                      |
| -------------- | -------------------------- |
| **Type**       | String (alphanumeric)      |
| **Default**    | `noosphere`                |
| **Range**      | 1-64 characters            |
| **Required**   | No (has default)           |
| **Production** | ✓ Recommended to customize |

PostgreSQL database name for Noosphere service.

```bash
# Example - Default
POSTGRES_DB=noosphere

# Example - Environment-specific
POSTGRES_DB=noosphere_production
POSTGRES_DB=noosphere_staging
```

### POSTGRES_ACTION_QUEUE_DB

| Field          | Value                      |
| -------------- | -------------------------- |
| **Type**       | String (alphanumeric)      |
| **Default**    | `action_queue`             |
| **Range**      | 1-64 characters            |
| **Required**   | No (has default)           |
| **Production** | ✓ Recommended to customize |

PostgreSQL database name for action-queue service (pg-boss jobs).

```bash
# Example - Default
POSTGRES_ACTION_QUEUE_DB=action_queue

# Example - Environment-specific
POSTGRES_ACTION_QUEUE_DB=action_queue_production
```

### DATABASE_URL (Noosphere)

| Field          | Value                          |
| -------------- | ------------------------------ |
| **Type**       | PostgreSQL connection string   |
| **Default**    | Auto-generated from components |
| **Format**     | `postgresql://user:pass@host:port/db` |
| **Required**   | No (auto-generated)            |
| **Production** | ✓ Verify correct connection    |

Full PostgreSQL connection string for Noosphere. **Auto-generated** if not specified.

```bash
# Example - Not needed (auto-generated)
# DATABASE_URL=postgresql://noosphere_admin:changeme_noosphere_2026@postgres:5432/noosphere

# Example - Override if auto-generation fails
DATABASE_URL=postgresql://admin:secret@db.example.com:5432/noosphere

# Example - With SSL (production)
DATABASE_URL=postgresql://admin:secret@db.example.com:5432/noosphere?sslmode=require
```

### ACTION_QUEUE_DATABASE_URL

| Field          | Value                          |
| -------------- | ------------------------------ |
| **Type**       | PostgreSQL connection string   |
| **Default**    | Auto-generated from components |
| **Format**     | `postgresql://user:pass@host:port/db` |
| **Required**   | No (auto-generated)            |
| **Production** | ✓ Verify correct connection    |

Full PostgreSQL connection string for action-queue service. **Auto-generated** if not specified.

```bash
# Example - Not needed (auto-generated)
# ACTION_QUEUE_DATABASE_URL=postgresql://noosphere_admin:changeme_noosphere_2026@postgres:5432/action_queue

# Example - Override if auto-generation fails
ACTION_QUEUE_DATABASE_URL=postgresql://admin:secret@db.example.com:5432/action_queue
```

---

## Action Queue Service

### ACTION_QUEUE_PORT

| Field          | Value                      |
| -------------- | -------------------------- |
| **Type**       | Integer                    |
| **Default**    | `3008`                     |
| **Range**      | 1025-65535 (privileged: 1-1024) |
| **Required**   | No (has default)           |
| **Production** | ✓ May need customization   |

HTTP port for action-queue service API.

```bash
# Example - Default
ACTION_QUEUE_PORT=3008

# Example - Non-standard
ACTION_QUEUE_PORT=8008

# Example - Docker Compose override
ACTION_QUEUE_PORT=9008
```

**Port Assignment Guidelines:**

- Development: 3000-3999 (service ports)

- Staging: 8000-8999 (containerized services)

- Production: Use service discovery (Kubernetes, load balancer names)

### QUEUE_PROCESSING_INTERVAL

| Field          | Value                      |
| -------------- | -------------------------- |
| **Type**       | Integer (seconds)          |
| **Default**    | `5`                        |
| **Range**      | 1-300 seconds              |
| **Required**   | No (has default)           |
| **Production** | ✓ Tune for load            |

How often action-queue checks and processes queued jobs.

```bash
# Example - Responsive (5 seconds) - default
# Use for low-volume systems or real-time requirements
QUEUE_PROCESSING_INTERVAL=5

# Example - Balanced (15 seconds)
# Use for medium-volume systems
QUEUE_PROCESSING_INTERVAL=15

# Example - Relaxed (30 seconds)
# Use for high-volume systems to reduce CPU
QUEUE_PROCESSING_INTERVAL=30

# Example - Batch processing (60 seconds)
# Use for batch-heavy workloads
QUEUE_PROCESSING_INTERVAL=60
```

**Tuning Guide:**

- **Lower values** (5s) = more responsive, higher CPU

- **Higher values** (30-60s) = less responsive, lower CPU

- **Recommendation:** Start at 5s, increase if CPU > 70%

### QUEUE_SCHEDULED_CHECK_INTERVAL

| Field          | Value                      |
| -------------- | -------------------------- |
| **Type**       | Integer (seconds)          |
| **Default**    | `30`                       |
| **Range**      | 5-600 seconds              |
| **Required**   | No (has default)           |
| **Production** | ✓ Tune for scheduling needs |

How often to check for scheduled/delayed jobs.

```bash
# Example - Default
QUEUE_SCHEDULED_CHECK_INTERVAL=30

# Example - More frequent (real-time scheduling)
QUEUE_SCHEDULED_CHECK_INTERVAL=10

# Example - Less frequent (background jobs)
QUEUE_SCHEDULED_CHECK_INTERVAL=60
```

### QUEUE_MAX_ATTEMPTS

| Field          | Value                      |
| -------------- | -------------------------- |
| **Type**       | Integer                    |
| **Default**    | `3`                        |
| **Range**      | 1-10 attempts              |
| **Required**   | No (has default)           |
| **Production** | ✓ Consider reliability     |

Maximum number of times to retry failed jobs.

```bash
# Example - Conservative (low tolerance for failures)
QUEUE_MAX_ATTEMPTS=1

# Example - Default (balanced)
QUEUE_MAX_ATTEMPTS=3

# Example - Aggressive (high tolerance)
QUEUE_MAX_ATTEMPTS=5
```

**Considerations:**

- Lower = fail fast (good for transient errors)

- Higher = more resilience (good for flaky APIs)

- Retries use exponential backoff (see QUEUE_RETRY_BACKOFF_MULTIPLIER)

### QUEUE_RETRY_BACKOFF_MULTIPLIER

| Field          | Value                      |
| -------------- | -------------------------- |
| **Type**       | Float/Integer              |
| **Default**    | `2`                        |
| **Range**      | 1.0-10.0                  |
| **Required**   | No (has default)           |
| **Production** | ✓ Consider API limits      |

Exponential backoff multiplier for job retries.

```bash
# Example - Linear backoff (no multiplier)
QUEUE_RETRY_BACKOFF_MULTIPLIER=1.0
# Retry delays: 1s, 2s, 3s, 4s...

# Example - Default (exponential backoff)
QUEUE_RETRY_BACKOFF_MULTIPLIER=2.0
# Retry delays: 1s, 2s, 4s, 8s...

# Example - Aggressive exponential
QUEUE_RETRY_BACKOFF_MULTIPLIER=3.0
# Retry delays: 1s, 3s, 9s, 27s...
```

**Retry Timeline Examples (3 max attempts, multiplier 2):**

| Attempt | Wait Time | Cumulative |
| ------- | --------- | ---------- |
| 1       | 1s        | 1s         |
| 2       | 2s        | 3s         |
| 3       | 4s        | 7s         |
| Failed  | -         | Total: 7s  |

---

## pg-boss Configuration

### PGBOSS_WORKER_CONCURRENCY

| Field          | Value                      |
| -------------- | -------------------------- |
| **Type**       | Integer                    |
| **Default**    | `1`                        |
| **Range**      | 1-100 workers              |
| **Required**   | No (has default)           |
| **Production** | ✓ Tune for throughput      |

Number of jobs to process simultaneously.

```bash
# Example - Serial processing (default, prevents race conditions)
PGBOSS_WORKER_CONCURRENCY=1

# Example - Light parallelism
PGBOSS_WORKER_CONCURRENCY=5

# Example - Heavy parallelism
PGBOSS_WORKER_CONCURRENCY=20
```

**Concurrency Guidelines:**

- **1** (default): Safe, prevents race conditions, lower throughput

- **5-10**: Good balance for most workloads

- **20+**: Use only if jobs are I/O-bound and independent

- **Max:** Consider database connection pool size

**Rule:** Concurrency ≤ DB connection pool size - 2

### PGBOSS_MAINTENANCE_INTERVAL_MINUTES

| Field          | Value                      |
| -------------- | -------------------------- |
| **Type**       | Integer (minutes)          |
| **Default**    | `60`                       |
| **Range**      | 5-1440 minutes             |
| **Required**   | No (has default)           |
| **Production** | ✓ Consider size of queue   |

How often pg-boss runs maintenance tasks (cleanup, archival, optimization).

```bash
# Example - Frequent maintenance (large queues)
PGBOSS_MAINTENANCE_INTERVAL_MINUTES=15

# Example - Default (standard)
PGBOSS_MAINTENANCE_INTERVAL_MINUTES=60

# Example - Infrequent (small queues)
PGBOSS_MAINTENANCE_INTERVAL_MINUTES=240
```

### PGBOSS_ARCHIVE_COMPLETED_JOBS

| Field          | Value                      |
| -------------- | -------------------------- |
| **Type**       | Boolean (true/false)       |
| **Default**    | `true`                     |
| **Range**      | true, false                |
| **Required**   | No (has default)           |
| **Production** | ✓ Affects query performance |

Whether to move completed jobs to archive table.

```bash
# Example - Archival enabled (default, better performance)
PGBOSS_ARCHIVE_COMPLETED_JOBS=true

# Example - Keep all jobs in main table (for debugging)
PGBOSS_ARCHIVE_COMPLETED_JOBS=false
```

**Performance Impact:**

- **true**: Smaller main table → faster queries, uses more disk

- **false**: Larger main table → slower queries, less disk

### PGBOSS_JOB_EXPIRATION_DAYS

| Field          | Value                      |
| -------------- | -------------------------- |
| **Type**       | Integer (days)             |
| **Default**    | `30`                       |
| **Range**      | 1-365 days                 |
| **Required**   | No (has default)           |
| **Production** | ✓ Consider compliance      |

How long to keep completed/archived jobs before deletion.

```bash
# Example - Short retention (minimal storage)
PGBOSS_JOB_EXPIRATION_DAYS=7

# Example - Default (one month)
PGBOSS_JOB_EXPIRATION_DAYS=30

# Example - Long retention (compliance, debugging)
PGBOSS_JOB_EXPIRATION_DAYS=90
```

---

## Observability

### ACTION_QUEUE_DEBUG

| Field          | Value                      |
| -------------- | -------------------------- |
| **Type**       | Boolean (true/false)       |
| **Default**    | `false`                    |
| **Range**      | true, false                |
| **Required**   | No (has default)           |
| **Production** | ✗ Keep false               |

Enable extra verbose logging for troubleshooting.

```bash
# Example - Debug disabled (default, production)
ACTION_QUEUE_DEBUG=false

# Example - Debug enabled (development, troubleshooting)
ACTION_QUEUE_DEBUG=true
```

### ACTION_QUEUE_LOG_LEVEL

| Field          | Value                      |
| -------------- | -------------------------- |
| **Type**       | String (enum)              |
| **Default**    | `info`                     |
| **Range**      | debug, info, warn, error   |
| **Required**   | No (has default)           |
| **Production** | ✓ Set to info/warn         |

Logger verbosity level.

```bash
# Example - Debug (very verbose, development)
ACTION_QUEUE_LOG_LEVEL=debug

# Example - Info (normal, default)
ACTION_QUEUE_LOG_LEVEL=info

# Example - Warn (only warnings+errors, production)
ACTION_QUEUE_LOG_LEVEL=warn

# Example - Error (only errors, minimal logging)
ACTION_QUEUE_LOG_LEVEL=error
```

**Log Output Examples:**

| Level | Includes                   | Use Case           |
| ----- | -------------------------- | ------------------ |
| debug | All + internal flow        | Development        |
| info  | Functional events          | Standard logging   |
| warn  | Warning + errors           | Production         |
| error | Errors only                | Critical systems   |

### ACTION_QUEUE_METRICS_PORT

| Field          | Value                      |
| -------------- | -------------------------- |
| **Type**       | Integer                    |
| **Default**    | `3009`                     |
| **Range**      | 0, 1025-65535              |
| **Required**   | No (has default)           |
| **Production** | ✓ Verify Prometheus access |

HTTP port for Prometheus metrics endpoint. Set to `0` to disable.

```bash
# Example - Metrics enabled (default)
ACTION_QUEUE_METRICS_PORT=3009

# Example - Metrics on standard Prometheus port
ACTION_QUEUE_METRICS_PORT=9090

# Example - Metrics disabled
ACTION_QUEUE_METRICS_PORT=0
```

---

## Rate Limiting & Circuit Breaker

### GLOBAL_API_RATE_LIMIT

| Field          | Value                      |
| -------------- | -------------------------- |
| **Type**       | Integer (requests/minute)  |
| **Default**    | `100`                      |
| **Range**      | 10-10000                   |
| **Required**   | No (has default)           |
| **Production** | ✓ Set based on API quota   |

Maximum API requests per minute (all services combined).

```bash
# Example - Conservative (low API quota)
GLOBAL_API_RATE_LIMIT=50

# Example - Default
GLOBAL_API_RATE_LIMIT=100

# Example - Generous (high quota)
GLOBAL_API_RATE_LIMIT=500
```

### ENABLE_RATE_LIMITING

| Field          | Value                      |
| -------------- | -------------------------- |
| **Type**       | Boolean (true/false)       |
| **Default**    | `true`                     |
| **Range**      | true, false                |
| **Required**   | No (has default)           |
| **Production** | ✓ Keep true                |

Toggle rate limiting on/off globally.

```bash
# Example - Rate limiting enabled (default, production)
ENABLE_RATE_LIMITING=true

# Example - Rate limiting disabled (development/testing)
ENABLE_RATE_LIMITING=false
```

### CIRCUIT_BREAKER_FAILURE_THRESHOLD

| Field          | Value                      |
| -------------- | -------------------------- |
| **Type**       | Integer (failures)         |
| **Default**    | `5`                        |
| **Range**      | 1-100                      |
| **Required**   | No (has default)           |
| **Production** | ✓ Tune for resilience      |

Number of failures before circuit breaker opens.

```bash
# Example - Aggressive (fail fast)
CIRCUIT_BREAKER_FAILURE_THRESHOLD=2

# Example - Default (balanced)
CIRCUIT_BREAKER_FAILURE_THRESHOLD=5

# Example - Tolerant (high failure tolerance)
CIRCUIT_BREAKER_FAILURE_THRESHOLD=10
```

### CIRCUIT_BREAKER_TIMEOUT_SECONDS

| Field          | Value                      |
| -------------- | -------------------------- |
| **Type**       | Integer (seconds)          |
| **Default**    | `60`                       |
| **Range**      | 5-3600 seconds             |
| **Required**   | No (has default)           |
| **Production** | ✓ Match API recovery time  |

Seconds before circuit breaker attempts to half-open.

```bash
# Example - Quick recovery (unstable API, want fast retry)
CIRCUIT_BREAKER_TIMEOUT_SECONDS=10

# Example - Default
CIRCUIT_BREAKER_TIMEOUT_SECONDS=60

# Example - Slow recovery (waiting for maintenance window)
CIRCUIT_BREAKER_TIMEOUT_SECONDS=300
```

---

## Environment-Specific Examples

### Development Environment

```bash
# .env.development (local testing)

# PostgreSQL - local instance
POSTGRES_USER=dev_admin
POSTGRES_PASSWORD=dev_password_123
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=noosphere_dev
POSTGRES_ACTION_QUEUE_DB=action_queue_dev

# Action Queue - responsive for testing
ACTION_QUEUE_PORT=3008
QUEUE_PROCESSING_INTERVAL=5
QUEUE_SCHEDULED_CHECK_INTERVAL=10
QUEUE_MAX_ATTEMPTS=1

# pg-boss - single worker
PGBOSS_WORKER_CONCURRENCY=1
PGBOSS_MAINTENANCE_INTERVAL_MINUTES=60

# Observability - debug enabled
ACTION_QUEUE_DEBUG=true
ACTION_QUEUE_LOG_LEVEL=debug
ACTION_QUEUE_METRICS_PORT=3009

# Rate Limiting - loose for testing
GLOBAL_API_RATE_LIMIT=1000
ENABLE_RATE_LIMITING=false
CIRCUIT_BREAKER_FAILURE_THRESHOLD=100
```

### Staging Environment

```bash
# .env.staging (pre-production testing)

# PostgreSQL - cloud instance
POSTGRES_USER=staging_admin
POSTGRES_PASSWORD=Staging#2026$Password!
POSTGRES_HOST=postgres.staging.example.com
POSTGRES_PORT=5432
POSTGRES_DB=noosphere_staging
POSTGRES_ACTION_QUEUE_DB=action_queue_staging

# Action Queue - balanced
ACTION_QUEUE_PORT=3008
QUEUE_PROCESSING_INTERVAL=15
QUEUE_SCHEDULED_CHECK_INTERVAL=30
QUEUE_MAX_ATTEMPTS=3

# pg-boss - moderate concurrency
PGBOSS_WORKER_CONCURRENCY=5
PGBOSS_MAINTENANCE_INTERVAL_MINUTES=60
PGBOSS_ARCHIVE_COMPLETED_JOBS=true
PGBOSS_JOB_EXPIRATION_DAYS=14

# Observability - info level
ACTION_QUEUE_DEBUG=false
ACTION_QUEUE_LOG_LEVEL=info
ACTION_QUEUE_METRICS_PORT=3009

# Rate Limiting - production-like
GLOBAL_API_RATE_LIMIT=200
ENABLE_RATE_LIMITING=true
CIRCUIT_BREAKER_FAILURE_THRESHOLD=5
CIRCUIT_BREAKER_TIMEOUT_SECONDS=60
```

### Production Environment

```bash
# .env.production (use secrets management, not .env file!)
# Deploy via Kubernetes secrets, AWS Secrets Manager, etc.

# PostgreSQL - high-availability instance
POSTGRES_USER=prod_admin
POSTGRES_PASSWORD=$VAULT_POSTGRES_PASSWORD  # From secrets manager
POSTGRES_HOST=postgres-ha.prod.internal
POSTGRES_PORT=5432
POSTGRES_DB=noosphere_production
POSTGRES_ACTION_QUEUE_DB=action_queue_production
DATABASE_URL=$VAULT_DATABASE_URL  # From secrets manager
ACTION_QUEUE_DATABASE_URL=$VAULT_ACTION_QUEUE_DATABASE_URL  # SSL enabled

# Action Queue - optimized for load
ACTION_QUEUE_PORT=3008
QUEUE_PROCESSING_INTERVAL=10
QUEUE_SCHEDULED_CHECK_INTERVAL=30
QUEUE_MAX_ATTEMPTS=3

# pg-boss - high concurrency
PGBOSS_WORKER_CONCURRENCY=20
PGBOSS_MAINTENANCE_INTERVAL_MINUTES=15
PGBOSS_ARCHIVE_COMPLETED_JOBS=true
PGBOSS_JOB_EXPIRATION_DAYS=30

# Observability - info/warn level
ACTION_QUEUE_DEBUG=false
ACTION_QUEUE_LOG_LEVEL=warn
ACTION_QUEUE_METRICS_PORT=9090

# Rate Limiting - strict
GLOBAL_API_RATE_LIMIT=100
ENABLE_RATE_LIMITING=true
CIRCUIT_BREAKER_FAILURE_THRESHOLD=5
CIRCUIT_BREAKER_TIMEOUT_SECONDS=120
```

---

## Validation on Startup

The action-queue service validates environment configuration on startup:

```typescript
// Example validation flow
const config = {
  // Connection: auto-generated if missing
  databaseUrl: process.env.ACTION_QUEUE_DATABASE_URL ||
    `postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_ACTION_QUEUE_DB}`,

  // Port: parsed with fallback
  port: parseInt(process.env.ACTION_QUEUE_PORT || '3008', 10),

  // Intervals: validated for reasonable ranges
  processingInterval: validateInterval(
    process.env.QUEUE_PROCESSING_INTERVAL,
    1,
    300
  ),

  // Boolean flags: parsed safely
  archiveJobs: process.env.PGBOSS_ARCHIVE_COMPLETED_JOBS !== 'false',
};
```

**Validation Errors (startup failures):**

| Error                  | Cause                    | Fix                      |
| ---------------------- | ------------------------ | ------------------------ |
| Connection failed      | Invalid connection URL   | Verify DATABASE_URL      |
| Invalid port number    | Non-numeric PORT         | Set valid integer        |
| Interval out of range  | QUEUE_PROCESSING_INTERVAL < 1 | Increase interval |
| Unknown log level      | Invalid ACTION_QUEUE_LOG_LEVEL | Use: debug/info/warn/error |

---

## Troubleshooting

### PostgreSQL Connection Issues

**Problem:** `Error: connect ECONNREFUSED postgres:5432`

**Cause:** PostgreSQL host/port unreachable

**Solutions:**
'
1. Check POSTGRES_HOST and POSTGRES_PORT match actual database
2. Verify PostgreSQL container is running: `docker compose ps postgres`
3. Test connection manually: `psql -h postgres -U noosphere_admin`
4. Check firewall rules if using remote database

**Example Fix:**
```bash
# Verify PostgreSQL is accessible
docker compose exec action-queue \
  nc -zv postgres 5432

# Output: success if connection possible
# Connection to postgres 5432 port [tcp/*] succeeded!
```

### Authentication Failures

**Problem:** `Error: password authentication failed for user "noosphere_admin"`

**Cause:** POSTGRES_PASSWORD incorrect

**Solutions:**
'
1. Verify POSTGRES_PASSWORD in .env matches database password
2. Check database was initialized with correct password
3. Reset PostgreSQL password if forgotten

**Example Fix:**
```bash
# Reset PostgreSQL password
docker compose exec postgres \
  psql -U postgres \
  -c "ALTER USER noosphere_admin WITH PASSWORD 'new_password';"

# Update .env
POSTGRES_PASSWORD=new_password
```

### Queue Processing Stalls

**Problem:** Jobs not processing, stuck in queue

**Cause:** QUEUE_PROCESSING_INTERVAL too high or concurrency too low

**Solutions:**
'
1. Reduce QUEUE_PROCESSING_INTERVAL from 30s to 5s
2. Check logs: `docker compose logs action-queue`
3. Verify pg-boss workers: `PGBOSS_WORKER_CONCURRENCY=5`
4. Check database connection pool exhaustion

**Example Fix:**
```bash
# Increase processing frequency
QUEUE_PROCESSING_INTERVAL=5

# Increase worker concurrency
PGBOSS_WORKER_CONCURRENCY=5

# Check queue size
docker compose exec action-queue \
  curl http://localhost:3008/queue/stats
```

### High CPU Usage

**Problem:** action-queue service consuming >80% CPU

**Cause:** QUEUE_PROCESSING_INTERVAL too low

**Solutions:**
'
1. Increase QUEUE_PROCESSING_INTERVAL from 5s to 15-30s
2. Reduce PGBOSS_WORKER_CONCURRENCY if high
3. Check for infinitely retrying jobs

**Example Fix:**
```bash
# Reduce processing frequency
QUEUE_PROCESSING_INTERVAL=30

# Reduce concurrency
PGBOSS_WORKER_CONCURRENCY=3

# Monitor improvement
docker compose stats action-queue
```

### Rate Limiting Blocking Legitimate Requests

**Problem:** Valid requests returning 429 (Too Many Requests)

**Cause:** GLOBAL_API_RATE_LIMIT too strict

**Solutions:**
'
1. Check actual request volume: Monitor action-queue metrics
2. Increase GLOBAL_API_RATE_LIMIT from 100 to 200-500
3. Verify ENABLE_RATE_LIMITING is appropriate

**Example Fix:**
```bash
# Increase rate limit
GLOBAL_API_RATE_LIMIT=250

# Check metrics
docker compose exec action-queue \
  curl http://localhost:3009/metrics | grep rate_limit
```

---

## Configuration Precedence

Environment variables are loaded in this order (first match wins):

'
1. **Explicit environment variables** (POSTGRES_HOST, ACTION_QUEUE_PORT, etc.)
2. **Combined connection strings** (DATABASE_URL, ACTION_QUEUE_DATABASE_URL)
3. **Hard-coded defaults** in application code

**Example precedence chain:**
```
DATABASE_URL env var → (if not set) → auto-generate from POSTGRES_* vars → (if not set) → hard-coded default
```

### When DATABASE_URL Overrides Components

If both DATABASE_URL and individual variables are set:

- DATABASE_URL takes precedence

- Individual variables (POSTGRES_HOST, POSTGRES_PORT, etc.) are ignored

**Example:**
```bash
# Both set:
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
DATABASE_URL=postgresql://admin:pass@remote-db:5432/noosphere

# Result: Uses remote-db (from DATABASE_URL)
# localhost:5432 is ignored
```

### Kubernetes Secrets Integration

For production Kubernetes deployments:

```yaml
# ConfigMap for non-sensitive settings
apiVersion: v1
kind: ConfigMap
metadata:
  name: action-queue-config
data:
  QUEUE_PROCESSING_INTERVAL: "10"
  PGBOSS_WORKER_CONCURRENCY: "20"
  ACTION_QUEUE_LOG_LEVEL: "info"
---
# Secret for sensitive settings
apiVersion: v1
kind: Secret
metadata:
  name: action-queue-secrets
type: Opaque
stringData:
  POSTGRES_PASSWORD: "super-secret-password"
  DATABASE_URL: "postgresql://admin:secret@postgres-ha:5432/noosphere"
---
# Pod deployment
apiVersion: v1
kind: Pod
metadata:
  name: action-queue
spec:
  containers:
  - name: action-queue
    image: moltbot:action-queue
    envFrom:
    - configMapRef:
        name: action-queue-config
    - secretRef:
        name: action-queue-secrets
```

---

## Production Checklist

Before deploying to production:


- [ ] POSTGRES_PASSWORD changed from default

- [ ] POSTGRES_HOST points to production database

- [ ] DATABASE_URL has SSL enabled (sslmode=require)

- [ ] QUEUE_PROCESSING_INTERVAL tuned for expected load

- [ ] PGBOSS_WORKER_CONCURRENCY ≤ database pool size - 2

- [ ] ACTION_QUEUE_LOG_LEVEL set to warn or error

- [ ] CIRCUIT_BREAKER_FAILURE_THRESHOLD ≤ 5

- [ ] CIRCUIT_BREAKER_TIMEOUT_SECONDS ≥ 60

- [ ] ENABLE_RATE_LIMITING set to true

- [ ] PGBOSS_JOB_EXPIRATION_DAYS set appropriately

- [ ] Secrets management configured (not .env file)

- [ ] Monitoring/alerting configured for metrics port

- [ ] Database backups verified

- [ ] Connection pooling verified

- [ ] Load testing completed

---

## Additional Resources


- **Installation Guide:** [README.md](../README.md)

- **Architecture Overview:** [AGENTS.md](../AGENTS.md)

- **Service Architecture:** [SERVICE_ARCHITECTURE.md](../docs/SERVICE_ARCHITECTURE.md)

- **PostgreSQL Setup:** [Setup Permissions Script](../scripts/setup-permissions.sh)

- **Verification Script:** [Verify Environment Config](../scripts/verify-env-config.sh)

---

*Last Updated: 2026-02-21 | Moltbot v2.7*
