import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    // Integration files share one real database (and push its schema on
    // first use), so they run one file at a time.
    fileParallelism: false,
    include: ['tests/int/**/*.int.spec.ts', 'tests/unit/**/*.unit.spec.ts'],
  },
})
