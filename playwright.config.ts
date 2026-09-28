import { defineConfig, devices } from '@playwright/test'
import 'dotenv/config'

/**
 * End-to-end tests against a real dev server and a real database.
 *
 * The server is started on its own port against TEST_DATABASE_URL (falls
 * back to DATABASE_URL), so e2e data never lands in the dev database.
 * NODE_OPTIONS is set explicitly: the test:e2e script's own
 * --import=tsx/esm must not leak into the spawned `pnpm dev`.
 */
const PORT = 3100
const BASE_URL = `http://localhost:${PORT}`
const DATABASE_URL = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.e2e.spec.ts',
  globalSetup: './tests/e2e/global-setup.ts',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? 'list' : 'html',
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], channel: 'chromium' },
    },
  ],
  webServer: {
    command: `pnpm dev --port ${PORT}`,
    url: `${BASE_URL}/api/health`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      NODE_OPTIONS: '--no-deprecation',
      DATABASE_URL: DATABASE_URL ?? '',
      SITE_URL: BASE_URL,
    },
  },
})
