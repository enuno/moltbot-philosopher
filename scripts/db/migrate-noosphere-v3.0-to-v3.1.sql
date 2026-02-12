-- ============================================================================
-- Noosphere v3.0 → v3.1 Migration: Multi-Agent Memory Sharing
-- ============================================================================
-- This migration adds multi-agent memory sharing with permissions and audit log
--
-- Features:
--   - Memory visibility levels (private, shared, public)
--   - Fine-grained permissions (read, write, delete)
--   - Access control lists per memory
--   - Comprehensive audit logging
--
-- Run: psql -h localhost -U noosphere_user -d noosphere < migrate-noosphere-v3.0-to-v3.1.sql
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. Add columns to existing noosphere_memory table
-- ============================================================================

-- Add visibility column (private by default for backwards compatibility)
ALTER TABLE noosphere_memory
  ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'private'
    CHECK (visibility IN ('private', 'shared', 'public'));

-- Add owner_agent_id (will backfill after column creation)
ALTER TABLE noosphere_memory
  ADD COLUMN IF NOT EXISTS owner_agent_id TEXT;

-- Add indexes for new columns
CREATE INDEX IF NOT EXISTS idx_memory_visibility
  ON noosphere_memory(visibility);

CREATE INDEX IF NOT EXISTS idx_memory_owner
  ON noosphere_memory(owner_agent_id);

-- Update owner_agent_id for existing rows (one-time backfill)
UPDATE noosphere_memory
SET owner_agent_id = agent_id
WHERE owner_agent_id IS NULL;

-- ============================================================================
-- 2. Create noosphere_memory_permissions table
-- ============================================================================

CREATE TABLE IF NOT EXISTS noosphere_memory_permissions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_id       UUID NOT NULL REFERENCES noosphere_memory(id) ON DELETE CASCADE,
  agent_id        TEXT NOT NULL,  -- Agent with permission
  permission      TEXT NOT NULL
    CHECK (permission IN ('read', 'write', 'delete')),
  granted_by      TEXT NOT NULL,  -- Agent who granted permission
  granted_at      TIMESTAMPTZ DEFAULT now(),
  expires_at      TIMESTAMPTZ DEFAULT NULL,

  -- Prevent duplicate permissions
  UNIQUE(memory_id, agent_id, permission)
);

-- Indexes for permission queries
CREATE INDEX IF NOT EXISTS idx_permissions_memory
  ON noosphere_memory_permissions(memory_id);

CREATE INDEX IF NOT EXISTS idx_permissions_agent
  ON noosphere_memory_permissions(agent_id);

CREATE INDEX IF NOT EXISTS idx_permissions_expires
  ON noosphere_memory_permissions(expires_at)
  WHERE expires_at IS NOT NULL;

-- ============================================================================
-- 3. Create noosphere_access_log table
-- ============================================================================

CREATE TABLE IF NOT EXISTS noosphere_access_log (
  id              SERIAL PRIMARY KEY,
  memory_id       UUID NOT NULL REFERENCES noosphere_memory(id) ON DELETE CASCADE,
  agent_id        TEXT NOT NULL,  -- Agent accessing memory
  action          TEXT NOT NULL
    CHECK (action IN ('read', 'write', 'delete', 'share', 'unshare')),
  accessed_at     TIMESTAMPTZ DEFAULT now(),
  success         BOOLEAN NOT NULL,
  error_message   TEXT DEFAULT NULL,
  metadata        JSONB DEFAULT NULL
);

-- Indexes for access log queries
CREATE INDEX IF NOT EXISTS idx_access_log_memory
  ON noosphere_access_log(memory_id);

CREATE INDEX IF NOT EXISTS idx_access_log_agent
  ON noosphere_access_log(agent_id);

CREATE INDEX IF NOT EXISTS idx_access_log_time
  ON noosphere_access_log(accessed_at DESC);

CREATE INDEX IF NOT EXISTS idx_access_log_action
  ON noosphere_access_log(action);

