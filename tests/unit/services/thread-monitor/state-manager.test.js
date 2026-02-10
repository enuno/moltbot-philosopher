/**
 * Thread Monitor - State Manager Tests
 * Tests for StateManager class (file operations, thread lifecycle)
 */

const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const StateManager = require('../../../../services/thread-monitor/src/state-manager');
const fixtures = require('../../../fixtures/thread-monitor-fixtures');

describe('Thread Monitor - State Manager', () => {
  let stateManager;
  let mockLogger;
  let testStateDir;

  beforeEach(async () => {
    // Create temporary state directory
    testStateDir = path.join(os.tmpdir(), `thread-state-${Date.now()}`);

    // Mock logger
    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Create state manager with test config
    const testConfig = {
      ...fixtures.mockConfig,
      stateDir: testStateDir,
    };

    stateManager = new StateManager(testConfig, mockLogger);
    await stateManager.init();
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testStateDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Initialization', () => {
    it('should initialize state directories', async () => {
      const activeDir = path.join(testStateDir, 'active');
      const archivedDir = path.join(testStateDir, 'archived');
      const probesDir = path.join(testStateDir, 'probes');

      const activeExists = await fs
        .access(activeDir)
        .then(() => true)
        .catch(() => false);
      const archivedExists = await fs
        .access(archivedDir)
        .then(() => true)
        .catch(() => false);
      const probesExists = await fs
        .access(probesDir)
        .then(() => true)
        .catch(() => false);

      expect(activeExists).toBe(true);
      expect(archivedExists).toBe(true);
      expect(probesExists).toBe(true);
    });

    it('should log successful initialization', async () => {
      expect(mockLogger.info).toHaveBeenCalledWith('State directories initialized');
    });
  });

  describe('Thread ID Sanitization', () => {
    it('should accept valid thread IDs', () => {
      const validIds = ['thread-123', 'thread_456', 'abc-xyz-123'];

      validIds.forEach((id) => {
        expect(() => stateManager.sanitizeThreadId(id)).not.toThrow();
      });
    });

    it('should reject thread IDs with path traversal', () => {
      const invalidIds = ['../../../etc/passwd', '..\\windows', 'thread/../bad'];

      invalidIds.forEach((id) => {
        expect(() => stateManager.sanitizeThreadId(id)).toThrow(/Invalid thread ID/);
      });
    });

    it('should reject thread IDs with special characters', () => {
      const invalidIds = ['thread@123', 'thread#456', 'thread/789'];

      invalidIds.forEach((id) => {
        expect(() => stateManager.sanitizeThreadId(id)).toThrow(/Invalid thread ID/);
      });
    });

    it('should reject empty thread IDs', () => {
      expect(() => stateManager.sanitizeThreadId('')).toThrow(/Invalid thread ID/);
    });
  });

  describe('Thread Creation', () => {
    it('should create a new thread', async () => {
      const thread = await stateManager.createThread({
        thread_id: 'test-thread-1',
        original_question: 'What is consciousness?',
      });

      expect(thread).toBeDefined();
      expect(thread.thread_id).toBe('test-thread-1');
      expect(thread.state).toBe('initiated');
      expect(thread.original_question).toBe('What is consciousness?');
    });

    it('should initialize thread with default values', async () => {
      const thread = await stateManager.createThread({
        thread_id: 'test-thread-2',
        original_question: 'Test question',
      });

      expect(thread.exchange_count).toBe(0);
      expect(thread.participants).toEqual([]);
      expect(thread.archetypes_engaged).toEqual([]);
      expect(thread.stall_count).toBe(0);
      expect(thread.orchestrator_posts).toBe(0);
      expect(thread.synthesis_chain).toEqual([]);
    });

    it('should include timestamps', async () => {
      const beforeCreate = Math.floor(Date.now() / 1000);
      const thread = await stateManager.createThread({
        thread_id: 'test-thread-3',
        original_question: 'Test question',
      });
      const afterCreate = Math.floor(Date.now() / 1000);

      expect(thread.created_at).toBeGreaterThanOrEqual(beforeCreate);
      expect(thread.created_at).toBeLessThanOrEqual(afterCreate);
      expect(thread.last_activity).toBe(thread.created_at);
    });

    it('should limit constraints to 3', async () => {
      const thread = await stateManager.createThread({
        thread_id: 'test-thread-4',
        original_question: 'Test question',
        constraints: ['one', 'two', 'three', 'four', 'five'],
      });

      expect(thread.constraints).toHaveLength(3);
      expect(thread.constraints).toEqual(['one', 'two', 'three']);
    });

    it('should include metadata', async () => {
      const thread = await stateManager.createThread({
        thread_id: 'test-thread-5',
        original_question: 'Test question',
        metadata: {
          custom_field: 'custom_value',
        },
      });

      expect(thread.metadata).toHaveProperty('custom_field', 'custom_value');
    });

    it('should save thread to file', async () => {
      await stateManager.createThread({
        thread_id: 'test-thread-6',
        original_question: 'Test question',
      });

      const filePath = path.join(testStateDir, 'active', 'thread-test-thread-6.json');
      const fileExists = await fs
        .access(filePath)
        .then(() => true)
        .catch(() => false);

      expect(fileExists).toBe(true);
    });
  });

  describe('Thread Retrieval', () => {
    beforeEach(async () => {
      // Create test threads
      await stateManager.createThread({
        thread_id: 'existing-thread',
        original_question: 'Existing question',
      });
    });

    it('should retrieve existing thread', async () => {
      const thread = await stateManager.getThread('existing-thread');

      expect(thread).toBeDefined();
      expect(thread.thread_id).toBe('existing-thread');
    });

    it('should return null for non-existent thread', async () => {
      const thread = await stateManager.getThread('non-existent');

      expect(thread).toBeNull();
    });

    it('should retrieve all active threads', async () => {
      await stateManager.createThread({
        thread_id: 'thread-a',
        original_question: 'Question A',
      });
      await stateManager.createThread({
        thread_id: 'thread-b',
        original_question: 'Question B',
      });

      const threads = await stateManager.getActiveThreads();

      expect(threads).toHaveLength(3); // Including 'existing-thread'
      expect(threads.map((t) => t.thread_id)).toContain('thread-a');
      expect(threads.map((t) => t.thread_id)).toContain('thread-b');
    });

    it('should return empty array when no active threads', async () => {
      // Clean up existing threads
      const threads = await stateManager.getActiveThreads();
      for (const thread of threads) {
        const filePath = path.join(testStateDir, 'active', `thread-${thread.thread_id}.json`);
        await fs.unlink(filePath);
      }

      const activeThreads = await stateManager.getActiveThreads();
      expect(activeThreads).toEqual([]);
    });
  });

  describe('Exchange Recording', () => {
    beforeEach(async () => {
      await stateManager.createThread({
        thread_id: 'exchange-thread',
        original_question: 'Test question',
      });
    });

    it('should record exchange and increment count', async () => {
      const thread = await stateManager.recordExchange('exchange-thread', {
        author: 'Socrates',
        archetype: 'socratic',
      });

      expect(thread.exchange_count).toBe(1);
    });

    it('should add participant to list', async () => {
      await stateManager.recordExchange('exchange-thread', {
        author: 'Socrates',
        archetype: 'socratic',
      });

      const thread = await stateManager.getThread('exchange-thread');
      expect(thread.participants).toContain('Socrates');
    });

    it('should not duplicate participants', async () => {
      await stateManager.recordExchange('exchange-thread', {
        author: 'Socrates',
        archetype: 'socratic',
      });
      await stateManager.recordExchange('exchange-thread', {
        author: 'Socrates',
        archetype: 'socratic',
      });

      const thread = await stateManager.getThread('exchange-thread');
      expect(thread.participants).toEqual(['Socrates']);
    });

    it('should add archetype to list', async () => {
      await stateManager.recordExchange('exchange-thread', {
        author: 'Socrates',
        archetype: 'socratic',
      });

      const thread = await stateManager.getThread('exchange-thread');
      expect(thread.archetypes_engaged).toContain('socratic');
    });

    it('should transition state from initiated to active', async () => {
      const thread = await stateManager.recordExchange('exchange-thread', {
        author: 'Socrates',
        archetype: 'socratic',
      });

      expect(thread.state).toBe('active');
    });

    it('should update last activity timestamp', async () => {
      const beforeExchange = Math.floor(Date.now() / 1000);
      await stateManager.recordExchange('exchange-thread', {
        author: 'Socrates',
        archetype: 'socratic',
      });
      const afterExchange = Math.floor(Date.now() / 1000);

      const thread = await stateManager.getThread('exchange-thread');
      expect(thread.last_activity).toBeGreaterThanOrEqual(beforeExchange);
      expect(thread.last_activity).toBeLessThanOrEqual(afterExchange);
    });

    it('should reset orchestrator posts counter', async () => {
      // First manually set orchestrator_posts
      const thread = await stateManager.getThread('exchange-thread');
      thread.orchestrator_posts = 2;
      await stateManager.saveThread(thread);

      // Record exchange
      await stateManager.recordExchange('exchange-thread', {
        author: 'Socrates',
        archetype: 'socratic',
      });

      const updatedThread = await stateManager.getThread('exchange-thread');
      expect(updatedThread.orchestrator_posts).toBe(0);
    });

    it('should throw error for non-existent thread', async () => {
      await expect(
        stateManager.recordExchange('non-existent', {
          author: 'Socrates',
          archetype: 'socratic',
        }),
      ).rejects.toThrow(/Thread not found/);
    });
  });

  describe('File Path Operations', () => {
    it('should generate correct path for active thread', () => {
      const filePath = stateManager.getThreadPath('test-123', false);
      expect(filePath).toContain('active');
      expect(filePath).toContain('thread-test-123.json');
    });

    it('should generate correct path for archived thread', () => {
      const filePath = stateManager.getThreadPath('test-456', true);
      expect(filePath).toContain('archived');
      expect(filePath).toContain('thread-test-456.json');
    });

    it('should sanitize thread ID in path', () => {
      expect(() => stateManager.getThreadPath('../bad', false)).toThrow(/Invalid thread ID/);
    });
  });
});
