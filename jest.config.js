module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: ['src/**/*.(t|j)s', '!src/**/*.spec.ts'],
  coverageDirectory: './coverage',
  testEnvironment: '<rootDir>/jest-custom-environment.js',
  testEnvironmentOptions: {
    customExportConditions: ['node', 'node-addons'],
  },
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/src/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
};
