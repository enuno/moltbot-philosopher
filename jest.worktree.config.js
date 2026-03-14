module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js', '**/__tests__/**/*.test.js'],
  testPathIgnorePatterns: ['/node_modules/'],
  collectCoverageFrom: ['services/**/src/**/*.js'],
  coverageDirectory: 'coverage',
  testTimeout: 35000,
  verbose: true,
  clearMocks: true,
};
