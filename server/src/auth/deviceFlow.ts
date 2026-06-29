import { randomInt } from 'node:crypto'
import type { AuthContext } from './context.ts'
import { agentTokens, deviceCodes, refreshTokens } from '../db/repositories.ts'
import { hashToken, newId, randomToken, signAgentToken } from './tokens.ts'

// --- helpers ---------------------------------------------------------------

/** Crockford-ish base32, ambiguous chars (I/L/O/U/0/1) removed. */
const USER_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTVWXYZ23456789'

/** Generate a human-typeable user code, e.g. `WDJB-MJHT` (spec §3.1). */
export function generateUserCode(): string {
  const pick = () =>
    Array.from({ length: 4 }, () => USER_CODE_ALPHABET[randomInt(USER_CODE_ALPHABET.length)]).join('')
  return `${pick()}-${pick()}`
}

function secondsToDate(epochSeconds: number): Date {
  return new Date(epochSeconds * 1000)
}

/** OAuth-style error that maps to a 400 with `{ error }` (spec §3.1 table). */
export class OAuthError extends Error {
  constructor(
    public readonly error: string,
    public readonly httpStatus = 400,
  ) {
    super(error)
    this.name = 'OAuthError'
  }
}

export interface TokenBundle {
  access_token: string
  token_type: 'Bearer'
  expires_in: number
  refresh_token: string
  scope: string
}

/**
 * Mint a fresh access+refresh pair under `familyId` (a new family when issuing
 * for the first time, the existing family on refresh). Persists the agent-token
 * record and the rotating refresh-token row.
 */
async function issueTokenBundle(
  ctx: AuthContext,
  args: { userId: string; scope: string; familyId: string },
): Promise<TokenBundle> {
  const now = ctx.now()
  const jti = newId('jti')
  await agentTokens.insert(ctx.db, {
    jti,
    familyId: args.familyId,
    userId: args.userId,
    scopes: args.scope ? args.scope.split(' ') : [],
  })

  const accessToken = await signAgentToken(
    ctx.keys,
    { sub: args.userId, jti, familyId: args.familyId, scope: args.scope },
    { issuer: ctx.issuer, now, expiresInSec: ctx.ttl.accessSec },
  )

  const refresh = randomToken()
  await refreshTokens.insert(ctx.db, {
    tokenHash: hashToken(refresh),
    familyId: args.familyId,
    jti,
    userId: args.userId,
    expiresAt: secondsToDate(now + ctx.ttl.refreshSec),
  })

  return {
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: ctx.ttl.accessSec,
    refresh_token: refresh,
    scope: args.scope,
  }
}

// --- device authorization grant (RFC 8628 / spec §3) -----------------------

export interface DeviceCodeResponse {
  device_code: string
  user_code: string
  verification_uri: string
  verification_uri_complete: string
  expires_in: number
  interval: number
}

/** `POST /oauth/device/code` — start authorization (spec §3.1). */
export async function issueDeviceCode(
  ctx: AuthContext,
  args: { clientId: string; scope: string },
): Promise<DeviceCodeResponse> {
  if (!args.clientId) throw new OAuthError('invalid_request')
  const now = ctx.now()
  const deviceCode = randomToken()
  const userCode = generateUserCode()

  await deviceCodes.insert(ctx.db, {
    deviceCodeHash: hashToken(deviceCode),
    userCode,
    clientId: args.clientId,
    expiresAt: secondsToDate(now + ctx.ttl.deviceCodeSec),
    pollInterval: ctx.ttl.pollIntervalSec,
  })

  const complete = `${ctx.verificationUri}?code=${encodeURIComponent(userCode)}`
  return {
    device_code: deviceCode,
    user_code: userCode,
    verification_uri: ctx.verificationUri,
    verification_uri_complete: complete,
    expires_in: ctx.ttl.deviceCodeSec,
    interval: ctx.ttl.pollIntervalSec,
  }
}

/**
 * `POST /oauth/device/approve` — the signed-in user approves or denies a code
 * (spec §3.1). Verifies the Supabase JWT and binds `user_id = sub`.
 */
export async function approveDevice(
  ctx: AuthContext,
  args: { supabaseToken: string; userCode: string; decision: 'approve' | 'deny' },
): Promise<{ status: 'approved' | 'denied' }> {
  const { sub } = await ctx.verifySupabaseToken(args.supabaseToken)

  const row = await deviceCodes.findByUserCode(ctx.db, args.userCode)
  if (!row || row.status === 'consumed') throw new OAuthError('invalid_request', 404)
  if (ctx.now() * 1000 >= new Date(row.expires_at).getTime()) throw new OAuthError('expired_token', 410)

  const status = args.decision === 'deny' ? 'denied' : 'approved'
  // Atomic compare-and-set: only the first decision on a pending code wins.
  const claimed = await deviceCodes.decide(ctx.db, args.userCode, status, status === 'approved' ? sub : null)
  if (!claimed) throw new OAuthError('invalid_request', 409)
  return { status }
}

