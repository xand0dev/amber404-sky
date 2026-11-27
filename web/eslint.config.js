import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist', 'node_modules'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: { ...reactHooks.configs.recommended.rules },
  },
  { files: ['scripts/**/*.mjs'], languageOptions: { globals: globals.node } },
  // web/src/core — чистий TS без DOM (SPEC §7.11)
  {
    files: ['src/core/**/*.ts'],
    languageOptions: { globals: {} },
    rules: { 'no-restricted-globals': ['error', 'window', 'document', 'localStorage', 'navigator'] },
  },
);
