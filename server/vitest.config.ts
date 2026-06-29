/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'

// Server test runner. Coverage is gated at 85% on core logic (config, http,
// pure migration logic, protocol). Thin I/O shells that require a live socket
// or Postgres connection are excluded and covered by integration tests in later
// milestones instead.
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'text'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/index.ts', // http/ws bootstrap (needs a live port)
        'src/ws/attach.ts', // ws.WebSocket <-> http upgrade glue (integration-tested)
        'src/db/client.ts', // pg Pool factory (needs a live DB)
        'src/db/runMigrate.ts', // migration CLI (needs a live DB)
        'src/auth/supabaseJwt.ts', // wraps jose remote JWKS fetch (stubbed in tests)
        'src/db/types.ts', // type-only
        'src/**/*.d.ts',
      ],
      thresholds: { lines: 85, functions: 85, branches: 85, statements: 85 },
    },
  },
})
