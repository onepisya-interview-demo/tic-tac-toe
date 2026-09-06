import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['**/*.{test,spec}.{ts,tsx}'],
    // Exclude Stryker sandboxes + vitest tmp so mutation runs don't pollute
    // the normal test suite by re-discovering bundled dependency tests.
    exclude: [
      'node_modules',
      '.next',
      'dist',
      'build',
      '.stryker-tmp',
      '.vitest-tmp',
      'reports',
      'coverage',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      include: ['lib/**', 'db/**'],
      exclude: ['**/*.test.ts', '**/*.property.test.ts', '**/types.ts'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
        statements: 80,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
