import { describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { applyMigrations, loadMigrations } from '../src/db/migrate.ts'

const EXPECTED_TABLES = ['agent_sessions', 'agent_tokens', 'device_codes', 'refresh_tokens']

describe('migrations', () => {
  it('loads the SQL files in lexical order', async () => {
    const migrations = await loadMigrations()
    expect(migrations.length).toBeGreaterThanOrEqual(1)
    expect(migrations[0].name).toBe('0001_init.sql')
    const names = migrations.map((m) => m.name)
    expect([...names].sort()).toEqual(names)
  })

  it('applies cleanly against Postgres and creates the four spec §6 tables', async () => {
    const db = new PGlite()
    try {
      const applied = await applyMigrations((sql) => db.exec(sql))
      expect(applied).toContain('0001_init.sql')

      const { rows } = await db.query<{ table_name: string }>(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = 'public' ORDER BY table_name`,
      )
      const tables = rows.map((r) => r.table_name)
      for (const table of EXPECTED_TABLES) {
        expect(tables).toContain(table)
      }
    } finally {
      await db.close()
    }
  })

  it('is idempotent (re-applying does not throw)', async () => {
    const db = new PGlite()
    try {
      await applyMigrations((sql) => db.exec(sql))
      await expect(applyMigrations((sql) => db.exec(sql))).resolves.toBeDefined()
    } finally {
      await db.close()
    }
  })

  it('wraps each migration in a transaction and rolls back on failure', async () => {
    const calls: string[] = []
    const exec = (sql: string) => {
      calls.push(sql)
      // Fail on the migration body (anything that is not a txn control word).
      if (sql !== 'BEGIN' && sql !== 'COMMIT' && sql !== 'ROLLBACK') {
        return Promise.reject(new Error('boom'))
      }
      return Promise.resolve()
    }
    await expect(applyMigrations(exec)).rejects.toThrow('boom')
    expect(calls[0]).toBe('BEGIN')
    expect(calls.at(-1)).toBe('ROLLBACK')
    expect(calls).not.toContain('COMMIT')
  })
})
