export default {
    testEnvironment: 'jest-environment-jsdom',
    transform: {},

    // Tell Jest where to find tests
    testMatch: ['**/tests/**/*.test.js'],

    // Module path mapping for imports
    moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1',
    },

    // Coverage configuration
    collectCoverageFrom: ['src/**/*.js', '!src/**/*.test.js', '!src/**/node_modules/**'],

    coverageDirectory: 'coverage',

    coverageReporters: ['text', 'lcov', 'html', 'json-summary'],

    // Coverage thresholds
    coverageThreshold: {
        global: {
            branches: 80,
            functions: 80,
            lines: 80,
            statements: 80,
        },
    },

    // Ignore patterns
    testPathIgnorePatterns: ['/node_modules/'],
};
