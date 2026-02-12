-- ============================================================================
-- Noosphere v3.3: Cross-Agent Pattern Mining
-- ============================================================================
-- Adds pattern detection and synthesis generation capabilities for discovering
-- convergence, contradictions, and gaps across agent memories.
--
-- Migration: v3.2 → v3.3
-- Run as: noosphere_admin
-- ============================================================================

BEGIN;

-- ============================================================================
-- Schema Updates
-- ============================================================================

-- Table: noosphere_patterns
-- Stores discovered patterns across agent memories (convergence, contradictions, gaps)
CREATE TABLE IF NOT EXISTS noosphere_patterns (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_type      TEXT NOT NULL CHECK (pattern_type IN ('convergence', 'contradiction', 'gap')),
  title             TEXT NOT NULL,
  description       TEXT NOT NULL,
  agent_ids         TEXT[] NOT NULL,  -- Agents involved in pattern
  memory_ids        UUID[] NOT NULL,  -- Related memories
  tags              TEXT[] DEFAULT '{}',
  confidence        NUMERIC(3,2) NOT NULL DEFAULT 0.60,
  supporting_evidence JSONB NOT NULL,  -- Detailed evidence with memory excerpts
  metadata          JSONB DEFAULT NULL,  -- Additional pattern-specific data
  status            TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'invalid')),
  detected_at       TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT confidence_range CHECK (confidence BETWEEN 0.0 AND 1.0),
  CONSTRAINT min_agents CHECK (array_length(agent_ids, 1) >= 2),
  CONSTRAINT min_memories CHECK (array_length(memory_ids, 1) >= 2)
);

-- Indexes for efficient pattern queries
CREATE INDEX idx_patterns_type ON noosphere_patterns(pattern_type);
CREATE INDEX idx_patterns_agents ON noosphere_patterns USING GIN(agent_ids);
CREATE INDEX idx_patterns_memories ON noosphere_patterns USING GIN(memory_ids);
CREATE INDEX idx_patterns_tags ON noosphere_patterns USING GIN(tags);
CREATE INDEX idx_patterns_status ON noosphere_patterns(status);
CREATE INDEX idx_patterns_confidence ON noosphere_patterns(confidence DESC);
CREATE INDEX idx_patterns_detected ON noosphere_patterns(detected_at DESC);

-- Table: noosphere_syntheses
-- AI-generated syntheses from patterns, subject to Council review
CREATE TABLE IF NOT EXISTS noosphere_syntheses (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_id        UUID NOT NULL REFERENCES noosphere_patterns(id) ON DELETE CASCADE,
  type              TEXT NOT NULL CHECK (type IN ('insight', 'pattern', 'strategy', 'preference', 'lesson')),
  content           TEXT NOT NULL,
  content_json      JSONB DEFAULT NULL,
  tags              TEXT[] DEFAULT '{}',
  confidence        NUMERIC(3,2) NOT NULL DEFAULT 0.60,
  supporting_evidence JSONB NOT NULL,  -- Memory excerpts from pattern
  rationale         TEXT NOT NULL,  -- AI explanation of synthesis
  source_trace_id   TEXT UNIQUE,  -- e.g., 'synthesis:pattern-abc123'
  status            TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'under_review', 'accepted', 'rejected')),
  reviewed_by       TEXT[] DEFAULT '{}',  -- Agents who reviewed
  review_notes      TEXT DEFAULT NULL,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  promoted_memory_id UUID REFERENCES noosphere_memory(id) ON DELETE SET NULL,  -- If accepted and promoted

  CONSTRAINT confidence_range CHECK (confidence BETWEEN 0.0 AND 1.0)
);

-- Indexes for synthesis management
CREATE INDEX idx_syntheses_pattern ON noosphere_syntheses(pattern_id);
CREATE INDEX idx_syntheses_type ON noosphere_syntheses(type);
CREATE INDEX idx_syntheses_status ON noosphere_syntheses(status);
CREATE INDEX idx_syntheses_created ON noosphere_syntheses(created_at DESC);
CREATE INDEX idx_syntheses_promoted ON noosphere_syntheses(promoted_memory_id);

