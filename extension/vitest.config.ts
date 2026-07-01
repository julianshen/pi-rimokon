/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'

// The Pi-agnostic core (auth + connection + protocol) is unit-tested here.
// index.ts (the thin Pi adapter) is excluded — it can only run inside a real
// Pi session, and is kept intentionally thin.
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'text'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts'],
      thresholds: { lines: 85, functions: 85, branches: 85, statements: 85 },
    },
  },
})
