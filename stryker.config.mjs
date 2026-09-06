// @ts-check
/**
 * Stryker scoped to lib/ + db/ (per brief: "Stryker scoped to lib/").
 *
 * Run with:  pnpm test:mutation
 */
const config = {
  // Explicitly load the vitest test-runner plugin (Stryker 10 needs this hint).
  plugins: ['@stryker-mutator/vitest-runner'],
  testRunner: 'vitest',
  packageManager: 'pnpm',
  reporters: ['progress', 'clear-text', 'html', 'json'],
  clearTextReporter: {
    allowEmojis: false,
    reportFiles: false,
  },
  // Mutations only on pure game logic + DB layer (not React components).
  mutate: ['lib/game.ts', 'lib/db.ts', 'lib/store.ts', 'db/schema.ts'],
  vitest: {
    configFile: 'vitest.config.ts',
  },
  // Run the full test suite per mutant (disable coverage-based selection).
  coverageAnalysis: 'off',
  // Keep things moving; vitest runner is heavier than mocha.
  timeoutMS: 120000,
  timeoutFactor: 1.5,
  ignoredMutations: ['StringLiteral'],
  thresholds: {
    high: 80,
    low: 60,
    break: null, // don't fail CI on low score; informational
  },
};

export default config;
