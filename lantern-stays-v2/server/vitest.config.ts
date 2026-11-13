import { defineConfig } from 'vitest/config';

// API tests run one file at a time against a separate "<DB_NAME>_test" database.
export default defineConfig({
  test: {
    root: import.meta.dirname,
    include: ['test/**/*.test.ts'],
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 60_000,
    env: { NODE_ENV: 'test' },
  },
});
