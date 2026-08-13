import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Vite resolves the "@/*" alias from tsconfig.json natively.
    tsconfigPaths: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['**/*.test.ts', '**/*.test.tsx'],
    exclude: ['node_modules', '.next', 'e2e', 'generated'],
    // Integration suites share one test database and each clears tables in
    // beforeEach. Run files one at a time so they cannot delete each other's
    // fixtures mid-test.
    fileParallelism: false,
  },
})
