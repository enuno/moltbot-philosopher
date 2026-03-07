# Heartbeat State Schema

## heartbeat-state.json

```json
{
  "last_check": "2026-02-24T12:34:56+00:00",
  "last_skill_version": null,
  "heartbeat_timestamps": [
    1708777200,
    1708790600,
    1708804000
  ],
  "cov_value": null,
  "cov_is_warning": false,
  "last_alert_time": null,
  "active_hours": null
}

```

### Fields

- **last_check** (string, ISO8601): Human-readable timestamp of the last heartbeat

- **last_skill_version** (string|null): Skill manifest version (legacy, kept for compatibility)

- **heartbeat_timestamps** (array of integers): Last 20 Unix epoch seconds when heartbeat executed. Circular buffer; keep only the last 20 entries.

- **cov_value** (number|null): Current Coefficient of Variation of inter-heartbeat intervals. Null until buffer reaches 20 entries (warmup phase).

- **cov_is_warning** (boolean): True if cov_value > 0.4 (warning threshold). Used for dashboard and alerting logic.

- **last_alert_time** (integer|null): Unix epoch of last NTFY alert sent. Null if never alerted. Used to track cooldown window.

- **active_hours** (string|null): Optional time window in format "HH:MM-HH:MM" (e.g., "06:00-23:00"). If set, heartbeat only fires within this window. If null, heartbeat fires 24/7.

### Example: Warmup Phase (6 timestamps, no CoV yet)

```json
{
  "last_check": "2026-02-24T01:00:00+00:00",
  "last_skill_version": null,
  "heartbeat_timestamps": [1708777200, 1708790600, 1708804000, 1708817400, 1708830800, 1708844200],
  "cov_value": null,
  "cov_is_warning": false,
  "last_alert_time": null,
  "active_hours": null
}

```

### Example: Mature Buffer with Warning (20 timestamps, CoV > 0.4)

```json
{
  "last_check": "2026-02-24T12:34:56+00:00",
  "last_skill_version": null,
  "heartbeat_timestamps": [1708690800, 1708704200, 1708717600, 1708731000, 1708744400, 1708757800, 1708771200, 1708784600, 1708798000, 1708811400, 1708824800, 1708838200, 1708851600, 1708865000, 1708878400, 1708891800, 1708905200, 1708918600, 1708932000, 1708945400],
  "cov_value": 0.42,
  "cov_is_warning": true,
  "last_alert_time": 1708945200,
  "active_hours": "06:00-23:00"
}

```

## Initialization

When a heartbeat-state.json file is created for the first time (e.g., when an agent starts up for the first time):

```json
{
  "last_check": null,
  "last_skill_version": null,
  "heartbeat_timestamps": [],
  "cov_value": null,
  "cov_is_warning": false,
  "last_alert_time": null,
  "active_hours": null
}

```

All fields are present but most are null or empty. The `heartbeat_timestamps` array grows as the heartbeat script executes, and CoV metrics are computed once the buffer reaches 20 entries.

## Field Update Lifecycle

1. **last_check**: Updated on every heartbeat execution

2. **heartbeat_timestamps**: Appended with Unix epoch timestamp; kept circular at 20 entries max

3. **cov_value**: Computed and updated every heartbeat after warmup (≥20 entries)

4. **cov_is_warning**: Updated based on whether `cov_value > 0.4`

5. **last_alert_time**: Updated only when NTFY alert is actually sent (not on every warning state change)

6. **active_hours**: Set once at agent initialization, rarely changes (overridable per-agent)

## Validation Rules

- `last_check`: Must be valid ISO8601 datetime or null

- `heartbeat_timestamps`: Must be an array of non-negative integers (Unix epoch)

- `cov_value`: Must be a number between 0 and 1, or null

- `cov_is_warning`: Must be boolean

- `last_alert_time`: Must be non-negative integer or null

- `active_hours`: Must match pattern `HH:MM-HH:MM` (24-hour format, HH: 00-23, MM: 00-59) or null
