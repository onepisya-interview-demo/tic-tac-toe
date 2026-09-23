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
      '.delta/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      include: ['lib/**', 'db/**', 'components/**'],
      // `**/*.md`：目录级 AGENTS.md 是 agent 规则文档、非可执行源码。coverage 的
      // uncovered-file 补扫按 include glob 无扩展名过滤地收集文件（BaseCoverageProvider
      // getUntestedFilesByRoot），.md 被喂给 vite8/rolldown parseAstAsync 即抛
      // PARSE_ERROR 并被静默剔除；在此按语义层排除（Markdown 不是覆盖率目标），
      // 而非靠 exclude 源码目录制造盲区。
      exclude: ['**/*.test.ts', '**/*.property.test.ts', '**/types.ts', '**/*.md'],
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
