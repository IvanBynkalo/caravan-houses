import { defineConfig } from 'vitest/config';
import { resolve }      from 'path';

export default defineConfig({
  test: {
    globals:     true,
    environment: 'node',
    include:     ['src/__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include:  ['src/engine/**'],
    },
  },
  resolve: {
    alias: {
      '@caravan/shared': resolve(__dirname, '../../shared/src/index.ts'),
    },
  },
});
