import { describe, expect, it } from 'vitest'
import { exportPKCS8, exportSPKI, generateKeyPair } from 'jose'
import { jwks, loadSigningKeys } from '../src/auth/keys.ts'
import { makeKeys } from './helpers.ts'

describe('loadSigningKeys', () => {
  it('loads a matching keypair and publishes a JWK with a kid', async () => {
    const keys = await makeKeys()
    expect(keys.kid).toBeTruthy()
    const doc = jwks(keys)
    expect(doc.keys).toHaveLength(1)
    expect(doc.keys[0]).toMatchObject({ kty: 'RSA', alg: 'RS256', use: 'sig', kid: keys.kid })
  })

  it('fails fast when the private and public PEMs are different keys', async () => {
    const a = await generateKeyPair('RS256', { extractable: true })
    const b = await generateKeyPair('RS256', { extractable: true })
    const privA = await exportPKCS8(a.privateKey)
    const pubB = await exportSPKI(b.publicKey) // mismatched
    await expect(loadSigningKeys(privA, pubB)).rejects.toThrow(/matching keypair/)
  })
})
