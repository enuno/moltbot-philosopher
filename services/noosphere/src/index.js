/**
 * Noosphere v3.0 Service - Main Entry Point
 * 5-Type Memory Architecture API
 */

require("dotenv").config();
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3006;

// Setup logging
const logDir = process.env.LOG_DIR || "/app/logs";
const accessLogStream = fs.createWriteStream(path.join(logDir, "noosphere-access.log"), {
  flags: "a",
});

// Database connection with extended timeout for docker network latency
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 30000, // Extended from 2000ms to 30s for slow docker networks
});

// Embedding configuration - use OpenRouter or Venice.ai instead of OpenAI
const EMBEDDING_PROVIDER = process.env.EMBEDDING_PROVIDER || "openrouter"; // openrouter or venice
const ENABLE_EMBEDDINGS = process.env.ENABLE_EMBEDDINGS === "true";

// OpenRouter configuration (for embeddings via API)
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_EMBEDDING_MODEL = process.env.OPENROUTER_EMBEDDING_MODEL || "nomic-ai/nomic-embed-text-v1.5";

// Venice.ai configuration (for synthesis generation and optional embeddings)
const VENICE_API_URL = process.env.VENICE_API_URL || "http://venice-proxy:8080/v1/chat/completions";
const VENICE_API_KEY = process.env.VENICE_API_KEY;
const VENICE_MODEL = process.env.VENICE_MODEL || "llama-3.3-70b";

// Rate limiting - 100 requests per minute per IP
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later" },
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(morgan("combined")); // Console
app.use(morgan("combined", { stream: accessLogStream })); // File
app.use(limiter); // Apply rate limiting to all routes

