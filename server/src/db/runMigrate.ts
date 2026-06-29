import 'dotenv/config'
import { loadConfig } from '../config.ts'
import { createPool } from './client.ts'
import { applyMigrations } from './migrate.ts'

/** CLI entrypoint: `npm run migrate` — applies all migrations to DATABASE_URL. */
const { DATABASE_URL } = loadConfig()
const pool = createPool(DATABASE_URL)
// Run every statement on one checked-out client so the per-file BEGIN/COMMIT
// in applyMigrations stays on a single connection.
const client = await pool.connect()
try {
  const applied = await applyMigrations((sql) => client.query(sql))
  // eslint-disable-next-line no-console
  console.log(`Applied ${applied.length} migration(s): ${applied.join(', ') || '(none)'}`)
} finally {
  client.release()
  await pool.end()
}
