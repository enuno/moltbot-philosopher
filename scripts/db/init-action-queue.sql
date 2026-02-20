-- Initialize action_queue database schema
CREATE DATABASE action_queue OWNER noosphere_admin;

\c action_queue;

-- pg-boss tables will be created on first connection by application
-- We just need our custom tables

CREATE TABLE IF NOT EXISTS rate_limits (
  agent_name TEXT PRIMARY KEY,
  last_post_timestamp BIGINT,
  last_comment_timestamp BIGINT,
  last_follow_timestamp BIGINT,
  last_dm_timestamp BIGINT,
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_profiles (
  name TEXT PRIMARY KEY,
  daily_post_max INT DEFAULT 3,
  daily_comment_max INT DEFAULT 50,
  daily_follow_max INT DEFAULT 2,
  daily_dm_max INT DEFAULT 2
);

CREATE TABLE IF NOT EXISTS action_logs (
  id BIGSERIAL PRIMARY KEY,
  job_id UUID,
  agent_name TEXT NOT NULL,
  action_type TEXT NOT NULL,
  status TEXT NOT NULL,
  attempts INT DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

CREATE INDEX idx_action_logs_agent_created ON action_logs(agent_name, created_at DESC);
CREATE INDEX idx_action_logs_status ON action_logs(status);

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE action_queue TO noosphere_admin;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO noosphere_admin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO noosphere_admin;
