import { describe, expect, it } from 'vitest'
import { SignJWT } from 'jose'
import { SIGNING_ALG } from '../src/auth/keys.ts'
import {
  AGENT_AUDIENCE,
  hashToken,
  newId,
  randomToken,
  signAgentToken,
  verifyAgentToken,
} from '../src/auth/tokens.ts'
import { makeKeys } from './helpers.ts'

const ISSUER = 'https://agents.test'
// Near real time so jose's real-clock exp check passes for valid tokens.
const NOW = Math.floor(Date.now() / 1000)

describe('opaque token helpers', () => {
  it('newId is prefixed and unique', () => {
    const a = newId('jti')
    const b = newId('jti')
    expect(a.startsWith('jti_')).toBe(true)
    expect(a).not.toBe(b)
  })

  it('hashToken is deterministic and one-way', () => {
    const t = randomToken()
    expect(hashToken(t)).toBe(hashToken(t))
    expect(hashToken(t)).not.toBe(t)
  })
})

describe('agent JWT', () => {
  it('signs and verifies a valid token', async () => {
    const keys = await makeKeys()
    const token = await signAgentToken(
      keys,
      { sub: 'user-1', jti: 'jti_1', familyId: 'fam_1', scope: 'agent' },
      { issuer: ISSUER, now: NOW },
    )
    const payload = await verifyAgentToken(keys, token, { issuer: ISSUER })
    expect(payload.sub).toBe('user-1')
    expect(payload.aud).toBe(AGENT_AUDIENCE)
    expect(payload.jti).toBe('jti_1')
    expect(payload.family_id).toBe('fam_1')
  })

  it('rejects a tampered token', async () => {
    const keys = await makeKeys()
    const token = await signAgentToken(
      keys,
      { sub: 'user-1', jti: 'jti_1', familyId: 'fam_1', scope: 'agent' },
      { issuer: ISSUER, now: NOW },
    )
    const tampered = `${token.slice(0, -3)}aaa`
    await expect(verifyAgentToken(keys, tampered, { issuer: ISSUER })).rejects.toThrow()
  })

  it('rejects an expired token', async () => {
    const keys = await makeKeys()
    const token = await signAgentToken(
      keys,
      { sub: 'user-1', jti: 'jti_1', familyId: 'fam_1', scope: 'agent' },
      { issuer: ISSUER, now: NOW - 7200, expiresInSec: 3600 }, // expired an hour ago
    )
    await expect(verifyAgentToken(keys, token, { issuer: ISSUER })).rejects.toThrow()
  })

  it('rejects the wrong issuer', async () => {
    const keys = await makeKeys()
    const token = await signAgentToken(
      keys,
      { sub: 'user-1', jti: 'jti_1', familyId: 'fam_1', scope: 'agent' },
      { issuer: ISSUER, now: NOW },
    )
    await expect(
      verifyAgentToken(keys, token, { issuer: 'https://evil.test' }),
    ).rejects.toThrow()
  })

  it('rejects the wrong audience', async () => {
    const keys = await makeKeys()
    const token = await new SignJWT({ scope: 'agent' })
      .setProtectedHeader({ alg: SIGNING_ALG, kid: keys.kid })
      .setSubject('user-1')
      .setIssuer(ISSUER)
      .setAudience('someone-else')
      .setIssuedAt(NOW)
      .setExpirationTime(NOW + 3600)
      .sign(keys.privateKey)
    await expect(verifyAgentToken(keys, token, { issuer: ISSUER })).rejects.toThrow()
  })
})
