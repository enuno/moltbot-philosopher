/**
 * Noosphere v3.0 Service - Main Entry Point
 * 5-Type Memory Architecture API
 */

require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const OpenAI = require('openai');

const app = express();
const PORT = process.env.PORT || 3006;

// Setup logging
const logDir = process.env.LOG_DIR || '/app/logs';
const accessLogStream = fs.createWriteStream(
  path.join(logDir, 'noosphere-access.log'),
  { flags: 'a' }
);

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// OpenAI client (optional)
let openai = null;
if (process.env.OPENAI_API_KEY && process.env.ENABLE_EMBEDDINGS === 'true') {
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

// Rate limiting - 100 requests per minute per IP
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' }
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(morgan('combined')); // Console
app.use(morgan('combined', { stream: accessLogStream })); // File
app.use(limiter); // Apply rate limiting to all routes

// Authentication middleware
function authenticate(req, res, next) {
  const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
  if (!apiKey || apiKey !== process.env.MOLTBOOK_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// Health check (no auth, no rate limit needed)
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({
      status: 'healthy',
      version: '3.2.0',
      database: 'connected',
      embeddings: openai ? 'enabled' : 'disabled',
      features: [
        'multi-agent-sharing',
        'permission-model',
        'access-logging',
        'confidence-decay',
        'reinforcement-learning'
      ]
    });
  } catch (error) {
    res.status(503).json({ status: 'unhealthy', error: error.message });
  }
});

// Generate embedding
async function generateEmbedding(text) {
  if (!openai) return null;

  try {
    const response = await openai.embeddings.create({
      model: process.env.EMBEDDING_MODEL || 'text-embedding-ada-002',
      input: text,
    });
    return response.data[0].embedding;
  } catch (error) {
    console.error('Embedding generation failed:', error.message);
    return null;
  }
}

