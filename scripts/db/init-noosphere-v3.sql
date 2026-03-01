-- Noosphere v3.0 Database Initialization
-- PostgreSQL 16 + pgvector
-- 5-Type Memory Architecture

-- Create noosphere_admin role if it doesn't exist (needed for both noosphere and action_queue databases)
CREATE ROLE IF NOT EXISTS noosphere_admin WITH LOGIN PASSWORD 'changeme_noosphere_2026' CREATEDB;

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Main memory table (5-type architecture)
CREATE TABLE IF NOT EXISTS noosphere_memory (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id        TEXT NOT NULL,  -- e.g., 'classical', 'existentialist'
  type            TEXT NOT NULL CHECK (type IN ('insight','pattern','strategy','preference','lesson')),
  content         TEXT NOT NULL,
  content_json    JSONB DEFAULT NULL,
  embedding       VECTOR(1536),   -- OpenAI ada-002 or similar
  confidence      NUMERIC(3,2) NOT NULL DEFAULT 0.60,
  tags            TEXT[] DEFAULT '{}',
  source_trace_id TEXT UNIQUE,    -- e.g., 'council:iteration-5', 'post:abc123'
  superseded_by   UUID REFERENCES noosphere_memory(id),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  expires_at      TIMESTAMPTZ DEFAULT NULL,

  CONSTRAINT confidence_range CHECK (confidence BETWEEN 0.0 AND 1.0)
);

-- Indexes for query patterns
CREATE INDEX IF NOT EXISTS idx_memory_agent_type ON noosphere_memory(agent_id, type);
CREATE INDEX IF NOT EXISTS idx_memory_tags ON noosphere_memory USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_memory_confidence ON noosphere_memory(confidence);
CREATE INDEX IF NOT EXISTS idx_memory_source_trace ON noosphere_memory(source_trace_id);
CREATE INDEX IF NOT EXISTS idx_memory_created_at ON noosphere_memory(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_memory_embedding ON noosphere_memory
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Eviction tracking (200 cap per agent)
CREATE TABLE IF NOT EXISTS noosphere_agent_stats (
  agent_id        TEXT PRIMARY KEY,
  memory_count    INTEGER DEFAULT 0,
  last_eviction   TIMESTAMPTZ,
  insights_count  INTEGER DEFAULT 0,
  patterns_count  INTEGER DEFAULT 0,
  strategies_count INTEGER DEFAULT 0,
  preferences_count INTEGER DEFAULT 0,
  lessons_count   INTEGER DEFAULT 0,
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Migration audit log
CREATE TABLE IF NOT EXISTS noosphere_migration_log (
  id              SERIAL PRIMARY KEY,
  legacy_file     TEXT NOT NULL,
  new_memory_id   UUID REFERENCES noosphere_memory(id),
  migrated_at     TIMESTAMPTZ DEFAULT now(),
  migration_notes TEXT
);

-- Trigger to update agent stats on memory insert/update/delete
CREATE OR REPLACE FUNCTION update_agent_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO noosphere_agent_stats (agent_id, memory_count, updated_at)
    VALUES (NEW.agent_id, 1, now())
    ON CONFLICT (agent_id) DO UPDATE
    SET memory_count = noosphere_agent_stats.memory_count + 1,
        updated_at = now();

    -- Update type-specific counters
    CASE NEW.type
      WHEN 'insight' THEN
        UPDATE noosphere_agent_stats SET insights_count = insights_count + 1 WHERE agent_id = NEW.agent_id;
      WHEN 'pattern' THEN
        UPDATE noosphere_agent_stats SET patterns_count = patterns_count + 1 WHERE agent_id = NEW.agent_id;
      WHEN 'strategy' THEN
        UPDATE noosphere_agent_stats SET strategies_count = strategies_count + 1 WHERE agent_id = NEW.agent_id;
      WHEN 'preference' THEN
        UPDATE noosphere_agent_stats SET preferences_count = preferences_count + 1 WHERE agent_id = NEW.agent_id;
      WHEN 'lesson' THEN
        UPDATE noosphere_agent_stats SET lessons_count = lessons_count + 1 WHERE agent_id = NEW.agent_id;
    END CASE;

  ELSIF TG_OP = 'DELETE' THEN
    UPDATE noosphere_agent_stats
    SET memory_count = GREATEST(0, memory_count - 1),
        updated_at = now()
    WHERE agent_id = OLD.agent_id;

    -- Update type-specific counters
    CASE OLD.type
      WHEN 'insight' THEN
        UPDATE noosphere_agent_stats SET insights_count = GREATEST(0, insights_count - 1) WHERE agent_id = OLD.agent_id;
      WHEN 'pattern' THEN
        UPDATE noosphere_agent_stats SET patterns_count = GREATEST(0, patterns_count - 1) WHERE agent_id = OLD.agent_id;
      WHEN 'strategy' THEN
        UPDATE noosphere_agent_stats SET strategies_count = GREATEST(0, strategies_count - 1) WHERE agent_id = OLD.agent_id;
      WHEN 'preference' THEN
        UPDATE noosphere_agent_stats SET preferences_count = GREATEST(0, preferences_count - 1) WHERE agent_id = OLD.agent_id;
      WHEN 'lesson' THEN
        UPDATE noosphere_agent_stats SET lessons_count = GREATEST(0, lessons_count - 1) WHERE agent_id = OLD.agent_id;
    END CASE;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER memory_stats_trigger
  AFTER INSERT OR DELETE ON noosphere_memory
  FOR EACH ROW
  EXECUTE FUNCTION update_agent_stats();

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE noosphere TO noosphere_admin;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO noosphere_admin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO noosphere_admin;

-- Insert initial agent stats for all 9 agents
INSERT INTO noosphere_agent_stats (agent_id) VALUES
  ('classical'),
  ('existentialist'),
  ('transcendentalist'),
  ('joyce'),
  ('enlightenment'),
  ('beat'),
  ('cyberpunk'),
  ('satirist'),
  ('scientist')
ON CONFLICT (agent_id) DO NOTHING;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Noosphere v3.0 database initialized successfully';
  RAISE NOTICE 'Tables created: noosphere_memory, noosphere_agent_stats, noosphere_migration_log';
  RAISE NOTICE 'Indexes: agent_type, tags (GIN), confidence, source_trace, created_at, embedding (ivfflat)';
  RAISE NOTICE 'Triggers: memory_stats_trigger (auto-updates agent stats)';
END $$;
