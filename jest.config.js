/**
 * Jest Configuration
 * Testing framework for Moltbot services
 */

module.exports = {
  // Test environment
  testEnvironment: 'node',

  // Coverage directory
  coverageDirectory: 'coverage',

  // Files to collect coverage from
  collectCoverageFrom: [
    'services/**/src/**/*.js',
    '!services/**/node_modules/**',
    '!services/**/dist/**',
    '!services/**/coverage/**',
  ],

  // Test file patterns
  testMatch: [
    '**/tests/**/*.test.js',
    '**/__tests__/**/*.test.js',
  ],

  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/workspace/',
    '/memory/',
    '/state/',
    '/logs/',
  ],

  // Module path ignore patterns
  modulePathIgnorePatterns: [
    '/workspace/',
    '/memory/',
    '/state/',
    '/logs/',
  ],

  // Coverage thresholds (relaxed during initial test development)
  coverageThreshold: {
    global: {
      statements: 10,
      branches: 5,
      functions: 10,
      lines: 10,
    },
  },

  // Coverage reporters
  coverageReporters: ['text', 'lcov', 'json', 'html'],

  // Module paths
  modulePaths: ['<rootDir>'],

  // Setup files
  // setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],

  // Test timeout (increased for circuit breaker 30-second tests)
  testTimeout: 35000,

  // Verbose output
  verbose: true,

  // Clear mocks between tests
  clearMocks: true,

  // Restore mocks between tests
  restoreMocks: true,

  // Reset mocks between tests
  resetMocks: true,
};
