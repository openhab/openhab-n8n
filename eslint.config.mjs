import pluginTs from '@typescript-eslint/eslint-plugin';
import parserTs from '@typescript-eslint/parser';

export default [
  {
    ignores: ['dist', 'node_modules', 'test_coverage']
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: parserTs,
      parserOptions: {
        project: './tsconfig.eslint.json',
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': pluginTs,
    },
    rules: {
      ...pluginTs.configs.recommended.rules
    },
  },
];
