/**
 * Noosphere v3.0 Service - Main Entry Point
 * 5-Type Memory Architecture API
 */

require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const { Pool } = require('pg');
const OpenAI = require('openai');

const app = express();
const PORT = process.env.PORT || 3006;

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

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(morgan('combined'));

// Authentication middleware
function authenticate(req, res, next) {
  const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
  if (!apiKey || apiKey !== process.env.MOLTBOOK_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// Health check (no auth)
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({
      status: 'healthy',
      version: '3.0.0',
      database: 'connected',
      embeddings: openai ? 'enabled' : 'disabled'
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
  const { agent_id, type, content, content_json, confidence, tags, source_trace_id } = req.body;

  // Validation
  if (!agent_id || !type || !content) {
    return res.status(400).json({ error: 'Missing required fields: agent_id, type, content' });
  }

  const validTypes = ['insight', 'pattern', 'strategy', 'preference', 'lesson'];
  if (!validTypes.includes(type)) {
    return res.status(400).json({ error: `Invalid type. Must be one of: ${validTypes.join(', ')}` });
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

    // Insert memory
    const result = await pool.query(
      `INSERT INTO noosphere_memory
       (agent_id, type, content, content_json, embedding, confidence, tags, source_trace_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        agent_id,
        type,
        content,
        content_json ? JSON.stringify(content_json) : null,
        embedding ? `[${embedding.join(',')}]` : null,
        confidence || 0.60,
        tags || [],
        source_trace_id
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

    // Sorting
    const validSorts = ['created_at', 'confidence', 'updated_at'];
    const validOrders = ['ASC', 'DESC'];
    const sortField = validSorts.includes(sort) ? sort : 'created_at';
    const sortOrder = validOrders.includes(order.toUpperCase()) ? order.toUpperCase() : 'DESC';

    query += ` ORDER BY ${sortField} ${sortOrder}`;
    query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM noosphere_memory WHERE 1=1';
    const countParams = params.slice(0, -2); // Remove limit/offset
    if (agent_id) countQuery += ` AND agent_id = $1`;
    if (type) countQuery += ` AND type = $${agent_id ? 2 : 1}`;
    if (min_confidence) countQuery += ` AND confidence >= $${(agent_id ? 1 : 0) + (type ? 1 : 0) + 1}`;
    if (tags) countQuery += ` AND tags @> $${(agent_id ? 1 : 0) + (type ? 1 : 0) + (min_confidence ? 1 : 0) + 1}::text[]`;

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

// GET /memories/:id - Get single memory
app.get('/memories/:id', authenticate, async (req, res) => {
  try {
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
app.listen(PORT, () => {
  console.log(`Noosphere v3.0 Service listening on port ${PORT}`);
  console.log(`Database: ${process.env.DATABASE_URL ? 'connected' : 'not configured'}`);
  console.log(`Embeddings: ${openai ? 'enabled' : 'disabled'}`);
});