// POST /memories - Create memory
app.post('/memories', authenticate, async (req, res) => {
  const { agent_id, type, content, content_json, confidence, tags, source_trace_id, visibility } = req.body;

  // Validation
  if (!agent_id || !type || !content) {
    return res.status(400).json({ error: 'Missing required fields: agent_id, type, content' });
  }

  const validTypes = ['insight', 'pattern', 'strategy', 'preference', 'lesson'];
  if (!validTypes.includes(type)) {
    return res.status(400).json({ error: `Invalid type. Must be one of: ${validTypes.join(', ')}` });
  }

  const validVisibilities = ['private', 'shared', 'public'];
  const memoryVisibility = visibility || 'private';
  if (!validVisibilities.includes(memoryVisibility)) {
    return res.status(400).json({ error: `Invalid visibility. Must be one of: ${validVisibilities.join(', ')}` });
  }

  try {
    // Check 200-cap per agent
    const statsResult = await pool.query(
      'SELECT memory_count FROM noosphere_agent_stats WHERE agent_id = $1',
      [agent_id]
    );

    if (statsResult.rows[0]?.memory_count >= (process.env.MAX_MEMORIES_PER_AGENT || 200)) {
      return res.status(409).json({
        error: 'Agent memory cap reached',
        max: process.env.MAX_MEMORIES_PER_AGENT || 200,
        suggestion: 'Evict old memories or promote to constitutional'
      });
    }

    // Generate embedding
    const embedding = await generateEmbedding(content);

    // Insert memory with owner_agent_id and visibility
    const result = await pool.query(
      `INSERT INTO noosphere_memory
       (agent_id, type, content, content_json, embedding, confidence, tags, source_trace_id, visibility, owner_agent_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        agent_id,
        type,
        content,
        content_json ? JSON.stringify(content_json) : null,
        embedding ? `[${embedding.join(',')}]` : null,
        confidence || 0.60,
        tags || [],
        source_trace_id,
        memoryVisibility,
        agent_id // owner_agent_id defaults to agent_id
      ]
    );

    res.status(201).json({
      success: true,
      memory: result.rows[0]
    });
  } catch (error) {
    console.error('Create memory error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /memories - Query memories
app.get('/memories', authenticate, async (req, res) => {
  const {
    agent_id,
    type,
    min_confidence,
    tags,
    visibility,
    limit = 50,
    offset = 0,
    sort = 'created_at',
    order = 'DESC'
  } = req.query;

  try {
    let query = 'SELECT * FROM noosphere_memory WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (agent_id) {
      query += ` AND agent_id = $${paramIndex++}`;
      params.push(agent_id);
    }

    if (type) {
      query += ` AND type = $${paramIndex++}`;
      params.push(type);
    }

    if (min_confidence) {
      query += ` AND confidence >= $${paramIndex++}`;
      params.push(parseFloat(min_confidence));
    }

    if (tags) {
      query += ` AND tags @> $${paramIndex++}::text[]`;
      params.push(tags.split(','));
    }

    if (visibility) {
      query += ` AND visibility = $${paramIndex++}`;
      params.push(visibility);
    }

    // Sorting - use explicit mapping to prevent SQL injection
    const SORT_COLUMNS = {
      'created_at': 'created_at',
      'confidence': 'confidence',
      'updated_at': 'updated_at'
    };
    const SORT_ORDERS = {
      'ASC': 'ASC',
      'DESC': 'DESC'
    };

    const sortField = SORT_COLUMNS[sort] || 'created_at';
    const sortOrder = SORT_ORDERS[order?.toUpperCase()] || 'DESC';

    query += ` ORDER BY ${sortField} ${sortOrder}`;
    query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM noosphere_memory WHERE 1=1';
    const countParams = params.slice(0, -2); // Remove limit/offset
    let countParamIndex = 1;
    if (agent_id) {
      countQuery += ` AND agent_id = $${countParamIndex++}`;
    }
    if (type) {
      countQuery += ` AND type = $${countParamIndex++}`;
    }
    if (min_confidence) {
      countQuery += ` AND confidence >= $${countParamIndex++}`;
    }
    if (tags) {
      countQuery += ` AND tags @> $${countParamIndex++}::text[]`;
    }
    if (visibility) {
      countQuery += ` AND visibility = $${countParamIndex++}`;
    }

    const countResult = await pool.query(countQuery, countParams);

    res.json({
      memories: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0].count),
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    console.error('Query memories error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /memories/shared - Query shared memories (accessible to requesting agent)
// NOTE: Must come before /memories/:id to avoid route conflict
app.get('/memories/shared', authenticate, async (req, res) => {
  const { agent_id, permission, limit = 50, offset = 0 } = req.query;

  if (!agent_id) {
    return res.status(400).json({ error: 'Missing required query parameter: agent_id' });
  }

  try {
    const permissionFilter = permission || 'read';

    const query = `
      SELECT DISTINCT
        m.*,
        p.permission,
        p.granted_by,
        p.granted_at,
        p.expires_at
      FROM noosphere_memory m
      JOIN noosphere_memory_permissions p ON m.id = p.memory_id
      WHERE p.agent_id = $1
        AND p.permission = $2
        AND (p.expires_at IS NULL OR p.expires_at > now())
        AND m.owner_agent_id != $1
      ORDER BY p.granted_at DESC
      LIMIT $3 OFFSET $4
    `;

    const result = await pool.query(query, [
      agent_id,
      permissionFilter,
      parseInt(limit),
      parseInt(offset)
    ]);

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(DISTINCT m.id)
       FROM noosphere_memory m
       JOIN noosphere_memory_permissions p ON m.id = p.memory_id
       WHERE p.agent_id = $1
         AND p.permission = $2
         AND (p.expires_at IS NULL OR p.expires_at > now())
         AND m.owner_agent_id != $1`,
      [agent_id, permissionFilter]
    );

    res.json({
      shared_memories: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0].count),
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    console.error('Query shared memories error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /memories/:id - Get single memory
app.get('/memories/:id', authenticate, async (req, res) => {
  try {
    // v3.2: Apply decay, then reinforce on access
    await pool.query('SELECT apply_decay($1)', [req.params.id]);
    await pool.query('SELECT reinforce_memory($1)', [req.params.id]);

    // Fetch updated memory
    const result = await pool.query(
      'SELECT * FROM noosphere_memory WHERE id = $1',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Memory not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get memory error:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /memories/:id - Update memory
app.put('/memories/:id', authenticate, async (req, res) => {
  const { content, content_json, confidence, tags, superseded_by } = req.body;

  try {
    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (content !== undefined) {
      updates.push(`content = $${paramIndex++}`);
      params.push(content);

      // Regenerate embedding if content changed
      const embedding = await generateEmbedding(content);
      if (embedding) {
        updates.push(`embedding = $${paramIndex++}`);
        params.push(`[${embedding.join(',')}]`);
      }
    }

    if (content_json !== undefined) {
      updates.push(`content_json = $${paramIndex++}`);
      params.push(JSON.stringify(content_json));
    }

    if (confidence !== undefined) {
      updates.push(`confidence = $${paramIndex++}`);
      params.push(parseFloat(confidence));
    }

    if (tags !== undefined) {
      updates.push(`tags = $${paramIndex++}`);
      params.push(tags);
    }

    if (superseded_by !== undefined) {
      updates.push(`superseded_by = $${paramIndex++}`);
      params.push(superseded_by);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push(`updated_at = now()`);
    params.push(req.params.id);

    const query = `
      UPDATE noosphere_memory
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Memory not found' });
    }

    res.json({ success: true, memory: result.rows[0] });
  } catch (error) {
    console.error('Update memory error:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /memories/:id - Delete memory
app.delete('/memories/:id', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM noosphere_memory WHERE id = $1 RETURNING *',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Memory not found' });
    }

    res.json({ success: true, deleted: result.rows[0] });
  } catch (error) {
    console.error('Delete memory error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /memories/search - Semantic search
app.post('/memories/search', authenticate, async (req, res) => {
  const { query, agent_id, type, top_k = 10, min_confidence = 0.6 } = req.body;

  if (!query) {
    return res.status(400).json({ error: 'Query text required' });
  }

  try {
    // Generate query embedding
    const queryEmbedding = await generateEmbedding(query);
    if (!queryEmbedding) {
      return res.status(503).json({ error: 'Embeddings not available' });
    }

    let sql = `
      SELECT *,
             embedding <=> $1::vector AS distance
      FROM noosphere_memory
      WHERE embedding IS NOT NULL
        AND confidence >= $2
    `;

    const params = [`[${queryEmbedding.join(',')}]`, parseFloat(min_confidence)];
    let paramIndex = 3;

    if (agent_id) {
      sql += ` AND agent_id = $${paramIndex++}`;
      params.push(agent_id);
    }

    if (type) {
      sql += ` AND type = $${paramIndex++}`;
      params.push(type);
    }

    sql += ` ORDER BY distance ASC LIMIT $${paramIndex}`;
    params.push(parseInt(top_k));

    const result = await pool.query(sql, params);

    res.json({
      query,
      results: result.rows.map(row => ({
        ...row,
        similarity: 1 - row.distance,
        distance: row.distance
      }))
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /stats - Agent statistics
app.get('/stats', authenticate, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM noosphere_agent_stats ORDER BY agent_id');
    res.json({ stats: result.rows });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /stats/:agent_id - Single agent statistics
app.get('/stats/:agent_id', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM noosphere_agent_stats WHERE agent_id = $1',
      [req.params.agent_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Agent stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// Noosphere v3.1: Multi-Agent Memory Sharing Endpoints
// ============================================================================

// POST /memories/:id/share - Share memory with agent(s)
app.post('/memories/:id/share', authenticate, async (req, res) => {
  const memory_id = req.params.id;
  const { agent_id, permissions, granted_by, expires_at } = req.body;

  // Validation
  if (!agent_id || !permissions || !granted_by) {
    return res.status(400).json({
      error: 'Missing required fields: agent_id, permissions, granted_by'
    });
  }

  const validPermissions = ['read', 'write', 'delete'];
  const permissionList = Array.isArray(permissions) ? permissions : [permissions];

  for (const perm of permissionList) {
    if (!validPermissions.includes(perm)) {
      return res.status(400).json({
        error: `Invalid permission: ${perm}. Must be one of: ${validPermissions.join(', ')}`
      });
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check if memory exists and get owner
    const memoryResult = await client.query(
      'SELECT owner_agent_id, visibility FROM noosphere_memory WHERE id = $1',
      [memory_id]
    );

    if (memoryResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Memory not found' });
    }

    const { owner_agent_id, visibility } = memoryResult.rows[0];

    // Verify granted_by is the owner
    if (owner_agent_id !== granted_by) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        error: 'Forbidden: Only the memory owner can grant permissions'
      });
    }

    // Update visibility to 'shared' if currently private
    if (visibility === 'private') {
      await client.query(
        'UPDATE noosphere_memory SET visibility = $1 WHERE id = $2',
        ['shared', memory_id]
      );
    }

    // Insert permissions (ON CONFLICT DO NOTHING to handle duplicates)
    const permissionRows = [];
    for (const perm of permissionList) {
      await client.query(
        `INSERT INTO noosphere_memory_permissions
         (memory_id, agent_id, permission, granted_by, expires_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (memory_id, agent_id, permission) DO NOTHING`,
        [memory_id, agent_id, perm, granted_by, expires_at || null]
      );
      permissionRows.push({ agent_id, permission: perm });
    }

    // Log the share action
    await client.query(
      `INSERT INTO noosphere_access_log
       (memory_id, agent_id, action, success, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        memory_id,
        granted_by,
        'share',
        true,
        JSON.stringify({ target_agent: agent_id, permissions: permissionList })
      ]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: `Memory shared with ${agent_id}`,
      permissions: permissionRows,
      visibility: visibility === 'private' ? 'shared' : visibility
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Share memory error:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// DELETE /memories/:id/share/:agent_id - Revoke sharing
app.delete('/memories/:id/share/:agent_id', authenticate, async (req, res) => {
  const { id: memory_id, agent_id } = req.params;
  const { revoked_by } = req.body;

  if (!revoked_by) {
    return res.status(400).json({ error: 'Missing required field: revoked_by' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check if memory exists and verify ownership
    const memoryResult = await client.query(
      'SELECT owner_agent_id FROM noosphere_memory WHERE id = $1',
      [memory_id]
    );

    if (memoryResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Memory not found' });
    }

    const { owner_agent_id } = memoryResult.rows[0];

    if (owner_agent_id !== revoked_by) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        error: 'Forbidden: Only the memory owner can revoke permissions'
      });
    }

    // Delete all permissions for the agent
    const deleteResult = await client.query(
      'DELETE FROM noosphere_memory_permissions WHERE memory_id = $1 AND agent_id = $2 RETURNING *',
      [memory_id, agent_id]
    );

    // Log the unshare action
    await client.query(
      `INSERT INTO noosphere_access_log
       (memory_id, agent_id, action, success, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        memory_id,
        revoked_by,
        'unshare',
        true,
        JSON.stringify({ target_agent: agent_id, removed_count: deleteResult.rows.length })
      ]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: `Permissions revoked for ${agent_id}`,
      removed: deleteResult.rows.length
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Revoke sharing error:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// GET /memories/:id/permissions - List permissions for a memory
app.get('/memories/:id/permissions', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         p.id,
         p.agent_id,
         p.permission,
         p.granted_by,
         p.granted_at,
         p.expires_at,
         CASE
           WHEN p.expires_at IS NULL THEN false
           WHEN p.expires_at > now() THEN false
           ELSE true
         END AS is_expired
       FROM noosphere_memory_permissions p
       WHERE p.memory_id = $1
       ORDER BY p.granted_at DESC`,
      [req.params.id]
    );

    res.json({
      memory_id: req.params.id,
      permissions: result.rows
    });
  } catch (error) {
    console.error('Get permissions error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /memories/:id/access-log - View access history
app.get('/memories/:id/access-log', authenticate, async (req, res) => {
  const { limit = 100, offset = 0 } = req.query;

  try {
    const result = await pool.query(
      `SELECT
         id,
         agent_id,
         action,
         accessed_at,
         success,
         error_message,
         metadata
       FROM noosphere_access_log
       WHERE memory_id = $1
       ORDER BY accessed_at DESC
       LIMIT $2 OFFSET $3`,
      [req.params.id, parseInt(limit), parseInt(offset)]
    );

    // Get total count
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM noosphere_access_log WHERE memory_id = $1',
      [req.params.id]
    );

    res.json({
      memory_id: req.params.id,
      access_log: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0].count),
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    console.error('Get access log error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /permissions/cleanup - Clean up expired permissions (maintenance)
app.post('/permissions/cleanup', authenticate, async (req, res) => {
  try {
    const result = await pool.query('SELECT cleanup_expired_permissions()');
    const deletedCount = result.rows[0].cleanup_expired_permissions;

    res.json({
      success: true,
      message: `Cleaned up ${deletedCount} expired permission(s)`,
      deleted_count: deletedCount
    });
  } catch (error) {
    console.error('Cleanup permissions error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// v3.2 Decay Management Endpoints
// ============================================================================

// GET /memories/:id/decay-status - Get decay information for a memory
app.get('/memories/:id/decay-status', authenticate, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        m.id,
        m.type,
        m.confidence,
        m.confidence_initial,
        m.last_accessed_at,
        m.access_count,
        m.reinforcement_count,
        calculate_decay(m.id) as confidence_after_decay,
        EXTRACT(EPOCH FROM (now() - m.last_accessed_at))/604800 as weeks_since_access,
        dc.decay_rate,
        dc.min_confidence,
        dc.reinforcement_boost,
        dc.auto_evict_enabled
      FROM noosphere_memory m
      LEFT JOIN noosphere_decay_config dc ON m.type = dc.memory_type
      WHERE m.id = $1
    `, [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Memory not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get decay status error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /decay/apply - Apply decay to batch of memories
app.post('/decay/apply', authenticate, async (req, res) => {
  try {
    const { agent_id, batch_size = 100 } = req.body;

    const result = await pool.query(
      'SELECT * FROM apply_decay_batch($1, $2)',
      [agent_id || null, batch_size]
    );

    const decayedCount = result.rows.filter(r => r.decayed).length;
    const avgOldConfidence = result.rows.reduce((sum, r) => sum + parseFloat(r.old_confidence), 0) / result.rows.length || 0;
    const avgNewConfidence = result.rows.reduce((sum, r) => sum + parseFloat(r.new_confidence), 0) / result.rows.length || 0;

    res.json({
      success: true,
      processed: result.rows.length,
      decayed: decayedCount,
      avg_old_confidence: avgOldConfidence.toFixed(3),
      avg_new_confidence: avgNewConfidence.toFixed(3),
      details: result.rows
    });
  } catch (error) {
    console.error('Apply decay error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /decay/evict - Auto-evict low-confidence memories
app.post('/decay/evict', authenticate, async (req, res) => {
  try {
    const { agent_id } = req.body;

    const result = await pool.query(
      'SELECT * FROM auto_evict_low_confidence($1)',
      [agent_id || null]
    );

    res.json({
      success: true,
      evicted_count: result.rows.length,
      evicted_memories: result.rows
    });
  } catch (error) {
    console.error('Auto-evict error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /decay/config - Get decay configuration
app.get('/decay/config', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM noosphere_decay_config ORDER BY memory_type'
    );

    res.json({
      success: true,
      config: result.rows
    });
  } catch (error) {
    console.error('Get decay config error:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /decay/config/:type - Update decay configuration for a memory type
app.put('/decay/config/:type', authenticate, async (req, res) => {
  try {
    const { type } = req.params;
    const {
      decay_rate,
      min_confidence,
      reinforcement_boost,
      auto_evict_enabled
    } = req.body;

    // Build dynamic update query
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (decay_rate !== undefined) {
      updates.push(`decay_rate = $${paramCount++}`);
      values.push(decay_rate);
    }
    if (min_confidence !== undefined) {
      updates.push(`min_confidence = $${paramCount++}`);
      values.push(min_confidence);
    }
    if (reinforcement_boost !== undefined) {
      updates.push(`reinforcement_boost = $${paramCount++}`);
      values.push(reinforcement_boost);
    }
    if (auto_evict_enabled !== undefined) {
      updates.push(`auto_evict_enabled = $${paramCount++}`);
      values.push(auto_evict_enabled);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(type);
    const result = await pool.query(
      `UPDATE noosphere_decay_config
       SET ${updates.join(', ')}, updated_at = now()
       WHERE memory_type = $${paramCount}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Memory type not found' });
    }

    res.json({
      success: true,
      config: result.rows[0]
    });
  } catch (error) {
    console.error('Update decay config error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing connections...');
  pool.end(() => {
    console.log('Database connections closed');
    process.exit(0);
  });
});

// Start server
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Noosphere v3.2 Service listening on port ${PORT}`);
    console.log(`Database: ${process.env.DATABASE_URL ? 'connected' : 'not configured'}`);
    console.log(`Embeddings: ${openai ? 'enabled' : 'disabled'}`);
    console.log(`Features: multi-agent-sharing, permission-model, access-logging, confidence-decay, reinforcement`);
  });
}

// Export for testing
module.exports = app;
