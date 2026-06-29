import { createRemoteJWKSet, jwtVerify } from 'jose'

/** Verifies a user's Supabase access token and returns its subject (user id). */
export type SupabaseVerifier = (token: string) => Promise<{ sub: string }>

/**
 * A Supabase JWT/JWKS verification failure. Distinct type so callers can map
 * only genuine auth failures to 401 (and not, say, a database error that
 * happens later in the same request).
 */
export class SupabaseAuthError extends Error {
  constructor(message = 'invalid Supabase token') {
    super(message)
    this.name = 'SupabaseAuthError'
  }
}

/**
 * Build a verifier that checks a Supabase JWT against the project JWKS
 * (spec §3.1: issuer/audience/exp). Supabase asymmetric (RS256/ES256) tokens
 * are issued by `${SUPABASE_URL}/auth/v1` with audience `authenticated` and the
 * JWKS published at `${SUPABASE_URL}/auth/v1/.well-known/jwks.json`.
 */
export function createSupabaseVerifier(supabaseUrl: string): SupabaseVerifier {
  const issuer = `${supabaseUrl.replace(/\/$/, '')}/auth/v1`
  const jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`))
  return async (token: string) => {
    try {
      const { payload } = await jwtVerify(token, jwks, { issuer, audience: 'authenticated' })
      if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
        throw new SupabaseAuthError('Supabase token is missing a subject (sub) claim')
      }
      return { sub: payload.sub }
    } catch (err) {
      if (err instanceof SupabaseAuthError) throw err
      throw new SupabaseAuthError()
    }
  }
}
