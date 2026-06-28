import 'dotenv/config'
import { createServer } from 'node:http'
import { createApp } from './app.ts'
import { loadConfig } from './config.ts'
import { type AuthContext, DEFAULT_TTL } from './auth/context.ts'
import { loadSigningKeys } from './auth/keys.ts'
import { createSupabaseVerifier } from './auth/supabaseJwt.ts'
import { createPool } from './db/client.ts'

/**
 * Server bootstrap. One `http.Server` hosts the Express routes and (from M2)
 * the `WebSocketServer({ noServer: true })` upgrade routing for `/agent` and
 * `/client`.
 */
const config = loadConfig()
const keys = await loadSigningKeys(config.AGENT_JWT_PRIVATE_KEY, config.AGENT_JWT_PUBLIC_KEY)

const ctx: AuthContext = {
  db: createPool(config.DATABASE_URL),
  keys,
  issuer: config.JWT_ISSUER,
  verificationUri: `${config.ALLOWED_ORIGIN ?? config.JWT_ISSUER}/device`,
  verifySupabaseToken: createSupabaseVerifier(config.SUPABASE_URL),
  now: () => Math.floor(Date.now() / 1000),
  ttl: DEFAULT_TTL,
}

const server = createServer(createApp(ctx))
server.listen(config.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[pi-remote-server] listening on :${config.PORT}`)
})
