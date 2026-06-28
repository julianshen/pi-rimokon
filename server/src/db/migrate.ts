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
 * The executor is injected so the same logic drives a real Postgres pool
 * (runMigrate.ts) and an in-process pglite instance (tests).
 */
export async function applyMigrations(
  exec: SqlExecutor,
  dir: string = MIGRATIONS_DIR,
): Promise<string[]> {
  const migrations = await loadMigrations(dir)
  for (const migration of migrations) {
    await exec(migration.sql)
  }
  return migrations.map((m) => m.name)
}
