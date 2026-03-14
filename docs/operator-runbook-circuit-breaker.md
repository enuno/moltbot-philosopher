# Circuit Breaker Operator Runbook

## Quick Reference

| Symptom | Diagnosis | Resolution |
|---------|-----------|-----------|
| Service returns 503 | Circuit is OPEN for that agent | Check `/recovery/status/:agent`, run reset if needed |
| Actions not processing | Agents claiming but not releasing | Check `/recovery/orphaned/reclaim` for orphaned actions |
| Circuit repeatedly opens | Agent is genuinely unstable | Investigate root cause; contact deployment team |
| Metrics not updating | MetricsCollector not recording events | Check logs; restart action-queue service |

---

## Setup & Configuration

### 1. Enable Circuit Breaker Service

Add to `docker-compose.yml` (or `docker-compose.override.yml` for local):

```yaml
action-queue:
  environment:
    # Circuit breaker configuration
    CIRCUIT_BREAKER_MAX_FAILURES: 3           # Failures before OPEN
    RECOVERY_PROBE_INTERVAL_MS: 3600000       # Auto-recovery every 1 hour
    ACTION_CLAIM_TIMEOUT_SECONDS: 300         # Claim expires after 5 min

    # Alerting
    NTFY_TOPIC_URL: https://ntfy.sh/moltbot-alerts
    ALERT_TIMEOUT_MS: 5000

    # Admin access (REQUIRED for manual operations)
    ADMIN_TOKEN: ${ADMIN_TOKEN}
    ACTION_QUEUE_URL: http://action-queue:3007
```

### 2. Set Admin Token

```bash
# In .env
ADMIN_TOKEN=your-secure-random-token-here
```

**Security Note**: Use a cryptographically random token. Example:
```bash
openssl rand -base64 32
```

### 3. Initialize State Tables

On first startup, circuit breaker tables auto-create:

```bash
docker compose up action-queue
curl http://localhost:3007/queue/health  # Verify tables created
```

---

## Operational Procedures

### Check Circuit Status

**View all circuits at once**:
```bash
curl http://localhost:3007/queue/health | jq '.circuits'
```

**View specific agent**:
```bash
curl http://localhost:3007/recovery/status/classical-philosopher
```

**Output Example**:
```json
{
  "agent_name": "classical-philosopher",
  "state": "CLOSED",
  "consecutive_failures": 0,
  "last_failure_time": null,
  "opened_at": null
}
```

**States Explained**:
- `CLOSED` - Healthy, accepting requests
- `OPEN` - Failed, rejecting all requests
- `HALF_OPEN` - Testing recovery after reset

---

### Manually Reset Circuit

Use when an agent has recovered but circuit is still OPEN.

```bash
curl -X POST http://localhost:3007/recovery/reset/classical-philosopher \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Response** (on success):
```json
{
  "success": true,
  "message": "Circuit for classical-philosopher reset to CLOSED",
  "agent_name": "classical-philosopher"
}
```

**Troubleshooting**:
- `401 Unauthorized` → ADMIN_TOKEN not set or invalid
- `500 error` → Database connection issue; check logs

**When to Use**:
- Agent has crashed and restarted → manually reset after verifying logs
- Maintenance completed → reset to resume normal operations
- Testing recovery mechanism → manual reset validates the endpoint

---

### Trigger Recovery Probe

Manually trigger recovery attempt for OPEN circuits (usually runs automatically).

```bash
curl -X POST http://localhost:3007/recovery/probe \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Response**:
```json
{
  "success": true,
  "message": "Recovery probe triggered",
  "probesRun": 1
}
```

**What It Does**:
1. Finds all OPEN circuits
2. Transitions each to HALF_OPEN
3. Tests recovery with heartbeat (simple database query)
4. On success: transitions to CLOSED, resets counters
5. On failure: reverts to OPEN, increments failures

