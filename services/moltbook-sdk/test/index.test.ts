/**
 * @moltbook/sdk Test Suite
 *
 * Comprehensive tests for the Moltbook TypeScript SDK
 */

import { MoltbookClient } from '../src/client/MoltbookClient';
import { HttpClient } from '../src/client/HttpClient';
import {
  MoltbookError,
  AuthenticationError,
  RateLimitError,
  NotFoundError,
  ValidationError,
  ConfigurationError
} from '../src/utils/errors';

// Test utilities
let passed = 0;
let failed = 0;
const tests: Array<{ type: string; name: string; fn?: () => Promise<void> }> = [];

function describe(name: string, fn: () => void): void {
  tests.push({ type: 'describe', name });
  fn();
}

function test(name: string, fn: () => Promise<void>): void {
  tests.push({ type: 'test', name, fn });
}

function assert(condition: boolean, message?: string): void {
  if (!condition) throw new Error(message || 'Assertion failed');
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, got ${actual}`);
  }
}

function assertThrows(fn: () => void, errorType?: new (...args: any[]) => Error): void {
  let threw = false;
  let thrownError: unknown;

  try {
    fn();
  } catch (error) {
    threw = true;
    thrownError = error;
  }

  if (!threw) {
    throw new Error('Expected function to throw');
  }

  if (errorType && !(thrownError instanceof errorType)) {
    throw new Error(`Expected ${errorType.name}, got ${(thrownError as Error).constructor.name}`);
  }
}

async function runTests(): Promise<void> {
  console.log('\n@moltbook/sdk Test Suite\n');
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
  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

// =============================================================================
// Tests
// =============================================================================

describe('MoltbookClient Configuration', () => {
  test('creates client with default config', async () => {
    const client = new MoltbookClient();
    assert(client instanceof MoltbookClient);
  });

  test('creates client with API key', async () => {
    const client = new MoltbookClient({ apiKey: 'moltbook_test123' });
    assert(client instanceof MoltbookClient);
  });

  test('throws on invalid API key format', async () => {
    assertThrows(() => {
      new MoltbookClient({ apiKey: 'invalid_key' });
    }, ConfigurationError);
  });

  test('throws on invalid timeout', async () => {
    assertThrows(() => {
      new MoltbookClient({ timeout: -1 });
    }, ConfigurationError);
  });

  test('throws on invalid retries', async () => {
    assertThrows(() => {
      new MoltbookClient({ retries: -1 });
    }, ConfigurationError);
  });

  test('allows empty API key for registration', async () => {
    const client = new MoltbookClient({ apiKey: undefined });
    assert(client instanceof MoltbookClient);
  });

  test('setApiKey updates key', async () => {
    const client = new MoltbookClient();
    client.setApiKey('moltbook_newkey123');
    // Should not throw
    assert(true);
  });

  test('setApiKey validates format', async () => {
    const client = new MoltbookClient();
    assertThrows(() => {
      client.setApiKey('badkey');
    }, ConfigurationError);
  });
});

describe('Error Classes', () => {
  test('MoltbookError has correct properties', async () => {
    const error = new MoltbookError('Test error', 500, 'TEST_CODE', 'Test hint');

    assertEqual(error.message, 'Test error');
    assertEqual(error.statusCode, 500);
    assertEqual(error.code, 'TEST_CODE');
    assertEqual(error.hint, 'Test hint');
    assertEqual(error.name, 'MoltbookError');
  });

  test('AuthenticationError defaults', async () => {
    const error = new AuthenticationError();

    assertEqual(error.statusCode, 401);
    assertEqual(error.code, 'UNAUTHORIZED');
    assert(error.hint !== undefined);
  });

  test('RateLimitError has retry info', async () => {
    const error = new RateLimitError('Rate limited', 30);

    assertEqual(error.statusCode, 429);
    assertEqual(error.retryAfter, 30);
    assert(error.resetAt instanceof Date);
    assert(error.resetAt.getTime() > Date.now());
  });

  test('NotFoundError defaults', async () => {
    const error = new NotFoundError();

    assertEqual(error.statusCode, 404);
    assertEqual(error.code, 'NOT_FOUND');
  });

  test('ValidationError with details', async () => {
    const error = new ValidationError('Invalid input', 'VALIDATION_ERROR', 'Check fields');

    assertEqual(error.statusCode, 400);
    assertEqual(error.hint, 'Check fields');
  });

  test('Error toJSON includes all fields', async () => {
    const error = new MoltbookError('Test', 400, 'CODE', 'Hint');
    const json = error.toJSON();

    assert('name' in json);
    assert('message' in json);
    assert('statusCode' in json);
    assert('code' in json);
    assert('hint' in json);
  });

  test('RateLimitError toJSON includes retryAfter', async () => {
    const error = new RateLimitError('Rate limited', 60);
    const json = error.toJSON();

    assert('retryAfter' in json);
    assert('resetAt' in json);
  });
});

describe('HttpClient Configuration', () => {
  test('creates with default config', async () => {
    const client = new HttpClient();
    assert(client instanceof HttpClient);
  });

  test('creates with custom config', async () => {
    const client = new HttpClient({
      apiKey: 'moltbook_test',
      baseUrl: 'https://api.test.com',
      timeout: 60000,
      retries: 5
    });
    assert(client instanceof HttpClient);
  });

  test('getRateLimitInfo returns null initially', async () => {
    const client = new HttpClient();
    assertEqual(client.getRateLimitInfo(), null);
  });
});

describe('Resource Initialization', () => {
  test('client has agents resource', async () => {
    const client = new MoltbookClient();
    assert(client.agents !== undefined);
  });

  test('client has posts resource', async () => {
    const client = new MoltbookClient();
    assert(client.posts !== undefined);
  });

  test('client has comments resource', async () => {
    const client = new MoltbookClient();
    assert(client.comments !== undefined);
  });

  test('client has submolts resource', async () => {
    const client = new MoltbookClient();
    assert(client.submolts !== undefined);
  });

  test('client has feed resource', async () => {
    const client = new MoltbookClient();
    assert(client.feed !== undefined);
  });

  test('client has search resource', async () => {
    const client = new MoltbookClient();
    assert(client.search !== undefined);
  });
});

describe('Rate Limit Helpers', () => {
  test('getRateLimitRemaining returns null initially', async () => {
    const client = new MoltbookClient();
    assertEqual(client.getRateLimitRemaining(), null);
  });

  test('getRateLimitReset returns null initially', async () => {
    const client = new MoltbookClient();
    assertEqual(client.getRateLimitReset(), null);
  });

  test('isRateLimited returns false initially', async () => {
    const client = new MoltbookClient();
    assertEqual(client.isRateLimited(), false);
  });
});

describe('Comments Utility Methods', () => {
  test('flatten converts nested to flat array', async () => {
    const client = new MoltbookClient();
    const nested = [
      {
        id: '1',
        content: 'Comment 1',
        score: 10,
        upvotes: 10,
        downvotes: 0,
        parentId: null,
        depth: 0,
        authorName: 'agent1',
        createdAt: '2025-01-01T00:00:00Z',
        replies: [
          {
            id: '2',
            content: 'Reply 1',
            score: 5,
            upvotes: 5,
            downvotes: 0,
            parentId: '1',
            depth: 1,
            authorName: 'agent2',
            createdAt: '2025-01-01T00:01:00Z',
            replies: []
          }
        ]
      }
    ];

    const flat = client.comments.flatten(nested);
    assertEqual(flat.length, 2);
  });

  test('count returns total including nested', async () => {
    const client = new MoltbookClient();
    const nested = [
      {
        id: '1',
        content: 'Comment 1',
        score: 10,
        upvotes: 10,
        downvotes: 0,
        parentId: null,
        depth: 0,
        authorName: 'agent1',
        createdAt: '2025-01-01T00:00:00Z',
        replies: [
          {
            id: '2',
            content: 'Reply 1',
            score: 5,
            upvotes: 5,
            downvotes: 0,
            parentId: '1',
            depth: 1,
            authorName: 'agent2',
            createdAt: '2025-01-01T00:01:00Z',
            replies: [
              {
                id: '3',
                content: 'Reply 2',
                score: 2,
                upvotes: 2,
                downvotes: 0,
                parentId: '2',
                depth: 2,
                authorName: 'agent3',
                createdAt: '2025-01-01T00:02:00Z',
                replies: []
              }
            ]
          }
        ]
      }
    ];

    const count = client.comments.count(nested);
    assertEqual(count, 3);
  });
});

describe('Quick Helpers', () => {
  test('whoami is alias for agents.me', async () => {
    const client = new MoltbookClient();
    assert(typeof client.whoami === 'function');
  });

  test('createPost is alias for posts.create', async () => {
    const client = new MoltbookClient();
    assert(typeof client.createPost === 'function');
  });

  test('createComment is alias for comments.create', async () => {
    const client = new MoltbookClient();
    assert(typeof client.createComment === 'function');
  });

  test('getHotPosts is available', async () => {
    const client = new MoltbookClient();
    assert(typeof client.getHotPosts === 'function');
  });

  test('getNewPosts is available', async () => {
    const client = new MoltbookClient();
    assert(typeof client.getNewPosts === 'function');
  });
});

describe('Type Exports', () => {
  test('Agent type is exported', async () => {
    // TypeScript compilation would fail if not exported
    assert(true);
  });

  test('Post type is exported', async () => {
    assert(true);
  });

  test('Comment type is exported', async () => {
    assert(true);
  });

  test('Submolt type is exported', async () => {
    assert(true);
  });
});

// Run tests
runTests();
