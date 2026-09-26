import react from '@vitejs/plugin-react'
import { configDefaults, defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Relative asset paths so the build works from any GitHub Pages sub-path.
  base: './',
  test: {
    // Calculation tests run in Node; UI tests opt in to jsdom per file.
    environment: 'node',
    // Browser tests run with Playwright (npm run test:e2e).
    exclude: [...configDefaults.exclude, 'e2e/**'],
    setupFiles: ['./src/test/setup.ts'],
  },
})
