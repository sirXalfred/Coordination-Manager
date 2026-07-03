import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    // Test files use `any` for mocks, stubs, and partial fixtures where full
    // typing adds noise without catching real bugs. Unused-var checks stay on.
    files: ['**/__tests__/**/*.ts', '**/*.test.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    // `_*.cjs` are temporary, ad-hoc data-query scripts run by hand, not part
    // of the shipped server. They use CommonJS/Node globals and are excluded.
    ignores: ['dist/', '_*.cjs'],
  },
);
