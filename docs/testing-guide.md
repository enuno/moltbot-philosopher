# Testing Guide - Moltbot

## Overview

This guide explains how to run, write, and maintain tests for the Moltbot
project. We use **Jest** for JavaScript/Node.js testing and **pytest** for
Python testing.

## Quick Start

### Running Tests

```bash

# JavaScript tests (Jest)
pnpm test                    # Run all tests
pnpm test:watch             # Watch mode
pnpm test:coverage          # With coverage report
pnpm test:ci                # CI mode (JUnit XML)

# Python tests (pytest) - when implemented
pytest                       # Run all Python tests
pytest --cov                # With coverage
pytest -k "noosphere"       # Run specific tests

```

### Test Status

✅ **Phase 1 Complete**: Test infrastructure setup

- Jest configured and working

- Test directory structure created

- Example tests passing

- CI integration complete

🚧 **In Progress**: Writing actual service tests (Phase 2)

## Test Organization

### Directory Structure

```
tests/
├── unit/                   # Unit tests (isolated components)
│   ├── services/
│   │   ├── ai-content-generator/
│   │   ├── model-router/
│   │   ├── ntfy-publisher/
│   │   └── thread-monitor/
│   ├── scripts/
│   │   ├── bash/          # Bash script tests
│   │   └── python/        # Python script tests
│   └── noosphere/         # Memory system tests
├── integration/           # Integration tests (multiple components)
│   ├── api/
│   ├── services/
│   └── workflows/
├── e2e/                   # End-to-end tests (full scenarios)
│   └── scenarios/
└── fixtures/              # Test data and mocks
    ├── api-responses/
    ├── state-files/
    └── mock-data/

```

## Writing Tests

### JavaScript/Node.js Tests (Jest)

#### Basic Test Structure

```javascript
// tests/unit/services/my-service/my-feature.test.js

describe('MyService', () => {
  // Setup before all tests
  beforeAll(() => {
    // One-time setup
  });

  // Setup before each test
  beforeEach(() => {
    // Reset state
  });

  // Cleanup after each test
  afterEach(() => {
    // Clean up
  });

  describe('myFeature', () => {
    it('should do something specific', () => {
      // Arrange
      const input = 'test';

      // Act
      const result = myFunction(input);

      // Assert
      expect(result).toBe('expected');
    });

    it('should handle errors', () => {
      expect(() => {
        myFunction(null);
      }).toThrow('Expected error');
    });
  });
});

```

#### HTTP Mocking with Nock

```javascript
const nock = require('nock');

describe('API Client', () => {
  afterEach(() => {
    nock.cleanAll();
  });

  it('should call external API', async () => {
    // Mock the API
    nock('<http://api.example.com'>)
      .post('/endpoint')
      .reply(200, { result: 'success' });

    // Test your code
    const response = await myApiCall();

    expect(response.result).toBe('success');
  });
});

```

#### Testing Express Apps with Supertest

```javascript
const request = require('supertest');
const app = require('../../../services/my-service/src/index');

describe('GET /health', () => {
  it('should return 200 OK', async () => {
    const response = await request(app)
      .get('/health')
      .expect(200);

    expect(response.body.status).toBe('healthy');
  });
});

```

### Python Tests (pytest)

#### Basic Test Structure

```python

# tests/unit/scripts/python/test_my_script.py

import pytest
from scripts.my_script import my_function

class TestMyScript:
    """Test suite for my_script.py"""

    @pytest.fixture
    def sample_data(self):
        """Provide test data"""
        return {"key": "value"}

    def test_my_function(self, sample_data):
        """Test basic functionality"""
        result = my_function(sample_data)
        assert result == expected

    def test_error_handling(self):
        """Test error cases"""
        with pytest.raises(ValueError):
            my_function(None)

```

#### Parametrized Tests

```python
@pytest.mark.parametrize("input,expected", [
    (1, 2),
    (5, 6),
    (10, 11),
])
def test_increment(input, expected):
    """Test multiple cases"""
    assert increment(input) == expected

```

#### Mocking in Python

```python
from unittest.mock import Mock, patch

def test_with_mock():
    """Test with mocked dependency"""
    with patch('module.external_call') as mock_call:
        mock_call.return_value = 'mocked'

        result = my_function()

        assert result == 'mocked'
        mock_call.assert_called_once()

```

## Test Patterns

### Test Naming Conventions

**JavaScript**:

- Test files: `*.test.js`

- Format: `should [expected behavior] when [condition]`

- Example: `should return 200 when service is healthy`

**Python**:

- Test files: `test_*.py`

- Format: `test_[function]_[condition]`

- Example: `test_recall_engine_filters_by_confidence`

### AAA Pattern

All tests should follow **Arrange-Act-Assert**:

```javascript
it('should calculate total correctly', () => {
  // Arrange: Set up test data
  const items = [1, 2, 3];

  // Act: Execute the function
  const total = sum(items);

  // Assert: Verify the result
  expect(total).toBe(6);
});

```

### Test Independence

Each test should:

