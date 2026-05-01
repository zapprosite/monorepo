// Anti-hardcoded: all config via process.env
import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: [
      {
        // Map @repo/zod-schemas/X → packages/zod-schemas/src/X (no dist required)
        find: /^@repo\/zod-schemas\/(.+)$/,
        replacement: resolve(__dirname, '../../packages/zod-schemas/src/$1'),
      },
    ],
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.test.ts', 'src/**/*.test.ts', 'src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      exclude: ['dist/**', 'node_modules/**', 'test/**'],
      thresholds: {
        lines: 70,
      },
    },
  },
});
