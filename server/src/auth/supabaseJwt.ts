import { createRemoteJWKSet, jwtVerify } from 'jose'

/** Verifies a user's Supabase access token and returns its subject (user id). */
export type SupabaseVerifier = (token: string) => Promise<{ sub: string }>

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
    const { payload } = await jwtVerify(token, jwks, {
      issuer,
      audience: 'authenticated',
    })
    if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
      throw new Error('Supabase token is missing a subject (sub) claim')
    }
    return { sub: payload.sub }
  }
}
