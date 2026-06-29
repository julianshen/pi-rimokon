/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Test runner config. Coverage is gated at 90% across src/ (per the project's
// dark-mode TDD requirement); only true non-logic files are excluded.
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    // The standalone server has its own runner (server/vitest.config.ts);
    // keep it out of the SPA suite.
    exclude: ['**/node_modules/**', '**/dist/**', 'server/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'text'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/main.tsx', // app bootstrap
        'src/vite-env.d.ts',
        'src/**/*.d.ts',
        'src/lib/types.ts', // type-only
        'src/services/PiService.ts', // interface-only
        'src/test/**',
        'src/**/*.test.{ts,tsx}',
      ],
      thresholds: { lines: 90, functions: 90, branches: 90, statements: 90 },
    },
  },
})