-- ============================================================================
-- 4. Create helper functions
-- ============================================================================

-- Function to check if agent has permission on memory
CREATE OR REPLACE FUNCTION has_permission(
  p_memory_id UUID,
  p_agent_id TEXT,
  p_permission TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  memory_owner TEXT;
  memory_visibility TEXT;
  has_explicit_permission BOOLEAN;
BEGIN
  -- Get memory owner and visibility
  SELECT owner_agent_id, visibility INTO memory_owner, memory_visibility
  FROM noosphere_memory
  WHERE id = p_memory_id;

  -- Owner has all permissions
  IF memory_owner = p_agent_id THEN
    RETURN TRUE;
  END IF;

  -- Public memories: everyone can read
  IF memory_visibility = 'public' AND p_permission = 'read' THEN
    RETURN TRUE;
  END IF;

  -- Check explicit permissions (not expired)
  SELECT EXISTS(
    SELECT 1 FROM noosphere_memory_permissions
    WHERE memory_id = p_memory_id
      AND agent_id = p_agent_id
      AND permission = p_permission
      AND (expires_at IS NULL OR expires_at > now())
  ) INTO has_explicit_permission;

  RETURN has_explicit_permission;
END;
$$ LANGUAGE plpgsql;

-- Function to log access attempts
CREATE OR REPLACE FUNCTION log_access(
  p_memory_id UUID,
  p_agent_id TEXT,
  p_action TEXT,
  p_success BOOLEAN,
  p_error_message TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  INSERT INTO noosphere_access_log
    (memory_id, agent_id, action, success, error_message, metadata)
  VALUES
    (p_memory_id, p_agent_id, p_action, p_success, p_error_message, p_metadata);
END;
$$ LANGUAGE plpgsql;

-- Function to clean up expired permissions (run periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_permissions()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM noosphere_memory_permissions
  WHERE expires_at IS NOT NULL AND expires_at < now();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 5. Update version tracking
-- ============================================================================

-- Add version info to agent stats if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'noosphere_agent_stats'
    AND column_name = 'schema_version'
  ) THEN
    ALTER TABLE noosphere_agent_stats
      ADD COLUMN schema_version TEXT DEFAULT '3.1';
  ELSE
    UPDATE noosphere_agent_stats SET schema_version = '3.1';
  END IF;
END $$;

-- ============================================================================
-- 6. Grant permissions to database users
-- ============================================================================

-- Check if noosphere_user exists, create if needed
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'noosphere_user') THEN
    CREATE USER noosphere_user WITH PASSWORD 'changeme_noosphere_user_2026';
    RAISE NOTICE 'Created noosphere_user';
  END IF;
END $$;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON noosphere_memory_permissions
  TO noosphere_user;

GRANT SELECT, INSERT ON noosphere_access_log
  TO noosphere_user;

GRANT USAGE, SELECT ON SEQUENCE noosphere_access_log_id_seq
  TO noosphere_user;

-- Grant admin all permissions
GRANT ALL PRIVILEGES ON noosphere_memory_permissions TO noosphere_admin;
GRANT ALL PRIVILEGES ON noosphere_access_log TO noosphere_admin;
GRANT ALL PRIVILEGES ON SEQUENCE noosphere_access_log_id_seq TO noosphere_admin;

-- ============================================================================
-- Migration Complete
-- ============================================================================

COMMIT;

-- Verify migration
SELECT
  'v3.1 Migration Complete' AS status,
  COUNT(*) AS total_memories,
  COUNT(DISTINCT owner_agent_id) AS unique_owners,
  COUNT(CASE WHEN visibility = 'private' THEN 1 END) AS private_memories,
  COUNT(CASE WHEN visibility = 'shared' THEN 1 END) AS shared_memories,
  COUNT(CASE WHEN visibility = 'public' THEN 1 END) AS public_memories
FROM noosphere_memory;

-- Show new tables
SELECT
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) AS column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_name IN ('noosphere_memory_permissions', 'noosphere_access_log')
ORDER BY table_name;