/** `POST /oauth/device/token` — dispatch by `grant_type` (spec §3.1). */
export async function tokenGrant(
  ctx: AuthContext,
  args: { grantType: string; clientId?: string; deviceCode?: string; refreshToken?: string },
): Promise<TokenBundle> {
  if (args.grantType === 'urn:ietf:params:oauth:grant-type:device_code') {
    return pollDeviceToken(ctx, args.clientId, args.deviceCode)
  }
  if (args.grantType === 'refresh_token') {
    return refreshGrant(ctx, args.refreshToken)
  }
  throw new OAuthError('unsupported_grant_type')
}

async function pollDeviceToken(
  ctx: AuthContext,
  clientId?: string,
  deviceCode?: string,
): Promise<TokenBundle> {
  if (!clientId || !deviceCode) throw new OAuthError('invalid_request')
  const hash = hashToken(deviceCode)
  const row = await deviceCodes.findByHash(ctx.db, hash)
  if (!row) throw new OAuthError('invalid_grant')
  // A device code may only be redeemed by the client it was issued to.
  if (row.client_id !== clientId) throw new OAuthError('invalid_grant')

  const now = ctx.now()
  if (now * 1000 >= new Date(row.expires_at).getTime()) throw new OAuthError('expired_token')

  // Poll-rate limiting (spec §3.1 slow_down / §7).
  if (row.last_polled_at && now * 1000 - new Date(row.last_polled_at).getTime() < row.poll_interval * 1000) {
    throw new OAuthError('slow_down')
  }
  await deviceCodes.touchPolled(ctx.db, hash, secondsToDate(now))

  switch (row.status) {
    case 'pending':
      throw new OAuthError('authorization_pending')
    case 'denied':
      throw new OAuthError('access_denied')
    case 'consumed':
      throw new OAuthError('invalid_grant')
    case 'approved': {
      // Atomically claim the approved code; a concurrent poll that loses the
      // race gets no row and is rejected rather than minting a second bundle.
      const claimed = await deviceCodes.claimApproved(ctx.db, hash)
      if (!claimed) throw new OAuthError('invalid_grant')
      return issueTokenBundle(ctx, {
        userId: claimed.userId,
        scope: 'agent',
        familyId: newId('fam'),
      })
    }
  }
}

/** Revoke an entire token family (refresh tokens + agent tokens) at once. */
async function revokeFamily(ctx: AuthContext, familyId: string, at: Date): Promise<void> {
  await Promise.all([
    refreshTokens.revokeFamily(ctx.db, familyId, at),
    agentTokens.revokeFamily(ctx.db, familyId, at),
  ])
  // Tear down any live sockets bound to this family (spec §3.2 → 4403).
  ctx.onFamilyRevoked?.(familyId)
}

async function refreshGrant(ctx: AuthContext, refreshToken?: string): Promise<TokenBundle> {
  if (!refreshToken) throw new OAuthError('invalid_request')
  const now = ctx.now()
  const row = await refreshTokens.findByHash(ctx.db, hashToken(refreshToken))
  if (!row || row.revoked_at) throw new OAuthError('invalid_grant')

  // Reuse detection: a token already rotated/used → revoke the whole family.
  if (row.used_at || row.replaced_by) {
    await revokeFamily(ctx, row.family_id, secondsToDate(now))
    throw new OAuthError('invalid_grant')
  }
  if (now * 1000 >= new Date(row.expires_at).getTime()) throw new OAuthError('invalid_grant')

  // Atomically claim the token before minting its successor. If a concurrent
  // request already claimed it, treat the replay as reuse and revoke the family.
  const claimed = await refreshTokens.claim(ctx.db, row.token_hash, secondsToDate(now))
  if (!claimed) {
    await revokeFamily(ctx, row.family_id, secondsToDate(now))
    throw new OAuthError('invalid_grant')
  }

  const bundle = await issueTokenBundle(ctx, {
    userId: claimed.user_id,
    scope: 'agent',
    familyId: claimed.family_id,
  })
  await refreshTokens.setReplacedBy(ctx.db, row.token_hash, hashToken(bundle.refresh_token))
  return bundle
}

/**
 * `POST /oauth/revoke` (RFC 7009) — revoke a refresh token's family. Always
 * resolves; an unknown token is a no-op per the RFC.
 */
export async function revokeToken(ctx: AuthContext, token?: string): Promise<void> {
  if (!token) return
  const row = await refreshTokens.findByHash(ctx.db, hashToken(token))
  if (!row) return
  await revokeFamily(ctx, row.family_id, secondsToDate(ctx.now()))
}
