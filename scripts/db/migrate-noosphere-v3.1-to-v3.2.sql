-- ============================================================================
-- Noosphere v3.1 → v3.2 Migration: Confidence Decay System
-- ============================================================================
-- This migration adds time-based confidence decay with reinforcement
--
-- Features:
--   - Confidence decreases over time if not accessed
--   - Access reinforcement boosts confidence
--   - Configurable decay rates per memory type
--   - Auto-eviction when confidence drops below threshold
--
-- Run: psql -h localhost -U noosphere_admin -d noosphere < migrate-noosphere-v3.1-to-v3.2.sql
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. Add decay-related columns to noosphere_memory
-- ============================================================================

-- Store initial confidence for reinforcement cap
ALTER TABLE noosphere_memory
  ADD COLUMN IF NOT EXISTS confidence_initial NUMERIC(3,2) DEFAULT NULL;

-- Track last access time for decay calculation
ALTER TABLE noosphere_memory
  ADD COLUMN IF NOT EXISTS last_accessed_at TIMESTAMPTZ DEFAULT now();

-- Count total accesses
ALTER TABLE noosphere_memory
  ADD COLUMN IF NOT EXISTS access_count INTEGER DEFAULT 0;

-- Count reinforcements (confidence boosts)
ALTER TABLE noosphere_memory
  ADD COLUMN IF NOT EXISTS reinforcement_count INTEGER DEFAULT 0;

-- Per-memory decay rate (defaults from config table)
ALTER TABLE noosphere_memory
  ADD COLUMN IF NOT EXISTS decay_rate NUMERIC(4,3) DEFAULT NULL;

-- Backfill confidence_initial for existing memories
UPDATE noosphere_memory
SET confidence_initial = confidence
WHERE confidence_initial IS NULL;

-- Backfill last_accessed_at for existing memories
UPDATE noosphere_memory
SET last_accessed_at = updated_at
WHERE last_accessed_at IS NULL OR last_accessed_at < updated_at;

-- Add indexes for decay queries
CREATE INDEX IF NOT EXISTS idx_memory_last_accessed
  ON noosphere_memory(last_accessed_at);

CREATE INDEX IF NOT EXISTS idx_memory_confidence_last_accessed
  ON noosphere_memory(confidence, last_accessed_at);

-- ============================================================================
-- 2. Create noosphere_decay_config table
-- ============================================================================

CREATE TABLE IF NOT EXISTS noosphere_decay_config (
  memory_type         TEXT PRIMARY KEY
    CHECK (memory_type IN ('insight','pattern','strategy','preference','lesson')),
  decay_rate          NUMERIC(4,3) NOT NULL DEFAULT 0.010,  -- Per week
  min_confidence      NUMERIC(3,2) NOT NULL DEFAULT 0.30,
  reinforcement_boost NUMERIC(3,2) DEFAULT 0.05,
  auto_evict_enabled  BOOLEAN DEFAULT TRUE,
  updated_at          TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT decay_rate_valid CHECK (decay_rate >= 0 AND decay_rate <= 1),
  CONSTRAINT min_confidence_valid CHECK (min_confidence >= 0 AND min_confidence <= 1),
  CONSTRAINT reinforcement_valid CHECK (reinforcement_boost >= 0 AND reinforcement_boost <= 0.50)
);

-- Insert default decay configuration for each memory type
INSERT INTO noosphere_decay_config
  (memory_type, decay_rate, min_confidence, reinforcement_boost, auto_evict_enabled)
VALUES
  -- Insights decay faster (novel understanding becomes stale)
  ('insight', 0.015, 0.40, 0.05, TRUE),

  -- Patterns decay moderately (recurring observations need validation)
  ('pattern', 0.010, 0.35, 0.04, TRUE),

  -- Strategies decay slower (process improvements remain relevant longer)
  ('strategy', 0.008, 0.30, 0.06, TRUE),

  -- Preferences decay slowest (agent characteristics are stable)
  ('preference', 0.005, 0.25, 0.03, TRUE),

  -- Lessons decay moderately (learnings need periodic reinforcement)
  ('lesson', 0.012, 0.35, 0.05, TRUE)
