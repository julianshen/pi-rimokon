import {
  calculateJwkThumbprint,
  exportJWK,
  importPKCS8,
  importSPKI,
  type JWK,
  type KeyLike,
} from 'jose'

/** RS256 alg used for all agent tokens + the published JWKS. */
export const SIGNING_ALG = 'RS256'

export interface SigningKeys {
  privateKey: KeyLike
  publicKey: KeyLike
  /** Stable key id (JWK thumbprint), set in the JWT header + JWKS entry. */
  kid: string
  /** Public JWK published at /.well-known/jwks.json. */
  publicJwk: JWK
}

/**
 * Load the RS256 signing keypair from PEM strings (spec §3.2). The `kid` is the
 * RFC 7638 thumbprint of the public key, so it is stable and verifiable.
 */
export async function loadSigningKeys(
  privatePem: string,
  publicPem: string,
): Promise<SigningKeys> {
  const privateKey = await importPKCS8(privatePem, SIGNING_ALG)
  const publicKey = await importSPKI(publicPem, SIGNING_ALG)
  const jwk = await exportJWK(publicKey)
  const kid = await calculateJwkThumbprint(jwk)
  return {
    privateKey,
    publicKey,
    kid,
    publicJwk: { ...jwk, kid, alg: SIGNING_ALG, use: 'sig' },
  }
}

/** The JWKS document body served at /.well-known/jwks.json. */
export function jwks(keys: SigningKeys): { keys: JWK[] } {
  return { keys: [keys.publicJwk] }
}
