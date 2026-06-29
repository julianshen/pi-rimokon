/**
 * Minimal query interface satisfied by both a `pg` Pool/Client and an
 * in-process pglite instance, so repository logic is exercised against real SQL
 * in tests without a live database.
 */
export interface Db {
  query<R = Record<string, unknown>>(text: string, params?: unknown[]): Promise<{ rows: R[] }>
}