ON CONFLICT (memory_type) DO NOTHING;

-- ============================================================================
-- 3. Decay calculation function
-- ============================================================================

-- Function to calculate time-based confidence decay
CREATE OR REPLACE FUNCTION calculate_decay(
  p_memory_id UUID
) RETURNS NUMERIC AS $$
DECLARE
  v_current_confidence NUMERIC(3,2);
  v_initial_confidence NUMERIC(3,2);
  v_last_accessed TIMESTAMPTZ;
  v_memory_type TEXT;
  v_decay_rate NUMERIC(4,3);
  v_min_confidence NUMERIC(3,2);
  v_custom_decay_rate NUMERIC(4,3);
  v_weeks_elapsed NUMERIC;
  v_decay_amount NUMERIC;
  v_new_confidence NUMERIC(3,2);
BEGIN
  -- Get memory details
  SELECT
    confidence,
    confidence_initial,
    last_accessed_at,
    type,
    decay_rate
  INTO
    v_current_confidence,
    v_initial_confidence,
    v_last_accessed,
    v_memory_type,
    v_custom_decay_rate
  FROM noosphere_memory
  WHERE id = p_memory_id;

  -- Get decay configuration for this type
  SELECT
    COALESCE(v_custom_decay_rate, decay_rate),
    min_confidence
  INTO
    v_decay_rate,
    v_min_confidence
  FROM noosphere_decay_config
  WHERE memory_type = v_memory_type;

  -- Calculate weeks since last access
  v_weeks_elapsed := EXTRACT(EPOCH FROM (now() - v_last_accessed)) / (7 * 24 * 60 * 60);

  -- Calculate decay amount
  v_decay_amount := v_decay_rate * v_weeks_elapsed;

  -- Apply decay
  v_new_confidence := GREATEST(
    v_current_confidence - v_decay_amount,
    v_min_confidence
  );

  RETURN v_new_confidence;
END;
$$ LANGUAGE plpgsql;

-- Function to apply decay to a memory
CREATE OR REPLACE FUNCTION apply_decay(
  p_memory_id UUID
) RETURNS NUMERIC AS $$
DECLARE
  v_new_confidence NUMERIC(3,2);
BEGIN
  -- Calculate decay
  v_new_confidence := calculate_decay(p_memory_id);

  -- Update memory
  UPDATE noosphere_memory
  SET
    confidence = v_new_confidence,
    updated_at = now()
  WHERE id = p_memory_id;

  RETURN v_new_confidence;
END;
$$ LANGUAGE plpgsql;

-- Function to reinforce (boost confidence on access)
CREATE OR REPLACE FUNCTION reinforce_memory(
  p_memory_id UUID
) RETURNS NUMERIC AS $$
DECLARE
  v_current_confidence NUMERIC(3,2);
  v_initial_confidence NUMERIC(3,2);
  v_memory_type TEXT;
  v_reinforcement_boost NUMERIC(3,2);
  v_new_confidence NUMERIC(3,2);
BEGIN
  -- Get memory details
  SELECT
    confidence,
    confidence_initial,
    type
  INTO
    v_current_confidence,
    v_initial_confidence,
    v_memory_type
  FROM noosphere_memory
  WHERE id = p_memory_id;

  -- Get reinforcement boost for this type
  SELECT reinforcement_boost
  INTO v_reinforcement_boost
  FROM noosphere_decay_config
  WHERE memory_type = v_memory_type;

  -- Calculate new confidence (capped at initial)
  v_new_confidence := LEAST(
    v_current_confidence + v_reinforcement_boost,
    v_initial_confidence
  );

  -- Update memory
  UPDATE noosphere_memory
  SET
    confidence = v_new_confidence,
    last_accessed_at = now(),
    access_count = access_count + 1,
    reinforcement_count = CASE
      WHEN v_new_confidence > v_current_confidence
      THEN reinforcement_count + 1
      ELSE reinforcement_count
    END,
    updated_at = now()
  WHERE id = p_memory_id;

  RETURN v_new_confidence;
END;
$$ LANGUAGE plpgsql;

