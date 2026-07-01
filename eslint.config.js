const expoConfig = require('eslint-config-expo/flat');
const { defineConfig } = require('eslint/config');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['node_modules/**', '**/vol.1/**'],
  },
  {
    files: ['src/hooks/**/*.{ts,tsx}', 'src/components/**/*.{ts,tsx}', 'src/intelligence/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '**/storage',
                '**/storage/*',
                '../storage',
                '../storage/*',
                '../../storage',
                '../../storage/*',
              ],
              message:
                'Hooks, components, and intelligence must use repositories from src/repositories, not the storage layer.',
            },
          ],
        },
      ],
    },
  },
]);
