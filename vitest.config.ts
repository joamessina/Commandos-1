import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    allowOnly: false,
    coverage: {
      provider: 'v8',
      include: ['src/formats/**', 'src/engine/**'],
      exclude: ['**/*.test.ts', 'src/testing/**'],
      // CONSTRAINTS.from-c2.md: >= 90 % en lógica pura (bytes -> datos). src/render y src/app quedan fuera.
      thresholds: { lines: 90, branches: 90, functions: 90, statements: 90 },
    },
  },
});
