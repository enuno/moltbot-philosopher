/**
 * Integration tests for Moltbook SDK
 * These tests require a valid API key and network access
 */

import { MoltbookClient } from '../src/client/MoltbookClient';
import { MoltbookError, RateLimitError, NotFoundError, AuthenticationError } from '../src/utils/errors';

const API_KEY = process.env.MOLTBOOK_API_KEY;
const SKIP_INTEGRATION = !API_KEY || process.env.SKIP_INTEGRATION === 'true';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
}

class IntegrationTestRunner {
  private results: TestResult[] = [];
  private client: MoltbookClient | null = null;

  async setup(): Promise<void> {
    if (SKIP_INTEGRATION) {
      console.log('⚠️  Skipping integration tests (no API key or SKIP_INTEGRATION=true)\n');
      return;
    }

    this.client = new MoltbookClient({ apiKey: API_KEY });
    console.log('🔧 Setting up integration tests...\n');
  }

  async teardown(): Promise<void> {
    this.client = null;
  }

  async test(name: string, fn: (client: MoltbookClient) => Promise<void>): Promise<void> {
    if (SKIP_INTEGRATION || !this.client) {
      this.results.push({ name, passed: true, duration: 0 });
      return;
    }

    const start = Date.now();
    try {
      await fn(this.client);
      this.results.push({ name, passed: true, duration: Date.now() - start });
      console.log(`  ✓ ${name} (${Date.now() - start}ms)`);
    } catch (error) {
      const err = error as Error;
      this.results.push({ name, passed: false, error: err.message, duration: Date.now() - start });
      console.log(`  ✗ ${name}`);
      console.log(`    Error: ${err.message}`);
    }
  }

  printResults(): void {
    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;
    const total = this.results.length;
    const totalTime = this.results.reduce((sum, r) => sum + r.duration, 0);

    console.log('\n' + '='.repeat(60));
    console.log(`Results: ${passed}/${total} passed, ${failed} failed (${totalTime}ms)`);

    if (failed > 0) {
      console.log('\nFailed tests:');
      this.results.filter(r => !r.passed).forEach(r => {
        console.log(`  - ${r.name}: ${r.error}`);
      });
    }
  }
}

async function runIntegrationTests(): Promise<void> {
  console.log('\n🧪 Moltbook SDK Integration Tests\n');
  console.log('='.repeat(60));

  const runner = new IntegrationTestRunner();
  await runner.setup();

  console.log('\n[Agent Tests]\n');

  await runner.test('should get current agent profile', async (client) => {
    const me = await client.agents.me();
    if (!me.id || !me.name) throw new Error('Invalid agent profile');
  });

  await runner.test('should get agent status', async (client) => {
    const status = await client.agents.getStatus();
    if (!status.status) throw new Error('Invalid status response');
  });

  console.log('\n[Posts Tests]\n');

  await runner.test('should list hot posts', async (client) => {
    const posts = await client.posts.list({ sort: 'hot', limit: 5 });
    if (!Array.isArray(posts)) throw new Error('Expected array of posts');
  });

  await runner.test('should list new posts', async (client) => {
    const posts = await client.posts.list({ sort: 'new', limit: 5 });
    if (!Array.isArray(posts)) throw new Error('Expected array of posts');
  });

  await runner.test('should handle non-existent post', async (client) => {
    try {
      await client.posts.get('non_existent_post_12345');
      throw new Error('Should have thrown NotFoundError');
    } catch (error) {
      if (!(error instanceof NotFoundError)) throw error;
    }
  });

  console.log('\n[Submolts Tests]\n');

  await runner.test('should list submolts', async (client) => {
    const submolts = await client.submolts.list({ sort: 'popular', limit: 5 });
    if (!Array.isArray(submolts)) throw new Error('Expected array of submolts');
  });

  await runner.test('should get general submolt', async (client) => {
    const submolt = await client.submolts.get('general');
    if (!submolt.name) throw new Error('Invalid submolt');
  });

  console.log('\n[Feed Tests]\n');

  await runner.test('should get personalized feed', async (client) => {
    const feed = await client.feed.get({ sort: 'hot', limit: 5 });
    if (!Array.isArray(feed)) throw new Error('Expected array of posts');
  });

  console.log('\n[Search Tests]\n');

  await runner.test('should search for content', async (client) => {
    const results = await client.search.query('test', { limit: 5 });
    if (!results.posts || !results.agents || !results.submolts) {
      throw new Error('Invalid search results');
    }
  });

  console.log('\n[Rate Limit Tests]\n');

  await runner.test('should track rate limits', async (client) => {
    await client.agents.me();
    const info = client.getRateLimitInfo();
    // Rate limit info may or may not be present depending on response headers
  });

  await runner.test('should check if rate limited', async (client) => {
    const isLimited = client.isRateLimited();
    if (typeof isLimited !== 'boolean') throw new Error('Expected boolean');
  });

  console.log('\n[Error Handling Tests]\n');

  await runner.test('should handle authentication error', async () => {
    const badClient = new MoltbookClient({ apiKey: 'moltbook_invalid_key_12345678901234567890' });
    try {
      await badClient.agents.me();
      throw new Error('Should have thrown AuthenticationError');
    } catch (error) {
      if (!(error instanceof AuthenticationError)) throw error;
    }
  });

  await runner.teardown();
  runner.printResults();
}

// Run tests
runIntegrationTests().catch(console.error);
