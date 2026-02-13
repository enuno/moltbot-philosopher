# Conditional Actions Guide

Execute actions only when complex conditions are met.

## Overview

The Action Queue supports conditional logic, allowing actions to wait until
multiple conditions are satisfied before executing. This enables sophisticated
workflows like:

- Wait for suspension to lift before resuming activity
- Chain dependent actions (comment after previous post)
- Execute during optimal time windows
- React to engagement metrics
- Coordinate with external services

## Quick Examples

### Example 1: Follow After Suspension Lifts

```bash
curl -X POST http://localhost:3006/actions \
  -H "Content-Type: application/json" \
  -d '{
    "agentName": "ClassicalPhilosopher",
    "actionType": "follow",
    "payload": {
      "username": "0xYeks"
    },
    "conditions": {
      "operator": "and",
      "conditions": [
        {
          "id": "time-check",
          "type": "time_after",
          "params": {
            "timestamp": "2026-02-17T00:00:00Z"
          }
        },
        {
          "id": "account-check",
          "type": "account_active",
          "params": {
            "agentName": "ClassicalPhilosopher"
          }
        }
      ]
    },
    "conditionCheckInterval": 300,
    "conditionTimeout": "2026-02-20T00:00:00Z"
  }'
```

**Behavior**:
- Waits until Feb 17, 2026
- Checks if account is active every 5 minutes
- Executes when BOTH conditions true
- Gives up if not satisfied by Feb 20

### Example 2: Engagement-Based Thread Continuation

```json
{
  "agentName": "ClassicalPhilosopher",
  "actionType": "comment",
  "payload": {
    "postId": "post-123",
    "content": "Building on this point..."
  },
  "conditions": {
    "operator": "and",
    "conditions": [
      {
        "id": "previous-action",
        "type": "action_completed",
        "params": {
          "actionId": "action-abc",
          "requiredStatus": "completed"
        }
      },
      {
        "id": "engagement-check",
        "type": "post_engagement",
        "params": {
          "postId": "post-123",
          "minUpvotes": 5,
          "minComments": 2
        }
      }
    ]
  }
}
```

**Behavior**:
- Waits for previous action to complete
- Checks post engagement metrics
- Only continues thread if post has traction

### Example 3: Peak Hours Posting

```json
{
  "agentName": "ClassicalPhilosopher",
  "actionType": "post",
  "payload": {
    "title": "Daily Reflection",
    "content": "...",
    "submolt": "general"
  },
  "conditions": {
    "operator": "and",
    "conditions": [
      {
        "id": "time-window",
        "type": "time_between",
        "params": {
          "start": "2026-02-14T14:00:00Z",
          "end": "2026-02-14T22:00:00Z"
        }
      },
      {
        "id": "rate-limit",
        "type": "rate_limit_available",
        "params": {
          "agentName": "ClassicalPhilosopher",
          "actionType": "post"
        }
      }
    ]
  }
}
```

**Behavior**:
- Only executes between 2pm-10pm UTC
- Waits for post rate limit to be available
- Optimal posting time + rate limit compliance

## Condition Types

### Time-Based Conditions

#### TIME_AFTER
Execute after a specific timestamp.

```json
{
  "type": "time_after",
  "params": {
    "timestamp": "2026-02-17T12:00:00Z"
  }
}
```

#### TIME_BEFORE
Execute before a deadline.

```json
{
  "type": "time_before",
  "params": {
    "timestamp": "2026-02-20T00:00:00Z"
  }
}
```

#### TIME_BETWEEN
Execute within a time window.

```json
{
  "type": "time_between",
  "params": {
    "start": "2026-02-14T08:00:00Z",
    "end": "2026-02-14T20:00:00Z"
  }
}
```

### State-Based Conditions

#### ACCOUNT_ACTIVE
Check if account is not suspended.

```json
{
  "type": "account_active",
  "params": {
    "agentName": "ClassicalPhilosopher"
  }
}
```

#### ACTION_COMPLETED
Wait for another action to complete.

```json
{
  "type": "action_completed",
  "params": {
    "actionId": "action-uuid",
    "requiredStatus": "completed"
  }
}
```

#### KARMA_THRESHOLD
Check karma within range.

```json
{
  "type": "karma_threshold",
  "params": {
    "agentName": "ClassicalPhilosopher",
    "minKarma": 100,
    "maxKarma": 10000
  }
}
```

#### FOLLOWER_COUNT
Check follower count threshold.

```json
{
  "type": "follower_count",
  "params": {
    "agentName": "ClassicalPhilosopher",
    "minFollowers": 50
  }
}
```

#### POST_ENGAGEMENT
Check post engagement metrics.

```json
{
  "type": "post_engagement",
  "params": {
    "postId": "post-uuid",
    "minUpvotes": 10,
    "minComments": 3,
    "minEngagementScore": 20
  }
}
```

### Resource Conditions

#### RATE_LIMIT_AVAILABLE
Check if rate limit window is available.

```json
{
  "type": "rate_limit_available",
  "params": {
    "agentName": "ClassicalPhilosopher",
    "actionType": "post"
  }
}
```

### External Conditions

#### API_CHECK
Call external API and validate response.

```json
{
  "type": "api_check",
  "params": {
    "url": "https://api.example.com/status",
    "method": "GET",
    "expectedStatus": 200,
    "expectedBodyContains": "operational"
  }
}
```

#### CUSTOM
Run external script for custom logic.

```json
{
  "type": "custom",
  "params": {
    "scriptPath": "/app/scripts/check-readiness.sh",
    "args": ["ClassicalPhilosopher"],
    "expectedExitCode": 0
  }
}
```

## Boolean Operators

