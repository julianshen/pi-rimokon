import express, { type Express } from 'express'
import type { AuthContext } from './auth/context.ts'
import type { Broker } from './broker/registry.ts'
import type { TicketStore } from './broker/tickets.ts'
import { agentsRouter } from './http/agents.ts'
import { clientRouter } from './http/client.ts'
import { healthRouter } from './http/health.ts'
import { metricsRouter } from './http/metrics.ts'
import { oauthRouter } from './http/oauth.ts'

/**
 * Build the Express app. Kept separate from the server bootstrap (index.ts) so
 * routes are unit-testable without binding a port. When an {@link AuthContext}
 * is provided the device-flow + JWKS + ticket routes are mounted; the WebSocket
 * upgrade handlers attach onto the same server in index.ts.
 */
export function createApp(ctx?: AuthContext, tickets?: TicketStore, broker?: Broker): Express {
  const app = express()
  app.disable('x-powered-by')

  // CORS for every browser-called API (spec §7/§8.1): the SPA origin differs
  // from the server origin, so the ticket fetch + device/approve + Settings
  // calls need an allow-listed Origin and preflight handling.
  if (ctx?.allowedOrigin) {
    const origin = ctx.allowedOrigin
    app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', origin)
      res.header('Vary', 'Origin')
      res.header('Access-Control-Allow-Headers', 'Authorization, Content-Type')
      res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
      if (req.method === 'OPTIONS') {
        res.sendStatus(204)
        return
      }
      next()
    })
  }

  app.use(express.json())
  app.use(healthRouter())
  if (broker) app.use(metricsRouter(broker))
  if (ctx) {
    app.use(oauthRouter(ctx))
    app.use(agentsRouter(ctx))
  }
  if (ctx && tickets) app.use(clientRouter(ctx, tickets))
  return app
}
