/**
 * State Manager
 * 
 * Manages thread state persistence, retrieval, and lifecycle transitions.
 * Uses JSON files for state storage in the workspace directory.
 */

const fs = require('fs').promises;
const path = require('path');

class StateManager {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.stateDir = config.stateDir;
    this.activeDir = path.join(this.stateDir, 'active');
    this.archivedDir = path.join(this.stateDir, 'archived');
    this.probesDir = path.join(this.stateDir, 'probes');
  }

  /**
   * Initialize state directories
   */
  async init() {
    try {
      await fs.mkdir(this.activeDir, { recursive: true });
      await fs.mkdir(this.archivedDir, { recursive: true });
      await fs.mkdir(this.probesDir, { recursive: true });
      this.logger.info('State directories initialized');
    } catch (error) {
      this.logger.error('Failed to initialize state directories', { error: error.message });
      throw error;
    }
  }

  /**
   * Get file path for a thread
   */
  getThreadPath(threadId, archived = false) {
    const dir = archived ? this.archivedDir : this.activeDir;
    return path.join(dir, `thread-${threadId}.json`);
  }

  /**
   * Create a new thread
   */
  async createThread({ thread_id, original_question, constraints = [], metadata = {} }) {
    const now = Math.floor(Date.now() / 1000);
    
    const thread = {
      thread_id,
      state: 'initiated',
      created_at: now,
      last_activity: now,
      exchange_count: 0,
      participants: [],
      archetypes_engaged: [],
      original_question,
      constraints: constraints.slice(0, 3), // Max 3 constraints
      last_probe_type: null,
      stall_count: 0,
      orchestrator_posts: 0,
      synthesis_chain: [],
      target_metrics: {
        min_exchanges: this.config.targetMinExchanges,
        min_archetypes: this.config.targetMinArchetypes
      },
      metadata: {
        topic_domain: metadata.topic_domain || 'philosophy_of_mind',
        complexity_score: metadata.complexity_score || 5,
        engagement_quality: 0,
        ...metadata
      }
    };

    await this.saveThread(thread);
    return thread;
  }

  /**
   * Save thread state to file
   */
  async saveThread(thread) {
    const filePath = this.getThreadPath(thread.thread_id, thread.state === 'archived');
    
    try {
      await fs.writeFile(filePath, JSON.stringify(thread, null, 2));
    } catch (error) {
      this.logger.error('Failed to save thread', { 
        thread_id: thread.thread_id, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Get thread by ID
   */
  async getThread(threadId) {
    // Check active first
    let filePath = this.getThreadPath(threadId, false);
    
    try {
      const data = await fs.readFile(filePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        this.logger.error('Error reading thread', { thread_id: threadId, error: error.message });
        throw error;
      }
    }
    
    // Check archived
    filePath = this.getThreadPath(threadId, true);
    
    try {
      const data = await fs.readFile(filePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Get all active threads
   */
  async getActiveThreads() {
    try {
      const files = await fs.readdir(this.activeDir);
      const threads = [];
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const data = await fs.readFile(path.join(this.activeDir, file), 'utf8');
            threads.push(JSON.parse(data));
          } catch (error) {
            this.logger.warn('Failed to parse thread file', { file, error: error.message });
          }
        }
      }
      
      return threads;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  /**
   * Record a new exchange/comment in the thread
   */
  async recordExchange(threadId, { author, content, archetype }) {
    const thread = await this.getThread(threadId);
    
    if (!thread) {
      throw new Error(`Thread not found: ${threadId}`);
    }

    const now = Math.floor(Date.now() / 1000);
    
    // Update thread state
    thread.exchange_count += 1;
    thread.last_activity = now;
    
    // Add participant if new
    if (!thread.participants.includes(author)) {
      thread.participants.push(author);
    }
    
    // Add archetype if provided
    if (archetype && !thread.archetypes_engaged.includes(archetype)) {
      thread.archetypes_engaged.push(archetype);
    }
    
    // Reset orchestrator consecutive posts counter
    thread.orchestrator_posts = 0;
    
    // Transition from initiated to active
    if (thread.state === 'initiated') {
      thread.state = 'active';
    }
    
    // Reset stall state if returning from stalled
    if (thread.state === 'stalled') {
      thread.state = 'active';
    }
    
    await this.saveThread(thread);
    return thread;
  }

  /**
   * Record orchestrator-generated synthesis in the chain
   */
  async recordSynthesis(threadId, { synthesis, tension, propagation, author = 'orchestrator' }) {
    const thread = await this.getThread(threadId);
    
    if (!thread) {
      throw new Error(`Thread not found: ${threadId}`);
    }

    const now = Math.floor(Date.now() / 1000);
    
    thread.synthesis_chain.push({
      exchange_number: thread.exchange_count + 1,
      synthesis,
      tension,
      propagation,
      author,
      timestamp: now
    });
    
    thread.exchange_count += 1;
    thread.last_activity = now;
    thread.orchestrator_posts += 1;
    
    await this.saveThread(thread);
    return thread;
  }

  /**
   * Mark thread as stalled
   */
  async markStalled(threadId) {
    const thread = await this.getThread(threadId);
    
    if (!thread) {
      throw new Error(`Thread not found: ${threadId}`);
    }
    
    thread.state = 'stalled';
    thread.stall_count += 1;
    
    await this.saveThread(thread);
    return thread;
  }

  /**
   * Record probe posted
   */
  async recordProbe(threadId, probeType) {
    const thread = await this.getThread(threadId);
    
    if (!thread) {
      throw new Error(`Thread not found: ${threadId}`);
    }
    
    thread.last_probe_type = probeType || 'auto';
    
    // Save probe to separate file for tracking
    const probeRecord = {
      thread_id: threadId,
      probe_type: probeType,
      timestamp: Math.floor(Date.now() / 1000),
      stall_count: thread.stall_count
    };
    
    const probePath = path.join(
      this.probesDir, 
      `probe-${threadId}-${Date.now()}.json`
    );
    
    try {
      await fs.writeFile(probePath, JSON.stringify(probeRecord, null, 2));
    } catch (error) {
      this.logger.warn('Failed to save probe record', { error: error.message });
    }
    
    await this.saveThread(thread);
    return thread;
  }

  /**
   * Mark thread as completed
   */
  async markCompleted(threadId) {
    const thread = await this.getThread(threadId);
    
    if (!thread) {
      throw new Error(`Thread not found: ${threadId}`);
    }
    
    thread.state = 'completed';
    thread.metadata.completion_timestamp = Math.floor(Date.now() / 1000);
    
    await this.saveThread(thread);
    return thread;
  }

  /**
   * Archive a thread
   */
  async archiveThread(threadId) {
    const thread = await this.getThread(threadId);
    
    if (!thread) {
      throw new Error(`Thread not found: ${threadId}`);
    }
    
    // Update state
    thread.state = 'archived';
    thread.metadata.archived_timestamp = Math.floor(Date.now() / 1000);
    
    // Save to archived directory
    const archivedPath = this.getThreadPath(threadId, true);
    await fs.writeFile(archivedPath, JSON.stringify(thread, null, 2));
    
    // Remove from active
    const activePath = this.getThreadPath(threadId, false);
    try {
      await fs.unlink(activePath);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        this.logger.warn('Failed to remove active thread file', { error: error.message });
      }
    }
    
    this.logger.info('Thread archived', { thread_id: threadId });
    return thread;
  }

  /**
   * Get thread statistics
   */
  async getStats() {
    const activeThreads = await this.getActiveThreads();
    
    const stats = {
      total_active: activeThreads.length,
      by_state: {},
      total_exchanges: 0,
      avg_engagement_quality: 0,
      successful_threads: 0
    };
    
    for (const thread of activeThreads) {
      // Count by state
      stats.by_state[thread.state] = (stats.by_state[thread.state] || 0) + 1;
      
      // Sum exchanges
      stats.total_exchanges += thread.exchange_count;
      
      // Sum engagement quality
      stats.avg_engagement_quality += thread.metadata.engagement_quality || 0;
      
      // Count successful threads
      if (thread.exchange_count >= this.config.targetMinExchanges &&
          thread.archetypes_engaged.length >= this.config.targetMinArchetypes) {
        stats.successful_threads += 1;
      }
    }
    
    if (activeThreads.length > 0) {
      stats.avg_engagement_quality = stats.avg_engagement_quality / activeThreads.length;
    }
    
    return stats;
  }
}

module.exports = StateManager;
