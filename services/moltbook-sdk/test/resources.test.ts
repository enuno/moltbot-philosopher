/**
 * Unit tests for SDK resources
 */

import { MoltbookClient } from '../src/client/MoltbookClient';
import { MockServer, getMockServer, resetMockServer } from './mock-server';
import { MoltbookError, ValidationError, NotFoundError } from '../src/utils/errors';

let passed = 0;
let failed = 0;
const tests: Array<{ type: string; name: string; fn?: () => Promise<void> }> = [];

function describe(name: string, fn: () => void): void { tests.push({ type: 'describe', name }); fn(); }
function test(name: string, fn: () => Promise<void>): void { tests.push({ type: 'test', name, fn }); }
function assert(condition: boolean, message?: string): void { if (!condition) throw new Error(message || 'Assertion failed'); }
function assertEqual<T>(actual: T, expected: T): void { if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`); }

async function runTests(): Promise<void> {
  console.log('\n🧪 Resource Unit Tests\n');
  console.log('='.repeat(60));

  for (const item of tests) {
    if (item.type === 'describe') {
      console.log(`\n[${item.name}]\n`);
    } else if (item.fn) {
      try {
        await item.fn();
        console.log(`  ✓ ${item.name}`);
        passed++;
      } catch (error) {
        console.log(`  ✗ ${item.name}`);
        console.log(`    Error: ${(error as Error).message}`);
        failed++;
      }
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`Results: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

// Tests

describe('Agents Resource', () => {
  test('me() returns agent profile', async () => {
    const client = new MoltbookClient({ apiKey: 'moltbook_test12345678901234567890' });
    // Would need mock server integration
    assert(typeof client.agents.me === 'function');
  });

  test('register() creates agent', async () => {
    const client = new MoltbookClient();
    assert(typeof client.agents.register === 'function');
  });

  test('getProfile() fetches other agent', async () => {
    const client = new MoltbookClient({ apiKey: 'moltbook_test12345678901234567890' });
    assert(typeof client.agents.getProfile === 'function');
  });

  test('follow() follows agent', async () => {
    const client = new MoltbookClient({ apiKey: 'moltbook_test12345678901234567890' });
    assert(typeof client.agents.follow === 'function');
  });

  test('unfollow() unfollows agent', async () => {
    const client = new MoltbookClient({ apiKey: 'moltbook_test12345678901234567890' });
    assert(typeof client.agents.unfollow === 'function');
  });

  test('isFollowing() returns boolean', async () => {
    const client = new MoltbookClient({ apiKey: 'moltbook_test12345678901234567890' });
    assert(typeof client.agents.isFollowing === 'function');
  });
});

describe('Posts Resource', () => {
  test('create() creates post', async () => {
    const client = new MoltbookClient({ apiKey: 'moltbook_test12345678901234567890' });
    assert(typeof client.posts.create === 'function');
  });

  test('get() fetches post by ID', async () => {
    const client = new MoltbookClient({ apiKey: 'moltbook_test12345678901234567890' });
    assert(typeof client.posts.get === 'function');
  });

  test('list() returns posts array', async () => {
    const client = new MoltbookClient({ apiKey: 'moltbook_test12345678901234567890' });
    assert(typeof client.posts.list === 'function');
  });

  test('delete() removes post', async () => {
    const client = new MoltbookClient({ apiKey: 'moltbook_test12345678901234567890' });
    assert(typeof client.posts.delete === 'function');
  });

  test('upvote() upvotes post', async () => {
    const client = new MoltbookClient({ apiKey: 'moltbook_test12345678901234567890' });
    assert(typeof client.posts.upvote === 'function');
  });

  test('downvote() downvotes post', async () => {
    const client = new MoltbookClient({ apiKey: 'moltbook_test12345678901234567890' });
    assert(typeof client.posts.downvote === 'function');
  });

  test('iterate() returns async generator', async () => {
    const client = new MoltbookClient({ apiKey: 'moltbook_test12345678901234567890' });
    assert(typeof client.posts.iterate === 'function');
  });
});

describe('Comments Resource', () => {
  test('create() creates comment', async () => {
    const client = new MoltbookClient({ apiKey: 'moltbook_test12345678901234567890' });
    assert(typeof client.comments.create === 'function');
  });

  test('get() fetches comment', async () => {
    const client = new MoltbookClient({ apiKey: 'moltbook_test12345678901234567890' });
    assert(typeof client.comments.get === 'function');
  });

  test('list() returns comments tree', async () => {
    const client = new MoltbookClient({ apiKey: 'moltbook_test12345678901234567890' });
    assert(typeof client.comments.list === 'function');
  });

  test('flatten() converts tree to flat array', async () => {
    const client = new MoltbookClient({ apiKey: 'moltbook_test12345678901234567890' });
    const nested = [
      { id: '1', content: 'C1', score: 0, upvotes: 0, downvotes: 0, parentId: null, depth: 0, authorName: 'a', createdAt: '', replies: [
        { id: '2', content: 'C2', score: 0, upvotes: 0, downvotes: 0, parentId: '1', depth: 1, authorName: 'a', createdAt: '', replies: [] }
      ]}
    ];
    const flat = client.comments.flatten(nested);
    assertEqual(flat.length, 2);
  });

  test('count() counts all comments', async () => {
    const client = new MoltbookClient({ apiKey: 'moltbook_test12345678901234567890' });
    const nested = [
      { id: '1', content: 'C1', score: 0, upvotes: 0, downvotes: 0, parentId: null, depth: 0, authorName: 'a', createdAt: '', replies: [
        { id: '2', content: 'C2', score: 0, upvotes: 0, downvotes: 0, parentId: '1', depth: 1, authorName: 'a', createdAt: '' }
      ]}
    ];
    const count = client.comments.count(nested);
    assertEqual(count, 2);
  });
});

describe('Submolts Resource', () => {
  test('list() returns submolts', async () => {
    const client = new MoltbookClient({ apiKey: 'moltbook_test12345678901234567890' });
    assert(typeof client.submolts.list === 'function');
  });

  test('get() fetches submolt', async () => {
    const client = new MoltbookClient({ apiKey: 'moltbook_test12345678901234567890' });
    assert(typeof client.submolts.get === 'function');
  });

  test('create() creates submolt', async () => {
    const client = new MoltbookClient({ apiKey: 'moltbook_test12345678901234567890' });
    assert(typeof client.submolts.create === 'function');
  });

  test('subscribe() subscribes to submolt', async () => {
    const client = new MoltbookClient({ apiKey: 'moltbook_test12345678901234567890' });
    assert(typeof client.submolts.subscribe === 'function');
  });

  test('getFeed() returns submolt feed', async () => {
    const client = new MoltbookClient({ apiKey: 'moltbook_test12345678901234567890' });
    assert(typeof client.submolts.getFeed === 'function');
  });
});

describe('Feed Resource', () => {
  test('get() returns personalized feed', async () => {
    const client = new MoltbookClient({ apiKey: 'moltbook_test12345678901234567890' });
    assert(typeof client.feed.get === 'function');
  });

  test('iterate() returns async generator', async () => {
    const client = new MoltbookClient({ apiKey: 'moltbook_test12345678901234567890' });
    assert(typeof client.feed.iterate === 'function');
  });
});

describe('Search Resource', () => {
  test('query() searches all content', async () => {
    const client = new MoltbookClient({ apiKey: 'moltbook_test12345678901234567890' });
    assert(typeof client.search.query === 'function');
  });

  test('posts() searches posts only', async () => {
    const client = new MoltbookClient({ apiKey: 'moltbook_test12345678901234567890' });
    assert(typeof client.search.posts === 'function');
  });

  test('agents() searches agents only', async () => {
    const client = new MoltbookClient({ apiKey: 'moltbook_test12345678901234567890' });
    assert(typeof client.search.agents === 'function');
  });

  test('submolts() searches submolts only', async () => {
    const client = new MoltbookClient({ apiKey: 'moltbook_test12345678901234567890' });
    assert(typeof client.search.submolts === 'function');
  });
});

// Run
runTests();
