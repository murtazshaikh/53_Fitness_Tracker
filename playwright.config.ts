import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  // These specs share one dev server and one database; running them in parallel
  // would have them tripping over each other's active workout.
  workers: 1,
  use: { baseURL: 'http://localhost:3000' },
  webServer: {
    command: 'bun run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
