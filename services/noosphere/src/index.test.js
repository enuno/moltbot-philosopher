/**
 * Noosphere v3.1 Integration Tests
 * Tests for multi-agent memory sharing features
 */

const request = require('supertest');
const { Pool } = require('pg');

// Mock environment variables
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://noosphere_admin:changeme_noosphere_2026@localhost:5432/noosphere';
process.env.MOLTBOOK_API_KEY = process.env.MOLTBOOK_API_KEY || 'test-api-key';
process.env.ENABLE_EMBEDDINGS = 'false';

const app = require('./index');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

describe('Noosphere v3.1 Multi-Agent Memory Sharing', () => {
  let testMemoryId;
  const apiKey = process.env.MOLTBOOK_API_KEY;

  // Clean up test data after all tests
  afterAll(async () => {
    if (testMemoryId) {
      await pool.query('DELETE FROM noosphere_memory WHERE id = $1', [testMemoryId]);
    }
    await pool.end();
  });

  describe('POST /memories (with visibility)', () => {
    test('should create memory with default private visibility', async () => {
      const response = await request(app)
        .post('/memories')
        .set('X-API-Key', apiKey)
        .send({
          agent_id: 'classical',
          type: 'insight',
          content: 'Test insight for v3.1 sharing',
          confidence: 0.85,
          tags: ['test', 'v3.1']
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.memory.visibility).toBe('private');
      expect(response.body.memory.owner_agent_id).toBe('classical');

      testMemoryId = response.body.memory.id;
    });

    test('should create memory with explicit public visibility', async () => {
      const response = await request(app)
        .post('/memories')
        .set('X-API-Key', apiKey)
        .send({
          agent_id: 'existentialist',
          type: 'pattern',
          content: 'Public pattern for testing',
          confidence: 0.70,
          tags: ['test'],
          visibility: 'public'
        });

      expect(response.status).toBe(201);
      expect(response.body.memory.visibility).toBe('public');

      // Clean up
      await pool.query('DELETE FROM noosphere_memory WHERE id = $1', [response.body.memory.id]);
    });

    test('should reject invalid visibility', async () => {
      const response = await request(app)
        .post('/memories')
        .set('X-API-Key', apiKey)
        .send({
          agent_id: 'classical',
          type: 'insight',
          content: 'Test with invalid visibility',
          visibility: 'invalid-visibility'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid visibility');
    });
  });

  describe('POST /memories/:id/share', () => {
    test('should share memory with another agent', async () => {
      const response = await request(app)
        .post(`/memories/${testMemoryId}/share`)
        .set('X-API-Key', apiKey)
        .send({
          agent_id: 'existentialist',
          permissions: ['read'],
          granted_by: 'classical'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('shared with existentialist');
      expect(response.body.visibility).toBe('shared');
      expect(response.body.permissions).toHaveLength(1);
      expect(response.body.permissions[0].permission).toBe('read');
    });

    test('should share with multiple permissions', async () => {
      const response = await request(app)
        .post(`/memories/${testMemoryId}/share`)
        .set('X-API-Key', apiKey)
        .send({
          agent_id: 'transcendentalist',
          permissions: ['read', 'write'],
          granted_by: 'classical'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.permissions).toHaveLength(2);
    });

    test('should reject sharing by non-owner', async () => {
      const response = await request(app)
        .post(`/memories/${testMemoryId}/share`)
        .set('X-API-Key', apiKey)
        .send({
          agent_id: 'joyce',
          permissions: ['read'],
          granted_by: 'beat' // Not the owner
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('owner');
    });

    test('should reject invalid permissions', async () => {
      const response = await request(app)
        .post(`/memories/${testMemoryId}/share`)
        .set('X-API-Key', apiKey)
        .send({
          agent_id: 'joyce',
          permissions: ['execute'], // Invalid permission
          granted_by: 'classical'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid permission');
    });

    test('should handle non-existent memory', async () => {
      const response = await request(app)
        .post('/memories/00000000-0000-0000-0000-000000000000/share')
        .set('X-API-Key', apiKey)
        .send({
          agent_id: 'joyce',
          permissions: ['read'],
          granted_by: 'classical'
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('not found');
    });
  });

  describe('GET /memories/:id/permissions', () => {
    test('should list all permissions for a memory', async () => {
      const response = await request(app)
        .get(`/memories/${testMemoryId}/permissions`)
        .set('X-API-Key', apiKey);

      expect(response.status).toBe(200);
      expect(response.body.memory_id).toBe(testMemoryId);
      expect(Array.isArray(response.body.permissions)).toBe(true);
      expect(response.body.permissions.length).toBeGreaterThan(0);

      // Check permission structure
      const perm = response.body.permissions[0];
      expect(perm).toHaveProperty('id');
      expect(perm).toHaveProperty('agent_id');
      expect(perm).toHaveProperty('permission');
      expect(perm).toHaveProperty('granted_by');
      expect(perm).toHaveProperty('granted_at');
      expect(perm).toHaveProperty('is_expired');
    });
  });

  describe('GET /memories/shared', () => {
    test('should query shared memories for an agent', async () => {
      const response = await request(app)
        .get('/memories/shared')
        .set('X-API-Key', apiKey)
        .query({ agent_id: 'existentialist', permission: 'read' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('shared_memories');
      expect(Array.isArray(response.body.shared_memories)).toBe(true);
      expect(response.body).toHaveProperty('pagination');

      // Should include our test memory
      const sharedMemory = response.body.shared_memories.find(m => m.id === testMemoryId);
      expect(sharedMemory).toBeDefined();
      expect(sharedMemory.content).toContain('Test insight');
    });

    test('should require agent_id parameter', async () => {
      const response = await request(app)
        .get('/memories/shared')
        .set('X-API-Key', apiKey);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('agent_id');
    });

    test('should filter by permission type', async () => {
      const response = await request(app)
        .get('/memories/shared')
        .set('X-API-Key', apiKey)
        .query({ agent_id: 'transcendentalist', permission: 'write' });

      expect(response.status).toBe(200);
      expect(response.body.shared_memories).toBeDefined();
      // Should have write permission on test memory
      const hasWriteAccess = response.body.shared_memories.some(m => m.id === testMemoryId);
      expect(hasWriteAccess).toBe(true);
    });
  });

  describe('GET /memories/:id/access-log', () => {
    test('should return access log for a memory', async () => {
      const response = await request(app)
        .get(`/memories/${testMemoryId}/access-log`)
        .set('X-API-Key', apiKey);

      expect(response.status).toBe(200);
      expect(response.body.memory_id).toBe(testMemoryId);
      expect(Array.isArray(response.body.access_log)).toBe(true);
      expect(response.body.access_log.length).toBeGreaterThan(0);

      // Check log entry structure
      const entry = response.body.access_log[0];
      expect(entry).toHaveProperty('agent_id');
      expect(entry).toHaveProperty('action');
      expect(entry).toHaveProperty('accessed_at');
      expect(entry).toHaveProperty('success');
      expect(entry.action).toBe('share'); // From previous share operations
    });

    test('should support pagination', async () => {
      const response = await request(app)
        .get(`/memories/${testMemoryId}/access-log`)
        .set('X-API-Key', apiKey)
        .query({ limit: 1, offset: 0 });

      expect(response.status).toBe(200);
      expect(response.body.access_log).toHaveLength(1);
      expect(response.body.pagination.limit).toBe(1);
    });
  });

  describe('DELETE /memories/:id/share/:agent_id', () => {
    test('should revoke permissions for an agent', async () => {
      const response = await request(app)
        .delete(`/memories/${testMemoryId}/share/existentialist`)
        .set('X-API-Key', apiKey)
        .send({ revoked_by: 'classical' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('revoked');
      expect(response.body.removed).toBeGreaterThan(0);
    });

    test('should reject revocation by non-owner', async () => {
      const response = await request(app)
        .delete(`/memories/${testMemoryId}/share/transcendentalist`)
        .set('X-API-Key', apiKey)
        .send({ revoked_by: 'beat' }); // Not the owner

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('owner');
    });

    test('should verify permissions were removed', async () => {
      // Check that existentialist no longer has access
      const sharedResponse = await request(app)
        .get('/memories/shared')
        .set('X-API-Key', apiKey)
        .query({ agent_id: 'existentialist', permission: 'read' });

      expect(sharedResponse.status).toBe(200);
      const hasAccess = sharedResponse.body.shared_memories.some(m => m.id === testMemoryId);
      expect(hasAccess).toBe(false);
    });
  });

  describe('POST /permissions/cleanup', () => {
    test('should clean up expired permissions', async () => {
      const response = await request(app)
        .post('/permissions/cleanup')
        .set('X-API-Key', apiKey);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body).toHaveProperty('deleted_count');
      expect(typeof response.body.deleted_count).toBe('number');
    });
  });

  describe('GET /memories with visibility filter', () => {
    test('should filter by visibility', async () => {
      const response = await request(app)
        .get('/memories')
        .set('X-API-Key', apiKey)
        .query({ agent_id: 'classical', visibility: 'shared' });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.memories)).toBe(true);
      // All returned memories should have shared visibility
      response.body.memories.forEach(mem => {
        expect(mem.visibility).toBe('shared');
      });
    });
  });

  describe('Authentication', () => {
    test('should reject requests without API key', async () => {
      const response = await request(app)
        .get('/memories/shared')
        .query({ agent_id: 'classical' });

      expect(response.status).toBe(401);
    });

    test('should reject requests with invalid API key', async () => {
      const response = await request(app)
        .get('/memories/shared')
        .set('X-API-Key', 'invalid-key')
        .query({ agent_id: 'classical' });

      expect(response.status).toBe(401);
    });
  });
});
