#!/bin/bash
set -euo pipefail

# Usage: bash migrate-actions-to-postgres.sh <actions.json> <rate_limits.json>
# Migrates SQLite action-queue data to PostgreSQL

if [ $# -lt 2 ]; then
    echo "Usage: $0 <actions.json> <rate_limits.json>"
    exit 1
fi

ACTIONS_FILE="$1"
RATE_LIMITS_FILE="$2"
DB_URL="${DATABASE_URL:-postgresql://noosphere_admin:changeme_noosphere_2026@localhost:5432/action_queue}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-changeme_noosphere_2026}"

echo "🔄 Starting migration from SQLite to PostgreSQL..."

# 1. Ensure database exists
echo "📦 Creating action_queue database..."
PGPASSWORD="$POSTGRES_PASSWORD" psql -h localhost -U noosphere_admin -d postgres < scripts/db/init-action-queue.sql 2>/dev/null || true

# 2. Migrate rate limits
echo "⏱️  Migrating rate limits..."
PGPASSWORD="$POSTGRES_PASSWORD" psql "$DB_URL" << EOF
DELETE FROM rate_limits;
COPY rate_limits(agent_name, last_post_timestamp, last_comment_timestamp, last_follow_timestamp, last_dm_timestamp)
FROM STDIN WITH (FORMAT CSV, HEADER);
EOF

jq -r '[.[] | [.agent_name, .last_post_timestamp, .last_comment_timestamp, .last_follow_timestamp, .last_dm_timestamp] | @csv] | .[]' "$RATE_LIMITS_FILE" | \
  PGPASSWORD="$POSTGRES_PASSWORD" psql "$DB_URL" -c "COPY rate_limits(agent_name, last_post_timestamp, last_comment_timestamp, last_follow_timestamp, last_dm_timestamp) FROM STDIN"

# 3. Migrate actions (we'll insert these as job specs for pg-boss to process)
echo "✅ Migrating actions..."
jq -r '.[] | @json' "$ACTIONS_FILE" | while read -r action; do
  agent_name=$(echo "$action" | jq -r '.agent_name')
  action_type=$(echo "$action" | jq -r '.action_type')
  priority=$(echo "$action" | jq -r '.priority // 1')
  payload=$(echo "$action" | jq -r '.payload')
  status=$(echo "$action" | jq -r '.status')

  # Only migrate pending/scheduled actions; skip completed/failed
  if [[ "$status" == "pending" ]] || [[ "$status" == "scheduled" ]]; then
    # Log the action for pg-boss to pick up
    PGPASSWORD="$POSTGRES_PASSWORD" psql "$DB_URL" -c \
      "INSERT INTO action_logs(agent_name, action_type, status, attempts) VALUES('$agent_name', '$action_type', 'pending', 0);"
  fi
done

echo "✨ Migration complete!"
echo "📊 Verify with: psql $DB_URL -c 'SELECT COUNT(*) FROM rate_limits; SELECT COUNT(*) FROM action_logs;'"
