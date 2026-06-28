import { loadConfig } from '../config.ts'
import { createPool } from './client.ts'
import { applyMigrations } from './migrate.ts'

/** CLI entrypoint: `npm run migrate` — applies all migrations to DATABASE_URL. */
const { DATABASE_URL } = loadConfig()
const pool = createPool(DATABASE_URL)
try {
  const applied = await applyMigrations((sql) => pool.query(sql))
  // eslint-disable-next-line no-console
  console.log(`Applied ${applied.length} migration(s): ${applied.join(', ') || '(none)'}`)
} finally {
  await pool.end()
}
