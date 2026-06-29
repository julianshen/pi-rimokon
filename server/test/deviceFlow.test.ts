import { describe, expect, it } from 'vitest'
import {
  approveDevice,
  generateUserCode,
  issueDeviceCode,
  OAuthError,
  revokeToken,
  tokenGrant,
} from '../src/auth/deviceFlow.ts'
import { verifyAgentToken } from '../src/auth/tokens.ts'
import { agentTokens } from '../src/db/repositories.ts'
import { makeHarness, TEST_USER } from './helpers.ts'

const DEVICE_GRANT = 'urn:ietf:params:oauth:grant-type:device_code'

/** Run the issue → approve → first-poll happy path; returns the token bundle. */
async function authorize(h: Awaited<ReturnType<typeof makeHarness>>) {
  const code = await issueDeviceCode(h.ctx, { clientId: 'cli', scope: 'agent' })
  await approveDevice(h.ctx, { supabaseToken: 'valid', userCode: code.user_code, decision: 'approve' })
  const bundle = await tokenGrant(h.ctx, {
    grantType: DEVICE_GRANT,
    clientId: 'cli',
    deviceCode: code.device_code,
  })
  return { code, bundle }
}

describe('generateUserCode', () => {
  it('produces a XXXX-XXXX code from the unambiguous alphabet', () => {
    expect(generateUserCode()).toMatch(/^[ABCDEFGHJKMNPQRSTVWXYZ23456789]{4}-[ABCDEFGHJKMNPQRSTVWXYZ23456789]{4}$/)
  })
})

describe('device authorization grant', () => {
  it('completes the happy path and binds the Supabase user', async () => {
    const h = await makeHarness()
    const { bundle } = await authorize(h)

    expect(bundle.token_type).toBe('Bearer')
    expect(bundle.scope).toBe('agent')
    expect(bundle.refresh_token).toBeTruthy()
    const payload = await verifyAgentToken(h.ctx.keys, bundle.access_token, { issuer: h.ctx.issuer })
    expect(payload.sub).toBe(TEST_USER)
  })

  it('consumes the device code (second poll is rejected)', async () => {
    const h = await makeHarness()
    const { code } = await authorize(h)
    h.clock.tick(h.ctx.ttl.pollIntervalSec + 1) // past the poll interval, so not slow_down
    await expect(
      tokenGrant(h.ctx, { grantType: DEVICE_GRANT, clientId: 'cli', deviceCode: code.device_code }),
    ).rejects.toMatchObject({ error: 'invalid_grant' })
  })

  it('returns authorization_pending before approval', async () => {
    const h = await makeHarness()
    const code = await issueDeviceCode(h.ctx, { clientId: 'cli', scope: 'agent' })
    await expect(
      tokenGrant(h.ctx, { grantType: DEVICE_GRANT, clientId: 'cli', deviceCode: code.device_code }),
    ).rejects.toMatchObject({ error: 'authorization_pending' })
  })

  it('returns slow_down when polled faster than the interval', async () => {
    const h = await makeHarness()
    const code = await issueDeviceCode(h.ctx, { clientId: 'cli', scope: 'agent' })
    await expect(
      tokenGrant(h.ctx, { grantType: DEVICE_GRANT, clientId: 'cli', deviceCode: code.device_code }),
    ).rejects.toMatchObject({ error: 'authorization_pending' })
    await expect(
      tokenGrant(h.ctx, { grantType: DEVICE_GRANT, clientId: 'cli', deviceCode: code.device_code }),
    ).rejects.toMatchObject({ error: 'slow_down' })
  })

  it('returns access_denied when the user denies', async () => {
    const h = await makeHarness()
    const code = await issueDeviceCode(h.ctx, { clientId: 'cli', scope: 'agent' })
    await approveDevice(h.ctx, { supabaseToken: 'valid', userCode: code.user_code, decision: 'deny' })
    await expect(
      tokenGrant(h.ctx, { grantType: DEVICE_GRANT, clientId: 'cli', deviceCode: code.device_code }),
    ).rejects.toMatchObject({ error: 'access_denied' })
  })

  it('returns expired_token after the code lifetime', async () => {
    const h = await makeHarness()
    const code = await issueDeviceCode(h.ctx, { clientId: 'cli', scope: 'agent' })
    h.clock.tick(h.ctx.ttl.deviceCodeSec + 1)
    await expect(
      tokenGrant(h.ctx, { grantType: DEVICE_GRANT, clientId: 'cli', deviceCode: code.device_code }),
    ).rejects.toMatchObject({ error: 'expired_token' })
  })

  it('rejects an unknown device code', async () => {
    const h = await makeHarness()
    await expect(
      tokenGrant(h.ctx, { grantType: DEVICE_GRANT, clientId: 'cli', deviceCode: 'nope' }),
    ).rejects.toMatchObject({ error: 'invalid_grant' })
  })

  it('rejects an unsupported grant type', async () => {
    const h = await makeHarness()
    await expect(
      tokenGrant(h.ctx, { grantType: 'password' }),
    ).rejects.toMatchObject({ error: 'unsupported_grant_type' })
  })

  it('rejects redemption by a different client_id', async () => {
    const h = await makeHarness()
    const code = await issueDeviceCode(h.ctx, { clientId: 'cli', scope: 'agent' })
    await approveDevice(h.ctx, { supabaseToken: 'valid', userCode: code.user_code, decision: 'approve' })
    await expect(
      tokenGrant(h.ctx, { grantType: DEVICE_GRANT, clientId: 'other', deviceCode: code.device_code }),
    ).rejects.toMatchObject({ error: 'invalid_grant' })
  })
})

