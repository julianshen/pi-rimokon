import { z } from 'zod'

/**
 * Server environment schema (spec §8 "New env" / implementation plan
 * "Config: one env schema, fail-fast"). Mirrors the SPA's `ConfigNotice`
 * pattern: validate everything up front and refuse to boot on a bad value.
 */
export const ConfigSchema = z.object({
  /** HTTP/WS listen port. */
  PORT: z.coerce.number().int().positive().max(65535).default(8787),
  /** Supabase Postgres connection string (service-role). */
  DATABASE_URL: z.string().url(),
  /** Allowed browser origin for /client + ticket endpoints (added in M3). */
  ALLOWED_ORIGIN: z.string().url().optional(),
})

export type Config = z.infer<typeof ConfigSchema>

/** Thrown when the environment fails validation; message lists every issue. */
export class ConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConfigError'
  }
}

/**
 * Parse + validate config, failing fast with an actionable message. Pass an
 * explicit `env` in tests; defaults to `process.env`.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = ConfigSchema.safeParse(env)
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n')
    throw new ConfigError(`Invalid server configuration:\n${issues}`)
  }
  return parsed.data
}
