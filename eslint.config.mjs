import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default [
    {
        ignores: [
            'dist/**',
            'src/build/**',
            'node_modules/**',
            'po/**',
            'schemas/**',
            'media/**',
            'test-data/**',
            '*.zip',
        ],
    },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        files: ['**/*.ts', '**/*.mjs', '**/*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
        },
        rules: {
            // GJS bindings are untyped on purpose; `any` is used at that boundary.
            '@typescript-eslint/no-explicit-any': 'off',
            // Allow `== null`, which intentionally matches both null and undefined.
            eqeqeq: ['error', 'smart'],
            // Require braces around every block, even single statements.
            curly: ['error', 'all'],
            'no-var': 'error',
            'prefer-const': 'error',
            // Underscore prefix marks intentionally unused bindings (GJS signal
            // handlers, destructuring placeholders, ignored errors).
            '@typescript-eslint/no-unused-vars': [
                'error',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    caughtErrorsIgnorePattern: '^_',
                    ignoreRestSiblings: true,
                },
            ],
            // The empty interface below merges with a `GObject.registerClass`
            // value of the same name, so it is not redundant.
            '@typescript-eslint/no-empty-object-type': [
                'error',
                { allowInterfaces: 'with-single-extends' },
            ],
        },
    },
    // Keep last: disables formatting rules that would fight Prettier.
    prettier,
];
