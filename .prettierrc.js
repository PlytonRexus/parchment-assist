export default {
    // Formatting options
    semi: true,
    trailingComma: 'es5',
    singleQuote: true,
    printWidth: 100,
    tabWidth: 4,
    useTabs: false,
    arrowParens: 'always',
    bracketSpacing: true,
    endOfLine: 'lf',

    // File-specific overrides
    overrides: [
        {
            files: '*.json',
            options: {
                tabWidth: 2,
            },
        },
        {
            files: ['*.html', '*.css', '*.md'],
            options: {
                tabWidth: 2,
            },
        },
    ],
};
