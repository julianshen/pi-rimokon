import 'dotenv/config'
import { createServer } from 'node:http'
import { CLOSE_CODES } from '../../shared/protocol.ts'
import { createApp } from './app.ts'
import { loadConfig } from './config.ts'
import { type AuthContext, DEFAULT_TTL } from './auth/context.ts'
import { loadSigningKeys } from './auth/keys.ts'
import { createSupabaseVerifier } from './auth/supabaseJwt.ts'
import { Broker } from './broker/registry.ts'
import { TicketStore } from './broker/tickets.ts'
import { createPool } from './db/client.ts'
import { attachWebSockets } from './ws/attach.ts'

/**
 * Server bootstrap. One `http.Server` hosts the Express routes and (from M2)
 * the `WebSocketServer({ noServer: true })` upgrade routing for `/agent` and
 * `/client`.
 */
const config = loadConfig()
const keys = await loadSigningKeys(config.AGENT_JWT_PRIVATE_KEY, config.AGENT_JWT_PUBLIC_KEY)
const broker = new Broker()
const now = () => Math.floor(Date.now() / 1000)

const ctx: AuthContext = {
  db: createPool(config.DATABASE_URL),
  keys,
  issuer: config.JWT_ISSUER,
  verificationUri: new URL('/device', config.ALLOWED_ORIGIN ?? config.JWT_ISSUER).toString(),
  allowedOrigin: config.ALLOWED_ORIGIN,
  verifySupabaseToken: createSupabaseVerifier(config.SUPABASE_URL),
  now,
  ttl: DEFAULT_TTL,
  onFamilyRevoked: (familyId) => broker.closeFamily(familyId, CLOSE_CODES.FORBIDDEN),
}

const tickets = new TicketStore(now, DEFAULT_TTL.ticketSec)
const server = createServer(createApp(ctx, tickets))
attachWebSockets(server, ctx, broker, { ticketStore: tickets })
server.listen(config.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[pi-remote-server] listening on :${config.PORT}`)
})