-- Function to apply decay to all memories (batch job)
CREATE OR REPLACE FUNCTION apply_decay_batch(
  p_agent_id TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 100
) RETURNS TABLE(
  memory_id UUID,
  old_confidence NUMERIC,
  new_confidence NUMERIC,
  decayed BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  WITH updated AS (
    UPDATE noosphere_memory m
    SET
      confidence = GREATEST(
        m.confidence - (
          SELECT COALESCE(m.decay_rate, dc.decay_rate) * EXTRACT(EPOCH FROM (now() - m.last_accessed_at)) / (7 * 24 * 60 * 60)
          FROM noosphere_decay_config dc
          WHERE dc.memory_type = m.type
        ),
        (SELECT min_confidence FROM noosphere_decay_config WHERE memory_type = m.type)
      ),
      updated_at = now()
    WHERE
      (p_agent_id IS NULL OR m.agent_id = p_agent_id)
      AND m.last_accessed_at < now() - INTERVAL '1 day'  -- Only decay if not accessed today
      AND m.id IN (
        SELECT id FROM noosphere_memory
        WHERE (p_agent_id IS NULL OR agent_id = p_agent_id)
        ORDER BY last_accessed_at ASC
        LIMIT p_limit
      )
    RETURNING
      m.id,
      m.confidence + (
        SELECT COALESCE(m.decay_rate, dc.decay_rate) * EXTRACT(EPOCH FROM (now() - m.last_accessed_at)) / (7 * 24 * 60 * 60)
        FROM noosphere_decay_config dc
        WHERE dc.memory_type = m.type
      ) as old_conf,
      m.confidence as new_conf
  )
  SELECT
    updated.id,
    updated.old_conf,
    updated.new_conf,
    (updated.old_conf > updated.new_conf) as decayed
  FROM updated;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-evict low-confidence memories
CREATE OR REPLACE FUNCTION auto_evict_low_confidence(
  p_agent_id TEXT DEFAULT NULL
) RETURNS TABLE(
  evicted_id UUID,
  agent_id TEXT,
  memory_type TEXT,
  confidence NUMERIC,
  reason TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH to_evict AS (
    SELECT
      m.id,
      m.agent_id,
      m.type,
      m.confidence,
      'confidence below minimum threshold' as eviction_reason
    FROM noosphere_memory m
    JOIN noosphere_decay_config dc ON m.type = dc.memory_type
    WHERE
      (p_agent_id IS NULL OR m.agent_id = p_agent_id)
      AND dc.auto_evict_enabled = TRUE
      AND m.confidence < dc.min_confidence
  ),
  deleted AS (
    DELETE FROM noosphere_memory
    WHERE id IN (SELECT id FROM to_evict)
    RETURNING id
  )
  SELECT
    te.id,
    te.agent_id,
    te.type,
    te.confidence,
    te.eviction_reason
  FROM to_evict te
  WHERE te.id IN (SELECT id FROM deleted);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 4. Update version tracking
-- ============================================================================

UPDATE noosphere_agent_stats SET schema_version = '3.2';

-- Add decay statistics columns
ALTER TABLE noosphere_agent_stats
  ADD COLUMN IF NOT EXISTS last_decay_run TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS memories_decayed_total INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS memories_evicted_decay INTEGER DEFAULT 0;

-- ============================================================================
-- 5. Grant permissions
-- ============================================================================

GRANT ALL PRIVILEGES ON noosphere_decay_config TO noosphere_admin;
GRANT SELECT ON noosphere_decay_config TO noosphere_user;

-- ============================================================================
-- Migration Complete
-- ============================================================================

COMMIT;

-- Verify migration
SELECT
  'v3.2 Migration Complete' AS status,
  COUNT(*) AS total_memories,
  COUNT(DISTINCT agent_id) AS unique_agents,
  AVG(confidence) AS avg_confidence,
  AVG(EXTRACT(EPOCH FROM (now() - last_accessed_at)) / (24 * 60 * 60)) AS avg_days_since_access
FROM noosphere_memory;

-- Show decay configuration
SELECT
  memory_type,
  decay_rate,
  min_confidence,
  reinforcement_boost,
  auto_evict_enabled
FROM noosphere_decay_config
ORDER BY memory_type;
