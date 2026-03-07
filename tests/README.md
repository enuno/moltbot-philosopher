# Moltbot Tests

This directory contains all test suites for the Moltbot project.

## Structure

```text
tests/
├── unit/              # Unit tests (test individual components)
├── integration/       # Integration tests (test component interactions)
├── e2e/              # End-to-end tests (test complete workflows)
└── fixtures/         # Test data, mocks, and fixtures

```

## Running Tests

```bash

# Run all tests
pnpm test

# Run with coverage
pnpm test:coverage

# Watch mode
pnpm test:watch

```

## Writing Tests

See [Testing Guide](../docs/testing-guide.md) for comprehensive documentation.

### Quick Example

```javascript
// tests/unit/services/my-service/feature.test.js

describe('MyService', () => {
  it('should do something', () => {
    const result = myFunction('input');
    expect(result).toBe('expected');
  });
});

```

## Current Status

✅ **Phase 1 Complete**: Test infrastructure setup

- Jest configured

- Directory structure created

- Example tests passing

- CI integration complete

🚧 **Phase 2 In Progress**: Writing service unit tests

## Coverage Goals

- **Overall Target**: 75%

- **Critical Services**: 85%

- **Python Scripts**: 75%

## Resources

- [Testing Guide](../docs/testing-guide.md) - Complete testing documentation

- [Test Implementation Plan](../.copilot/session-state/*/plan.md) - Full roadmap

- [Jest Documentation](https://jestjs.io/)

- [pytest Documentation](https://docs.pytest.org/)
