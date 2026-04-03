import js from '@eslint/js';
import globals from 'globals';
import jestPlugin from 'eslint-plugin-jest';

export default [
    // Recommended ESLint rules
    js.configs.recommended,

    // Global configuration for all files
    {
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
                ...globals.browser,
                ...globals.es2021,
                ...globals.webextensions,
                chrome: 'readonly',
            },
        },
        rules: {
            'no-unused-vars': [
                'error',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    caughtErrorsIgnorePattern: '^_',
                },
            ],
            'no-console': 'off', // Console is used for debugging in extensions
            'prefer-const': 'error',
            'no-var': 'error',
            eqeqeq: ['error', 'always'],
            curly: ['error', 'all'],
        },
    },

    // Configuration for test files and test setup
    {
        files: ['tests/**/*.test.js', 'tests/setup.js'],
        plugins: {
            jest: jestPlugin,
        },
        languageOptions: {
            globals: {
                ...globals.jest,
                ...globals.node,
            },
        },
        rules: {
            ...jestPlugin.configs.recommended.rules,
            'jest/expect-expect': 'warn',
            'jest/no-disabled-tests': 'warn',
        },
    },

    // Ignore patterns
    {
        ignores: ['node_modules/**', 'coverage/**', 'dist/**', 'build/**', '*.config.js'],
    },
];
