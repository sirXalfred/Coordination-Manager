/**
 * Vitest config specifically for running tests against the public server.
 *
 * Usage:  pnpm test:public
 *         (or: vitest --run --config vitest.public.config.ts)
 */

import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/__tests__/public-server/**/*.test.ts'],
    testTimeout: 20_000,
    hookTimeout: 20_000,
    env: {
      TEST_SERVER_URL: 'https://api.coordinationmanager.com',
      TEST_TIMEOUT: '15000',
    },
  },
})