// Authentication middleware
function authenticate(req, res, next) {
  const apiKey = req.headers["x-api-key"] || req.headers["authorization"]?.replace("Bearer ", "");
  if (!apiKey || apiKey !== process.env.MOLTBOOK_API_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

// Health check (no auth, no rate limit needed)
// Initialize health state tracking
let isHealthy = false;
const healthCheckTimeout = setTimeout(() => {
  console.log("⚠️  Health check timeout - marking as unhealthy");
}, 30000);

// Health check endpoint - returns cached status without blocking
app.get("/health", (req, res) => {
  if (isHealthy) {
    res.json({
      status: "healthy",
      version: "3.3.0",
      database: "connected",
      embeddings: ENABLE_EMBEDDINGS ? `${EMBEDDING_PROVIDER} enabled` : "disabled",
      embedding_provider: EMBEDDING_PROVIDER,
      venice_ai: VENICE_API_KEY ? "enabled" : "disabled",
      openrouter: OPENROUTER_API_KEY ? "enabled" : "disabled",
      features: [
        "multi-agent-sharing",
        "permission-model",
        "access-logging",
        "confidence-decay",
        "reinforcement-learning",
        "pattern-mining",
        "ai-synthesis",
      ],
    });
  } else {
    res.status(503).json({ status: "starting", error: "Database connection not yet verified" });
  }
});

// Generate embedding
async function generateEmbedding(text) {
  if (!ENABLE_EMBEDDINGS) return null;

  try {
    if (EMBEDDING_PROVIDER === "openrouter" && OPENROUTER_API_KEY) {
      // Use OpenRouter for embeddings
      const response = await axios.post("https://openrouter.ai/api/v1/embeddings", {
        model: OPENROUTER_EMBEDDING_MODEL,
        input: text,
      }, {
        headers: {
          "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
      });
      return response.data.data[0].embedding;
    } else if (EMBEDDING_PROVIDER === "venice" && VENICE_API_KEY) {
      // Use Venice.ai for embeddings (if supported)
      const response = await axios.post(`${VENICE_API_URL}/embeddings`, {
        model: "text-embedding-3-small",
        input: text,
      }, {
        headers: {
          "Authorization": `Bearer ${VENICE_API_KEY}`,
          "Content-Type": "application/json",
        },
      });
      return response.data.data[0].embedding;
    } else {
      console.warn("Embeddings enabled but no provider configured (OpenRouter or Venice.ai)");
      return null;
    }
  } catch (error) {
    console.error("Embedding generation failed:", error.message);
    return null;
  }
}

// POST /memories - Create memory
app.post("/memories", authenticate, async (req, res) => {
  const { agent_id, type, content, content_json, confidence, tags, source_trace_id, visibility } =
    req.body;

  // Validation
  if (!agent_id || !type || !content) {
    return res.status(400).json({ error: "Missing required fields: agent_id, type, content" });
  }

  const validTypes = ["insight", "pattern", "strategy", "preference", "lesson"];
  if (!validTypes.includes(type)) {
    return res
      .status(400)
      .json({ error: `Invalid type. Must be one of: ${validTypes.join(", ")}` });
  }

  const validVisibilities = ["private", "shared", "public"];
  const memoryVisibility = visibility || "private";
  if (!validVisibilities.includes(memoryVisibility)) {
    return res
      .status(400)
      .json({ error: `Invalid visibility. Must be one of: ${validVisibilities.join(", ")}` });
  }

  try {
    // Check 200-cap per agent
    const statsResult = await pool.query(
      "SELECT memory_count FROM noosphere_agent_stats WHERE agent_id = $1",
      [agent_id],
    );

    if (statsResult.rows[0]?.memory_count >= (process.env.MAX_MEMORIES_PER_AGENT || 200)) {
      return res.status(409).json({
        error: "Agent memory cap reached",
        max: process.env.MAX_MEMORIES_PER_AGENT || 200,
        suggestion: "Evict old memories or promote to constitutional",
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
        embedding ? `[${embedding.join(",")}]` : null,
        confidence || 0.6,
        tags || [],
        source_trace_id,
        memoryVisibility,
        agent_id, // owner_agent_id defaults to agent_id
      ],
    );

    res.status(201).json({
      success: true,
      memory: result.rows[0],
    });
  } catch (error) {
    console.error("Create memory error:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /memories - Query memories
app.get("/memories", authenticate, async (req, res) => {
  const {
    agent_id,
    type,
    min_confidence,
    tags,
    visibility,
    limit = 50,
    offset = 0,
    sort = "created_at",
    order = "DESC",
  } = req.query;

  try {
    let query = "SELECT * FROM noosphere_memory WHERE 1=1";
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
      params.push(tags.split(","));
    }

    if (visibility) {
      query += ` AND visibility = $${paramIndex++}`;
      params.push(visibility);
    }

    // Sorting - use explicit mapping to prevent SQL injection
    const SORT_COLUMNS = {
      created_at: "created_at",
      confidence: "confidence",
      updated_at: "updated_at",
    };
    const SORT_ORDERS = {
      ASC: "ASC",
      DESC: "DESC",
    };

    const sortField = SORT_COLUMNS[sort] || "created_at";
    const sortOrder = SORT_ORDERS[order?.toUpperCase()] || "DESC";

    query += ` ORDER BY ${sortField} ${sortOrder}`;
    query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);

    // Get total count
    let countQuery = "SELECT COUNT(*) FROM noosphere_memory WHERE 1=1";
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
        offset: parseInt(offset),
      },
    });
  } catch (error) {
    console.error("Query memories error:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /memories/shared - Query shared memories (accessible to requesting agent)
// NOTE: Must come before /memories/:id to avoid route conflict
app.get("/memories/shared", authenticate, async (req, res) => {
  const { agent_id, permission, limit = 50, offset = 0 } = req.query;

  if (!agent_id) {
    return res.status(400).json({ error: "Missing required query parameter: agent_id" });
  }

  try {
    const permissionFilter = permission || "read";

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
      parseInt(offset),
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
      [agent_id, permissionFilter],
    );

    res.json({
      shared_memories: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0].count),
        limit: parseInt(limit),
        offset: parseInt(offset),
      },
    });
  } catch (error) {
    console.error("Query shared memories error:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /memories/:id - Get single memory
app.get("/memories/:id", authenticate, async (req, res) => {
  try {
    // v3.2: Apply decay, then reinforce on access
    await pool.query("SELECT apply_decay($1)", [req.params.id]);
    await pool.query("SELECT reinforce_memory($1)", [req.params.id]);

    // Fetch updated memory
    const result = await pool.query("SELECT * FROM noosphere_memory WHERE id = $1", [
      req.params.id,
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Memory not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Get memory error:", error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /memories/:id - Update memory
app.put("/memories/:id", authenticate, async (req, res) => {
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
        params.push(`[${embedding.join(",")}]`);
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
      return res.status(400).json({ error: "No fields to update" });
    }

    updates.push(`updated_at = now()`);
    params.push(req.params.id);

    const query = `
      UPDATE noosphere_memory
      SET ${updates.join(", ")}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Memory not found" });
    }

    res.json({ success: true, memory: result.rows[0] });
  } catch (error) {
    console.error("Update memory error:", error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /memories/:id - Delete memory
app.delete("/memories/:id", authenticate, async (req, res) => {
  try {
    const result = await pool.query("DELETE FROM noosphere_memory WHERE id = $1 RETURNING *", [
      req.params.id,
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Memory not found" });
    }

    res.json({ success: true, deleted: result.rows[0] });
  } catch (error) {
    console.error("Delete memory error:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST /memories/search - Semantic search
app.post("/memories/search", authenticate, async (req, res) => {
  const { query, agent_id, type, top_k = 10, min_confidence = 0.6 } = req.body;

  if (!query) {
    return res.status(400).json({ error: "Query text required" });
  }

  try {
    // Generate query embedding
    const queryEmbedding = await generateEmbedding(query);
    if (!queryEmbedding) {
      return res.status(503).json({ error: "Embeddings not available" });
    }

    let sql = `
      SELECT *,
             embedding <=> $1::vector AS distance
      FROM noosphere_memory
      WHERE embedding IS NOT NULL
        AND confidence >= $2
    `;

    const params = [`[${queryEmbedding.join(",")}]`, parseFloat(min_confidence)];
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
      results: result.rows.map((row) => ({
        ...row,
        similarity: 1 - row.distance,
        distance: row.distance,
      })),
    });
  } catch (error) {
    console.error("Search error:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /stats - Agent statistics
app.get("/stats", authenticate, async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM noosphere_agent_stats ORDER BY agent_id");
    res.json({ stats: result.rows });
  } catch (error) {
    console.error("Stats error:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /stats/:agent_id - Single agent statistics
app.get("/stats/:agent_id", authenticate, async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM noosphere_agent_stats WHERE agent_id = $1", [
      req.params.agent_id,
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Agent not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Agent stats error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// Noosphere v3.1: Multi-Agent Memory Sharing Endpoints
// ============================================================================

// POST /memories/:id/share - Share memory with agent(s)
app.post("/memories/:id/share", authenticate, async (req, res) => {
  const memory_id = req.params.id;
  const { agent_id, permissions, granted_by, expires_at } = req.body;

  // Validation
  if (!agent_id || !permissions || !granted_by) {
    return res.status(400).json({
      error: "Missing required fields: agent_id, permissions, granted_by",
    });
  }

  const validPermissions = ["read", "write", "delete"];
  const permissionList = Array.isArray(permissions) ? permissions : [permissions];

  for (const perm of permissionList) {
    if (!validPermissions.includes(perm)) {
      return res.status(400).json({
        error: `Invalid permission: ${perm}. Must be one of: ${validPermissions.join(", ")}`,
      });
    }
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Check if memory exists and get owner
    const memoryResult = await client.query(
      "SELECT owner_agent_id, visibility FROM noosphere_memory WHERE id = $1",
      [memory_id],
    );

    if (memoryResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Memory not found" });
    }

    const { owner_agent_id, visibility } = memoryResult.rows[0];

    // Verify granted_by is the owner
    if (owner_agent_id !== granted_by) {
      await client.query("ROLLBACK");
      return res.status(403).json({
        error: "Forbidden: Only the memory owner can grant permissions",
      });
    }

    // Update visibility to 'shared' if currently private
    if (visibility === "private") {
      await client.query("UPDATE noosphere_memory SET visibility = $1 WHERE id = $2", [
        "shared",
        memory_id,
      ]);
    }

    // Insert permissions (ON CONFLICT DO NOTHING to handle duplicates)
    const permissionRows = [];
    for (const perm of permissionList) {
      await client.query(
        `INSERT INTO noosphere_memory_permissions
         (memory_id, agent_id, permission, granted_by, expires_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (memory_id, agent_id, permission) DO NOTHING`,
        [memory_id, agent_id, perm, granted_by, expires_at || null],
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
        "share",
        true,
        JSON.stringify({ target_agent: agent_id, permissions: permissionList }),
      ],
    );

    await client.query("COMMIT");

    res.json({
      success: true,
      message: `Memory shared with ${agent_id}`,
      permissions: permissionRows,
      visibility: visibility === "private" ? "shared" : visibility,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Share memory error:", error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// DELETE /memories/:id/share/:agent_id - Revoke sharing
app.delete("/memories/:id/share/:agent_id", authenticate, async (req, res) => {
  const { id: memory_id, agent_id } = req.params;
  const { revoked_by } = req.body;

  if (!revoked_by) {
    return res.status(400).json({ error: "Missing required field: revoked_by" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Check if memory exists and verify ownership
    const memoryResult = await client.query(
      "SELECT owner_agent_id FROM noosphere_memory WHERE id = $1",
      [memory_id],
    );

    if (memoryResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Memory not found" });
    }

    const { owner_agent_id } = memoryResult.rows[0];

    if (owner_agent_id !== revoked_by) {
      await client.query("ROLLBACK");
      return res.status(403).json({
        error: "Forbidden: Only the memory owner can revoke permissions",
      });
    }

    // Delete all permissions for the agent
    const deleteResult = await client.query(
      "DELETE FROM noosphere_memory_permissions WHERE memory_id = $1 AND agent_id = $2 RETURNING *",
      [memory_id, agent_id],
    );

    // Log the unshare action
    await client.query(
      `INSERT INTO noosphere_access_log
       (memory_id, agent_id, action, success, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        memory_id,
        revoked_by,
        "unshare",
        true,
        JSON.stringify({ target_agent: agent_id, removed_count: deleteResult.rows.length }),
      ],
    );

    await client.query("COMMIT");

    res.json({
      success: true,
      message: `Permissions revoked for ${agent_id}`,
      removed: deleteResult.rows.length,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Revoke sharing error:", error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// GET /memories/:id/permissions - List permissions for a memory
app.get("/memories/:id/permissions", authenticate, async (req, res) => {
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
      [req.params.id],
    );

    res.json({
      memory_id: req.params.id,
      permissions: result.rows,
    });
  } catch (error) {
    console.error("Get permissions error:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /memories/:id/access-log - View access history
app.get("/memories/:id/access-log", authenticate, async (req, res) => {
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
      [req.params.id, parseInt(limit), parseInt(offset)],
    );

    // Get total count
    const countResult = await pool.query(
      "SELECT COUNT(*) FROM noosphere_access_log WHERE memory_id = $1",
      [req.params.id],
    );

    res.json({
      memory_id: req.params.id,
      access_log: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0].count),
        limit: parseInt(limit),
        offset: parseInt(offset),
      },
    });
  } catch (error) {
    console.error("Get access log error:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST /permissions/cleanup - Clean up expired permissions (maintenance)
app.post("/permissions/cleanup", authenticate, async (req, res) => {
  try {
    const result = await pool.query("SELECT cleanup_expired_permissions()");
    const deletedCount = result.rows[0].cleanup_expired_permissions;

    res.json({
      success: true,
      message: `Cleaned up ${deletedCount} expired permission(s)`,
      deleted_count: deletedCount,
    });
  } catch (error) {
    console.error("Cleanup permissions error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// v3.2 Decay Management Endpoints
// ============================================================================

// GET /memories/:id/decay-status - Get decay information for a memory
app.get("/memories/:id/decay-status", authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `
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
    `,
      [req.params.id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Memory not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Get decay status error:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST /decay/apply - Apply decay to batch of memories
app.post("/decay/apply", authenticate, async (req, res) => {
  try {
    const { agent_id, batch_size = 100 } = req.body;

    const result = await pool.query("SELECT * FROM apply_decay_batch($1, $2)", [
      agent_id || null,
      batch_size,
    ]);

    const decayedCount = result.rows.filter((r) => r.decayed).length;
    const avgOldConfidence =
      result.rows.reduce((sum, r) => sum + parseFloat(r.old_confidence), 0) / result.rows.length ||
      0;
    const avgNewConfidence =
      result.rows.reduce((sum, r) => sum + parseFloat(r.new_confidence), 0) / result.rows.length ||
      0;

    res.json({
      success: true,
      processed: result.rows.length,
      decayed: decayedCount,
      avg_old_confidence: avgOldConfidence.toFixed(3),
      avg_new_confidence: avgNewConfidence.toFixed(3),
      details: result.rows,
    });
  } catch (error) {
    console.error("Apply decay error:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST /decay/evict - Auto-evict low-confidence memories
app.post("/decay/evict", authenticate, async (req, res) => {
  try {
    const { agent_id } = req.body;

    const result = await pool.query("SELECT * FROM auto_evict_low_confidence($1)", [
      agent_id || null,
    ]);

    res.json({
      success: true,
      evicted_count: result.rows.length,
      evicted_memories: result.rows,
    });
  } catch (error) {
    console.error("Auto-evict error:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /decay/config - Get decay configuration
app.get("/decay/config", authenticate, async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM noosphere_decay_config ORDER BY memory_type");

    res.json({
      success: true,
      config: result.rows,
    });
  } catch (error) {
    console.error("Get decay config error:", error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /decay/config/:type - Update decay configuration for a memory type
app.put("/decay/config/:type", authenticate, async (req, res) => {
  try {
    const { type } = req.params;
    const { decay_rate, min_confidence, reinforcement_boost, auto_evict_enabled } = req.body;

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
      return res.status(400).json({ error: "No fields to update" });
    }

    values.push(type);
    const result = await pool.query(
      `UPDATE noosphere_decay_config
       SET ${updates.join(", ")}, updated_at = now()
       WHERE memory_type = $${paramCount}
       RETURNING *`,
      values,
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Memory type not found" });
    }

    res.json({
      success: true,
      config: result.rows[0],
    });
  } catch (error) {
    console.error("Update decay config error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// v3.3 Pattern Mining & Synthesis Generation Endpoints
// ============================================================================

// Helper: Call Venice.ai for synthesis generation
async function generateSynthesis(pattern, memories) {
  if (!VENICE_API_KEY) {
    throw new Error("Venice API not configured");
  }

  const prompt = `You are a philosophical synthesizer for the Ethics-Convergence Council.

Given the following ${memories.length} memories from different philosophical agents that form a convergence pattern:

${memories
  .map(
    (m, i) => `
Memory ${i + 1} (${m.agent_id}, ${m.type}):
Content: ${m.content}
Tags: ${m.tags.join(", ")}
Confidence: ${m.confidence}
`,
  )
  .join("\n")}

Pattern: ${pattern.title}
Description: ${pattern.description}

Generate a synthesized insight that:
1. Unifies the common themes across all perspectives
2. Preserves the unique contributions of each voice
3. Creates a higher-order understanding
4. Is concise (2-3 sentences max)
5. Uses philosophical language appropriate for Council deliberation

Respond ONLY with the synthesized insight text, no preamble or explanation.`;

  try {
    const response = await axios.post(
      VENICE_API_URL,
      {
        model: VENICE_MODEL,
        messages: [
          {
            role: "system",
            content:
              "You are a philosophical synthesizer for an AI ethics council. Generate concise, unified insights from multiple perspectives.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 300,
      },
      {
        headers: {
          Authorization: `Bearer ${VENICE_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 30000,
      },
    );

    return response.data.choices[0].message.content.trim();
  } catch (error) {
    console.error("Venice synthesis error:", error.message);
    throw new Error(`Synthesis generation failed: ${error.message}`);
  }
}

// POST /patterns/mine - Trigger pattern mining
app.post("/patterns/mine", authenticate, async (req, res) => {
  try {
    const {
      pattern_type = "convergence", // 'convergence', 'contradiction', 'gap', 'all'
      similarity_threshold = 0.85,
      min_agents = 3,
      limit = 50,
    } = req.body;

    const patterns = [];

    // Mine convergence patterns
    if (pattern_type === "convergence" || pattern_type === "all") {
      const convergenceResult = await pool.query(
        "SELECT * FROM find_convergence_candidates($1, $2, $3)",
        [similarity_threshold, min_agents, limit],
      );

      for (const row of convergenceResult.rows) {
        // Create pattern record
        const patternInsert = await pool.query(
          `
          INSERT INTO noosphere_patterns (
            pattern_type, title, description, agent_ids, memory_ids,
            tags, confidence, supporting_evidence
          ) VALUES (
            'convergence',
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7
          ) RETURNING *
        `,
          [
            `Convergence across ${row.agent_ids.length} agents`,
            `${row.agent_ids.length} agents show similar understanding on: ${row.common_tags.slice(0, 3).join(", ")}`,
            row.agent_ids,
            row.memory_ids,
            row.common_tags,
            row.avg_similarity,
            JSON.stringify({ similarity: row.avg_similarity, method: "vector_embedding" }),
          ],
        );

        patterns.push(patternInsert.rows[0]);
      }
    }

    // Mine contradiction patterns
    if (pattern_type === "contradiction" || pattern_type === "all") {
      const contradictionResult = await pool.query("SELECT * FROM detect_contradictions(2, $1)", [
        limit,
      ]);

      for (const row of contradictionResult.rows) {
        const patternInsert = await pool.query(
          `
          INSERT INTO noosphere_patterns (
            pattern_type, title, description, agent_ids, memory_ids,
            tags, confidence, supporting_evidence
          ) VALUES (
            'contradiction',
            $1,
            $2,
            $3,
            $4,
            $5,
            0.70,
            $6
          ) RETURNING *
        `,
          [
            `Contradiction: ${row.agent_id_1} vs ${row.agent_id_2}`,
            `Opposing perspectives on: ${row.common_tags.join(", ")}`,
            [row.agent_id_1, row.agent_id_2],
            [row.memory_id_1, row.memory_id_2],
            row.common_tags,
            JSON.stringify({
              confidence_diff: row.confidence_diff,
              method: "tag_overlap_low_similarity",
            }),
          ],
        );

        patterns.push(patternInsert.rows[0]);
      }
    }

    // Analyze gaps
    if (pattern_type === "gap" || pattern_type === "all") {
      const gapResult = await pool.query("SELECT * FROM analyze_gaps()");

      // Group gaps by agent
      const gapsByAgent = {};
      for (const row of gapResult.rows) {
        if (!gapsByAgent[row.agent_id]) {
          gapsByAgent[row.agent_id] = [];
        }
        gapsByAgent[row.agent_id].push(row);
      }

      // Create gap patterns (one per agent with multiple gaps)
      for (const [agentId, gaps] of Object.entries(gapsByAgent)) {
        if (gaps.length >= 2) {
          const gapTypes = gaps.map((g) => g.memory_type);
          const avgGapScore =
            gaps.reduce((sum, g) => sum + parseFloat(g.gap_score), 0) / gaps.length;

          const patternInsert = await pool.query(
            `
            INSERT INTO noosphere_patterns (
              pattern_type, title, description, agent_ids, memory_ids,
              tags, confidence, supporting_evidence, metadata
            ) VALUES (
              'gap',
              $1,
              $2,
              $3,
              '{}',
              $4,
              0.80,
              $5,
              $6
            ) RETURNING *
          `,
            [
              `Memory gap: ${agentId}`,
              `${agentId} has fewer ${gapTypes.join(", ")} memories than average`,
              [agentId],
              gapTypes,
              JSON.stringify({ gaps }),
              JSON.stringify({ avg_gap_score: avgGapScore }),
            ],
          );

          patterns.push(patternInsert.rows[0]);
        }
      }
    }

    res.json({
      success: true,
      patterns_discovered: patterns.length,
      patterns: patterns,
    });
  } catch (error) {
    console.error("Pattern mining error:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /patterns - List discovered patterns
app.get("/patterns", authenticate, async (req, res) => {
  try {
    const { pattern_type, status = "active", min_confidence, limit = 50, offset = 0 } = req.query;

    let query = "SELECT * FROM noosphere_patterns WHERE status = $1";
    const params = [status];
    let paramCount = 1;

    if (pattern_type) {
      params.push(pattern_type);
      query += ` AND pattern_type = $${++paramCount}`;
    }

    if (min_confidence) {
      params.push(parseFloat(min_confidence));
      query += ` AND confidence >= $${++paramCount}`;
    }

    query += ` ORDER BY detected_at DESC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);

    res.json({
      success: true,
      patterns: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    console.error("Get patterns error:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /patterns/:id - Get pattern details
app.get("/patterns/:id", authenticate, async (req, res) => {
  try {
    const patternResult = await pool.query("SELECT * FROM noosphere_patterns WHERE id = $1", [
      req.params.id,
    ]);

    if (patternResult.rows.length === 0) {
      return res.status(404).json({ error: "Pattern not found" });
    }

    const pattern = patternResult.rows[0];

    // Get associated memories
    const memoriesResult = await pool.query("SELECT * FROM get_pattern_memories($1)", [
      req.params.id,
    ]);

    res.json({
      ...pattern,
      memories: memoriesResult.rows,
    });
  } catch (error) {
    console.error("Get pattern error:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST /syntheses - Create synthesis from pattern (with AI generation)
app.post("/syntheses", authenticate, async (req, res) => {
  try {
    const { pattern_id, type, auto_generate = true } = req.body;

    // Get pattern
    const patternResult = await pool.query("SELECT * FROM noosphere_patterns WHERE id = $1", [
      pattern_id,
    ]);

    if (patternResult.rows.length === 0) {
      return res.status(404).json({ error: "Pattern not found" });
    }

    const pattern = patternResult.rows[0];

    // Only generate syntheses for convergence patterns
    if (pattern.pattern_type !== "convergence") {
      return res.status(400).json({
        error: "Syntheses can only be generated from convergence patterns",
      });
    }

    // Get pattern memories
    const memoriesResult = await pool.query("SELECT * FROM get_pattern_memories($1)", [pattern_id]);

    const memories = memoriesResult.rows;

    // Generate synthesis content using Venice.ai
    let content, rationale;
    if (auto_generate && VENICE_API_KEY) {
      try {
        content = await generateSynthesis(pattern, memories);
        rationale = `AI-generated synthesis from ${memories.length} converging memories across ${pattern.agent_ids.length} agents using vector similarity (threshold: ${pattern.confidence})`;
      } catch (genError) {
        console.error("Synthesis generation failed:", genError);
        return res.status(500).json({
          error: "Synthesis generation failed",
          details: genError.message,
        });
      }
    } else {
      content = req.body.content;
      rationale = req.body.rationale || "Manual synthesis";
    }

    if (!content) {
      return res.status(400).json({ error: "Content is required if auto_generate is false" });
    }

    // Extract common tags from memories
    const allTags = memories.flatMap((m) => m.tags);
    const tagCounts = {};
    allTags.forEach((tag) => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });
    const commonTags = Object.entries(tagCounts)
      .filter(([_, count]) => count >= 2)
      .map(([tag, _]) => tag);

    // Create synthesis
    const synthesisResult = await pool.query(
      `
      INSERT INTO noosphere_syntheses (
        pattern_id, type, content, tags, confidence,
        supporting_evidence, rationale, source_trace_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `,
      [
        pattern_id,
        type || "insight",
        content,
        commonTags,
        pattern.confidence,
        JSON.stringify(
          memories.map((m) => ({
            memory_id: m.memory_id,
            agent_id: m.agent_id,
            excerpt: m.content.substring(0, 200),
          })),
        ),
        rationale,
        `synthesis:pattern-${pattern_id}`,
      ],
    );

    res.json({
      success: true,
      synthesis: synthesisResult.rows[0],
    });
  } catch (error) {
    console.error("Create synthesis error:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /syntheses - List proposed syntheses
app.get("/syntheses", authenticate, async (req, res) => {
  try {
    const { status = "proposed", limit = 50, offset = 0 } = req.query;

    const result = await pool.query(
      `
      SELECT s.*, p.title as pattern_title, p.agent_ids as pattern_agents
      FROM noosphere_syntheses s
      JOIN noosphere_patterns p ON s.pattern_id = p.id
      WHERE s.status = $1
      ORDER BY s.created_at DESC
      LIMIT $2 OFFSET $3
    `,
      [status, parseInt(limit), parseInt(offset)],
    );

    res.json({
      success: true,
      syntheses: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    console.error("Get syntheses error:", error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /syntheses/:id/review - Review synthesis (Council voting)
app.put("/syntheses/:id/review", authenticate, async (req, res) => {
  try {
    const { decision, notes } = req.body; // decision: 'approve', 'reject', 'abstain'
    const reviewerAgent = req.headers["x-agent-id"];

    if (!["approve", "reject", "abstain"].includes(decision)) {
      return res
        .status(400)
        .json({ error: "Invalid decision. Must be approve, reject, or abstain" });
    }

    // Record review
    await pool.query(
      `
      INSERT INTO noosphere_synthesis_reviews (synthesis_id, reviewer_agent_id, decision, notes)
      VALUES ($1, $2, $3, $4)
    `,
      [req.params.id, reviewerAgent, decision, notes],
    );

    // Update synthesis reviewed_by array
    await pool.query(
      `
      UPDATE noosphere_syntheses
      SET reviewed_by = array_append(reviewed_by, $1),
          review_notes = CASE
            WHEN review_notes IS NULL THEN $2
            ELSE review_notes || E'\n---\n' || $2
          END,
          updated_at = now()
      WHERE id = $3
    `,
      [reviewerAgent, notes || `${reviewerAgent}: ${decision}`, req.params.id],
    );

    // Check if consensus reached (4/6 agents = 67%)
    const reviewsResult = await pool.query(
      `
      SELECT
        COUNT(*) as total_reviews,
        SUM(CASE WHEN decision = 'approve' THEN 1 ELSE 0 END) as approvals,
        SUM(CASE WHEN decision = 'reject' THEN 1 ELSE 0 END) as rejections
      FROM noosphere_synthesis_reviews
      WHERE synthesis_id = $1
    `,
      [req.params.id],
    );

    const { total_reviews, approvals, rejections } = reviewsResult.rows[0];

    // Update status based on votes
    let newStatus = "proposed";
    if (parseInt(total_reviews) >= 3) {
      newStatus = "under_review";
    }
    if (parseInt(approvals) >= 4) {
      newStatus = "accepted";
    } else if (parseInt(rejections) >= 3) {
      newStatus = "rejected";
    }

    await pool.query(
      "UPDATE noosphere_syntheses SET status = $1, updated_at = now() WHERE id = $2",
      [newStatus, req.params.id],
    );

    res.json({
      success: true,
      review_recorded: true,
      status: newStatus,
      total_reviews: parseInt(total_reviews),
      approvals: parseInt(approvals),
      rejections: parseInt(rejections),
      consensus: newStatus === "accepted" || newStatus === "rejected",
    });
  } catch (error) {
    console.error("Review synthesis error:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST /syntheses/:id/promote - Promote accepted synthesis to memory
app.post("/syntheses/:id/promote", authenticate, async (req, res) => {
  try {
    // Get synthesis
    const synthesisResult = await pool.query("SELECT * FROM noosphere_syntheses WHERE id = $1", [
      req.params.id,
    ]);

    if (synthesisResult.rows.length === 0) {
      return res.status(404).json({ error: "Synthesis not found" });
    }

    const synthesis = synthesisResult.rows[0];

    if (synthesis.status !== "accepted") {
      return res.status(400).json({ error: "Only accepted syntheses can be promoted" });
    }

    if (synthesis.promoted_memory_id) {
      return res.status(400).json({ error: "Synthesis already promoted" });
    }

    // Get pattern to determine which agent should own the memory
    const patternResult = await pool.query("SELECT * FROM noosphere_patterns WHERE id = $1", [
      synthesis.pattern_id,
    ]);

    const pattern = patternResult.rows[0];
    const ownerAgent = pattern.agent_ids[0]; // Assign to first agent in pattern

    // Create memory from synthesis
    const memoryResult = await pool.query(
      `
      INSERT INTO noosphere_memory (
        agent_id, type, content, tags, confidence,
        source_trace_id, owner_agent_id, visibility,
        confidence_initial
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'shared', $8)
      RETURNING *
    `,
      [
        ownerAgent,
        synthesis.type,
        synthesis.content,
        synthesis.tags,
        synthesis.confidence,
        synthesis.source_trace_id,
        ownerAgent,
        synthesis.confidence,
      ],
    );

    // Update synthesis with promoted memory ID
    await pool.query(
      "UPDATE noosphere_syntheses SET promoted_memory_id = $1, updated_at = now() WHERE id = $2",
      [memoryResult.rows[0].id, req.params.id],
    );

    res.json({
      success: true,
      memory: memoryResult.rows[0],
      synthesis_id: req.params.id,
    });
  } catch (error) {
    console.error("Promote synthesis error:", error);
    res.status(500).json({ error: error.message });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Error handler
app.use((err, req, res, next) => {
  console.error("Server error:", err);
  res.status(500).json({ error: "Internal server error" });
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, closing connections...");
  pool.end(() => {
    console.log("Database connections closed");
    process.exit(0);
  });
});

// Start server
if (require.main === module) {
  const server = app.listen(PORT, () => {
    console.log(`Noosphere v3.3 Service listening on port ${PORT}`);
    console.log(`Database: ${process.env.DATABASE_URL ? "connected" : "not configured"}`);
    console.log(`Embeddings: ${ENABLE_EMBEDDINGS ? `${EMBEDDING_PROVIDER} enabled` : "disabled"}`);
    console.log(`Venice.ai: ${VENICE_API_KEY ? "enabled" : "disabled"}`);
    console.log(
      `Features: multi-agent-sharing, permission-model, access-logging, confidence-decay, reinforcement, pattern-mining, ai-synthesis`,
    );
  });

  // Verify database connection with exponential backoff retry
  let retryCount = 0;
  const maxRetries = 10;
  const baseDelayMs = 1000;

  async function verifyDatabaseWithRetry() {
    try {
      await pool.query("SELECT 1");
      clearTimeout(healthCheckTimeout);
      isHealthy = true;
      console.log("✅ Database connection verified - health check enabled");
    } catch (error) {
      retryCount++;
      if (retryCount < maxRetries) {
        const delayMs = baseDelayMs * Math.pow(2, retryCount - 1); // Exponential backoff
        console.warn(
          `⚠️  Database connection attempt ${retryCount}/${maxRetries} failed (${error.message}). ` +
            `Retrying in ${Math.round(delayMs / 1000)}s...`,
        );
        setTimeout(verifyDatabaseWithRetry, delayMs);
      } else {
        clearTimeout(healthCheckTimeout);
        console.error(
          `❌ Database connection failed after ${maxRetries} retries. ` +
            `Service running but health check will return 503 until database is available.`,
        );
      }
    }
  }

  verifyDatabaseWithRetry();
}

// Export for testing
module.exports = app;
