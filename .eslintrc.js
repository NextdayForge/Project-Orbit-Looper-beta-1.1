/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  extends: ['expo'],
  ignorePatterns: ['node_modules/', 'vol.1/'],
  overrides: [
    {
      files: ['src/hooks/**/*.{ts,tsx}', 'src/components/**/*.{ts,tsx}', 'src/intelligence/**/*.{ts,tsx}'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: ['**/storage', '**/storage/*', '../storage', '../storage/*', '../../storage', '../../storage/*'],
                message:
                  'Hooks, components, and intelligence must use repositories from src/repositories, not the storage layer.',
              },
            ],
          },
        ],
      },
    },
  ],
};
