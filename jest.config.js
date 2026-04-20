module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/*.test.ts'],

  // Automatically clear mock calls, instances, contexts and results before every test
  clearMocks: true,

  // Indicates whether the coverage information should be collected while executing the test
  collectCoverage: true,

  // An array of glob patterns indicating a set of files for which coverage information should be collected
  collectCoverageFrom: ['util/**/*.ts'],

  // The directory where Jest should output its coverage files
  coverageDirectory: 'test_coverage',

  // An array of regexp pattern strings used to skip coverage collection
  // coveragePathIgnorePatterns: [
  //   "/node_modules/"
  // ],

  // Indicates which provider should be used to instrument code for coverage
  coverageProvider: 'v8',
};
