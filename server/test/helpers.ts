import { PGlite } from '@electric-sql/pglite'
import { exportPKCS8, exportSPKI, generateKeyPair } from 'jose'
import { type AuthContext, DEFAULT_TTL } from '../src/auth/context.ts'
import { loadSigningKeys, type SigningKeys } from '../src/auth/keys.ts'
import { type SupabaseVerifier, SupabaseAuthError } from '../src/auth/supabaseJwt.ts'
import { applyMigrations } from '../src/db/migrate.ts'

/** A stable test user id (UUID, since user_id columns are typed UUID). */
export const TEST_USER = '11111111-1111-1111-1111-111111111111'

/** Generate an RS256 keypair and load it the way the server does (from PEM). */
export async function makeKeys(): Promise<SigningKeys> {
  const { publicKey, privateKey } = await generateKeyPair('RS256', { extractable: true })
  return loadSigningKeys(await exportPKCS8(privateKey), await exportSPKI(publicKey))
}

/** A controllable clock: read `value` (epoch seconds), advance with `tick`. */
export interface TestClock {
  value: number
  tick(seconds: number): void
}

export interface TestHarness {
  ctx: AuthContext
  db: PGlite
  clock: TestClock
  keys: SigningKeys
}

/**
 * Build a fully wired AuthContext backed by in-process Postgres (pglite) with
 * the real schema applied, a deterministic clock, and a stub Supabase verifier
 * that accepts the literal token `"valid"` (→ TEST_USER) and rejects others.
 */
export async function makeHarness(
  overrides: { verifySupabaseToken?: SupabaseVerifier } = {},
): Promise<TestHarness> {
  const db = new PGlite()
  await applyMigrations((sql) => db.exec(sql))
  const keys = await makeKeys()
  // Start near real time so signed JWTs validate against jose's real-clock exp
  // check; tests advance it relatively via tick().
  const clock: TestClock = {
    value: Math.floor(Date.now() / 1000),
    tick(seconds: number) {
      this.value += seconds
    },
  }
  const verifySupabaseToken: SupabaseVerifier =
    overrides.verifySupabaseToken ??
    (async (token: string) => {
      if (token === 'valid') return { sub: TEST_USER }
      throw new SupabaseAuthError()
    })

  const ctx: AuthContext = {
    db,
    keys,
    issuer: 'https://agents.test',
    verificationUri: 'https://app.test/device',
    verifySupabaseToken,
    now: () => clock.value,
    ttl: { ...DEFAULT_TTL },
  }
  return { ctx, db, clock, keys }
}
