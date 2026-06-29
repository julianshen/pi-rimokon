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
const server = createServer(createApp(ctx, tickets, broker))
attachWebSockets(server, ctx, broker, {
  ticketStore: tickets,
  maxSessionsPerUser: config.MAX_SESSIONS_PER_USER,
  maxClientsPerUser: config.MAX_CLIENTS_PER_USER,
  rateMax: config.WS_RATE_MAX,
  rateWindowMs: config.WS_RATE_WINDOW_MS,
})
server.listen(config.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[pi-remote-server] listening on :${config.PORT}`)
})

// Graceful shutdown (spec §8.1): advise reconnect, drain sockets, then exit.
// Both the SPA and agents auto-reconnect, so a restart is a brief blip.
function shutdown(signal: string): void {
  // eslint-disable-next-line no-console
  console.log(`[pi-remote-server] ${signal} — draining sockets`)
  broker.closeAll(CLOSE_CODES.GOING_AWAY)
  server.close(() => process.exit(0))
  setTimeout(() => process.exit(0), 5000).unref() // hard cap if drain stalls
}
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
