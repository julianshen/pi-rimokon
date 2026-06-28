import { Pool } from 'pg'

/** Create a Postgres connection pool against the Supabase service-role URL. */
export function createPool(connectionString: string): Pool {
  return new Pool({ connectionString })
}