describe('device approval', () => {
  it('rejects an unknown user code', async () => {
    const h = await makeHarness()
    await expect(
      approveDevice(h.ctx, { supabaseToken: 'valid', userCode: 'ZZZZ-ZZZZ', decision: 'approve' }),
    ).rejects.toBeInstanceOf(OAuthError)
  })

  it('rejects an invalid Supabase token', async () => {
    const h = await makeHarness()
    const code = await issueDeviceCode(h.ctx, { clientId: 'cli', scope: 'agent' })
    await expect(
      approveDevice(h.ctx, { supabaseToken: 'bad', userCode: code.user_code, decision: 'approve' }),
    ).rejects.toThrow()
  })
})

describe('refresh token rotation', () => {
  it('rotates the refresh token and keeps the family', async () => {
    const h = await makeHarness()
    const { bundle } = await authorize(h)
    const next = await tokenGrant(h.ctx, {
      grantType: 'refresh_token',
      refreshToken: bundle.refresh_token,
    })
    expect(next.refresh_token).not.toBe(bundle.refresh_token)
    expect(next.access_token).not.toBe(bundle.access_token)
  })

  it('detects reuse and revokes the whole family', async () => {
    const h = await makeHarness()
    const { bundle } = await authorize(h)
    const next = await tokenGrant(h.ctx, {
      grantType: 'refresh_token',
      refreshToken: bundle.refresh_token,
    })
    // Replaying the original (already-rotated) token trips reuse detection.
    await expect(
      tokenGrant(h.ctx, { grantType: 'refresh_token', refreshToken: bundle.refresh_token }),
    ).rejects.toMatchObject({ error: 'invalid_grant' })
    // ...which revokes the family, so the latest token is dead too.
    await expect(
      tokenGrant(h.ctx, { grantType: 'refresh_token', refreshToken: next.refresh_token }),
    ).rejects.toMatchObject({ error: 'invalid_grant' })
  })

  it('rejects an unknown refresh token', async () => {
    const h = await makeHarness()
    await expect(
      tokenGrant(h.ctx, { grantType: 'refresh_token', refreshToken: 'nope' }),
    ).rejects.toMatchObject({ error: 'invalid_grant' })
  })
})

describe('guard branches', () => {
  it('rejects a device-code grant with no device_code', async () => {
    const h = await makeHarness()
    await expect(tokenGrant(h.ctx, { grantType: DEVICE_GRANT })).rejects.toMatchObject({
      error: 'invalid_request',
    })
  })

  it('rejects a refresh grant with no refresh_token', async () => {
    const h = await makeHarness()
    await expect(tokenGrant(h.ctx, { grantType: 'refresh_token' })).rejects.toMatchObject({
      error: 'invalid_request',
    })
  })

  it('rejects an expired refresh token', async () => {
    const h = await makeHarness()
    const { bundle } = await authorize(h)
    h.clock.tick(h.ctx.ttl.refreshSec + 1)
    await expect(
      tokenGrant(h.ctx, { grantType: 'refresh_token', refreshToken: bundle.refresh_token }),
    ).rejects.toMatchObject({ error: 'invalid_grant' })
  })

  it('reports an unknown jti as inactive', async () => {
    const h = await makeHarness()
    expect(await agentTokens.isActive(h.ctx.db, 'jti_unknown')).toBe(false)
  })

  it('revokeToken with no token is a no-op', async () => {
    const h = await makeHarness()
    await expect(revokeToken(h.ctx, undefined)).resolves.toBeUndefined()
  })
})

describe('revocation', () => {
  it('revokes the family and marks the agent token revoked', async () => {
    const h = await makeHarness()
    const { bundle } = await authorize(h)
    const payload = await verifyAgentToken(h.ctx.keys, bundle.access_token, { issuer: h.ctx.issuer })

    await revokeToken(h.ctx, bundle.refresh_token)

    const row = await agentTokens.findByJti(h.ctx.db, payload.jti as string)
    expect(row?.revoked_at).toBeTruthy()
    expect(await agentTokens.isActive(h.ctx.db, payload.jti as string)).toBe(false)
    await expect(
      tokenGrant(h.ctx, { grantType: 'refresh_token', refreshToken: bundle.refresh_token }),
    ).rejects.toMatchObject({ error: 'invalid_grant' })
  })

  it('is a no-op for an unknown token (RFC 7009)', async () => {
    const h = await makeHarness()
    await expect(revokeToken(h.ctx, 'nope')).resolves.toBeUndefined()
  })
})
