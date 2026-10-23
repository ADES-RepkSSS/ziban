import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'packages/**/*.test.ts',
      'apps/web/src/**/*.test.ts',
      'apps/desktop/electron/**/*.test.ts',
    ],
    environment: 'node',
    reporters: ['default'],
  },
});
