/**
 * Jest config scoped to pure logic (intelligence/ and utils/).
 * These modules have no React Native runtime imports, so ts-jest can compile
 * them directly without the Expo/RN babel transform.
 */
/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: {
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
          isolatedModules: true,
          types: ['jest', 'node'],
        },
      },
    ],
  },
  clearMocks: true,
};
