-- Initialize action_queue database and schema
-- This script is executed by Docker entrypoint-initdb.d against the 'postgres' database
-- It creates the action_queue database and grants appropriate permissions

-- Create action_queue database with proper owner
CREATE DATABASE action_queue OWNER noosphere_admin ENCODING 'UTF-8' LC_COLLATE 'C' LC_CTYPE 'C';

-- Grant all privileges on the database to the user
GRANT ALL PRIVILEGES ON DATABASE action_queue TO noosphere_admin;

-- Switch to action_queue database for table creation
\c action_queue;

-- Create rate_limits table
CREATE TABLE IF NOT EXISTS rate_limits (
  agent_name TEXT PRIMARY KEY,
  last_post_timestamp BIGINT,
  last_comment_timestamp BIGINT,
  last_follow_timestamp BIGINT,
  last_dm_timestamp BIGINT,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create agent_profiles table
CREATE TABLE IF NOT EXISTS agent_profiles (
  name TEXT PRIMARY KEY,
  daily_post_max INT DEFAULT 3,
  daily_comment_max INT DEFAULT 50,
  daily_follow_max INT DEFAULT 2,
  daily_dm_max INT DEFAULT 2
);

-- Create action_logs table for observability and status tracking
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

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_action_logs_agent_created ON action_logs(agent_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_action_logs_status ON action_logs(status);

-- Grant table and sequence privileges
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO noosphere_admin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO noosphere_admin;