-- Table: noosphere_synthesis_reviews
-- Track Council review process for syntheses
CREATE TABLE IF NOT EXISTS noosphere_synthesis_reviews (
  id                SERIAL PRIMARY KEY,
  synthesis_id      UUID NOT NULL REFERENCES noosphere_syntheses(id) ON DELETE CASCADE,
  reviewer_agent_id TEXT NOT NULL,
  decision          TEXT NOT NULL CHECK (decision IN ('approve', 'reject', 'abstain')),
  notes             TEXT DEFAULT NULL,
  reviewed_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_synthesis_reviews_synthesis ON noosphere_synthesis_reviews(synthesis_id);
CREATE INDEX idx_synthesis_reviews_agent ON noosphere_synthesis_reviews(reviewer_agent_id);

-- ============================================================================
-- PostgreSQL Functions for Pattern Mining
-- ============================================================================

-- Function: find_convergence_candidates
-- Finds memories with similar embeddings across different agents
CREATE OR REPLACE FUNCTION find_convergence_candidates(
  p_similarity_threshold NUMERIC DEFAULT 0.85,
  p_min_agents INTEGER DEFAULT 3,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  memory_ids UUID[],
  agent_ids TEXT[],
  avg_similarity NUMERIC,
  common_tags TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  WITH similar_pairs AS (
    -- Find pairs of memories from different agents with high similarity
    SELECT
      m1.id as id1,
      m2.id as id2,
      m1.agent_id as agent1,
      m2.agent_id as agent2,
      m1.tags || m2.tags as all_tags,
      1 - (m1.embedding <=> m2.embedding) as similarity
    FROM noosphere_memory m1
    CROSS JOIN noosphere_memory m2
    WHERE m1.agent_id != m2.agent_id
      AND m1.embedding IS NOT NULL
      AND m2.embedding IS NOT NULL
      AND m1.id < m2.id  -- Avoid duplicates
      AND 1 - (m1.embedding <=> m2.embedding) >= p_similarity_threshold
  ),
  -- Group into clusters of similar memories
  clusters AS (
    SELECT
      array_agg(DISTINCT sp.id1) || array_agg(DISTINCT sp.id2) as mem_ids,
      array_agg(DISTINCT sp.agent1) || array_agg(DISTINCT sp.agent2) as ag_ids,
      AVG(sp.similarity) as avg_sim,
      array_agg(DISTINCT u.tag) as tags
    FROM similar_pairs sp
    CROSS JOIN LATERAL unnest(sp.all_tags) as u(tag)
    GROUP BY sp.id1, sp.id2
    HAVING COUNT(DISTINCT sp.agent1) + COUNT(DISTINCT sp.agent2) >= p_min_agents
  )
  SELECT
    c.mem_ids as memory_ids,
    c.ag_ids as agent_ids,
    c.avg_sim::NUMERIC(3,2) as avg_similarity,
    c.tags as common_tags
  FROM clusters c
  ORDER BY c.avg_sim DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function: detect_contradictions
-- Finds memories with opposing content on similar topics
CREATE OR REPLACE FUNCTION detect_contradictions(
  p_tag_overlap_min INTEGER DEFAULT 2,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  memory_id_1 UUID,
  memory_id_2 UUID,
  agent_id_1 TEXT,
  agent_id_2 TEXT,
  common_tags TEXT[],
  confidence_diff NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    m1.id,
    m2.id,
    m1.agent_id,
    m2.agent_id,
    ARRAY(SELECT unnest(m1.tags) INTERSECT SELECT unnest(m2.tags)) as common_tags,
    ABS(m1.confidence - m2.confidence)::NUMERIC(3,2)
  FROM noosphere_memory m1
  CROSS JOIN noosphere_memory m2
  WHERE m1.agent_id != m2.agent_id
    AND m1.id < m2.id
    AND m1.type = m2.type
    AND array_length(ARRAY(SELECT unnest(m1.tags) INTERSECT SELECT unnest(m2.tags)), 1) >= p_tag_overlap_min
    -- Check if embeddings suggest opposition (low similarity)
    AND m1.embedding IS NOT NULL
    AND m2.embedding IS NOT NULL
    AND 1 - (m1.embedding <=> m2.embedding) < 0.50  -- Low similarity suggests different perspectives
  ORDER BY array_length(ARRAY(SELECT unnest(m1.tags) INTERSECT SELECT unnest(m2.tags)), 1) DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function: analyze_gaps
-- Identifies memory type imbalances across agents
CREATE OR REPLACE FUNCTION analyze_gaps()
RETURNS TABLE (
  agent_id TEXT,
  memory_type TEXT,
  memory_count INTEGER,
  avg_count_across_agents NUMERIC,
  gap_score NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH type_counts AS (
    SELECT
      m.agent_id,
      m.type as mem_type,
      COUNT(*) as cnt
    FROM noosphere_memory m
    GROUP BY m.agent_id, m.type
  ),
  avg_counts AS (
    SELECT
      mem_type,
      AVG(cnt) as avg_cnt
    FROM type_counts
    GROUP BY mem_type
  )
  SELECT
    tc.agent_id as agent_id,
    tc.mem_type as memory_type,
    tc.cnt::INTEGER as memory_count,
    ac.avg_cnt::NUMERIC(5,1) as avg_count_across_agents,
    (ac.avg_cnt - tc.cnt)::NUMERIC(5,1) as gap_score
  FROM type_counts tc
  JOIN avg_counts ac ON tc.mem_type = ac.mem_type
  WHERE ac.avg_cnt > tc.cnt * 1.5  -- Agent has significantly fewer than average
  ORDER BY (ac.avg_cnt - tc.cnt) DESC;
END;
$$ LANGUAGE plpgsql;

-- Function: get_pattern_memories
-- Retrieves full memory details for a pattern
CREATE OR REPLACE FUNCTION get_pattern_memories(p_pattern_id UUID)
RETURNS TABLE (
  memory_id UUID,
  agent_id TEXT,
  type TEXT,
  content TEXT,
  tags TEXT[],
  confidence NUMERIC,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    m.agent_id,
    m.type,
    m.content,
    m.tags,
    m.confidence,
    m.created_at
  FROM noosphere_patterns p
  CROSS JOIN LATERAL unnest(p.memory_ids) as memory_id
  JOIN noosphere_memory m ON m.id = memory_id
  WHERE p.id = p_pattern_id
  ORDER BY m.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Grants
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON noosphere_patterns TO noosphere_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON noosphere_syntheses TO noosphere_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON noosphere_synthesis_reviews TO noosphere_user;
GRANT USAGE ON SEQUENCE noosphere_synthesis_reviews_id_seq TO noosphere_user;

GRANT EXECUTE ON FUNCTION find_convergence_candidates TO noosphere_user;
GRANT EXECUTE ON FUNCTION detect_contradictions TO noosphere_user;
GRANT EXECUTE ON FUNCTION analyze_gaps TO noosphere_user;
GRANT EXECUTE ON FUNCTION get_pattern_memories TO noosphere_user;

-- ============================================================================
-- Verification
-- ============================================================================

-- Test pattern mining functions
DO $$
DECLARE
  convergence_count INTEGER;
  contradiction_count INTEGER;
  gap_count INTEGER;
BEGIN
  -- Test convergence detection
  SELECT COUNT(*) INTO convergence_count
  FROM find_convergence_candidates(0.85, 2, 10);

  -- Test contradiction detection
  SELECT COUNT(*) INTO contradiction_count
  FROM detect_contradictions(1, 10);

  -- Test gap analysis
  SELECT COUNT(*) INTO gap_count
  FROM analyze_gaps();

  RAISE NOTICE 'Pattern mining test results:';
  RAISE NOTICE '  Convergence candidates: %', convergence_count;
  RAISE NOTICE '  Contradiction candidates: %', contradiction_count;
  RAISE NOTICE '  Gap candidates: %', gap_count;
END $$;

-- Summary
SELECT
  'v3.3 Migration Complete' as status,
  (SELECT COUNT(*) FROM noosphere_patterns) as pattern_count,
  (SELECT COUNT(*) FROM noosphere_syntheses) as synthesis_count,
  (SELECT COUNT(*) FROM noosphere_memory) as total_memories,
  (SELECT COUNT(DISTINCT agent_id) FROM noosphere_memory) as unique_agents;

COMMIT;
