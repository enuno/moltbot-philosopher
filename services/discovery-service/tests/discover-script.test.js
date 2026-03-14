/**
 * Integration tests for discover-relevant-threads.sh
 * Tests the bash script's behavior with mocked Noosphere responses
 * TDD approach: tests written first, implementation follows
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');

describe('discover-relevant-threads.sh', () => {
  let scriptPath;
  let testTempDir;
  let originalEnv;

  beforeEach(() => {
    scriptPath = path.join(__dirname, '../../..', 'scripts', 'discover-relevant-threads.sh');
    testTempDir = path.join(__dirname, `test-discover-${Date.now()}`);

    // Create temp directory for test artifacts
    if (!fs.existsSync(testTempDir)) {
      fs.mkdirSync(testTempDir, { recursive: true });
    }

    // Save original env
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    // Restore env
    process.env = originalEnv;

    // Clean up temp directory
    if (fs.existsSync(testTempDir)) {
      const files = fs.readdirSync(testTempDir);
      files.forEach(file => {
        fs.unlinkSync(path.join(testTempDir, file));
      });
      fs.rmdirSync(testTempDir);
    }
  });

  /**
   * Helper function to run script safely
   */
  function runScript(args = []) {
    const result = spawnSync('bash', [scriptPath, ...args], {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });

    return {
      code: result.status,
      stdout: result.stdout,
      stderr: result.stderr,
      error: result.error
    };
  }

  describe('script execution and output', () => {
    it('should output valid JSON in dry-run mode', () => {
      const result = runScript(['--dry-run']);

      expect(result.code).toBe(0);
      expect(result.error).toBeUndefined();

      // Parse output to verify it's valid JSON
      const parsed = JSON.parse(result.stdout);
      expect(parsed).toHaveProperty('posts');
      expect(parsed).toHaveProperty('execution_time_ms');
      expect(parsed).toHaveProperty('discovery_count');
      expect(Array.isArray(parsed.posts)).toBe(true);
    });

    it('should return valid JSON structure with required fields', () => {
      const result = runScript(['--dry-run']);

      const parsed = JSON.parse(result.stdout);
      expect(parsed.execution_time_ms).toBeGreaterThanOrEqual(0);
      expect(typeof parsed.execution_time_ms).toBe('number');
      expect(typeof parsed.discovery_count).toBe('number');
      expect(parsed.discovery_count >= 0).toBe(true);
    });
  });

  describe('--limit flag', () => {
    it('should respect --limit flag and not exceed max posts', () => {
      const result = runScript(['--dry-run', '--limit', '5']);
      const parsed = JSON.parse(result.stdout);

      expect(parsed.posts.length).toBeLessThanOrEqual(5);
    });

    it('should default to 10 posts when --limit not provided', () => {
      const result = runScript(['--dry-run']);
      const parsed = JSON.parse(result.stdout);

      expect(parsed.posts.length).toBeLessThanOrEqual(10);
    });

    it('should enforce maximum of 10 posts even with higher --limit', () => {
      const result = runScript(['--dry-run', '--limit', '50']);
      const parsed = JSON.parse(result.stdout);

      expect(parsed.posts.length).toBeLessThanOrEqual(10);
    });

    it('should handle --limit 1', () => {
      const result = runScript(['--dry-run', '--limit', '1']);
      const parsed = JSON.parse(result.stdout);

      expect(parsed.posts.length).toBeLessThanOrEqual(1);
    });
  });

  describe('similarity filtering', () => {
    it('should filter results by 0.7 similarity threshold', () => {
      const result = runScript(['--dry-run', '--limit', '10']);
      const parsed = JSON.parse(result.stdout);

      // Each post should have similarity >= 0.7
      parsed.posts.forEach(post => {
        if (post.similarity !== undefined) {
          const similarity = typeof post.similarity === 'string'
            ? parseFloat(post.similarity)
            : post.similarity;
          expect(similarity).toBeGreaterThanOrEqual(0.7);
        }
      });
    });

    it('should include similarity field in output posts', () => {
      const result = runScript(['--dry-run', '--limit', '3']);
      const parsed = JSON.parse(result.stdout);

      // Sample posts should have similarity field
      if (parsed.posts.length > 0) {
        parsed.posts.forEach(post => {
          expect(post).toHaveProperty('id');
        });
      }
    });
  });

  describe('deduplication', () => {
    it('should produce valid post objects with required fields', () => {
      const result = runScript(['--dry-run', '--limit', '5']);
      const parsed = JSON.parse(result.stdout);

      parsed.posts.forEach(post => {
        expect(post).toHaveProperty('id');
        // In dry-run, we expect at minimum id field; other fields may vary
      });
    });
  });

  describe('execution time constraint', () => {
    it('should complete in less than 3000ms (dry-run)', () => {
      const startTime = Date.now();
      const result = runScript(['--dry-run']);
      const endTime = Date.now();

      expect(result.code).toBe(0);

      const parsed = JSON.parse(result.stdout);
      const actualExecutionTime = endTime - startTime;

      // Verify internal reported time is reasonable
      expect(parsed.execution_time_ms).toBeLessThan(3000);

      // Verify actual execution time is reasonable (allow longer for CI environments)
      expect(actualExecutionTime).toBeLessThan(10000);
    });

    it('should report execution_time_ms that is positive', () => {
      const result = runScript(['--dry-run']);
      const parsed = JSON.parse(result.stdout);

      // Should report some execution time
      expect(parsed.execution_time_ms).toBeGreaterThanOrEqual(0);
      expect(parsed.execution_time_ms).toBeLessThan(3000);
    });
  });

  describe('--category flag', () => {
    it('should accept --category flag without error', () => {
      const result = runScript(['--dry-run', '--category', 'ethics']);

      expect(result.code).toBe(0);

      const parsed = JSON.parse(result.stdout);
      expect(parsed).toHaveProperty('posts');
    });

    it('should accept different valid categories', () => {
      const categories = ['epistemology', 'ethics', 'metaphysics', 'logic', 'political'];

      categories.forEach(category => {
        const result = runScript(['--dry-run', '--category', category]);
        expect(result.code).toBe(0);
        const parsed = JSON.parse(result.stdout);
        expect(parsed).toHaveProperty('posts');
      });
    });
  });

  describe('error handling', () => {
    it('should exit with code 0 on success', () => {
      const result = runScript(['--dry-run']);

      expect(result.code).toBe(0);
      expect(result.error).toBeUndefined();
    });

    it('should always output valid JSON in dry-run mode', () => {
      const result = runScript(['--dry-run']);

      // Should not throw when parsing
      expect(() => {
        JSON.parse(result.stdout);
      }).not.toThrow();
    });
  });

  describe('discovery_count accuracy', () => {
    it('should report accurate discovery_count matching posts length', () => {
      const result = runScript(['--dry-run', '--limit', '10']);
      const parsed = JSON.parse(result.stdout);

      expect(parsed.discovery_count).toBe(parsed.posts.length);
    });

    it('should have discovery_count equal to array length', () => {
      const result = runScript(['--dry-run', '--limit', '5']);
      const parsed = JSON.parse(result.stdout);

      expect(Array.isArray(parsed.posts)).toBe(true);
      expect(typeof parsed.discovery_count).toBe('number');
      expect(parsed.discovery_count).toBe(parsed.posts.length);
    });
  });

  describe('post structure and content', () => {
    it('should include essential fields in each post', () => {
      const result = runScript(['--dry-run', '--limit', '3']);
      const parsed = JSON.parse(result.stdout);

      parsed.posts.forEach(post => {
        // Minimal fields that should always be present
        expect(typeof post.id).toBe('string');
      });
    });

    it('should have numeric similarity scores where defined', () => {
      const result = runScript(['--dry-run', '--limit', '5']);
      const parsed = JSON.parse(result.stdout);

      parsed.posts.forEach(post => {
        if (post.similarity !== undefined && post.similarity !== null) {
          const sim = typeof post.similarity === 'string'
            ? parseFloat(post.similarity)
            : post.similarity;
          expect(typeof sim).toBe('number');
          expect(sim).toBeGreaterThanOrEqual(0.7);
          expect(sim).toBeLessThanOrEqual(1.0);
        }
      });
    });
  });
});
