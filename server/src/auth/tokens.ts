import { createHash, randomBytes } from 'node:crypto'
import { type JWTPayload, SignJWT, jwtVerify } from 'jose'
import { SIGNING_ALG, type SigningKeys } from './keys.ts'

/** `aud` claim on agent access tokens (spec §3.2 / §4.1). */
export const AGENT_AUDIENCE = 'pi-agent'

/** Generate a prefixed, high-entropy opaque id (jti, family id, etc.). */
export function newId(prefix: string): string {
  return `${prefix}_${randomBytes(16).toString('hex')}`
}

/** A high-entropy opaque token (device code, refresh token, ticket). */
export function randomToken(): string {
  return randomBytes(32).toString('base64url')
}

/** Hash an opaque secret for at-rest storage (spec §7 "stored hashed"). */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export interface AgentTokenClaims {
  sub: string
  jti: string
  familyId: string
  scope: string
}

export interface SignOptions {
  issuer: string
  /** seconds since epoch; injectable for deterministic tests */
  now: number
  expiresInSec?: number
}

/** Sign a short-lived RS256 agent access token (spec §3.2). */
export async function signAgentToken(
  keys: SigningKeys,
  claims: AgentTokenClaims,
  opts: SignOptions,
): Promise<string> {
  const expiresInSec = opts.expiresInSec ?? 3600
  return new SignJWT({ scope: claims.scope, family_id: claims.familyId })
    .setProtectedHeader({ alg: SIGNING_ALG, kid: keys.kid })
    .setSubject(claims.sub)
    .setIssuer(opts.issuer)
    .setAudience(AGENT_AUDIENCE)
    .setJti(claims.jti)
    .setIssuedAt(opts.now)
    .setExpirationTime(opts.now + expiresInSec)
    .sign(keys.privateKey)
}

/**
 * Verify an agent access token's signature, `aud`, `iss`, and `exp`
 * (spec §4.1). Revocation (`jti`/family lookup) is checked separately against
 * the store. Throws on any failure.
 */
export async function verifyAgentToken(
  keys: SigningKeys,
  token: string,
  opts: { issuer: string },
): Promise<JWTPayload> {
  const { payload } = await jwtVerify(token, keys.publicKey, {
    algorithms: [SIGNING_ALG],
    audience: AGENT_AUDIENCE,
    issuer: opts.issuer,
  })
  return payload
}
