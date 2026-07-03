/**
 * Default Vitest config for the API package.
 *
 * Excludes the live `public-server` suite, which targets a running server
 * (localhost or production) and is run separately via `pnpm test:public`
 * using vitest.public.config.ts. Keeping it out of the default run lets the
 * unit/integration tests pass without a live server (e.g. in CI).
 */

import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      'src/__tests__/public-server/**',
    ],
  },
})
