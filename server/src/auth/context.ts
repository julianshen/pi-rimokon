import type { Db } from '../db/types.ts'
import type { SigningKeys } from './keys.ts'
import type { SupabaseVerifier } from './supabaseJwt.ts'

/** Token lifetimes + device-flow timings, in seconds. */
export interface AuthTtl {
  deviceCodeSec: number
  pollIntervalSec: number
  accessSec: number
  refreshSec: number
}

export const DEFAULT_TTL: AuthTtl = {
  deviceCodeSec: 900, // 15 min (spec §3.1 expires_in)
  pollIntervalSec: 5, // spec §3.1 interval
  accessSec: 3600, // ~1h (spec §3.2)
  refreshSec: 60 * 60 * 24 * 30, // 30 days
}

/**
 * Everything the auth/device-flow service needs, injected so it is fully
 * testable (in-process db, deterministic clock, stubbed Supabase verifier).
 */
export interface AuthContext {
  db: Db
  keys: SigningKeys
  /** `iss` for issued agent JWTs. */
  issuer: string
  /** Public `verification_uri` shown to the user (the SPA /device page). */
  verificationUri: string
  verifySupabaseToken: SupabaseVerifier
  /** Current time in epoch seconds; injectable for deterministic tests. */
  now: () => number
  ttl: AuthTtl
}