### AND
All conditions must be satisfied.

```json
{
  "operator": "and",
  "conditions": [
    {"type": "time_after", "params": {...}},
    {"type": "account_active", "params": {...}},
    {"type": "rate_limit_available", "params": {...}}
  ]
}
```

### OR
At least one condition must be satisfied.

```json
{
  "operator": "or",
  "conditions": [
    {"type": "karma_threshold", "params": {"minKarma": 1000}},
    {"type": "follower_count", "params": {"minFollowers": 100}}
  ]
}
```

### NOT
Negate a condition.

```json
{
  "operator": "not",
  "conditions": [
    {"type": "account_active", "params": {...}}
  ]
}
```

### Nested Logic
Combine operators for complex logic.

```json
{
  "operator": "and",
  "conditions": [
    {
      "type": "time_between",
      "params": {"start": "...", "end": "..."}
    },
    {
      "operator": "or",
      "conditions": [
        {"type": "karma_threshold", "params": {"minKarma": 500}},
        {"type": "follower_count", "params": {"minFollowers": 50}}
      ]
    }
  ]
}
```

**Logic**: Execute during time window AND (karma >= 500 OR followers >= 50)

## Configuration Options

### conditionCheckInterval
How often to evaluate conditions (seconds).

```json
{
  "conditionCheckInterval": 300
}
```

Default: 60 seconds
Min: 5 seconds
Max: 3600 seconds (1 hour)

### conditionTimeout
Give up if conditions not met by this time.

```json
{
  "conditionTimeout": "2026-02-20T00:00:00Z"
}
```

If timeout reached, action status set to `cancelled`.

## Monitoring

### Check Condition Status

```bash
# Get action details including condition evaluations
curl http://localhost:3006/actions/action-uuid
```

Response:

```json
{
  "id": "action-uuid",
  "status": "scheduled",
  "conditionEvaluations": [
    {
      "conditionId": "cond-1",
      "type": "time_after",
      "satisfied": false,
      "evaluatedAt": "2026-02-13T19:00:00Z",
      "message": "Waiting until 2026-02-17T00:00:00Z",
      "details": {
        "remainingSeconds": 345600
      }
    },
    {
      "conditionId": "cond-2",
      "type": "account_active",
      "satisfied": false,
      "evaluatedAt": "2026-02-13T19:00:00Z",
      "message": "Account suspended: Failing to answer AI verification challenge",
      "details": {
        "httpStatus": 401
      }
    }
  ]
}
```

### View All Conditional Actions

```bash
curl http://localhost:3006/actions?status=scheduled
```

## Best Practices

### 1. Use Appropriate Check Intervals

- **Fast conditions** (time checks): 60 seconds
- **API checks**: 300 seconds (5 minutes)
- **Engagement checks**: 600 seconds (10 minutes)

### 2. Always Set Timeouts

Prevent actions from waiting indefinitely:

```json
{
  "conditionTimeout": "2026-02-20T00:00:00Z"
}
```

### 3. Combine Related Conditions

Group conditions that should be evaluated together:

```json
{
  "operator": "and",
  "conditions": [
    {"type": "time_after", ...},
    {"type": "account_active", ...},
    {"type": "rate_limit_available", ...}
  ]
}
```

### 4. Use Negation Sparingly

Prefer positive conditions over negated ones for clarity.

### 5. Test Conditions

Test condition evaluation before submitting important actions:

```bash
# Submit test action with short timeout
curl -X POST http://localhost:3006/actions \
  -d '{
    "conditions": {...},
    "conditionTimeout": "2026-02-13T20:00:00Z"
  }'
```

## Common Patterns

### Pattern 1: Retry After Suspension

```json
{
  "conditions": {
    "operator": "and",
    "conditions": [
      {"type": "time_after", "params": {"timestamp": "..."}},
      {"type": "account_active", "params": {...}}
    ]
  }
}
```

### Pattern 2: Optimal Posting Time

```json
{
  "conditions": {
    "operator": "and",
    "conditions": [
      {"type": "time_between", "params": {"start": "...", "end": "..."}},
      {"type": "rate_limit_available", "params": {...}}
    ]
  }
}
```

### Pattern 3: Engagement-Driven Follow-Up

```json
{
  "conditions": {
    "operator": "and",
    "conditions": [
      {"type": "post_engagement", "params": {"minUpvotes": 10}},
      {"type": "rate_limit_available", "params": {...}}
    ]
  }
}
```

### Pattern 4: Milestone Announcement

```json
{
  "conditions": {
    "operator": "or",
    "conditions": [
      {"type": "karma_threshold", "params": {"minKarma": 1000}},
      {"type": "follower_count", "params": {"minFollowers": 100}}
    ]
  }
}
```

## Troubleshooting

### Action Stuck in "scheduled" Status

**Check condition evaluations**:
```bash
curl http://localhost:3006/actions/action-uuid
```

Look at `conditionEvaluations[].satisfied` to see which conditions are blocking.

### Condition Always False

**Verify condition parameters** are correct:
- Timestamps in ISO 8601 format
- Action IDs are valid UUIDs
- Agent names match exactly

### Timeout Expired

If `conditionTimeout` reached, action will be cancelled. Check if timeout is
reasonable for your conditions.

### High CPU Usage

If condition checks are expensive (API calls, scripts), increase
`conditionCheckInterval` to reduce evaluation frequency.

## API Reference

See main API documentation for endpoint details:
- POST /actions - Submit conditional action
- GET /actions/:id - View condition evaluations
- GET /actions - List conditional actions

---

**Next**: See [DEVELOPMENT_PLAN.md](../../DEVELOPMENT_PLAN.md) Feature G.10
for technical implementation details.
