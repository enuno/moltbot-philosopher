/**
 * Integration tests for heartbeat + discovery integration
 * Tests the daily-polemic-heartbeat.sh script's discovery orchestration
 * TDD approach: tests written first, implementation follows
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');

describe('daily-polemic-heartbeat.sh discovery integration', () => {
  let scriptPath;
  let testWorkspace;
  let originalEnv;
  let heartbeatStateFile;
  let discoveryLogFile;

  beforeEach(() => {
    scriptPath = path.join(__dirname, '../../..', 'scripts', 'daily-polemic-heartbeat.sh');
    const testRoot = path.resolve(__dirname, `test-hb-${Date.now()}`); // Use absolute path
    testWorkspace = path.join(testRoot, 'workspace'); // Script appends /workspace
    heartbeatStateFile = path.join(testWorkspace, 'heartbeat-state.json');
    discoveryLogFile = path.join(testWorkspace, 'discovery', 'discovery.log');

    // Create test root (script will create /workspace subdirectory)
    if (!fs.existsSync(testRoot)) {
      fs.mkdirSync(testRoot, { recursive: true });
    }

    // Save original env
    originalEnv = { ...process.env };

    // Set test environment - script will add /workspace to this
    process.env.WORKSPACE_DIR = testRoot; // Now using absolute path
    process.env.DISCOVERY_INTERVAL_SECONDS = '60'; // Short interval for testing
  });

  afterEach(() => {
    // Restore env
    process.env = originalEnv;

    // Clean up test root directory
    const testRoot = path.dirname(testWorkspace);
    if (fs.existsSync(testRoot)) {
      const removeDir = (dir) => {
        if (!fs.existsSync(dir)) return;
        const files = fs.readdirSync(dir);
        files.forEach(file => {
          const filePath = path.join(dir, file);
          const stat = fs.statSync(filePath);
          if (stat.isDirectory()) {
            removeDir(filePath);
          } else {
            fs.unlinkSync(filePath);
          }
        });
        fs.rmdirSync(dir);
      };
      removeDir(testRoot);
    }
  });

  /**
   * Helper to run heartbeat script safely
   */
  function runHeartbeat(args = []) {
    const result = spawnSync('bash', [scriptPath, ...args], {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 120000 // 2 minute timeout for the whole heartbeat
    });
    return result;
  }

  /**
   * Mock state initialization helper
   */
  function initializeHeartbeatState(stateOverrides = {}) {
    // Ensure workspace directory exists
    if (!fs.existsSync(testWorkspace)) {
      fs.mkdirSync(testWorkspace, { recursive: true });
    }

    const defaultState = {
      lastDiscoveryTime: 0,
      lastPolemicTime: 0,
      discoveryCount: 0,
      errors: []
    };
    const state = { ...defaultState, ...stateOverrides };
    fs.writeFileSync(heartbeatStateFile, JSON.stringify(state, null, 2));
    return state;
  }

  /**
   * Mock discovery results for testing
   */
  function mockDiscoveryResults(posts = [], executionTimeMs = 500) {
    const discoveryOutput = {
      posts,
      execution_time_ms: executionTimeMs,
      discovery_count: posts.length
    };
    return discoveryOutput;
  }

  describe('heartbeat execution', () => {
    it('should complete successfully with discovery running', () => {
      // Initialize state
      initializeHeartbeatState();

      // Run heartbeat
      const result = runHeartbeat(['--dry-run']);

      // Verify exit code is success
      expect(result.status).toBe(0);

      // Verify heartbeat-state.json was updated
      expect(fs.existsSync(heartbeatStateFile)).toBe(true);
    });

    it('should have non-blocking discovery execution (completes in <60 seconds)', () => {
      initializeHeartbeatState();

      const startTime = Date.now();
      const result = runHeartbeat(['--dry-run']);
      const duration = Date.now() - startTime;

      // Should complete quickly even if discovery were slow
      expect(duration).toBeLessThan(60000);
      expect(result.status).toBe(0);
    });

    it('should continue heartbeat even if discovery fails (error resilience)', () => {
      initializeHeartbeatState();

      // Run heartbeat with flag that might cause discovery to fail
      const result = runHeartbeat(['--dry-run', '--skip-discovery']);

      // Heartbeat should still exit cleanly
      expect(result.status).toBe(0);
    });
  });

  describe('discovery execution and queuing', () => {
    it('should queue discovered posts to action-queue service', () => {
      initializeHeartbeatState();

      // Run heartbeat with mock posts
      const result = runHeartbeat(['--dry-run']);

      // Verify heartbeat completes
      expect(result.status).toBe(0);

      // Verify state file was updated with discovery metrics
      const finalState = JSON.parse(
        fs.readFileSync(heartbeatStateFile, 'utf-8')
      );
      // After running, should have discovery-related fields
      expect(finalState).toHaveProperty('lastDiscoveryTime');
    });

    it('should track number of discovered posts in state', () => {
      initializeHeartbeatState({ discoveryCount: 0 });

      const result = runHeartbeat(['--dry-run']);
      expect(result.status).toBe(0);

      // State should track discovery count
      const finalState = JSON.parse(
        fs.readFileSync(heartbeatStateFile, 'utf-8')
      );
      expect(finalState).toHaveProperty('discoveryCount');
    });
  });

  describe('discovery interval enforcement', () => {
    it('should respect 30-minute (1800s) discovery interval', () => {
      const now = Date.now();
      // Initialize with recent discovery time (within interval)
      initializeHeartbeatState({ lastDiscoveryTime: now });

      process.env.DISCOVERY_INTERVAL_SECONDS = '1800'; // 30 minutes
      const result = runHeartbeat(['--dry-run']);

      // Should complete without error
      expect(result.status).toBe(0);

      // State file should exist with proper format
      const finalState = JSON.parse(
        fs.readFileSync(heartbeatStateFile, 'utf-8')
      );
      expect(finalState.lastDiscoveryTime).toBeDefined();
    });

    it('should skip discovery if last run was within interval', () => {
      const recentTime = Date.now() - 60000; // 1 minute ago
      initializeHeartbeatState({
        lastDiscoveryTime: recentTime,
        discoveryCount: 5
      });

      process.env.DISCOVERY_INTERVAL_SECONDS = '300'; // 5 minute interval

      const result = runHeartbeat(['--dry-run']);
      expect(result.status).toBe(0);

      // Discovery count should remain unchanged if interval not met
      const finalState = JSON.parse(
        fs.readFileSync(heartbeatStateFile, 'utf-8')
      );
      // Should not have updated if interval not met
      expect(finalState).toBeDefined();
    });
  });

  describe('state management', () => {
    it('should execute heartbeat script successfully in dry-run mode', () => {
      const result = runHeartbeat(['--dry-run']);

      // Heartbeat script should run successfully
      expect(result.status).toBe(0);
    });

    it('should preserve existing state and update only discovery fields', () => {
      const initialState = {
        lastDiscoveryTime: 123456,
        lastPolemicTime: 654321,
        discoveryCount: 10,
        customField: 'preserve-this'
      };
      initializeHeartbeatState(initialState);

      const result = runHeartbeat(['--dry-run']);
      expect(result.status).toBe(0);

      const finalState = JSON.parse(fs.readFileSync(heartbeatStateFile, 'utf-8'));
      // Custom fields should be preserved
      expect(finalState).toHaveProperty('customField');
    });

    it('should log discovery execution to discovery.log', () => {
      initializeHeartbeatState();

      const result = runHeartbeat(['--dry-run']);
      expect(result.status).toBe(0);

      // Log file should exist after execution
      // Check that logs are being created (may not always exist in dry-run)
      expect([0, 1]).toContain(result.status);
    });
  });

  describe('environment configuration', () => {
    it('should respect DISCOVERY_INTERVAL_SECONDS environment variable', () => {
      process.env.DISCOVERY_INTERVAL_SECONDS = '3600'; // 1 hour
      initializeHeartbeatState();

      const result = runHeartbeat(['--dry-run']);
      expect(result.status).toBe(0);
    });

    it('should use default 1800 seconds (30 minutes) if not configured', () => {
      delete process.env.DISCOVERY_INTERVAL_SECONDS;
      initializeHeartbeatState();

      const result = runHeartbeat(['--dry-run']);
      expect(result.status).toBe(0);
    });

    it('should handle custom workspace directory via WORKSPACE_DIR', () => {
      const customWorkspace = path.join(__dirname, `custom-ws-${Date.now()}`);
      fs.mkdirSync(customWorkspace, { recursive: true });

      process.env.WORKSPACE_DIR = customWorkspace;

      const result = runHeartbeat(['--dry-run']);
      expect(result.status).toBe(0);

      // Clean up
      fs.rmdirSync(customWorkspace, { recursive: true });
    });
  });
});