- Run independently of other tests

- Not rely on execution order

- Clean up after itself

- Use fresh data/mocks

```javascript
describe('Counter', () => {
  let counter;

  beforeEach(() => {
    counter = new Counter(); // Fresh instance each test
  });

  afterEach(() => {
    counter = null; // Cleanup
  });

  it('should increment', () => {
    counter.increment();
    expect(counter.value).toBe(1);
  });
});

```

## Mocking Best Practices

### Mock External Dependencies

```javascript
// Mock environment variables
beforeAll(() => {
  process.env.API_KEY = 'test-key';
});

// Mock HTTP calls
nock('<http://api.example.com'>)
  .get('/data')
  .reply(200, mockData);

// Mock modules
jest.mock('axios');
axios.get.mockResolvedValue({ data: mockResponse });

```

### Don't Mock Everything

Only mock:

- External APIs

- File system operations

- Time-dependent code

- Random number generation

- Network calls

Don't mock:

- Your own code (test the real thing)

- Simple utilities

- Pure functions

## Coverage

### Viewing Coverage

```bash

# Generate coverage report
pnpm test:coverage

# Open HTML report
open coverage/lcov-report/index.html

```

### Coverage Goals

| Component | Target | Priority |
|-----------|--------|----------|
| AI Generator | 85% | HIGH |
| Model Router | 85% | HIGH |
| Thread Monitor | 80% | HIGH |
| NTFY Publisher | 75% | MEDIUM |
| Python Scripts | 75% | HIGH |
| Bash Scripts | 60% | MEDIUM |
| **Overall** | **75%** | - |

### What to Test

**High Priority**:

- Critical business logic

- Error handling paths

- State management

- API endpoints

- Data transformations

**Low Priority**:

- Logging statements

- Simple getters/setters

- Configuration loading

- Pure pass-through code

## Continuous Integration

### GitHub Actions

Tests run automatically on:

- Push to `main` or `develop`

- Pull requests

View results:

- Actions tab in GitHub

- Codecov dashboard

### Local Pre-commit

Run tests before committing:

```bash

# Add to .git/hooks/pre-commit
#!/bin/bash
pnpm test

```

## Debugging Tests

### Interactive Debugging

```bash

# Run single test file
pnpm test path/to/test.test.js

# Run tests matching pattern
pnpm test --testNamePattern="my test"

# Debug with Node inspector
node --inspect-brk node_modules/.bin/jest --runInBand

```

### Debug Output

```javascript
// Add debug logging
it('should work', () => {
  console.log('Debug:', variable);
  expect(result).toBe(expected);
});

// Use jest.debug
it('should work', () => {
  jest.debug(myObject);
});

```

## Common Issues

### Tests Timing Out

```javascript
// Increase timeout for specific test
it('should handle slow operation', async () => {
  // Test code
}, 30000); // 30 second timeout

```

### Flaky Tests

Causes:

- Timing issues (use proper async/await)

- Shared state (ensure test independence)

- External dependencies (mock them)

- Random data (use deterministic values)

### Mock Not Working

```javascript
// Clear mock between tests
afterEach(() => {
  jest.clearAllMocks();
});

// Reset mock implementation
mock.mockReset();

```

## Best Practices

### Do's

✅ Write descriptive test names
✅ Test one thing per test
✅ Use fixtures for common data
✅ Mock external dependencies
✅ Test error paths
✅ Keep tests fast (<100ms each)
✅ Use meaningful assertions
✅ Clean up after tests

### Don'ts

❌ Test implementation details
❌ Share state between tests
❌ Use actual API calls in tests
❌ Test private methods directly
❌ Have tests depend on each other
❌ Commit failing tests
❌ Skip tests without good reason

## Resources

### Documentation

- [Jest Documentation](https://jestjs.io/)

- [pytest Documentation](https://docs.pytest.org/)

- [Supertest GitHub](https://github.com/ladjs/supertest)

- [Nock GitHub](https://github.com/nock/nock)

### Internal Resources

- [Test Implementation Plan](/.copilot/session-state/*/plan.md)

- [Example Tests](/tests/unit/services/ai-content-generator/example.test.js)

## Getting Help

### Common Commands Reference

```bash

# JavaScript Tests
pnpm test                       # Run all tests
pnpm test -- --watch           # Watch mode
pnpm test -- --coverage        # Coverage report
pnpm test -- path/to/test      # Run specific test
pnpm test -- --testNamePattern "pattern"  # Pattern match

# Python Tests
pytest                          # Run all tests
pytest -v                       # Verbose output
pytest --cov                    # With coverage
pytest -k "pattern"            # Run matching tests
pytest --markers               # List available markers
pytest -x                      # Stop on first failure

```

### Need Help?

1. Check this guide

2. Look at example tests

3. Review test implementation plan

4. Ask in pull request reviews

5. Check CI logs for failures

---

**Last Updated**: 2026-02-10
**Status**: Phase 1 Complete - Infrastructure Ready
**Next**: Phase 2 - Service Unit Tests
