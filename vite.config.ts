import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: '/pat-escape/',
  server: {
    host: '0.0.0.0',
  },
  preview: {
    host: '0.0.0.0',
  },
  test: {
    include: ['tests/**/*.test.ts'],
    testTimeout: 120_000,
  },
});