**When to Use**:
- After fixing underlying issue (don't wait for 1-hour interval)
- Testing recovery mechanism
- Immediate recovery attempt

---

### Recover Orphaned Actions

Find and reclaim actions abandoned by workers (timeout or crash).

```bash
curl -X POST http://localhost:3007/recovery/orphaned/reclaim \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Response**:
```json
{
  "success": true,
  "recovered": 5,
  "action_ids": ["job-123", "job-456", "job-789", "job-101", "job-112"]
}
```

**What It Does**:
1. Finds all action claims with `timeout_at < NOW()` (timed out)
2. Releases the claims so workers can re-process
3. Records count in metrics
4. Returns list of reclaimed action IDs

**When to Use**:
- After agent crash (to resume processing)
- Batch jobs stuck in progress
- Regular maintenance (safe to run anytime)

**Monitoring**: Check recovered count in logs
```bash
docker compose logs -f action-queue | grep "Orphaned action recovery"
```

---

### View Metrics

```bash
curl http://localhost:3007/metrics
```

**Output**:
```json
{
  "circuit_opens": 5,
  "circuit_closes": 4,
  "recovery_attempts": 10,
  "recovery_success_rate": 40.0,
  "orphaned_actions_recovered": 12
}
```

**Metric Definitions**:
- `circuit_opens` - Number of times circuit transitioned to OPEN (cumulative)
- `circuit_closes` - Number of times circuit recovered to CLOSED (cumulative)
- `recovery_attempts` - Total manual resets + auto-probe attempts
- `recovery_success_rate` - Percentage of successful recovery attempts (0-100)
- `orphaned_actions_recovered` - Total actions reclaimed from timeout

**Note**: Metrics reset on service restart. For persistence, integrate with Prometheus/InfluxDB.

---

## Monitoring & Alerting

### NTFY Alerts

Circuit breaker sends alerts to NTFY on critical events:

```bash
# Configure in docker-compose.yml
NTFY_TOPIC_URL: https://ntfy.sh/moltbot-alerts
```

**Example Alerts**:
- "Circuit opened for classical-philosopher (3 consecutive failures)"
- "Circuit recovered for classical-philosopher after probe"
- "Manual reset by admin for enlightenment-philosopher"

**Subscribe to Updates** (optional):
```bash
curl -s https://ntfy.sh/moltbot-alerts/json | jq '.message'
```

### Health Check Integration

Add health check to monitoring system:

```bash
# Kubernetes example
livenessProbe:
  httpGet:
    path: /queue/health
    port: 3007
  initialDelaySeconds: 10
  periodSeconds: 30
```

**Success Criteria**:
- HTTP 200 response
- All circuits show valid state
- Metrics endpoint responds

---

## Troubleshooting

### Symptom: Circuit Repeatedly Opens

**Investigation**:
```bash
# Check failure pattern
curl http://localhost:3007/recovery/status/classical-philosopher

# Check logs
docker compose logs action-queue | grep "classical-philosopher"
```

**Root Causes**:
1. **Worker crash** → Check agent logs: `docker compose logs classical-philosopher`
2. **Network issues** → Check connectivity: `docker exec action-queue curl <worker-url>`
3. **Resource exhaustion** → Check memory: `docker stats`
4. **Configuration mismatch** → Verify env vars

**Resolution**:
```bash
# Option 1: Fix root cause and reset
docker compose restart classical-philosopher
curl -X POST http://localhost:3007/recovery/reset/classical-philosopher \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Option 2: Trigger probe after fix
curl -X POST http://localhost:3007/recovery/probe \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

---

### Symptom: Actions Stuck in Processing

**Check For Orphans**:
```bash
# Find timed-out claims
curl -X POST http://localhost:3007/recovery/orphaned/reclaim \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Output shows count and IDs
```

**Prevent Future Orphans**:
- Verify workers gracefully release claims
- Monitor action-queue logs for crash patterns
- Increase `ACTION_CLAIM_TIMEOUT_SECONDS` if legitimate long-running actions

---

### Symptom: Metrics Always Zero

**Possible Causes**:
1. Service just started (metrics accumulate over time)
2. MetricsCollector not recording events
3. Metrics endpoint not responding

**Diagnosis**:
```bash
# Check if endpoints are responding
curl http://localhost:3007/metrics
curl http://localhost:3007/queue/health

# Check logs for errors
docker compose logs action-queue | grep -i "metric\|error"
```

**Resolution**:
```bash
# Restart service to verify initialization
docker compose restart action-queue
sleep 2
curl http://localhost:3007/metrics  # Should show 0s now
```

---

### Symptom: "Invalid Persona" from Recovery CLI

**Error**:
```
Error: Failed to reset circuit
details: Invalid persona
```

**Cause**: Agent name doesn't match `worker_state` table entries

**Resolution**:
```bash
# List valid agent names
curl http://localhost:3007/queue/health | jq '.circuits | keys'

# Use exact name from list
curl -X POST http://localhost:3007/recovery/reset/classical-philosopher \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

---

## Using Recovery CLI Tool

Convenience script for common operations:

```bash
# Setup
export ADMIN_TOKEN="your-token"
export ACTION_QUEUE_URL="http://localhost:3007"
npm run recovery -- <command> <arg>
```

**Commands**:

```bash
# Reset circuit
npm run recovery -- reset classical-philosopher

# Check status
npm run recovery -- status classical-philosopher

# Trigger probe
npm run recovery -- probe

# Recover orphans
npm run recovery -- orphaned
```

**Output Examples**:

```bash
$ npm run recovery -- status classical-philosopher
Agent: classical-philosopher
State: CLOSED
Consecutive Failures: 0
Last Failure: never
Opened At: never

$ npm run recovery -- orphaned
✓ Recovered 3 orphaned actions
```

---

## Scaling & Performance

### Per-Agent Circuit Breaker

Each agent has independent circuit state. Affects:
- One OPEN circuit doesn't reject requests from other agents
- Recovery probes run serially (one test per agent)
- Metrics aggregated across all agents

### Concurrency & Thread Safety

Circuit breaker is safe for concurrent requests:

```typescript
// In-memory state + database persistence
// Guard flag prevents concurrent probes
if (isProbeRunning) { skip this interval }
```

### Database Load

- **recordFailure()**: ~5ms per call (frequent under load)
- **Recovery probe**: ~1s total (hourly, non-blocking)
- **Orphan detection**: ~500ms per call (on-demand)

**Optimization**: Use read replicas for health checks if needed

---

## Maintenance

### Regular Tasks

| Task | Frequency | Command |
|------|-----------|---------|
| Check circuit status | Daily | `curl http://localhost:3007/queue/health` |
| Audit metrics | Weekly | `curl http://localhost:3007/metrics` |
| Test manual reset | Monthly | `npm run recovery -- reset test-agent` |
| Review logs | Daily | `docker compose logs action-queue` |

### Backup & Recovery

Circuit breaker state is **stored in PostgreSQL**. Follow standard database backup procedures:

```bash
# Backup
docker exec postgres pg_dump -U noosphere_admin moltbot > backup.sql

# Restore
docker exec -i postgres psql -U noosphere_admin moltbot < backup.sql
```

**What's Backed Up**:
- `worker_state` table (all circuit states)
- `action_claims` table (in-flight actions)
- Metrics are in-memory only (not persisted)

---

## Incident Response

### Scenario: Multiple Circuits OPEN

1. **Page on-call** (if using alerting)
2. **Assess impact**:
   ```bash
   curl http://localhost:3007/queue/health | jq '.circuits[] | select(.state == "OPEN")'
   ```
3. **Check logs for root cause**:
   ```bash
   docker compose logs --since 10m action-queue | grep -i "error\|fail"
   ```
4. **Temporary workaround** (if needed):
   ```bash
   # Reset specific agents
   for agent in classical existentialist transcendentalist; do
     curl -X POST http://localhost:3007/recovery/reset/$agent \
       -H "Authorization: Bearer $ADMIN_TOKEN"
   done
   ```
5. **Investigate root cause** (don't just reset)
6. **Post-incident**: Review logs, update runbook

---

## Additional Resources

- [Circuit Breaker Architecture](CIRCUIT_BREAKER_ARCHITECTURE.md) - Technical design
- [GitHub Issue #44](https://github.com/enuno/moltbot-philosopher/issues/44) - Requirements
- [PostgreSQL Health Check](../CLAUDE.md) - Database setup & troubleshooting
- [README.md](../README.md) - Service overview

---

## Contact & Support

For issues or questions:
- **Circuit Breaker Implementation**: See [Issue #44](https://github.com/enuno/moltbot-philosopher/issues/44)
- **Database Issues**: Check [PostgreSQL Permission Architecture](../AGENTS.md)
- **Logs & Debugging**: `docker compose logs -f action-queue`
