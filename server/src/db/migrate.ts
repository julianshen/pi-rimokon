import { readdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Directory holding the ordered `*.sql` migration files. */
export const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'migrations')

export interface Migration {
  name: string
  sql: string
}

/** Anything that can run a SQL string — a pg Pool, a client, or a test stub. */
export type SqlExecutor = (sql: string) => Promise<unknown>

/** Load every `*.sql` migration in lexical (and therefore numeric) order. */
export async function loadMigrations(dir: string = MIGRATIONS_DIR): Promise<Migration[]> {
  const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort()
  return Promise.all(
    files.map(async (name) => ({ name, sql: await readFile(join(dir, name), 'utf8') })),
  )
}

/**
 * Apply all migrations in order via `exec`, returning the names applied.
 * Each file runs inside its own transaction so a multi-statement migration is
 * applied all-or-nothing. The executor is injected and MUST run every call on a
 * single connection (so BEGIN/COMMIT pair up) — drives both a checked-out
 * Postgres client (runMigrate.ts) and an in-process pglite instance (tests).
 *
 * Re-running is safe: the DDL is idempotent (`IF NOT EXISTS`). A persisted
 * applied-migrations ledger is a deliberate follow-up, not needed for v1.
 */
export async function applyMigrations(
  exec: SqlExecutor,
  dir: string = MIGRATIONS_DIR,
): Promise<string[]> {
  const migrations = await loadMigrations(dir)
  for (const migration of migrations) {
    await exec('BEGIN')
    try {
      await exec(migration.sql)
      await exec('COMMIT')
    } catch (err) {
      await exec('ROLLBACK')
      throw err
    }
  }
  return migrations.map((m) => m.name)
}
